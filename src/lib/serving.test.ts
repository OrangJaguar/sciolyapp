/**
 * Deterministic serving-engine checks. Run: npm run test:serving
 */
import assert from 'node:assert/strict'
import {
  buildSessionQueue,
  pickNextQuestion,
  weaknessScore,
  type ServingInput,
} from './serving.ts'
import type { Question } from './types.ts'

function q(
  id: string,
  concept_id: string,
  overrides: Partial<Question> = {},
): Question {
  return {
    id,
    event_id: 'chem_lab',
    topic_id: 't1',
    concept_id,
    question_type: 'mcq',
    status: 'live',
    stem: id,
    options: { A: 'a', B: 'b', C: 'c', D: 'd' },
    correct_key: 'A',
    explanation: '',
    ...overrides,
  }
}

const now = '2026-08-04T12:00:00.000Z'

function base(partial: Partial<ServingInput> & { bank: Question[] }): ServingInput {
  return {
    usedQuestionIds: new Set(),
    weakness: [],
    reinjections: [],
    history: [],
    nowIso: now,
    ...partial,
  }
}

assert.equal(weaknessScore({ concept_id: 'c', total_attempts: 0, correct_attempts: 0 }), 0)
assert.equal(weaknessScore({ concept_id: 'c', total_attempts: 4, correct_attempts: 1 }), 0.75)

// Empty bank
assert.equal(pickNextQuestion(base({ bank: [] })), null)

const bank = [
  q('q-boyle-a', 'boyle'),
  q('q-boyle-b', 'boyle'),
  q('q-ideal-a', 'ideal'),
  q('q-kmt-a', 'kmt'),
]

// Reinjection wins even if another concept is weaker
{
  const next = pickNextQuestion(
    base({
      bank,
      weakness: [
        { concept_id: 'ideal', total_attempts: 10, correct_attempts: 0 },
      ],
      reinjections: [
        {
          id: 'r1',
          question_id: 'q-kmt-a',
          unlock_at: '2026-08-04T11:00:00.000Z',
          resolved: false,
        },
      ],
    }),
  )
  assert.equal(next?.id, 'q-kmt-a')
}

// Future reinjection ignored
{
  const next = pickNextQuestion(
    base({
      bank,
      reinjections: [
        {
          id: 'r1',
          question_id: 'q-kmt-a',
          unlock_at: '2026-08-05T11:00:00.000Z',
          resolved: false,
        },
      ],
      weakness: [
        { concept_id: 'ideal', total_attempts: 5, correct_attempts: 0 },
      ],
    }),
  )
  assert.equal(next?.id, 'q-ideal-a')
}

// Highest weakness preferred
{
  const next = pickNextQuestion(
    base({
      bank,
      weakness: [
        { concept_id: 'boyle', total_attempts: 4, correct_attempts: 3 }, // 0.25
        { concept_id: 'ideal', total_attempts: 4, correct_attempts: 1 }, // 0.75
      ],
    }),
  )
  assert.equal(next?.id, 'q-ideal-a')
}

// Among same concept, stable id order
{
  const next = pickNextQuestion(
    base({
      bank,
      weakness: [
        { concept_id: 'boyle', total_attempts: 2, correct_attempts: 0 },
      ],
    }),
  )
  assert.equal(next?.id, 'q-boyle-a')
}

// Session never repeats
{
  const queue = buildSessionQueue(
    {
      bank,
      weakness: [
        { concept_id: 'boyle', total_attempts: 2, correct_attempts: 0 },
      ],
      reinjections: [],
      history: [],
      nowIso: now,
    },
    10,
  )
  const ids = queue.map((x) => x.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(ids[0], 'q-boyle-a')
  assert.equal(ids[1], 'q-boyle-b')
}

// Uncovered before heavily seen when no weakness
{
  const next = pickNextQuestion(
    base({
      bank,
      history: [
        { question_id: 'q-boyle-a', concept_id: 'boyle' },
        { question_id: 'q-boyle-b', concept_id: 'boyle' },
        { question_id: 'q-ideal-a', concept_id: 'ideal' },
      ],
    }),
  )
  assert.equal(next?.id, 'q-kmt-a')
}

// Used ids excluded
{
  const next = pickNextQuestion(
    base({
      bank,
      usedQuestionIds: new Set(['q-boyle-a', 'q-boyle-b', 'q-ideal-a', 'q-kmt-a']),
    }),
  )
  assert.equal(next, null)
}

console.log('serving engine tests: ok')
