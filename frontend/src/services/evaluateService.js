import api from './apiClient'
import { analyticsService } from './analyticsService'
import { datasetService } from './datasetService'
import { governanceService } from './governanceService'
import { modelService } from './modelService'

function cleanBaseName(fileName, fallback, extPattern) {
  if (!fileName || typeof fileName !== 'string') return fallback
  return fileName.replace(extPattern, '') || fallback
}

function toFairness(governance, sensitiveColumn) {
  const findings = governance?.bias_findings || []
  if (!Array.isArray(findings) || findings.length === 0) {
    return {
      available: false,
      reason: sensitiveColumn
        ? 'No fairness findings were generated for the selected sensitive column.'
        : 'Sensitive column not provided.',
    }
  }

  const first = findings[0] || {}
  const groupPositiveRates = {}
  const subgroup = governance?.subgroup_analysis || []
  if (Array.isArray(subgroup)) {
    subgroup.forEach((item) => {
      if (item?.group != null && item?.positive_prediction_rate != null) {
        groupPositiveRates[String(item.group)] = Number(item.positive_prediction_rate)
      }
    })
  }

  return {
    available: true,
    sensitiveColumn: first.sensitive_column || sensitiveColumn || '',
    demographicParityDiff: Number(first.demographic_parity_diff || 0),
    groupPositiveRates,
  }
}

export const evaluateService = {
  evaluateUploaded: async ({ modelId, datasetId, modelName, datasetName, targetColumn = 'target', sensitiveColumn = '' }) => {
    const [metricsRes, shapRes, governanceRes, previewRes] = await Promise.all([
      analyticsService.metrics(modelId, datasetId),
      analyticsService.shap(modelId, datasetId),
      governanceService.run(modelId, datasetId, sensitiveColumn),
      datasetService.preview(datasetId, 10),
    ])

    const metrics = metricsRes?.data?.data || {}
    const shap = shapRes?.data?.data || {}
    const governance = governanceRes?.data?.data || {}
    const previewData = previewRes?.data?.data || {}

    return {
      data: {
        modelId,
        datasetId,
        modelName,
        datasetName,
        targetColumn,
        evaluatedAt: new Date().toISOString(),
        rowCount: Number(previewData.totalRows ?? previewData.row_count ?? 0),
        columnCount: Number(previewData.column_count ?? 0),
        metrics,
        confusionMatrix: metrics.confusion_matrix || [],
        fairness: toFairness(governance, sensitiveColumn),
        explainability: {
          featureImportance: shap.global_importance || [],
          shapSummary: shap.global_importance || [],
        },
        preview: previewData.preview || [],
      },
    }
  },
  evaluate: async (formData) => {
    const datasetFile = formData.get('dataset')
    const modelFile = formData.get('model')
    const targetColumn = (formData.get('targetColumn') || 'target').toString().trim() || 'target'
    const sensitiveColumn = (formData.get('sensitiveColumn') || '').toString().trim()
    const modelNameInput = (formData.get('modelName') || '').toString().trim()
    const datasetNameInput = (formData.get('datasetName') || '').toString().trim()

    const modelName = modelNameInput || cleanBaseName(modelFile?.name, 'model', /\.(pkl|pickle)$/i)
    const datasetName = datasetNameInput || cleanBaseName(datasetFile?.name, 'dataset', /\.csv$/i)
    const version = `v${Date.now()}`

    const modelPayload = new FormData()
    modelPayload.append('name', modelName)
    modelPayload.append('version', version)
    modelPayload.append('target_column', targetColumn)
    modelPayload.append('file', modelFile)

    const datasetPayload = new FormData()
    datasetPayload.append('name', datasetName)
    datasetPayload.append('version', version)
    datasetPayload.append('file', datasetFile)

    const [modelRes, datasetRes] = await Promise.all([
      modelService.upload(modelPayload),
      datasetService.upload(datasetPayload),
    ])

    const modelId = modelRes?.data?.data?.id
    const datasetId = datasetRes?.data?.data?.id

    return evaluateService.evaluateUploaded({ modelId, datasetId, modelName, datasetName, targetColumn, sensitiveColumn })
  },
  history: (limit = 20) => api.get('/evaluations', { params: { limit } }),
}
