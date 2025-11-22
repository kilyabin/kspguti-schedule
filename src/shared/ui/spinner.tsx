import styles from './styles.module.scss'
import { cn } from '@/shared/utils'

interface SpinnerProps {
  size?: 'small' | 'large'
  className?: string
}

export function Spinner({ size = 'small', className }: SpinnerProps) {
  return (
    <div 
      className={cn(
        styles.spinner,
        size === 'large' && styles.spinnerLarge,
        className
      )} 
    />
  )
}