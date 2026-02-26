import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'

import evaluateRoutes from './routes/evaluateRoutes.js'

const app = express()

app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || true,
    credentials: true,
  })
)
app.use(morgan('combined'))
app.use(express.json({ limit: '2mb' }))

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'node-gateway', storage: 'memory-only-for-files' })
})

app.get('/favicon.ico', (req, res) => res.status(204).end())

app.use('/api', evaluateRoutes)

app.use((err, req, res, next) => {
  const status = err?.status || err?.statusCode || 500
  const message = err?.message || 'Internal server error'
  if (status >= 500) {
    console.error('Unhandled error:', err)
  }
  res.status(status).json({
    success: false,
    error: message,
  })
})

export default app
