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
}

/**
 * Split one CSV/TSV line, honouring double quotes: a quoted field may contain
 * the delimiter, and `""` escapes a literal quote. (W6 — the old naive split
 * broke on the documented example value `a happy "accident", really`.)
 */
function splitRow(line: string): string[] {
  const delim = line.includes('\t') ? '\t' : ','
  const out: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ } else { quoted = false }
      } else {
        field += ch
      }
    } else if (ch === '"' && field === '') {
      quoted = true
    } else if (ch === delim) {
      out.push(field)
      field = ''
    } else {
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
}

/** A row is the header when its first cell is "word" and a later cell is a known column name. */
function isHeaderRow(parts: string[]): boolean {
  if ((parts[0] ?? '').trim().toLowerCase() !== 'word') return false
  return parts.slice(1).some((p) => p.trim().toLowerCase() in COLUMN_ALIASES)
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
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim())
  const out: ParsedWord[] = []
  let colMap: Record<number, keyof ParsedWord> | null = null

  for (const line of lines) {
    const parts = splitRow(line)
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
      })
    }
  }
  return out
}

export const CSV_FORMAT_HINT =
  'word, pos, definition, example, ipa, cefr, synonyms, antonyms, amharic'

export const CSV_PLACEHOLDER =
  'serendipity, noun, a happy accident, Finding that old letter was pure serendipity., /ˌsɛrənˈdɪpɪti/, C1, luck | fortune, misfortune, ድንገተኛ ደስታ'
