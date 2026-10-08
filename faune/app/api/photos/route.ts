import {
  db,
  bucket,
  json,
  identity,
  ensureProfile,
  fail,
  sameOrigin,
  ApiError,
} from "@/lib/server";
export const dynamic = "force-dynamic";
// Drop APP1 (EXIF/XMP), APP13 (IPTC), and comments regardless of client processing.
export function stripMetadata(data: Uint8Array) {
  if (data[0] !== 255 || data[1] !== 216)
    throw new ApiError("Format JPEG requis.");
  const out: Uint8Array[] = [data.slice(0, 2)];
  let pos = 2;
  while (pos < data.length) {
    if (data[pos] !== 255) throw new ApiError("Photo JPEG invalide.");
    const marker = data[pos + 1];
    if (marker === 0xda) {
      out.push(data.slice(pos));
      return new Blob(out as BlobPart[], { type: "image/jpeg" });
    }
    if (marker === 0xd9) {
      out.push(data.slice(pos, pos + 2));
      return new Blob(out as BlobPart[], { type: "image/jpeg" });
    }
    const len = (data[pos + 2] << 8) | data[pos + 3];
    if (len < 2 || pos + 2 + len > data.length)
      throw new ApiError("Photo JPEG invalide.");
    if (![0xe1, 0xed, 0xfe].includes(marker))
      out.push(data.slice(pos, pos + 2 + len));
    pos += len + 2;
  }
  throw new ApiError("Photo JPEG incomplète.");
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await identity();
    await ensureProfile(u);
    if (Number(req.headers.get("content-length") || 0) > 5000000)
      throw new ApiError("La photo dépasse 5 Mo.", 413);
    const data = new Uint8Array(await req.arrayBuffer());
    if (data.length > 5000000)
      throw new ApiError("La photo dépasse 5 Mo.", 413);
    const count: any = await db()
      .prepare("SELECT COUNT(*) AS n FROM photos WHERE user_id=?")
      .bind(u.userId)
      .first();
    if (count.n >= 3000)
      throw new ApiError(
        "La limite de 3 000 photos de ce carnet est atteinte.",
      );
    const clean = stripMetadata(data);
    const id = crypto.randomUUID();
    await bucket().put(id, await clean.arrayBuffer(), {
      httpMetadata: { contentType: "image/jpeg" },
    });
    try {
      await db()
        .prepare("INSERT INTO photos(id,user_id,created) VALUES(?,?,?)")
        .bind(id, u.userId, new Date().toISOString())
        .run();
    } catch (e) {
      await bucket().delete(id);
      throw e;
    }
    return json({ url: "/api/photos?id=" + id });
  } catch (e) {
    return fail(e);
  }
}
export async function GET(req: Request) {
  try {
    const u = await identity();
    const id = new URL(req.url).searchParams.get("id");
    if (!id || !/^[a-f0-9-]{36}$/.test(id))
      throw new ApiError("Photo introuvable.", 404);
    const row: any = await db()
      .prepare("SELECT user_id FROM photos WHERE id=?")
      .bind(id)
      .first();
    if (!row) throw new ApiError("Photo introuvable.", 404);
    if (row.user_id !== u.userId) {
      const access = await db()
        .prepare(
          "SELECT o.id FROM observations o WHERE o.user_id=? AND o.visibility='friends' AND EXISTS(SELECT 1 FROM json_each(o.photos) WHERE value=?) AND EXISTS(SELECT 1 FROM friends f WHERE f.user_id=? AND f.friend_id=o.user_id)",
        )
        .bind(row.user_id, "/api/photos?id=" + id, u.userId)
        .first();
      if (!access) throw new ApiError("Photo privée.", 403);
    }
    const obj = await bucket().get(id);
    if (!obj) throw new ApiError("Photo indisponible.", 404);
    return new Response(obj.body, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": 'inline; filename="faune.jpg"',
      },
    });
  } catch (e) {
    return fail(e);
  }
}
