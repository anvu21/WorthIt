import { TIERS, primaryTier } from '../lib/filters'

const TIER_LABEL = Object.fromEntries(TIERS.map((t) => [t.key, t.label]))

export function VisitCheckbox({ checked, onChange, name }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? `Unmark ${name} as visited` : `Mark ${name} as visited`}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-bold transition ${
        checked ? 'border-ink bg-ink text-white' : 'border-stone-300 bg-white text-transparent hover:border-stone-500'
      }`}
    >
      ✓
    </button>
  )
}

export function TierBadges({ tiers }) {
  return tiers.map((t) => (
    <span
      key={t}
      className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-white"
      style={{ background: TIERS.find((x) => x.key === t).color }}
    >
      {TIER_LABEL[t]}
    </span>
  ))
}

export default function PlaceList({ places, visits, onToggle, onSelect, selectedId }) {
  if (!places.length) {
    return <p className="px-1 py-8 text-center text-sm text-stone-500">No places match these filters.</p>
  }
  return (
    <ul className="divide-y divide-stone-200">
      {places.map((p) => {
        const visited = Boolean(visits[p.id])
        return (
          <li key={p.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(p.id)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(p.id)}
              className={`flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 transition hover:bg-white ${
                p.id === selectedId ? 'bg-white ring-1 ring-stone-300' : ''
              }`}
            >
              <VisitCheckbox checked={visited} onChange={() => onToggle(p.id)} name={p.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`truncate font-medium ${visited ? 'text-stone-400 line-through decoration-stone-400' : 'text-ink'}`}
                  >
                    {p.name}
                  </span>
                  {p.closed && <span className="shrink-0 rounded bg-stone-200 px-1.5 text-[11px] text-stone-600">Closed</span>}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500">
                  <TierBadges tiers={p.tiers.length ? p.tiers : [primaryTier(p)]} />
                  <span className="truncate">{[p.city, p.country].filter(Boolean).join(', ')}</span>
                  {p.lat == null && <span title="No map pin yet">· no pin</span>}
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
