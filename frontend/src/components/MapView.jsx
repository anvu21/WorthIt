import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { TIER_COLOR, primaryTier } from '../lib/filters'

// OSM's standard tiles: free, keyless, fine for low-traffic hobby sites (attribution required).
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const iconCache = new Map()
function pinIcon(tier, visited, selected, closed) {
  const key = `${tier}|${visited}|${selected}|${closed}`
  if (!iconCache.has(key)) {
    const size = selected ? 34 : 26
    iconCache.set(
      key,
      L.divIcon({
        className: '',
        html: `<div class="pin${visited ? ' pin-visited' : ''}${closed ? ' pin-closed' : ''}${selected ? ' pin-selected' : ''}" style="--pin:${TIER_COLOR[tier]};width:${size}px;height:${size}px">${visited ? '<span>✓</span>' : closed ? '<span>✕</span>' : ''}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        tooltipAnchor: [0, -size],
      }),
    )
  }
  return iconCache.get(key)
}

function Legend() {
  const swatch = (extra, style, mark = '') => (
    <span className={`pin ${extra}`} style={{ width: 14, height: 14, borderWidth: 1.5, fontSize: 8, ...style }}>
      {mark && <span>{mark}</span>}
    </span>
  )
  return (
    <div className="pointer-events-none absolute bottom-6 left-2 z-[1000] flex flex-col gap-1 rounded-lg bg-white/90 px-2.5 py-2 text-[11px] text-stone-700 shadow">
      <div className="flex items-center gap-2">
        {swatch('', { '--pin': TIER_COLOR['$'] })}
        {swatch('', { '--pin': TIER_COLOR['$$'], marginLeft: -6 })}
        {swatch('', { '--pin': TIER_COLOR['$$$'], marginLeft: -6 })}
        <span>$ · $$ · $$$</span>
      </div>
      <div className="flex items-center gap-2">
        {swatch('pin-visited', { '--pin': TIER_COLOR['$$'] }, '✓')}
        <span>Been there</span>
      </div>
      <div className="flex items-center gap-2">
        {swatch('pin-closed', { '--pin': TIER_COLOR['$$'] }, '✕')}
        <span>Permanently closed</span>
      </div>
    </div>
  )
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
// it is visible. The map fits the results once on load; after that, filtering never
// moves it (use the "Fit results" button). Fit runs first so a selected place wins.
function MapSync({ places, selected }) {
  const map = useMap()
  const [visible, setVisible] = useState(false)
  const fitted = useRef(false)

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
    if (!visible || !places.length || fitted.current) return
    fitted.current = true
    fitResults(map, places, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, visible, places.length])

  useEffect(() => {
    if (visible && selected?.lat != null) {
      map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 15), { duration: 0.8 })
    }
  }, [selected, map, visible])

  return null
}

function fitResults(map, places, animate) {
  map.fitBounds(L.latLngBounds(places.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 13, animate })
}

function FitButton({ places }) {
  const map = useMap()
  return (
    <button
      type="button"
      onClick={() => places.length && fitResults(map, places, true)}
      disabled={!places.length}
      title="Zoom the map to every place that matches your filters"
      className="absolute right-2 top-2 z-[1000] rounded-lg bg-white/95 px-3 py-1.5 text-xs font-medium text-ink shadow hover:bg-white disabled:opacity-40"
    >
      Fit results ({places.length})
    </button>
  )
}

export default function MapView({ places, visits, selectedId, onSelect }) {
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
            icon={pinIcon(primaryTier(p), Boolean(visits[p.id]), p.id === selectedId, p.closed)}
            visited={Boolean(visits[p.id])}
            zIndexOffset={p.id === selectedId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(p.id) }}
          >
            <Tooltip direction="top">{p.closed ? `${p.name} (permanently closed)` : p.name}</Tooltip>
          </Marker>
        ))}
      </MarkerClusterGroup>
      <MapSync places={mapped} selected={selected} />
      <FitButton places={mapped} />
      <Legend />
    </MapContainer>
  )
}
