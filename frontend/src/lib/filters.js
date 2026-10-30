// Client-side filtering. The whole dataset is ~250 rows, so this runs on every keystroke.

export const TIERS = [
  { key: '$', label: '$', title: 'Cheapest of the three', color: '#16a34a' },
  { key: '$$', label: '$$', title: 'Middle price point', color: '#d97706' },
  { key: '$$$', label: '$$$', title: 'Most expensive', color: '#e11d48' },
  { key: 'side', label: 'Side trip', title: 'Side trips between the main stops', color: '#7c3aed' },
  { key: 'special', label: 'Specials', title: 'One Stop & Holiday Special episodes', color: '#0284c7' },
]

export const TIER_COLOR = Object.fromEntries(TIERS.map((t) => [t.key, t.color]))

export const DEFAULT_FILTERS = {
  q: '',
  tiers: [],
  visited: 'all', // all | yes | no
  country: '',
  city: '',
  season: '',
  hideClosed: true,
  hideChains: false,
}

/** Pin colour: the priciest $-tier a place appeared at, else side trip / special. */
export function primaryTier(r) {
  return ['$$$', '$$', '$'].find((t) => r.tiers.includes(t)) || r.tiers[0] || 'special'
}

function haystack(r) {
  return [r.name, r.address, r.city, r.country, ...r.appearances.map((a) => a.title), ...r.items.map((i) => i.name)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

const haystacks = new WeakMap()

export function applyFilters(restaurants, f, visits) {
  const terms = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return restaurants.filter((r) => {
    if (f.hideClosed && r.closed) return false
    if (f.hideChains && r.chain) return false
    if (f.tiers.length && !r.tiers.some((t) => f.tiers.includes(t))) return false
    if (f.visited === 'yes' && !visits[r.id]) return false
    if (f.visited === 'no' && visits[r.id]) return false
    if (f.country && r.country !== f.country) return false
    if (f.city && r.city !== f.city) return false
    if (f.season && !r.appearances.some((a) => a.season === f.season)) return false
    if (terms.length) {
      if (!haystacks.has(r)) haystacks.set(r, haystack(r))
      const text = haystacks.get(r)
      if (!terms.every((t) => text.includes(t))) return false
    }
    return true
  })
}

function countBy(values) {
  const counts = new Map()
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export function filterOptions(restaurants, country) {
  const seasons = [...new Set(restaurants.flatMap((r) => r.appearances.map((a) => a.season)).filter(Boolean))]
  seasons.sort((a, b) => {
    const [na, nb] = [Number(a), Number(b)]
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
    if (!Number.isNaN(na)) return -1
    if (!Number.isNaN(nb)) return 1
    return a.localeCompare(b)
  })
  return {
    countries: countBy(restaurants.map((r) => r.country)),
    cities: countBy(restaurants.filter((r) => !country || r.country === country).map((r) => r.city)),
    seasons,
  }
}

export function activeFilterCount(f) {
  return (
    (f.q ? 1 : 0) +
    (f.tiers.length ? 1 : 0) +
    (f.visited !== 'all' ? 1 : 0) +
    (f.country ? 1 : 0) +
    (f.city ? 1 : 0) +
    (f.season ? 1 : 0) +
    (f.hideClosed ? 0 : 1) +
    (f.hideChains ? 1 : 0)
  )
}

export function seasonLabel(season) {
  return /^\d+$/.test(season) ? `Season ${season}` : season
}

export function mapsUrl(r) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name}, ${r.address}`)}`
}

export function formatCost(cost) {
  if (cost == null) return null
  return `$${cost % 1 ? cost.toFixed(2) : cost.toLocaleString()}`
}
