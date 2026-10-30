import { useCallback, useEffect, useMemo, useState } from 'react'
import DataMenu from './components/DataMenu'
import Filters from './components/Filters'
import MapView from './components/MapView'
import PlaceCard from './components/PlaceCard'
import PlaceList from './components/PlaceList'
import { DEFAULT_FILTERS, applyFilters, filterOptions } from './lib/filters'
import { needsBackup, useVisits } from './lib/visits'

const FILTERS_KEY = 'worthit.filters.v1'

function loadFilters() {
  try {
    return { ...DEFAULT_FILTERS, ...JSON.parse(localStorage.getItem(FILTERS_KEY)) }
  } catch {
    return DEFAULT_FILTERS
  }
}

function hashPlace() {
  return new URLSearchParams(window.location.hash.slice(1)).get('p')
}

export default function App() {
  const [restaurants, setRestaurants] = useState(null)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(loadFilters)
  const [selectedId, setSelectedId] = useState(hashPlace)
  const [showData, setShowData] = useState(false)
  const [mobileView, setMobileView] = useState('map') // map | list (phones only)
  const { visits, lastBackup, toggle, setVisit, importVisits, markBackedUp } = useVisits()

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/restaurants.json`, { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => setRestaurants([...data.restaurants].sort((a, b) => a.name.localeCompare(b.name))))
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify({ ...filters, q: '' }))
    } catch {
      /* storage unavailable */
    }
  }, [filters])

  // #p=<id> makes a place shareable and survives reloads.
  useEffect(() => {
    const onHash = () => setSelectedId(hashPlace())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const select = useCallback((id) => {
    setSelectedId(id)
    history.replaceState(null, '', id ? `#p=${id}` : window.location.pathname + window.location.search)
  }, [])

  const places = useMemo(() => (restaurants ? applyFilters(restaurants, filters, visits) : []), [restaurants, filters, visits])
  const options = useMemo(() => filterOptions(restaurants || [], filters.country), [restaurants, filters.country])
  const knownIds = useMemo(() => new Set((restaurants || []).map((r) => r.id)), [restaurants])
  const selected = restaurants?.find((r) => r.id === selectedId)
  // Refit the map only when the filters change (not when visits change the result set).
  const fitKey = useMemo(() => JSON.stringify({ ...filters, visited: filters.visited === 'all' ? 0 : filters.visited }), [filters])

  const total = restaurants?.filter((r) => !r.closed).length ?? 0
  const visitedCount = restaurants?.filter((r) => visits[r.id] && !r.closed).length ?? 0
  const visitedClosed = restaurants?.filter((r) => visits[r.id] && r.closed).length ?? 0

  if (error) {
    return <div className="flex h-full items-center justify-center p-6 text-center text-stone-600">Couldn’t load the restaurant list ({error}). Try refreshing.</div>
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside
        className={`${mobileView === 'list' || selected ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col border-stone-200 bg-paper md:flex md:w-[400px] md:flex-none md:border-r`}
      >
        <header className="space-y-3 border-b border-stone-200 px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="font-display text-3xl leading-none text-ink">Worth It Food Map</h1>
              <p className="mt-1 text-xs text-stone-500">Every stop from BuzzFeed’s Worth It. Check off the ones you’ve eaten at.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowData(true)}
              className="shrink-0 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium hover:border-ink"
            >
              Backup / sync
            </button>
          </div>
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span>
                <b className="text-lg tabular-nums">{visitedCount}</b> <span className="text-stone-500">/ {total} open places visited</span>
              </span>
              {visitedClosed > 0 && <span className="text-xs text-stone-400">+{visitedClosed} closed</span>}
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-200">
              <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${total ? (visitedCount / total) * 100 : 0}%` }} />
            </div>
          </div>
          {needsBackup(visits, lastBackup) && (
            <button
              type="button"
              onClick={() => setShowData(true)}
              className="w-full rounded-lg bg-amber-100 px-3 py-2 text-left text-xs text-amber-900"
            >
              <b>Back up your checklist.</b> It lives only in this browser, and some browsers clear it after a week away.
            </button>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {selected ? (
            <PlaceCard
              place={selected}
              visit={visits[selected.id]}
              onToggle={() => toggle(selected.id)}
              onChangeVisit={(patch) => setVisit(selected.id, patch)}
              onClose={() => select(null)}
            />
          ) : (
            <div className="space-y-3">
              <Filters filters={filters} setFilters={setFilters} options={options} />
              <p className="text-xs text-stone-500">
                {restaurants ? `Showing ${places.length} of ${restaurants.length} places` : 'Loading…'}
              </p>
              <PlaceList places={places} visits={visits} onToggle={toggle} onSelect={select} selectedId={selectedId} />
            </div>
          )}
        </div>
      </aside>

      <main className={`${mobileView === 'map' && !selected ? 'block' : 'hidden'} relative min-h-0 flex-1 md:block`}>
        {restaurants && <MapView places={places} visits={visits} selectedId={selectedId} onSelect={select} fitKey={fitKey} />}
      </main>

      <nav className="flex border-t border-stone-200 bg-paper md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[
          ['map', 'Map'],
          ['list', `List (${places.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              select(null)
              setMobileView(key)
            }}
            className={`flex-1 py-3 text-sm font-medium ${mobileView === key && !selected ? 'text-ink' : 'text-stone-400'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {showData && (
        <DataMenu visits={visits} knownIds={knownIds} onImport={importVisits} onBackedUp={markBackedUp} onClose={() => setShowData(false)} />
      )}
    </div>
  )
}
