import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none aria-invalid:border-destructive transition-all duration-150 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-white/20 bg-primary text-primary-foreground shadow-neu-sm [a&]:hover:brightness-105",
        soft:
          "border-primary-line/50 bg-primary-soft text-primary shadow-neu-sm [a&]:hover:bg-primary/20",
        secondary:
          "border-border/60 bg-secondary text-secondary-foreground shadow-neu-sm [a&]:hover:bg-secondary/90",
        success:
          "border-success/30 bg-success-soft text-success shadow-neu-sm",
        warning:
          "border-warning/30 bg-warning-soft text-warning shadow-neu-sm",
        streak:
          "border-streak/30 bg-streak-soft text-streak shadow-neu-sm",
        destructive:
          "border-destructive/30 bg-destructive-soft text-destructive shadow-neu-sm [a&]:hover:bg-destructive/20",
        outline:
          "border-border/70 bg-card/60 text-muted-foreground shadow-neu-sm [a&]:hover:border-primary-line [a&]:hover:text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
