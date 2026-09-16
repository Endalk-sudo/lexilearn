// LexiLearn database ID helper — cuid-like collision-resistant IDs.
// Replaces Prisma's built-in cuid() default for string primary keys.
const CUID2_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

let counter = Math.floor(Math.random() * 2057)

function fingerprint(input: string, length: number): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  let out = ''
  for (let i = 0; i < length; i++) {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507)
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909)
    out += CUID2_ALPHABET[Math.abs(hash >>> (i % 15)) % CUID2_ALPHABET.length]
  }
  return out
}

/** Collision-resistant, sortable-ish unique id (cuid-style: `c` + timestamp + random + counter). */
export function createId(): string {
  counter = (counter + 1) % 2057
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `c${time}${fingerprint(`${rand}${time}`, 8)}${counter.toString(36)}`
}
