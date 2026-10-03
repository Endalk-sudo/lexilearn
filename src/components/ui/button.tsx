import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold select-none transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150 ease-out-quint active:scale-[.97] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none aria-invalid:border-destructive cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-white/25 shadow-neu-primary hover:brightness-105 active:shadow-neu-primary-pressed",
        soft:
          "border border-primary-line/50 bg-primary-soft text-primary shadow-neu-sm hover:border-primary-line hover:bg-primary-soft/80 active:shadow-neu-pressed",
        destructive:
          "bg-destructive text-destructive-foreground border border-white/20 shadow-neu-sm hover:brightness-105 active:shadow-neu-pressed",
        outline:
          "border border-border/70 bg-card text-foreground shadow-neu-sm hover:border-primary-line/60 hover:shadow-neu hover:text-foreground active:shadow-neu-pressed",
        secondary:
          "bg-secondary text-secondary-foreground border border-border/50 shadow-neu-sm hover:bg-secondary/90 hover:shadow-neu active:shadow-neu-pressed",
        ghost:
          "text-muted-foreground hover:bg-accent/60 hover:text-foreground hover:shadow-neu-sm active:shadow-neu-pressed",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 rounded-xl px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-11 rounded-xl px-6 text-[15px] has-[>svg]:px-4 font-semibold",
        icon: "size-9 rounded-xl shadow-neu-sm hover:shadow-neu active:shadow-neu-pressed",
        "icon-lg": "size-11 rounded-xl shadow-neu-sm hover:shadow-neu active:shadow-neu-pressed",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
