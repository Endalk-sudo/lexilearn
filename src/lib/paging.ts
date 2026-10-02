/**
 * Keyset ("seek") pagination cursor for paged lists.
 *
 * Offset pagination is wrong for an append-while-you-read list: insert a word
 * at the top and every row after it shifts down one, so a scroll-through reader
 * sees one duplicate and skips one word. A keyset cursor anchors on the last row
 * it actually saw, so a concurrent insert can never shift the window.
 *
 * The cursor is the sort key of the last row handed out — `createdAt:id` — and
 * the sort is always `(createdAt ASC, id ASC)`. `id` is in the key because
 * `createdAt` alone is not unique (bulk CSV import stamps many rows in the same
 * millisecond), and a non-unique sort key silently drops rows at page
 * boundaries.
 */

/** Sort key for one row. Must match the ORDER BY that produced it. */
export type PageCursor = {
  createdAt: number
  id: string
}

const SEP = ':'

/** Encode a cursor for transport in a query string. */
export function encodeCursor(cursor: PageCursor): string {
  return `${cursor.createdAt}${SEP}${cursor.id}`
}

/**
 * Decode a cursor from an untrusted query string.
 *
 * Returns null for anything malformed so a hand-edited or stale `?cursor=`
 * falls back to the first page instead of throwing a 500 or, worse, silently
 * producing a wrong WHERE clause.
 */
export function decodeCursor(raw: string | null | undefined): PageCursor | null {
  if (!raw) return null
  const idx = raw.indexOf(SEP)
  if (idx <= 0) return null
  const createdAt = Number(raw.slice(0, idx))
  const id = raw.slice(idx + 1)
  if (!Number.isFinite(createdAt) || !Number.isInteger(createdAt) || createdAt < 0 || !id) return null
  return { createdAt, id }
}

/** Clamp a caller-supplied page size into a sane range. */
export function clampLimit(raw: string | null | undefined, fallback: number, max: number): number {
  if (raw === null || raw === undefined || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return fallback
  return Math.min(n, max)
}