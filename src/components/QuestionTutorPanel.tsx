import { useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import type { TutorChatMessage } from '../types/quiz';
import { FormattedAiText } from './FormattedAiText';

interface QuestionTutorPanelProps {
  mode: 'conceptual_help' | 'answer_explanation';
  questionId: string;
  level: string;
  groqConfigured: boolean;
  messages: TutorChatMessage[];
  turnsUsed: number;
  turnsLimit: number;
  isLoading: boolean;
  errorMessage: string | null;
  retryable: boolean;
  defaultOpen?: boolean;
  onSendQuestion: (questionText: string) => void;
  onRetryLast: () => void;
  onClearChat: () => void;
  onRefreshConfig?: () => void;
}

export function QuestionTutorPanel({
  mode,
  questionId,
  level,
  groqConfigured,
  messages,
  turnsUsed,
  turnsLimit,
  isLoading,
  errorMessage,
  retryable,
  defaultOpen = false,
  onSendQuestion,
  onRetryLast,
  onClearChat,
  onRefreshConfig,
}: QuestionTutorPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [inputText, setInputText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isPreSubmit = mode === 'conceptual_help';
  const limitReached = turnsUsed >= turnsLimit;

  const heading = isPreSubmit
    ? 'Need Help Understanding This Question?'
    : 'Ask AI About This Question';
  const subtitle = isPreSubmit
    ? "Ask your AI tutor about vocabulary, grammar or anything you don't understand."
    : 'Confused about this question? Ask for a deeper explanation, extra examples, or memory tips.';
  const placeholder = isPreSubmit
    ? "What don't you understand about this question?"
    : 'Ask a follow-up question...';
  const submitLabel = isPreSubmit ? 'Ask AI Tutor' : 'Ask AI';

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isLoading || limitReached || !groqConfigured) return;
    onSendQuestion(trimmed);
    setInputText('');
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isLoading || limitReached || !groqConfigured) return;
    if (!isOpen) setIsOpen(true);
    onSendQuestion(prompt);
  };

  const handleFocusAnotherQuestion = () => {
    if (!isOpen) setIsOpen(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 30);
  };

  return (
    <section
      aria-label={`${heading} (${questionId})`}
      className="rounded-2xl border border-[#DCEAE2] bg-[#F7FAF8] transition-colors"
    >
      {/* Collapsible Trigger Header */}
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#167D56] sm:gap-4 sm:px-5 sm:py-4"
      >
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
          <MessageSquare
            className="mt-0.5 h-5 w-5 shrink-0 text-[#167D56]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold text-[#123F32] sm:text-base">
              {heading}
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-[#4A665C] sm:text-sm">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 sm:gap-3">
          {messages.length > 0 && (
            <span className="hidden font-mono text-xs text-[#167D56] tabular-nums sm:inline">
              {Math.ceil(messages.length / 2)}{' '}
              {Math.ceil(messages.length / 2) === 1 ? 'note' : 'notes'}
            </span>
          )}
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCEAE2] bg-white text-[#123F32] sm:h-8 sm:w-8">
            {isOpen ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
        </div>
      </button>

      {/* Collapsible Body */}
      {isOpen && (
        <div className="border-t border-[#DCEAE2] px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5 sm:pt-4">
          {/* Mode & Context Notice */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[#4A665C]">
            <span className="min-w-0">
              <strong className="font-semibold text-[#123F32]">
                {isPreSubmit ? 'Conceptual Help Mode' : 'Answer Explanation Mode'}
              </strong>
              {' — '}
              {isPreSubmit
                ? 'Your tutor will explain the concept without revealing the answer before submission.'
                : `Focused on ${questionId} (${level}) using the verified explanation.`}
            </span>
            <span className="font-mono text-xs text-[#4A665C] tabular-nums shrink-0">
              {turnsUsed}/{turnsLimit} turns
            </span>
          </div>

          {/* Unconfigured Groq API Notice */}
          {!groqConfigured && (
            <div
              role="status"
              className="mt-4 flex flex-col gap-3 rounded-xl border border-[#B45309]/25 bg-[#FFFBEB] px-4 py-3 text-xs leading-relaxed text-[#92400E] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-semibold">AI Tutor requires Groq API configuration</p>
                  <p className="mt-0.5">
                    Configure <code className="font-mono">GROQ_API_KEY</code> in server Secrets to
                    enable real-time Groq AI tutoring. Your quiz and automated grading continue to
                    work normally.
                  </p>
                </div>
              </div>
              {onRefreshConfig && (
                <button
                  type="button"
                  onClick={onRefreshConfig}
                  className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-[#B45309]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#92400E] transition-colors hover:bg-[#FEF3C7] sm:min-h-[36px] sm:w-auto shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Check Connection</span>
                </button>
              )}
            </div>
          )}

          {/* Conversation History (Isolated to this Question ID + Attempt ID) */}
          {messages.length > 0 && (
            <div
              aria-live="polite"
              className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto pr-0.5 sm:max-h-96 sm:pr-1"
            >
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`min-w-0 rounded-xl border px-3.5 py-3 text-sm leading-relaxed sm:px-4 ${
                      isUser
                        ? 'ml-3 border-[#167D56]/25 bg-[#E9F8F0]/75 text-[#123F32] sm:ml-6'
                        : 'mr-0 border-[#DCEAE2] bg-white text-[#123F32] sm:mr-2'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-medium text-[#4A665C]">
                      <span>{isUser ? 'You' : 'AI Tutor'}</span>
                      <span className="font-mono tabular-nums">{questionId}</span>
                    </div>
                    {isUser ? (
                      <div className="whitespace-pre-line break-words">{msg.content}</div>
                    ) : (
                      <FormattedAiText text={msg.content} compact />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div
              role="status"
              className="mt-4 flex items-center gap-2.5 rounded-xl border border-[#DCEAE2] bg-white px-4 py-3 text-sm text-[#167D56]"
            >
              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
              <span>Your AI tutor is thinking...</span>
            </div>
          )}

          {/* Error State with Retry Button */}
          {errorMessage && (
            <div
              role="alert"
              className="mt-4 flex flex-col gap-3 rounded-xl border border-[#C83E37]/30 bg-[#FEF2F2] px-4 py-3 text-xs text-[#991B1B] sm:flex-row sm:items-center sm:justify-between sm:text-sm"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{errorMessage}</span>
              </div>
              {retryable && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={onRetryLast}
                  className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-[#C83E37]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#991B1B] transition-colors hover:bg-[#FEE2E2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#991B1B] sm:min-h-[36px] sm:w-auto shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          )}

          {/* Quick Follow-Up Action Controls (Wired to Real Requests / Actions) */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!groqConfigured || isLoading || limitReached}
              onClick={() =>
                handleQuickPrompt(
                  isPreSubmit
                    ? 'Giải thích ngắn gọn và dễ hiểu hơn về kiến thức ngữ pháp hoặc từ vựng trong câu này giúp em.'
                    : 'Giải thích dễ hiểu hơn vì sao đáp án đúng lại như vậy giúp em.'
                )
              }
              className="min-h-[40px] rounded-lg border border-[#DCEAE2] bg-white px-3 py-1.5 text-xs font-medium text-[#123F32] transition-colors hover:border-[#167D56]/40 hover:bg-[#E9F8F0]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[36px]"
            >
              Explain More Simply
            </button>

            <button
              type="button"
              disabled={!groqConfigured || isLoading || limitReached}
              onClick={() =>
                handleQuickPrompt(
                  isPreSubmit
                    ? `Cho em thêm một ví dụ tiếng Anh tương tự ở trình độ ${level} để hiểu rõ quy tắc này.`
                    : `Cho em thêm một ví dụ tiếng Anh tương tự ở trình độ ${level} và cách ghi nhớ cấu trúc này.`
                )
              }
              className="min-h-[40px] rounded-lg border border-[#DCEAE2] bg-white px-3 py-1.5 text-xs font-medium text-[#123F32] transition-colors hover:border-[#167D56]/40 hover:bg-[#E9F8F0]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[36px]"
            >
              Give Me an Example
            </button>

            {messages.length > 0 && !limitReached && (
              <button
                type="button"
                disabled={!groqConfigured || isLoading}
                onClick={handleFocusAnotherQuestion}
                className="min-h-[40px] rounded-lg border border-[#DCEAE2] bg-white px-3 py-1.5 text-xs font-medium text-[#123F32] transition-colors hover:border-[#167D56]/40 hover:bg-[#E9F8F0]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[36px]"
              >
                Ask Another Question
              </button>
            )}

            {messages.length > 0 && (
              <button
                type="button"
                disabled={isLoading}
                onClick={onClearChat}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#4A665C] transition-colors hover:bg-white hover:text-[#991B1B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] disabled:opacity-45 sm:ml-auto sm:min-h-[36px]"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Clear Conversation</span>
              </button>
            )}
          </div>

          {/* Question Input Form */}
          <form onSubmit={handleSubmit} className="mt-3">
            <label htmlFor={`tutor-input-${mode}-${questionId}`} className="sr-only">
              {placeholder}
            </label>
            <textarea
              ref={textareaRef}
              id={`tutor-input-${mode}-${questionId}`}
              rows={2}
              maxLength={600}
              disabled={!groqConfigured || isLoading || limitReached}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={
                limitReached
                  ? `Turn limit (${turnsLimit}/${turnsLimit}) reached for this question.`
                  : placeholder
              }
              className="w-full resize-y rounded-xl border border-[#DCEAE2] bg-white px-3.5 py-3 text-sm text-[#123F32] placeholder:text-[#4A665C]/70 focus:border-[#167D56] focus:outline-none focus:ring-2 focus:ring-[#167D56]/20 disabled:cursor-not-allowed disabled:bg-[#F7FAF8] disabled:text-[#4A665C] sm:px-4"
            />

            <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[11px] leading-relaxed text-[#4A665C]">
                {limitReached
                  ? isPreSubmit
                    ? 'Submit the quiz to unlock full Answer Explanation Mode.'
                    : 'Follow-up turn limit reached for this attempt.'
                  : 'Ask in Vietnamese or English. Context for this question is sent automatically.'}
              </span>

              <button
                type="submit"
                disabled={!groqConfigured || isLoading || limitReached || !inputText.trim()}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#167D56] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#123F32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[40px] sm:w-auto shrink-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    <span>Thinking...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{submitLabel}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
