import { ArrowLeft, ArrowRight, CheckCircle2, HelpCircle, Loader2, ShieldCheck } from 'lucide-react';
import type { AppRuntimeConfig, CefrLevel } from '../types/quiz';

interface QuizIntroScreenProps {
  level: CefrLevel;
  config: AppRuntimeConfig | null;
  isStarting: boolean;
  startError: string | null;
  onStartQuiz: () => void;
  onBackToLevels: () => void;
}

const LEVEL_DETAILS: Record<
  CefrLevel,
  { name: string; subtitle: string; objectives: string[] }
> = {
  B1: {
    name: 'B1 – Foundation',
    subtitle: 'Build Your Foundation',
    objectives: [
      'Apply core Healthy Lifestyle vocabulary accurately in context (B1-LO1).',
      'Use First Conditional and Unless structures cleanly for real-life advice (B1-LO2).',
    ],
  },
  B2: {
    name: 'B2 – Independent',
    subtitle: 'Expand Your Skills',
    objectives: [
      'Master accurate health, sleep, and work-life balance collocations (B2-LO1).',
      'Distinguish First vs. Second Conditional and write well-reasoned hypothetical advice (B2-LO2).',
    ],
  },
  C1: {
    name: 'C1 – Advanced',
    subtitle: 'Master Advanced English',
    objectives: [
      'Demonstrate C1 lexical precision and academic collocations in public-health discourse (C1-LO1).',
      'Apply calibrated hedging and qualification while avoiding overgeneralisation and tone clash (C1-LO2).',
    ],
  },
};

export function QuizIntroScreen({
  level,
  config,
  isStarting,
  startError,
  onStartQuiz,
  onBackToLevels,
}: QuizIntroScreenProps) {
  const details = LEVEL_DETAILS[level];
  const levelInfo = config?.levels.find((l) => l.level === level);
  const questionCount = levelInfo?.questionCount ?? 6;
  const passScore = levelInfo?.passScore ?? 5;
  const preLimit = config?.limits.preSubmitTurnsPerQuestion ?? 3;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <button
        type="button"
        onClick={onBackToLevels}
        className="inline-flex min-h-[40px] items-center gap-2 text-sm font-medium text-[#4A665C] transition-colors hover:text-[#123F32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>Back to Level Selection</span>
      </button>

      <section className="mt-6 rounded-2xl border border-[#DCEAE2] bg-white p-7 sm:p-10">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#4A665C]">
          <span className="font-mono font-semibold text-[#167D56]">CEFR {level}</span>
          <span aria-hidden="true">·</span>
          <span>Healthy Lifestyle Quiz</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{questionCount} Questions</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">Pass Benchmark {passScore}/{questionCount}</span>
        </div>

        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#123F32] sm:text-4xl">
          {details.name}
        </h1>
        <p className="mt-1.5 text-base font-medium text-[#167D56]">{details.subtitle}</p>

        {/* Learning Objectives */}
        <div className="mt-8 border-t border-[#DCEAE2] pt-6">
          <h2 className="font-display text-sm font-semibold text-[#123F32]">
            What You Will Practise
          </h2>
          <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-[#4A665C]">
            {details.objectives.map((objective) => (
              <li key={objective} className="flex items-start gap-2.5">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#167D56]"
                  aria-hidden="true"
                />
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Quiz Rules & AI Tutor Mode Summary */}
        <div className="mt-8 grid grid-cols-1 gap-4 border-t border-[#DCEAE2] pt-6 sm:grid-cols-2">
          <div className="rounded-xl bg-[#F7FAF8] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#123F32]">
              <HelpCircle className="h-4 w-4 text-[#24A78B]" aria-hidden="true" />
              <span>AI Tutor During Quiz</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#4A665C]">
              Expand the AI Tutor below any question for conceptual vocabulary or grammar help (up
              to {preLimit} questions per item). Answers are never revealed before submission.
            </p>
          </div>

          <div className="rounded-xl bg-[#F7FAF8] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#123F32]">
              <ShieldCheck className="h-4 w-4 text-[#167D56]" aria-hidden="true" />
              <span>Grading &amp; Review</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#4A665C]">
              Navigate freely between all {questionCount} questions before submitting. The{' '}
              {passScore}/{questionCount} pass score is a lesson quiz benchmark, not an official
              CEFR certification.
            </p>
          </div>
        </div>

        {config !== null && !config.groqConfigured && (
          <div className="mt-6 rounded-xl border border-[#B45309]/25 bg-[#FFFBEB] px-4 py-3 text-xs leading-relaxed text-[#92400E]">
            <span className="font-semibold">Note: </span>
            AI Tutor requires Groq API configuration. You can still complete the entire {level} quiz
            and receive full automated grading with approved Vietnamese explanations.
          </div>
        )}

        {startError && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-[#C83E37]/30 bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]"
          >
            {startError}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#DCEAE2] pt-6">
          <button
            type="button"
            onClick={onBackToLevels}
            className="min-h-[44px] rounded-xl border border-[#DCEAE2] bg-white px-5 py-2.5 text-sm font-semibold text-[#123F32] transition-colors hover:bg-[#F7FAF8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56]"
          >
            Choose Another Level
          </button>

          <button
            type="button"
            disabled={isStarting}
            onClick={onStartQuiz}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#167D56] px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#123F32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStarting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Starting {level} Quiz...</span>
              </>
            ) : (
              <>
                <span>Start Quiz</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </section>
    </main>
  );
}
