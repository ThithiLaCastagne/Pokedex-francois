import { regions, species } from './data'
import type { Observation, ObservationInput, TaxonomicRank } from './types'

const DB_NAME = 'pokedex-faune-private-v1'
const STORE_NAME = 'observations'
const MAX_PHOTOS = 5
const MAX_PHOTO_LENGTH = 4_200_000
const MAX_DATABASE_LENGTH = 100_000_000
const MAX_BACKUP_LENGTH = 105_000_000
const MAX_OBSERVATIONS = 5_000
const speciesIds = new Set(species.map(item => item.id))
const regionIds = new Set(regions.map(item => item.id))
const taxonomicRanks: TaxonomicRank[] = ['Règne', 'Embranchement', 'Classe', 'Ordre', 'Famille', 'Genre', 'Espèce', 'Sous-espèce']
let databasePromise: Promise<IDBDatabase> | undefined

export const photoLimits = { maxCount: MAX_PHOTOS, maxUploadBytes: 15_000_000, maxDimension: 1800 } as const

function object(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} : format invalide.`)
  const record = value as Record<string, unknown>
  if (Object.keys(record).some(key => !keys.includes(key))) throw new Error(`${label} : champ non autorisé. Les coordonnées exactes ne sont pas acceptées.`)
  return record
}

function string(value: unknown, maximum: number, label: string, allowEmpty = true): string {
  if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && !value.trim()) || /\u0000/.test(value)) {
    throw new Error(`${label} : texte invalide ou trop long.`)
  }
  return value
}

function validDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date d’observation invalide.')
  const parsed = new Date(`${value}T12:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Date d’observation invalide.')
  return value
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) throw new Error('Date de création invalide.')
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) throw new Error('Date de création invalide.')
  return value
}

function reference(value: unknown, options: Set<string>, label: string): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || !options.has(value)) throw new Error(`${label} inconnu dans cette version du carnet.`)
  return value
}

function photo(value: unknown): string {
  if (typeof value !== 'string' || value.length > MAX_PHOTO_LENGTH || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('Photo invalide : seules des images JPEG intégrées et de taille limitée sont acceptées.')
  }
  const encoded = value.slice('data:image/jpeg;base64,'.length)
  if (encoded.length % 4 !== 0 || !encoded.startsWith('/9j/')) throw new Error('Photo JPEG invalide.')
  return value
}

function customSpecies(value: unknown): Observation['customSpecies'] {
  if (value === undefined) return undefined
  const input = object(value, ['name', 'scientificName', 'habitat', 'diet', 'range', 'taxonomy'], 'Espèce saisie manuellement')
  const result: NonNullable<Observation['customSpecies']> = {
    name: string(input.name, 100, 'Nom de l’espèce', false),
    scientificName: string(input.scientificName, 150, 'Nom scientifique'),
  }
  for (const key of ['habitat', 'diet', 'range'] as const) {
    if (input[key] !== undefined) result[key] = string(input[key], 1500, key)
  }
  if (input.taxonomy !== undefined) {
    if (!Array.isArray(input.taxonomy) || input.taxonomy.length > taxonomicRanks.length) throw new Error('Taxonomie manuelle invalide : huit rangs maximum.')
    const taxonomy = input.taxonomy.map(value => {
      const entry = object(value, ['rank', 'name'], 'Rang taxonomique')
      if (typeof entry.rank !== 'string' || !taxonomicRanks.includes(entry.rank as TaxonomicRank)) throw new Error('Rang taxonomique inconnu.')
      return { rank: entry.rank as TaxonomicRank, name: string(entry.name, 150, 'Nom du taxon', false) }
    })
    if (new Set(taxonomy.map(entry => entry.rank)).size !== taxonomy.length) throw new Error('Chaque rang taxonomique ne peut apparaître qu’une fois.')
    result.taxonomy = taxonomy.sort((a, b) => taxonomicRanks.indexOf(a.rank) - taxonomicRanks.indexOf(b.rank))
  }
  return result
}

function validateObservation(value: unknown): Observation {
  const input = object(value, ['id', 'speciesId', 'date', 'regionId', 'notes', 'photos', 'favorite', 'createdAt', 'customSpecies'], 'Observation')
  const id = string(input.id, 80, 'Identifiant', false)
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(id)) throw new Error('Identifiant d’observation invalide.')
  if (!Array.isArray(input.photos) || input.photos.length > MAX_PHOTOS) throw new Error(`Une observation peut contenir au maximum ${MAX_PHOTOS} photos.`)
  if (typeof input.favorite !== 'boolean') throw new Error('Favori invalide.')
  const result: Observation = {
    id,
    speciesId: reference(input.speciesId, speciesIds, 'Espèce'),
    date: validDate(input.date),
    regionId: reference(input.regionId, regionIds, 'Région'),
    notes: string(input.notes, 10_000, 'Notes'),
    photos: input.photos.map(photo),
    favorite: input.favorite,
    createdAt: timestamp(input.createdAt),
  }
  const manual = customSpecies(input.customSpecies)
  if (manual) {
    if (result.speciesId !== null) throw new Error('Une espèce ne peut pas être à la fois du catalogue et saisie manuellement.')
    result.customSpecies = manual
  }
  return result
}

function validateTotal(observations: Observation[]): void {
  if (observations.length > MAX_OBSERVATIONS) throw new Error(`Ce carnet accepte au maximum ${MAX_OBSERVATIONS} observations. Exportez une sauvegarde avant de faire du tri.`)
  const size = observations.reduce((total, observation) => total + observation.photos.reduce((bytes, item) => bytes + item.length, 0) + observation.notes.length + 2000, 0)
  if (size > MAX_DATABASE_LENGTH) throw new Error('Le carnet dépasse sa limite locale de 100 Mo. Exportez une sauvegarde et supprimez quelques photos avant de réessayer.')
}

/** Parse une sauvegarde sans effets de bord. Les champs de localisation précise sont refusés. */
export function validateBackup(text: string): Observation[] {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_LENGTH) throw new Error('Sauvegarde trop volumineuse (100 Mo maximum).')
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error('Ce fichier ne contient pas une sauvegarde JSON valide.') }
  const input = object(value, ['app', 'version', 'exportedAt', 'observations'], 'Sauvegarde')
  if (input.app !== 'pokedex-de-la-faune' || input.version !== 1) throw new Error('Format ou version de sauvegarde non pris en charge.')
  timestamp(input.exportedAt)
  if (!Array.isArray(input.observations) || input.observations.length > MAX_OBSERVATIONS) throw new Error('Liste d’observations invalide ou trop volumineuse.')
  const observations = input.observations.map(validateObservation)
  if (new Set(observations.map(item => item.id)).size !== observations.length) throw new Error('La sauvegarde contient des identifiants en double.')
  validateTotal(observations)
  return observations
}

function database(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise
  databasePromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Le stockage privé de ce navigateur est indisponible. Utilisez un navigateur récent avec le stockage autorisé.')); return }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => { db.close(); databasePromise = undefined }
      resolve(db)
    }
    request.onerror = () => reject(new Error('Le carnet ne peut pas ouvrir son stockage local. Vérifiez les permissions du navigateur.'))
    request.onblocked = () => reject(new Error('Fermez les autres onglets du carnet pour ouvrir le stockage.'))
  })
  databasePromise.catch(() => { databasePromise = undefined })
  return databasePromise
}

function storageError(error?: DOMException | null): Error {
  return new Error(error?.name === 'QuotaExceededError'
    ? 'Le stockage de votre navigateur est plein. Exportez une sauvegarde puis libérez de l’espace.'
    : 'L’enregistrement local a échoué. Vérifiez le stockage du navigateur et réessayez.')
}

export async function loadObservations(): Promise<Observation[]> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).getAll()
    let observations: Observation[] = []
    request.onsuccess = () => { observations = request.result as Observation[] }
    transaction.oncomplete = () => resolve(observations.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)))
    transaction.onerror = () => reject(storageError(transaction.error))
    transaction.onabort = () => reject(storageError(transaction.error))
  })
}

// Lecture et écriture dans une transaction unique : pas de remplacement aveugle
// si plusieurs onglets importent ou modifient des observations simultanément.
async function modify<T>(operation: (current: Observation[]) => { next: Observation[]; result: T }): Promise<T> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()
    let result: T
    let failure: Error | undefined
    request.onsuccess = () => {
      try {
        const current = request.result as Observation[]
        const update = operation(current)
        validateTotal(update.next)
        const nextIds = new Set(update.next.map(item => item.id))
        const previous = new Map(current.map(item => [item.id, item]))
        current.filter(item => !nextIds.has(item.id)).forEach(item => store.delete(item.id))
        update.next.filter(item => previous.get(item.id) !== item).forEach(item => store.put(item))
        result = update.result
      } catch (error) {
        failure = error instanceof Error ? error : new Error('L’observation est invalide.')
        transaction.abort()
      }
    }
    transaction.oncomplete = () => resolve(result)
    transaction.onerror = () => reject(failure ?? storageError(transaction.error))
    transaction.onabort = () => reject(failure ?? storageError(transaction.error))
  })
}

export async function saveObservation(input: ObservationInput, existingId?: string): Promise<Observation> {
  // Reject runtime properties outside the documented input schema as well.
  object(input, ['speciesId', 'date', 'regionId', 'notes', 'photos', 'customSpecies'], 'Observation')
  return modify(current => {
    const existing = existingId ? current.find(item => item.id === existingId) : undefined
    if (existingId && !existing) throw new Error('Cette observation n’existe plus. Actualisez votre carnet.')
    const saved = validateObservation({
      ...input,
      id: existing?.id ?? crypto.randomUUID(),
      favorite: existing?.favorite ?? false,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    })
    return { next: [...current.filter(item => item.id !== saved.id), saved], result: saved }
  })
}

export async function deleteObservation(id: string): Promise<void> {
  return modify(current => ({ next: current.filter(item => item.id !== id), result: undefined }))
}

export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  if (typeof favorite !== 'boolean') throw new Error('Favori invalide.')
  return modify(current => {
    if (!current.some(item => item.id === id)) throw new Error('Observation introuvable.')
    return { next: current.map(item => item.id === id ? { ...item, favorite } : item), result: undefined }
  })
}

export async function exportBackup(): Promise<string> {
  return JSON.stringify({ app: 'pokedex-de-la-faune', version: 1, exportedAt: new Date().toISOString(), observations: await loadObservations() }, null, 2)
}

export async function importBackup(text: string): Promise<number> {
  const imported = validateBackup(text)
  // Re-encode imported photos too: a data URL can contain embedded GPS metadata.
  // This happens before the transaction so image decoding never leaves it idle.
  const cleaned: Observation[] = []
  // Décodage séquentiel : éviter de tenir des dizaines de grandes images en
  // mémoire en même temps lors d'une restauration sur un téléphone.
  for (const observation of imported) {
    const photos: string[] = []
    for (const source of observation.photos) photos.push(await cleanDataPhoto(source))
    cleaned.push({ ...observation, photos })
  }
  return modify(current => {
    const existingIds = new Set(current.map(item => item.id))
    const added = cleaned.filter(item => !existingIds.has(item.id))
    return { next: [...current, ...added], result: added.length }
  })
}

export async function clearObservations(): Promise<void> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).clear()
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(storageError(transaction.error))
    transaction.onabort = () => reject(storageError(transaction.error))
  })
}

async function reencodePhoto(url: string): Promise<string> {
  const image = new Image()
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Cette photo est illisible. Essayez une image JPEG, PNG ou WebP.'))
  })
  image.src = url
  await loaded
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 80_000_000) throw new Error('Cette image est trop grande ou invalide. Choisissez une version moins volumineuse.')
  const scale = Math.min(1, photoLimits.maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Le navigateur ne peut pas préparer cette photo.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  // Canvas crée un nouveau fichier sans les blocs EXIF/GPS du fichier original.
  const result = canvas.toDataURL('image/jpeg', 0.84)
  canvas.width = 0
  canvas.height = 0
  return photo(result)
}

async function cleanDataPhoto(data: string): Promise<string> {
  return reencodePhoto(data)
}

export async function cleanPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Format non pris en charge. Choisissez une photo JPEG, PNG ou WebP ; convertissez les fichiers HEIC au préalable.')
  if (!file.size || file.size > photoLimits.maxUploadBytes) throw new Error('Chaque photo doit faire moins de 15 Mo.')
  const url = URL.createObjectURL(file)
  try { return await reencodePhoto(url) } finally { URL.revokeObjectURL(url) }
}

export async function downloadBackup(): Promise<void> {
  const text = await exportBackup()
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `pokedex-faune-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
