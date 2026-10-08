"use client";
import { useEffect, useRef, useState } from "react";
import type { Observation } from "@/lib/types";
import { MapPin, ShieldCheck } from "lucide-react";
import "leaflet/dist/leaflet.css";
export default function ObservationMap({
  observations,
  onSelect,
}: {
  observations: Observation[];
  onSelect: (o: Observation) => void;
}) {
  const el = useRef<HTMLDivElement>(null),
    map = useRef<any>(null);
  const [error, setError] = useState(false);
  const points = observations.filter(
    (o) => !o.sensitive && o.lat !== null && o.lng !== null,
  );
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    import("leaflet")
      .then((L) => {
        if (!el.current || disposed) return;
        const m = L.map(el.current, {
          scrollWheelZoom: false,
          zoomControl: false,
        }).setView([46, 3], 5);
        map.current = m;
        L.control
          .zoom({ zoomInTitle: "Zoomer", zoomOutTitle: "Dézoomer" })
          .addTo(m);
        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 9,
            minZoom: 2,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
          },
        ).addTo(m);
        tiles.on("tileerror", () => setError(true));
        tiles.on("load", () => setError(false));
        const bounds: L.LatLngTuple[] = [];
        points.forEach((o) => {
          const ll: L.LatLngTuple = [o.lat!, o.lng!];
          bounds.push(ll);
          const marker = L.marker(ll, {
            title: o.species.name,
            alt: o.species.name,
            icon: L.divIcon({
              className: "faune-map-marker",
              html: "<span></span>",
              iconSize: [30, 30],
              iconAnchor: [15, 15],
            }),
          });
          marker.addTo(m).on("click", () => onSelect(o));
          const title = document.createElement("span");
          title.textContent = o.species.name;
          marker.bindTooltip(title);
        });
        if (bounds.length)
          m.fitBounds(L.latLngBounds(bounds).pad(0.5), { maxZoom: 6 });
        observer = new ResizeObserver(() => m.invalidateSize());
        observer.observe(el.current);
      })
      .catch(() => setError(true));
    return () => {
      disposed = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, [observations]);
  return (
    <div className="map-layout">
      <div className="map-pane">
        <div
          ref={el}
          className="map-canvas"
          aria-label="Carte des zones approximatives d’observation"
        />
        {error && (
          <div className="map-error">
            Le fond de carte ne se charge pas. Vos observations restent
            accessibles dans la liste.
          </div>
        )}
        <div className="map-privacy">
          <ShieldCheck size={18} /> Zones approximatives · aucune position
          précise
        </div>
      </div>
      <div className="map-list">
        <p className="eyebrow">{points.length} rencontres localisées</p>
        {observations.length === 0 && (
          <p>
            Ajoutez une localisation facultative à vos rencontres pour les
            retrouver ici.
          </p>
        )}
        {observations.map((o) => (
          <button key={o.id} onClick={() => onSelect(o)}>
            <img src={o.photos[0]} alt="" />
            <span>
              <strong>{o.species.name}</strong>
              <small>
                <MapPin size={12} />
                {o.sensitive
                  ? "Localisation protégée"
                  : o.region || "Sans localisation"}
              </small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
