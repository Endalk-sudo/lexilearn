import { describe, it, expect } from 'vitest'
import { parseCsv } from '@/features/library/lib/csv-parser'

describe('parseCsv', () => {
  it('parses fixed column order without a header', () => {
    const rows = parseCsv('serendipity, noun, a happy accident')
    expect(rows).toEqual([
      { word: 'serendipity', pos: 'noun', definition: 'a happy accident' },
    ])
  })

  it('detects a header row and maps out-of-order columns', () => {
    const rows = parseCsv('word,definition,pos\nserendipity,a happy accident,noun')
    expect(rows).toEqual([
      { word: 'serendipity', pos: 'noun', definition: 'a happy accident' },
    ])
  })

  it('does not swallow a data row for the English word "word"', () => {
    // A header needs 2+ recognised columns; `noun` alone is not enough.
    const rows = parseCsv('word,noun,a thing said')
    expect(rows).toHaveLength(1)
    expect(rows[0].word).toBe('word')
  })

  it('honours quotes containing the delimiter', () => {
    const rows = parseCsv('"serendipity", noun, "a happy ""accident"", really"')
    expect(rows[0].definition).toBe('a happy "accident", really')
  })

  it('uses one delimiter per file (majority wins)', () => {
    const rows = parseCsv('apple\tnoun\ta fruit\npear\tnoun\ta fruit')
    expect(rows).toEqual([
      { word: 'apple', pos: 'noun', definition: 'a fruit' },
      { word: 'pear', pos: 'noun', definition: 'a fruit' },
    ])
  })

  it('skips blank and delimiter-only lines', () => {
    const rows = parseCsv('apple, noun, a fruit\n,,,\n\npear, noun, a fruit')
    expect(rows.map((r) => r.word)).toEqual(['apple', 'pear'])
  })

  it('supports header aliases', () => {
    const rows = parseCsv('word,part of speech,meaning\napple,noun,a fruit')
    expect(rows[0]).toMatchObject({ word: 'apple', pos: 'noun', definition: 'a fruit' })
  })

  it('parses category and tags column', () => {
    const rows = parseCsv('word,definition,category\napple,a fruit,food | health')
    expect(rows[0]).toMatchObject({ word: 'apple', definition: 'a fruit', categories: 'food | health' })
  })
})
