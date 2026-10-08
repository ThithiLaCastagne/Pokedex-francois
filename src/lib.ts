import { regions, species } from './data'
import type { Observation, Species } from './types'

export function observationSpecies(observation: Observation): Species | undefined {
  const known = species.find(item => item.id === observation.speciesId)
  if (known) return known
  const custom = observation.customSpecies
  if (!custom) return undefined
  const animalClass = custom.taxonomy?.find(node => node.rank === 'Classe')?.name.toLowerCase()
  const categories: Record<string, Species['category']> = { mammalia: 'Mammifères', aves: 'Oiseaux', reptilia: 'Reptiles', amphibia: 'Amphibiens', insecta: 'Insectes', actinopterygii: 'Poissons', chondrichthyes: 'Poissons' }
  const search = encodeURIComponent(custom.scientificName || custom.name)
  return {
    id: `custom-${observation.id}`, name: custom.name, scientificName: custom.scientificName,
    category: animalClass ? categories[animalClass] || 'À classer' : 'À classer', status: 'NE', statusNote: 'Identification et informations renseignées manuellement. Statut de conservation non renseigné.',
    taxonomy: custom.taxonomy || [], habitat: custom.habitat || 'Non renseigné', diet: custom.diet || 'Non renseigné', range: custom.range || 'Non renseigné',
    description: 'Cette identification a été renseignée dans votre carnet. Consultez les sources pour documenter et vérifier votre observation.',
    cover: './animal-fallback.svg', imageCredit: 'Illustration du carnet',
    sources: [
      { label: 'Wikipédia', url: `https://fr.wikipedia.org/w/index.php?search=${search}` },
      { label: 'GBIF', url: `https://www.gbif.org/species/search?q=${search}` },
      { label: 'iNaturalist', url: `https://www.inaturalist.org/taxa/search?q=${search}` },
    ],
  }
}

export const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr')

export interface Filters { query: string; category: string; region: string; status: string; from: string; to: string; favorites: boolean }
export function filterObservations(observations: Observation[], filters: Filters): Observation[] {
  return observations.filter(observation => {
    const animal = observationSpecies(observation)
    const region = regions.find(item => item.id === observation.regionId)
    const haystack = normalize([animal?.name, animal?.scientificName, region?.name, observation.notes].join(' '))
    return (!filters.query || haystack.includes(normalize(filters.query)))
      && (!filters.category || animal?.category === filters.category)
      && (!filters.region || observation.regionId === filters.region)
      && (!filters.status || animal?.status === filters.status)
      && (!filters.from || observation.date >= filters.from)
      && (!filters.to || observation.date <= filters.to)
      && (!filters.favorites || observation.favorite)
  }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}
