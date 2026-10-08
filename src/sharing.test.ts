import { describe, expect, it } from 'vitest'
import {
  compareCollections,
  decodeSnapshot,
  encodeSnapshot,
  snapshotFromLink,
  snapshotOf,
  validateSnapshot,
} from './sharing'
import type { Observation } from './types'
import type { Profile } from './preferences'
const profile: Profile = {
  id: 'profile-123456789',
  name: 'Éloïse 🦊',
  color: '#245a46',
  goal: 3,
  demoDismissed: false,
  wishlist: [],
}
const observation: Observation = {
  id: 'private-id-123',
  speciesId: 'fox',
  regionId: 'france',
  date: '2026-10-07',
  notes: 'Ne pas partager le nid.',
  photos: ['private-photo'],
  favorite: true,
  createdAt: '2026-10-07T12:00:00.000Z',
}
describe('Partage limité et liens non fiables', () => {
  it('ne partage jamais photo, note, lieu, date ou identifiant d’observation', () => {
    const snapshot = snapshotOf([observation], profile)
    const serialized = JSON.stringify(snapshot)
    for (const value of [
      'Ne pas partager',
      'private-photo',
      'france',
      '2026-10-07',
      'private-id-123',
      'wishlist',
    ])
      expect(serialized).not.toContain(value)
    expect(snapshot.catalogIds).toEqual(['fox'])
  })
  it('conserve correctement le français et les emoji dans les liens', () => {
    const snapshot = snapshotOf([observation], profile)
    expect(decodeSnapshot(encodeSnapshot(snapshot))).toEqual(snapshot)
    expect(snapshotFromLink(`https://example.org/app/#collection=${encodeSnapshot(snapshot)}`)).toEqual(
      snapshot,
    )
  })
  it('refuse des champs dissimulés, références inconnues et compteurs incohérents', () => {
    const snapshot = snapshotOf([observation], profile)
    for (const bad of [
      { ...snapshot, notes: 'secret' },
      { ...snapshot, latitude: 48 },
      { ...snapshot, total: -1 },
      { ...snapshot, total: 1.5 },
      { ...snapshot, speciesCount: 2 },
      { ...snapshot, catalogIds: ['unknown'] },
      { ...snapshot, catalogIds: ['fox', 'fox'] },
      { ...snapshot, color: 'url(https://example.com)' },
      { ...snapshot, updatedAt: '2026-02-31T12:00:00.000Z' },
    ])
      expect(() => validateSnapshot(bad)).toThrow()
  })
  it('refuse les liens trop longs et les données malformées avant toute sauvegarde', () => {
    for (const token of ['', '<script>', 'a'.repeat(6001), 'eyJ4IjoieSJ9', '___'])
      expect(() => decodeSnapshot(token)).toThrow()
  })
  it('compare les espèces du guide sans mélanger les carnets', () => {
    const mine = snapshotOf([observation], profile)
    const friend = {
      ...mine,
      id: 'other-profile-12345',
      total: 2,
      speciesCount: 2,
      catalogIds: ['fox', 'robin'],
    }
    expect(compareCollections(mine, friend)).toEqual({ shared: ['fox'], toDiscover: ['robin'], together: 2 })
    expect(mine.catalogIds).toEqual(['fox'])
  })
})
