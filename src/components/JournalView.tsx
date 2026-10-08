import { useDeferredValue, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpRight,
  Binoculars,
  CalendarDays,
  Check,
  ChevronRight,
  Grid2X2,
  Heart,
  Leaf,
  List,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Sprout,
  Sun,
  X,
} from 'lucide-react'
import { demoObservations, regions, statusLabels } from '../data'
import { filterObservations, formatDate, observationSpecies } from '../lib'
import type { Filters } from '../lib'
import { collectionStats } from '../collection'
import type { Profile } from '../preferences'
import type { Observation } from '../types'

const initialFilters: Filters = {
  query: '',
  category: '',
  region: '',
  status: '',
  from: '',
  to: '',
  favorites: false,
}
const fallback = `${import.meta.env.BASE_URL}animal-fallback.svg`
export function ObservationCard({
  observation,
  isDemo,
  onOpen,
  onFavorite,
}: {
  observation: Observation
  isDemo: boolean
  onOpen: () => void
  onFavorite: () => void
}) {
  const animal = observationSpecies(observation)
  const region = regions.find((item) => item.id === observation.regionId)
  return (
    <article className="observation-card">
      <button
        className="card-image"
        onClick={onOpen}
        aria-label={`Ouvrir ${animal?.name || 'Espèce à identifier'}`}
      >
        <img
          src={observation.photos[0] || animal?.cover || fallback}
          alt={
            observation.photos.length
              ? `Photo personnelle : ${animal?.name || 'animal'}`
              : `Illustration du guide : ${animal?.name || 'animal'}`
          }
          loading="lazy"
          decoding="async"
          onError={(event) => {
            if (!event.currentTarget.src.endsWith('animal-fallback.svg')) event.currentTarget.src = fallback
          }}
        />
        <span className="photo-chip">
          <span />
          {animal?.category || 'À identifier'}
        </span>
        {isDemo && <span className="sample-label">EXEMPLE DU GUIDE</span>}
      </button>
      {!isDemo && (
        <button
          className={`card-heart ${observation.favorite ? 'selected' : ''}`}
          aria-label={observation.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          aria-pressed={observation.favorite}
          onClick={onFavorite}
        >
          <Heart size={18} fill={observation.favorite ? 'currentColor' : 'none'} />
        </button>
      )}
      <button className="card-content" onClick={onOpen}>
        <span className="card-title">
          {animal?.name || 'Une rencontre à identifier'}
          <ArrowUpRight size={17} />
        </span>
        <span className="card-scientific">{animal?.scientificName || 'À compléter à votre rythme'}</span>
        <span className="card-footer">
          <span>
            <MapPin size={13} />
            {isDemo ? 'À découvrir dans le guide' : region?.name || 'Lieu privé'}
          </span>
          {!isDemo && <span>{formatDate(observation.date)}</span>}
        </span>
      </button>
    </article>
  )
}

export default function JournalView({
  observations,
  profile,
  loaded,
  onOpen,
  onFavorite,
  onAdd,
  onExplore,
  onProgress,
  onBackup,
  onDismissDemo,
}: {
  observations: Observation[]
  profile: Profile
  loaded: boolean
  onOpen: (item: Observation, readOnly?: boolean) => void
  onFavorite: (item: Observation) => void
  onAdd: () => void
  onExplore: () => void
  onProgress: () => void
  onBackup: () => void
  onDismissDemo: () => void
}) {
  const [filters, setFilters] = useState(initialFilters)
  const [advanced, setAdvanced] = useState(false)
  const [layout, setLayout] = useState<'grid' | 'list' | 'timeline'>('grid')
  const [sort, setSort] = useState('recent')
  const [limit, setLimit] = useState(24)
  const query = useDeferredValue(filters.query)
  const isDemo = !observations.length && !profile.demoDismissed
  const displayed = isDemo ? demoObservations : observations
  const stats = useMemo(() => collectionStats(observations), [observations])
  const filtered = useMemo(() => {
    const result = filterObservations(displayed, { ...filters, query })
    if (sort === 'oldest') result.reverse()
    if (sort === 'name')
      result.sort((a, b) =>
        (observationSpecies(a)?.name || '').localeCompare(observationSpecies(b)?.name || '', 'fr'),
      )
    return result
  }, [displayed, filters, query, sort])
  const activeFilters = Object.values(filters).filter(Boolean).length
  const update = (patch: Partial<Filters>) => {
    setFilters((previous) => ({ ...previous, ...patch }))
    setLimit(24)
  }
  const visible = filtered.slice(0, limit)
  const groups = visible.reduce<Record<string, Observation[]>>((acc, item) => {
    ;(acc[item.date.slice(0, 7)] ||= []).push(item)
    return acc
  }, {})

  return (
    <>
      <div className="page-heading journal-heading">
        <div>
          <p className="eyebrow">
            <span className="small-dot" /> VOTRE PETIT COIN DE NATURE
          </p>
          <h1>
            Bonjour, {profile.name}
            <span>.</span>
          </h1>
          <p className="page-description">Le monde sauvage a encore beaucoup à vous raconter.</p>
        </div>
        <button className="btn btn-secondary backup-top" onClick={onBackup} disabled={!observations.length}>
          <ArrowDownToLine size={16} />
          Sauvegarder
        </button>
      </div>
      <div className="home-feature-row">
        <section className="nature-hero">
          <img
            className="hero-image"
            src={`${import.meta.env.BASE_URL}photos/fox.jpg`}
            alt="Renard roux dans son environnement naturel, photo du guide"
            fetchPriority="high"
          />
          <div className="hero-shade" />
          <div className="hero-copy">
            <span className="hero-badge">
              <Leaf size={14} /> LE VIVANT EST PARTOUT
            </span>
            <h2>
              La prochaine rencontre
              <br />
              est peut-être
              <br />
              <em>juste à côté.</em>
            </h2>
            <p>
              Un regard. Une photo. Un souvenir.
              <br />
              Faites grandir votre carnet du vivant.
            </p>
            <button className="btn btn-light" onClick={onAdd}>
              <Plus size={18} />
              Garder une rencontre <ArrowUpRight size={17} />
            </button>
          </div>
          <span className="hero-caption">
            VULPES VULPES <span>·</span> RENARD ROUX
          </span>
        </section>
        <aside className="weekly-card">
          <span className="section-kicker">
            <Sun size={18} /> CETTE SEMAINE
          </span>
          <div className="weekly-art" aria-hidden="true">
            <Sprout size={64} strokeWidth={1.1} />
            <span />
          </div>
          <h2>
            Un peu de nature,
            <br />à votre rythme.
          </h2>
          <p>
            {stats.week >= profile.goal
              ? 'Objectif atteint ! Savourez vos découvertes.'
              : `Et si vous gardiez ${profile.goal} rencontre${profile.goal > 1 ? 's' : ''} cette semaine ?`}
          </p>
          <div className="weekly-progress-label">
            <strong>
              {stats.week}
              <span> / {profile.goal}</span>
            </strong>
            <span>rencontres</span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Objectif de la semaine"
            aria-valuenow={Math.min(stats.week, profile.goal)}
            aria-valuemin={0}
            aria-valuemax={profile.goal}
          >
            <span style={{ width: `${Math.min(100, (stats.week / profile.goal) * 100)}%` }} />
          </div>
          <button className="text-button" onClick={onProgress}>
            Voir ma progression <ArrowUpRight size={16} />
          </button>
        </aside>
      </div>
      <section className="stats-strip" aria-label="Statistiques de votre carnet">
        {[
          { value: stats.total, label: 'rencontres', icon: Binoculars },
          { value: stats.species, label: 'espèces découvertes', icon: Leaf },
          { value: stats.regions, label: 'régions explorées', icon: MapPin },
          { value: stats.favorites, label: 'coups de cœur', icon: Heart },
        ].map((stat) => (
          <div className="stat-card" key={stat.label}>
            <span className="stat-icon">
              <stat.icon size={21} strokeWidth={1.6} />
            </span>
            <div>
              <strong className="stat-value">{stat.value.toString().padStart(2, '0')}</strong>
              <span className="stat-label">{stat.label}</span>
            </div>
          </div>
        ))}
      </section>
      <section aria-label="Vos observations">
        <div className="section-heading">
          <div>
            <p className="eyebrow">DES INSTANTS QUI RESTENT</p>
            <h2>
              {isDemo ? 'Le goût des premières découvertes' : 'Vos rencontres'}
              <span className="count-pill">{filtered.length}</span>
            </h2>
          </div>
          <div className="view-toggle" role="group" aria-label="Affichage des observations">
            {[
              { id: 'grid', label: 'Vue grille', icon: Grid2X2 },
              { id: 'list', label: 'Vue liste', icon: List },
              { id: 'timeline', label: 'Chronologie', icon: CalendarDays },
            ].map((item) => (
              <button
                key={item.id}
                className={layout === item.id ? 'active' : ''}
                aria-label={item.label}
                aria-pressed={layout === item.id}
                onClick={() => setLayout(item.id as typeof layout)}
              >
                <item.icon size={18} />
              </button>
            ))}
          </div>
        </div>
        {isDemo && (
          <div className="demo-banner">
            <Sprout size={19} />
            <p>
              <strong>Un peu d’inspiration pour commencer.</strong> Ces exemples du guide ne comptent pas dans
              votre collection.
            </p>
            <button className="icon-button" aria-label="Masquer les exemples" onClick={onDismissDemo}>
              <X size={17} />
            </button>
          </div>
        )}
        <div className="journal-toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Rechercher une observation"
              placeholder="Une espèce, un lieu, un souvenir…"
              value={filters.query}
              onChange={(event) => update({ query: event.target.value })}
            />
            {filters.query && (
              <button
                type="button"
                className="icon-button"
                aria-label="Effacer la recherche"
                onClick={() => update({ query: '' })}
              >
                <X size={15} />
              </button>
            )}
          </label>
          <button
            className={`btn btn-secondary ${advanced ? 'selected' : ''}`}
            aria-expanded={advanced}
            onClick={() => setAdvanced(!advanced)}
          >
            <SlidersHorizontal size={16} />
            Filtres{activeFilters > 0 && <span className="tiny-count">{activeFilters}</span>}
          </button>
          <button
            className={`btn favorite-filter ${filters.favorites ? 'active' : 'btn-secondary'}`}
            aria-pressed={filters.favorites}
            onClick={() => update({ favorites: !filters.favorites })}
          >
            <Heart size={16} />
            Favoris
          </button>
        </div>
        <div className="category-tabs" role="group" aria-label="Filtrer par groupe animal">
          {['', 'Mammifères', 'Oiseaux', 'Reptiles', 'Amphibiens', 'Insectes', 'Poissons', 'À classer'].map(
            (category) => (
              <button
                className={`category-tab ${filters.category === category ? 'active' : ''}`}
                aria-pressed={filters.category === category}
                key={category}
                onClick={() => update({ category })}
              >
                {category || 'Tout le vivant'}
              </button>
            ),
          )}
        </div>
        {advanced && (
          <div className="filter-panel">
            <div className="filter-row">
              <label>
                Région
                <select
                  className="input-field"
                  aria-label="Filtrer par région"
                  value={filters.region}
                  onChange={(event) => update({ region: event.target.value })}
                >
                  <option value="">Toutes les régions</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Conservation
                <select
                  className="input-field"
                  aria-label="Filtrer par statut de conservation"
                  value={filters.status}
                  onChange={(event) => update({ status: event.target.value })}
                >
                  <option value="">Tous les statuts</option>
                  {Object.entries(statusLabels).map(([code, label]) => (
                    <option key={code} value={code}>
                      {code} — {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Du
                <input
                  className="input-field"
                  aria-label="Date de début"
                  type="date"
                  value={filters.from}
                  onChange={(event) => update({ from: event.target.value })}
                />
              </label>
              <label>
                Au
                <input
                  className="input-field"
                  aria-label="Date de fin"
                  type="date"
                  min={filters.from || undefined}
                  value={filters.to}
                  onChange={(event) => update({ to: event.target.value })}
                />
              </label>
            </div>
            {filters.to && filters.from > filters.to && (
              <p className="form-error" role="alert">
                La date de fin doit suivre la date de début.
              </p>
            )}
          </div>
        )}
        <div className="results-row">
          <span aria-live="polite">
            {filtered.length} {isDemo ? 'exemples' : `rencontre${filtered.length > 1 ? 's' : ''}`}
            {activeFilters > 0 && (
              <button
                className="inline-link"
                onClick={() => {
                  setFilters(initialFilters)
                  setLimit(24)
                }}
              >
                Tout réinitialiser
              </button>
            )}
          </span>
          <label>
            Trier par
            <select
              aria-label="Trier les observations"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value)
                setLimit(24)
              }}
            >
              <option value="recent">Plus récentes</option>
              <option value="oldest">Plus anciennes</option>
              <option value="name">Nom de l’espèce</option>
            </select>
          </label>
        </div>
        {!loaded ? (
          <div className="loading-state">Ouverture de votre carnet…</div>
        ) : filtered.length ? (
          layout === 'timeline' ? (
            <div className="timeline">
              {Object.entries(groups).map(([month, items]) => (
                <section className="timeline-group" key={month}>
                  <h3>
                    {new Date(`${month}-15T12:00:00`).toLocaleDateString('fr-FR', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h3>
                  {items.map((item) => {
                    const animal = observationSpecies(item)
                    return (
                      <button className="timeline-item" key={item.id} onClick={() => onOpen(item, isDemo)}>
                        <span className="timeline-date">{item.date.slice(-2)}</span>
                        <img src={item.photos[0] || animal?.cover || fallback} alt="" loading="lazy" />
                        <span className="timeline-item-body">
                          <strong>{animal?.name || 'Espèce à identifier'}</strong>
                          <em>{animal?.scientificName}</em>
                          <p>{isDemo ? 'Exemple du guide' : item.notes || 'Un instant dans votre carnet.'}</p>
                        </span>
                        <ChevronRight size={18} />
                      </button>
                    )
                  })}
                </section>
              ))}
            </div>
          ) : (
            <div className={`gallery ${layout === 'list' ? 'list-view' : ''}`}>
              {visible.map((item) => (
                <ObservationCard
                  key={item.id}
                  observation={item}
                  isDemo={isDemo}
                  onOpen={() => onOpen(item, isDemo)}
                  onFavorite={() => onFavorite(item)}
                />
              ))}
            </div>
          )
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <Binoculars size={36} />
            </span>
            <h3>
              {activeFilters ? 'Aucune rencontre avec ces filtres.' : 'Votre histoire commence dehors.'}
            </h3>
            <p>
              {activeFilters
                ? 'Essayez un autre nom ou élargissez votre recherche.'
                : 'Un oiseau au jardin, une libellule en balade… Votre première rencontre mérite une place ici.'}
            </p>
            <button
              className="btn btn-primary"
              onClick={activeFilters ? () => setFilters(initialFilters) : onAdd}
            >
              {activeFilters ? (
                'Effacer les filtres'
              ) : (
                <>
                  <Plus size={17} />
                  Ajouter une observation
                </>
              )}
            </button>
          </div>
        )}
        {filtered.length > limit && (
          <div className="load-more">
            <button className="btn btn-secondary" onClick={() => setLimit((value) => value + 24)}>
              Voir 24 rencontres de plus <ChevronRight size={17} />
            </button>
            <span>
              {visible.length} / {filtered.length}
            </span>
          </div>
        )}
      </section>
      <button className="explore-banner" onClick={onExplore}>
        <span className="explore-banner-icon">
          <Leaf size={27} />
        </span>
        <span>
          <strong>Une collection de curiosités vous attend.</strong>
          <small>Explorez les espèces du guide et préparez vos prochaines rencontres.</small>
        </span>
        <span className="explore-banner-action">
          Ouvrir le guide <ArrowUpRight size={19} />
        </span>
      </button>
      <p className="subtle-note">
        <Check size={13} /> Les exemples n’augmentent jamais vos statistiques. Vos observations restent sur
        cet appareil.
      </p>
    </>
  )
}
