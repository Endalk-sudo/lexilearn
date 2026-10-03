"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast surface !border !border-white/60 dark:!border-white/10 !shadow-neu-lg !rounded-2xl text-foreground font-sans p-4",
          description: "!text-muted-foreground",
          actionButton:
            "!bg-primary !text-primary-foreground !shadow-neu-primary !rounded-xl font-medium",
          cancelButton:
            "!bg-secondary !text-secondary-foreground !shadow-neu-sm !rounded-xl font-medium",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
