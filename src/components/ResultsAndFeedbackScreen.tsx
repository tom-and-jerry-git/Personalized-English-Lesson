import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  MinusCircle,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import type {
  GradingResult,
  OptionId,
  OverallFeedbackData,
} from '../types/quiz';
import { QuestionTutorPanel } from './QuestionTutorPanel';
import { FormattedAiText } from './FormattedAiText';
import type { QuestionChatState } from './QuizWorkspace';

type FeedbackStatus = 'idle' | 'loading' | 'success' | 'error' | 'not_configured';

interface ResultsAndFeedbackScreenProps {
  activeView: 'results' | 'review';
  gradingResult: GradingResult;
  feedbackStatus: FeedbackStatus;
  feedbackData: OverallFeedbackData | null;
  feedbackError: string | null;
  feedbackRetryable: boolean;
  groqConfigured: boolean;
  postSubmitTurnLimit: number;
  canvaViewUrl: string | null;
  getPostChatState: (questionId: string) => QuestionChatState;
  onSwitchView: (view: 'results' | 'review') => void;
  onRetryOverallFeedback: () => void;
  onAskPostTutor: (questionId: string, learnerQuestion: string) => void;
  onRetryPostTutor: (questionId: string) => void;
  onClearPostTutor: (questionId: string) => void;
  onRetryQuiz: () => void;
  onChangeLevel: () => void;
  onRefreshConfig?: () => void;
}

const FEEDBACK_SECTIONS: Array<{
  key: keyof OverallFeedbackData;
  letter: string;
  title: string;
  fullWidth?: boolean;
  tone?: 'default' | 'highlight' | 'warm';
}> = [
  { key: 'overallPerformance', letter: 'A', title: 'Overall Performance', tone: 'default' },
  { key: 'whatYouDidWell', letter: 'B', title: 'What You Did Well', tone: 'highlight' },
  { key: 'mistakesExplained', letter: 'C', title: 'Mistakes Explained', fullWidth: true, tone: 'default' },
  { key: 'grammarFeedback', letter: 'D', title: 'Grammar Feedback', tone: 'default' },
  { key: 'vocabularyFeedback', letter: 'E', title: 'Vocabulary Feedback', tone: 'default' },
  { key: 'recommendedReview', letter: 'F', title: 'Recommended Review', tone: 'default' },
  { key: 'nextPractice', letter: 'G', title: 'Next Practice', tone: 'default' },
  { key: 'encouragement', letter: 'H', title: 'Encouragement', fullWidth: true, tone: 'highlight' },
];

export function ResultsAndFeedbackScreen({
  activeView,
  gradingResult,
  feedbackStatus,
  feedbackData,
  feedbackError,
  feedbackRetryable,
  groqConfigured,
  postSubmitTurnLimit,
  canvaViewUrl,
  getPostChatState,
  onSwitchView,
  onRetryOverallFeedback,
  onAskPostTutor,
  onRetryPostTutor,
  onClearPostTutor,
  onRetryQuiz,
  onChangeLevel,
  onRefreshConfig,
}: ResultsAndFeedbackScreenProps) {
  const [reviewFilter, setReviewFilter] = useState<'all' | 'incorrect' | 'correct'>('all');
  const [expandedDistractors, setExpandedDistractors] = useState<Record<string, boolean>>({});

  const filteredReview = gradingResult.review.filter((item) => {
    if (reviewFilter === 'incorrect') return !item.isCorrect;
    if (reviewFilter === 'correct') return item.isCorrect;
    return true;
  });

  const toggleDistractors = (questionId: string) => {
    setExpandedDistractors((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Score Summary Card */}
      <section
        aria-label="Quiz score summary"
        className="rounded-2xl border border-[#DCEAE2] bg-white p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#4A665C]">
              <span className="font-mono font-semibold text-[#167D56]">
                CEFR {gradingResult.level}
              </span>
              <span aria-hidden="true">·</span>
              <span>{gradingResult.title}</span>
              <span aria-hidden="true">·</span>
              <span>Automated Grading Complete</span>
            </div>

            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-[#123F32] sm:text-4xl">
              {gradingResult.passed
                ? 'Quiz Benchmark Reached'
                : 'Keep Building Your Mastery'}
            </h1>

            <p className="mt-2 max-w-xl text-xs leading-relaxed text-[#4A665C] sm:text-sm">
              {gradingResult.passThresholdNote}
            </p>
          </div>

          {/* Numeric Score Display (Tabular Numerals) */}
          <div className="flex items-center gap-5 rounded-2xl border border-[#DCEAE2] bg-[#F7FAF8] px-6 py-4">
            <div>
              <p className="text-xs font-medium text-[#4A665C]">Score</p>
              <p className="mt-0.5 font-mono text-3xl font-bold text-[#123F32] tabular-nums">
                {gradingResult.score}/{gradingResult.maxScore}
              </p>
            </div>
            <div className="h-10 w-px bg-[#DCEAE2]" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium text-[#4A665C]">Accuracy</p>
              <p className="mt-0.5 font-mono text-3xl font-bold text-[#167D56] tabular-nums">
                {gradingResult.percentage}%
              </p>
            </div>
          </div>
        </div>

        {/* Clean Unboxed Breakdown Metrics */}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[#DCEAE2] pt-5 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-[#167D56] tabular-nums">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>{gradingResult.correctCount} Correct</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-[#C83E37] tabular-nums">
            <XCircle className="h-4 w-4" aria-hidden="true" />
            <span>{gradingResult.incorrectCount} Incorrect</span>
          </span>
          <span className="font-mono text-xs text-[#4A665C] tabular-nums">
            Pass benchmark: {gradingResult.passScore}/{gradingResult.maxScore} ·{' '}
            {gradingResult.passed ? 'Passed' : 'Needs Review'}
          </span>
        </div>

        {/* Action Row */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#DCEAE2] pt-5">
          {/* Segmented View Switcher: Overall AI Feedback vs Review Answers */}
          <div
            role="tablist"
            aria-label="Results sections"
            className="inline-flex items-center gap-1 rounded-xl bg-[#F7FAF8] p-1 border border-[#DCEAE2]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'results'}
              onClick={() => onSwitchView('results')}
              className={`min-h-[38px] rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap sm:text-sm ${
                activeView === 'results'
                  ? 'bg-white text-[#123F32] shadow-sm'
                  : 'text-[#4A665C] hover:text-[#123F32]'
              }`}
            >
              Personalized AI Feedback
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'review'}
              onClick={() => onSwitchView('review')}
              className={`min-h-[38px] rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap sm:text-sm ${
                activeView === 'review'
                  ? 'bg-white text-[#123F32] shadow-sm'
                  : 'text-[#4A665C] hover:text-[#123F32]'
              }`}
            >
              Review Answers &amp; AI Chat ({gradingResult.maxScore})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onRetryQuiz}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DCEAE2] bg-white px-4 py-2 text-xs font-semibold text-[#123F32] transition-colors hover:bg-[#F7FAF8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] sm:text-sm"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#167D56]" aria-hidden="true" />
              <span>Retry Quiz</span>
            </button>

            <button
              type="button"
              onClick={onChangeLevel}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DCEAE2] bg-white px-4 py-2 text-xs font-semibold text-[#123F32] transition-colors hover:bg-[#F7FAF8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] sm:text-sm"
            >
              <ArrowLeftRight className="h-3.5 w-3.5 text-[#167D56]" aria-hidden="true" />
              <span>Change Level</span>
            </button>

            {canvaViewUrl ? (
              <a
                href={canvaViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#167D56] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#123F32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] sm:text-sm"
              >
                <span>Back to Canva Lessons</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : (
              <span className="text-xs text-[#4A665C]">Canva lesson link not configured</span>
            )}
          </div>
        </div>
      </section>

      {/* TAB 1: OVERALL PERSONALIZED AI FEEDBACK */}
      {activeView === 'results' && (
        <section aria-label="Personalized AI Feedback" className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#123F32]">
                Personalized AI Feedback
              </h2>
              <p className="mt-1 text-sm text-[#4A665C]">
                Vietnamese coaching grounded strictly in your graded {gradingResult.level} attempt.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSwitchView('review')}
              className="inline-flex min-h-[42px] items-center rounded-xl bg-[#167D56] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#123F32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56]"
            >
              Review Individual Questions
            </button>
          </div>

          {/* Loading State */}
          {feedbackStatus === 'loading' && (
            <div
              role="status"
              className="mt-6 rounded-2xl border border-[#DCEAE2] bg-white p-7 sm:p-8"
            >
              <div className="flex items-center gap-3 text-sm font-medium text-[#167D56]">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                <span>Your AI tutor is analyzing your {gradingResult.level} results...</span>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-28 animate-pulse rounded-xl bg-[#F7FAF8] border border-[#DCEAE2]/60"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Missing Groq API Key Notice */}
          {feedbackStatus === 'not_configured' && (
            <div
              role="status"
              className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#B45309]/25 bg-[#FFFBEB] p-6 text-sm text-[#92400E]"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <h3 className="font-display font-semibold">
                    AI Tutor requires Groq API configuration
                  </h3>
                  <p className="mt-1 leading-relaxed">
                    Overall Personalized AI Feedback will activate automatically once{' '}
                    <code className="font-mono">GROQ_API_KEY</code> is configured in server
                    Secrets. In the meantime, switch to{' '}
                    <strong>Review Answers &amp; AI Chat</strong> to read all verified Vietnamese
                    explanations for each question.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onRefreshConfig?.();
                  onRetryOverallFeedback();
                }}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[#B45309]/30 bg-white px-4 py-2 text-xs font-semibold text-[#92400E] transition-colors hover:bg-[#FEF3C7]"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Check Connection</span>
              </button>
            </div>
          )}

          {/* Error State */}
          {feedbackStatus === 'error' && (
            <div
              role="alert"
              className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#C83E37]/30 bg-[#FEF2F2] p-6 text-sm text-[#991B1B]"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <h3 className="font-display font-semibold">
                    Could Not Generate Personalized AI Feedback
                  </h3>
                  <p className="mt-1">{feedbackError || 'An unexpected error occurred.'}</p>
                </div>
              </div>
              {feedbackRetryable && (
                <button
                  type="button"
                  onClick={onRetryOverallFeedback}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#991B1B] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#7F1D1D]"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Retry Feedback</span>
                </button>
              )}
            </div>
          )}

          {/* 8-Section Structured Feedback Report */}
          {feedbackStatus === 'success' && feedbackData && (
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              {FEEDBACK_SECTIONS.map((sec) => (
                <article
                  key={sec.key}
                  className={`rounded-2xl border p-6 sm:p-7 ${
                    sec.fullWidth ? 'md:col-span-2' : ''
                  } ${
                    sec.tone === 'highlight'
                      ? 'border-[#167D56]/25 bg-gradient-to-b from-[#E9F8F0]/65 via-white to-white'
                      : 'border-[#DCEAE2] bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 border-b border-[#DCEAE2]/80 pb-3.5">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E9F8F0] font-mono text-xs font-bold text-[#167D56]">
                      {sec.letter}
                    </span>
                    <h3 className="font-display text-base font-bold tracking-tight text-[#123F32] sm:text-lg">
                      {sec.title}
                    </h3>
                  </div>
                  <div className="mt-4">
                    <FormattedAiText text={feedbackData[sec.key]} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: REVIEW ANSWERS + PER-QUESTION AI CHAT */}
      {activeView === 'review' && (
        <section aria-label="Review Answers and Per-Question AI Tutor" className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#123F32]">
                Review Answers &amp; Ask AI
              </h2>
              <p className="mt-1 text-sm text-[#4A665C]">
                Inspect every question with its official explanation and ask isolated follow-up
                questions in Answer Explanation Mode.
              </p>
            </div>

            {/* Interactive Filter Control */}
            <div className="inline-flex items-center gap-1 rounded-xl border border-[#DCEAE2] bg-white p-1">
              {(
                [
                  { id: 'all', label: `All (${gradingResult.maxScore})` },
                  { id: 'incorrect', label: `Incorrect (${gradingResult.incorrectCount})` },
                  { id: 'correct', label: `Correct (${gradingResult.correctCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setReviewFilter(tab.id)}
                  className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                    reviewFilter === tab.id
                      ? 'bg-[#E9F8F0] text-[#123F32]'
                      : 'text-[#4A665C] hover:text-[#123F32]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredReview.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-[#DCEAE2] bg-white p-8 text-center text-sm text-[#4A665C]">
              No questions match this filter.
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {filteredReview.map((item) => {
                const chat = getPostChatState(item.questionId);
                const selectedDistractorNote =
                  !item.isCorrect && item.selectedOptionId
                    ? item.distractorExplanationsVi[item.selectedOptionId]
                    : null;
                const distractorEntries = Object.entries(item.distractorExplanationsVi) as Array<
                  [OptionId, string]
                >;
                const isDistractorsOpen = Boolean(expandedDistractors[item.questionId]);

                return (
                  <article
                    key={item.questionId}
                    className="rounded-2xl border border-[#DCEAE2] bg-white p-6 sm:p-7"
                  >
                    {/* Header Metadata + Explicit Icon+Text Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#4A665C]">
                        <span className="font-mono font-semibold text-[#123F32]">
                          {item.questionId}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{item.skill}</span>
                        {item.learningObjective && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{item.learningObjective}</span>
                          </>
                        )}
                      </div>

                      {item.isCorrect ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#167D56]">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          <span>Correct (+1)</span>
                        </span>
                      ) : item.selectedOptionId === null ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#92400E]">
                          <MinusCircle className="h-4 w-4" aria-hidden="true" />
                          <span>Unanswered (0)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C83E37]">
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                          <span>Incorrect (0)</span>
                        </span>
                      )}
                    </div>

                    {/* Question Text */}
                    <h3 className="mt-3 whitespace-pre-line font-display text-base font-semibold leading-relaxed text-[#123F32] sm:text-lg">
                      {item.question}
                    </h3>

                    {/* Learner Answer vs Correct Answer Comparison */}
                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div
                        className={`rounded-xl border p-4 text-sm ${
                          item.isCorrect
                            ? 'border-[#167D56]/30 bg-[#E9F8F0]/60'
                            : 'border-[#C83E37]/25 bg-[#FEF2F2]/70'
                        }`}
                      >
                        <p className="text-xs font-semibold text-[#4A665C]">Your Answer</p>
                        <p className="mt-1 font-medium text-[#123F32]">
                          {item.selectedOptionId ? (
                            <>
                              <span className="mr-1.5 font-mono font-bold">
                                {item.selectedOptionId}.
                              </span>
                              {item.selectedOptionText}
                            </>
                          ) : (
                            <span className="italic text-[#4A665C]">No answer selected</span>
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl border border-[#167D56]/30 bg-[#E9F8F0]/60 p-4 text-sm">
                        <p className="text-xs font-semibold text-[#167D56]">Correct Answer</p>
                        <p className="mt-1 font-medium text-[#123F32]">
                          <span className="mr-1.5 font-mono font-bold">
                            {item.correctOptionId}.
                          </span>
                          {item.correctOptionText}
                        </p>
                      </div>
                    </div>

                    {/* Official Approved Explanation */}
                    <div className="mt-4 rounded-xl border border-[#DCEAE2] bg-[#F7FAF8] p-4 text-sm leading-relaxed text-[#123F32]">
                      <p className="text-xs font-semibold text-[#167D56]">Official Explanation</p>
                      <p className="mt-1.5">{item.explanationVi}</p>

                      {selectedDistractorNote && (
                        <p className="mt-2.5 border-t border-[#DCEAE2] pt-2.5 text-xs leading-relaxed text-[#7F1D1D] sm:text-sm">
                          <span className="font-semibold">
                            Why Option {item.selectedOptionId} is incorrect:{' '}
                          </span>
                          {selectedDistractorNote}
                        </p>
                      )}

                      {distractorEntries.length > 0 && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => toggleDistractors(item.questionId)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#167D56] hover:text-[#123F32]"
                          >
                            <span>
                              {isDistractorsOpen
                                ? 'Hide all distractor notes'
                                : 'View why other options are incorrect'}
                            </span>
                            {isDistractorsOpen ? (
                              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                          </button>

                          {isDistractorsOpen && (
                            <ul className="mt-2.5 space-y-1.5 border-t border-[#DCEAE2] pt-2.5 text-xs leading-relaxed text-[#4A665C]">
                              {distractorEntries.map(([optId, note]) => (
                                <li key={optId}>
                                  <strong className="font-mono text-[#123F32]">
                                    Option {optId}:
                                  </strong>{' '}
                                  {note}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Dedicated Per-Question Post-Submit AI Tutor */}
                    <div className="mt-4">
                      <QuestionTutorPanel
                        key={`post-${gradingResult.attemptId}-${item.questionId}`}
                        mode="answer_explanation"
                        questionId={item.questionId}
                        level={gradingResult.level}
                        groqConfigured={groqConfigured}
                        messages={chat.messages}
                        turnsUsed={chat.turnsUsed}
                        turnsLimit={postSubmitTurnLimit}
                        isLoading={chat.isLoading}
                        errorMessage={chat.error}
                        retryable={chat.retryable}
                        defaultOpen={chat.messages.length > 0}
                        onSendQuestion={(qText) => onAskPostTutor(item.questionId, qText)}
                        onRetryLast={() => onRetryPostTutor(item.questionId)}
                        onClearChat={() => onClearPostTutor(item.questionId)}
                        onRefreshConfig={onRefreshConfig}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
