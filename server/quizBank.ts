import fs from 'fs';
import path from 'path';
import type {
  CefrLevel,
  OptionId,
  PublicQuizQuestion,
  QuizBankData,
  ServerQuizQuestion,
} from '../src/types/quiz.ts';

const VALID_OPTION_IDS: OptionId[] = ['A', 'B', 'C', 'D'];

const QUIZ_FILE_MAP: Record<CefrLevel, string> = {
  B1: path.resolve(process.cwd(), 'public/assets/aistudio/quiz-b1_25047a95.json'),
  B2: path.resolve(process.cwd(), 'public/assets/aistudio/quiz-b2_cf53de48.json'),
  C1: path.resolve(process.cwd(), 'public/assets/aistudio/quiz-c1_ce32cd92.json'),
};

const quizCache = new Map<CefrLevel, QuizBankData>();

function isValidOptionId(value: unknown): value is OptionId {
  return typeof value === 'string' && VALID_OPTION_IDS.includes(value as OptionId);
}

function validateAndAdaptQuestion(raw: unknown, expectedLevel: CefrLevel, index: number): ServerQuizQuestion {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid question structure at index ${index} for level ${expectedLevel}.`);
  }

  const item = raw as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  const question = typeof item.question === 'string' ? item.question : '';
  const correctOptionId = item.correctOptionId;
  const explanationVi = typeof item.explanationVi === 'string' ? item.explanationVi : '';

  if (!id || !question || !isValidOptionId(correctOptionId) || !explanationVi) {
    throw new Error(`Missing required fields in question ${id || `#${index + 1}`} for level ${expectedLevel}.`);
  }

  if (!Array.isArray(item.options) || item.options.length !== 4) {
    throw new Error(`Question ${id} in level ${expectedLevel} must have exactly 4 options.`);
  }

  const options = item.options.map((opt, optIdx) => {
    if (!opt || typeof opt !== 'object') {
      throw new Error(`Invalid option at index ${optIdx} in question ${id}.`);
    }
    const o = opt as Record<string, unknown>;
    if (!isValidOptionId(o.id) || typeof o.text !== 'string' || !o.text.trim()) {
      throw new Error(`Invalid option schema in question ${id}.`);
    }
    return {
      id: o.id,
      text: o.text,
    };
  });

  if (!options.some((o) => o.id === correctOptionId)) {
    throw new Error(`correctOptionId '${correctOptionId}' not found among options in question ${id}.`);
  }

  const distractorExplanationsVi: Partial<Record<OptionId, string>> = {};
  if (item.distractorExplanationsVi && typeof item.distractorExplanationsVi === 'object') {
    const rawDistractors = item.distractorExplanationsVi as Record<string, unknown>;
    for (const key of VALID_OPTION_IDS) {
      if (typeof rawDistractors[key] === 'string') {
        distractorExplanationsVi[key] = rawDistractors[key] as string;
      }
    }
  }

  return {
    id,
    type: 'multiple_choice',
    skill: typeof item.skill === 'string' ? item.skill : 'general',
    learningObjective: typeof item.learningObjective === 'string' ? item.learningObjective : '',
    sourceReferences: Array.isArray(item.sourceReferences)
      ? item.sourceReferences.filter((ref): ref is string => typeof ref === 'string')
      : [],
    bloomLevel: typeof item.bloomLevel === 'string' ? item.bloomLevel : '',
    difficulty: typeof item.difficulty === 'string' ? item.difficulty : '',
    question,
    options,
    correctOptionId,
    explanationVi,
    distractorExplanationsVi,
  };
}

function loadQuizFile(level: CefrLevel): QuizBankData {
  const filePath = QUIZ_FILE_MAP[level];
  if (!fs.existsSync(filePath)) {
    throw new Error(`Quiz source file for level ${level} was not found at expected location.`);
  }

  let parsed: unknown;
  try {
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    parsed = JSON.parse(rawContent);
  } catch (err) {
    throw new Error(
      `Failed to read or parse quiz JSON for level ${level}: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Quiz JSON for level ${level} is not a valid JSON object.`);
  }

  const data = parsed as Record<string, unknown>;
  if (data.level !== level) {
    throw new Error(`Level mismatch in quiz JSON: expected ${level}, found ${String(data.level)}.`);
  }

  if (!Array.isArray(data.questions) || data.questions.length !== 6) {
    throw new Error(
      `Quiz JSON for level ${level} must contain exactly 6 questions (found ${Array.isArray(data.questions) ? data.questions.length : 0}).`
    );
  }

  const questions = data.questions.map((q, idx) => validateAndAdaptQuestion(q, level, idx));
  const passScore =
    typeof data.passScore === 'number' && Number.isInteger(data.passScore) && data.passScore >= 1 && data.passScore <= 6
      ? data.passScore
      : 5;

  return {
    schemaVersion: typeof data.schemaVersion === 'string' ? data.schemaVersion : '1.0',
    title: typeof data.title === 'string' ? data.title : 'Healthy Lifestyle Quiz',
    level,
    language: typeof data.language === 'string' ? data.language : 'en-GB',
    questionCount: questions.length,
    passScore,
    status: typeof data.status === 'string' ? data.status : undefined,
    questions,
  };
}

export function initializeQuizBanks(): Record<CefrLevel, QuizBankData> {
  const levels: CefrLevel[] = ['B1', 'B2', 'C1'];
  for (const level of levels) {
    const loaded = loadQuizFile(level);
    quizCache.set(level, loaded);
  }
  return {
    B1: quizCache.get('B1')!,
    B2: quizCache.get('B2')!,
    C1: quizCache.get('C1')!,
  };
}

export function getServerQuizBank(level: CefrLevel): QuizBankData {
  const cached = quizCache.get(level);
  if (cached) {
    return cached;
  }
  const loaded = loadQuizFile(level);
  quizCache.set(level, loaded);
  return loaded;
}

export function toPublicQuestions(questions: ServerQuizQuestion[]): PublicQuizQuestion[] {
  return questions.map((q) => ({
    id: q.id,
    type: q.type,
    skill: q.skill,
    learningObjective: q.learningObjective,
    sourceReferences: [...q.sourceReferences],
    bloomLevel: q.bloomLevel,
    difficulty: q.difficulty,
    question: q.question,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
  }));
}

export function isValidCefrLevel(value: unknown): value is CefrLevel {
  return value === 'B1' || value === 'B2' || value === 'C1';
}

export function getQuizSummaries(): Array<{
  level: CefrLevel;
  questionCount: number;
  passScore: number;
  title: string;
}> {
  return (['B1', 'B2', 'C1'] as CefrLevel[]).map((level) => {
    const bank = getServerQuizBank(level);
    return {
      level: bank.level,
      questionCount: bank.questionCount,
      passScore: bank.passScore,
      title: bank.title,
    };
  });
}
