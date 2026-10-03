'use client'

import { useState, useEffect, useCallback } from 'react'
import { api, type CategorySummary } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tag, Plus, Pencil, Trash2, BookOpen, GraduationCap, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { CATEGORY_COLORS, getCategoryStyle } from './category-badge'
import { cn } from '@/lib/utils'

export function ManageCategoriesDialog({
  open,
  onOpenChange,
  onCategoriesChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCategoriesChanged?: () => void
}) {
  const [categories, setCategories] = useState<CategorySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0].value)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const setStudyCategory = useAppStore((s) => s.setStudyCategory)
  const navigate = useAppStore((s) => s.navigate)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.getCategories()
      setCategories(list)
    } catch {
      toast.error('Could not load categories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [open, load])

  const handleCreate = async () => {
    const trimmed = newName.trim()
    if (!trimmed) {
      toast.error('Category name cannot be empty')
      return
    }
    setCreating(true)
    try {
      await api.createCategory(trimmed, newColor)
      toast.success(`Category "${trimmed}" created`)
      setNewName('')
      await load()
      onCategoriesChanged?.()
    } catch {
      toast.error('Could not create category')
    } finally {
      setCreating(false)
    }
  }

  const handleRename = async (id: string) => {
    const trimmed = editName.trim()
    if (!trimmed) return
    try {
      await api.renameCategory(id, trimmed)
      toast.success('Category renamed')
      setEditingId(null)
      await load()
      onCategoriesChanged?.()
    } catch {
      toast.error('Could not rename category')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    try {
      await api.deleteCategory(id)
      toast.success(`Category "${name}" deleted`)
      await load()
      onCategoriesChanged?.()
    } catch {
      toast.error('Could not delete category')
    }
  }

  const startStudy = (cat: CategorySummary, mode: 'learn' | 'review') => {
    setStudyCategory({ id: cat.id, name: cat.name })
    onOpenChange(false)
    navigate(mode)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Manage Categories
          </DialogTitle>
          <DialogDescription>
            Group words by topic or theme (e.g. Science, Law, Academic). Study specific categories in Learn and Review.
          </DialogDescription>
        </DialogHeader>

        {/* Add new category form */}
        <div className="surface-inset rounded-2xl border border-border/50 p-4 shadow-neu-inset-sm space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Create New Category
          </Label>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Technology, Medical, Idioms"
              className="flex-1 text-sm h-9"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleCreate()
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => void handleCreate()}
              disabled={creating || !newName.trim()}
              className="h-9 px-3 shrink-0"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
          {/* Color swatches */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">Color:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-label={c.name}
                  onClick={() => setNewColor(c.value)}
                  className={cn(
                    'h-5 w-5 rounded-full border transition-all cursor-pointer',
                    newColor === c.value ? 'ring-2 ring-primary ring-offset-1 scale-110' : 'opacity-80 hover:opacity-100'
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Category list */}
        <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1 min-h-[160px]">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Tag className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No categories yet. Add your first category above to group your words!
            </div>
          ) : (
            categories.map((cat) => {
              const isEditing = editingId === cat.id
              const style = getCategoryStyle(cat.color)

              return (
                <div
                  key={cat.id}
                  className="surface flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-border/70 shadow-neu-sm hover:shadow-neu transition-all"
                >
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleRename(cat.id)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void handleRename(cat.id)}>
                          <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn('text-xs font-semibold py-0 px-2', style)}>
                            {cat.name}
                          </Badge>
                          <span className="text-xs text-muted-foreground num font-medium">
                            {cat.wordCount} {cat.wordCount === 1 ? 'word' : 'words'}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground num">
                          {cat.dueCount > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              {cat.dueCount} due
                            </span>
                          ) : (
                            <span>0 due</span>
                          )}
                          <span>•</span>
                          <span>{cat.newCount} new</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      {cat.wordCount > 0 && (
                        <>
                          {cat.dueCount > 0 && (
                            <Button
                              size="sm"
                              variant="soft"
                              className="h-7 text-xs px-2 cursor-pointer"
                              title="Review due words in this category"
                              onClick={() => startStudy(cat, 'review')}
                            >
                              <BookOpen className="h-3 w-3 mr-1" />
                              Review
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2 cursor-pointer"
                            title="Learn new words in this category"
                            onClick={() => startStudy(cat, 'learn')}
                          >
                            <GraduationCap className="h-3 w-3 mr-1" />
                            Learn
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label={`Rename ${cat.name}`}
                        onClick={() => {
                          setEditingId(cat.id)
                          setEditName(cat.name)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
                        aria-label={`Delete ${cat.name}`}
                        onClick={() => void handleDelete(cat.id, cat.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <DialogFooter className="border-t border-border/60 pt-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
