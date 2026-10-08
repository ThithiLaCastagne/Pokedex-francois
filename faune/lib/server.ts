import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { headers } from "next/headers";
import { z } from "zod";
import { sensitiveSpecies } from "./species";
import type { Species } from "./types";
export function db() {
  if (!env.DB) throw new Error("Stockage temporairement indisponible.");
  return env.DB;
}
export function bucket() {
  if (!env.BUCKET) throw new Error("Photos temporairement indisponibles.");
  return env.BUCKET;
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export const GUEST_COOKIE = "faune_guest";
export const GUEST_LIFETIME = 180 * 24 * 60 * 60;
export async function hashGuestToken(token: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function identity() {
  const u = await getChatGPTUser();
  if (u) return { ...u, mode: "account" as const };
  const cookie = (await headers()).get("cookie") || "";
  const token = cookie
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(GUEST_COOKIE + "="))
    ?.slice(GUEST_COOKIE.length + 1);
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const session = await db()
      .prepare(
        "SELECT user_id FROM guest_sessions WHERE token_hash=? AND expires>?",
      )
      .bind(await hashGuestToken(token), Math.floor(Date.now() / 1000))
      .first<{ user_id: string }>();
    if (session)
      return {
        userId: session.user_id,
        displayName: "Explorateur",
        fullName: "Explorateur",
        email: "",
        mode: "guest" as const,
      };
  }
  throw new ApiError(
    "Le carnet n’est pas encore ouvert. Autorisez les cookies de ce site et réessayez.",
    401,
  );
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function fail(e: unknown) {
  if (e instanceof ApiError) return json({ error: e.message }, e.status);
  if (e instanceof z.ZodError)
    return json(
      {
        error: "Vérifiez les champs du formulaire.",
        details: e.issues.map((i) => i.path.join(".")),
      },
      400,
    );
  console.error("FAUNE API", e);
  return json(
    {
      error:
        "Le service est momentanément indisponible. Vos modifications ne sont pas perdues : réessayez.",
    },
    503,
  );
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new ApiError("Origine de la requête non autorisée.", 403);
  if (req.headers.get("sec-fetch-site") === "cross-site")
    throw new ApiError("Requête non autorisée.", 403);
}
export async function ensureProfile(u: Awaited<ReturnType<typeof identity>>) {
  await db()
    .prepare(
      "INSERT OR IGNORE INTO profiles (id,name,bio,code,created) VALUES (?,?,?,?,?)",
    )
    .bind(
      u.userId,
      (u.fullName || "Naturaliste").slice(0, 60),
      "",
      crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase(),
      new Date().toISOString(),
    )
    .run();
  return db()
    .prepare("SELECT id,name,bio,code FROM profiles WHERE id=?")
    .bind(u.userId)
    .first();
}
const str = (n = 150) => z.string().trim().max(n);
export const speciesSchema = z.object({
  id: str(),
  name: str().min(1),
  scientific: str(),
  group: str(),
  kingdom: str(),
  phylum: str(),
  className: str(),
  order: str(),
  family: str(),
  genus: str(),
  subspecies: str().optional(),
  habitat: str(1500),
  diet: str(1500),
  range: str(1500),
  summary: str(4000),
  status: z.enum(["LC", "NT", "VU", "EN", "CR", "DD", "NE", "À vérifier"]),
  sensitive: z.boolean(),
  wiki: str(200),
  statusSource: z
    .string()
    .max(500)
    .refine((v) => !v || v.startsWith("https://"), "Lien HTTPS requis")
    .optional(),
  statusYear: str(40).optional(),
  statusScope: str(100).optional(),
  gbif: z.number().int().positive().optional(),
});
export const obsSchema = z.object({
  id: z.string().uuid().optional(),
  species: speciesSchema,
  photos: z
    .array(z.string().regex(/^\/api\/photos\?id=[0-9a-f-]{36}$/))
    .min(1)
    .max(5),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .refine(
      (s) =>
        !Number.isNaN(Date.parse(s)) && Date.parse(s) <= Date.now() + 86400000,
      "Date invalide",
    ),
  region: str(100),
  notes: str(4000),
  visibility: z.enum(["private", "friends"]),
  sensitive: z.boolean(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
});
export function normalizeLocation(
  s: Species,
  sensitive: boolean,
  lat: number | null,
  lng: number | null,
) {
  const hidden = sensitive || sensitiveSpecies(s);
  return {
    sensitive: hidden,
    lat: hidden || lat === null ? null : Math.round(lat * 2) / 2,
    lng: hidden || lng === null ? null : Math.round(lng * 2) / 2,
  };
}
export function serialize(row: any, owner: boolean) {
  return {
    id: row.id,
    species: JSON.parse(row.species),
    photos: JSON.parse(row.photos),
    date: row.date,
    region: row.sensitive && !owner ? "Lieu protégé" : row.region,
    notes: row.notes,
    visibility: row.visibility,
    sensitive: !!row.sensitive,
    lat: owner && !row.sensitive ? row.lat : null,
    lng: owner && !row.sensitive ? row.lng : null,
    favorite: owner ? !!row.favorite : false,
    created: row.created,
    owner: row.user_id,
    ownerName: row.owner_name,
    likes: row.likes || 0,
    liked: !!row.liked,
    comments: row.comments || 0,
  };
}
export async function visibleObservation(id: string, userId: string) {
  const row = await db()
    .prepare(
      "SELECT o.*,p.name AS owner_name FROM observations o JOIN profiles p ON p.id=o.user_id WHERE o.id=? AND (o.user_id=? OR (o.visibility='friends' AND EXISTS(SELECT 1 FROM friends f WHERE f.user_id=? AND f.friend_id=o.user_id)))",
    )
    .bind(id, userId, userId)
    .first();
  if (!row) throw new ApiError("Observation introuvable ou privée.", 404);
  return row;
}
