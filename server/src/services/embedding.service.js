const dimensions = 96

const stopwords = new Set(['what', 'who', 'whom', 'whose', 'which', 'when', 'where', 'why', 'how', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'am', 'do', 'does', 'did', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'and', 'or', 'that', 'this', 'it', 'its', 'by', 'from', 'as', 'than', 'then', 'into', 'about', 'has', 'have', 'had', 'more', 'most', 'can', 'could', 'may', 'might', 'will', 'would', 'so', 'very', 'such', 'not', 'no'])

function tokens(value) {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? []
}

function vectorize(words) {
  const vector = Array.from({ length: dimensions }, () => 0)
  for (const token of words) {
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

export function generateEmbedding(value) {
  return vectorize(tokens(value))
}

export function generateQueryEmbedding(value) {
  return vectorize(tokens(value).filter((token) => !stopwords.has(token)))
}

export function cosineSimilarity(left, right) {
  if (!left?.length || left.length !== right?.length) return 0
  return left.reduce((sum, value, index) => sum + value * right[index], 0)
}

export { dimensions }
