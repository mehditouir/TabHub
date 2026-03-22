import { cn } from '@/lib/utils'

interface Props {
  children: React.ReactNode
  color?: 'gray' | 'yellow' | 'blue' | 'orange' | 'green' | 'red'
  className?: string
}

const colors = {
  gray:   'bg-zinc-100 text-zinc-600',
  yellow: 'bg-yellow-100 text-yellow-700',
  blue:   'bg-blue-100 text-blue-700',
  orange: 'bg-orange-100 text-orange-700',
  green:  'bg-green-100 text-green-700',
  red:    'bg-red-100 text-red-700',
}

export function Badge({ children, color = 'gray', className }: Props) {
  return (
    <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold', colors[color], className)}>
      {children}
    </span>
  )
}
