import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Input'

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders a label when provided', () => {
    render(<Input id="email" label="Email" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('associates label with input via id', () => {
    render(<Input id="email" label="Email address" />)
    const input = screen.getByLabelText('Email address')
    expect(input).toHaveAttribute('id', 'email')
  })

  it('shows error message', () => {
    render(<Input error="Field is required" />)
    expect(screen.getByText('Field is required')).toBeInTheDocument()
  })

  it('applies error border class when error is present', () => {
    render(<Input error="Bad input" />)
    expect(screen.getByRole('textbox')).toHaveClass('border-red-400')
  })

  it('accepts user input', async () => {
    const onChange = vi.fn()
    render(<Input onChange={onChange} />)
    await userEvent.type(screen.getByRole('textbox'), 'hello')
    expect(onChange).toHaveBeenCalled()
  })

  it('forwards additional props like placeholder and type', () => {
    render(<Input type="email" placeholder="Enter email" />)
    const input = screen.getByPlaceholderText('Enter email')
    expect(input).toHaveAttribute('type', 'email')
  })
})
