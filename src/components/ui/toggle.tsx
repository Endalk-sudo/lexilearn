"use client"

import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-150 outline-none select-none cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 whitespace-nowrap active:scale-[0.98] motion-reduce:active:scale-100",
  {
    variants: {
      variant: {
        default:
          "text-muted-foreground hover:bg-card hover:shadow-neu-sm hover:text-foreground data-[state=on]:surface-inset data-[state=on]:border data-[state=on]:border-primary-line data-[state=on]:bg-primary-soft/50 data-[state=on]:text-primary data-[state=on]:shadow-neu-inset-sm",
        outline:
          "surface border border-border/70 text-foreground shadow-neu-sm hover:shadow-neu data-[state=on]:surface-inset data-[state=on]:border-primary-line data-[state=on]:bg-primary-soft/50 data-[state=on]:text-primary data-[state=on]:shadow-neu-inset-sm",
      },
      size: {
        default: "h-9 px-3 min-w-9",
        sm: "h-8 px-2.5 min-w-8 text-xs",
        lg: "h-10 px-4 min-w-10 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
