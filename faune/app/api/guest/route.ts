import {
  ApiError,
  db,
  ensureProfile,
  fail,
  GUEST_COOKIE,
  GUEST_LIFETIME,
  hashGuestToken,
  identity,
  json,
  sameOrigin,
} from "@/lib/server";

export const dynamic = "force-dynamic";

// A random browser credential opens an isolated test notebook. No shared guest account.
// Raw credentials are returned only in an HttpOnly cookie, never JSON or database rows.
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    try {
      const existing = await identity();
      return json({ ready: true, mode: existing.mode });
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
    }
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const userId = "guest_" + crypto.randomUUID();
    const now = new Date();
    await ensureProfile({
      userId,
      displayName: "Explorateur",
      fullName: "Explorateur",
      email: "",
      mode: "guest",
    });
    await db()
      .prepare(
        "INSERT INTO guest_sessions (token_hash,user_id,expires,created) VALUES (?,?,?,?)",
      )
      .bind(
        await hashGuestToken(token),
        userId,
        Math.floor(now.getTime() / 1000) + GUEST_LIFETIME,
        now.toISOString(),
      )
      .run();
    const response = json({ ready: true, mode: "guest" }, 201);
    const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
    response.headers.set(
      "Set-Cookie",
      `${GUEST_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${GUEST_LIFETIME}${secure}`,
    );
    return response;
  } catch (e) {
    return fail(e);
  }
}
