import { SPECIES } from "@/lib/species";
import { json } from "@/lib/server";
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 100);
  const local = SPECIES.filter((s) =>
    `${s.name} ${s.scientific}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .includes(
        q
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, ""),
      ),
  );
  if (q.length < 3) return json({ species: local });
  try {
    const r = await fetch(
      "https://api.gbif.org/v1/species/search?q=" +
        encodeURIComponent(q) +
        "&rank=SPECIES&rank=SUBSPECIES&highertaxonKey=1&status=ACCEPTED&limit=15",
      { signal: AbortSignal.timeout(6000) },
    );
    if (!r.ok) throw new Error("GBIF");
    const d = (await r.json()) as any;
    const seen = new Set(local.map((s) => s.scientific));
    const results = (d.results || [])
      .filter(
        (x: any) =>
          x.kingdom === "Animalia" &&
          !seen.has(x.canonicalName) &&
          seen.add(x.canonicalName),
      )
      .map((x: any) => ({
        id: "gbif-" + x.key,
        gbif: x.key,
        name:
          x.vernacularNames?.find((v: any) => v.language === "fra")
            ?.vernacularName || x.canonicalName,
        scientific: x.canonicalName,
        group:
          (
            {
              Mammalia: "Mammifères",
              Aves: "Oiseaux",
              Reptilia: "Reptiles",
              Amphibia: "Amphibiens",
              Insecta: "Insectes",
              Actinopterygii: "Poissons",
            } as any
          )[x.class] || "Autres",
        kingdom: x.kingdom || "",
        phylum: x.phylum || "",
        className: x.class || "",
        order: x.order || "",
        family: x.family || "",
        genus: x.genus || "",
        subspecies: x.rank === "SUBSPECIES" ? x.canonicalName : undefined,
        habitat: "À compléter avec une source naturaliste.",
        diet: "À compléter avec une source naturaliste.",
        range: "Voir la répartition dans les sources.",
        summary:
          "Taxonomie issue de GBIF. Vérifiez l’identification avant de la confirmer.",
        status: "À vérifier",
        sensitive: true,
        wiki: x.canonicalName,
      }));
    return json({
      species: [...local, ...results],
      source: "GBIF",
      checked: new Date().toISOString(),
    });
  } catch {
    return json({
      species: local,
      warning:
        "GBIF est temporairement indisponible. Les fiches du carnet restent disponibles ; vous pouvez aussi saisir l’espèce manuellement.",
    });
  }
}
