import { useCallback, useEffect, useState } from 'react';
import type {
  AppRuntimeConfig,
  CefrLevel,
  GradingResult,
  OptionId,
  OverallFeedbackData,
  PublicQuizQuestion,
  TutorChatMessage,
} from './types/quiz';
import {
  ApiClientError,
  askPostSubmitTutor,
  askPreSubmitTutor,
  fetchOverallFeedback,
  fetchRuntimeConfig,
  startQuizAttempt,
  submitQuizAttempt,
} from './services/api';
import { TopNav, type AppScreen } from './components/TopNav';
import { LevelSelectionScreen } from './components/LevelSelectionScreen';
import { QuizIntroScreen } from './components/QuizIntroScreen';
import { QuizWorkspace, type QuestionChatState } from './components/QuizWorkspace';
import { ResultsAndFeedbackScreen } from './components/ResultsAndFeedbackScreen';

type FeedbackStatus = 'idle' | 'loading' | 'success' | 'error' | 'not_configured';

const EMPTY_CHAT_STATE: QuestionChatState = {
  messages: [],
  turnsUsed: 0,
  isLoading: false,
  error: null,
  retryable: false,
  lastQuestion: null,
};

function makeMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  // Runtime server configuration (never holds secrets)
  const [config, setConfig] = useState<AppRuntimeConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // Core navigation & quiz session state
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('levels');
  const [selectedLevel, setSelectedLevel] = useState<CefrLevel | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState<string>('Healthy Lifestyle Quiz');
  const [questions, setQuestions] = useState<PublicQuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, OptionId | null>>({});

  // Start / Submit status
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Grading & Overall AI Feedback
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [aiFeedbackStatus, setAiFeedbackStatus] = useState<FeedbackStatus>('idle');
  const [aiFeedbackData, setAiFeedbackData] = useState<OverallFeedbackData | null>(null);
  const [aiFeedbackError, setAiFeedbackError] = useState<string | null>(null);
  const [aiFeedbackRetryable, setAiFeedbackRetryable] = useState<boolean>(false);

  // Isolated per-attempt, per-mode, per-question AI Tutor chat state
  // Key format: `${attemptId}:${mode}:${questionId}`
  const [questionChatMap, setQuestionChatMap] = useState<Record<string, QuestionChatState>>({});

  // Optional level-switch confirmation while an unsubmitted attempt is in progress
  const [showChangeLevelConfirm, setShowChangeLevelConfirm] = useState<boolean>(false);

  const loadConfig = useCallback(async () => {
    setConfigError(null);
    try {
      const data = await fetchRuntimeConfig();
      setConfig(data);
    } catch (err) {
      setConfigError(
        err instanceof Error ? err.message : 'Unable to connect to quiz backend.'
      );
    }
  }, []);

  useEffect(() => {
    loadConfig();
    const handleFocus = () => {
      void loadConfig();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadConfig();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadConfig]);

  // Complete state isolation helper when starting fresh or switching levels
  const resetAttemptState = useCallback(() => {
    setAttemptId(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setIsSubmitting(false);
    setSubmitError(null);
    setGradingResult(null);
    setAiFeedbackStatus('idle');
    setAiFeedbackData(null);
    setAiFeedbackError(null);
    setAiFeedbackRetryable(false);
    setQuestionChatMap({});
  }, []);

  const handleSelectLevel = (level: CefrLevel) => {
    resetAttemptState();
    setSelectedLevel(level);
    setStartError(null);
    setCurrentScreen('intro');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRequestChangeLevel = () => {
    if (attemptId && !gradingResult && currentScreen === 'quiz') {
      setShowChangeLevelConfirm(true);
      return;
    }
    resetAttemptState();
    setSelectedLevel(null);
    setStartError(null);
    setCurrentScreen('levels');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmChangeLevel = () => {
    setShowChangeLevelConfirm(false);
    resetAttemptState();
    setSelectedLevel(null);
    setStartError(null);
    setCurrentScreen('levels');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartQuiz = useCallback(
    async (levelOverride?: CefrLevel) => {
      const targetLevel = levelOverride ?? selectedLevel;
      if (!targetLevel || isStarting) return;

      setIsStarting(true);
      setStartError(null);
      resetAttemptState();

      try {
        const [payload] = await Promise.all([startQuizAttempt(targetLevel), loadConfig()]);
        setSelectedLevel(payload.level);
        setAttemptId(payload.attemptId);
        setQuizTitle(payload.title);
        setQuestions(payload.questions);
        setCurrentQuestionIndex(0);
        setSelectedAnswers({});
        setCurrentScreen('quiz');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        setStartError(
          err instanceof Error ? err.message : 'Unable to start the quiz. Please try again.'
        );
      } finally {
        setIsStarting(false);
      }
    },
    [selectedLevel, isStarting, resetAttemptState]
  );

  const handleSelectAnswer = useCallback((questionId: string, optionId: OptionId) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  }, []);

  const requestOverallFeedback = useCallback(async (targetAttemptId: string) => {
    setAiFeedbackStatus('loading');
    setAiFeedbackError(null);
    setAiFeedbackRetryable(false);

    try {
      const res = await fetchOverallFeedback(targetAttemptId);
      setAiFeedbackData(res.feedback);
      setAiFeedbackStatus('success');
      setConfig((prev) => (prev ? { ...prev, groqConfigured: true } : prev));
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'AI_NOT_CONFIGURED') {
        setAiFeedbackStatus('not_configured');
        setAiFeedbackError(null);
        setAiFeedbackRetryable(false);
        setConfig((prev) => (prev ? { ...prev, groqConfigured: false } : prev));
      } else {
        setAiFeedbackStatus('error');
        setAiFeedbackError(
          err instanceof Error ? err.message : 'Unable to generate AI feedback right now.'
        );
        setAiFeedbackRetryable(err instanceof ApiClientError ? err.retryable : true);
      }
    }
  }, []);

  const handleConfirmSubmit = async () => {
    if (!attemptId || isSubmitting || gradingResult) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitQuizAttempt(attemptId, selectedAnswers);
      setGradingResult(result);
      setCurrentScreen('results');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Automatically request overall Groq AI feedback after deterministic grading succeeds
      void requestOverallFeedback(result.attemptId);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to submit quiz. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getChatKey = useCallback(
    (mode: 'conceptual_help' | 'answer_explanation', questionId: string) =>
      `${attemptId ?? 'none'}:${mode}:${questionId}`,
    [attemptId]
  );

  const getChatState = useCallback(
    (mode: 'conceptual_help' | 'answer_explanation', questionId: string): QuestionChatState => {
      const key = getChatKey(mode, questionId);
      return questionChatMap[key] ?? EMPTY_CHAT_STATE;
    },
    [getChatKey, questionChatMap]
  );

  const sendTutorQuestion = useCallback(
    async (
      mode: 'conceptual_help' | 'answer_explanation',
      questionId: string,
      learnerQuestion: string,
      isRetry = false
    ) => {
      if (!attemptId) return;
      const trimmed = learnerQuestion.trim();
      if (!trimmed) return;

      const key = getChatKey(mode, questionId);
      const currentState = questionChatMap[key] ?? EMPTY_CHAT_STATE;
      if (currentState.isLoading) return;

      // Build clean short history strictly for THIS attempt + THIS question
      const priorMessages = currentState.messages;
      const historyForApi = priorMessages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const userMessage: TutorChatMessage = {
        id: makeMessageId(),
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
        mode,
      };

      const nextMessages = isRetry ? priorMessages : [...priorMessages, userMessage];

      setQuestionChatMap((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] ?? EMPTY_CHAT_STATE),
          messages: nextMessages,
          isLoading: true,
          error: null,
          retryable: false,
          lastQuestion: trimmed,
        },
      }));

      try {
        const res =
          mode === 'conceptual_help'
            ? await askPreSubmitTutor({
                attemptId,
                questionId,
                learnerQuestion: trimmed,
                history: historyForApi,
              })
            : await askPostSubmitTutor({
                attemptId,
                questionId,
                learnerQuestion: trimmed,
                history: historyForApi,
              });

        const assistantMessage: TutorChatMessage = {
          id: makeMessageId(),
          role: 'assistant',
          content: res.reply,
          timestamp: new Date().toISOString(),
          mode,
        };

        setQuestionChatMap((prev) => {
          const latest = prev[key] ?? EMPTY_CHAT_STATE;
          return {
            ...prev,
            [key]: {
              ...latest,
              messages: [...latest.messages, assistantMessage],
              turnsUsed: res.turnsUsed,
              isLoading: false,
              error: null,
              retryable: false,
            },
          };
        });
      } catch (err) {
        const errorText =
          err instanceof Error ? err.message : 'Unable to reach AI Tutor. Please try again.';
        const retryable = err instanceof ApiClientError ? err.retryable : true;

        setQuestionChatMap((prev) => {
          const latest = prev[key] ?? EMPTY_CHAT_STATE;
          return {
            ...prev,
            [key]: {
              ...latest,
              isLoading: false,
              error: errorText,
              retryable,
            },
          };
        });
      }
    },
    [attemptId, getChatKey, questionChatMap]
  );

  const handleRetryTutor = useCallback(
    (mode: 'conceptual_help' | 'answer_explanation', questionId: string) => {
      const state = getChatState(mode, questionId);
      if (state.lastQuestion) {
        void sendTutorQuestion(mode, questionId, state.lastQuestion, true);
      }
    },
    [getChatState, sendTutorQuestion]
  );

  const handleClearTutor = useCallback(
    (mode: 'conceptual_help' | 'answer_explanation', questionId: string) => {
      const key = getChatKey(mode, questionId);
      setQuestionChatMap((prev) => {
        const existing = prev[key];
        if (!existing) return prev;
        return {
          ...prev,
          [key]: {
            ...existing,
            messages: [],
            error: null,
            retryable: false,
            lastQuestion: null,
          },
        };
      });
    },
    [getChatKey]
  );

  const handleRetryQuiz = () => {
    if (!selectedLevel) return;
    void handleStartQuiz(selectedLevel);
  };

  const groqConfigured = config ? config.groqConfigured : true;
  const preLimit = config?.limits.preSubmitTurnsPerQuestion ?? 3;
  const postLimit = config?.limits.postSubmitTurnsPerQuestion ?? 5;

  return (
    <div className="min-h-screen bg-[#F7FAF8] text-[#123F32]">
      <TopNav
        currentScreen={currentScreen}
        selectedLevel={selectedLevel}
        hasActiveAttempt={Boolean(attemptId)}
        hasSubmitted={Boolean(gradingResult)}
        canvaViewUrl={config?.canvaViewUrl ?? null}
        onNavigate={(screen) => {
          setCurrentScreen(screen);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onRequestChangeLevel={handleRequestChangeLevel}
      />

      {currentScreen === 'levels' && (
        <LevelSelectionScreen
          config={config}
          configError={configError}
          onRetryConfig={loadConfig}
          onSelectLevel={handleSelectLevel}
        />
      )}

      {currentScreen === 'intro' && selectedLevel && (
        <QuizIntroScreen
          level={selectedLevel}
          config={config}
          isStarting={isStarting}
          startError={startError}
          onStartQuiz={() => handleStartQuiz(selectedLevel)}
          onBackToLevels={handleRequestChangeLevel}
        />
      )}

      {currentScreen === 'quiz' && selectedLevel && attemptId && (
        <QuizWorkspace
          level={selectedLevel}
          title={quizTitle}
          questions={questions}
          currentIndex={currentQuestionIndex}
          selectedAnswers={selectedAnswers}
          isSubmitting={isSubmitting}
          submitError={submitError}
          groqConfigured={groqConfigured}
          preSubmitTurnLimit={preLimit}
          getChatState={(qId) => getChatState('conceptual_help', qId)}
          onSelectAnswer={handleSelectAnswer}
          onNavigateQuestion={setCurrentQuestionIndex}
          onAskTutor={(qId, text) => void sendTutorQuestion('conceptual_help', qId, text)}
          onRetryTutor={(qId) => handleRetryTutor('conceptual_help', qId)}
          onClearTutor={(qId) => handleClearTutor('conceptual_help', qId)}
          onConfirmSubmit={handleConfirmSubmit}
          onRefreshConfig={() => void loadConfig()}
        />
      )}

      {(currentScreen === 'results' || currentScreen === 'review') && gradingResult && (
        <ResultsAndFeedbackScreen
          activeView={currentScreen}
          gradingResult={gradingResult}
          feedbackStatus={aiFeedbackStatus}
          feedbackData={aiFeedbackData}
          feedbackError={aiFeedbackError}
          feedbackRetryable={aiFeedbackRetryable}
          groqConfigured={groqConfigured}
          postSubmitTurnLimit={postLimit}
          canvaViewUrl={config?.canvaViewUrl ?? null}
          getPostChatState={(qId) => getChatState('answer_explanation', qId)}
          onSwitchView={(view) => {
            setCurrentScreen(view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onRetryOverallFeedback={() => void requestOverallFeedback(gradingResult.attemptId)}
          onAskPostTutor={(qId, text) => void sendTutorQuestion('answer_explanation', qId, text)}
          onRetryPostTutor={(qId) => handleRetryTutor('answer_explanation', qId)}
          onClearPostTutor={(qId) => handleClearTutor('answer_explanation', qId)}
          onRetryQuiz={handleRetryQuiz}
          onChangeLevel={handleRequestChangeLevel}
          onRefreshConfig={() => void loadConfig()}
        />
      )}

      {/* Confirmation dialog when leaving an active unsubmitted quiz */}
      {showChangeLevelConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-quiz-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#123F32]/40 p-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#DCEAE2] bg-white p-6 shadow-xl">
            <h2 id="leave-quiz-title" className="font-display text-lg font-bold text-[#123F32]">
              Change English Level?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#4A665C]">
              Switching levels will discard your current unsubmitted {selectedLevel} answers and
              question tutor notes so your next attempt starts clean.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowChangeLevelConfirm(false)}
                className="min-h-[42px] rounded-xl border border-[#DCEAE2] bg-white px-4 py-2 text-sm font-semibold text-[#123F32] hover:bg-[#F7FAF8]"
              >
                Stay in Quiz
              </button>
              <button
                type="button"
                onClick={confirmChangeLevel}
                className="min-h-[42px] rounded-xl bg-[#167D56] px-5 py-2 text-sm font-semibold text-white hover:bg-[#123F32]"
              >
                Switch Level
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
