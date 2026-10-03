import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-xl border border-border/70 bg-card/60 px-3.5 py-2.5 text-base leading-relaxed shadow-neu-inset-sm transition-[color,box-shadow,border-color] duration-150 outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:shadow-neu-inset focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
