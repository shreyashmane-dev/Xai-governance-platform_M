import mongoose from 'mongoose'

let connected = false

export async function connectDb() {
  if (connected) return
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) {
    throw new Error('MONGO_URI is required')
  }
  await mongoose.connect(mongoUri, {
    autoIndex: true,
  })
  connected = true
}
