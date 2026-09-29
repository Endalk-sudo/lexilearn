'use client'

import type { CategoryDTO } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

export const CATEGORY_COLORS = [
  { name: 'Emerald', value: '#10b981', bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  { name: 'Sapphire', value: '#3b82f6', bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  { name: 'Purple', value: '#a855f7', bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30' },
  { name: 'Amber', value: '#f59e0b', bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  { name: 'Rose', value: '#f43f5e', bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30' },
  { name: 'Indigo', value: '#6366f1', bg: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30' },
  { name: 'Teal', value: '#14b8a6', bg: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30' },
]

export function getCategoryStyle(color?: string | null): string {
  if (!color) return 'border-border/80 bg-muted/50 text-muted-foreground'
  const found = CATEGORY_COLORS.find((c) => c.value === color || c.name.toLowerCase() === color.toLowerCase())
  return found ? found.bg : 'border-primary/30 bg-primary/10 text-primary'
}

export function CategoryBadge({
  category,
  onClick,
  className,
}: {
  category: CategoryDTO
  onClick?: () => void
  className?: string
}) {
  const style = getCategoryStyle(category.color)
  return (
    <Badge
      variant="outline"
      onClick={onClick}
      className={cn(
        'text-[10px] font-medium tracking-wide py-0 px-2 transition-colors inline-flex items-center gap-1',
        style,
        onClick && 'cursor-pointer hover:opacity-80',
        className
      )}
    >
      <Tag className="h-2.5 w-2.5 opacity-60 shrink-0" />
      <span className="truncate max-w-[120px]">{category.name}</span>
    </Badge>
  )
}

export function CategoryBadgeList({
  categories,
  onCategoryClick,
  max = 3,
  className,
}: {
  categories?: CategoryDTO[]
  onCategoryClick?: (cat: CategoryDTO) => void
  max?: number
  className?: string
}) {
  if (!categories || categories.length === 0) return null

  const visible = categories.slice(0, max)
  const remaining = categories.length - max

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {visible.map((cat) => (
        <CategoryBadge
          key={cat.id}
          category={cat}
          onClick={onCategoryClick ? () => onCategoryClick(cat) : undefined}
        />
      ))}
      {remaining > 0 ? (
        <span className="text-[10px] text-muted-foreground font-medium">
          +{remaining}
        </span>
      ) : null}
    </div>
  )
}
