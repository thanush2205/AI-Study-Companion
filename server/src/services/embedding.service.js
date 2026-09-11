const dimensions = 96

function tokens(value) {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? []
}

export function generateEmbedding(value) {
  const vector = Array.from({ length: dimensions }, () => 0)
  for (const token of tokens(value)) {
    let hash = 2166136261
    for (const character of token) {
      hash ^= character.charCodeAt(0)
      hash = Math.imul(hash, 16777619)
    }
    const index = Math.abs(hash) % dimensions
    vector[index] += 1
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0)) || 1
  return vector.map((value) => value / magnitude)
}

export function cosineSimilarity(left, right) {
  if (!left?.length || left.length !== right?.length) return 0
  return left.reduce((sum, value, index) => sum + value * right[index], 0)
}

export { dimensions }
