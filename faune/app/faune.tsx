"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Binoculars,
  BookOpen,
  Map,
  Users,
  Network,
  Plus,
  Search,
  SlidersHorizontal,
  Grid2X2,
  List,
  Heart,
  MapPin,
  Leaf,
  ShieldCheck,
  Settings,
  Download,
  ChevronRight,
  Camera,
  CalendarDays,
  X,
  Copy,
  Check,
  Compass,
  Menu,
  MessageCircle,
  Send,
  Lock,
  RefreshCw,
  LogOut,
  TreePine,
  Bird,
  ScanLine,
  Mountain,
  ExternalLink,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { DEMO, statusName, SPECIES } from "@/lib/species";
import type { Observation, AppData, Species } from "@/lib/types";
import { Choice, EmptyState, dateLabel, Spinner, initials } from "./ui";
import ObservationForm from "./observation-form";
import ObservationDetail from "./observation-detail";
import ObservationMap from "./map";
const pages = [
  { id: "collection", label: "Ma collection", icon: Grid2X2 },
  { id: "journal", label: "Mon carnet", icon: BookOpen },
  { id: "map", label: "Mes explorations", icon: Map },
  { id: "taxonomy", label: "L’arbre du vivant", icon: Network },
  { id: "circle", label: "Mon cercle", icon: Users },
];
const titles: Record<string, [string, string]> = {
  collection: [
    "Ma collection",
    "Des instants sauvages, des souvenirs pour toujours.",
  ],
  journal: ["Mon carnet", "Le fil de vos rencontres avec le vivant."],
  map: ["Mes explorations", "Retrouver les paysages de vos rencontres."],
  taxonomy: [
    "L’arbre du vivant",
    "De la grande famille animale à chaque espèce.",
  ],
  circle: [
    "Mon cercle",
    "La nature est encore plus belle quand elle se partage.",
  ],
  guide: [
    "Observer, sans déranger.",
    "Le plus beau souvenir laisse la nature intacte.",
  ],
};
const groups = [
  "Tout voir",
  "Mammifères",
  "Oiseaux",
  "Reptiles",
  "Insectes",
  "Autres",
];
const clean = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export default function Faune() {
  const [page, setPage] = useState("collection"),
    [data, setData] = useState<(AppData & { requests: any[] }) | null>(null),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [demo, setDemo] = useState(true),
    [demoObs, setDemoObs] = useState(DEMO),
    [query, setQuery] = useState(""),
    [group, setGroup] = useState("Tout voir"),
    [region, setRegion] = useState("all"),
    [status, setStatus] = useState("all"),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState(""),
    [sort, setSort] = useState("recent"),
    [favorites, setFavorites] = useState(false),
    [filters, setFilters] = useState(false),
    [layout, setLayout] = useState("grid"),
    [selected, setSelected] = useState<Observation | null>(null),
    [form, setForm] = useState(false),
    [editing, setEditing] = useState<Observation | null>(null),
    [settings, setSettings] = useState(false),
    [invite, setInvite] = useState(false),
    [profileName, setProfileName] = useState(""),
    [bio, setBio] = useState(""),
    [friendCode, setFriendCode] = useState(""),
    [busy, setBusy] = useState(false),
    [profileTab, setProfileTab] = useState("profile");
  const load = useCallback(async (initial = false) => {
    try {
      const r = await fetch("/api/data");
      if (r.status === 401) {
        setLoaded(true);
        return;
      }
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
      setProfileName(d.profile.name);
      setBio(d.profile.bio);
      setError("");
      if (initial && d.observations.length > 0) setDemo(false);
      setSelected((o) =>
        o && !o.demo
          ? d.observations.find((a: Observation) => a.id === o.id) ||
            d.feed.find((a: Observation) => a.id === o.id) ||
            null
          : o,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    void load(true);
    const hash = window.location.hash.slice(1);
    if ([...pages.map((p) => p.id), "guide"].includes(hash)) setPage(hash);
    const params = new URLSearchParams(window.location.search);
    if (params.has("invite")) {
      setFriendCode(params.get("invite") || "");
      setPage("circle");
      setInvite(true);
    }
    if (params.has("new")) setForm(true);
    const change = () => {
      const p = window.location.hash.slice(1);
      if ([...pages.map((p) => p.id), "guide"].includes(p)) setPage(p);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, [load]);
  const navigate = (p: string) => {
    setPage(p);
    window.history.replaceState(null, "", "#" + p);
    setQuery("");
    setGroup("Tout voir");
    setRegion("all");
    setStatus("all");
    setDateFrom("");
    setDateTo("");
    setFavorites(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const observations = demo ? demoObs : data?.observations || [];
  const visible = useMemo(
    () =>
      observations
        .filter(
          (o) =>
            (!query ||
              clean(
                `${o.species.name} ${o.species.scientific} ${o.region} ${o.notes}`,
              ).includes(clean(query))) &&
            (group === "Tout voir" ||
              (group === "Autres"
                ? !["Mammifères", "Oiseaux", "Reptiles", "Insectes"].includes(
                    o.species.group,
                  )
                : o.species.group === group)) &&
            (region === "all" || o.region === region) &&
            (status === "all" || o.species.status === status) &&
            (!favorites || o.favorite) &&
            (!dateFrom || o.date.slice(0, 10) >= dateFrom) &&
            (!dateTo || o.date.slice(0, 10) <= dateTo),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.species.name.localeCompare(b.species.name, "fr")
            : sort === "oldest"
              ? a.date.localeCompare(b.date)
              : b.date.localeCompare(a.date),
        ),
    [
      observations,
      query,
      group,
      region,
      status,
      favorites,
      dateFrom,
      dateTo,
      sort,
    ],
  );
  const collection = useMemo(() => {
    const seen = new Set<string>();
    return visible.filter((o) => {
      const k = o.species.scientific || o.species.name;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [visible]);
  const speciesCount = new Set(
    observations.map((o) => o.species.scientific || o.species.name),
  ).size;
  const regions = [
    ...new Set(observations.map((o) => o.region).filter(Boolean)),
  ];
  async function action(body: any) {
    const r = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d: any = await r.json();
    if (!r.ok) throw new Error(d.error);
    await load();
  }
  async function safeAction(body: any, message: string) {
    setBusy(true);
    try {
      await action(body);
      toast.success(message);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function add() {
    setEditing(null);
    setForm(true);
  }
  async function favorite(o: Observation) {
    if (o.demo) {
      setDemoObs((a) =>
        a.map((x) => (x.id === o.id ? { ...x, favorite: !x.favorite } : x)),
      );
      setSelected((x) =>
        x?.id === o.id ? { ...x, favorite: !x.favorite } : x,
      );
      toast("Favori modifié dans l’exemple.");
      return;
    }
    await safeAction(
      { action: "favorite", id: o.id, value: !o.favorite },
      o.favorite ? "Retiré des favoris." : "Ajouté aux favoris.",
    );
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copié.");
    } catch {
      toast.error("Copie indisponible. Sélectionnez le code affiché.");
    }
  }
  function exportData() {
    if (!data) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            application: "FAUNE",
            version: 1,
            exported: new Date().toISOString(),
            note: "Métadonnées uniquement. Téléchargez les photos depuis chaque fiche.",
            profile: { name: data.profile.name, bio: data.profile.bio },
            observations: data.observations,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download =
      "faune-observations-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Vos observations ont été exportées en JSON.");
  }
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: "search_faune_collection",
        description:
          "Rechercher les observations de la collection affichée ; met à jour le filtre visible.",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input: any) => {
          if (typeof input.query !== "string" || input.query.length > 150)
            throw new Error(
              "query must be a string of 150 characters or fewer",
            );
          setQuery(input.query);
          setPage("collection");
          return {
            query: input.query,
            count: observations.filter((o) =>
              clean(
                o.species.name +
                  " " +
                  o.species.scientific +
                  " " +
                  o.region +
                  " " +
                  o.notes,
              ).includes(clean(input.query)),
            ).length,
          };
        },
      },
      {
        name: "start_faune_observation",
        description:
          "Ouvrir le formulaire de rencontre ; aucune observation n’est créée avant confirmation.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async (input: any) => {
          if (!input || Object.keys(input).length)
            throw new Error("Expected empty object");
          setEditing(null);
          setForm(true);
          return { formOpened: true, saved: false };
        },
      },
    ];
    for (const t of tools)
      Promise.resolve(ctx.registerTool(t, { signal: lifecycle.signal })).catch(
        () => {},
      );
    return () => lifecycle.abort();
  }, [observations]);
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "238px" } as React.CSSProperties}
    >
      <SidebarNavigationSync page={page} />
      <a href="#main" className="skip-link">
        Aller au contenu
      </a>
      <Sidebar className="faune-sidebar">
        <SidebarHeader>
          <button
            className="brand"
            onClick={() => navigate("collection")}
            aria-label="FAUNE, accueil"
          >
            <span className="brand-icon">
              <ScanLine size={30} />
              <Leaf size={15} />
            </span>
            <span>
              faune<span className="brand-period">.</span>
              <small>LE CARNET DU VIVANT</small>
            </span>
          </button>
        </SidebarHeader>
        <SidebarContent>
          <div className="side-section-label">MON UNIVERS</div>
          <SidebarMenu>
            {pages.map((p) => (
              <SidebarMenuItem key={p.id}>
                <SidebarMenuButton
                  isActive={page === p.id}
                  onClick={() => navigate(p.id)}
                  className="nav-item"
                >
                  <p.icon size={19} />
                  <span>{p.label}</span>
                  {p.id === "circle" && !!data?.requests.length && (
                    <b>{data.requests.length}</b>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="side-divider" />
          <button
            className={"favorite-nav " + (favorites ? "active" : "")}
            onClick={() => {
              navigate("collection");
              setFavorites(true);
            }}
          >
            <Heart size={18} />
            Mes coups de cœur
            <span>{observations.filter((o) => o.favorite).length}</span>
          </button>
          <div className="sidebar-note">
            <span className="note-leaf">
              <Leaf size={21} />
            </span>
            <h3>
              Des souvenirs.
              <br />
              Pas des trophées.
            </h3>
            <p>
              La plus belle trace de votre passage, c’est celle que vous ne
              laissez pas.
            </p>
            <button onClick={() => navigate("guide")}>
              L’esprit FAUNE <ChevronRight size={14} />
            </button>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <button
            className="profile-button"
            onClick={() => {
              setProfileTab("profile");
              setSettings(true);
            }}
          >
            <span className="avatar">
              {initials(data?.profile.name || "Naturaliste")}
            </span>
            <span>
              <strong>{data?.profile.name || "Votre carnet"}</strong>
              <small>
                {data ? "Un regard sur le vivant" : "Prêt à explorer"}
              </small>
            </span>
            <Settings size={16} />
          </button>
        </SidebarFooter>
      </Sidebar>
      <div className="app-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="mobile-menu">
              <SidebarTrigger aria-label="Ouvrir la navigation" />
            </span>
            <Leaf size={15} />
            <span className="desktop-crumb">Mon espace</span>
            <span className="mobile-wordmark">faune.</span>
            <ChevronRight size={12} />
            <strong>
              {pages.find((p) => p.id === page)?.label || "L’esprit FAUNE"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="private-label">
              <ShieldCheck size={15} />
              Un carnet, en confiance
            </span>
            <button
              className="topbar-profile avatar"
              aria-label="Ouvrir mon profil"
              onClick={() => setSettings(true)}
            >
              {initials(data?.profile.name || "Naturaliste")}
            </button>
          </div>
        </header>
        <main id="main" className="main-content">
          <div className="page-header">
            <div>
              <p className="eyebrow">
                {page === "circle"
                  ? "LES RENCONTRES QUI NOUS RAPPROCHENT"
                  : "LE MONDE SAUVAGE, À VOTRE RYTHME"}
              </p>
              <h1>
                {titles[page][0]}
                <span>.</span>
              </h1>
              <p>{titles[page][1]}</p>
            </div>
            <button className="btn primary add-button" onClick={add}>
              <Plus size={18} />
              Ajouter une rencontre
            </button>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={() => void load()}>Réessayer</button>
            </div>
          )}
          {page !== "guide" && page !== "circle" && (
            <div className="mode-line">
              <div className="mode-switch">
                <button
                  className={demo ? "selected" : ""}
                  onClick={() => setDemo(true)}
                >
                  Découvrir un carnet
                </button>
                <button
                  className={!demo ? "selected" : ""}
                  onClick={() => setDemo(false)}
                >
                  Mon carnet
                  {data?.observations.length
                    ? ` · ${data.observations.length}`
                    : ""}
                </button>
              </div>
              {demo ? (
                <span className="demo-disclaimer">
                  Carnet d’exemple · observations fictives
                </span>
              ) : (
                <span className="demo-disclaimer">
                  <Lock size={12} />
                  {loaded
                    ? "Vos souvenirs, enregistrés en privé"
                    : "Ouverture du carnet…"}
                </span>
              )}
            </div>
          )}
          {page === "collection" && (
            <>
              <section className="collection-intro">
                <div className="intro-content">
                  <div className="intro-eyebrow">
                    <span className="fine-line" /> COLLECTION PERSONNELLE
                  </div>
                  <h2>
                    Le bonheur est
                    <br />
                    dans les <em>rencontres.</em>
                  </h2>
                  <p>
                    {demo
                      ? "Un aperçu de ce que votre carnet peut devenir."
                      : "Chaque rencontre enrichit votre regard sur le vivant."}
                  </p>
                  <div className="intro-stats">
                    <div>
                      <strong>
                        {speciesCount.toString().padStart(2, "0")}
                      </strong>
                      <span>espèces</span>
                    </div>
                    <div>
                      <strong>
                        {observations.length.toString().padStart(2, "0")}
                      </strong>
                      <span>rencontres</span>
                    </div>
                    <div>
                      <strong>
                        {regions.length.toString().padStart(2, "0")}
                      </strong>
                      <span>régions</span>
                    </div>
                  </div>
                </div>
                <div className="intro-image">
                  <img
                    src="/images/fox.webp"
                    alt="Renard roux dans la végétation, photographie illustrative de Malene Thyssen"
                  />
                  <div className="intro-image-caption">
                    <span>
                      <span className="image-spark">✦</span> À LA RENCONTRE DU
                      VIVANT
                    </span>
                    <strong>Vulpes vulpes</strong>
                    <a
                      href="https://commons.wikimedia.org/wiki/File:R%C3%B8d_r%C3%A6v_(Vulpes_vulpes).jpg"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Malene Thyssen · CC BY 2.5 · photo en parc
                    </a>
                  </div>
                </div>
              </section>
            </>
          )}
          {["collection", "journal", "map", "taxonomy"].includes(page) && (
            <>
              <section className="collection-controls">
                <div className="section-heading">
                  <h2>
                    {page === "collection"
                      ? "Vos espèces"
                      : page === "journal"
                        ? "Au fil des jours"
                        : page === "map"
                          ? "Sur la carte"
                          : "Les liens du vivant"}{" "}
                    <span>
                      {page === "collection"
                        ? collection.length
                        : visible.length}
                    </span>
                  </h2>
                  {page === "collection" && (
                    <div className="layout-switch">
                      <button
                        aria-label="Afficher en grille"
                        aria-pressed={layout === "grid"}
                        className={layout === "grid" ? "active" : ""}
                        onClick={() => setLayout("grid")}
                      >
                        <Grid2X2 size={17} />
                      </button>
                      <button
                        aria-label="Afficher en liste"
                        aria-pressed={layout === "list"}
                        className={layout === "list" ? "active" : ""}
                        onClick={() => setLayout("list")}
                      >
                        <List size={19} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="search-row">
                  <div className="search-field">
                    <Search size={18} />
                    <input
                      aria-label="Rechercher dans les observations"
                      placeholder="Rechercher une espèce, un lieu…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        className="icon-button"
                        aria-label="Effacer la recherche"
                        onClick={() => setQuery("")}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  <button
                    className={
                      "btn secondary filter-btn " + (filters ? "active" : "")
                    }
                    onClick={() => setFilters((v) => !v)}
                  >
                    <SlidersHorizontal size={16} />
                    Filtres
                    {[
                      region !== "all",
                      status !== "all",
                      !!dateFrom,
                      !!dateTo,
                      favorites,
                    ].filter(Boolean).length > 0 && (
                      <b>
                        {
                          [
                            region !== "all",
                            status !== "all",
                            !!dateFrom,
                            !!dateTo,
                            favorites,
                          ].filter(Boolean).length
                        }
                      </b>
                    )}
                  </button>
                  <Choice
                    label="Trier les observations"
                    value={sort}
                    onChange={setSort}
                    options={[
                      { value: "recent", label: "Plus récentes" },
                      { value: "oldest", label: "Plus anciennes" },
                      { value: "name", label: "Nom de l’espèce" },
                    ]}
                    className="sort-choice"
                  />
                </div>
                {filters && (
                  <div className="filter-panel">
                    <label>
                      Région
                      <Choice
                        label="Région"
                        value={region}
                        onChange={setRegion}
                        options={[
                          { value: "all", label: "Toutes les régions" },
                          ...regions.map((v) => ({ value: v, label: v })),
                        ]}
                      />
                    </label>
                    <label>
                      Conservation
                      <Choice
                        label="Conservation"
                        value={status}
                        onChange={setStatus}
                        options={[
                          { value: "all", label: "Tous les statuts" },
                          ...Object.entries(statusName).map(
                            ([value, label]) => ({ value, label }),
                          ),
                        ]}
                      />
                    </label>
                    <label>
                      Depuis le
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </label>
                    <label>
                      Jusqu’au
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </label>
                    <button
                      className={"btn secondary " + (favorites ? "liked" : "")}
                      onClick={() => setFavorites((v) => !v)}
                    >
                      <Heart
                        size={16}
                        fill={favorites ? "currentColor" : "none"}
                      />
                      Favoris
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        setRegion("all");
                        setStatus("all");
                        setDateFrom("");
                        setDateTo("");
                        setFavorites(false);
                        setGroup("Tout voir");
                        setQuery("");
                      }}
                    >
                      Réinitialiser
                    </button>
                  </div>
                )}
                <Tabs
                  value={group}
                  onValueChange={setGroup}
                  className="group-tabs"
                >
                  <TabsList variant="line">
                    {groups.map((g) => (
                      <TabsTrigger value={g} key={g}>
                        {g === "Tout voir" ? (
                          <Compass size={15} />
                        ) : g === "Mammifères" ? (
                          <TreePine size={15} />
                        ) : g === "Oiseaux" ? (
                          <Bird size={15} />
                        ) : null}
                        {g}
                        <span>
                          {g === "Tout voir"
                            ? observations.length
                            : observations.filter((o) =>
                                g === "Autres"
                                  ? ![
                                      "Mammifères",
                                      "Oiseaux",
                                      "Reptiles",
                                      "Insectes",
                                    ].includes(o.species.group)
                                  : o.species.group === g,
                              ).length}
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </section>
              {visible.length === 0 ? (
                <EmptyState
                  title={
                    observations.length
                      ? "Pas encore de rencontre ici."
                      : "Votre histoire commence dehors."
                  }
                  text={
                    observations.length
                      ? "Essayez un autre filtre ou une autre recherche."
                      : "Un oiseau au jardin, une silhouette en forêt… Ajoutez votre première photo et laissez votre collection grandir."
                  }
                  action={
                    <button className="btn primary" onClick={add}>
                      <Camera size={18} />
                      Ajouter une rencontre
                    </button>
                  }
                />
              ) : page === "collection" ? (
                <div
                  className={
                    "specimen-grid " + (layout === "list" ? "list-view" : "")
                  }
                >
                  {collection.map((o, i) => (
                    <article
                      className="specimen-card"
                      key={o.id}
                      style={{ animationDelay: Math.min(i, 8) * 45 + "ms" }}
                    >
                      <button
                        className="card-open"
                        onClick={() => setSelected(o)}
                      >
                        <div
                          className={"specimen-image species-" + o.species.id}
                        >
                          <img
                            src={o.photos[0]}
                            alt={o.species.name}
                            loading={i < 3 ? "eager" : "lazy"}
                          />
                          <span className="species-group">
                            {o.species.group}
                          </span>
                          {o.sensitive && (
                            <span className="sensitive-label">
                              <ShieldCheck size={12} />
                              Protégé
                            </span>
                          )}
                        </div>
                        <div className="specimen-body">
                          <div className="card-index">
                            FICHE {String(i + 1).padStart(3, "0")}
                            <span>
                              {
                                observations.filter(
                                  (x) =>
                                    x.species.scientific ===
                                    o.species.scientific,
                                ).length
                              }{" "}
                              rencontre
                              {observations.filter(
                                (x) =>
                                  x.species.scientific === o.species.scientific,
                              ).length > 1
                                ? "s"
                                : ""}
                            </span>
                          </div>
                          <h3>{o.species.name}</h3>
                          <p className="scientific">{o.species.scientific}</p>
                          <div className="specimen-bottom">
                            <span>
                              <MapPin size={13} />
                              {o.sensitive
                                ? "Lieu protégé"
                                : o.region || "Sans localisation"}
                            </span>
                            <span>
                              {dateLabel(o.date).replace(" 2026", "")}
                            </span>
                          </div>
                        </div>
                      </button>
                      <button
                        className={"card-heart " + (o.favorite ? "liked" : "")}
                        onClick={() => void favorite(o)}
                        aria-label={
                          (o.favorite
                            ? "Retirer des favoris : "
                            : "Ajouter aux favoris : ") + o.species.name
                        }
                      >
                        <Heart
                          size={17}
                          fill={o.favorite ? "currentColor" : "none"}
                        />
                      </button>
                    </article>
                  ))}
                </div>
              ) : page === "journal" ? (
                <Journal observations={visible} onSelect={setSelected} />
              ) : page === "map" ? (
                <ObservationMap observations={visible} onSelect={setSelected} />
              ) : (
                <Taxonomy observations={visible} onSelect={setSelected} />
              )}
            </>
          )}
          {page === "circle" && (
            <div className="circle-layout">
              <div>
                <div className="section-heading">
                  <h2>Le fil des rencontres</h2>
                  <button className="text-button" onClick={() => void load()}>
                    <RefreshCw size={15} />
                    Actualiser
                  </button>
                </div>
                {data?.feed.length ? (
                  data.feed.map((o) => (
                    <article className="feed-card" key={o.id}>
                      <header>
                        <span className="avatar">
                          {initials(o.ownerName || "Naturaliste")}
                        </span>
                        <div>
                          <strong>{o.ownerName}</strong>
                          <small>
                            {dateLabel(o.date)} ·{" "}
                            {o.sensitive
                              ? "Lieu protégé"
                              : o.region || "Dans la nature"}
                          </small>
                        </div>
                        <Users size={16} />
                      </header>
                      <button
                        className="feed-image"
                        onClick={() => setSelected(o)}
                      >
                        <img src={o.photos[0]} alt={o.species.name} />
                      </button>
                      <div className="feed-body">
                        <h3>{o.species.name}</h3>
                        <em>{o.species.scientific}</em>
                        <p>{o.notes}</p>
                        <footer>
                          <button
                            className={o.liked ? "liked" : ""}
                            onClick={() =>
                              void safeAction(
                                { action: "like", id: o.id, value: !o.liked },
                                o.liked
                                  ? "Réaction retirée."
                                  : "Une attention partagée.",
                              )
                            }
                          >
                            <Heart
                              size={18}
                              fill={o.liked ? "currentColor" : "none"}
                            />
                            {o.likes || 0} coup{(o.likes || 0) > 1 ? "s" : ""}{" "}
                            de cœur
                          </button>
                          <button onClick={() => setSelected(o)}>
                            <MessageCircle size={18} />
                            {o.comments || 0} commentaire
                            {(o.comments || 0) > 1 ? "s" : ""}
                          </button>
                        </footer>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="circle-empty">
                    <div className="circle-photo">
                      <img
                        src="/images/kingfisher.webp"
                        alt="Martin-pêcheur, photo illustrative de Frank-2.0, CC0"
                      />
                      <span>Des regards qui se rencontrent.</span>
                    </div>
                    <h2>
                      Votre prochaine belle histoire
                      <br />
                      se partage à plusieurs.
                    </h2>
                    <p>
                      Invitez vos proches dans votre cercle. Retrouvez leurs
                      photos, leurs découvertes et leurs petits moments de
                      nature.
                    </p>
                    <button
                      className="btn primary"
                      onClick={() => setInvite(true)}
                    >
                      <Users size={17} />
                      Inviter mes proches
                    </button>
                    <small>
                      Vos observations ne sont partagées que si vous le
                      choisissez.
                    </small>
                  </div>
                )}
              </div>
              <aside className="circle-sidebar">
                <div className="panel">
                  <span className="eyebrow">EN BONNE COMPAGNIE</span>
                  <h3>
                    Mon cercle <span>{data?.friends.length || 0}</span>
                  </h3>
                  {data?.friends.length ? (
                    data.friends.map((f) => (
                      <div className="friend-row" key={f.id}>
                        <span className="avatar">{initials(f.name)}</span>
                        <div>
                          <strong>{f.name}</strong>
                          <small>{f.bio || "Naturaliste curieux"}</small>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Retirer " +
                                  f.name +
                                  " du cercle ? Cette personne ne verra plus vos rencontres partagées.",
                              )
                            )
                              void safeAction(
                                { action: "unfriend", id: f.id },
                                "Cette personne a été retirée du cercle.",
                              );
                          }}
                          aria-label={"Retirer " + f.name}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p>Un petit cercle, de grandes découvertes.</p>
                  )}
                  <button
                    className="btn secondary full"
                    onClick={() => setInvite(true)}
                  >
                    <Plus size={16} />
                    Agrandir mon cercle
                  </button>
                </div>
                {!!data?.requests.length && (
                  <div className="panel">
                    <h3>Demandes reçues</h3>
                    {data.requests.map((r) => (
                      <div className="request-row" key={r.id}>
                        <strong>{r.name}</strong>
                        <button
                          className="btn primary"
                          disabled={busy}
                          onClick={() =>
                            void safeAction(
                              { action: "accept", id: r.id },
                              "Bienvenue dans le cercle.",
                            )
                          }
                        >
                          Accepter
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Refuser"
                          onClick={() =>
                            void safeAction(
                              { action: "decline", id: r.id },
                              "Demande refusée.",
                            )
                          }
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="circle-ethics">
                  <ShieldCheck size={26} />
                  <h3>
                    Partager la beauté.
                    <br />
                    Protéger le vivant.
                  </h3>
                  <p>
                    Pas de localisation précise, pas de course aux espèces
                    rares. Juste le plaisir de découvrir ensemble.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => navigate("guide")}
                  >
                    Notre charte
                  </button>
                </div>
              </aside>
            </div>
          )}
          {page === "guide" && <Guide />}
          <footer className="page-footer">
            <span>
              <Leaf size={13} /> Observer. Apprendre. Préserver.
            </span>
            <button onClick={() => navigate("guide")}>L’esprit FAUNE</button>
            <span>Avec curiosité, toujours.</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-bottom" aria-label="Navigation mobile">
        <button
          className={page === "collection" ? "active" : ""}
          onClick={() => navigate("collection")}
        >
          <Grid2X2 />
          Collection
        </button>
        <button
          className={page === "journal" ? "active" : ""}
          onClick={() => navigate("journal")}
        >
          <BookOpen />
          Carnet
        </button>
        <button
          className="mobile-add"
          onClick={add}
          aria-label="Ajouter une rencontre"
        >
          <Plus />
        </button>
        <button
          className={page === "map" ? "active" : ""}
          onClick={() => navigate("map")}
        >
          <Map />
          Carte
        </button>
        <button
          className={page === "circle" ? "active" : ""}
          onClick={() => navigate("circle")}
        >
          <Users />
          Cercle
        </button>
      </nav>
      <ObservationForm
        open={form}
        authenticated={!!data}
        editing={editing}
        onClose={() => setForm(false)}
        onSave={() => {
          setDemo(false);
          void load();
        }}
      />
      <ObservationDetail
        observation={selected}
        userId={data?.profile.id}
        onClose={() => setSelected(null)}
        onEdit={(o) => {
          setEditing(o);
          setSelected(null);
          setForm(true);
        }}
        onDelete={async (id) => {
          const ok = await safeAction(
            { action: "delete", id },
            "Rencontre supprimée.",
          );
          if (!ok) throw new Error("Suppression impossible.");
        }}
        onFavorite={favorite}
        onAction={action}
      />
      <Dialog open={invite} onOpenChange={setInvite}>
        <DialogContent className="invite-dialog">
          <DialogHeader>
            <p className="eyebrow">PARTAGER L’ÉMERVEILLEMENT</p>
            <DialogTitle>Bienvenue dans le cercle.</DialogTitle>
            <DialogDescription>
              Échangez vos codes avec vos proches. Chaque nouvelle relation doit
              être acceptée.
            </DialogDescription>
          </DialogHeader>
          {data ? (
            <>
              <div className="invite-code">
                <span>Votre code personnel</span>
                <strong>{data.profile.code}</strong>
                <button
                  className="btn secondary"
                  onClick={() => copy(data.profile.code)}
                >
                  <Copy size={16} />
                  Copier mon code
                </button>
              </div>
              <button
                className="btn primary full"
                onClick={() =>
                  copy(
                    window.location.origin +
                      "/?invite=" +
                      data.profile.code +
                      "#circle",
                  )
                }
              >
                <Copy size={16} />
                Copier mon lien d’invitation
              </button>
              <div className="invite-separator">J’ai reçu un code</div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await safeAction(
                      { action: "request", code: friendCode },
                      "Demande envoyée. Votre proche doit maintenant l’accepter.",
                    )
                  )
                    setFriendCode("");
                }}
              >
                <label>
                  Code de votre proche
                  <input
                    value={friendCode}
                    onChange={(e) =>
                      setFriendCode(
                        e.target.value.toUpperCase().replace(/\s/g, ""),
                      )
                    }
                    placeholder="16 caractères"
                    maxLength={16}
                    minLength={16}
                    required
                  />
                </label>
                <button
                  className="btn primary full"
                  disabled={busy || friendCode.length !== 16}
                >
                  {busy ? <Spinner /> : <Send size={16} />}Demander à rejoindre
                  son cercle
                </button>
              </form>
              <p className="small-note">
                Le code ne donne pas accès à vos photos. Les comptes doivent
                avoir accès à l’application pour se retrouver.
              </p>
            </>
          ) : (
            <div className="auth-prompt">
              <Users size={34} />
              <p>Connectez-vous pour créer votre cercle.</p>
              <a
                className="btn primary"
                href={
                  "/signin-with-chatgpt?return_to=" +
                  encodeURIComponent("/?invite=" + friendCode + "#circle")
                }
                target="_top"
              >
                Connecter mon carnet
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="settings-dialog">
          <DialogHeader>
            <DialogTitle>Mon espace personnel</DialogTitle>
            <DialogDescription>
              Votre profil, vos données et votre tranquillité.
            </DialogDescription>
          </DialogHeader>
          {data ? (
            <>
              <Tabs value={profileTab} onValueChange={setProfileTab}>
                <TabsList>
                  <TabsTrigger value="profile">Profil</TabsTrigger>
                  <TabsTrigger value="privacy">Confidentialité</TabsTrigger>
                </TabsList>
              </Tabs>
              {profileTab === "profile" ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await safeAction(
                      { action: "profile", name: profileName, bio },
                      "Profil enregistré.",
                    );
                  }}
                >
                  <label>
                    Votre nom affiché
                    <input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                      maxLength={60}
                    />
                  </label>
                  <label>
                    Quelques mots sur vous
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={200}
                      placeholder="Photographe du dimanche, amoureux des Pyrénées…"
                    />
                  </label>
                  <button className="btn primary full" disabled={busy}>
                    {busy ? <Spinner /> : <Check size={16} />}Enregistrer mon
                    profil
                  </button>
                </form>
              ) : (
                <div className="settings-privacy">
                  <ShieldCheck size={32} />
                  <h3>Vos données vous appartiennent.</h3>
                  <p>
                    Votre carnet est privé par défaut. Vous choisissez les
                    rencontres partagées avec vos amis. Ils ne reçoivent jamais
                    vos coordonnées.
                  </p>
                  <p>
                    Les photos sont redimensionnées et leurs métadonnées
                    retirées. Les localisations sensibles ne sont pas
                    enregistrées. Les photos et notes restent stockées jusqu’à
                    leur suppression.
                  </p>
                  <button className="btn secondary full" onClick={exportData}>
                    <Download size={17} />
                    Exporter mes observations (JSON)
                  </button>
                  <small>
                    L’export contient les fiches et les notes. Les photos se
                    téléchargent individuellement depuis leurs fiches.
                  </small>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void safeAction(
                        { action: "rotate-code" },
                        "Votre ancien code d’invitation n’est plus utilisable.",
                      )
                    }
                  >
                    <RefreshCw size={15} />
                    Renouveler mon code d’invitation
                  </button>
                </div>
              )}
              <a
                href="/signout-with-chatgpt?return_to=%2F"
                target="_top"
                className="text-button"
              >
                <LogOut size={16} />
                Me déconnecter
              </a>
            </>
          ) : (
            <div className="auth-prompt">
              <Lock size={30} />
              <p>Un carnet personnel, protégé par votre compte.</p>
              <a
                className="btn primary"
                href="/signin-with-chatgpt?return_to=%2F"
                target="_top"
              >
                Connecter mon carnet
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Toaster position="bottom-right" richColors />
    </SidebarProvider>
  );
}
function Journal({
  observations,
  onSelect,
}: {
  observations: Observation[];
  onSelect: (o: Observation) => void;
}) {
  const months = [...new Set(observations.map((o) => o.date.slice(0, 7)))];
  return (
    <div className="journal">
      {months.map((m) => (
        <section key={m}>
          <div className="journal-month">
            <CalendarDays size={18} />
            <h3>
              {new Date(m + "-01T12:00").toLocaleDateString("fr-FR", {
                month: "long",
                year: "numeric",
              })}
            </h3>
            <span>
              {observations.filter((o) => o.date.startsWith(m)).length}{" "}
              rencontres
            </span>
          </div>
          {observations
            .filter((o) => o.date.startsWith(m))
            .map((o) => (
              <button
                className="journal-entry"
                key={o.id}
                onClick={() => onSelect(o)}
              >
                <div className="journal-day">
                  <strong>
                    {new Date(o.date).getDate().toString().padStart(2, "0")}
                  </strong>
                  <span>
                    {new Date(o.date).toLocaleDateString("fr-FR", {
                      weekday: "short",
                    })}
                  </span>
                </div>
                <img src={o.photos[0]} alt={o.species.name} />
                <div>
                  <span className="eyebrow">{o.species.group}</span>
                  <h3>{o.species.name}</h3>
                  <p>{o.notes || o.species.scientific}</p>
                  <small>
                    <MapPin size={12} />
                    {o.sensitive
                      ? "Lieu protégé"
                      : o.region || "Sans localisation"}
                  </small>
                </div>
                <ChevronRight size={18} />
              </button>
            ))}
        </section>
      ))}
    </div>
  );
}
function Taxonomy({
  observations,
  onSelect,
}: {
  observations: Observation[];
  onSelect: (o: Observation) => void;
}) {
  const ranks: [keyof Species, string][] = [
    ["kingdom", "Règne"],
    ["phylum", "Embranchement"],
    ["className", "Classe"],
    ["order", "Ordre"],
    ["family", "Famille"],
    ["genus", "Genre"],
    ["scientific", "Espèce"],
    ["subspecies", "Sous-espèce"],
  ];
  function branch(items: Observation[], level: number): React.ReactNode {
    if (level >= ranks.length)
      return items.map((o) => (
        <button
          className="taxon-observation"
          key={o.id}
          onClick={() => onSelect(o)}
        >
          <img src={o.photos[0]} alt="" />
          <span>
            {o.species.name}
            <small>{dateLabel(o.date)}</small>
          </span>
          <ChevronRight size={16} />
        </button>
      ));
    const [key, label] = ranks[level];
    const names = [
      ...new Set(items.map((o) => String(o.species[key] || "Non renseigné"))),
    ];
    return names.map((name) => {
      const subset = items.filter(
        (o) => String(o.species[key] || "Non renseigné") === name,
      );
      if (name === "Non renseigné" && key === "subspecies")
        return branch(subset, level + 1);
      return (
        <details key={name} open={level < 2} className="taxon-node">
          <summary>
            <span className="taxon-dot" />
            <div>
              <small>{label}</small>
              <strong>{name}</strong>
            </div>
            <span className="taxon-count">
              {new Set(subset.map((o) => o.species.scientific)).size}
            </span>
            <ChevronRight size={16} />
          </summary>
          <div className="taxon-children">{branch(subset, level + 1)}</div>
        </details>
      );
    });
  }
  return (
    <div className="taxonomy-layout">
      <div className="taxonomy-tree">{branch(observations, 0)}</div>
      <aside className="taxonomy-note">
        <Network size={34} />
        <h3>Tout est lié.</h3>
        <p>
          Ouvrez les branches pour découvrir les liens de parenté entre les
          animaux de votre collection.
        </p>
        <p>
          Les niveaux non identifiés peuvent être complétés dans chaque
          observation. La classification peut varier entre les référentiels.
        </p>
        <span>
          Règne · Embranchement · Classe · Ordre · Famille · Genre · Espèce ·
          Sous-espèce
        </span>
      </aside>
    </div>
  );
}
function Guide() {
  const rules = [
    [
      "01",
      "La bonne distance",
      "Si l’animal change de comportement à cause de vous, reculez. Préférez les jumelles ou un téléobjectif.",
    ],
    [
      "02",
      "Un repas, ce n’est pas un cadeau",
      "Ne nourrissez pas les animaux pour les approcher ou obtenir une photo. Respectez leur autonomie.",
    ],
    [
      "03",
      "Un refuge qui reste secret",
      "Ne partagez ni un nid, ni un terrier, ni une position sensible. Vérifiez également les détails visibles dans vos photos et vos notes.",
    ],
    [
      "04",
      "L’observation, sans mise en scène",
      "Ne capturez, ne manipulez et ne déplacez pas un animal. Évitez les appâts, les cris enregistrés et les éclairages perturbants.",
    ],
    [
      "05",
      "Le doute fait partie du voyage",
      "Une identification est une hypothèse à vérifier. Corrigez vos fiches, consultez plusieurs sources et demandez l’avis d’un naturaliste.",
    ],
    [
      "06",
      "Des souvenirs, pas une compétition",
      "Aucune espèce rare ne vaut un dérangement. Ici, on collectionne les souvenirs et les connaissances, pas les performances.",
    ],
  ];
  return (
    <div className="guide">
      <div className="guide-hero">
        <Leaf size={32} />
        <h2>
          La curiosité nous rapproche.
          <br />
          <em>Le respect nous guide.</em>
        </h2>
        <p>
          FAUNE est un carnet de rencontres, pas une invitation à poursuivre les
          animaux. Le vivant n’a rien à prouver.
        </p>
      </div>
      <div className="rules-grid">
        {rules.map(([n, t, p]) => (
          <article key={n}>
            <span>{n}</span>
            <h3>{t}</h3>
            <p>{p}</p>
          </article>
        ))}
      </div>
      <div className="guide-source">
        <ShieldCheck size={22} />
        <div>
          <h3>Apprendre auprès des naturalistes</h3>
          <p>
            Respectez les règlements des espaces protégés et les consignes
            locales. Une catégorie mondiale de conservation ne remplace pas une
            évaluation locale.
          </p>
          <a href="https://www.lpo.fr/" target="_blank" rel="noreferrer">
            LPO
            <ExternalLink size={14} />
          </a>
          <a
            href="https://www.inaturalist.org/pages/community+guidelines"
            target="_blank"
            rel="noreferrer"
          >
            iNaturalist
            <ExternalLink size={14} />
          </a>
          <a
            href="https://www.iucnredlist.org/"
            target="_blank"
            rel="noreferrer"
          >
            Liste rouge UICN
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}

function SidebarNavigationSync({ page }: { page: string }) {
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    setOpenMobile(false);
  }, [page, setOpenMobile]);
  return null;
}
