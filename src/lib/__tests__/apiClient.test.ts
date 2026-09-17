import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_EXPIRED_EVENT, apiFetch } from '../apiClient'
import { ApiError } from '../apiError'

const TEST_BASE_URL = 'https://api.test'

function mockFetchOnce(response: Response): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', mock)
  return mock
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', TEST_BASE_URL)
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sends a successful request to the base URL + path and returns parsed JSON', async () => {
    const mock = mockFetchOnce(jsonResponse(200, { ok: true }))

    const result = await apiFetch<{ ok: boolean }>('/test')

    expect(result).toEqual({ ok: true })
    expect(mock).toHaveBeenCalledTimes(1)

    const [url, init] = mock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${TEST_BASE_URL}/test`)
    expect(init.credentials).toBe('include')
    const headers = new Headers(init.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Accept-Language')).toBe('en')
  })

  it('sets Accept-Language from localStorage, falling back to "en"', async () => {
    window.localStorage.setItem('inbox-detective-locale', 'es')
    const mock = mockFetchOnce(jsonResponse(200, {}))

    await apiFetch('/test')

    const [, init] = mock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get('Accept-Language')).toBe('es')
  })

  it('dispatches auth:expired and throws ApiError on 401', async () => {
    mockFetchOnce(jsonResponse(401, { code: 'UNAUTHORIZED' }))

    const handler = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, handler)

    const promise = apiFetch('/test')
    await expect(promise).rejects.toBeInstanceOf(ApiError)
    await promise.catch((error: ApiError) => {
      expect(error.status).toBe(401)
      expect(error.code).toBe('UNAUTHORIZED')
    })

    // Microtasks for the 401 dispatch have settled by the time the rejection is handled
    expect(handler).toHaveBeenCalledTimes(1)
    window.removeEventListener(AUTH_EXPIRED_EVENT, handler)
  })

  it('throws ApiError with status and code on other non-2xx responses', async () => {
    mockFetchOnce(jsonResponse(500, { code: 'GMAIL_CONNECTION_EXPIRED', message: 'Gmail died' }))

    const error = await apiFetch('/test').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.status).toBe(500)
    expect(apiError.code).toBe('GMAIL_CONNECTION_EXPIRED')
    expect(apiError.message).toBe('Gmail died')
  })

  it('wraps network failures in an ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const error = await apiFetch('/test').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.status).toBe(0)
    expect(apiError.code).toBe('NETWORK_ERROR')
  })

  it('throws a clear error when VITE_API_BASE_URL is missing', async () => {
    const mock = mockFetchOnce(jsonResponse(200, {}))
    vi.unstubAllEnvs()

    await expect(apiFetch('/test')).rejects.toThrow(/VITE_API_BASE_URL/)
    expect(mock).not.toHaveBeenCalled()
  })
})
