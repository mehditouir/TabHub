import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './mocks/server'
import i18n from '@/i18n'

// Force English for all tests (i18n defaults to 'fr' via localStorage fallback)
i18n.changeLanguage('en')

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
