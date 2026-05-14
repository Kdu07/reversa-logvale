import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}))
vi.mock('react', async (importActual) => {
  const actual = await importActual<typeof import('react')>()
  return { ...actual, cache: (fn: unknown) => fn }
})
