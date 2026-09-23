'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Check, GripVertical, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buzz, playSound } from '@/lib/feel'

/**
 * Drag-to-match: pair each word with its meaning.
 *
 * Drag is the headline interaction, but tap-to-pair and keyboard selection are
 * equally supported so the exercise is never gesture-only.
 */

export type MatchPair = { id: string; word: string; definition: string }

/** Per-pair outcome reported back when the game completes (id = word id). */
export type MatchResult = { wordId: string; firstTry: boolean }

export function MatchGame({
  pairs,
  onComplete,
}: {
  pairs: MatchPair[]
  onComplete: (results: MatchResult[]) => void
}) {
  const [matchedWords, setMatchedWords] = useState<string[]>([])
  const [misMatched, setMisMatched] = useState<string[]>([])
  const [wrongWord, setWrongWord] = useState<string | null>(null)
  const [wrongSlot, setWrongSlot] = useState<string | null>(null)
  const [selectedWord, setSelectedWord] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const slotFor = (wordId: string) => `slot-${wordId}`
  const filledSlots = useMemo(() => {
    const map = new Map<string, string>()
    matchedWords.forEach((wordId) => map.set(slotFor(wordId), wordId))
    return map
  }, [matchedWords])

  const attempt = (wordId: string, slotId: string) => {
    if (matchedWords.includes(wordId)) return
    if (filledSlots.has(slotId)) return
    if (slotFor(wordId) === slotId) {
      const next = [...matchedWords, wordId]
      setMatchedWords(next)
      setSelectedWord(null)
      playSound('correct')
      buzz('success')
      if (next.length === pairs.length) {
        window.setTimeout(
          () => onComplete(pairs.map((p) => ({ wordId: p.id, firstTry: !misMatched.includes(p.id) }))),
          420
        )
      }
    } else {
      setWrongWord(wordId)
      setWrongSlot(slotId)
      setMisMatched((m) => (m.includes(wordId) ? m : [...m, wordId]))
      playSound('wrong')
      buzz('error')
      window.setTimeout(() => {
        setWrongWord(null)
        setWrongSlot(null)
      }, 420)
    }
  }

  const onDragEnd = (event: DragEndEvent) => {
    const wordId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (!overId) return
    attempt(wordId, overId)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Drag a word onto its meaning — or tap a word, then tap a meaning.
        </p>

        <ul className="space-y-2" aria-label="Meanings">
          {pairs.map((pair) => {
            const filledWordId = filledSlots.get(slotFor(pair.id)) ?? null
            return (
              <Slot
                key={pair.id}
                id={slotFor(pair.id)}
                definition={pair.definition}
                filledWordId={filledWordId}
                wordLabel={pairs.find((p) => p.id === filledWordId)?.word ?? ''}
                isWrong={wrongSlot === slotFor(pair.id)}
                hasSelection={!!selectedWord}
                onActivate={() => {
                  if (selectedWord) attempt(selectedWord, slotFor(pair.id))
                }}
              />
            )
          })}
        </ul>

        <ul className="flex flex-wrap gap-2" aria-label="Words">
          {pairs.map((pair) => (
            <WordChip
              key={pair.id}
              id={pair.id}
              word={pair.word}
              matched={matchedWords.includes(pair.id)}
              selected={selectedWord === pair.id}
              isWrong={wrongWord === pair.id}
              onSelect={() => {
                if (matchedWords.includes(pair.id)) return
                playSound('tap')
                buzz('light')
                setSelectedWord((current) => (current === pair.id ? null : pair.id))
              }}
            />
          ))}
        </ul>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="num">
            {matchedWords.length} / {pairs.length} matched
          </span>
          <span className="hidden sm:inline">Tab to a word, then Enter to pick it up</span>
        </div>
      </div>
    </DndContext>
  )
}

function WordChip({
  id,
  word,
  matched,
  selected,
  isWrong,
  onSelect,
}: {
  id: string
  word: string
  matched: boolean
  selected: boolean
  isWrong: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: matched })
  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        onClick={onSelect}
        aria-pressed={selected}
        aria-disabled={matched}
        style={transform ? { transform: CSS.Translate.toString(transform), zIndex: 40 } : undefined}
        className={cn(
          'flex min-h-11 touch-manipulation items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium shadow-xs transition-colors duration-150',
          matched
            ? 'border-transparent bg-success-soft text-success'
            : selected
              ? 'border-primary-line bg-primary-soft text-primary'
              : 'border-border bg-card hover:border-primary-line',
          isWrong && 'shake border-destructive/50 bg-destructive-soft text-destructive',
          isDragging && 'opacity-90 shadow-lg'
        )}
      >
        <GripVertical className="h-3.5 w-3.5 opacity-50" aria-hidden="true" />
        {word}
      </button>
    </li>
  )
}

function Slot({
  id,
  definition,
  filledWordId,
  wordLabel,
  isWrong,
  hasSelection,
  onActivate,
}: {
  id: string
  definition: string
  filledWordId: string | null
  wordLabel: string
  isWrong: boolean
  hasSelection: boolean
  onActivate: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !!filledWordId })
  const filled = !!filledWordId
  return (
    <li
      ref={setNodeRef}
      onClick={filled ? undefined : onActivate}
      className={cn(
        'flex min-h-14 items-center gap-3 rounded-md border p-3 transition-colors duration-150',
        filled ? 'border-success/40 bg-success-soft' : 'border-dashed border-border bg-card',
        !filled && hasSelection && 'cursor-pointer hover:border-primary-line hover:bg-primary-soft',
        isOver && !filled && 'border-primary bg-primary-soft',
        isWrong && 'border-destructive/50 bg-destructive-soft'
      )}
    >
      <span className="min-w-0 flex-1 text-sm leading-relaxed">{definition}</span>
      {filled ? (
        <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-card px-2 py-1 text-xs font-semibold text-success">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {wordLabel}
        </span>
      ) : isWrong ? (
        <X className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
      ) : (
        <span className="shrink-0 rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground">
          Drop here
        </span>
      )}
    </li>
  )
}
