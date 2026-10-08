import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Binoculars, BookOpen, CalendarDays, Check, ChevronRight, Compass, Database, ExternalLink, Heart, Leaf, LockKeyhole, MapPin, Menu, Plus, Search, ShieldCheck, Sparkles, TreePine, Trash2, X } from 'lucide-react'
import { demoObservations, regions, species, statusLabels } from './data'
import { clearObservations, deleteObservation, downloadBackup, importBackup, loadObservations, saveObservation, setFavorite } from './storage'
import { filterObservations, formatDate, observationSpecies } from './lib'
import type { Filters } from './lib'
import type { Observation, ObservationInput } from './types'
import ObservationForm from './components/ObservationForm'
import ObservationDetail from './components/ObservationDetail'
import TaxonomyView from './components/TaxonomyView'
import MapView from './components/MapView'

type View = 'collection' | 'taxonomy' | 'map' | 'timeline' | 'privacy'
const navigation = [
  { id: 'collection', label: 'Mon carnet', icon: BookOpen },
  { id: 'taxonomy', label: 'Taxonomie', icon: TreePine },
  { id: 'map', label: 'Carte des rencontres', icon: Compass },
  { id: 'timeline', label: 'Chronologie', icon: CalendarDays },
  { id: 'privacy', label: 'Confidentialité', icon: ShieldCheck },
] as const
const initialFilters: Filters = { query: '', category: '', region: '', status: '', from: '', to: '', favorites: false }

function Card({ observation, isDemo, onOpen, onFavorite }: { observation: Observation; isDemo: boolean; onOpen: () => void; onFavorite: () => void }) {
  const animal = observationSpecies(observation)
  const region = regions.find(item => item.id === observation.regionId)
  return <article className="observation-card">
    <button className="card-image" onClick={onOpen} aria-label={`Ouvrir ${animal?.name || 'Espèce à identifier'}`}>
      <img src={observation.photos[0] || animal?.cover || './animal-fallback.svg'} alt={observation.photos.length ? `Photo personnelle : ${animal?.name || 'animal non identifié'}` : `Illustration : ${animal?.name || 'animal'}`} loading="lazy" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = './animal-fallback.svg' }} />
      {animal && <span className={`status-badge status-${animal.status}`} title={statusLabels[animal.status]}>{animal.status} · {statusLabels[animal.status]}</span>}
      {isDemo && <span className="sample-label">EXEMPLE</span>}
    </button>
    {!isDemo && <button className={`card-heart ${observation.favorite ? 'selected' : ''}`} aria-label={observation.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={observation.favorite} onClick={onFavorite}><Heart size={17} fill={observation.favorite ? 'currentColor' : 'none'} /></button>}
    <button className="card-content" onClick={onOpen}>
      <span className="card-title">{animal?.name || 'Une rencontre à identifier'}<ChevronRight size={17} /></span>
      <span className="card-scientific">{animal?.scientificName || 'Identification à compléter'}</span>
      <span className="card-footer"><span><MapPin size={13} />{region?.name || 'Lieu privé'}</span><span>{formatDate(observation.date)}</span></span>
    </button>
  </article>
}

export default function App() {
  const [view, setView] = useState<View>('collection')
  const [observations, setObservations] = useState<Observation[]>([])
  const [loaded, setLoaded] = useState(false)
  const [demo, setDemo] = useState(true)
  const [filters, setFilters] = useState(initialFilters)
  const [selected, setSelected] = useState<Observation | null>(null)
  const [selectedReadOnly, setSelectedReadOnly] = useState(false)
  const [form, setForm] = useState<{ initial?: Observation } | null>(null)
  const [toast, setToast] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [resetConfirmation, setResetConfirmation] = useState(false)
  const [busy, setBusy] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<(Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notify = (message: string) => { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 5500) }

  useEffect(() => {
    let cancelled = false
    loadObservations().then(items => { if (!cancelled) { setObservations(items); setDemo(items.length === 0); setLoaded(true) } }).catch(() => { if (!cancelled) { setLoaded(true); setToast('Le stockage est indisponible. Vérifiez que le navigateur autorise le stockage de ce site.') } })
    const listener = (event: Event) => { event.preventDefault(); setInstallPrompt(event as typeof installPrompt) }
    window.addEventListener('beforeinstallprompt', listener)
    return () => { cancelled = true; window.removeEventListener('beforeinstallprompt', listener); if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [])

  const isDemo = demo && observations.length === 0
  const displayed = isDemo ? demoObservations : observations
  const filtered = filterObservations(displayed, filters)
  const distinctSpecies = new Set(observations.map(item => item.speciesId || item.customSpecies?.scientificName || item.customSpecies?.name).filter(Boolean)).size
  const distinctRegions = new Set(observations.map(item => item.regionId).filter(Boolean)).size
  const navigate = (next: View) => { setView(next); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const open = (observation: Observation, readOnly = isDemo) => { setSelected(observation); setSelectedReadOnly(readOnly) }
  const refresh = async () => setObservations(await loadObservations())
  const favorite = async (observation: Observation) => {
    try { await setFavorite(observation.id, !observation.favorite); await refresh(); if (selected?.id === observation.id) setSelected({ ...observation, favorite: !observation.favorite }) }
    catch { notify('Le favori n’a pas pu être enregistré. Réessayez.') }
  }
  const submit = async (input: ObservationInput) => {
    await saveObservation(input, form?.initial?.id)
    await refresh(); setDemo(false); setForm(null); setSelected(null)
    notify(form?.initial ? 'Observation mise à jour.' : 'Une nouvelle rencontre dans votre carnet !')
  }
  const backup = async () => { try { await downloadBackup(); notify('Sauvegarde téléchargée. Conservez-la en lieu sûr : elle contient vos photos et notes.') } catch (error) { notify(error instanceof Error ? error.message : 'La sauvegarde a échoué.') } }
  const importFile = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('Cette sauvegarde est trop volumineuse (100 Mo maximum).')
      const count = await importBackup(await file.text()); await refresh(); setDemo(false); notify(`${count} observation${count > 1 ? 's' : ''} importée${count > 1 ? 's' : ''}.`)
    } catch (error) { notify(error instanceof Error ? error.message : 'Le fichier de sauvegarde est invalide.') }
    finally { setBusy(false); if (importRef.current) importRef.current.value = '' }
  }
  const groups = filtered.reduce<Record<string, Observation[]>>((acc, item) => {
    const month = item.date.slice(0, 7); (acc[month] ||= []).push(item); return acc
  }, {})

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'is-open' : ''}`} aria-label="Navigation principale">
      <a className="brand" href="#" onClick={event => { event.preventDefault(); navigate('collection') }}>
        <span className="brand-mark"><Leaf size={26} /></span><span><span className="brand-name">faune<span>.</span></span><span className="brand-subtitle">POKÉDEX PERSONNEL</span></span>
      </a>
      <span className="sidebar-label">VOTRE EXPLORATION</span>
      <nav className="nav-list">{navigation.map(item => <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)} aria-current={view === item.id ? 'page' : undefined}><item.icon className="nav-icon" size={19} /><span>{item.label}</span>{item.id === 'collection' && <span className="nav-count">{observations.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="privacy-note"><ShieldCheck size={22} /><strong>Observer, c’est respecter.</strong><p>Un souvenir pour vous.<br />Un habitat préservé pour eux.</p></div>
        <div className="sidebar-footer"><span className="online-dot" />Carnet privé sur cet appareil</div>
        {installPrompt && <button className="btn btn-secondary" onClick={async () => { await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null) }}><ArrowDownToLine size={15} />Installer l’application</button>}
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <button className="icon-btn mobile-menu" aria-label={mobileMenu ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={mobileMenu} onClick={() => setMobileMenu(!mobileMenu)}><Menu size={22} /></button>
        <div className="breadcrumbs"><Leaf size={15} /><span>Votre espace nature</span><ChevronRight size={14} /><strong>{navigation.find(item => item.id === view)?.label}</strong></div>
        <div className="topbar-actions"><span className="topbar-private"><LockKeyhole size={14} />Privé</span><button className="btn btn-primary" onClick={() => setForm({})}><Plus size={18} /><span>Ajouter une observation</span></button></div>
      </header>
      <main className="main-content">
        <input ref={importRef} type="file" accept="application/json,.json" hidden aria-label="Importer une sauvegarde" onChange={event => void importFile(event.target.files?.[0])} />
        {view === 'collection' && <>
          <div className="page-heading"><div><p className="eyebrow">LES RENCONTRES QUI RESTENT</p><h1>Mon carnet de faune<span className="heading-dot">.</span></h1><p className="page-description">Chaque rencontre a une histoire. Gardez la vôtre.</p></div><button className="btn btn-secondary backup-top" onClick={() => void backup()} disabled={!observations.length}><ArrowDownToLine size={16} />Sauvegarder</button></div>
          <section className="hero">
            <div className="hero-content"><span className="hero-badge"><Binoculars size={15} />LA NATURE SE DÉCOUVRE AVEC RESPECT</span><h2>Collectionnez les souvenirs.<br />Préservez le sauvage.</h2><p>Vos photos, vos observations, un monde à comprendre.<br />Un carnet personnel pour les curieux de nature.</p><button className="hero-link" onClick={() => navigate('taxonomy')}>Explorer l’arbre du vivant <ChevronRight size={16} /></button></div>
            <div className="hero-aside" aria-hidden="true"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><TreePine className="hero-tree" size={115} strokeWidth={1} /><Leaf className="hero-leaf" size={48} strokeWidth={1.2} /><span className="hero-coordinate">PRENDRE LE TEMPS D’OBSERVER</span></div>
          </section>
          <section className="stats-grid" aria-label="Statistiques de votre carnet">
            {[{ value: observations.length, label: 'observations', icon: Binoculars }, { value: distinctSpecies, label: 'espèces rencontrées', icon: Leaf }, { value: distinctRegions, label: 'régions explorées', icon: MapPin }, { value: observations.filter(item => item.favorite).length, label: 'souvenirs favoris', icon: Heart }].map(stat => <div className="stat-card" key={stat.label}><span className="stat-icon"><stat.icon size={20} /></span><div><span className="stat-value">{stat.value.toString().padStart(2, '0')}</span><span className="stat-label">{stat.label}</span></div></div>)}
          </section>
          {isDemo && <div className="demo-banner"><Sparkles size={18} /><p><strong>Bienvenue dans votre futur carnet.</strong> Ces rencontres sont des exemples. Ajoutez votre première photo pour commencer le vôtre.</p><button className="btn btn-ghost" onClick={() => setDemo(false)} aria-label="Masquer les exemples"><X size={17} /></button></div>}
          <section aria-label="Vos observations">
            <div className="collection-heading"><h2>{isDemo ? 'Un aperçu de vos prochaines découvertes' : 'Vos rencontres'}<span>{filtered.length}</span></h2><button className={`btn btn-ghost favorite-filter ${filters.favorites ? 'active' : ''}`} aria-pressed={filters.favorites} onClick={() => setFilters({ ...filters, favorites: !filters.favorites })}><Heart size={16} />Favoris</button></div>
            <div className="toolbar"><div className="search-field"><Search size={18} /><input aria-label="Rechercher une observation" placeholder="Rechercher une espèce, un lieu, un souvenir…" value={filters.query} onChange={event => setFilters({ ...filters, query: event.target.value })} />{filters.query && <button aria-label="Effacer la recherche" className="icon-btn" onClick={() => setFilters({ ...filters, query: '' })}><X size={15} /></button>}</div></div>
            <div className="category-tabs" role="group" aria-label="Filtrer par groupe animal">{['', 'Mammifères', 'Oiseaux', 'Reptiles', 'Amphibiens', 'Insectes', 'Poissons', 'À classer'].map(category => <button className={`category-tab ${filters.category === category ? 'active' : ''}`} key={category} onClick={() => setFilters({ ...filters, category })}>{category || 'Toutes les espèces'}</button>)}</div>
            <div className="filter-row"><select className="filter-select" aria-label="Filtrer par région" value={filters.region} onChange={event => setFilters({ ...filters, region: event.target.value })}><option value="">Toutes les régions</option>{regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}</select><select className="filter-select" aria-label="Filtrer par statut de conservation" value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}><option value="">Tous les statuts</option>{Object.entries(statusLabels).map(([code, label]) => <option key={code} value={code}>{code} — {label}</option>)}</select><label className="date-filter">Du <input aria-label="Date de début" type="date" value={filters.from} onChange={event => setFilters({ ...filters, from: event.target.value })} /></label><label className="date-filter">au <input aria-label="Date de fin" type="date" value={filters.to} onChange={event => setFilters({ ...filters, to: event.target.value })} /></label>{Object.values(filters).some(Boolean) && <button className="btn btn-ghost" onClick={() => setFilters(initialFilters)}>Réinitialiser</button>}</div>
            {!loaded ? <div className="empty-state"><Database size={28} /><h3>Ouverture de votre carnet…</h3></div> : filtered.length ? <div className="gallery">{filtered.map(observation => <Card key={observation.id} observation={observation} isDemo={isDemo} onOpen={() => open(observation)} onFavorite={() => void favorite(observation)} />)}</div> : <div className="empty-state"><span className="empty-icon"><Binoculars size={33} /></span><h3>{observations.length || isDemo ? 'Aucune rencontre avec ces filtres' : 'Votre carnet commence par une rencontre'}</h3><p>{observations.length || isDemo ? 'Essayez une autre espèce, une région ou une période.' : 'Ajoutez votre photo préférée. Nous gardons vos souvenirs ici, sur votre appareil.'}</p><div className="settings-actions"><button className="btn btn-primary" onClick={() => setForm({})}><Plus size={17} />Ajouter une observation</button>{!observations.length && !demo && <button className="btn btn-secondary" onClick={() => setDemo(true)}>Voir les exemples</button>}</div></div>}
          </section>
        </>}
        {view === 'taxonomy' && <><div className="page-heading"><div><p className="eyebrow">COMPRENDRE LE VIVANT</p><h1>L’arbre de la faune<span className="heading-dot">.</span></h1><p className="page-description">Du règne à l’espèce, explorez les liens entre vos rencontres.</p></div><span className="catalog-count">{species.length} fiches éducatives</span></div><TaxonomyView observations={observations} onSelectObservation={observation => open(observation, false)} onSelectSpecies={speciesId => { const example = demoObservations.find(item => item.speciesId === speciesId) || { id: `catalog-${speciesId}`, speciesId, regionId: null, date: new Date().toISOString().slice(0, 10), notes: 'Fiche éducative du catalogue. Aucune observation personnelle n’est enregistrée.', photos: [], favorite: false, createdAt: new Date().toISOString() }; open(example, true) }} /><div className="notice"><BookOpen size={18} /><p>Votre animal n’est pas dans le catalogue ? L’ajout d’une observation permet de renseigner une identification et des informations éducatives manuellement.</p></div></>}
        {view === 'map' && <><div className="page-heading"><div><p className="eyebrow">DES SOUVENIRS AUX QUATRE COINS DU MONDE</p><h1>Carte des rencontres<span className="heading-dot">.</span></h1><p className="page-description">Des régions explorées, des habitats préservés.</p></div></div>{isDemo && <div className="demo-banner"><Sparkles size={18} /><p>Carte de démonstration : les exemples ne font pas partie de votre carnet.</p></div>}<MapView observations={displayed} onSelectObservation={observation => open(observation)} /></>}
        {view === 'timeline' && <><div className="page-heading"><div><p className="eyebrow">PRENDRE LE TEMPS DE SE SOUVENIR</p><h1>Au fil des rencontres<span className="heading-dot">.</span></h1><p className="page-description">Votre histoire naturelle, observation après observation.</p></div></div>{isDemo && <div className="demo-banner"><Sparkles size={18} /><p>Les rencontres ci-dessous sont des exemples de démonstration.</p></div>}<div className="search-field timeline-search"><Search size={18} /><input aria-label="Rechercher dans la chronologie" placeholder="Rechercher dans vos souvenirs…" value={filters.query} onChange={event => setFilters({ ...filters, query: event.target.value })} /></div><div className="timeline">{Object.entries(groups).map(([month, items]) => <section className="timeline-group" key={month}><h2>{new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`))}<span>{items.length} rencontre{items.length > 1 ? 's' : ''}</span></h2>{items.map(item => { const animal = observationSpecies(item); const region = regions.find(region => region.id === item.regionId); return <button className="timeline-item" key={item.id} onClick={() => open(item)}><span className="timeline-date">{new Date(`${item.date}T12:00:00Z`).getUTCDate()}<small>{new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(new Date(`${item.date}T12:00:00Z`))}</small></span><img src={item.photos[0] || animal?.cover || './animal-fallback.svg'} alt="" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = './animal-fallback.svg' }} /><span className="timeline-item-body"><strong>{animal?.name || 'Espèce à identifier'}</strong><em>{animal?.scientificName}</em><span><MapPin size={13} />{region?.name || 'Lieu privé'}</span>{item.notes && <p>{item.notes}</p>}</span><ChevronRight size={19} /></button> })}</section>)}</div>{!filtered.length && <div className="empty-state"><CalendarDays size={32} /><h3>Vos souvenirs trouveront leur place ici</h3><button className="btn btn-primary" onClick={() => setForm({})}><Plus size={17} />Ajouter une observation</button></div>}</>}
        {view === 'privacy' && <><div className="page-heading"><div><p className="eyebrow">VOTRE CARNET, VOTRE CONFIANCE</p><h1>Privé par nature<span className="heading-dot">.</span></h1><p className="page-description">Vous gardez le contrôle de vos photos et de vos souvenirs.</p></div></div><div className="settings-grid">
          <section className="settings-card"><span className="settings-icon"><LockKeyhole size={24} /></span><h2>Vos photos restent ici</h2><p>Les observations sont conservées dans ce navigateur, sur cet appareil. Aucun compte, aucune publication, aucun envoi de vos photos à un serveur.</p><div className="setting-state"><Check size={16} />Confidentialité activée par défaut</div><p className="field-help">Changer d’appareil ou effacer les données du navigateur ne conserve pas votre carnet. Exportez régulièrement une sauvegarde.</p></section>
          <section className="settings-card"><span className="settings-icon"><MapPin size={24} /></span><h2>Des régions, jamais des coordonnées</h2><p>Seule une région approximative peut être enregistrée. La géolocalisation est facultative et sert uniquement à suggérer une région ; les coordonnées précises ne sont pas conservées.</p><div className="setting-state"><ShieldCheck size={16} />Protection identique pour toutes les espèces</div><p className="field-help">Les copies de vos photos sont réencodées pour supprimer leurs métadonnées. Évitez de mentionner un lieu sensible dans vos notes.</p></section>
          <section className="settings-card"><span className="settings-icon"><Database size={24} /></span><h2>Votre carnet vous appartient</h2><p>Votre sauvegarde contient vos observations et vos photos. Elle permet de déplacer votre carnet vers un autre appareil. Les doublons sont ignorés lors de l’import.</p><div className="settings-actions"><button className="btn btn-primary" disabled={!observations.length || busy} onClick={() => void backup()}><ArrowDownToLine size={17} />Exporter</button><button className="btn btn-secondary" disabled={busy} onClick={() => importRef.current?.click()}><ArrowUpFromLine size={17} />{busy ? 'Import…' : 'Importer'}</button></div><p className="field-help">La sauvegarde contient des données personnelles : conservez-la en lieu sûr.</p></section>
          <section className="settings-card"><span className="settings-icon"><Leaf size={24} /></span><h2>Observer avec respect</h2><ul className="ethics-list"><li>Gardez vos distances et laissez une voie de passage.</li><li>Ne nourrissez pas les animaux, ne les attirez pas pour une photo.</li><li>Respectez les nids, les terriers et les périodes de reproduction.</li><li>Ne partagez jamais la position d’une espèce sensible.</li></ul><p className="field-help">Les fiches sont éducatives. Les statuts ne remplacent pas les évaluations officielles ni les consignes locales.</p></section>
        </div><div className="notice"><ExternalLink size={18} /><p>Les cartes utilisent OpenStreetMap et les liens éducatifs ouvrent des sites externes. Ces services appliquent leurs propres politiques de confidentialité. Votre carnet personnel n’y est pas transmis.</p></div><section className="danger-zone"><div><h3>Effacer le carnet de cet appareil</h3><p>Suppression de toutes les observations et photos, sans modifier vos sauvegardes téléchargées.</p></div>{resetConfirmation ? <div className="settings-actions"><button className="btn btn-secondary" onClick={() => setResetConfirmation(false)}>Annuler</button><button className="btn btn-danger" disabled={busy} onClick={async () => { setBusy(true); try { await clearObservations(); await refresh(); setDemo(false); setResetConfirmation(false); notify('Votre carnet a été effacé de cet appareil.') } catch { notify('La suppression a échoué.') } finally { setBusy(false) } }}>Confirmer la suppression de {observations.length} observation{observations.length > 1 ? 's' : ''}</button></div> : <button className="btn btn-danger" disabled={!observations.length} onClick={() => setResetConfirmation(true)}><Trash2 size={16} />Effacer le carnet</button>}</section></>}
        <footer className="content-footer"><Leaf size={14} /><span>Pokédex de la faune · Apprendre. Observer. Préserver.</span><span>Vos souvenirs sont privés.</span></footer>
      </main>
    </div>
    {form && <ObservationForm initial={form.initial} onClose={() => setForm(null)} onSave={submit} />}
    {selected && !form && <ObservationDetail observation={selected} readOnly={selectedReadOnly} onClose={() => setSelected(null)} onEdit={() => setForm({ initial: selected })} onDelete={async () => { await deleteObservation(selected.id); await refresh(); setSelected(null); notify('Observation supprimée.') }} onFavorite={() => void favorite(selected)} />}
    {toast && <div className="toast" role="status"><Check size={18} /><span>{toast}</span><button className="icon-btn" aria-label="Fermer le message" onClick={() => setToast('')}><X size={15} /></button></div>}
  </div>
}
