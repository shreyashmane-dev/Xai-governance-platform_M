import rateLimit from 'express-rate-limit'

export const evaluateRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many evaluation requests. Please retry later.',
  },
})
