import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Pending</Badge>)
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('applies gray color by default', () => {
    render(<Badge>Gray</Badge>)
    expect(screen.getByText('Gray')).toHaveClass('bg-zinc-100')
  })

  it('applies yellow color', () => {
    render(<Badge color="yellow">Yellow</Badge>)
    expect(screen.getByText('Yellow')).toHaveClass('bg-yellow-100')
  })

  it('applies green color', () => {
    render(<Badge color="green">Green</Badge>)
    expect(screen.getByText('Green')).toHaveClass('bg-green-100')
  })

  it('applies red color', () => {
    render(<Badge color="red">Red</Badge>)
    expect(screen.getByText('Red')).toHaveClass('bg-red-100')
  })

  it('merges additional className', () => {
    render(<Badge className="my-extra">Test</Badge>)
    expect(screen.getByText('Test')).toHaveClass('my-extra')
  })
})
