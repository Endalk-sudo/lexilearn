'use client'

import { useAppStore } from '@/lib/store'
import { Tag, X } from 'lucide-react'

export function StudyScopeBanner() {
  const studyCategory = useAppStore((s) => s.studyCategory)
  const setStudyCategory = useAppStore((s) => s.setStudyCategory)

  if (!studyCategory) return null

  return (
    <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary-soft/60 px-3.5 py-2 text-xs text-foreground shadow-2xs">
      <div className="flex items-center gap-2 min-w-0">
        <Tag className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">
          Studying category: <strong className="font-semibold text-foreground">{studyCategory.name}</strong>
        </span>
      </div>
      <button
        type="button"
        onClick={() => setStudyCategory(null)}
        className="flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-background/80 hover:text-foreground cursor-pointer transition-colors"
        title="Clear category filter"
      >
        <X className="h-3.5 w-3.5" />
        <span>Clear filter</span>
      </button>
    </div>
  )
}
