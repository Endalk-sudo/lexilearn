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

/** Column names from CSV_FORMAT_HINT — recognised only in the header row. */
const HEADER_CELLS = new Set([
  'pos', 'part of speech', 'definition', 'meaning', 'example',
  'ipa', 'cefr', 'synonyms', 'antonyms', 'amharic',
])

/** A row is the header when its first cell is "word" and a later cell is a known column name. */
function isHeaderRow(parts: string[]): boolean {
  if ((parts[0] ?? '').trim().toLowerCase() !== 'word') return false
  return parts.slice(1).some((p) => HEADER_CELLS.has(p.trim().toLowerCase()))
}

export function parseCsv(text: string): ParsedWord[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim())
  const out: ParsedWord[] = []
  for (const line of lines) {
    const parts = splitRow(line)
    if (parts.length === 0) continue
    if (isHeaderRow(parts)) continue
    const word = parts[0]?.trim()
    if (!word) continue
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
  return out
}

export const CSV_FORMAT_HINT =
  'word, pos, definition, example, ipa, cefr, synonyms, antonyms, amharic'

export const CSV_PLACEHOLDER =
  'serendipity, noun, a happy accident, Finding that old letter was pure serendipity., /ˌsɛrənˈdɪpɪti/, C1, luck fortune, misfortune, ድንገተኛ ደስታ'
