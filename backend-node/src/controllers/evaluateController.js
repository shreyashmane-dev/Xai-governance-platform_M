import path from 'path'

import EvaluationResult from '../models/EvaluationResult.js'
import { evaluateWithPython } from '../services/mlServiceClient.js'
import { zeroAndDropFileRefs } from '../utils/cleanup.js'

function safeBaseName(name = '', fallback = 'artifact') {
  const base = path.basename(name, path.extname(name))
  return base || fallback
}

export async function evaluate(req, res, next) {
  try {
    const datasetFile = req.files?.dataset?.[0]
    const modelFile = req.files?.model?.[0]
    if (!datasetFile || !modelFile) {
      return res.status(400).json({ success: false, error: 'dataset and model files are required' })
    }

    const targetColumn = String(req.body?.targetColumn || req.body?.target_column || 'target')
    const sensitiveColumn = String(req.body?.sensitiveColumn || req.body?.sensitive_column || '')

    const evalResults = await evaluateWithPython({
      datasetBuffer: datasetFile.buffer,
      modelBuffer: modelFile.buffer,
      datasetName: datasetFile.originalname,
      modelName: modelFile.originalname,
      targetColumn,
      sensitiveColumn,
    })

    const doc = await EvaluationResult.create({
      modelName: req.body?.modelName || safeBaseName(modelFile.originalname, 'model'),
      datasetName: req.body?.datasetName || safeBaseName(datasetFile.originalname, 'dataset'),
      targetColumn,
      metrics: evalResults.metrics,
      confusionMatrix: evalResults.confusionMatrix,
      fairness: evalResults.fairness,
      explainability: evalResults.explainability,
      preview: evalResults.preview,
      metadata: {
        rowCount: evalResults.rowCount,
        columnCount: evalResults.columnCount,
      },
    })

    return res.status(200).json({
      success: true,
      evaluationId: String(doc._id),
      modelName: doc.modelName,
      datasetName: doc.datasetName,
      targetColumn: doc.targetColumn,
      metrics: evalResults.metrics,
      confusionMatrix: evalResults.confusionMatrix,
      fairness: evalResults.fairness,
      explainability: evalResults.explainability,
      preview: evalResults.preview,
      rowCount: evalResults.rowCount,
      columnCount: evalResults.columnCount,
      evaluatedAt: doc.evaluatedAt,
    })
  } catch (error) {
    next(error)
  } finally {
    if (req.files) {
      zeroAndDropFileRefs(req.files)
    }
  }
}

export async function listEvaluations(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 200)
    const rows = await EvaluationResult.find({})
      .sort({ evaluatedAt: -1 })
      .limit(limit)
      .lean()
    return res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        id: String(row._id),
        _id: undefined,
      })),
    })
  } catch (error) {
    next(error)
  }
}
