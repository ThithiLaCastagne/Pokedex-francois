import { describe, expect, it } from 'vitest'
import { validateBackup } from './storage'
import type { Observation } from './types'

const observation: Observation = {
  id: 'test-observation',
  speciesId: 'lion',
  date: '2026-06-14',
  regionId: 'east-africa',
  notes: 'À distance, sans déranger.',
  photos: [],
  favorite: true,
  createdAt: '2026-06-14T08:30:00.000Z',
}
function backup(observations: unknown[] = [observation], changes: Record<string, unknown> = {}) {
  return JSON.stringify({
    app: 'pokedex-de-la-faune',
    version: 1,
    exportedAt: '2026-10-08T12:00:00.000Z',
    observations,
    ...changes,
  })
}

describe('validateBackup : confidentialité et intégrité des imports', () => {
  it('accepte une sauvegarde compatible sans modifier son contenu', () => {
    expect(validateBackup(backup())).toEqual([observation])
    expect(validateBackup(backup([]))).toEqual([])
  })

  it('refuse une date impossible et accepte un 29 février réel', () => {
    expect(() => validateBackup(backup([{ ...observation, date: '2025-02-29' }]))).toThrow('Date')
    expect(validateBackup(backup([{ ...observation, date: '2024-02-29' }]))[0].date).toBe('2024-02-29')
    expect(() => validateBackup(backup([{ ...observation, date: '2026-13-01' }]))).toThrow('Date')
  })

  it('refuse des coordonnées exactes même sur une espèce commune', () => {
    expect(() => validateBackup(backup([{ ...observation, latitude: -1.234, longitude: 36.123 }]))).toThrow(
      'champ non autorisé',
    )
    expect(() => validateBackup(backup([observation], { location: { lat: 1, lng: 2 } }))).toThrow(
      'champ non autorisé',
    )
  })

  it('refuse les taxons et régions étrangers au catalogue', () => {
    expect(() => validateBackup(backup([{ ...observation, speciesId: 'not-a-species' }]))).toThrow(
      'Espèce inconnu',
    )
    expect(() => validateBackup(backup([{ ...observation, regionId: 'precise-nesting-site' }]))).toThrow(
      'Région inconnu',
    )
  })

  it('accepte une espèce inconnue et une région non renseignée', () => {
    expect(
      validateBackup(backup([{ ...observation, speciesId: null, regionId: null }]))[0].speciesId,
    ).toBeNull()
  })

  it('préserve une identification manuelle au-delà du catalogue', () => {
    const manual = {
      ...observation,
      speciesId: null,
      customSpecies: {
        name: 'Machaon',
        scientificName: 'Papilio machaon',
        habitat: 'Prairie',
        diet: 'Nectar',
        range: 'Europe',
      },
    }
    expect(validateBackup(backup([manual]))[0]).toEqual(manual)
    expect(
      validateBackup(
        backup([{ ...manual, customSpecies: { name: 'Papillon inconnu', scientificName: '' } }]),
      )[0].customSpecies?.scientificName,
    ).toBe('')
  })

  it('refuse les champs cachés dans une espèce manuelle et les identifications contradictoires', () => {
    expect(() =>
      validateBackup(
        backup([
          {
            ...observation,
            speciesId: null,
            customSpecies: { name: 'Machaon', scientificName: '', latitude: 45 },
          },
        ]),
      ),
    ).toThrow('champ non autorisé')
    expect(() =>
      validateBackup(
        backup([{ ...observation, customSpecies: { name: 'Machaon', scientificName: 'Papilio machaon' } }]),
      ),
    ).toThrow('à la fois')
    expect(() =>
      validateBackup(
        backup([{ ...observation, speciesId: null, customSpecies: { name: '', scientificName: '' } }]),
      ),
    ).toThrow('Nom de l’espèce')
  })

  it('préserve une taxonomie manuelle et remet les rangs dans leur ordre biologique', () => {
    const manual = {
      ...observation,
      speciesId: null,
      customSpecies: {
        name: 'Machaon',
        scientificName: 'Papilio machaon',
        taxonomy: [
          { rank: 'Genre', name: 'Papilio' },
          { rank: 'Classe', name: 'Insecta' },
          { rank: 'Famille', name: 'Papilionidae' },
          { rank: 'Espèce', name: 'Papilio machaon' },
        ],
      },
    }
    expect(validateBackup(backup([manual]))[0].customSpecies?.taxonomy).toEqual([
      { rank: 'Classe', name: 'Insecta' },
      { rank: 'Famille', name: 'Papilionidae' },
      { rank: 'Genre', name: 'Papilio' },
      { rank: 'Espèce', name: 'Papilio machaon' },
    ])
  })

  it('refuse les rangs taxonomiques inconnus, dupliqués ou contenant des coordonnées', () => {
    for (const taxonomy of [
      [
        { rank: 'Classe', name: 'Insecta' },
        { rank: 'Classe', name: 'Aves' },
      ],
      [{ rank: 'Localisation', name: 'Terrier' }],
      [{ rank: 'Famille', name: '' }],
      [{ rank: 'Espèce', name: 'Papilio machaon', latitude: 45 }],
      [{ rank: 'Genre', name: 'x'.repeat(151) }],
      Array.from({ length: 9 }, () => ({ rank: 'Genre', name: 'Papilio' })),
    ]) {
      expect(() =>
        validateBackup(
          backup([
            {
              ...observation,
              speciesId: null,
              customSpecies: { name: 'Machaon', scientificName: 'Papilio machaon', taxonomy },
            },
          ]),
        ),
      ).toThrow()
    }
  })

  it('refuse les données exécutables, les SVG, les URLs et les faux JPEG', () => {
    for (const dangerous of [
      'javascript:alert(1)',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'https://example.com/photo.jpg',
      'data:image/jpeg;base64,PHN2Zz4=',
    ]) {
      expect(() => validateBackup(backup([{ ...observation, photos: [dangerous] }]))).toThrow('Photo')
    }
  })

  it('refuse les doublons, les identifiants malformés et les versions incompatibles', () => {
    expect(() => validateBackup(backup([observation, observation]))).toThrow('double')
    expect(() => validateBackup(backup([{ ...observation, id: '../../photo' }]))).toThrow('Identifiant')
    expect(() => validateBackup(backup([observation], { version: 999 }))).toThrow('version')
  })

  it('refuse les champs absents, les faux booléens et les notes démesurées', () => {
    expect(() => validateBackup(backup([{ id: 'missing-fields' }]))).toThrow()
    expect(() => validateBackup(backup([{ ...observation, favorite: 'yes' }]))).toThrow('Favori')
    expect(() => validateBackup(backup([{ ...observation, notes: 'x'.repeat(10_001) }]))).toThrow('Notes')
    expect(() =>
      validateBackup(backup([{ ...observation, photos: Array(6).fill('data:image/jpeg;base64,/9j/AAAA') }])),
    ).toThrow('maximum 5')
  })

  it('refuse le JSON malformé et les dates de création normalisées silencieusement', () => {
    expect(() => validateBackup('{wrong')).toThrow('JSON')
    expect(() => validateBackup(backup([{ ...observation, createdAt: '2026-02-30T08:30:00.000Z' }]))).toThrow(
      'création',
    )
  })
})
