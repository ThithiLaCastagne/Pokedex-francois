import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Heart, MapPin, Pencil, ShieldCheck, Trash2, X, LoaderCircle } from 'lucide-react'
import { regions, species, statusLabels } from '../data'
import type { Observation } from '../types'

interface Props {
  observation: Observation
  onClose: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
  onFavorite: () => void
  readOnly?: boolean
}

function displayDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

export default function ObservationDetail({ observation, onClose, onEdit, onDelete, onFavorite, readOnly = false }: Props) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const deletePrompt = useRef<HTMLDivElement>(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const deletingRef = useRef(false)
  const animal = species.find((item) => item.id === observation.speciesId)
  const customAnimal = observation.customSpecies
  const animalName = animal?.name ?? customAnimal?.name ?? 'Espèce à identifier'
  const scientificName = animal?.scientificName ?? customAnimal?.scientificName
  const customSearch = encodeURIComponent(customAnimal?.scientificName || customAnimal?.name || '')
  const customSources = [
    { label: 'Wikipédia', url: `https://fr.wikipedia.org/w/index.php?search=${customSearch}` },
    { label: 'GBIF', url: `https://www.gbif.org/species/search?q=${customSearch}` },
    { label: 'iNaturalist', url: `https://www.inaturalist.org/taxa/search?q=${customSearch}` },
  ]
  const region = regions.find((item) => item.id === observation.regionId)
  const photos = observation.photos.length ? observation.photos : animal?.cover ? [animal.cover] : []
  const safePhotoIndex = Math.min(photoIndex, Math.max(photos.length - 1, 0))

  useEffect(() => {
    if (!confirmDelete) return
    deletePrompt.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    deletePrompt.current?.focus()
  }, [confirmDelete])

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deletingRef.current) {
        event.preventDefault()
        onClose()
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]') ?? [])
        .filter((target) => target.getClientRects().length > 0 && getComputedStyle(target).visibility !== 'hidden')
      if (!focusable?.length) { event.preventDefault(); return }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', keydown)
      previouslyFocused?.focus()
    }
  }, [onClose])

  async function deleteObservation() {
    if (deletingRef.current) return
    setError('')
    setDeleting(true)
    deletingRef.current = true
    try {
      await onDelete()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'La suppression a échoué. Réessayez.')
    } finally {
      setDeleting(false)
      deletingRef.current = false
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) onClose() }}>
    <div className="modal-panel detail-panel" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <div className="modal-header"><div><span className="eyebrow">{readOnly ? 'DÉCOUVRIR LE VIVANT' : 'UNE RENCONTRE À GARDER'}</span><h2 id={`${id}-title`}>{animalName}</h2>{scientificName && <p className="scientific-name">{scientificName}</p>}</div><button type="button" className="icon-button" aria-label="Fermer l’observation" onClick={onClose} disabled={deleting}><X size={22} /></button></div>
      <div className="detail-photo">
        {photos.length ? <img src={photos[safePhotoIndex]} alt={`${animalName} — ${observation.photos.length ? 'photo personnelle' : 'illustration du catalogue'}`} /> : <div className="photo-placeholder"><CameraPlaceholder /><span>Observation sans photo</span></div>}
        {photos.length > 1 && <div className="photo-controls"><button className="icon-button" aria-label="Photo précédente" type="button" onClick={() => setPhotoIndex((safePhotoIndex + photos.length - 1) % photos.length)}><ChevronLeft size={20} /></button><span aria-live="polite">{safePhotoIndex + 1} / {photos.length}</span><button className="icon-button" aria-label="Photo suivante" type="button" onClick={() => setPhotoIndex((safePhotoIndex + 1) % photos.length)}><ChevronRight size={20} /></button></div>}
        {!readOnly && <button className={`detail-favorite ${observation.favorite ? 'is-favorite' : ''}`} type="button" aria-label={observation.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={observation.favorite} onClick={onFavorite} disabled={deleting}><Heart size={20} fill={observation.favorite ? 'currentColor' : 'none'} /></button>}
      </div>
      {!observation.photos.length && animal && <p className="image-credit">Illustration du catalogue · {animal.imageCredit}</p>}
      <div className="modal-body">
        {readOnly ? <p className="field-help">Fiche du catalogue éducatif — cette illustration n’est pas une observation personnelle.</p> : <div className="detail-facts"><span><CalendarDays size={16} />{displayDate(observation.date)}</span><span><MapPin size={16} />{region?.name ?? 'Région non renseignée'}</span><span><ShieldCheck size={16} />Observation privée</span></div>}
        {observation.notes && <section className="detail-section"><h3>Le souvenir de cette rencontre</h3><p className="personal-notes">{observation.notes}</p></section>}
        {animal ? <>
          <section className="detail-section"><div className="section-label"><h3>Connaître l’espèce</h3><span className={`status-badge status-${animal.status.toLowerCase()}`}>{statusLabels[animal.status]}</span></div><p>{animal.description}</p>
            <div className="species-info-grid"><div><h4>Habitat</h4><p>{animal.habitat}</p></div><div><h4>Alimentation</h4><p>{animal.diet}</p></div><div><h4>Répartition</h4><p>{animal.range}</p></div><div><h4>Conservation</h4><p>{animal.statusNote}</p></div></div>
            <p className="field-help">Le statut mondial ne décrit pas toutes les populations locales. Consultez les sources pour les évaluations et recommandations à jour.</p>
          </section>
          <section className="detail-section"><h3>Sa place dans le vivant</h3><ol className="taxonomy-path">{animal.taxonomy.map((node) => <li className="taxonomy-node" key={node.rank}><span>{node.rank}</span><strong>{node.name}</strong></li>)}</ol></section>
          <section className="detail-section"><h3>Pour aller plus loin</h3><div className="source-links">{animal.sources.map((source) => <a href={source.url} target="_blank" rel="noopener noreferrer" key={source.url}>{source.label}<ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (nouvel onglet)</span></a>)}</div></section>
        </> : customAnimal ? <>
          <section className="detail-section"><div className="section-label"><h3>Votre identification</h3><span className="status-badge status-ne">Non évalué</span></div><p>Cette espèce a été renseignée manuellement. Les informations ci-dessous viennent de votre carnet ; leur exactitude et le statut de conservation restent à vérifier.</p>
            <div className="species-info-grid"><div><h4>Habitat</h4><p>{customAnimal.habitat || 'Non renseigné'}</p></div><div><h4>Alimentation</h4><p>{customAnimal.diet || 'Non renseignée'}</p></div><div><h4>Répartition</h4><p>{customAnimal.range || 'Non renseignée'}</p></div><div><h4>Conservation</h4><p>À vérifier auprès des référentiels naturalistes.</p></div></div>
          </section>
          {!!customAnimal.taxonomy?.length && <section className="detail-section"><h3>Sa place dans le vivant</h3><p className="field-help">Taxonomie renseignée manuellement ; vérifiez-la auprès des référentiels naturalistes.</p><ol className="taxonomy-path">{customAnimal.taxonomy.map(node => <li className="taxonomy-node" key={node.rank}><span>{node.rank}</span><strong>{node.name}</strong></li>)}</ol></section>}
          <section className="detail-section"><h3>Rechercher dans les sources</h3><p className="field-help">Ces liens ouvrent une recherche pour votre identification ; ils ne constituent pas une validation.</p><div className="source-links">{customSources.map((source) => <a href={source.url} target="_blank" rel="noopener noreferrer" key={source.url}>{source.label}<ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (nouvel onglet)</span></a>)}</div></section>
        </> : <section className="detail-section"><h3>Une rencontre encore mystérieuse</h3><p>Vous pouvez garder cette observation sans identification. Modifiez-la lorsque vous aurez trouvé l’espèce ; sa fiche éducative apparaîtra alors ici.</p>{!readOnly && <button className="button button-secondary" type="button" onClick={onEdit}><Pencil size={16} />Identifier l’espèce</button>}</section>}
        <div className="privacy-note"><ShieldCheck size={20} /><div><strong>Observer sans déranger.</strong><p>Ne nourrissez pas les animaux, ne vous approchez pas des nids et respectez les règles locales. Votre observation conserve seulement une région générale : les lieux précis restent protégés.</p></div></div>
        {confirmDelete && !readOnly && <div className="delete-confirm" ref={deletePrompt} tabIndex={-1} role="group" aria-labelledby={`${id}-delete-title`}><strong id={`${id}-delete-title`}>Supprimer cette observation ?</strong><p>Cette action retire aussi ses photos de votre carnet sur cet appareil. Elle ne peut pas être annulée.</p><div className="detail-actions"><button className="button button-secondary" type="button" disabled={deleting} onClick={() => setConfirmDelete(false)}>Conserver</button><button className="button button-danger" type="button" disabled={deleting} onClick={() => void deleteObservation()}>{deleting ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />}{deleting ? 'Suppression…' : 'Supprimer définitivement'}</button></div></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="modal-footer">{!readOnly && <button className="button button-quiet danger-text" type="button" onClick={() => setConfirmDelete(true)} disabled={deleting || confirmDelete}><Trash2 size={16} />Supprimer</button>}<button className="button button-secondary" type="button" onClick={onClose} disabled={deleting}>Fermer</button>{!readOnly && <button className="button button-primary" type="button" onClick={onEdit} disabled={deleting}><Pencil size={16} />Modifier</button>}</div>
    </div>
  </div>
}

function CameraPlaceholder() {
  return <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 6h3l2-3h4l2 3h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" /><circle cx="12" cy="13" r="4" /></svg>
}
