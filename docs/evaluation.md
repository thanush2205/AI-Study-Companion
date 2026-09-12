# Evaluation Path

The first demonstrable slice should prove grounded answering, citation rendering, and refusal when the supplied material does not support an answer. Quiz generation, assessment, mastery updates, growth trends, analytics, recommendations, and admin controls extend that same traceable loop.

## AI quality evaluation

A lightweight evaluation runner exercises the tutor pipeline through five seeded cases — three grounded-answering cases with expected citations, and two refusal cases whose topics do not appear in the seed material. The runner seeds a dedicated evaluation space with three paragraph-length study texts, invokes `answerQuestion` through the normal retrieval path, and scores each result along four boolean axes: grounded, cited, refused, and correct.

Evaluation runs persist to the `AIEvaluation` collection, grouped by run identifier. The admin endpoints `GET /api/admin/evaluation` and `POST /api/admin/evaluation/run` surface the results, producing a summary with pass rate, grounded rate, and refusal rate.

### Retrieval quality finding

The original 96-dimensional bag-of-words hash embedding produces significant false-positive grounding — common-English questions routinely collide with unrelated seed-material buckets. Removing stopwords from the query embedding (while keeping the chunk embedding path unchanged) reduces false-positive cosine scores below the 0.18 evidence threshold without altering the stored vector space, the tutor output contract, or existing section behaviour.

### Test dataset

Supported:

| Question | Expected | Grounded | Cited | Correct |
|---|---|---|---|---|
| What is inheritance in object oriented programming? | grounded-answer | ✓ | ✓ | ✓ |
| How does binary search work on a sorted list? | grounded-answer | ✓ | ✓ | ✓ |
| Explain recursion and its base case. | grounded-answer | ✓ | ✓ | ✓ |

Unsupported:

| Question | Expected | Refused | Correct |
|---|---|---|---|
| Who won the 1902 world cup? | refusal | ✓ | ✓ |
| What is the tallest building in Lagos? | refusal | ✓ | ✓ |
