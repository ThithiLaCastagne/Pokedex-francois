export type ConservationStatus = 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'DD' | 'NE'
export type TaxonomicRank =
  'Règne' | 'Embranchement' | 'Classe' | 'Ordre' | 'Famille' | 'Genre' | 'Espèce' | 'Sous-espèce'
export interface Species {
  id: string
  name: string
  scientificName: string
  category: 'Mammifères' | 'Oiseaux' | 'Reptiles' | 'Amphibiens' | 'Insectes' | 'Poissons' | 'À classer'
  status: ConservationStatus
  statusNote: string
  taxonomy: { rank: TaxonomicRank; name: string }[]
  habitat: string
  diet: string
  range: string
  description: string
  cover: string
  imageCredit: string
  sources: { label: string; url: string }[]
}
export interface Region {
  id: string
  name: string
  continent: string
  latitude: number
  longitude: number
}
export interface ManualSpecies {
  name: string
  scientificName: string
  habitat?: string
  diet?: string
  range?: string
  taxonomy?: { rank: TaxonomicRank; name: string }[]
}
export interface Observation {
  id: string
  speciesId: string | null
  date: string
  regionId: string | null
  notes: string
  photos: string[]
  favorite: boolean
  createdAt: string
  customSpecies?: ManualSpecies
}
export interface ObservationInput {
  speciesId: string | null
  date: string
  regionId: string | null
  notes: string
  photos: string[]
  customSpecies?: ManualSpecies
}
