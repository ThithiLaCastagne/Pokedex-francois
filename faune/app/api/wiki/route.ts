import { json } from "@/lib/server";
export async function GET(req: Request) {
  const title = (new URL(req.url).searchParams.get("title") || "").slice(
    0,
    160,
  );
  if (!title) return json({ error: "Espèce manquante." }, 400);
  try {
    const r = await fetch(
      "https://fr.wikipedia.org/api/rest_v1/page/summary/" +
        encodeURIComponent(title),
      {
        headers: { "User-Agent": "FauneNaturalist/1.0" },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!r.ok) throw new Error("Wiki");
    const d = (await r.json()) as any;
    return json({
      extract: d.extract || "",
      url:
        d.content_urls?.desktop?.page ||
        "https://fr.wikipedia.org/wiki/" + encodeURIComponent(title),
      title: d.title,
      license: "CC BY-SA — Wikipédia",
    });
  } catch {
    return json(
      {
        error:
          "Le résumé est indisponible. Le lien Wikipédia reste accessible.",
      },
      503,
    );
  }
}
