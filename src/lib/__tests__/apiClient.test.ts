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

  it('does not dispatch auth:expired on 401 when authExpiredEvent is false', async () => {
    mockFetchOnce(jsonResponse(401, { code: 'UNAUTHORIZED' }))

    const handler = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, handler)

    await expect(apiFetch('/test', { authExpiredEvent: false })).rejects.toBeInstanceOf(ApiError)

    expect(handler).not.toHaveBeenCalled()
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
    vi.stubEnv('VITE_API_BASE_URL', undefined)

    await expect(apiFetch('/test')).rejects.toThrow(/VITE_API_BASE_URL/)
    expect(mock).not.toHaveBeenCalled()
  })

  it('treats an empty VITE_API_BASE_URL as same-origin', async () => {
    const mock = mockFetchOnce(jsonResponse(200, { ok: true }))
    vi.stubEnv('VITE_API_BASE_URL', '')

    await apiFetch('/test')
    expect(mock).toHaveBeenCalledWith('/test', expect.objectContaining({ credentials: 'include' }))
  })

  it('on 401, silently refreshes once and retries the original request', async () => {
    const calls: string[] = []
    const mock = vi.fn(async (url: string) => {
      calls.push(url)
      if (url.endsWith('/auth/refresh')) {
        return jsonResponse(200, {})
      }
      const attempt = calls.filter((u) => u === url).length
      return attempt === 1 ? jsonResponse(401, { code: 'UNAUTHORIZED' }) : jsonResponse(200, { ok: true })
    })
    vi.stubGlobal('fetch', mock)

    const handler = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, handler)

    const result = await apiFetch<{ ok: boolean }>('/test')

    expect(result).toEqual({ ok: true })
    expect(calls).toEqual([
      `${TEST_BASE_URL}/test`,
      `${TEST_BASE_URL}/auth/refresh`,
      `${TEST_BASE_URL}/test`,
    ])
    // The retry succeeded — the session never actually expired from the caller's view.
    expect(handler).not.toHaveBeenCalled()
    window.removeEventListener(AUTH_EXPIRED_EVENT, handler)
  })

  it('sends no body on the refresh call — the refresh token lives only in the __session cookie', async () => {
    const mock = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) return jsonResponse(200, {})
      return jsonResponse(401, { code: 'UNAUTHORIZED' })
    })
    vi.stubGlobal('fetch', mock)

    await apiFetch('/test').catch(() => {})

    const refreshCall = mock.mock.calls.find(([url]) => (url as string).endsWith('/auth/refresh'))
    expect(refreshCall).toBeDefined()
    const [, init] = refreshCall as [string, RequestInit]
    expect(init.body).toBeUndefined()
    expect(init.credentials).toBe('include')
  })

  it('dispatches auth:expired only when the refresh attempt itself fails', async () => {
    mockFetchOnce(jsonResponse(401, { code: 'UNAUTHORIZED' }))

    const handler = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, handler)

    await expect(apiFetch('/test')).rejects.toBeInstanceOf(ApiError)

    expect(handler).toHaveBeenCalledTimes(1)
    window.removeEventListener(AUTH_EXPIRED_EVENT, handler)
  })

  it('dedupes concurrent refreshes: two simultaneous 401s trigger exactly one refresh call', async () => {
    const attemptsPerPath = new Map<string, number>()
    let refreshCalls = 0
    const mock = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1
        return jsonResponse(200, {})
      }
      const attempt = (attemptsPerPath.get(url) ?? 0) + 1
      attemptsPerPath.set(url, attempt)
      return attempt === 1 ? jsonResponse(401, { code: 'UNAUTHORIZED' }) : jsonResponse(200, { ok: true })
    })
    vi.stubGlobal('fetch', mock)

    const [a, b] = await Promise.all([
      apiFetch<{ ok: boolean }>('/a'),
      apiFetch<{ ok: boolean }>('/b'),
    ])

    expect(a).toEqual({ ok: true })
    expect(b).toEqual({ ok: true })
    expect(refreshCalls).toBe(1)
  })
})
