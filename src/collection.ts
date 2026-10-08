import { normalize, observationSpecies } from './lib'
import { species } from './data'
import type { Observation } from './types'

export function speciesKey(observation: Observation): string | null {
  if (observation.speciesId) return observation.speciesId
  const custom = observation.customSpecies
  if (!custom) return null
  const scientific = normalize(custom.scientificName.trim()).replace(/\s+/g, ' ')
  const known = scientific && species.find((item) => normalize(item.scientificName) === scientific)
  return known ? known.id : `manual:${scientific || normalize(custom.name.trim()).replace(/\s+/g, ' ')}`
}

export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function collectionStats(observations: Observation[], today = new Date()) {
  const keys = new Set(observations.map(speciesKey).filter((key): key is string => Boolean(key)))
  const groups = new Set(
    observations
      .map((item) => observationSpecies(item)?.category)
      .filter((item) => item && item !== 'À classer'),
  )
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const start = localDay(monday)
  const end = localDay(today)
  return {
    total: observations.length,
    species: keys.size,
    catalog: species.filter((item) => keys.has(item.id)).length,
    keys,
    groups: groups.size,
    regions: new Set(observations.map((item) => item.regionId).filter(Boolean)).size,
    photos: observations.reduce((sum, item) => sum + item.photos.length, 0),
    favorites: observations.filter((item) => item.favorite).length,
    week: observations.filter((item) => item.date >= start && item.date <= end).length,
    notes: observations.filter((item) => item.notes.trim().length >= 20).length,
    days: new Set(observations.map((item) => item.date)).size,
  }
}

export function achievements(observations: Observation[]) {
  const s = collectionStats(observations)
  return [
    {
      id: 'first',
      title: 'Premier regard',
      description: 'Garder une première rencontre.',
      value: s.total,
      target: 1,
      icon: 'leaf',
    },
    {
      id: 'five',
      title: 'L’œil curieux',
      description: 'Rencontrer 5 espèces différentes.',
      value: s.species,
      target: 5,
      icon: 'eye',
    },
    {
      id: 'ten',
      title: 'Naturaliste en herbe',
      description: 'Rencontrer 10 espèces différentes.',
      value: s.species,
      target: 10,
      icon: 'binoculars',
    },
    {
      id: 'families',
      title: 'Toute une diversité',
      description: 'Explorer 3 groupes d’animaux.',
      value: s.groups,
      target: 3,
      icon: 'tree',
    },
    {
      id: 'photos',
      title: 'Instants sauvages',
      description: 'Conserver 10 photos personnelles.',
      value: s.photos,
      target: 10,
      icon: 'camera',
    },
    {
      id: 'stories',
      title: 'Les mots du vivant',
      description: 'Raconter 5 rencontres en quelques mots.',
      value: s.notes,
      target: 5,
      icon: 'book',
    },
    {
      id: 'days',
      title: 'Au fil des jours',
      description: 'Observer sur 7 jours différents, à votre rythme.',
      value: s.days,
      target: 7,
      icon: 'sun',
    },
    {
      id: 'regions',
      title: 'Nouveaux horizons',
      description: 'Découvrir la faune de 3 régions.',
      value: s.regions,
      target: 3,
      icon: 'compass',
    },
  ].map((item) => ({
    ...item,
    unlocked: item.value >= item.target,
    percent: Math.min(100, Math.round((item.value / item.target) * 100)),
  }))
}

export function activityWeeks(observations: Observation[], today = new Date()) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const first = new Date(end)
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7) - 7 * 11)
  const counts = new Map<string, number>()
  observations.forEach((item) => counts.set(item.date, (counts.get(item.date) || 0) + 1))
  return Array.from({ length: 84 }, (_, index) => {
    const date = new Date(first)
    date.setDate(first.getDate() + index)
    const day = localDay(date)
    return { day, count: counts.get(day) || 0, future: day > localDay(end) }
  })
}
