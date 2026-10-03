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
  'example sentence': 'example',
  ipa: 'ipa',
  cefr: 'cefr',
  'cefr level': 'cefr',
  synonyms: 'synonyms',
  'contextual meaning': 'synonyms',
  antonyms: 'antonyms',
  amharic: 'amharic',
  category: 'categories',
  categories: 'categories',
  tags: 'categories',
}

/**
 * Fold a raw header cell to its alias lookup key so snake_case, kebab-case and
 * spaced variants all resolve: `Part_Of_Speech` / `part-of-speech` /
 * `Part of Speech` → `part of speech`. The curated CEFR decks in `docs/` ship
 * `Rank,Word,Part_Of_Speech,CEFR_Level,Definition,Example_Sentence,
 * Contextual_Meaning`, which underscored headers miss entirely.
 */
function normalizeHeader(cell: string): string {
  return cell
    .trim()
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A row is the header when it names a `word` column and carries at least two
 * recognised column names. The word column need not be first — a leading `Rank`
 * or `No.` index column is common — but it must be present, otherwise a data row
 * whose values happen to be aliases (`word,noun,a thing said`) would be eaten.
 */
function isHeaderRow(parts: string[]): boolean {
  const known = parts.map(normalizeHeader).filter((p) => p in COLUMN_ALIASES)
  if (known.length < 2) return false
  return known.some((p) => COLUMN_ALIASES[p] === 'word')
}

/**
 * Build a column-index → field-name map from a header row, plus the index of the
 * `word` column. Returns null if no columns are recognised.
 */
function mapHeader(parts: string[]): { map: Record<number, keyof ParsedWord>; wordIndex: number } | null {
  const map: Record<number, keyof ParsedWord> = {}
  let wordIndex = 0
  for (let i = 0; i < parts.length; i++) {
    const key = normalizeHeader(parts[i])
    if (key in COLUMN_ALIASES) {
      map[i] = COLUMN_ALIASES[key]
      if (COLUMN_ALIASES[key] === 'word') wordIndex = i
    }
  }
  return Object.keys(map).length > 0 ? { map, wordIndex } : null
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
  let wordCol = 0

  for (const line of lines) {
    const parts = splitRow(line, delim)
    if (parts.length === 0) continue

    // Try to detect a header row — if found, use it for column mapping. Only
    // probed until one is found, so a later data row that happens to look like a
    // header can't silently re-map the columns mid-file.
    if (!colMap && isHeaderRow(parts)) {
      const mapped = mapHeader(parts)
      if (mapped) {
        colMap = mapped.map
        wordCol = mapped.wordIndex
      }
      continue
    }

    const word = (colMap ? parts[wordCol] : parts[0])?.trim()
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
