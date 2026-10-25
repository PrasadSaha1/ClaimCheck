import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const inside = (site, lat, lng) => {
  const [[latMin, lngMin], [latMax, lngMax]] = site.bounds
  return lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax
}

export { inside }

export default function CampusMap({ site, value, onChange, radius = 0, readOnly = false }) {
  const root = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const circleRef = useRef(null)

  useEffect(() => {
    const map = L.map(root.current, { zoomControl: true }).setView(site.center, site.zoom)
    mapRef.current = map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    if (readOnly && value) map.setView([value.latitude, value.longitude], site.zoom + 1)
    else map.on('click', (event) => {
      const { lat, lng } = event.latlng
      if (inside(site, lat, lng)) {
        onChange({ latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) })
      }
    })
    setTimeout(() => map.invalidateSize(), 0)
    return () => { map.remove(); mapRef.current = null }
  }, [onChange, site, readOnly]) // value only sets the first view of a read-only map

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markerRef.current?.remove()
    circleRef.current?.remove()
    if (!value) return
    const latlng = [value.latitude, value.longitude]
    markerRef.current = L.circleMarker(latlng, {
      radius: 9, color: '#0b4164', fillColor: '#ffb84d', fillOpacity: 1, weight: 3,
    }).addTo(map)
    if (radius) {
      circleRef.current = L.circle(latlng, {
        radius: Number(radius), color: '#1685a1', fillColor: '#66c2d0', fillOpacity: .13,
      }).addTo(map)
    }
  }, [value, radius, site])

  return <div className="map-wrap">
    <div ref={root} className="campus-map" role="application" aria-label={site.name + ' map'} />
    {!readOnly && <span className="map-hint">Tap the map to {radius ? 'center your lost area' : 'pin where you found it'}</span>}
  </div>
}
