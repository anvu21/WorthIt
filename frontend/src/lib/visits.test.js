import { describe, expect, it } from 'vitest'
import { decodeSyncCode, encodeSyncCode, mergeVisits, needsBackup, parseImport } from './visits'

describe('sync code', () => {
  it('round-trips ids and dates', () => {
    const visits = { abc123: { date: '2024-03-09', note: '' }, zz9x0q: { date: null, note: '' } }
    const code = encodeSyncCode(visits)
    expect(code.startsWith('WI1.')).toBe(true)
    expect(decodeSyncCode(code)).toEqual(visits)
  })

  it('stays short enough to text', () => {
    const visits = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`id${String(i).padStart(4, '0')}`, { date: '2025-06-01', note: '' }]))
    expect(encodeSyncCode(visits).length).toBeLessThan(600)
  })

  it('rejects junk', () => {
    expect(() => decodeSyncCode('hello')).toThrow()
    expect(() => decodeSyncCode('WI1.ab$c')).toThrow()
  })
})

describe('parseImport', () => {
  it('reads exported files and drops malformed entries', () => {
    const text = JSON.stringify({ visits: { abc123: { date: '2024-01-02', note: 'great' }, 'BAD ID': {}, def456: { date: 'nope' } } })
    expect(parseImport(text)).toEqual({ abc123: { date: '2024-01-02', note: 'great' }, def456: { date: null, note: '' } })
  })

  it('explains bad input', () => {
    expect(() => parseImport('{"foo": 1}')).toThrow(/not a Worth It/)
    expect(() => parseImport('???')).toThrow(/Could not read/)
  })
})

describe('mergeVisits', () => {
  it('unions and keeps the earliest date and existing notes', () => {
    const mine = { a: { date: '2024-05-01', note: 'mine' }, b: { date: null, note: '' } }
    const theirs = { a: { date: '2023-01-01', note: 'theirs' }, c: { date: '2022-02-02', note: '' } }
    expect(mergeVisits(mine, theirs)).toEqual({
      a: { date: '2023-01-01', note: 'mine' },
      b: { date: null, note: '' },
      c: { date: '2022-02-02', note: '' },
    })
  })
})

describe('needsBackup', () => {
  const five = Object.fromEntries('abcde'.split('').map((k) => [k, { date: null, note: '' }]))
  it('nudges after 5 visits without a recent backup', () => {
    expect(needsBackup({ a: {} }, null)).toBe(false)
    expect(needsBackup(five, null)).toBe(true)
    expect(needsBackup(five, new Date().toISOString())).toBe(false)
  })
})
