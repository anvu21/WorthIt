// Visitor checklist, stored only in this browser. See CLAUDE.md → "Visitor state".
import { useCallback, useEffect, useState } from 'react'

export const STORAGE_KEY = 'worthit.visits.v1'
const SYNC_PREFIX = 'WI1.'
const EPOCH = Date.UTC(2016, 0, 1) // show premiered 2016; dates encode as days since then
const DAY_MS = 86_400_000
const ID_RE = /^[0-9a-z]{1,12}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function emptyState() {
  return { v: 1, visits: {}, lastBackup: null }
}

export function today() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return parsed?.v === 1 ? { ...emptyState(), ...parsed, visits: sanitizeVisits(parsed.visits) } : emptyState()
  } catch {
    return emptyState()
  }
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Private mode / storage disabled: the checklist still works for this session.
  }
}

function sanitizeVisits(visits) {
  const clean = {}
  if (!visits || typeof visits !== 'object') return clean
  for (const [id, value] of Object.entries(visits)) {
    if (!ID_RE.test(id)) continue
    const date = typeof value?.date === 'string' && DATE_RE.test(value.date) ? value.date : null
    const note = typeof value?.note === 'string' ? value.note.slice(0, 500) : ''
    clean[id] = { date, note }
  }
  return clean
}

// ---------------------------------------------------------------- sync code

export function encodeSyncCode(visits) {
  const tokens = Object.entries(visits)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, { date }]) => {
      if (!date) return id
      const days = Math.round((Date.parse(`${date}T00:00:00Z`) - EPOCH) / DAY_MS)
      return days >= 0 ? `${id}-${days.toString(36)}` : id
    })
  return SYNC_PREFIX + tokens.join('.')
}

export function decodeSyncCode(code) {
  const text = code.trim()
  if (!text.startsWith(SYNC_PREFIX)) throw new Error('That is not a Worth It sync code (it should start with WI1.)')
  const visits = {}
  for (const token of text.slice(SYNC_PREFIX.length).split('.').filter(Boolean)) {
    const [id, days] = token.split('-')
    if (!ID_RE.test(id) || (days !== undefined && !/^[0-9a-z]+$/.test(days))) {
      throw new Error(`The sync code looks damaged near “${token}”.`)
    }
    const date = days === undefined ? null : new Date(EPOCH + parseInt(days, 36) * DAY_MS).toISOString().slice(0, 10)
    visits[id] = { date, note: '' }
  }
  return visits
}

/** Accepts a sync code or the contents of an exported .json file. */
export function parseImport(text) {
  const trimmed = text.trim()
  if (trimmed.startsWith(SYNC_PREFIX)) return decodeSyncCode(trimmed)
  let parsed
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error('Could not read that — paste a sync code or choose an exported .json file.')
  }
  if (!parsed || typeof parsed.visits !== 'object') throw new Error('That file is not a Worth It checklist export.')
  return sanitizeVisits(parsed.visits)
}

export function mergeVisits(current, incoming) {
  const merged = { ...current }
  for (const [id, visit] of Object.entries(incoming)) {
    const mine = merged[id]
    if (!mine) {
      merged[id] = visit
      continue
    }
    const dates = [mine.date, visit.date].filter(Boolean).sort()
    merged[id] = { date: dates[0] ?? null, note: mine.note || visit.note || '' }
  }
  return merged
}

export function exportPayload(state) {
  return { app: 'worthit-food-map', exportedAt: new Date().toISOString(), v: 1, visits: state.visits }
}

// ---------------------------------------------------------------- hook

export function useVisits() {
  const [state, setState] = useState(load)

  const update = useCallback((fn) => {
    setState((prev) => {
      const next = fn(prev)
      save(next)
      return next
    })
  }, [])

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e) => e.key === STORAGE_KEY && setState(load())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggle = useCallback(
    (id) =>
      update((prev) => {
        const visits = { ...prev.visits }
        if (visits[id]) delete visits[id]
        else visits[id] = { date: today(), note: '' }
        return { ...prev, visits }
      }),
    [update],
  )

  const setVisit = useCallback(
    (id, patch) =>
      update((prev) => ({ ...prev, visits: { ...prev.visits, [id]: { ...prev.visits[id], ...patch } } })),
    [update],
  )

  const importVisits = useCallback(
    (incoming, mode = 'merge') =>
      update((prev) => ({ ...prev, visits: mode === 'replace' ? incoming : mergeVisits(prev.visits, incoming) })),
    [update],
  )

  const markBackedUp = useCallback(() => update((prev) => ({ ...prev, lastBackup: new Date().toISOString() })), [update])

  return { visits: state.visits, lastBackup: state.lastBackup, toggle, setVisit, importVisits, markBackedUp }
}

export function needsBackup(visits, lastBackup) {
  if (Object.keys(visits).length < 5) return false
  return !lastBackup || Date.now() - Date.parse(lastBackup) > 14 * DAY_MS
}
