export const evaluationMaterial = [
  'Inheritance is a core concept of object-oriented programming where a child class inherits attributes and methods from a parent class. It promotes code reuse and establishes an is-a relationship between classes. In JavaScript a class can extend another class using the extends keyword.',
  'Binary search is an efficient algorithm for finding a target value in a sorted list. It repeatedly divides the search interval in half, comparing the target value to the middle element. Its time complexity is O(log n) and it requires the input to be sorted in advance.',
  'Recursion is a technique where a function calls itself to solve a smaller sub-problem. Every recursive function needs a base case that stops the recursion, and a recursive step that reduces the problem size toward that base case.',
]

export const evaluationCases = [
  {
    id: 'inherit-001',
    category: 'supported',
    expected: 'grounded-answer',
    question: 'What is inheritance in object oriented programming?',
    rationale: 'Directly covered by the seeded material — answer should be grounded and carry citations.',
  },
  {
    id: 'binary-001',
    category: 'supported',
    expected: 'grounded-answer',
    question: 'How does binary search work?',
    rationale: 'Directly covered by the seeded material — answer should be grounded and carry citations.',
  },
  {
    id: 'recursion-001',
    category: 'supported',
    expected: 'grounded-answer',
    question: 'Explain recursion and its base case.',
    rationale: 'Directly covered by the seeded material — answer should be grounded and carry citations.',
  },
  {
    id: 'unsupported-001',
    category: 'unsupported',
    expected: 'refusal',
    question: 'Who won the 1902 world cup?',
    rationale: 'No evidence in the material — the tutor should refuse instead of inventing an answer.',
  },
  {
    id: 'unsupported-002',
    category: 'unsupported',
    expected: 'refusal',
    question: 'What is the tallest building in Lagos?',
    rationale: 'No evidence in the material — the tutor should refuse instead of inventing an answer.',
  },
]