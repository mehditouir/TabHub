import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?:    'sm' | 'md' | 'lg'
}

const variants = {
  primary:   'bg-brand text-white hover:bg-brand-dark',
  secondary: 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200',
  danger:    'bg-red-600 text-white hover:bg-red-700',
  ghost:     'text-zinc-600 hover:bg-zinc-100',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3 text-lg',
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: Props) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
    />
  )
}
