import { describe, expect, it } from 'vitest'
import { filterObservations, observationSpecies } from './lib'
import type { Filters } from './lib'
import type { Observation } from './types'

const empty: Filters = { query: '', category: '', region: '', status: '', from: '', to: '', favorites: false }
const manual: Observation = {
  id: 'manual-test',
  speciesId: null,
  customSpecies: { name: 'Chouette hulotte', scientificName: 'Strix aluco' },
  date: '2026-09-12',
  regionId: null,
  notes: 'À la lisière',
  photos: [],
  favorite: false,
  createdAt: '2026-09-12T12:00:00.000Z',
}
const lion: Observation = {
  ...manual,
  id: 'lion-test',
  speciesId: 'lion',
  customSpecies: undefined,
  date: '2026-09-13',
  favorite: true,
}
describe('Recherche dans le carnet', () => {
  it('retrouve une espèce manuelle et ignore les accents dans les notes', () => {
    expect(filterObservations([manual], { ...empty, query: 'strix' })).toHaveLength(1)
    expect(filterObservations([manual], { ...empty, query: 'lisiere' })).toHaveLength(1)
  })
  it('combine date, statut et favoris et trie les rencontres récentes', () => {
    expect(filterObservations([manual, lion], empty).map((item) => item.id)).toEqual([
      'lion-test',
      'manual-test',
    ])
    expect(
      filterObservations([manual, lion], {
        ...empty,
        favorites: true,
        status: 'VU',
        from: '2026-09-13',
        to: '2026-09-13',
      }),
    ).toEqual([lion])
    expect(filterObservations([lion], { ...empty, to: '2026-09-12' })).toEqual([])
  })
  it('ne classe pas une espèce manuelle dans un groupe inventé', () => {
    expect(filterObservations([manual], { ...empty, category: 'Mammifères' })).toEqual([])
    expect(observationSpecies(manual)?.status).toBe('NE')
    expect(observationSpecies(manual)?.taxonomy).toEqual([])
  })
})
