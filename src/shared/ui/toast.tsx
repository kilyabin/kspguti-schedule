import React from 'react'
import { cn } from '@/shared/utils'
import { CheckCircle2, XCircle, X } from 'lucide-react'

export type ToastType = 'success' | 'error'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastProps {
  toast: Toast
  onClose: () => void
}

export function ToastComponent({ toast, onClose }: ToastProps) {
  const [isClosing, setIsClosing] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      handleClose()
    }, 3000) // Автоматически закрывается через 3 секунды

    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setIsClosing(true)
    // Ждем завершения анимации перед удалением из DOM
    setTimeout(() => {
      onClose()
    }, 300) // Длительность анимации исчезновения
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg',
        'border min-w-[300px] max-w-[500px]',
        'transition-all duration-300 ease-in-out',
        isClosing
          ? 'opacity-0 translate-y-2 scale-95'
          : 'opacity-100 translate-y-0 scale-100 animate-in slide-in-from-bottom-5 fade-in-0',
        toast.type === 'success'
          ? 'bg-background border-green-500/50 text-foreground'
          : 'bg-background border-destructive/50 text-foreground'
      )}
      role="alert"
    >
      {toast.type === 'success' ? (
        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
      ) : (
        <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
      )}
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={handleClose}
        className="flex-shrink-0 rounded-sm opacity-70 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-w-[24px] min-h-[24px] flex items-center justify-center"
        aria-label="Закрыть уведомление"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onClose: (id: string) => void
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
      {toasts.map((toast) => (
        <ToastComponent key={toast.id} toast={toast} onClose={() => onClose(toast.id)} />
      ))}
    </div>
  )
}

