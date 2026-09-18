'use client'

import { Skeleton } from '@/components/ui/skeleton'

export function SessionSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading session">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-2.5 w-full rounded-full" />
      <Skeleton className="h-[340px] w-full rounded-lg" />
      <Skeleton className="h-28 w-full rounded-lg" />
    </div>
  )
}

export function CardsSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-lg" />
      ))}
    </div>
  )
}
