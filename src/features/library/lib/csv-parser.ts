export type ParsedWord = {
  word: string
  pos?: string
  ipa?: string
  definition?: string
  example?: string
  cefr?: string
  synonyms?: string
  antonyms?: string
  amharic?: string
  /** Raw category names, `|`- or `,`-separated — split by the caller. */
  categories?: string
}

/**
 * Split one CSV/TSV line, honouring double quotes: a quoted field may contain
 * the delimiter, and `""` escapes a literal quote. (W6 — the old naive split
 * broke on the documented example value `a happy "accident", really`.)
 */
function splitRow(line: string, delim: ',' | '\t'): string[] {
  const out: string[] = []
  let field = ''
  let quoted = false
  let fieldHasContent = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ } else { quoted = false }
      } else {
        field += ch
      }
    } else if (ch === '"' && !fieldHasContent) {
      quoted = true
    } else if (ch === delim) {
      out.push(field)
      field = ''
      fieldHasContent = false
    } else {
      // Whitespace-only prefix stays "empty" so ` "a, b"` still opens quoted.
      if (ch !== ' ' && ch !== '\t') fieldHasContent = true
      field += ch
    }
  }
  out.push(field)
  return out
}

/** Canonical column names mapped from common header aliases. */
const COLUMN_ALIASES: Record<string, keyof ParsedWord> = {
  word: 'word',
  pos: 'pos',
  'part of speech': 'pos',
  definition: 'definition',
  meaning: 'definition',
  example: 'example',
  ipa: 'ipa',
  cefr: 'cefr',
  synonyms: 'synonyms',
  antonyms: 'antonyms',
  amharic: 'amharic',
  category: 'categories',
  categories: 'categories',
  tags: 'categories',
}

/** A row is the header when its first cell is "word" and at least two cells are known column names. */
function isHeaderRow(parts: string[]): boolean {
  if ((parts[0] ?? '').trim().toLowerCase() !== 'word') return false
  const known = parts.filter((p) => p.trim().toLowerCase() in COLUMN_ALIASES).length
  return known >= 2
}

/** Build a column-index → field-name map from a header row. Returns null if no recognised columns. */
function mapHeader(parts: string[]): Record<number, keyof ParsedWord> | null {
  const map: Record<number, keyof ParsedWord> = {}
  let recognised = 0
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i].trim().toLowerCase()
    if (key in COLUMN_ALIASES) {
      map[i] = COLUMN_ALIASES[key]
      recognised++
    }
  }
  return recognised > 0 ? map : null
}

export function parseCsv(text: string): ParsedWord[] {
  const rawLines = text.split(/\r?\n/)
  // Detect the delimiter once per file (majority wins) so mixed content
  // cannot flip parsing halfway through the import.
  const sample = rawLines.filter((l) => l.trim()).slice(0, 20)
  const tabHits = sample.filter((l) => l.includes('\t')).length
  const delim: ',' | '\t' = tabHits > sample.length / 2 ? '\t' : ','
  const lines = rawLines.map((l) => l.trim()).filter((l) => l && l.replace(/[,\t;]+/g, ''))
  const out: ParsedWord[] = []
  let colMap: Record<number, keyof ParsedWord> | null = null

  for (const line of lines) {
    const parts = splitRow(line, delim)
    if (parts.length === 0) continue

    // Try to detect a header row — if found, use it for column mapping
    if (isHeaderRow(parts)) {
      colMap = mapHeader(parts)
      continue
    }

    const word = parts[0]?.trim()
    if (!word) continue

    if (colMap) {
      // Map columns by header name
      const entry: ParsedWord = { word }
      for (const [idx, field] of Object.entries(colMap)) {
        if (field === 'word') continue
        const val = parts[Number(idx)]?.trim()
        if (val) entry[field] = val
      }
      out.push(entry)
    } else {
      // No header detected — fall back to fixed column order
      out.push({
        word,
        pos: parts[1]?.trim() || undefined,
        definition: parts[2]?.trim() || undefined,
        example: parts[3]?.trim() || undefined,
        ipa: parts[4]?.trim() || undefined,
        cefr: parts[5]?.trim() || undefined,
        synonyms: parts[6]?.trim() || undefined,
        antonyms: parts[7]?.trim() || undefined,
        amharic: parts[8]?.trim() || undefined,
        categories: parts[9]?.trim() || undefined,
      })
    }
  }
  return out
}

export const CSV_FORMAT_HINT =
  'word, pos, definition, example, ipa, cefr, synonyms, antonyms, amharic, categories'

export const CSV_PLACEHOLDER =
  'serendipity, noun, a happy accident, Finding that old letter was pure serendipity., /ˌsɛrənˈdɪpɪti/, C1, luck | fortune, misfortune, ድንገተኛ ደስታ, favorites | confusing'

/** Split a raw categories cell (`a | b,c`) into clean names. */
export function splitCategoryNames(raw?: string): string[] {
  if (!raw) return []
  return [...new Set(raw.split(/[|,]/).map((s) => s.trim()).filter(Boolean))].slice(0, 20)
}
