import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ArrowUpRight, CalendarDays, MapPin, ShieldCheck } from 'lucide-react'
import { regions } from '../data'
import { observationSpecies } from '../lib'
import type { Observation, Region } from '../types'

interface MapViewProps {
  observations: Observation[]
  onSelectObservation: (observation: Observation) => void
}

interface RegionGroup {
  region: Region
  observations: Observation[]
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`)
  return Number.isNaN(parsed.getTime())
    ? 'Date non renseignée'
    : parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MapView({ observations, onSelectObservation }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [tileFailed, setTileFailed] = useState(false)

  const { groups, withoutRegion } = useMemo(() => {
    const regionById = new Map(regions.map((region) => [region.id, region]))
    const byRegion = new Map<string, RegionGroup>()
    const unlocated: Observation[] = []
    for (const observation of observations) {
      const region = observation.regionId ? regionById.get(observation.regionId) : undefined
      if (!region) {
        unlocated.push(observation)
        continue
      }
      if (!byRegion.has(region.id)) byRegion.set(region.id, { region, observations: [] })
      byRegion.get(region.id)!.observations.push(observation)
    }
    return {
      groups: [...byRegion.values()].sort(
        (left, right) =>
          right.observations.length - left.observations.length ||
          left.region.name.localeCompare(right.region.name, 'fr'),
      ),
      withoutRegion: unlocated,
    }
  }, [observations])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { scrollWheelZoom: false, minZoom: 2, maxZoom: 8 }).setView(
      [18, 7],
      2,
    )
    mapRef.current = map
    markerLayerRef.current = L.layerGroup().addTo(map)
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)
    tiles.on('tileerror', () => setTileFailed(true))
    tiles.on('tileload', () => setTileFailed(false))
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      markerLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = markerLayerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    for (const group of groups) {
      const marker = L.marker([group.region.latitude, group.region.longitude], {
        icon: L.divIcon({
          className: 'region-map-marker',
          html: `<span>${group.observations.length}</span>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        }),
        title: `${group.region.name} · centre approximatif de la région · ${group.observations.length} observation${group.observations.length > 1 ? 's' : ''}`,
        keyboard: true,
      })
      const tooltip = document.createElement('span')
      tooltip.textContent = `${group.region.name} — centre approximatif de la région`
      marker.bindTooltip(tooltip)
      marker.on('click', () => setSelectedRegionId(group.region.id))
      marker.addTo(layer)
    }
    if (groups.length === 1) map.setView([groups[0].region.latitude, groups[0].region.longitude], 4)
    else if (groups.length > 1)
      map.fitBounds(
        L.latLngBounds(
          groups.map((group) => [group.region.latitude, group.region.longitude] as [number, number]),
        ),
        { padding: [45, 45], maxZoom: 4 },
      )
    else map.setView([18, 7], 2)
    return () => {
      layer.clearLayers()
    }
  }, [groups])

  const selectedGroup = groups.find((group) => group.region.id === selectedRegionId)
  const showUnlocated =
    (selectedRegionId === '__unlocated' && withoutRegion.length > 0) ||
    (!groups.length && withoutRegion.length > 0)
  const visibleObservations = showUnlocated
    ? withoutRegion
    : ((selectedGroup ?? groups[0])?.observations ?? [])
  const effectiveRegionId = showUnlocated ? '__unlocated' : (selectedGroup ?? groups[0])?.region.id
  const selectedName = showUnlocated ? 'Sans région renseignée' : (selectedGroup ?? groups[0])?.region.name

  return (
    <section className="map-view">
      <div className="map-notice">
        <ShieldCheck size={20} aria-hidden="true" />
        <p>
          <strong>Une carte qui protège le vivant.</strong> Les points indiquent le centre approximatif des
          régions, jamais le lieu exact d’une rencontre. Le fond de carte provient d’OpenStreetMap.
        </p>
      </div>
      <div className="map-layout">
        <div className="map-panel">
          <div
            ref={containerRef}
            className="map-canvas"
            aria-label="Carte des observations regroupées par centre approximatif de région"
          />
          <div className="map-caption">
            <MapPin size={14} aria-hidden="true" />
            <span>
              {groups.length} région{groups.length > 1 ? 's' : ''} · positions approximatives
            </span>
          </div>
          {tileFailed && (
            <p className="map-tile-error" role="status">
              Le fond de carte est momentanément indisponible. Vos observations restent accessibles dans la
              liste.
            </p>
          )}
        </div>
        <aside className="map-sidebar" aria-label="Observations par région">
          <div className="map-sidebar-heading">
            <h3>Vos horizons</h3>
            <span>
              {observations.length} rencontre{observations.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="map-region-list">
            {groups.map((group) => (
              <button
                type="button"
                key={group.region.id}
                className={`map-region-row ${effectiveRegionId === group.region.id ? 'active' : ''}`}
                aria-pressed={effectiveRegionId === group.region.id}
                onClick={() => {
                  setSelectedRegionId(group.region.id)
                  mapRef.current?.setView([group.region.latitude, group.region.longitude], 4)
                }}
              >
                <MapPin size={16} aria-hidden="true" />
                <span>
                  <strong>{group.region.name}</strong>
                  <small>{group.region.continent} · centre approximatif</small>
                </span>
                <b>{group.observations.length}</b>
              </button>
            ))}
            {withoutRegion.length > 0 && (
              <button
                type="button"
                className={`map-region-row ${showUnlocated ? 'active' : ''}`}
                aria-pressed={showUnlocated}
                onClick={() => setSelectedRegionId('__unlocated')}
              >
                <MapPin size={16} aria-hidden="true" />
                <span>
                  <strong>Sans région renseignée</strong>
                  <small>Ces rencontres restent hors de la carte</small>
                </span>
                <b>{withoutRegion.length}</b>
              </button>
            )}
          </div>
          {selectedName && <h4 className="map-observation-heading">{selectedName}</h4>}
          <div className="map-observation-list">
            {[...visibleObservations]
              .sort((left, right) => right.date.localeCompare(left.date))
              .map((observation) => {
                const item = observationSpecies(observation)
                const photo = observation.photos[0] || item?.cover
                return (
                  <button
                    type="button"
                    className="map-observation-card"
                    key={observation.id}
                    onClick={() => onSelectObservation(observation)}
                  >
                    {photo ? (
                      <img
                        src={photo}
                        alt={item ? `Observation de ${item.name}` : 'Photo de la rencontre'}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.onerror = null
                          event.currentTarget.src = './animal-fallback.svg'
                        }}
                      />
                    ) : (
                      <span className="map-photo-placeholder">
                        <MapPin size={22} />
                      </span>
                    )}
                    <span>
                      <strong>{item?.name ?? 'Espèce à identifier'}</strong>
                      <small>
                        <CalendarDays size={12} aria-hidden="true" />
                        {formatDate(observation.date)}
                      </small>
                    </span>
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </button>
                )
              })}
          </div>
          {observations.length === 0 && (
            <div className="map-empty empty-state">
              <MapPin size={32} aria-hidden="true" />
              <h3>Votre prochaine rencontre commence ici</h3>
              <p>Ajoutez une observation et choisissez une région pour commencer votre carte personnelle.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
