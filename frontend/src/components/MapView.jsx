import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { TIER_COLOR, primaryTier } from '../lib/filters'

// OSM's standard tiles: free, keyless, fine for low-traffic hobby sites (attribution required).
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const iconCache = new Map()
function pinIcon(tier, visited, selected) {
  const key = `${tier}|${visited}|${selected}`
  if (!iconCache.has(key)) {
    const size = selected ? 34 : 26
    iconCache.set(
      key,
      L.divIcon({
        className: '',
        html: `<div class="pin${visited ? ' pin-visited' : ''}${selected ? ' pin-selected' : ''}" style="--pin:${TIER_COLOR[tier]};width:${size}px;height:${size}px">${visited ? '<span>✓</span>' : ''}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        tooltipAnchor: [0, -size],
      }),
    )
  }
  return iconCache.get(key)
}

function clusterIcon(cluster) {
  const markers = cluster.getAllChildMarkers()
  const visited = markers.filter((m) => m.options.visited).length
  const size = markers.length < 10 ? 34 : markers.length < 50 ? 40 : 48
  return L.divIcon({
    className: '',
    html: `<div class="cluster" style="width:${size}px;height:${size}px"><span>${markers.length}</span>${visited ? `<small>${visited}✓</small>` : ''}</div>`,
    iconSize: [size, size],
  })
}

// Moves the map to the results and the selected place. The map has zero size while its
// panel is hidden (phone list view), where Leaflet's flyTo throws, so moves wait until
// it is visible. Fit runs first so a selected place wins on load.
function MapSync({ places, fitKey, selected }) {
  const map = useMap()
  const [visible, setVisible] = useState(false)
  const fittedKey = useRef(null)

  useEffect(() => {
    const container = map.getContainer()
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false })
      // The cluster layer only redraws on moveend, and un-hiding the map isn't a move.
      map.fire('moveend')
      setVisible(container.clientWidth > 0 && container.clientHeight > 0)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [map])

  useEffect(() => {
    // Only refit when the filter set changes, not when a pin is toggled visited.
    if (!visible || !places.length || fittedKey.current === fitKey) return
    fittedKey.current = fitKey
    map.fitBounds(L.latLngBounds(places.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 13, animate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map, visible])

  useEffect(() => {
    if (visible && selected?.lat != null) {
      map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 15), { duration: 0.8 })
    }
  }, [selected, map, visible])

  return null
}

export default function MapView({ places, visits, selectedId, onSelect, fitKey }) {
  const mapped = useMemo(() => places.filter((p) => p.lat != null), [places])
  const selected = mapped.find((p) => p.id === selectedId)

  return (
    <MapContainer center={[34.05, -118.25]} zoom={10} minZoom={1} worldCopyJump className="h-full w-full" zoomControl={false}>
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
      <MarkerClusterGroup chunkedLoading maxClusterRadius={45} iconCreateFunction={clusterIcon} showCoverageOnHover={false}>
        {mapped.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={pinIcon(primaryTier(p), Boolean(visits[p.id]), p.id === selectedId)}
            visited={Boolean(visits[p.id])}
            zIndexOffset={p.id === selectedId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(p.id) }}
          >
            <Tooltip direction="top">{p.name}</Tooltip>
          </Marker>
        ))}
      </MarkerClusterGroup>
      <MapSync places={mapped} fitKey={fitKey} selected={selected} />
    </MapContainer>
  )
}
