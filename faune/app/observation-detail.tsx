"use client";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  MapPin,
  CalendarDays,
  ShieldCheck,
  ExternalLink,
  Leaf,
  Utensils,
  Globe,
  Heart,
  Pencil,
  Trash2,
  Lock,
  Users,
  Download,
  MessageCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import type { Observation } from "@/lib/types";
import credits from "@/lib/credits.json";
import { statusName } from "@/lib/species";
import { dateLabel, Spinner, initials } from "./ui";
export default function ObservationDetail({
  observation: o,
  onClose,
  onEdit,
  onDelete,
  onFavorite,
  onAction,
  userId,
}: {
  observation: Observation | null;
  onClose: () => void;
  onEdit: (o: Observation) => void;
  onDelete: (id: string) => Promise<void>;
  onFavorite: (o: Observation) => void;
  onAction: (body: any) => Promise<void>;
  userId?: string;
}) {
  const [photo, setPhoto] = useState(0),
    [confirm, setConfirm] = useState(false),
    [deleting, setDeleting] = useState(false),
    [wiki, setWiki] = useState<any>(null),
    [wikiBusy, setWikiBusy] = useState(false),
    [comments, setComments] = useState<any[]>([]),
    [text, setText] = useState(""),
    [sending, setSending] = useState(false),
    [commentError, setCommentError] = useState("");
  useEffect(() => {
    setPhoto(0);
    setWiki(null);
    setComments([]);
    setText("");
    setCommentError("");
    if (o && !o.demo && o.visibility === "friends") void loadComments(o.id);
  }, [o?.id]);
  async function loadComments(id: string) {
    try {
      const r = await fetch("/api/data?comments=" + encodeURIComponent(id));
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      setComments(d.comments);
    } catch (e) {
      setCommentError((e as Error).message);
    }
  }
  async function enrich() {
    if (!o) return;
    setWikiBusy(true);
    try {
      const r = await fetch(
        "/api/wiki?title=" +
          encodeURIComponent(o.species.wiki || o.species.scientific),
      );
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      setWiki(d);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWikiBusy(false);
    }
  }
  if (!o) return <Sheet open={false} />;
  const s = o.species,
    c = (credits as any)[s.id];
  const mine = o.demo || !o.owner || o.owner === userId;
  return (
    <>
      <Sheet open={!!o} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="detail-sheet">
          <div className="detail-scroll">
            <div className="detail-photo">
              <img src={o.photos[photo]} alt={s.name} />
              <span className="photo-count">
                {photo + 1} / {o.photos.length}
              </span>
              {o.demo && (
                <span className="demo-image-tag">Photo illustrative</span>
              )}
            </div>
            {o.photos.length > 1 && (
              <div className="detail-thumbnails">
                {o.photos.map((p, i) => (
                  <button
                    key={p}
                    aria-label={"Voir la photo " + (i + 1)}
                    aria-pressed={photo === i}
                    onClick={() => setPhoto(i)}
                  >
                    <img src={p} alt="" />
                  </button>
                ))}
              </div>
            )}
            <div className="detail-inner">
              <SheetHeader className="detail-header">
                <div className="detail-overline">
                  <span>{s.group}</span>
                  {o.sensitive && (
                    <span>
                      <ShieldCheck size={14} /> Lieu protégé
                    </span>
                  )}
                </div>
                <SheetTitle>{s.name}</SheetTitle>
                <SheetDescription className="scientific">
                  {s.scientific || "Identification à préciser"}
                </SheetDescription>
              </SheetHeader>
              <div className="detail-meta">
                <span>
                  <MapPin size={15} />
                  {o.sensitive
                    ? "Localisation protégée"
                    : o.region || "Région non renseignée"}
                </span>
                <span>
                  <CalendarDays size={15} />
                  {dateLabel(o.date)}
                </span>
              </div>
              <Tabs defaultValue="species" key={o.id} className="detail-tabs">
                <TabsList variant="line">
                  <TabsTrigger value="species">L’espèce</TabsTrigger>
                  <TabsTrigger value="encounter">La rencontre</TabsTrigger>
                  {o.visibility === "friends" && !o.demo && (
                    <TabsTrigger value="discussion">Discussion</TabsTrigger>
                  )}
                </TabsList>
                <TabsContent value="species">
                  <p className="species-summary">{s.summary}</p>
                  <div className="fact-grid">
                    <div>
                      <Leaf size={19} />
                      <h4>Habitat</h4>
                      <p>{s.habitat}</p>
                    </div>
                    <div>
                      <Utensils size={19} />
                      <h4>Alimentation</h4>
                      <p>{s.diet}</p>
                    </div>
                    <div>
                      <Globe size={19} />
                      <h4>Répartition</h4>
                      <p>{s.range}</p>
                    </div>
                    <div>
                      <ShieldCheck size={19} />
                      <h4>Conservation</h4>
                      <p>{statusName[s.status] || s.status}</p>
                      {s.statusSource && (
                        <a
                          className="conservation-source"
                          href={s.statusSource}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {s.statusScope || "Périmètre à vérifier"} ·
                          publication {s.statusYear || "non datée"}{" "}
                          <ExternalLink size={11} />
                        </a>
                      )}
                      <small>
                        Le statut mondial et le statut local peuvent différer.
                        Consultez l’évaluation datée.
                      </small>
                    </div>
                  </div>
                  <section className="taxonomy-detail">
                    <h3>Une place dans le vivant</h3>
                    <dl>
                      {[
                        ["Règne", s.kingdom],
                        ["Embranchement", s.phylum],
                        ["Classe", s.className],
                        ["Ordre", s.order],
                        ["Famille", s.family],
                        ["Genre", s.genus],
                        ["Espèce", s.scientific],
                        ["Sous-espèce", s.subspecies],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value || "Non renseignée"}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  <section className="sources">
                    <h3>Continuer à découvrir</h3>
                    <p>
                      Des sources pour apprendre et vérifier l’identification.
                    </p>
                    <div className="source-links">
                      <a
                        href={
                          "https://fr.wikipedia.org/wiki/" +
                          encodeURIComponent(s.wiki || s.scientific)
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        Wikipédia
                        <ExternalLink size={14} />
                      </a>
                      <a
                        href={
                          s.gbif
                            ? "https://www.gbif.org/species/" + s.gbif
                            : "https://www.gbif.org/species/search?q=" +
                              encodeURIComponent(s.scientific)
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        GBIF
                        <ExternalLink size={14} />
                      </a>
                      <a
                        href={
                          "https://www.inaturalist.org/taxa/search?q=" +
                          encodeURIComponent(s.scientific)
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        iNaturalist
                        <ExternalLink size={14} />
                      </a>
                      <a
                        href={
                          "https://www.iucnredlist.org/search?query=" +
                          encodeURIComponent(s.scientific) +
                          "&searchType=species"
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        Liste rouge UICN
                        <ExternalLink size={14} />
                      </a>
                    </div>
                    <button
                      className="text-button"
                      onClick={enrich}
                      disabled={wikiBusy}
                    >
                      {wikiBusy ? <Spinner /> : <Globe size={15} />}Lire le
                      résumé Wikipédia
                    </button>
                    {wiki && (
                      <div className="wiki-extract">
                        <p>{wiki.extract}</p>
                        <a href={wiki.url} target="_blank" rel="noreferrer">
                          {wiki.license}
                        </a>
                      </div>
                    )}
                  </section>
                </TabsContent>
                <TabsContent value="encounter">
                  <div className="encounter-notes">
                    <p className="eyebrow">NOTES DE TERRAIN</p>
                    <p>
                      {o.notes ||
                        "Un instant préservé dans votre carnet. Ajoutez vos impressions en modifiant la rencontre."}
                    </p>
                  </div>
                  <div className="privacy-box">
                    {o.visibility === "private" ? (
                      <Lock size={20} />
                    ) : (
                      <Users size={20} />
                    )}
                    <div>
                      <strong>
                        {o.visibility === "private"
                          ? "Une rencontre personnelle"
                          : "Partagée avec le cercle"}
                      </strong>
                      <p>
                        {o.visibility === "private"
                          ? "Seul le propriétaire du carnet peut consulter cette observation."
                          : "Seuls les amis acceptés peuvent consulter cette observation. Aucune coordonnée n’est transmise."}
                      </p>
                    </div>
                  </div>
                  {mine && !o.demo && (
                    <a
                      className="btn secondary"
                      href={o.photos[photo]}
                      download={"faune-" + s.scientific + ".jpg"}
                    >
                      <Download size={16} />
                      Télécharger cette photo
                    </a>
                  )}
                </TabsContent>
                <TabsContent value="discussion">
                  <h3>Autour de cette rencontre</h3>
                  {commentError && (
                    <p role="alert" className="form-error">
                      {commentError}
                    </p>
                  )}
                  {comments.length === 0 && (
                    <p className="muted">Soyez le premier à laisser un mot.</p>
                  )}
                  <div className="comments">
                    {comments.map((c) => (
                      <div key={c.id}>
                        <span className="avatar">{initials(c.name)}</span>
                        <div>
                          <strong>{c.name}</strong>
                          <p>{c.body}</p>
                          <small>{dateLabel(c.created)}</small>
                        </div>
                        {(c.mine || mine) && (
                          <button
                            aria-label="Supprimer ce commentaire"
                            className="icon-button"
                            onClick={async () => {
                              try {
                                await onAction({
                                  action: "delete-comment",
                                  id: c.id,
                                });
                                await loadComments(o.id);
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setSending(true);
                      try {
                        await onAction({
                          action: "comment",
                          id: o.id,
                          body: text,
                        });
                        setText("");
                        await loadComments(o.id);
                      } catch (e) {
                        toast.error((e as Error).message);
                      } finally {
                        setSending(false);
                      }
                    }}
                  >
                    <textarea
                      aria-label="Votre commentaire"
                      placeholder="Une question, un souvenir, un mot gentil…"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      maxLength={1000}
                    />
                    <button
                      className="btn primary"
                      disabled={sending || !text.trim()}
                    >
                      {sending ? <Spinner /> : <Send size={16} />}Publier
                    </button>
                  </form>
                </TabsContent>
              </Tabs>
              {o.demo && c && (
                <div className="photo-credit">
                  Photographie :{" "}
                  <a href={c.url} target="_blank" rel="noreferrer">
                    {c.author}
                  </a>{" "}
                  ·{" "}
                  <a href={c.licenseUrl} target="_blank" rel="noreferrer">
                    {c.license}
                  </a>
                  . Affichage recadré, image redimensionnée.
                  {["fox", "lynx"].includes(s.id) &&
                    " Photo prise en parc animalier."}
                  <br />
                  Dates, lieux et notes de ce carnet d’exemple sont fictifs.
                </div>
              )}
            </div>
          </div>
          <div className="detail-footer">
            {mine ? (
              <>
                <button
                  className={"btn secondary " + (o.favorite ? "liked" : "")}
                  onClick={() => onFavorite(o)}
                >
                  <Heart
                    size={17}
                    fill={o.favorite ? "currentColor" : "none"}
                  />
                  {o.favorite ? "Coup de cœur" : "Garder en favori"}
                </button>
                {!o.demo && (
                  <>
                    <button
                      className="icon-button"
                      aria-label="Modifier cette rencontre"
                      onClick={() => onEdit(o)}
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label="Supprimer cette rencontre"
                      onClick={() => setConfirm(true)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
              </>
            ) : (
              <p>
                <Users size={16} />
                Une rencontre de {o.ownerName}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette rencontre ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette observation et ses photos seront supprimées de votre carnet
              et du cercle. Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Conserver</AlertDialogCancel>
            <AlertDialogAction
              className="delete-action"
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                setDeleting(true);
                try {
                  await onDelete(o.id);
                  setConfirm(false);
                  onClose();
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
