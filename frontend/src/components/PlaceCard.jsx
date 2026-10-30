import { formatCost, mapsUrl, seasonLabel } from '../lib/filters'
import { TierBadges, VisitCheckbox } from './PlaceList'

function youtubeId(url) {
  const match = url?.match(/(?:v=|youtu\.be\/)([\w-]{11})/)
  return match?.[1]
}

export default function PlaceCard({ place, visit, onToggle, onChangeVisit, onClose }) {
  const visited = Boolean(visit)
  return (
    <article className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight text-ink">{place.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <TierBadges tiers={place.tiers} />
            {place.closed && <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[11px] text-stone-600">Permanently closed</span>}
            {place.chain && <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[11px] text-stone-600">Chain</span>}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-stone-500 hover:bg-stone-200 hover:text-ink">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      <div className={`rounded-xl border p-3 ${visited ? 'border-ink bg-white' : 'border-dashed border-stone-300'}`}>
        <label className="flex cursor-pointer items-center gap-3">
          <VisitCheckbox checked={visited} onChange={onToggle} name={place.name} />
          <span className="font-medium">{visited ? 'Been there' : 'Mark as visited'}</span>
          {visited && (
            <input
              type="date"
              value={visit.date || ''}
              onChange={(e) => onChangeVisit({ date: e.target.value || null })}
              onClick={(e) => e.stopPropagation()}
              className="ml-auto rounded-md border border-stone-300 px-2 py-0.5 text-sm"
            />
          )}
        </label>
        {visited && (
          <textarea
            value={visit.note || ''}
            onChange={(e) => onChangeVisit({ note: e.target.value })}
            placeholder="Your notes — was it worth it?"
            rows={2}
            maxLength={500}
            className="mt-2 w-full resize-none rounded-lg border border-stone-200 bg-paper px-2 py-1.5 text-sm focus:border-ink focus:outline-none"
          />
        )}
      </div>

      <div className="space-y-1 text-sm">
        <p className="text-stone-700">{place.address}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <a className="font-medium text-ink underline underline-offset-2" href={mapsUrl(place)} target="_blank" rel="noreferrer">
            Directions ↗
          </a>
          {place.website && (
            <a className="font-medium text-ink underline underline-offset-2" href={place.website} target="_blank" rel="noreferrer">
              Website ↗
            </a>
          )}
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          {place.appearances.length > 1 ? `Featured in ${place.appearances.length} episodes` : 'Featured in'}
        </h3>
        <ul className="space-y-2">
          {place.appearances.map((a, i) => {
            const vid = youtubeId(a.video)
            return (
              <li key={i}>
                <a
                  href={a.video || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex gap-3 rounded-lg p-1 hover:bg-white"
                >
                  {vid && (
                    <img
                      src={`https://i.ytimg.com/vi/${vid}/mqdefault.jpg`}
                      alt=""
                      loading="lazy"
                      className="h-14 w-24 shrink-0 rounded-md object-cover"
                    />
                  )}
                  <div className="min-w-0 text-sm">
                    <div className="font-medium leading-snug text-ink group-hover:underline">{a.title || 'Side trip'}</div>
                    <div className="text-xs text-stone-500">
                      {[a.season && seasonLabel(a.season), a.episode && `Ep ${a.episode}`, a.published?.slice(0, 4)]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                </a>
              </li>
            )
          })}
        </ul>
      </section>

      {place.items.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">What they ordered</h3>
          <ul className="space-y-1 text-sm">
            {place.items.map((item, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className="text-ink">{item.name}</span>
                {item.voters.length > 0 && (
                  <span className="text-xs text-amber-700" title="Picked as most worth it">
                    ★ {item.voters.join(', ')}
                  </span>
                )}
                <span className="ml-auto shrink-0 tabular-nums text-stone-500">{formatCost(item.cost)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {place.notes && <p className="rounded-lg bg-stone-100 p-2 text-xs text-stone-600">{place.notes}</p>}
    </article>
  )
}
