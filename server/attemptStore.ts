import crypto from 'crypto';
import type {
  CefrLevel,
  GradedQuestionReview,
  GradingResult,
  OptionId,
  OverallFeedbackData,
} from '../src/types/quiz.ts';
import { getServerQuizBank } from './quizBank.ts';

export const ATTEMPT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
export const MAX_PRE_SUBMIT_TURNS_PER_QUESTION = 3;
export const MAX_POST_SUBMIT_TURNS_PER_QUESTION = 5;
const MAX_ACTIVE_ATTEMPTS = 500;

export interface QuizAttemptRecord {
  attemptId: string;
  level: CefrLevel;
  createdAt: number;
  expiresAt: number;
  submitted: boolean;
  submittedAnswers: Record<string, OptionId | null>;
  gradingResult: GradingResult | null;
  overallFeedback: OverallFeedbackData | null;
  overallFeedbackModel: string | null;
  preSubmitTurns: Record<string, number>;
  postSubmitTurns: Record<string, number>;
  questionResponseCache: Map<string, string>;
  inFlightKeys: Set<string>;
}

const attempts = new Map<string, QuizAttemptRecord>();

function cleanupExpiredAttempts(): void {
  const now = Date.now();
  for (const [id, record] of attempts.entries()) {
    if (record.expiresAt <= now) {
      attempts.delete(id);
    }
  }
  if (attempts.size > MAX_ACTIVE_ATTEMPTS) {
    const sorted = Array.from(attempts.entries()).sort((a, b) => a[1].createdAt - b[1].createdAt);
    const excess = attempts.size - MAX_ACTIVE_ATTEMPTS;
    for (let i = 0; i < excess; i++) {
      attempts.delete(sorted[i][0]);
    }
  }
}

export function createAttempt(level: CefrLevel): QuizAttemptRecord {
  cleanupExpiredAttempts();
  const now = Date.now();
  const attemptId = crypto.randomUUID();
  const record: QuizAttemptRecord = {
    attemptId,
    level,
    createdAt: now,
    expiresAt: now + ATTEMPT_TTL_MS,
    submitted: false,
    submittedAnswers: {},
    gradingResult: null,
    overallFeedback: null,
    overallFeedbackModel: null,
    preSubmitTurns: {},
    postSubmitTurns: {},
    questionResponseCache: new Map(),
    inFlightKeys: new Set(),
  };
  attempts.set(attemptId, record);
  return record;
}

export function getAttempt(attemptId: string): QuizAttemptRecord | null {
  if (!attemptId || typeof attemptId !== 'string') {
    return null;
  }
  const record = attempts.get(attemptId);
  if (!record) {
    return null;
  }
  if (record.expiresAt <= Date.now()) {
    attempts.delete(attemptId);
    return null;
  }
  return record;
}

const VALID_OPTIONS = new Set<OptionId>(['A', 'B', 'C', 'D']);

export function gradeAndFinalizeAttempt(
  attempt: QuizAttemptRecord,
  rawAnswers: Record<string, unknown>
): GradingResult {
  if (attempt.submitted && attempt.gradingResult) {
    return attempt.gradingResult;
  }

  const bank = getServerQuizBank(attempt.level);
  const review: GradedQuestionReview[] = [];
  const normalizedAnswers: Record<string, OptionId | null> = {};

  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  for (const q of bank.questions) {
    const rawVal = rawAnswers[q.id];
    const selectedOptionId: OptionId | null =
      typeof rawVal === 'string' && VALID_OPTIONS.has(rawVal as OptionId) ? (rawVal as OptionId) : null;

    normalizedAnswers[q.id] = selectedOptionId;

    const selectedOption = selectedOptionId ? q.options.find((o) => o.id === selectedOptionId) ?? null : null;
    const correctOption = q.options.find((o) => o.id === q.correctOptionId)!;
    const isCorrect = selectedOptionId !== null && selectedOptionId === q.correctOptionId;

    if (isCorrect) {
      correctCount += 1;
    } else if (selectedOptionId === null) {
      unansweredCount += 1;
      incorrectCount += 1;
    } else {
      incorrectCount += 1;
    }

    review.push({
      questionId: q.id,
      skill: q.skill,
      learningObjective: q.learningObjective,
      sourceReferences: [...q.sourceReferences],
      bloomLevel: q.bloomLevel,
      difficulty: q.difficulty,
      question: q.question,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
      selectedOptionId,
      selectedOptionText: selectedOption ? selectedOption.text : null,
      correctOptionId: q.correctOptionId,
      correctOptionText: correctOption.text,
      isCorrect,
      explanationVi: q.explanationVi,
      distractorExplanationsVi: { ...q.distractorExplanationsVi },
    });
  }

  const maxScore = bank.questions.length;
  const score = correctCount;
  const percentage = Math.round((score / maxScore) * 100);
  const passScore = bank.passScore || 5;
  const passed = score >= passScore;

  const result: GradingResult = {
    attemptId: attempt.attemptId,
    level: bank.level,
    title: bank.title,
    score,
    maxScore,
    correctCount,
    incorrectCount,
    unansweredCount,
    percentage,
    passScore,
    passed,
    passThresholdNote: `Lesson quiz benchmark: ${passScore}/${maxScore} correct answers. This score reflects performance on this practice quiz only and is not an official CEFR certification.`,
    submittedAt: new Date().toISOString(),
    review,
  };

  attempt.submitted = true;
  attempt.submittedAnswers = normalizedAnswers;
  attempt.gradingResult = result;

  return result;
}

// Simple in-memory sliding-window rate limiter per client IP
const rateBuckets = new Map<string, number[]>();

export function checkRateLimit(bucketKey: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (rateBuckets.get(bucketKey) ?? []).filter((ts) => ts > cutoff);
  if (timestamps.length >= maxRequests) {
    rateBuckets.set(bucketKey, timestamps);
    return false;
  }
  timestamps.push(now);
  rateBuckets.set(bucketKey, timestamps);
  return true;
}

export function buildCacheKey(parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join('||')).digest('hex');
}
