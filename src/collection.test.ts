import { describe, expect, it } from 'vitest'
import { activityWeeks, achievements, collectionStats, localDay, speciesKey } from './collection'
import type { Observation } from './types'
const item: Observation = {
  id: 'test-123',
  speciesId: 'fox',
  date: '2026-10-08',
  createdAt: '2026-10-08T12:00:00.000Z',
  regionId: 'france',
  notes: '',
  photos: [],
  favorite: false,
}
describe('Collection et progression réelles', () => {
  it('ne confond pas une rencontre inconnue et une espèce identifiée', () => {
    expect(collectionStats([{ ...item, speciesId: null }]).species).toBe(0)
    expect(collectionStats([{ ...item, speciesId: null }]).total).toBe(1)
  })
  it('déduplique le catalogue et ses identifications manuelles, indépendamment de la casse', () => {
    const custom = {
      ...item,
      id: 'test-456',
      speciesId: null,
      customSpecies: { name: 'Autre nom', scientificName: '  VULPES   VULPES  ' },
    }
    expect(speciesKey(custom)).toBe('fox')
    expect(collectionStats([item, custom]).species).toBe(1)
    expect(collectionStats([item, custom]).catalog).toBe(1)
  })
  it('déduplique les identifications libres sans nom scientifique', () => {
    const one = { ...item, speciesId: null, customSpecies: { name: 'Écureuil roux', scientificName: '' } }
    expect(speciesKey(one)).toBe(
      speciesKey({ ...one, customSpecies: { name: ' ecureuil  ROUX ', scientificName: '' } }),
    )
  })
  it('compte la semaine du lundi à aujourd’hui et ignore les dates futures', () => {
    const today = new Date(2026, 9, 8, 23, 55)
    expect(localDay(today)).toBe('2026-10-08')
    expect(
      collectionStats(
        [
          item,
          { ...item, date: '2026-10-04' },
          { ...item, date: '2026-10-05' },
          { ...item, date: '2026-10-09' },
        ],
        today,
      ).week,
    ).toBe(2)
  })
  it('ne débloque aucun badge sur un carnet vide et plafonne les jauges', () => {
    expect(achievements([]).some((b) => b.unlocked)).toBe(false)
    const badges = achievements(Array.from({ length: 30 }, (_, i) => ({ ...item, id: `test-${i}` })))
    expect(badges.find((b) => b.id === 'first')?.percent).toBe(100)
    expect(badges.find((b) => b.id === 'five')?.unlocked).toBe(false)
  })
  it('affiche douze semaines alignées sur le lundi et traverse les changements d’année', () => {
    const days = activityWeeks([{ ...item, date: '2025-12-31' }], new Date(2026, 0, 1, 0, 30))
    expect(days).toHaveLength(84)
    expect(new Date(days[0].day + 'T12:00:00').getDay()).toBe(1)
    expect(days.find((d) => d.day === '2025-12-31')?.count).toBe(1)
    expect(days.find((d) => d.day === '2026-01-02')?.future).toBe(true)
  })
})
