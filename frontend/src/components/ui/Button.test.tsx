import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled when disabled prop is set', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Click</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    await userEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('applies primary variant class by default', () => {
    render(<Button>Btn</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-brand')
  })

  it('applies ghost variant class', () => {
    render(<Button variant="ghost">Btn</Button>)
    expect(screen.getByRole('button')).toHaveClass('text-zinc-600')
  })

  it('applies danger variant class', () => {
    render(<Button variant="danger">Btn</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-red-600')
  })

  it('applies sm size class', () => {
    render(<Button size="sm">Btn</Button>)
    expect(screen.getByRole('button')).toHaveClass('px-3')
  })

  it('merges additional className', () => {
    render(<Button className="extra-class">Btn</Button>)
    expect(screen.getByRole('button')).toHaveClass('extra-class')
  })
})
