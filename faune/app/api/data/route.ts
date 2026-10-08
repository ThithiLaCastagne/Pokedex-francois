import { z } from "zod";
import {
  db,
  json,
  identity,
  ensureProfile,
  fail,
  sameOrigin,
  obsSchema,
  normalizeLocation,
  serialize,
  ApiError,
  visibleObservation,
  bucket,
} from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = await identity();
    const url = new URL(req.url);
    const comments = url.searchParams.get("comments");
    if (comments) {
      await visibleObservation(comments, u.userId);
      const rows = await db()
        .prepare(
          "SELECT c.id,c.body,c.created,c.user_id,p.name FROM comments c JOIN profiles p ON p.id=c.user_id WHERE c.observation_id=? ORDER BY c.created LIMIT 200",
        )
        .bind(comments)
        .all();
      return json({
        comments: rows.results.map((r: any) => ({
          ...r,
          mine: r.user_id === u.userId,
          user_id: undefined,
        })),
      });
    }
    const profile = await ensureProfile(u);
    const [own, feed, friends, requests] = await Promise.all([
      db()
        .prepare(
          "SELECT * FROM observations WHERE user_id=? ORDER BY date DESC LIMIT 2000",
        )
        .bind(u.userId)
        .all(),
      db()
        .prepare(
          "SELECT o.*,p.name AS owner_name,(SELECT COUNT(*) FROM likes l WHERE l.observation_id=o.id) AS likes,(SELECT COUNT(*) FROM likes l WHERE l.observation_id=o.id AND l.user_id=?) AS liked,(SELECT COUNT(*) FROM comments c WHERE c.observation_id=o.id) AS comments FROM observations o JOIN profiles p ON p.id=o.user_id WHERE o.visibility='friends' AND (o.user_id=? OR EXISTS(SELECT 1 FROM friends f WHERE f.user_id=? AND f.friend_id=o.user_id)) ORDER BY o.created DESC LIMIT 200",
        )
        .bind(u.userId, u.userId, u.userId)
        .all(),
      db()
        .prepare(
          "SELECT p.id,p.name,p.bio FROM friends f JOIN profiles p ON p.id=f.friend_id WHERE f.user_id=? ORDER BY p.name",
        )
        .bind(u.userId)
        .all(),
      db()
        .prepare(
          "SELECT p.id,p.name FROM requests r JOIN profiles p ON p.id=r.sender WHERE r.recipient=?",
        )
        .bind(u.userId)
        .all(),
    ]);
    return json({
      session: { mode: u.mode },
      profile,
      observations: own.results.map((r) => serialize(r, true)),
      feed: feed.results.map((r: any) => serialize(r, r.user_id === u.userId)),
      friends: friends.results,
      requests: requests.results,
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await identity();
    if (Number(req.headers.get("content-length") || 0) > 100000)
      throw new ApiError("Requête trop volumineuse.", 413);
    const b = (await req.json()) as any;
    await ensureProfile(u);
    const now = new Date().toISOString();
    switch (b.action) {
      case "save": {
        const d = obsSchema.parse(b.observation);
        const id = d.id || crypto.randomUUID();
        if (
          d.id &&
          !(await db()
            .prepare("SELECT id FROM observations WHERE id=? AND user_id=?")
            .bind(id, u.userId)
            .first())
        )
          throw new ApiError("Observation introuvable.", 404);
        for (const p of d.photos) {
          if (
            !(await db()
              .prepare("SELECT id FROM photos WHERE id=? AND user_id=?")
              .bind(p.split("=")[1], u.userId)
              .first())
          )
            throw new ApiError("Photo non autorisée.", 403);
        }
        const geo = normalizeLocation(d.species, d.sensitive, d.lat, d.lng);
        const vals = [
          JSON.stringify(d.species),
          JSON.stringify(d.photos),
          d.date,
          d.region,
          d.notes,
          d.visibility,
          +geo.sensitive,
          geo.lat,
          geo.lng,
        ];
        if (d.id)
          await db()
            .prepare(
              "UPDATE observations SET species=?,photos=?,date=?,region=?,notes=?,visibility=?,sensitive=?,lat=?,lng=? WHERE id=? AND user_id=?",
            )
            .bind(...vals, id, u.userId)
            .run();
        else
          await db()
            .prepare(
              "INSERT INTO observations (species,photos,date,region,notes,visibility,sensitive,lat,lng,id,user_id,created,favorite) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)",
            )
            .bind(...vals, id, u.userId, now)
            .run();
        return json({ id });
      }
      case "favorite": {
        const d = z.object({ id: z.string(), value: z.boolean() }).parse(b);
        await db()
          .prepare(
            "UPDATE observations SET favorite=? WHERE id=? AND user_id=?",
          )
          .bind(+d.value, d.id, u.userId)
          .run();
        return json({ ok: true });
      }
      case "delete": {
        const id = z.string().uuid().parse(b.id);
        const row: any = await db()
          .prepare("SELECT photos FROM observations WHERE id=? AND user_id=?")
          .bind(id, u.userId)
          .first();
        if (!row) throw new ApiError("Observation introuvable.", 404);
        await db()
          .prepare("DELETE FROM observations WHERE id=? AND user_id=?")
          .bind(id, u.userId)
          .run();
        for (const url of JSON.parse(row.photos)) {
          const pid = url.split("=")[1];
          const count: any = await db()
            .prepare(
              "SELECT COUNT(*) AS n FROM observations WHERE user_id=? AND EXISTS(SELECT 1 FROM json_each(photos) WHERE value=?)",
            )
            .bind(u.userId, url)
            .first();
          if (!count.n) {
            await bucket().delete(pid);
            await db()
              .prepare("DELETE FROM photos WHERE id=? AND user_id=?")
              .bind(pid, u.userId)
              .run();
          }
        }
        return json({ ok: true });
      }
      case "profile": {
        const d = z
          .object({
            name: z.string().trim().min(1).max(60),
            bio: z.string().trim().max(200),
          })
          .parse(b);
        await db()
          .prepare("UPDATE profiles SET name=?,bio=? WHERE id=?")
          .bind(d.name, d.bio, u.userId)
          .run();
        return json({ ok: true });
      }
      case "rotate-code":
        await db()
          .prepare("UPDATE profiles SET code=? WHERE id=?")
          .bind(
            crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase(),
            u.userId,
          )
          .run();
        return json({ ok: true });
      case "request": {
        const code = z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-F0-9]{16}$/)
          .parse(b.code);
        const other: any = await db()
          .prepare("SELECT id FROM profiles WHERE code=?")
          .bind(code)
          .first();
        if (!other || other.id === u.userId)
          throw new ApiError("Ce code ne correspond pas à un autre carnet.");
        const connected = await db()
          .prepare("SELECT 1 FROM friends WHERE user_id=? AND friend_id=?")
          .bind(u.userId, other.id)
          .first();
        if (connected)
          throw new ApiError("Vous êtes déjà dans le même cercle.");
        await db()
          .prepare(
            "INSERT OR IGNORE INTO requests(sender,recipient,created) VALUES (?,?,?)",
          )
          .bind(u.userId, other.id, now)
          .run();
        return json({ ok: true });
      }
      case "accept": {
        const id = z.string().max(200).parse(b.id);
        if (
          !(await db()
            .prepare("SELECT 1 FROM requests WHERE sender=? AND recipient=?")
            .bind(id, u.userId)
            .first())
        )
          throw new ApiError("Invitation introuvable.", 404);
        await db().batch([
          db()
            .prepare(
              "INSERT OR IGNORE INTO friends(user_id,friend_id,created) VALUES(?,?,?)",
            )
            .bind(u.userId, id, now),
          db()
            .prepare(
              "INSERT OR IGNORE INTO friends(user_id,friend_id,created) VALUES(?,?,?)",
            )
            .bind(id, u.userId, now),
          db()
            .prepare(
              "DELETE FROM requests WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)",
            )
            .bind(id, u.userId, u.userId, id),
        ]);
        return json({ ok: true });
      }
      case "decline":
        await db()
          .prepare("DELETE FROM requests WHERE sender=? AND recipient=?")
          .bind(z.string().parse(b.id), u.userId)
          .run();
        return json({ ok: true });
      case "unfriend": {
        const id = z.string().parse(b.id);
        await db().batch([
          db()
            .prepare("DELETE FROM friends WHERE user_id=? AND friend_id=?")
            .bind(u.userId, id),
          db()
            .prepare("DELETE FROM friends WHERE user_id=? AND friend_id=?")
            .bind(id, u.userId),
        ]);
        return json({ ok: true });
      }
      case "like": {
        const id = z.string().uuid().parse(b.id);
        await visibleObservation(id, u.userId);
        if (b.value === true)
          await db()
            .prepare(
              "INSERT OR IGNORE INTO likes(observation_id,user_id) VALUES(?,?)",
            )
            .bind(id, u.userId)
            .run();
        else
          await db()
            .prepare("DELETE FROM likes WHERE observation_id=? AND user_id=?")
            .bind(id, u.userId)
            .run();
        return json({ ok: true });
      }
      case "comment": {
        const d = z
          .object({
            id: z.string().uuid(),
            body: z.string().trim().min(1).max(1000),
          })
          .parse(b);
        await visibleObservation(d.id, u.userId);
        await db()
          .prepare(
            "INSERT INTO comments(id,observation_id,user_id,body,created) VALUES(?,?,?,?,?)",
          )
          .bind(crypto.randomUUID(), d.id, u.userId, d.body, now)
          .run();
        return json({ ok: true });
      }
      case "delete-comment": {
        const id = z.string().uuid().parse(b.id);
        await db()
          .prepare(
            "DELETE FROM comments WHERE id=? AND (user_id=? OR observation_id IN (SELECT id FROM observations WHERE user_id=?))",
          )
          .bind(id, u.userId, u.userId)
          .run();
        return json({ ok: true });
      }
      default:
        throw new ApiError("Action inconnue.");
    }
  } catch (e) {
    return fail(e);
  }
}
