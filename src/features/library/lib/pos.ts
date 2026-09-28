/** Normalize stored part-of-speech variants ("n.", "noun", "Noun") to a filter key. */
export function posKey(pos: string | null): 'noun' | 'verb' | 'adj' | 'adv' | null {
  if (!pos) return null
  const p = pos.toLowerCase()
  if (p.includes('noun') || p === 'n' || p === 'n.') return 'noun'
  // 'adverb' contains 'verb' — check the longer affixes first.
  if (p.includes('adv') || p === 'adv.') return 'adv'
  if (p.includes('adj') || p === 'a' || p === 'a.') return 'adj'
  if (p.includes('verb') || p === 'v' || p === 'v.') return 'verb'
  return null
}
