import multer from 'multer'
import path from 'path'

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 50)

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase()
  if (file.fieldname === 'dataset' && ext !== '.csv') {
    return cb(new Error('Only .csv is allowed for dataset'))
  }
  if (file.fieldname === 'model' && !['.pkl', '.pickle'].includes(ext)) {
    return cb(new Error('Only .pkl/.pickle is allowed for model'))
  }
  cb(null, true)
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadMb * 1024 * 1024 },
  fileFilter,
})
