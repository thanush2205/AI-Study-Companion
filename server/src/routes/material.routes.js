import express from 'express'
import { Chunk, Material } from '../models/index.js'
import { authenticate } from '../middleware/auth.js'
import { requireMaterialAccess } from '../middleware/material-access.js'

const router = express.Router()

router.use(authenticate)

router.get('/:id', requireMaterialAccess, async (request, response, next) => {
  try {
    const chunks = await Chunk.find({ materialId: request.material._id }).sort({ chunkIndex: 1 }).select('chunkIndex content pageNumber').lean()
    return response.json({ material: request.material, chunks })
  } catch (error) {
    return next(error)
  }
})

router.delete('/:id', requireMaterialAccess, async (request, response, next) => {
  try {
    await Chunk.deleteMany({ materialId: request.material._id })
    await Material.findByIdAndDelete(request.material._id)
    return response.status(204).send()
  } catch (error) {
    return next(error)
  }
})

export default router