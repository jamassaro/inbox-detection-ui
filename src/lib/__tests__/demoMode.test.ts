import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_STORAGE_KEY, clearDemoFlag, enterDemo, exitDemo, isDemoMode } from '../demoMode'

describe('demoMode', () => {
  const assign = vi.fn()

  beforeEach(() => {
    sessionStorage.clear()
    assign.mockReset()
    vi.stubEnv('VITE_USE_MOCKS', 'false')
    vi.stubGlobal('location', { ...window.location, assign })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('is off by default', () => {
    expect(isDemoMode()).toBe(false)
  })

  it('enterDemo sets the session flag and reloads into the app', () => {
    enterDemo()
    expect(sessionStorage.getItem(DEMO_STORAGE_KEY)).toBe('true')
    expect(assign).toHaveBeenCalledWith('/app/dashboard')
    expect(isDemoMode()).toBe(true)
  })

  it('never uses localStorage', () => {
    enterDemo()
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull()
  })

  it('exitDemo clears the flag and returns to the landing page', () => {
    enterDemo()
    assign.mockReset()
    exitDemo()
    expect(isDemoMode()).toBe(false)
    expect(assign).toHaveBeenCalledWith('/')
  })

  it('clearDemoFlag drops the flag without navigating', () => {
    sessionStorage.setItem(DEMO_STORAGE_KEY, 'true')
    clearDemoFlag()
    expect(isDemoMode()).toBe(false)
    expect(assign).not.toHaveBeenCalled()
  })

  it('VITE_USE_MOCKS=true forces demo mode', () => {
    vi.stubEnv('VITE_USE_MOCKS', 'true')
    expect(isDemoMode()).toBe(true)
  })
})
