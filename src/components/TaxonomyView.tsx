import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Leaf, Search, TreePine } from 'lucide-react'
import { species } from '../data'
import { normalize, observationSpecies } from '../lib'
import type { Observation, Species, TaxonomicRank } from '../types'

interface TaxonomyViewProps {
  observations: Observation[]
  onSelectSpecies: (speciesId: string) => void
  onSelectObservation?: (observation: Observation) => void
}

interface TaxonomyNode {
  key: string
  name: string
  rank: TaxonomicRank | null
  speciesIds: Set<string>
  speciesId?: string
  children: Map<string, TaxonomyNode>
}

function buildTree(items: Species[]): TaxonomyNode[] {
  const roots = new Map<string, TaxonomyNode>()
  for (const item of items) {
    let siblings = roots
    let path = ''
    for (const [index, taxon] of item.taxonomy.entries()) {
      path += `/${taxon.rank}:${taxon.name}`
      let node = siblings.get(path)
      if (!node) {
        node = { key: path, name: taxon.name, rank: taxon.rank, speciesIds: new Set(), children: new Map() }
        siblings.set(path, node)
      }
      node.speciesIds.add(item.id)
      if (index === item.taxonomy.length - 1 && (taxon.rank === 'Espèce' || taxon.rank === 'Sous-espèce')) node.speciesId = item.id
      siblings = node.children
    }
    const lastRank = item.taxonomy.at(-1)?.rank
    if (item.taxonomy.length && lastRank !== 'Espèce' && lastRank !== 'Sous-espèce') {
      const key = `${path}/identification:${item.id}`
      siblings.set(key, { key, name: item.scientificName || item.name, rank: null, speciesIds: new Set([item.id]), speciesId: item.id, children: new Map() })
    }
  }
  return [...roots.values()]
}

export default function TaxonomyView({ observations, onSelectSpecies, onSelectObservation }: TaxonomyViewProps) {
  const [scope, setScope] = useState<'all' | 'observed'>('all')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const { library, observationCounts, personalById, unclassified } = useMemo(() => {
    const knownById = new Map(species.map(item => [item.id, item]))
    const counts = new Map<string, number>()
    const manual = new Map<string, { item: Species; observation: Observation; count: number }>()
    let unidentified: { observation: Observation; count: number } | undefined
    for (const observation of observations) {
      if (observation.speciesId && knownById.has(observation.speciesId)) {
        counts.set(observation.speciesId, (counts.get(observation.speciesId) ?? 0) + 1)
        continue
      }
      const item = observationSpecies(observation)
      if (!item) {
        if (unidentified) unidentified.count++
        else unidentified = { observation, count: 1 }
        continue
      }
      const key = JSON.stringify([normalize(item.scientificName.trim()), normalize(item.name.trim())])
      const group = manual.get(key)
      if (group) {
        group.count++
        if (!group.item.taxonomy.length && item.taxonomy.length) {
          group.item = item
          group.observation = observation
        }
      } else manual.set(key, { item, observation, count: 1 })
    }
    const items = [...species]
    const personal = new Map<string, Observation>()
    const pending: { key: string; name: string; scientificName: string; count: number; observation: Observation }[] = []
    for (const group of manual.values()) {
      counts.set(group.item.id, group.count)
      personal.set(group.item.id, group.observation)
      if (group.item.taxonomy.length) items.push(group.item)
      else pending.push({ key: group.item.id, name: group.item.name, scientificName: group.item.scientificName, count: group.count, observation: group.observation })
    }
    if (unidentified) pending.push({ key: '__unidentified', name: 'Espèce à identifier', scientificName: '', ...unidentified })
    return { library: items, observationCounts: counts, personalById: personal, unclassified: pending }
  }, [observations])
  const speciesById = useMemo(() => new Map(library.map(item => [item.id, item])), [library])

  const filteredSpecies = useMemo(() => {
    const normalizedQuery = normalize(query.trim())
    return library.filter(item => {
      if (scope === 'observed' && !observationCounts.has(item.id)) return false
      const searchable = normalize([item.name, item.scientificName, ...item.taxonomy.map(taxon => taxon.name)].join(' '))
      return !normalizedQuery || searchable.includes(normalizedQuery)
    })
  }, [query, scope, observationCounts, library])
  const tree = useMemo(() => buildTree(filteredSpecies), [filteredSpecies])
  const pendingIdentifications = useMemo(() => unclassified.filter(item => !query.trim() || normalize(`${item.name} ${item.scientificName}`).includes(normalize(query.trim()))), [unclassified, query])

  function selectItem(item: Species) {
    const observation = personalById.get(item.id)
    if (observation) onSelectObservation?.(observation)
    else onSelectSpecies(item.id)
  }

  function renderNodes(nodes: TaxonomyNode[], depth = 0) {
    return [...nodes].sort((left, right) => left.name.localeCompare(right.name, 'fr')).map(node => {
      const children = [...node.children.values()]
      const hasChildren = children.length > 0
      const isOpen = expanded[node.key] ?? (Boolean(query.trim()) || depth < 2)
      const count = [...node.speciesIds].reduce((total, id) => total + (observationCounts.get(id) ?? 0), 0)
      const item = node.speciesId ? speciesById.get(node.speciesId) : undefined
      return (
        <li className="taxonomy-node" key={node.key}>
          <div className={`taxonomy-row ${item ? 'taxonomy-species-row' : ''}`}>
            {hasChildren ? (
              <button
                type="button"
                className="taxonomy-expand icon-button"
                aria-expanded={isOpen}
                aria-label={`${isOpen ? 'Replier' : 'Déplier'} ${node.name}`}
                onClick={() => setExpanded(current => ({ ...current, [node.key]: !isOpen }))}
              >
                {isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
              </button>
            ) : <span className="taxonomy-leaf-icon" aria-hidden="true"><Leaf size={16} /></span>}
            <span className="taxonomy-rank">{node.rank}</span>
            {item ? (
              <button type="button" className="taxonomy-label taxonomy-species-link" onClick={() => selectItem(item)} disabled={personalById.has(item.id) && !onSelectObservation}>
                <strong>{item.name}</strong>{item.scientificName && <span className="scientific-name">{node.name}</span>}
              </button>
            ) : (
              <button type="button" className="taxonomy-label" aria-expanded={isOpen} onClick={() => setExpanded(current => ({ ...current, [node.key]: !isOpen }))}>
                <strong>{node.name}</strong>
              </button>
            )}
            <span className={`taxonomy-count ${count ? 'has-observations' : ''}`} title={`${count} observation${count > 1 ? 's' : ''}`}>
              {count}<span> observation{count > 1 ? 's' : ''}</span>
            </span>
            {item && <ChevronRight size={16} className="taxonomy-species-arrow" aria-hidden="true" />}
          </div>
          {hasChildren && isOpen && <ul className="taxonomy-children">{renderNodes(children, depth + 1)}</ul>}
        </li>
      )
    })
  }

  return (
    <section className="taxonomy-view">
      <div className="taxonomy-toolbar">
        <label className="search-input taxonomy-search">
          <Search size={18} aria-hidden="true" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Une espèce, une famille, un genre…" aria-label="Rechercher dans la taxonomie" />
        </label>
        <div className="segmented-control taxonomy-scope" aria-label="Espèces affichées">
          <button type="button" className={scope === 'all' ? 'active' : ''} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>Toute la bibliothèque</button>
          <button type="button" className={scope === 'observed' ? 'active' : ''} aria-pressed={scope === 'observed'} onClick={() => setScope('observed')}>Mes rencontres</button>
        </div>
      </div>
      <div className="taxonomy-summary">
        <TreePine size={19} aria-hidden="true" />
        <span><strong>{filteredSpecies.length} espèce{filteredSpecies.length > 1 ? 's' : ''} classée{filteredSpecies.length > 1 ? 's' : ''}</strong> dans cet arbre. Dépliez les branches pour explorer les liens du vivant.</span>
      </div>
      {tree.length ? (
        <ul className="taxonomy-tree" aria-label="Arborescence taxonomique">{renderNodes(tree)}</ul>
      ) : !pendingIdentifications.length ? (
        <div className="empty-state taxonomy-empty">
          <TreePine size={36} aria-hidden="true" />
          <h3>{query ? 'Aucune branche trouvée' : 'Votre arbre attend ses premières rencontres'}</h3>
          <p>{query ? 'Essayez un autre nom commun, scientifique ou de famille.' : 'Identifiez une observation pour la retrouver ici, ou explorez toute la bibliothèque.'}</p>
          {(query || scope === 'observed') && <button type="button" className="button button-secondary" onClick={() => { setQuery(''); setScope('all') }}>Explorer la bibliothèque</button>}
        </div>
      ) : null}
      {pendingIdentifications.length > 0 && <section className="taxonomy-unclassified" aria-labelledby="taxonomy-unclassified-title">
        <h3 id="taxonomy-unclassified-title" className="taxonomy-unclassified-heading">Identifications à classer</h3>
        <p className="taxonomy-footnote">Ces rencontres n’ont pas encore de hiérarchie taxonomique. Ouvrez une observation pour compléter son identification.</p>
        <ul className="taxonomy-tree">
          {pendingIdentifications.map(item => <li className="taxonomy-node" key={item.key}><div className="taxonomy-row taxonomy-species-row">
            <span className="taxonomy-leaf-icon" aria-hidden="true"><Leaf size={16} /></span>
            <button type="button" className="taxonomy-label taxonomy-species-link" disabled={!onSelectObservation} onClick={() => onSelectObservation?.(item.observation)}><strong>{item.name}</strong>{item.scientificName && <span className="scientific-name">{item.scientificName}</span>}</button>
            <span className="taxonomy-count has-observations">{item.count}<span> observation{item.count > 1 ? 's' : ''}</span></span><ChevronRight size={16} aria-hidden="true" />
          </div></li>)}
        </ul>
      </section>}
      <p className="taxonomy-footnote">La taxonomie présente les rangs renseignés dans les fiches. Une sous-espèce apparaît uniquement lorsqu’elle est documentée.</p>
    </section>
  )
}
