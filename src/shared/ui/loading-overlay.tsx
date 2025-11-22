import React from 'react'
import { Spinner } from './spinner'
import { cn } from '@/shared/utils'

interface LoadingOverlayProps {
  isLoading: boolean
}

export function LoadingOverlay({ isLoading }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-background/80 backdrop-blur-md',
        'transition-opacity duration-300',
        isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      aria-label="Загрузка"
      role="status"
      aria-hidden={!isLoading}
    >
      {isLoading && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16">
            <Spinner size="large" />
          </div>
        </div>
      )}
    </div>
  )
}

