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

export function parseCsv(text: string): ParsedWord[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim())
  const out: ParsedWord[] = []
  for (const line of lines) {
    const parts = line.includes('\t') ? line.split('\t') : line.split(',')
    if (parts.length === 0) continue
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
