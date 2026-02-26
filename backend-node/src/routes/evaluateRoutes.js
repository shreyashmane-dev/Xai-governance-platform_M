import { Router } from 'express'

import { evaluate, listEvaluations } from '../controllers/evaluateController.js'
import { evaluateRateLimiter } from '../middleware/rateLimitMiddleware.js'
import { upload } from '../middleware/uploadMiddleware.js'

const router = Router()

router.post(
  '/evaluate',
  evaluateRateLimiter,
  upload.fields([
    { name: 'dataset', maxCount: 1 },
    { name: 'model', maxCount: 1 },
  ]),
  evaluate
)

router.get('/evaluations', listEvaluations)

export default router
