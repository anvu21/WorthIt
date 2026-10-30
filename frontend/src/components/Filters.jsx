import { useState } from 'react'
import { DEFAULT_FILTERS, TIERS, activeFilterCount, seasonLabel } from '../lib/filters'

function Chip({ active, onClick, children, color, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
        active ? 'border-ink bg-ink text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
      }`}
    >
      {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  )
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-stone-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-ink focus:border-ink focus:outline-none"
      >
        {children}
      </select>
    </label>
  )
}

export default function Filters({ filters, setFilters, options }) {
  const [open, setOpen] = useState(false)
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }))
  const toggleTier = (key) =>
    set({ tiers: filters.tiers.includes(key) ? filters.tiers.filter((t) => t !== key) : [...filters.tiers, key] })
  const active = activeFilterCount(filters)

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="search"
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Search places, dishes, episodes…"
          className="w-full rounded-xl border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-ink focus:outline-none"
        />
        <svg className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.45 4.39l3.08 3.08a.75.75 0 11-1.06 1.06l-3.08-3.08A7 7 0 012 9z" clipRule="evenodd" />
        </svg>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TIERS.map((t) => (
          <Chip key={t.key} active={filters.tiers.includes(t.key)} onClick={() => toggleTier(t.key)} color={t.color} title={t.title}>
            {t.label}
          </Chip>
        ))}
      </div>

      <div className="flex items-center gap-1 rounded-xl bg-stone-200/70 p-1 text-sm">
        {[
          ['all', 'All'],
          ['no', 'Not yet'],
          ['yes', 'Been there'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => set({ visited: key })}
            className={`flex-1 rounded-lg px-2 py-1 transition ${filters.visited === key ? 'bg-white font-medium shadow-sm' : 'text-stone-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={() => setOpen((o) => !o)} className="font-medium text-stone-600 hover:text-ink">
          {open ? '▾' : '▸'} More filters
        </button>
        {active > 0 && (
          <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="text-stone-500 underline-offset-2 hover:underline">
            Reset ({active})
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-3 rounded-xl border border-stone-200 bg-white/60 p-3">
          <div className="flex gap-2">
            <Select label="Country" value={filters.country} onChange={(country) => set({ country, city: '' })}>
              <option value="">All countries</option>
              {options.countries.map(([c, n]) => (
                <option key={c} value={c}>
                  {c} ({n})
                </option>
              ))}
            </Select>
            <Select label="City" value={filters.city} onChange={(city) => set({ city })}>
              <option value="">All cities</option>
              {options.cities.map(([c, n]) => (
                <option key={c} value={c}>
                  {c} ({n})
                </option>
              ))}
            </Select>
          </div>
          <Select label="Season" value={filters.season} onChange={(season) => set({ season })}>
            <option value="">All seasons</option>
            {options.seasons.map((s) => (
              <option key={s} value={s}>
                {seasonLabel(s)}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-2 text-sm text-stone-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={filters.hideClosed} onChange={(e) => set({ hideClosed: e.target.checked })} className="accent-ink" />
              Hide permanently closed
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={filters.hideChains} onChange={(e) => set({ hideChains: e.target.checked })} className="accent-ink" />
              Hide chains
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
