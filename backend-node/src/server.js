import dotenv from 'dotenv'

dotenv.config()

import app from './app.js'
import { connectDb } from './config/db.js'

const port = Number(process.env.PORT || 5000)

async function start() {
  await connectDb()
  app.listen(port, () => {
    console.log(`Node gateway listening on :${port}`)
  })
}

start().catch((error) => {
  console.error('Failed to start node gateway:', error)
  process.exit(1)
})
