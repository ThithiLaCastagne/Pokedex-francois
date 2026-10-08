import { lazy, Suspense, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Binoculars,
  BookOpen,
  Bookmark,
  Check,
  MapPin,
  Plus,
  Search,
  TreePine,
} from 'lucide-react'
import { species } from '../data'
import { normalize, observationSpecies } from '../lib'
import { collectionStats, speciesKey } from '../collection'
import type { Observation } from '../types'
import type { Profile } from '../preferences'

const MapView = lazy(() => import('./MapView'))
const TaxonomyView = lazy(() => import('./TaxonomyView'))

export default function ExplorerView({
  observations,
  profile,
  onProfile,
  onSpecies,
  onOpen,
  onAdd,
}: {
  observations: Observation[]
  profile: Profile
  onProfile: (value: Profile) => void
  onSpecies: (id: string) => void
  onOpen: (item: Observation) => void
  onAdd: (id?: string) => void
}) {
  const [tab, setTab] = useState<'album' | 'taxonomy' | 'map'>('album')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [scope, setScope] = useState('all')
  const stats = useMemo(() => collectionStats(observations), [observations])
  const filtered = species.filter(
    (item) =>
      (!query || normalize(`${item.name} ${item.scientificName}`).includes(normalize(query.trim()))) &&
      (!category || item.category === category) &&
      (scope === 'all' ||
        (scope === 'observed' && stats.keys.has(item.id)) ||
        (scope === 'missing' && !stats.keys.has(item.id)) ||
        (scope === 'wishlist' && profile.wishlist.includes(item.id))),
  )
  const custom = observations
    .filter((item) => item.customSpecies && !species.some((animal) => animal.id === speciesKey(item)))
    .filter((item, index, all) => all.findIndex((other) => speciesKey(other) === speciesKey(item)) === index)
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">LE MONDE EST VOTRE TERRAIN DE DÉCOUVERTE</p>
          <h1>
            Un peu plus près du vivant<span>.</span>
          </h1>
          <p className="page-description">
            Votre album d’espèces, un guide pour comprendre et des horizons à explorer.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => onAdd()}>
          <Plus size={17} />
          Espèce hors du guide
        </button>
      </div>
      <div className="page-tabs" role="group" aria-label="Explorer la faune">
        {[
          { id: 'album', label: 'Album & guide', icon: BookOpen },
          { id: 'taxonomy', label: 'Arbre du vivant', icon: TreePine },
          { id: 'map', label: 'Carte des rencontres', icon: MapPin },
        ].map((item) => (
          <button
            className={tab === item.id ? 'active' : ''}
            key={item.id}
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id as typeof tab)}
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'album' ? (
        <>
          <section className="album-banner">
            <div>
              <span className="section-kicker">
                <Binoculars size={18} /> VOTRE ALBUM DU VIVANT
              </span>
              <h2>
                {stats.catalog
                  ? 'Chaque espèce, une nouvelle histoire.'
                  : 'Tout commence par un premier regard.'}
              </h2>
              <p>
                {species.length} fiches pour éveiller votre curiosité. Toutes vos autres espèces peuvent aussi
                rejoindre votre carnet.
              </p>
            </div>
            <div
              className="album-ring"
              style={{ '--progress': `${(stats.catalog / species.length) * 360}deg` } as React.CSSProperties}
            >
              <span>
                <strong>
                  {stats.catalog}
                  <small> / {species.length}</small>
                </strong>
                <span>espèces du guide</span>
              </span>
            </div>
          </section>
          <div className="album-toolbar">
            <label className="search-field">
              <Search size={18} />
              <input
                aria-label="Rechercher dans le guide"
                placeholder="Renard, rougegorge, Vulpes…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select
              className="input-field"
              aria-label="Filtrer l’album"
              value={scope}
              onChange={(event) => setScope(event.target.value)}
            >
              <option value="all">Toutes les espèces</option>
              <option value="observed">Déjà rencontrées</option>
              <option value="missing">À découvrir</option>
              <option value="wishlist">Mes envies</option>
            </select>
          </div>
          <div className="category-tabs" role="group" aria-label="Groupes du guide">
            {['', ...new Set(species.map((item) => item.category))].map((group) => (
              <button
                key={group}
                className={`category-tab ${category === group ? 'active' : ''}`}
                aria-pressed={category === group}
                onClick={() => setCategory(group)}
              >
                {group || 'Tout le vivant'}
              </button>
            ))}
          </div>
          <div className="results-row">
            <span aria-live="polite">{filtered.length} espèces dans le guide</span>
            <span>
              <Bookmark size={14} /> {profile.wishlist.length} envies de découverte
            </span>
          </div>
          <div className="album-grid">
            {filtered.map((animal, index) => {
              const observed = stats.keys.has(animal.id)
              const wanted = profile.wishlist.includes(animal.id)
              const count = observations.filter((item) => speciesKey(item) === animal.id).length
              return (
                <article className={`album-card ${observed ? 'observed' : ''}`} key={animal.id}>
                  <div className="album-photo">
                    <button onClick={() => onSpecies(animal.id)} aria-label={`Découvrir ${animal.name}`}>
                      <img src={animal.cover} alt={`Illustration du guide : ${animal.name}`} loading="lazy" />
                    </button>
                    <span className="album-number">
                      N° {String(species.findIndex((item) => item.id === animal.id) + 1).padStart(3, '0')}
                    </span>
                    <button
                      className={`card-heart wishlist-button ${wanted ? 'selected' : ''}`}
                      aria-pressed={wanted}
                      aria-label={`${wanted ? 'Retirer' : 'Ajouter'} ${animal.name} ${wanted ? 'des' : 'aux'} envies`}
                      onClick={() =>
                        onProfile({
                          ...profile,
                          wishlist: wanted
                            ? profile.wishlist.filter((id) => id !== animal.id)
                            : [...profile.wishlist, animal.id],
                        })
                      }
                    >
                      <Bookmark size={18} fill={wanted ? 'currentColor' : 'none'} />
                    </button>
                    {observed && (
                      <span className="observed-ribbon">
                        <Check size={13} />
                        Rencontré{count > 1 ? ` · ${count} fois` : ''}
                      </span>
                    )}
                  </div>
                  <div className="album-card-body">
                    <span className="album-category">{animal.category}</span>
                    <button className="album-title" onClick={() => onSpecies(animal.id)}>
                      <h3>{animal.name}</h3>
                      <ArrowUpRight size={17} />
                    </button>
                    <p>{animal.scientificName}</p>
                    <div className="album-card-footer">
                      <span>{observed ? 'Dans votre collection' : 'Une rencontre à venir'}</span>
                      <button
                        className="icon-button"
                        aria-label={`Ajouter une observation de ${animal.name}`}
                        onClick={() => onAdd(animal.id)}
                      >
                        <Plus size={19} />
                      </button>
                    </div>
                  </div>
                  <span className="sr-only">
                    Fiche {index + 1} sur {filtered.length}
                  </span>
                </article>
              )
            })}
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <Search size={32} />
              <h3>
                {scope === 'wishlist'
                  ? 'Gardez vos envies de découverte.'
                  : 'Aucune espèce avec ces filtres.'}
              </h3>
              <p>
                {scope === 'wishlist'
                  ? 'Touchez le marque-page d’une fiche pour la retrouver ici.'
                  : 'Le guide est une sélection. Vous pouvez ajouter n’importe quelle autre espèce à votre carnet.'}
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setQuery('')
                  setCategory('')
                  setScope('all')
                }}
              >
                Voir tout le guide
              </button>
            </div>
          )}
          {!!custom.length && (
            <section className="manual-album">
              <div className="section-heading">
                <h2>Vos découvertes hors du guide</h2>
                <span className="count-pill">{custom.length}</span>
              </div>
              <div className="suggestion-grid">
                {custom.map((item) => (
                  <button className="suggestion-card" key={item.id} onClick={() => onOpen(item)}>
                    <img
                      src={item.photos[0] || `${import.meta.env.BASE_URL}animal-fallback.svg`}
                      alt=""
                      loading="lazy"
                    />
                    <span>
                      <strong>{observationSpecies(item)?.name}</strong>
                      <small>Identification personnelle</small>
                    </span>
                    <ArrowUpRight size={18} />
                  </button>
                ))}
              </div>
            </section>
          )}
          <div className="notice">
            <BookOpen size={18} />
            <p>
              Le guide est une sélection éducative, pas un inventaire exhaustif ni un outil d’identification
              automatique. Les statuts de conservation sont contextualisés dans chaque fiche.
            </p>
          </div>
        </>
      ) : (
        <Suspense fallback={<div className="loading-state">Ouverture de votre exploration…</div>}>
          {tab === 'taxonomy' ? (
            <TaxonomyView
              observations={observations}
              onSelectObservation={onOpen}
              onSelectSpecies={onSpecies}
            />
          ) : (
            <MapView observations={observations} onSelectObservation={onOpen} />
          )}
        </Suspense>
      )}
    </>
  )
}
