import { cn } from '@/lib/utils'
import type { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, id, ...props }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-zinc-700">
          {label}
        </label>
      )}
      <input
        id={id}
        {...props}
        className={cn(
          'rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none',
          'focus:border-brand focus:ring-2 focus:ring-brand/20',
          'disabled:bg-zinc-50 disabled:text-zinc-400',
          error && 'border-red-400 focus:border-red-400 focus:ring-red-100',
          className,
        )}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
