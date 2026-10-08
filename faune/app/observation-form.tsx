"use client";
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import {
  Camera,
  Upload,
  X,
  Check,
  MapPin,
  ShieldCheck,
  ChevronLeft,
  Search,
  Info,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { SPECIES, sensitiveSpecies, statusName } from "@/lib/species";
import type { Species, Observation } from "@/lib/types";
import { Choice, Spinner } from "./ui";
type Photo = { preview: string; blob?: Blob; url?: string };
const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
async function preparePhoto(file: File): Promise<Photo> {
  if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(file.type))
    throw new Error(
      "Choisissez une image JPG, PNG ou WebP. Pour une photo HEIC, exportez-la d’abord en JPEG.",
    );
  if (file.size > 25000000)
    throw new Error("La photo doit peser moins de 25 Mo.");
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > 60000000) {
    bitmap.close();
    throw new Error("La photo est trop grande (60 mégapixels maximum).");
  }
  const ratio = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("Cette photo ne peut pas être lue.")),
      "image/jpeg",
      0.88,
    ),
  );
  return { preview: URL.createObjectURL(blob), blob };
}
export default function ObservationForm({
  open,
  onClose,
  onSave,
  editing,
  authenticated,
  loading,
  onRetry,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editing: Observation | null;
  authenticated: boolean;
  loading: boolean;
  onRetry: () => void;
}) {
  const [step, setStep] = useState(0),
    [photos, setPhotos] = useState<Photo[]>([]),
    [species, setSpecies] = useState<Species | null>(null),
    [results, setResults] = useState(SPECIES),
    [query, setQuery] = useState(""),
    [searching, setSearching] = useState(false),
    [warning, setWarning] = useState(""),
    [manual, setManual] = useState(false),
    [date, setDate] = useState(localNow),
    [region, setRegion] = useState(""),
    [notes, setNotes] = useState(""),
    [visibility, setVisibility] = useState("private"),
    [sensitive, setSensitive] = useState(false),
    [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({
      lat: null,
      lng: null,
    }),
    [busy, setBusy] = useState(false),
    [processing, setProcessing] = useState(false),
    [error, setError] = useState(""),
    [locating, setLocating] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef(photos);
  photoRef.current = photos;
  useEffect(() => {
    if (open) {
      setStep(0);
      setError("");
      setPhotos(
        editing ? editing.photos.map((p) => ({ preview: p, url: p })) : [],
      );
      setSpecies(editing?.species || null);
      setDate(editing?.date || localNow());
      setRegion(editing?.region || "");
      setNotes(editing?.notes || "");
      setVisibility(editing?.visibility || "private");
      setSensitive(editing?.sensitive || false);
      setCoords({ lat: editing?.lat ?? null, lng: editing?.lng ?? null });
      setManual(false);
      setQuery("");
    }
    return () => {
      photoRef.current.forEach((p) => p.blob && URL.revokeObjectURL(p.preview));
    };
  }, [open, editing]);
  useEffect(() => {
    const ctrl = new AbortController();
    const normalized = query
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    setResults(
      SPECIES.filter((s) =>
        `${s.name} ${s.scientific}`
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .includes(normalized),
      ),
    );
    setWarning("");
    setSearching(Boolean(query.trim()));
    const t = setTimeout(async () => {
      if (!query.trim()) {
        setResults(SPECIES);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const r = await fetch("/api/species?q=" + encodeURIComponent(query), {
          signal: ctrl.signal,
        });
        const d: any = await r.json();
        setResults(d.species || []);
        setWarning(d.warning || "");
      } catch (e) {
        if (!ctrl.signal.aborted)
          setWarning(
            "La recherche est indisponible. Vous pouvez saisir une espèce manuellement.",
          );
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);
  async function files(fs: FileList | null) {
    if (!fs) return;
    setProcessing(true);
    setError("");
    try {
      const items = await Promise.all(
        Array.from(fs)
          .slice(0, 5 - photos.length)
          .map(preparePhoto),
      );
      setPhotos((p) => [...p, ...items].slice(0, 5));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  }
  function close() {
    if (busy) return;
    onClose();
  }
  async function submit() {
    if (!species || !photos.length) return;
    setBusy(true);
    setError("");
    try {
      const saved: Photo[] = [];
      for (const p of photos) {
        if (p.url) {
          saved.push(p);
          continue;
        }
        const r = await fetch("/api/photos", {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: p.blob,
        });
        const d: any = await r.json();
        if (!r.ok) throw new Error(d.error);
        p.url = d.url;
        saved.push(p);
      }
      const clean = { ...species };
      delete clean.photo;
      delete clean.credit;
      delete clean.creditUrl;
      delete clean.license;
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          observation: {
            ...(editing ? { id: editing.id } : {}),
            species: clean,
            photos: saved.map((p) => p.url),
            date,
            region,
            notes,
            visibility,
            sensitive: sensitive || sensitiveSpecies(species),
            ...coords,
          },
        }),
      });
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(
        editing
          ? "Rencontre mise à jour."
          : "Une nouvelle rencontre dans votre carnet.",
      );
      onSave();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setError(
        "La géolocalisation n’est pas disponible. Vous pouvez indiquer une région.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({
          lat: Math.round(p.coords.latitude * 2) / 2,
          lng: Math.round(p.coords.longitude * 2) / 2,
        });
        setLocating(false);
      },
      () => {
        setError("Position indisponible. Indiquez simplement une région.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }
  const forceSensitive = species ? sensitiveSpecies(species) : false;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent
        ref={dialogRef}
        className="observation-dialog"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <p className="eyebrow">VOTRE CARNET DE TERRAIN</p>
          <DialogTitle>
            {editing ? "Modifier la rencontre" : "Une nouvelle rencontre"}
          </DialogTitle>
          <DialogDescription>
            Un instant dans la nature. Un souvenir qui reste.
          </DialogDescription>
        </DialogHeader>
        {!authenticated ? (
          <div className="auth-prompt">
            <ShieldCheck size={38} />
            <h3>
              {loading
                ? "Ouverture de votre carnet…"
                : "Le carnet n’a pas pu s’ouvrir"}
            </h3>
            <p>
              Aucune inscription nécessaire. Vos rencontres seront conservées
              dans votre espace personnel sur ce navigateur.
            </p>
            {loading ? (
              <Spinner />
            ) : (
              <button className="btn primary" onClick={onRetry}>
                Réessayer
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="form-steps">
              {["Photos", "Espèce", "Rencontre"].map((s, i) => (
                <button
                  key={s}
                  disabled={i > step || busy}
                  className={i === step ? "current" : i < step ? "done" : ""}
                  onClick={() => setStep(i)}
                >
                  <span>{i < step ? <Check size={13} /> : i + 1}</span>
                  {s}
                </button>
              ))}
            </div>
            <div className="form-body">
              {step === 0 && (
                <>
                  <label
                    className="dropzone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      void files(e.dataTransfer.files);
                    }}
                  >
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                      multiple
                      onChange={(e) => void files(e.target.files)}
                      disabled={processing || photos.length >= 5}
                    />
                    <span className="upload-icon">
                      {processing ? <Spinner /> : <Upload size={26} />}
                    </span>
                    <strong>Vos photos, vos souvenirs.</strong>
                    <span>Glissez vos images ici ou choisissez-les</span>
                    <small>
                      JPG, PNG, WebP · 5 photos maximum · 25 Mo par photo
                    </small>
                  </label>
                  <label className="camera-button">
                    <Camera size={18} />
                    Prendre une photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => void files(e.target.files)}
                    />
                  </label>
                  {photos.length > 0 && (
                    <div className="photo-previews">
                      {photos.map((p, i) => (
                        <div key={p.preview}>
                          <img src={p.preview} alt={"Photo " + (i + 1)} />
                          <button
                            aria-label={"Retirer la photo " + (i + 1)}
                            onClick={() => {
                              if (p.blob) URL.revokeObjectURL(p.preview);
                              setPhotos((a) => a.filter((_, n) => n !== i));
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="small-note">
                    <ShieldCheck size={15} /> Les métadonnées GPS sont retirées.
                    Vos photos restent privées par défaut.
                  </p>
                </>
              )}
              {step === 1 && (
                <>
                  <label className="field-label">
                    Quelle espèce avez-vous rencontrée ?
                  </label>
                  <Combobox
                    items={results}
                    value={species}
                    onValueChange={(v) => {
                      if (v) {
                        setSpecies(v);
                        setSensitive(sensitiveSpecies(v));
                        setManual(false);
                      }
                    }}
                    itemToStringLabel={(s: Species) =>
                      s.name + " · " + s.scientific
                    }
                    isItemEqualToValue={(a, b) => a.id === b.id}
                    onInputValueChange={(v, details) => {
                      if (
                        details.reason === "input-change" ||
                        details.reason === "input-clear" ||
                        details.reason === "clear-press"
                      )
                        setQuery(v);
                    }}
                    filter={null}
                  >
                    <ComboboxInput
                      placeholder="Un nom commun ou scientifique…"
                      className="species-combobox"
                    />
                    <ComboboxContent container={dialogRef}>
                      <ComboboxEmpty>
                        {searching
                          ? "Recherche…"
                          : "Aucun résultat. Essayez un nom scientifique."}
                      </ComboboxEmpty>
                      <ComboboxList>
                        {(s: Species) => (
                          <ComboboxItem key={s.id} value={s}>
                            <span>
                              <strong>{s.name}</strong>
                              <small className="block italic">
                                {s.scientific}
                              </small>
                            </span>
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  {warning && <p className="small-note">{warning}</p>}
                  {species && !manual && (
                    <div className="selected-species">
                      <Check size={22} />
                      <div>
                        <strong>{species.name}</strong>
                        <em>{species.scientific}</em>
                        <small>
                          {species.family} · {species.group}
                        </small>
                      </div>
                    </div>
                  )}
                  <p className="small-note">
                    <Info size={15} /> Recherche taxonomique assistée par GBIF.
                    La photo n’est pas analysée par une IA ; l’identification
                    reste à confirmer par vous.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setManual((v) => !v);
                      if (!species)
                        setSpecies({
                          id: "manual-" + crypto.randomUUID(),
                          name: "",
                          scientific: "",
                          group: "Autres",
                          kingdom: "Animalia",
                          phylum: "",
                          className: "",
                          order: "",
                          family: "",
                          genus: "",
                          habitat: "À documenter.",
                          diet: "À documenter.",
                          range: "À documenter.",
                          summary:
                            "Identification saisie manuellement, à confirmer.",
                          status: "À vérifier",
                          sensitive: true,
                          wiki: "",
                        });
                    }}
                  >
                    <Plus size={16} />
                    {manual
                      ? "Fermer la saisie manuelle"
                      : "Saisir ou corriger manuellement"}
                  </button>
                  {manual && species && (
                    <div className="manual-fields">
                      {[
                        ["name", "Nom commun"],
                        ["scientific", "Nom scientifique"],
                        ["phylum", "Embranchement"],
                        ["className", "Classe"],
                        ["order", "Ordre"],
                        ["family", "Famille"],
                        ["genus", "Genre"],
                        ["subspecies", "Sous-espèce (facultatif)"],
                      ].map(([k, l]) => (
                        <label key={k}>
                          {l}
                          <input
                            value={(species as any)[k] || ""}
                            onChange={(e) =>
                              setSpecies({
                                ...species,
                                [k]: e.target.value,
                                ...(k === "scientific"
                                  ? { wiki: e.target.value }
                                  : {}),
                              })
                            }
                            maxLength={150}
                          />
                        </label>
                      ))}
                      <label>
                        Groupe
                        <Choice
                          value={species.group}
                          onChange={(v) => setSpecies({ ...species, group: v })}
                          label="Groupe"
                          options={[
                            "Mammifères",
                            "Oiseaux",
                            "Reptiles",
                            "Amphibiens",
                            "Insectes",
                            "Poissons",
                            "Autres",
                          ].map((v) => ({ value: v, label: v }))}
                        />
                      </label>
                    </div>
                  )}
                  {species && (
                    <details className="education-edit">
                      <summary>Enrichir la fiche éducative</summary>
                      <div className="manual-fields">
                        {[
                          ["habitat", "Habitat"],
                          ["diet", "Alimentation"],
                          ["range", "Répartition"],
                          ["summary", "Résumé éducatif"],
                        ].map(([k, l]) => (
                          <label key={k}>
                            {l}
                            <textarea
                              rows={2}
                              value={(species as any)[k] || ""}
                              maxLength={k === "summary" ? 4000 : 1500}
                              onChange={(e) =>
                                setSpecies({ ...species, [k]: e.target.value })
                              }
                            />
                          </label>
                        ))}
                        <label>
                          Statut de conservation
                          <Choice
                            value={species.status}
                            label="Statut de conservation"
                            onChange={(v) =>
                              setSpecies({ ...species, status: v })
                            }
                            options={Object.entries(statusName).map(
                              ([value, label]) => ({ value, label }),
                            )}
                          />
                        </label>
                        <label>
                          Périmètre
                          <input
                            value={species.statusScope || ""}
                            placeholder="Monde, France…"
                            maxLength={100}
                            onChange={(e) =>
                              setSpecies({
                                ...species,
                                statusScope: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Année de publication
                          <input
                            value={species.statusYear || ""}
                            placeholder="2024"
                            maxLength={40}
                            onChange={(e) =>
                              setSpecies({
                                ...species,
                                statusYear: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Source de l’évaluation
                          <input
                            type="url"
                            value={species.statusSource || ""}
                            placeholder="https://…"
                            maxLength={500}
                            onChange={(e) =>
                              setSpecies({
                                ...species,
                                statusSource: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <p className="small-note">
                        Une évaluation mondiale et une évaluation locale ne sont
                        pas interchangeables. Conservez la source et l’année de
                        publication.
                      </p>
                    </details>
                  )}
                </>
              )}
              {step === 2 && (
                <>
                  <div className="two-fields">
                    <label>
                      Date et heure
                      <input
                        type="datetime-local"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                        max={localNow()}
                      />
                    </label>
                    <label>
                      Région <span className="optional">facultatif</span>
                      <input
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        placeholder="Ex. Pyrénées, France"
                        maxLength={100}
                      />
                    </label>
                  </div>
                  <label className="field-label">
                    Notes personnelles
                    <textarea
                      rows={3}
                      value={notes}
                      maxLength={4000}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="La lumière, le comportement, ce qui rendait cet instant unique…"
                    />
                  </label>
                  <div className="location-row">
                    <button
                      className="btn secondary"
                      disabled={forceSensitive || sensitive || locating}
                      onClick={locate}
                    >
                      {locating ? <Spinner /> : <MapPin size={17} />}
                      Géolocalisation facultative
                    </button>
                    {coords.lat !== null && (
                      <button
                        className="text-button"
                        onClick={() => setCoords({ lat: null, lng: null })}
                      >
                        Retirer ({coords.lat}°, {coords.lng}°)
                      </button>
                    )}
                  </div>
                  <p className="small-note">
                    Votre position est arrondie à une zone d’environ 50 km. Elle
                    ne sera jamais transmise à vos amis.
                  </p>
                  <label className="field-label">
                    Qui peut voir cette rencontre ?
                    <Choice
                      value={visibility}
                      onChange={setVisibility}
                      label="Confidentialité"
                      options={[
                        { value: "private", label: "Moi uniquement" },
                        { value: "friends", label: "Mon cercle d’amis" },
                      ]}
                    />
                  </label>
                  <div className="protection-row">
                    <div>
                      <strong>Protéger cette espèce</strong>
                      <p>
                        Ne conserver aucune coordonnée, masquer la région aux
                        amis.
                      </p>
                    </div>
                    <Switch
                      checked={forceSensitive || sensitive}
                      disabled={forceSensitive}
                      onCheckedChange={setSensitive}
                      aria-label="Protéger cette espèce"
                    />
                  </div>
                  {forceSensitive && (
                    <p className="small-note">
                      Protection activée pour cette espèce sensible ou dont le
                      statut reste à vérifier.
                    </p>
                  )}
                  <p className="ethics-inline">
                    <LeafIcon />
                    J’observe à distance, sans nourrir ni déranger. Je ne publie
                    pas de lieu précis dans mes notes ou sur mes photos.
                  </p>
                </>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="form-footer">
              <span>
                {step === 0
                  ? "Le début d’une belle collection."
                  : step === 1
                    ? "Chaque identification compte."
                    : "La nature vous remercie."}
              </span>
              {step > 0 && (
                <button
                  className="btn secondary"
                  onClick={() => setStep((s) => s - 1)}
                  disabled={busy}
                >
                  <ChevronLeft size={16} />
                  Retour
                </button>
              )}
              <button
                className="btn primary"
                onClick={() =>
                  step < 2 ? setStep((s) => s + 1) : void submit()
                }
                disabled={
                  busy ||
                  processing ||
                  (step === 0 && !photos.length) ||
                  (step === 1 && !species?.name.trim()) ||
                  (step === 2 && !date)
                }
              >
                {busy ? (
                  <>
                    <Spinner />
                    Enregistrement…
                  </>
                ) : step < 2 ? (
                  "Continuer"
                ) : editing ? (
                  "Enregistrer"
                ) : (
                  "Ajouter à mon carnet"
                )}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
function LeafIcon() {
  return <ShieldCheck size={18} />;
}
