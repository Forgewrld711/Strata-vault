import * as React from "react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@radix-ui/react-toast"
import { useToast, type ToasterToast } from "@/hooks/use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }: ToasterToast) {
        return (
          <Toast key={id} {...props} className="bg-card border border-border shadow-lg rounded-md p-4 mb-2 flex items-center justify-between">
            <div className="grid gap-1">
              {title && <ToastTitle className="font-semibold text-foreground">{title}</ToastTitle>}
              {description && (
                <ToastDescription className="text-sm text-muted-foreground">{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose className="text-muted-foreground hover:text-foreground">
              ✕
            </ToastClose>
          </Toast>
        )
      })}
      <ToastViewport className="fixed bottom-0 right-0 p-6 flex flex-col gap-2 w-full max-w-sm z-[100]" />
    </ToastProvider>
  )
}
