import { useRef, useState } from 'react'
import { encodeSyncCode, exportPayload, parseImport } from '../lib/visits'

export default function DataMenu({ visits, onImport, onBackedUp, onClose, knownIds }) {
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(null) // visits parsed from a file/code, awaiting merge/replace
  const [message, setMessage] = useState(null)
  const fileRef = useRef(null)
  const count = Object.keys(visits).length
  const syncCode = encodeSyncCode(visits)

  const download = () => {
    const blob = new Blob([JSON.stringify(exportPayload({ visits }), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `worthit-checklist-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    onBackedUp()
    setMessage({ ok: true, text: 'Checklist downloaded.' })
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(syncCode)
      onBackedUp()
      setMessage({ ok: true, text: 'Sync code copied — paste it on your other device.' })
    } catch {
      setMessage({ ok: false, text: 'Could not copy automatically; select the code and copy it.' })
    }
  }

  const stage = (text) => {
    try {
      const incoming = parseImport(text)
      const n = Object.keys(incoming).length
      const unknown = Object.keys(incoming).filter((id) => !knownIds.has(id)).length
      setPending({ incoming, n, unknown })
      setMessage(null)
    } catch (err) {
      setPending(null)
      setMessage({ ok: false, text: err.message })
    }
  }

  const apply = (mode) => {
    onImport(pending.incoming, mode)
    setMessage({ ok: true, text: `Imported ${pending.n} place${pending.n === 1 ? '' : 's'} (${mode}).` })
    setPending(null)
    setCode('')
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Back up or sync your checklist"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-paper p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl">Your checklist</h2>
          <button type="button" onClick={onClose} className="rounded-full px-2 text-2xl leading-none text-stone-500 hover:text-ink" aria-label="Close">
            ×
          </button>
        </div>
        <p className="mb-4 text-sm text-stone-600">
          Your {count} visited place{count === 1 ? ' is' : 's are'} saved only in this browser. Back them up, or move them to another
          device, with a file or a sync code.
        </p>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Save</h3>
          <div className="flex gap-2">
            <button type="button" onClick={download} disabled={!count} className="flex-1 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-40">
              Download file
            </button>
            <button type="button" onClick={copy} disabled={!count} className="flex-1 rounded-lg border border-ink px-3 py-2 text-sm font-medium disabled:opacity-40">
              Copy sync code
            </button>
          </div>
          {count > 0 && (
            <textarea readOnly value={syncCode} rows={2} onFocus={(e) => e.target.select()} className="w-full resize-none rounded-lg border border-stone-200 bg-white p-2 font-mono text-[11px] text-stone-600" />
          )}
        </section>

        <section className="mt-5 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Load</h3>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste a sync code (WI1.…)"
            rows={2}
            className="w-full resize-none rounded-lg border border-stone-300 bg-white p-2 font-mono text-xs focus:border-ink focus:outline-none"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => stage(code)} disabled={!code.trim()} className="flex-1 rounded-lg border border-ink px-3 py-2 text-sm font-medium disabled:opacity-40">
              Read code
            </button>
            <button type="button" onClick={() => fileRef.current.click()} className="flex-1 rounded-lg border border-ink px-3 py-2 text-sm font-medium">
              Choose file…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) stage(await file.text())
                e.target.value = ''
              }}
            />
          </div>
        </section>

        {pending && (
          <div className="mt-4 rounded-xl border border-ink bg-white p-3 text-sm">
            <p>
              Found <b>{pending.n}</b> visited place{pending.n === 1 ? '' : 's'}.
              {pending.unknown > 0 && ` ${pending.unknown} aren't on the current map (kept anyway).`}
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => apply('merge')} className="flex-1 rounded-lg bg-ink px-3 py-2 font-medium text-white">
                Merge with mine
              </button>
              <button type="button" onClick={() => apply('replace')} className="flex-1 rounded-lg border border-rose-600 px-3 py-2 font-medium text-rose-700">
                Replace mine
              </button>
            </div>
          </div>
        )}

        {message && <p className={`mt-3 text-sm ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{message.text}</p>}
      </div>
    </div>
  )
}
