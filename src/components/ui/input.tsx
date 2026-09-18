import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground flex h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base shadow-xs transition-[color,box-shadow,border-color] duration-150 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-primary-line aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
