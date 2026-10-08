import { useEffect, useId, useRef, useState } from 'react'
import { Camera, Check, ImagePlus, LoaderCircle, MapPin, ShieldCheck, Trash2, X } from 'lucide-react'
import { regions, species, statusLabels } from '../data'
import { cleanPhoto, photoLimits } from '../storage'
import type { Observation, ObservationInput, TaxonomicRank } from '../types'

const taxonomicRanks: TaxonomicRank[] = ['Règne', 'Embranchement', 'Classe', 'Ordre', 'Famille', 'Genre', 'Espèce', 'Sous-espèce']

interface Props {
  initial?: Observation
  onSave: (input: ObservationInput) => Promise<void>
  onClose: () => void
}

function localToday() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function distanceToRegion(latitude: number, longitude: number, regionLatitude: number, regionLongitude: number) {
  const rad = Math.PI / 180
  const a = Math.sin((regionLatitude - latitude) * rad / 2) ** 2
    + Math.cos(latitude * rad) * Math.cos(regionLatitude * rad) * Math.sin((regionLongitude - longitude) * rad / 2) ** 2
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
}

export default function ObservationForm({ initial, onSave, onClose }: Props) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const uploadInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const active = useRef(true)
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? [])
  const [speciesId, setSpeciesId] = useState(initial?.customSpecies ? '__custom' : initial?.speciesId ?? '')
  const [customName, setCustomName] = useState(initial?.customSpecies?.name ?? '')
  const [customScientificName, setCustomScientificName] = useState(initial?.customSpecies?.scientificName ?? '')
  const [customHabitat, setCustomHabitat] = useState(initial?.customSpecies?.habitat ?? '')
  const [customDiet, setCustomDiet] = useState(initial?.customSpecies?.diet ?? '')
  const [customRange, setCustomRange] = useState(initial?.customSpecies?.range ?? '')
  const [customTaxonomy, setCustomTaxonomy] = useState<Partial<Record<TaxonomicRank, string>>>(() => Object.fromEntries(initial?.customSpecies?.taxonomy?.map(node => [node.rank, node.name]) ?? []))
  const [search, setSearch] = useState('')
  const [date, setDate] = useState(initial?.date ?? localToday())
  const [regionId, setRegionId] = useState(initial?.regionId ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')
  const [error, setError] = useState('')
  const busy = saving || processing
  const busyRef = useRef(busy)
  busyRef.current = busy
  const selectedSpecies = species.find((item) => item.id === speciesId)
  const normalizedSearch = search.trim().toLocaleLowerCase('fr')
  const filteredSpecies = species.filter((item) => item.id === speciesId
    || `${item.name} ${item.scientificName}`.toLocaleLowerCase('fr').includes(normalizedSearch))

  useEffect(() => {
    active.current = true
    const previouslyFocused = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault()
        onClose()
      }
      if (event.key !== 'Tab') return
      const targets = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([hidden]), select:not([disabled]), textarea:not([disabled]), summary, a[href], [tabindex="0"]') ?? [])
        .filter((target) => target.getClientRects().length > 0 && getComputedStyle(target).visibility !== 'hidden')
      if (!targets?.length) {
        event.preventDefault()
        return
      }
      const first = targets[0]
      const last = targets[targets.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      active.current = false
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose])

  async function importPhotos(files: FileList | null) {
    if (!files?.length || busyRef.current) return
    setError('')
    const incoming = Array.from(files)
    if (photos.length + incoming.length > photoLimits.maxCount) {
      setError(`Vous pouvez ajouter jusqu’à ${photoLimits.maxCount} photos par observation.`)
      if (uploadInput.current) uploadInput.current.value = ''
      if (cameraInput.current) cameraInput.current.value = ''
      return
    }
    setProcessing(true)
    busyRef.current = true
    try {
      const prepared: string[] = []
      for (const file of incoming) {
        if (file.size > photoLimits.maxUploadBytes) throw new Error(`Une photo dépasse ${photoLimits.maxUploadBytes / 1_000_000} Mo. Choisissez une version plus légère.`)
        prepared.push(await cleanPhoto(file))
      }
      if (active.current) setPhotos((current) => [...current, ...prepared])
    } catch (caught) {
      if (active.current) setError(caught instanceof Error ? caught.message : 'Impossible de lire ces photos. Essayez des fichiers JPEG, PNG ou WebP.')
    } finally {
      if (active.current) setProcessing(false)
      busyRef.current = false
      if (uploadInput.current) uploadInput.current.value = ''
      if (cameraInput.current) cameraInput.current.value = ''
    }
  }

  function useLocation() {
    setLocationMessage('')
    if (!navigator.geolocation) {
      setLocationMessage('La géolocalisation n’est pas disponible. Vous pouvez choisir une région ci-dessous.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition((position) => {
      if (!active.current) return
      const nearest = regions.reduce((best, region) => distanceToRegion(position.coords.latitude, position.coords.longitude, region.latitude, region.longitude)
        < distanceToRegion(position.coords.latitude, position.coords.longitude, best.latitude, best.longitude) ? region : best, regions[0])
      if (nearest) {
        setRegionId(nearest.id)
        setLocationMessage(`Région suggérée : ${nearest.name}. Vérifiez ce choix ; vos coordonnées exactes ne sont pas enregistrées.`)
      }
      setLocating(false)
    }, (reason) => {
      if (!active.current) return
      setLocating(false)
      setLocationMessage(reason.code === 1 ? 'Autorisation refusée. Choisissez une région manuellement.' : 'Impossible de déterminer votre région. Choisissez-la manuellement.')
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 })
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busyRef.current) return
    setError('')
    if (!photos.length && !initial) {
      setError('Ajoutez au moins une photo personnelle pour enregistrer votre observation.')
      return
    }
    if (!date || date > localToday()) {
      setError('Choisissez une date d’observation valide, aujourd’hui ou dans le passé.')
      return
    }
    if (speciesId === '__custom' && !customName.trim()) {
      setError('Renseignez un nom pour votre espèce, ou choisissez « Espèce inconnue ».')
      return
    }
    setSaving(true)
    busyRef.current = true
    try {
      const input: ObservationInput = { speciesId: speciesId === '__custom' ? null : speciesId || null, date, regionId: regionId || null, notes: notes.trim(), photos }
      if (speciesId === '__custom') input.customSpecies = {
        name: customName.trim(),
        scientificName: customScientificName.trim(),
        ...(customHabitat.trim() ? { habitat: customHabitat.trim() } : {}),
        ...(customDiet.trim() ? { diet: customDiet.trim() } : {}),
        ...(customRange.trim() ? { range: customRange.trim() } : {}),
      }
      const taxonomy = taxonomicRanks.map(rank => ({ rank, name: customTaxonomy[rank]?.trim() || '' })).filter(node => node.name)
      if (input.customSpecies && taxonomy.length) input.customSpecies.taxonomy = taxonomy
      await onSave(input)
    } catch (caught) {
      if (active.current) setError(caught instanceof Error ? caught.message : 'L’enregistrement a échoué. Vos photos restent disponibles ici ; réessayez.')
    } finally {
      if (active.current) setSaving(false)
      busyRef.current = false
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <div className="modal-panel observation-form-panel" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <div className="modal-header">
        <div><span className="eyebrow">VOTRE CARNET DE NATURE</span><h2 id={`${id}-title`}>{initial ? 'Modifier l’observation' : 'Nouvelle observation'}</h2></div>
        <button className="icon-button" type="button" aria-label="Fermer le formulaire" onClick={onClose} disabled={busy}><X size={22} /></button>
      </div>
      <form className="observation-form" onSubmit={submit}>
        <div className="modal-body">
          <div className="form-field">
            <span className="field-label">Vos photos <span className="field-optional">{initial ? `(jusqu’à ${photoLimits.maxCount})` : `(au moins une, ${photoLimits.maxCount} maximum)`}</span></span>
            <div className="photo-uploader">
              <ImagePlus size={30} aria-hidden="true" />
              <strong>Chaque rencontre commence par une image</strong>
              <span>JPEG, PNG ou WebP · {photoLimits.maxUploadBytes / 1_000_000} Mo maximum par photo</span>
              <div className="upload-actions">
                <button type="button" className="button button-secondary" disabled={busy || photos.length >= photoLimits.maxCount} onClick={() => uploadInput.current?.click()}><ImagePlus size={17} />Importer des photos</button>
                <button type="button" className="button button-quiet" disabled={busy || photos.length >= photoLimits.maxCount} onClick={() => cameraInput.current?.click()}><Camera size={17} />Prendre une photo</button>
              </div>
              <input ref={uploadInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={busy} aria-label="Importer des photos personnelles" onChange={(event) => void importPhotos(event.target.files)} />
              <input ref={cameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden disabled={busy} aria-label="Prendre une photo avec l’appareil" onChange={(event) => void importPhotos(event.target.files)} />
              {processing && <span className="processing-note" role="status"><LoaderCircle size={16} className="spin" />Préparation des photos et suppression des métadonnées…</span>}
            </div>
            {photos.length > 0 && <div className="photo-previews">{photos.map((photo, index) => <div className="photo-preview" key={`${index}-${photo.slice(-24)}`}>
              <img src={photo} alt={`Photo personnelle ${index + 1}`} />
              <button type="button" className="photo-remove" aria-label={`Retirer la photo ${index + 1}`} disabled={busy} onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))}><Trash2 size={16} /></button>
            </div>)}</div>}
            <p className="field-help"><ShieldCheck size={14} />Les métadonnées GPS sont retirées des photos importées.</p>
          </div>

          <div className="form-field">
            <label className="field-label" htmlFor={`${id}-search`}>Quelle espèce avez-vous observée ?</label>
            <input className="input-field" id={`${id}-search`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un nom commun ou scientifique…" disabled={busy} autoComplete="off" />
            <label className="sr-only" htmlFor={`${id}-species`}>Choisir l’espèce</label>
            <select className="input-field" id={`${id}-species`} value={speciesId} onChange={(event) => setSpeciesId(event.target.value)} disabled={busy}>
              <option value="">Espèce inconnue — identifier plus tard</option>
              <option value="__custom">Autre espèce — identification manuelle</option>
              {filteredSpecies.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.scientificName}</option>)}
            </select>
            <p className="field-help">Choisissez une espèce du catalogue, ajoutez votre propre identification ou gardez l’observation non identifiée.</p>
            {selectedSpecies && <div className={`species-selection status-${selectedSpecies.status.toLowerCase()}`}><Check size={15} /><span>{selectedSpecies.name} · {statusLabels[selectedSpecies.status]}</span></div>}
          </div>
          {speciesId === '__custom' && <div className="custom-species-fields">
            <div className="form-grid">
              <div className="form-field"><label className="field-label" htmlFor={`${id}-custom-name`}>Nom de l’espèce</label><input className="input-field" id={`${id}-custom-name`} value={customName} onChange={(event) => setCustomName(event.target.value)} maxLength={100} disabled={busy} required placeholder="Ex. : Chouette hulotte" /></div>
              <div className="form-field"><label className="field-label" htmlFor={`${id}-custom-scientific`}>Nom scientifique <span className="field-optional">(facultatif)</span></label><input className="input-field" id={`${id}-custom-scientific`} value={customScientificName} onChange={(event) => setCustomScientificName(event.target.value)} maxLength={150} disabled={busy} placeholder="Ex. : Strix aluco" /></div>
            </div>
            <details className="custom-education"><summary>Ajouter des informations éducatives <span className="field-optional">(facultatif)</span></summary>
              <p className="field-help">Vos informations personnelles seront distinguées des fiches du catalogue. Vérifiez-les auprès de sources naturalistes.</p>
              <div className="form-field"><label className="field-label" htmlFor={`${id}-habitat`}>Habitat</label><textarea className="input-field" id={`${id}-habitat`} value={customHabitat} onChange={(event) => setCustomHabitat(event.target.value)} maxLength={1000} rows={2} disabled={busy} /></div>
              <div className="form-field"><label className="field-label" htmlFor={`${id}-diet`}>Alimentation</label><textarea className="input-field" id={`${id}-diet`} value={customDiet} onChange={(event) => setCustomDiet(event.target.value)} maxLength={1000} rows={2} disabled={busy} /></div>
              <div className="form-field"><label className="field-label" htmlFor={`${id}-range`}>Répartition</label><textarea className="input-field" id={`${id}-range`} value={customRange} onChange={(event) => setCustomRange(event.target.value)} maxLength={1000} rows={2} disabled={busy} /></div>
              <p className="field-help">Taxonomie facultative : renseignez uniquement les rangs que vous avez vérifiés. Les rangs vides sont ignorés.</p>
              <div className="form-grid">{taxonomicRanks.map(rank => <div className="form-field" key={rank}><label className="field-label" htmlFor={`${id}-taxon-${rank}`}>{rank}</label><input className="input-field" id={`${id}-taxon-${rank}`} value={customTaxonomy[rank] || ''} onChange={event => setCustomTaxonomy(current => ({ ...current, [rank]: event.target.value }))} maxLength={100} disabled={busy} placeholder={rank === 'Règne' ? 'Ex. : Animalia' : rank === 'Classe' ? 'Ex. : Aves' : ''} /></div>)}</div>
            </details>
          </div>}

          <div className="form-grid">
            <div className="form-field"><label className="field-label" htmlFor={`${id}-date`}>Date de la rencontre</label><input className="input-field" id={`${id}-date`} type="date" value={date} max={localToday()} required disabled={busy} onChange={(event) => setDate(event.target.value)} /></div>
            <div className="form-field"><label className="field-label" htmlFor={`${id}-region`}>Région <span className="field-optional">(facultatif)</span></label><select className="input-field" id={`${id}-region`} value={regionId} disabled={busy || locating} onChange={(event) => setRegionId(event.target.value)}><option value="">Ne pas renseigner</option>{regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></div>
          </div>
          <button type="button" className="location-button" disabled={busy || locating} onClick={useLocation}>{locating ? <LoaderCircle size={16} className="spin" /> : <MapPin size={16} />}{locating ? 'Recherche de la région…' : 'Suggérer ma région actuelle'}</button>
          {locationMessage && <p className="field-help" role="status">{locationMessage}</p>}
          <div className="form-field"><label className="field-label" htmlFor={`${id}-notes`}>Notes personnelles <span className="field-optional">(facultatif)</span></label><textarea className="input-field" id={`${id}-notes`} value={notes} maxLength={5000} rows={3} disabled={busy} placeholder="Un comportement, une lumière, un souvenir à garder…" onChange={(event) => setNotes(event.target.value)} /></div>
          <div className="privacy-note"><ShieldCheck size={19} /><div><strong>Une rencontre, en toute discrétion.</strong><p>Votre carnet reste privé sur cet appareil. Seule une région est conservée, jamais un lieu précis. Gardez vos distances et laissez les animaux suivre leur chemin.</p></div></div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <div className="modal-footer"><button type="button" className="button button-secondary" disabled={busy} onClick={onClose}>Annuler</button><button type="submit" className="button button-primary" disabled={busy || locating}>{saving ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}{saving ? 'Enregistrement…' : initial ? 'Enregistrer les modifications' : 'Ajouter à mon carnet'}</button></div>
      </form>
    </div>
  </div>
}
