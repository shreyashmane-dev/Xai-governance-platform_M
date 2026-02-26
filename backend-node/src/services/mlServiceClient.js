import axios from 'axios'
import FormData from 'form-data'

const client = axios.create({
  timeout: 120000,
})

export async function evaluateWithPython({
  datasetBuffer,
  modelBuffer,
  datasetName,
  modelName,
  targetColumn = 'target',
  sensitiveColumn = '',
}) {
  const mlServiceUrl = process.env.ML_SERVICE_URL
  if (!mlServiceUrl) {
    throw new Error('ML_SERVICE_URL is required')
  }

  const form = new FormData()
  form.append('dataset', datasetBuffer, datasetName)
  form.append('model', modelBuffer, modelName)
  form.append('target_column', targetColumn)
  if (sensitiveColumn) {
    form.append('sensitive_column', sensitiveColumn)
  }

  const response = await client.post(`${mlServiceUrl.replace(/\/+$/, '')}/evaluate`, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  })
  return response.data
}
