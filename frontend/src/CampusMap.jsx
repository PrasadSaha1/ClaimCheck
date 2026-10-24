import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const CENTER = [40.9126, -73.1232]

export default function CampusMap({ value, onChange, radius = 0 }) {
  const root = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const circleRef = useRef(null)

  useEffect(() => {
    if (mapRef.current) return
    const map = L.map(root.current, { zoomControl: true }).setView(CENTER, 15)
    mapRef.current = map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    map.on('click', (event) => {
      const { lat, lng } = event.latlng
      if (lat >= 40.86 && lat <= 40.94 && lng >= -73.15 && lng <= -73.06) {
        onChange({ latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) })
      }
    })
    setTimeout(() => map.invalidateSize(), 0)
    return () => { map.remove(); mapRef.current = null }
  }, [onChange])

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
  }, [value, radius])

  return <div className="map-wrap">
    <div ref={root} className="campus-map" role="application" aria-label="Stony Brook campus map" />
    <span className="map-hint">Tap the map to {radius ? 'center your lost area' : 'pin where you found it'}</span>
  </div>
}
