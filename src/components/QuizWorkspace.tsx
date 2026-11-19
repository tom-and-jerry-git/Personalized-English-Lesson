import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Send,
  X,
} from 'lucide-react';
import type {
  CefrLevel,
  OptionId,
  PublicQuizQuestion,
  TutorChatMessage,
} from '../types/quiz';
import { QuestionTutorPanel } from './QuestionTutorPanel';

export interface QuestionChatState {
  messages: TutorChatMessage[];
  turnsUsed: number;
  isLoading: boolean;
  error: string | null;
  retryable: boolean;
  lastQuestion: string | null;
}

interface QuizWorkspaceProps {
  level: CefrLevel;
  title: string;
  questions: PublicQuizQuestion[];
  currentIndex: number;
  selectedAnswers: Record<string, OptionId | null>;
  isSubmitting: boolean;
  submitError: string | null;
  groqConfigured: boolean;
  preSubmitTurnLimit: number;
  getChatState: (questionId: string) => QuestionChatState;
  onSelectAnswer: (questionId: string, optionId: OptionId) => void;
  onNavigateQuestion: (index: number) => void;
  onAskTutor: (questionId: string, learnerQuestion: string) => void;
  onRetryTutor: (questionId: string) => void;
  onClearTutor: (questionId: string) => void;
  onConfirmSubmit: () => void;
  onRefreshConfig?: () => void;
}

export function QuizWorkspace({
  level,
  title,
  questions,
  currentIndex,
  selectedAnswers,
  isSubmitting,
  submitError,
  groqConfigured,
  preSubmitTurnLimit,
  getChatState,
  onSelectAnswer,
  onNavigateQuestion,
  onAskTutor,
  onRetryTutor,
  onClearTutor,
  onConfirmSubmit,
  onRefreshConfig,
}: QuizWorkspaceProps) {
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = questions.filter((q) => Boolean(selectedAnswers[q.id])).length;
  const unansweredIndices = questions
    .map((q, idx) => (selectedAnswers[q.id] ? null : idx + 1))
    .filter((n): n is number => n !== null);
  const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);
  const currentSelected = currentQuestion ? selectedAnswers[currentQuestion.id] ?? null : null;
  const currentChat = currentQuestion ? getChatState(currentQuestion.id) : null;

  // Keyboard navigation: A-D / 1-4 selects option, ArrowLeft / ArrowRight steps questions, Escape closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSubmitModal) {
        if (e.key === 'Escape' && !isSubmitting) {
          setShowSubmitModal(false);
        }
        return;
      }

      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'textarea' || tagName === 'input' || target?.isContentEditable) {
        return;
      }
      if (!currentQuestion) return;

      const key = e.key.toUpperCase();
      if (key === 'A' || key === '1') {
        onSelectAnswer(currentQuestion.id, 'A');
      } else if (key === 'B' || key === '2') {
        onSelectAnswer(currentQuestion.id, 'B');
      } else if (key === 'C' || key === '3') {
        onSelectAnswer(currentQuestion.id, 'C');
      } else if (key === 'D' || key === '4') {
        onSelectAnswer(currentQuestion.id, 'D');
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigateQuestion(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < totalQuestions - 1) {
        onNavigateQuestion(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showSubmitModal,
    isSubmitting,
    currentQuestion,
    currentIndex,
    totalQuestions,
    onSelectAnswer,
    onNavigateQuestion,
  ]);

  if (!currentQuestion || !currentChat) {
    return null;
  }

  return (
    <main className="mx-auto max-w-3xl px-3.5 py-6 sm:px-6 sm:py-10 lg:py-12">
      {/* Progress Header */}
      <section aria-label="Quiz progress">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[#4A665C] sm:text-sm">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-mono font-semibold text-[#167D56]">CEFR {level}</span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-[#123F32]">{title}</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
            <span className="font-semibold text-[#123F32]">
              Q{currentIndex + 1}/{totalQuestions}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {answeredCount}/{totalQuestions} answered
            </span>
          </div>
        </div>

        {/* Continuous Progress Bar */}
        <div
          role="progressbar"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={totalQuestions}
          aria-label={`Question ${currentIndex + 1} of ${totalQuestions}`}
          className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#DCEAE2] sm:mt-3"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#167D56] to-[#24A78B] transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Clickable Question Step Selector — symmetric 6-col grid on mobile, compact row on desktop */}
        <div
          role="navigation"
          aria-label="Jump to question"
          className="mt-3.5 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="grid w-full grid-cols-6 gap-1.5 sm:flex sm:w-auto sm:flex-wrap">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const isAnswered = Boolean(selectedAnswers[q.id]);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onNavigateQuestion(idx)}
                  aria-label={`Question ${idx + 1}${isAnswered ? ' (answered)' : ' (unanswered)'}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`inline-flex min-h-[42px] w-full items-center justify-center rounded-lg font-mono text-xs font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] sm:h-9 sm:min-h-0 sm:w-9 ${
                    isCurrent
                      ? 'bg-[#167D56] text-white'
                      : isAnswered
                        ? 'border border-[#167D56]/35 bg-[#E9F8F0] text-[#123F32] hover:bg-[#167D56]/15'
                        : 'border border-[#DCEAE2] bg-white text-[#4A665C] hover:border-[#167D56]/40 hover:text-[#123F32]'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <span className="hidden text-xs text-[#4A665C] sm:inline">
            Shortcuts: A–D to select · ←/→ to step
          </span>
        </div>
      </section>

      {/* Main Question Card */}
      <article className="mt-5 rounded-2xl border border-[#DCEAE2] bg-white p-4 sm:mt-6 sm:p-6 lg:p-8">
        {/* Quiet unboxed metadata line */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#4A665C]">
          <span className="font-mono font-semibold text-[#123F32]">{currentQuestion.id}</span>
          <span aria-hidden="true">·</span>
          <span className="capitalize">{currentQuestion.skill}</span>
          {currentQuestion.learningObjective && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{currentQuestion.learningObjective}</span>
            </>
          )}
          {currentQuestion.difficulty && (
            <>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{currentQuestion.difficulty}</span>
            </>
          )}
        </div>

        {/* Question Prompt */}
        <h2 className="mt-3.5 whitespace-pre-line break-words font-display text-base font-semibold leading-relaxed text-[#123F32] sm:mt-4 sm:text-lg lg:text-xl">
          {currentQuestion.question}
        </h2>

        {/* Four Options A/B/C/D */}
        <fieldset className="mt-5 space-y-2.5 sm:mt-6 sm:space-y-3">
          <legend className="sr-only">Choose one answer for {currentQuestion.id}</legend>
          {currentQuestion.options.map((option) => {
            const isSelected = currentSelected === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectAnswer(currentQuestion.id, option.id)}
                className={`group flex min-h-[52px] w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] sm:gap-3.5 sm:px-4 sm:py-3.5 ${
                  isSelected
                    ? 'border-[#167D56] bg-[#E9F8F0]/70 text-[#123F32] shadow-[0_0_0_1px_#167D56]'
                    : 'border-[#DCEAE2] bg-white text-[#123F32] hover:border-[#24A78B]/60 hover:bg-[#F7FAF8]'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold transition-colors ${
                    isSelected
                      ? 'bg-[#167D56] text-white'
                      : 'border border-[#DCEAE2] bg-[#F7FAF8] text-[#123F32] group-hover:border-[#24A78B]'
                  }`}
                >
                  {option.id}
                </span>
                <span className="min-w-0 flex-1 break-words pt-0.5 text-sm leading-relaxed sm:text-[15px]">
                  {option.text}
                </span>
                {isSelected && (
                  <Check
                    className="mt-1 h-4 w-4 shrink-0 text-[#167D56]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </fieldset>

        {/* Navigation & Submit Controls */}
        <div className="mt-6 flex flex-col gap-2.5 border-t border-[#DCEAE2] pt-5 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-6">
          <div className="grid grid-cols-2 gap-2.5 sm:contents">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => onNavigateQuestion(currentIndex - 1)}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#DCEAE2] bg-white px-4 py-2.5 text-sm font-semibold text-[#123F32] transition-colors hover:bg-[#F7FAF8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[44px] sm:justify-start"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Previous</span>
            </button>

            <div className="contents sm:flex sm:items-center sm:gap-3">
              {currentIndex < totalQuestions - 1 ? (
                <button
                  type="button"
                  onClick={() => onNavigateQuestion(currentIndex + 1)}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#123F32] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#167D56] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] sm:min-h-[44px]"
                >
                  <span>Next</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowSubmitModal(true)}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#167D56] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#123F32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[44px] sm:px-6"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span>Submit Quiz</span>
                </button>
              )}

              {currentIndex < totalQuestions - 1 && answeredCount === totalQuestions && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowSubmitModal(true)}
                  className="col-span-2 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#167D56] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#123F32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] sm:col-span-1 sm:min-h-[44px]"
                >
                  <Send className="h-4 w-4 sm:hidden" aria-hidden="true" />
                  <span>Submit Quiz</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </article>

      {/* Collapsible Pre-Submit AI Tutor directly below A/B/C/D options */}
      <div className="mt-5 sm:mt-6">
        <QuestionTutorPanel
          key={`pre-${currentQuestion.id}`}
          mode="conceptual_help"
          questionId={currentQuestion.id}
          level={level}
          groqConfigured={groqConfigured}
          messages={currentChat.messages}
          turnsUsed={currentChat.turnsUsed}
          turnsLimit={preSubmitTurnLimit}
          isLoading={currentChat.isLoading}
          errorMessage={currentChat.error}
          retryable={currentChat.retryable}
          defaultOpen={currentChat.messages.length > 0}
          onSendQuestion={(qText) => onAskTutor(currentQuestion.id, qText)}
          onRetryLast={() => onRetryTutor(currentQuestion.id)}
          onClearChat={() => onClearTutor(currentQuestion.id)}
          onRefreshConfig={onRefreshConfig}
        />
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#123F32]/40 p-4 backdrop-blur-[2px]"
        >
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#DCEAE2] bg-white p-5 shadow-xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2
                  id="submit-modal-title"
                  className="font-display text-lg font-bold text-[#123F32]"
                >
                  Submit Your {level} Quiz?
                </h2>
                <p className="mt-1 text-sm text-[#4A665C]">
                  Your answers will be graded immediately and Answer Explanation Mode will unlock.
                </p>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowSubmitModal(false)}
                aria-label="Close confirmation dialog"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#4A665C] hover:bg-[#F7FAF8] hover:text-[#123F32]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 rounded-xl bg-[#F7FAF8] p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#4A665C]">Questions answered</span>
                <span className="font-mono font-semibold text-[#123F32] tabular-nums">
                  {answeredCount} / {totalQuestions}
                </span>
              </div>

              {unansweredIndices.length > 0 ? (
                <p className="mt-2.5 flex items-start gap-2 text-xs text-[#92400E]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Unanswered question{unansweredIndices.length > 1 ? 's' : ''}:{' '}
                    <strong className="font-mono">{unansweredIndices.join(', ')}</strong>. You can
                    go back to complete them or submit as is.
                  </span>
                </p>
              ) : (
                <p className="mt-2.5 flex items-center gap-2 text-xs text-[#167D56]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>All {totalQuestions} questions have been answered.</span>
                </p>
              )}
            </div>

            {submitError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-[#C83E37]/30 bg-[#FEF2F2] px-4 py-3 text-xs text-[#991B1B]"
              >
                {submitError}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowSubmitModal(false)}
                className="min-h-[44px] w-full rounded-xl border border-[#DCEAE2] bg-white px-4 py-2 text-sm font-semibold text-[#123F32] hover:bg-[#F7FAF8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] disabled:opacity-50 sm:w-auto"
              >
                Review Questions
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onConfirmSubmit}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#167D56] px-5 py-2 text-sm font-semibold text-white hover:bg-[#123F32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Grading...</span>
                  </>
                ) : (
                  <span>Confirm Submit</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
