import { describe, expect, it } from 'vitest'
import { ApiError, getProRequired } from '../apiError'

const proBody = {
  error: 'pro_required',
  upgradeContext: 'chat_limit',
  message: 'Upgrade to Pro',
  checkoutUrl: '/billing/checkout',
}

describe('getProRequired', () => {
  it('parses the 402 pro_required shape', () => {
    const error = new ApiError(402, 'UNKNOWN_ERROR', 'Upgrade to Pro', proBody)
    expect(getProRequired(error)).toEqual({
      upgradeContext: 'chat_limit',
      message: 'Upgrade to Pro',
      checkoutUrl: '/billing/checkout',
    })
  })

  it('returns null for a 402 with a different body', () => {
    expect(getProRequired(new ApiError(402, 'LOCKED', 'locked', { error: 'locked' }))).toBeNull()
    expect(getProRequired(new ApiError(402, 'LOCKED', 'locked'))).toBeNull()
  })

  it('returns null for other statuses and non-ApiErrors', () => {
    expect(getProRequired(new ApiError(403, 'X', 'x', proBody))).toBeNull()
    expect(getProRequired(new Error('boom'))).toBeNull()
  })
})
