import mongoose from 'mongoose'

const EvaluationResultSchema = new mongoose.Schema(
  {
    modelName: { type: String, required: true, trim: true },
    datasetName: { type: String, required: true, trim: true },
    targetColumn: { type: String, default: 'target' },
    metrics: {
      accuracy: Number,
      precision: Number,
      recall: Number,
      f1: Number,
    },
    confusionMatrix: [[Number]],
    fairness: mongoose.Schema.Types.Mixed,
    explainability: mongoose.Schema.Types.Mixed,
    preview: [mongoose.Schema.Types.Mixed],
    metadata: mongoose.Schema.Types.Mixed,
    evaluatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
)

export default mongoose.model('EvaluationResult', EvaluationResultSchema)
