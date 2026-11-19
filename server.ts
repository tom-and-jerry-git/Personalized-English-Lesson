import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getQuizSummaries,
  getServerQuizBank,
  initializeQuizBanks,
  isValidCefrLevel,
  toPublicQuestions,
} from './server/quizBank.ts';
import {
  buildCacheKey,
  checkRateLimit,
  createAttempt,
  getAttempt,
  gradeAndFinalizeAttempt,
  MAX_POST_SUBMIT_TURNS_PER_QUESTION,
  MAX_PRE_SUBMIT_TURNS_PER_QUESTION,
} from './server/attemptStore.ts';
import {
  generateOverallFeedback,
  generatePostSubmitExplanation,
  generatePreSubmitHelp,
  getConfiguredGroqModel,
  GroqServiceError,
  isGroqConfigured,
  sanitizeHistory,
  sanitizeLearnerText,
  verifyGroqModelAvailability,
} from './server/groqService.ts';
import type { ApiErrorPayload, AppRuntimeConfig, PublicQuizPayload } from './src/types/quiz.ts';

const DEFAULT_CANVA_VIEW_URL = 'https://canva.link/twmsnan0sbdalks';

function validateSafeCanvaUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    // Never allow Canva /edit URLs to be served to learners
    if (/\/edit(\/|$)/i.test(parsed.pathname)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function getSafeCanvaViewUrl(): string | null {
  return validateSafeCanvaUrl(process.env.CANVA_VIEW_URL) ?? validateSafeCanvaUrl(DEFAULT_CANVA_VIEW_URL);
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function sendError(res: Response, status: number, payload: ApiErrorPayload): void {
  res.status(status).json(payload);
}

export function createExpressApp(): { app: express.Express; quizLoadError: string | null } {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  let quizLoadError: string | null = null;
  try {
    initializeQuizBanks();
  } catch (err) {
    quizLoadError = err instanceof Error ? err.message : 'Failed to load quiz JSON banks.';
    console.error('[QuizBank] Startup error:', quizLoadError);
  }

  // Security guard: block direct public HTTP access to uploaded answer-key JSON files
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (/^\/assets\/aistudio\/quiz-.*\.json$/i.test(req.path)) {
      res.status(403).json({
        error: 'Direct access to raw quiz bank files is restricted.',
        code: 'NOT_FOUND',
      });
      return;
    }
    next();
  });

  // 1. GET /api/health
  app.get('/api/health', (_req: Request, res: Response) => {
    if (quizLoadError) {
      res.status(500).json({
        status: 'degraded',
        quizBanksLoaded: false,
        error: quizLoadError,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({
      status: 'ok',
      quizBanksLoaded: true,
      levelsAvailable: ['B1', 'B2', 'C1'],
      timestamp: new Date().toISOString(),
    });
  });

  // 2. GET /api/health/ai
  app.get('/api/health/ai', async (req: Request, res: Response) => {
    const forceCheck = req.query.refresh === 'true';
    const status = await verifyGroqModelAvailability(forceCheck);
    res.json({
      groqConfiguration: status.configured ? 'configured' : 'not_configured',
      model: status.model,
      connectivity: status.connectivity,
      message: status.message,
    });
  });

  // 3. GET /api/config
  app.get('/api/config', (_req: Request, res: Response) => {
    if (quizLoadError) {
      sendError(res, 500, {
        error: `Unable to load quiz JSON files: ${quizLoadError}`,
        code: 'QUIZ_DATA_ERROR',
      });
      return;
    }

    const config: AppRuntimeConfig = {
      appName: 'Personalized English Lesson',
      topic: 'Healthy Lifestyle',
      groqConfigured: isGroqConfigured(),
      groqModel: getConfiguredGroqModel(),
      canvaViewUrl: getSafeCanvaViewUrl(),
      limits: {
        preSubmitTurnsPerQuestion: MAX_PRE_SUBMIT_TURNS_PER_QUESTION,
        postSubmitTurnsPerQuestion: MAX_POST_SUBMIT_TURNS_PER_QUESTION,
      },
      levels: getQuizSummaries(),
    };
    res.json(config);
  });

  // 4. POST /api/quiz/start
  app.post('/api/quiz/start', (req: Request, res: Response) => {
    if (quizLoadError) {
      sendError(res, 500, {
        error: `Quiz bank error: ${quizLoadError}`,
        code: 'QUIZ_DATA_ERROR',
      });
      return;
    }

    const level = req.body?.level;
    if (!isValidCefrLevel(level)) {
      sendError(res, 400, {
        error: 'Invalid CEFR level. Please select B1, B2, or C1.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const ip = getClientIp(req);
    if (!checkRateLimit(`start:${ip}`, 30, 60_000)) {
      sendError(res, 429, {
        error: 'Too many quiz start requests. Please wait a moment.',
        code: 'RATE_LIMITED',
        retryable: true,
      });
      return;
    }

    const bank = getServerQuizBank(level);
    const attempt = createAttempt(level);

    const payload: PublicQuizPayload = {
      attemptId: attempt.attemptId,
      level: bank.level,
      title: bank.title,
      questionCount: bank.questionCount,
      passScore: bank.passScore,
      expiresAt: new Date(attempt.expiresAt).toISOString(),
      questions: toPublicQuestions(bank.questions),
    };

    res.status(201).json(payload);
  });

  // 5. POST /api/quiz/submit
  app.post('/api/quiz/submit', (req: Request, res: Response) => {
    if (quizLoadError) {
      sendError(res, 500, {
        error: `Quiz bank error: ${quizLoadError}`,
        code: 'QUIZ_DATA_ERROR',
      });
      return;
    }

    const attemptId = typeof req.body?.attemptId === 'string' ? req.body.attemptId.trim() : '';
    const answers = req.body?.answers;

    if (!attemptId) {
      sendError(res, 400, {
        error: 'Missing attemptId.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      sendError(res, 400, {
        error: 'Answers must be an object mapping question IDs to selected option IDs.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const attempt = getAttempt(attemptId);
    if (!attempt) {
      sendError(res, 404, {
        error: 'Quiz attempt not found or expired. Please start a new quiz attempt.',
        code: 'NOT_FOUND',
      });
      return;
    }

    // Prevent duplicate re-grading; return existing trusted grading result if already submitted
    if (attempt.submitted && attempt.gradingResult) {
      res.json(attempt.gradingResult);
      return;
    }

    const result = gradeAndFinalizeAttempt(attempt, answers as Record<string, unknown>);
    res.json(result);
  });

  // 6. POST /api/ai/question-help (Before Submit — Conceptual Help Mode)
  app.post('/api/ai/question-help', async (req: Request, res: Response) => {
    const attemptId = typeof req.body?.attemptId === 'string' ? req.body.attemptId.trim() : '';
    const questionId = typeof req.body?.questionId === 'string' ? req.body.questionId.trim() : '';
    const learnerQuestion = sanitizeLearnerText(req.body?.learnerQuestion, 600);
    const history = sanitizeHistory(req.body?.history, 6);

    if (!attemptId || !questionId || !learnerQuestion) {
      sendError(res, 400, {
        error: 'Please provide attemptId, questionId, and a non-empty question.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const attempt = getAttempt(attemptId);
    if (!attempt) {
      sendError(res, 404, {
        error: 'Quiz attempt not found or expired. Please start a new quiz.',
        code: 'NOT_FOUND',
      });
      return;
    }

    if (attempt.submitted) {
      sendError(res, 409, {
        error: 'This quiz attempt has already been submitted. Use Answer Explanation Mode in Review Answers.',
        code: 'CONFLICT',
      });
      return;
    }

    const bank = getServerQuizBank(attempt.level);
    const publicQuestions = toPublicQuestions(bank.questions);
    const targetQuestion = publicQuestions.find((q) => q.id === questionId);

    if (!targetQuestion) {
      sendError(res, 400, {
        error: `Question ${questionId} does not belong to level ${attempt.level}.`,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    if (!isGroqConfigured()) {
      sendError(res, 503, {
        error: 'AI Tutor requires Groq API configuration',
        code: 'AI_NOT_CONFIGURED',
        retryable: false,
      });
      return;
    }

    const ip = getClientIp(req);
    if (!checkRateLimit(`ai:${ip}`, 25, 60_000)) {
      sendError(res, 429, {
        error: 'Too many AI Tutor requests. Please wait a moment and try again.',
        code: 'RATE_LIMITED',
        retryable: true,
      });
      return;
    }

    const turnsUsed = attempt.preSubmitTurns[questionId] ?? 0;
    const cacheKey = buildCacheKey([
      'pre',
      attempt.level,
      questionId,
      learnerQuestion.toLowerCase(),
      JSON.stringify(history.slice(-2)),
    ]);

    const cachedReply = attempt.questionResponseCache.get(cacheKey);
    if (cachedReply) {
      res.json({
        reply: cachedReply,
        mode: 'conceptual_help',
        questionId,
        level: attempt.level,
        turnsUsed,
        turnsLimit: MAX_PRE_SUBMIT_TURNS_PER_QUESTION,
        cached: true,
        model: getConfiguredGroqModel(),
      });
      return;
    }

    if (turnsUsed >= MAX_PRE_SUBMIT_TURNS_PER_QUESTION) {
      sendError(res, 429, {
        error: `You have reached the ${MAX_PRE_SUBMIT_TURNS_PER_QUESTION}-question limit for Conceptual Help Mode on this item. Submit the quiz to unlock full Answer Explanation Mode.`,
        code: 'TURN_LIMIT_REACHED',
        retryable: false,
      });
      return;
    }

    const lockKey = `pre:${questionId}`;
    if (attempt.inFlightKeys.has(lockKey)) {
      sendError(res, 409, {
        error: 'Your AI tutor is already answering a question for this item. Please wait.',
        code: 'CONFLICT',
        retryable: true,
      });
      return;
    }

    attempt.inFlightKeys.add(lockKey);
    try {
      const { reply, model } = await generatePreSubmitHelp({
        level: attempt.level,
        question: targetQuestion,
        learnerQuestion,
        history,
      });

      const nextTurns = turnsUsed + 1;
      attempt.preSubmitTurns[questionId] = nextTurns;
      attempt.questionResponseCache.set(cacheKey, reply);

      res.json({
        reply,
        mode: 'conceptual_help',
        questionId,
        level: attempt.level,
        turnsUsed: nextTurns,
        turnsLimit: MAX_PRE_SUBMIT_TURNS_PER_QUESTION,
        cached: false,
        model,
      });
    } catch (err) {
      if (err instanceof GroqServiceError) {
        sendError(res, err.statusCode, {
          error: err.message,
          code: err.code,
          retryable: err.retryable,
        });
      } else {
        sendError(res, 502, {
          error: 'Unable to reach AI Tutor right now. Please retry.',
          code: 'UPSTREAM_ERROR',
          retryable: true,
        });
      }
    } finally {
      attempt.inFlightKeys.delete(lockKey);
    }
  });

  // 7. POST /api/ai/question-explanation (After Submit — Answer Explanation Mode)
  app.post('/api/ai/question-explanation', async (req: Request, res: Response) => {
    const attemptId = typeof req.body?.attemptId === 'string' ? req.body.attemptId.trim() : '';
    const questionId = typeof req.body?.questionId === 'string' ? req.body.questionId.trim() : '';
    const learnerQuestion = sanitizeLearnerText(req.body?.learnerQuestion, 600);
    const history = sanitizeHistory(req.body?.history, 8);

    if (!attemptId || !questionId || !learnerQuestion) {
      sendError(res, 400, {
        error: 'Please provide attemptId, questionId, and a non-empty follow-up question.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const attempt = getAttempt(attemptId);
    if (!attempt) {
      sendError(res, 404, {
        error: 'Quiz attempt not found or expired. Please start a new quiz.',
        code: 'NOT_FOUND',
      });
      return;
    }

    if (!attempt.submitted || !attempt.gradingResult) {
      sendError(res, 409, {
        error: 'Answer Explanation Mode is only available after submitting the quiz.',
        code: 'CONFLICT',
      });
      return;
    }

    const bank = getServerQuizBank(attempt.level);
    const serverQuestion = bank.questions.find((q) => q.id === questionId);
    const gradedItem = attempt.gradingResult.review.find((r) => r.questionId === questionId);

    if (!serverQuestion || !gradedItem) {
      sendError(res, 400, {
        error: `Question ${questionId} does not belong to this ${attempt.level} attempt.`,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    if (!isGroqConfigured()) {
      sendError(res, 503, {
        error: 'AI Tutor requires Groq API configuration',
        code: 'AI_NOT_CONFIGURED',
        retryable: false,
      });
      return;
    }

    const ip = getClientIp(req);
    if (!checkRateLimit(`ai:${ip}`, 25, 60_000)) {
      sendError(res, 429, {
        error: 'Too many AI Tutor requests. Please wait a moment and try again.',
        code: 'RATE_LIMITED',
        retryable: true,
      });
      return;
    }

    const turnsUsed = attempt.postSubmitTurns[questionId] ?? 0;
    const cacheKey = buildCacheKey([
      'post',
      attempt.level,
      questionId,
      learnerQuestion.toLowerCase(),
      JSON.stringify(history.slice(-2)),
    ]);

    const cachedReply = attempt.questionResponseCache.get(cacheKey);
    if (cachedReply) {
      res.json({
        reply: cachedReply,
        mode: 'answer_explanation',
        questionId,
        level: attempt.level,
        turnsUsed,
        turnsLimit: MAX_POST_SUBMIT_TURNS_PER_QUESTION,
        cached: true,
        model: getConfiguredGroqModel(),
      });
      return;
    }

    if (turnsUsed >= MAX_POST_SUBMIT_TURNS_PER_QUESTION) {
      sendError(res, 429, {
        error: `You have reached the ${MAX_POST_SUBMIT_TURNS_PER_QUESTION}-turn follow-up limit for ${questionId} in this attempt.`,
        code: 'TURN_LIMIT_REACHED',
        retryable: false,
      });
      return;
    }

    const lockKey = `post:${questionId}`;
    if (attempt.inFlightKeys.has(lockKey)) {
      sendError(res, 409, {
        error: 'Your AI tutor is already answering this question. Please wait.',
        code: 'CONFLICT',
        retryable: true,
      });
      return;
    }

    attempt.inFlightKeys.add(lockKey);
    try {
      const { reply, model } = await generatePostSubmitExplanation({
        level: attempt.level,
        question: serverQuestion,
        selectedOptionId: gradedItem.selectedOptionId,
        selectedOptionText: gradedItem.selectedOptionText,
        isCorrect: gradedItem.isCorrect,
        learnerQuestion,
        history,
      });

      const nextTurns = turnsUsed + 1;
      attempt.postSubmitTurns[questionId] = nextTurns;
      attempt.questionResponseCache.set(cacheKey, reply);

      res.json({
        reply,
        mode: 'answer_explanation',
        questionId,
        level: attempt.level,
        turnsUsed: nextTurns,
        turnsLimit: MAX_POST_SUBMIT_TURNS_PER_QUESTION,
        cached: false,
        model,
      });
    } catch (err) {
      if (err instanceof GroqServiceError) {
        sendError(res, err.statusCode, {
          error: err.message,
          code: err.code,
          retryable: err.retryable,
        });
      } else {
        sendError(res, 502, {
          error: 'Unable to reach AI Tutor right now. Please retry.',
          code: 'UPSTREAM_ERROR',
          retryable: true,
        });
      }
    } finally {
      attempt.inFlightKeys.delete(lockKey);
    }
  });

  // 8. POST /api/ai/overall-feedback (After Submit — 1 Groq call cached per attempt)
  app.post('/api/ai/overall-feedback', async (req: Request, res: Response) => {
    const attemptId = typeof req.body?.attemptId === 'string' ? req.body.attemptId.trim() : '';

    if (!attemptId) {
      sendError(res, 400, {
        error: 'Missing attemptId.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const attempt = getAttempt(attemptId);
    if (!attempt) {
      sendError(res, 404, {
        error: 'Quiz attempt not found or expired. Please start a new quiz.',
        code: 'NOT_FOUND',
      });
      return;
    }

    if (!attempt.submitted || !attempt.gradingResult) {
      sendError(res, 409, {
        error: 'Overall AI Feedback is available only after submitting the quiz.',
        code: 'CONFLICT',
      });
      return;
    }

    // Serve cached report so navigating tabs never burns another Groq API call
    if (attempt.overallFeedback) {
      res.json({
        attemptId: attempt.attemptId,
        level: attempt.level,
        feedback: attempt.overallFeedback,
        cached: true,
        model: attempt.overallFeedbackModel || getConfiguredGroqModel(),
      });
      return;
    }

    if (!isGroqConfigured()) {
      sendError(res, 503, {
        error: 'AI Tutor requires Groq API configuration',
        code: 'AI_NOT_CONFIGURED',
        retryable: false,
      });
      return;
    }

    const ip = getClientIp(req);
    if (!checkRateLimit(`overall:${ip}`, 15, 60_000)) {
      sendError(res, 429, {
        error: 'Too many feedback requests. Please wait a moment and retry.',
        code: 'RATE_LIMITED',
        retryable: true,
      });
      return;
    }

    const lockKey = 'overall';
    if (attempt.inFlightKeys.has(lockKey)) {
      sendError(res, 409, {
        error: 'Personalized AI Feedback is already being generated for this attempt.',
        code: 'CONFLICT',
        retryable: true,
      });
      return;
    }

    attempt.inFlightKeys.add(lockKey);
    try {
      const { feedback, model } = await generateOverallFeedback(attempt.gradingResult);
      attempt.overallFeedback = feedback;
      attempt.overallFeedbackModel = model;

      res.json({
        attemptId: attempt.attemptId,
        level: attempt.level,
        feedback,
        cached: false,
        model,
      });
    } catch (err) {
      if (err instanceof GroqServiceError) {
        sendError(res, err.statusCode, {
          error: err.message,
          code: err.code,
          retryable: err.retryable,
        });
      } else {
        sendError(res, 502, {
          error: 'Unable to generate Personalized AI Feedback right now. Please retry.',
          code: 'UPSTREAM_ERROR',
          retryable: true,
        });
      }
    } finally {
      attempt.inFlightKeys.delete(lockKey);
    }
  });

  return { app, quizLoadError };
}

async function startServer(): Promise<void> {
  const { app } = createExpressApp();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[Server] Personalized English Lesson listening on http://0.0.0.0:${PORT} (Groq: ${isGroqConfigured() ? 'configured' : 'not configured'}, Model: ${getConfiguredGroqModel()})`
    );
  });
}

const isDirectEntry =
  process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isDirectEntry) {
  startServer().catch((err) => {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  });
}
