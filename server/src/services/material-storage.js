import { mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import env from '../config/env.js'

export async function saveMaterialFile(materialId, buffer) {
  const storageKey = join('materials', `${materialId}.pdf`)
  const filePath = join(env.storageDirectory, storageKey)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, buffer)
  return storageKey
}

export function readMaterialFile(storageKey) {
  return readFile(join(env.storageDirectory, storageKey))
}

export function deleteMaterialFile(storageKey) {
  return rm(join(env.storageDirectory, storageKey), { force: true })
}
