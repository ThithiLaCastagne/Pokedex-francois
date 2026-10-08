import { species } from './data'
import { collectionStats } from './collection'
import { profileColors } from './preferences'
import type { Profile } from './preferences'
import type { Observation } from './types'

// Only this explicit allowlist can leave the private notebook. No notes, photos,
// observation IDs, coordinates, regions or observation dates enter a share link.
export interface CollectionSnapshot {
  version: 1
  id: string
  name: string
  color: string
  updatedAt: string
  total: number
  speciesCount: number
  catalogIds: string[]
}
const FRIENDS_KEY = 'faune-collections-v2'
const allowed = ['version', 'id', 'name', 'color', 'updatedAt', 'total', 'speciesCount', 'catalogIds']

export function snapshotOf(observations: Observation[], profile: Profile): CollectionSnapshot {
  const stats = collectionStats(observations)
  return {
    version: 1,
    id: profile.id,
    name: profile.name,
    color: profile.color,
    updatedAt: new Date().toISOString(),
    total: stats.total,
    speciesCount: stats.species,
    catalogIds: species.filter((item) => stats.keys.has(item.id)).map((item) => item.id),
  }
}

export function validateSnapshot(value: unknown): CollectionSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Ce lien ne contient pas de collection valide.')
  const input = value as Record<string, unknown>
  if (
    Object.keys(input).some((key) => !allowed.includes(key)) ||
    input.version !== 1 ||
    typeof input.id !== 'string' ||
    !/^[a-zA-Z0-9-]{10,80}$/.test(input.id) ||
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.length > 30 ||
    typeof input.color !== 'string' ||
    !profileColors.includes(input.color) ||
    typeof input.updatedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.updatedAt) ||
    !Number.isFinite(Date.parse(input.updatedAt)) ||
    new Date(input.updatedAt as string).toISOString() !== input.updatedAt ||
    Date.parse(input.updatedAt as string) > Date.now() + 300_000 ||
    !Number.isInteger(input.total) ||
    (input.total as number) < 0 ||
    (input.total as number) > 5000 ||
    !Number.isInteger(input.speciesCount) ||
    (input.speciesCount as number) < 0 ||
    (input.speciesCount as number) > (input.total as number) ||
    !Array.isArray(input.catalogIds) ||
    input.catalogIds.length > species.length ||
    input.catalogIds.some((id) => typeof id !== 'string' || !species.some((item) => item.id === id)) ||
    new Set(input.catalogIds).size !== input.catalogIds.length ||
    input.catalogIds.length > (input.speciesCount as number)
  )
    throw new Error('Collection invalide, trop volumineuse ou version non reconnue.')
  return input as unknown as CollectionSnapshot
}

export function encodeSnapshot(snapshot: CollectionSnapshot): string {
  const bytes = new TextEncoder().encode(JSON.stringify(validateSnapshot(snapshot)))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function decodeSnapshot(token: string): CollectionSnapshot {
  if (!token || token.length > 6000 || !/^[a-zA-Z0-9_-]+$/.test(token))
    throw new Error('Lien de collection incomplet ou invalide.')
  try {
    const bytes = Uint8Array.from(atob(token.replace(/-/g, '+').replace(/_/g, '/')), (letter) =>
      letter.charCodeAt(0),
    )
    return validateSnapshot(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
  } catch {
    throw new Error('Ce lien de collection est invalide ou provient d’une autre version.')
  }
}

export function snapshotFromLink(link: string): CollectionSnapshot {
  const hash = link.trim().includes('#collection=')
    ? link.trim().split('#collection=')[1]
    : link.trim().replace(/^#?collection=/, '')
  return decodeSnapshot(hash)
}

export function collectionLink(snapshot: CollectionSnapshot): string {
  return `${location.origin}${location.pathname}#collection=${encodeSnapshot(snapshot)}`
}

export function readFriends(): CollectionSnapshot[] {
  try {
    const input = JSON.parse(localStorage.getItem(FRIENDS_KEY) || '[]')
    if (!Array.isArray(input) || input.length > 50) return []
    return input.flatMap((value) => {
      try {
        return [validateSnapshot(value)]
      } catch {
        return []
      }
    })
  } catch {
    return []
  }
}

export function saveFriend(snapshot: CollectionSnapshot, selfId: string): CollectionSnapshot[] {
  const valid = validateSnapshot(snapshot)
  if (valid.id === selfId)
    throw new Error('C’est votre propre collection. Demandez le lien d’un proche pour l’ajouter.')
  const current = readFriends()
  const previous = current.find((item) => item.id === valid.id)
  if (previous && previous.updatedAt > valid.updatedAt)
    throw new Error('Vous avez déjà une version plus récente de cette collection.')
  const next = [valid, ...current.filter((item) => item.id !== valid.id)]
  if (next.length > 50) throw new Error('Vous pouvez conserver jusqu’à 50 collections de proches.')
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(next))
  return next
}

export function removeFriend(id: string): CollectionSnapshot[] {
  const next = readFriends().filter((item) => item.id !== id)
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(next))
  return next
}

export function compareCollections(mine: CollectionSnapshot, friend: CollectionSnapshot) {
  return {
    shared: mine.catalogIds.filter((id) => friend.catalogIds.includes(id)),
    toDiscover: friend.catalogIds.filter((id) => !mine.catalogIds.includes(id)),
    together: new Set([...mine.catalogIds, ...friend.catalogIds]).size,
  }
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

export async function downloadCollectionCard(snapshot: CollectionSnapshot) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1500
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Votre navigateur ne permet pas de créer une carte.')
  ctx.fillStyle = '#f4f2e9'
  ctx.fillRect(0, 0, 1200, 1500)
  ctx.fillStyle = '#163e2e'
  ctx.fillRect(0, 0, 1200, 520)
  ctx.fillStyle = '#c8e5b6'
  ctx.font = 'bold 54px sans-serif'
  ctx.fillText('faune.', 90, 120)
  ctx.font = '24px sans-serif'
  ctx.fillText('MON CARNET DU VIVANT', 90, 180)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 66px sans-serif'
  ctx.fillText(snapshot.name, 90, 320, 1010)
  ctx.fillStyle = '#d5e1d6'
  ctx.font = '30px sans-serif'
  ctx.fillText('Chaque rencontre a une histoire.', 90, 390)
  ctx.fillStyle = '#163e2e'
  ctx.font = 'bold 112px sans-serif'
  ctx.fillText(String(snapshot.speciesCount), 90, 720)
  ctx.fillText(String(snapshot.total), 650, 720)
  ctx.font = '30px sans-serif'
  ctx.fillText('espèces rencontrées', 90, 775)
  ctx.fillText('observations', 650, 775)
  ctx.font = 'bold 28px sans-serif'
  ctx.fillText('DANS MA COLLECTION', 90, 900)
  const names = snapshot.catalogIds.map((id) => species.find((item) => item.id === id)!.name).slice(0, 8)
  ctx.font = '30px sans-serif'
  names.forEach((name, index) =>
    ctx.fillText(`• ${name}`, 90 + (index % 2) * 530, 980 + Math.floor(index / 2) * 64, 485),
  )
  if (!names.length) {
    ctx.font = 'italic 30px sans-serif'
    ctx.fillText('L’aventure ne fait que commencer.', 90, 1000)
  }
  ctx.fillStyle = '#69766a'
  ctx.font = '24px sans-serif'
  ctx.fillText('Observer. Apprendre. Préserver.', 90, 1360)
  ctx.fillText(`Collection du ${new Date(snapshot.updatedAt).toLocaleDateString('fr-FR')}`, 90, 1405)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Impossible de créer la carte. Réessayez.')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ma-collection-faune.png'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
