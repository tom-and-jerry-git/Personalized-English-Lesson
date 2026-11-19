export type CefrLevel = 'B1' | 'B2' | 'C1';

export type OptionId = 'A' | 'B' | 'C' | 'D';

export interface QuizOption {
  id: OptionId;
  text: string;
}

export interface PublicQuizQuestion {
  id: string;
  type: 'multiple_choice';
  skill: 'vocabulary' | 'grammar' | string;
  learningObjective: string;
  sourceReferences: string[];
  bloomLevel: string;
  difficulty: string;
  question: string;
  options: QuizOption[];
}

export interface ServerQuizQuestion extends PublicQuizQuestion {
  correctOptionId: OptionId;
  explanationVi: string;
  distractorExplanationsVi: Partial<Record<OptionId, string>>;
}

export interface QuizBankData {
  schemaVersion: string;
  title: string;
  level: CefrLevel;
  language: string;
  questionCount: number;
  passScore: number;
  status?: string;
  questions: ServerQuizQuestion[];
}

export interface PublicQuizPayload {
  attemptId: string;
  level: CefrLevel;
  title: string;
  questionCount: number;
  passScore: number;
  expiresAt: string;
  questions: PublicQuizQuestion[];
}

export interface GradedQuestionReview {
  questionId: string;
  skill: string;
  learningObjective: string;
  sourceReferences: string[];
  bloomLevel: string;
  difficulty: string;
  question: string;
  options: QuizOption[];
  selectedOptionId: OptionId | null;
  selectedOptionText: string | null;
  correctOptionId: OptionId;
  correctOptionText: string;
  isCorrect: boolean;
  explanationVi: string;
  distractorExplanationsVi: Partial<Record<OptionId, string>>;
}

export interface GradingResult {
  attemptId: string;
  level: CefrLevel;
  title: string;
  score: number;
  maxScore: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  percentage: number;
  passScore: number;
  passed: boolean;
  passThresholdNote: string;
  submittedAt: string;
  review: GradedQuestionReview[];
}

export interface OverallFeedbackData {
  overallPerformance: string;
  whatYouDidWell: string;
  mistakesExplained: string;
  grammarFeedback: string;
  vocabularyFeedback: string;
  recommendedReview: string;
  nextPractice: string;
  encouragement: string;
}

export interface TutorChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode: 'conceptual_help' | 'answer_explanation';
}

export interface TutorReplyPayload {
  reply: string;
  mode: 'conceptual_help' | 'answer_explanation';
  questionId: string;
  level: CefrLevel;
  turnsUsed: number;
  turnsLimit: number;
  cached: boolean;
  model: string;
}

export interface AppRuntimeConfig {
  appName: string;
  topic: string;
  groqConfigured: boolean;
  groqModel: string;
  canvaViewUrl: string | null;
  limits: {
    preSubmitTurnsPerQuestion: number;
    postSubmitTurnsPerQuestion: number;
  };
  levels: Array<{
    level: CefrLevel;
    questionCount: number;
    passScore: number;
    title: string;
  }>;
}

export interface ApiErrorPayload {
  error: string;
  code:
    | 'AI_NOT_CONFIGURED'
    | 'INVALID_API_KEY'
    | 'MODEL_UNAVAILABLE'
    | 'RATE_LIMITED'
    | 'TURN_LIMIT_REACHED'
    | 'TIMEOUT'
    | 'VALIDATION_ERROR'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'QUIZ_DATA_ERROR'
    | 'UPSTREAM_ERROR';
  retryable?: boolean;
  details?: string;
}
