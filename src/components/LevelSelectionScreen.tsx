import { ArrowRight, ExternalLink } from 'lucide-react';
import type { AppRuntimeConfig, CefrLevel } from '../types/quiz';

interface LevelSelectionScreenProps {
  config: AppRuntimeConfig | null;
  configError: string | null;
  onRetryConfig: () => void;
  onSelectLevel: (level: CefrLevel) => void;
}

interface LevelCardSpec {
  level: CefrLevel;
  heading: string;
  tagline: string;
  buttonLabel: string;
  focusSummary: string;
  skillsLine: string;
}

const LEVEL_CARDS: LevelCardSpec[] = [
  {
    level: 'B1',
    heading: 'B1 – Foundation',
    tagline: 'Build Your Foundation',
    buttonLabel: 'Start B1 Quiz',
    focusSummary:
      'Everyday healthy lifestyle vocabulary, daily routines, and First Conditional structures for real-life advice and choices.',
    skillsLine: 'Vocabulary · First Conditional & Unless',
  },
  {
    level: 'B2',
    heading: 'B2 – Independent',
    tagline: 'Expand Your Skills',
    buttonLabel: 'Start B2 Quiz',
    focusSummary:
      'Workplace well-being collocations, sleep and stress terminology, and nuanced First vs. Second Conditional hypotheticals.',
    skillsLine: 'Collocations · Second Conditional Advice',
  },
  {
    level: 'C1',
    heading: 'C1 – Advanced',
    tagline: 'Master Advanced English',
    buttonLabel: 'Start C1 Quiz',
    focusSummary:
      'Academic public-health lexical precision, evidence-sensitive claims, and calibrated hedging without tone clash.',
    skillsLine: 'Academic Lexis · Hedging & Qualification',
  },
];

export function LevelSelectionScreen({
  config,
  configError,
  onRetryConfig,
  onSelectLevel,
}: LevelSelectionScreenProps) {
  const getLevelMeta = (level: CefrLevel) => {
    const match = config?.levels.find((item) => item.level === level);
    return {
      questionCount: match?.questionCount ?? 6,
      passScore: match?.passScore ?? 5,
    };
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
      {/* Hero / Welcome Section */}
      <section className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-medium text-[#167D56] sm:text-sm">
          Healthy Lifestyle · Interactive Quiz &amp; Personalized AI Tutor
        </p>

        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-[#123F32] sm:mt-4 sm:text-4xl lg:text-5xl">
          Choose Your English Level
        </h1>

        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#4A665C] sm:mt-4 sm:text-base lg:text-lg">
          Select your level and test your English skills.
        </p>
      </section>

      {/* Error state if quiz JSON banks failed to load on server */}
      {configError && (
        <section
          role="alert"
          className="mx-auto mt-6 max-w-2xl rounded-2xl border border-[#C83E37]/30 bg-[#FEF2F2] p-5 text-center sm:mt-8 sm:p-6"
        >
          <h2 className="font-display text-base font-semibold text-[#991B1B]">
            Unable to Load Quiz Bank
          </h2>
          <p className="mt-2 text-sm text-[#7F1D1D]">{configError}</p>
          <button
            type="button"
            onClick={onRetryConfig}
            className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-[#991B1B] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7F1D1D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#991B1B]"
          >
            Retry Loading
          </button>
        </section>
      )}

      {/* Three CEFR Level Cards */}
      <section
        id="level-cards"
        aria-label="CEFR English Levels"
        className="mt-8 grid grid-cols-1 gap-5 sm:mt-10 md:grid-cols-3 md:gap-5 lg:mt-12 lg:gap-8"
      >
        {LEVEL_CARDS.map((card) => {
          const meta = getLevelMeta(card.level);
          const isFeatured = card.level === 'B2';

          return (
            <article
              key={card.level}
              className={`group flex min-w-0 flex-col justify-between rounded-2xl border p-5 transition-all duration-200 sm:p-6 lg:p-7 ${
                isFeatured
                  ? 'border-[#167D56]/35 bg-gradient-to-b from-[#E9F8F0]/75 via-white to-white shadow-[0_12px_32px_-16px_rgba(18,63,50,0.16)]'
                  : 'border-[#DCEAE2] bg-white hover:border-[#24A78B]/50 hover:shadow-[0_12px_32px_-16px_rgba(18,63,50,0.12)]'
              }`}
            >
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <span className="font-mono text-xs font-semibold text-[#167D56] tabular-nums">
                    CEFR {card.level}
                  </span>
                  <span className="font-mono text-xs text-[#4A665C] tabular-nums">
                    {meta.questionCount} questions · Pass {meta.passScore}/{meta.questionCount}
                  </span>
                </div>

                <h2 className="mt-3.5 font-display text-xl font-bold tracking-tight text-[#123F32] sm:mt-4 sm:text-2xl">
                  {card.heading}
                </h2>

                <p className="mt-1 text-sm font-medium text-[#167D56] sm:mt-1.5 sm:text-base">
                  {card.tagline}
                </p>

                <p className="mt-3.5 text-sm leading-relaxed text-[#4A665C] sm:mt-4">
                  {card.focusSummary}
                </p>

                <p className="mt-4 border-t border-[#DCEAE2]/80 pt-3.5 text-xs font-medium text-[#4A665C] sm:mt-5 sm:pt-4">
                  {card.skillsLine}
                </p>
              </div>

              <button
                type="button"
                disabled={Boolean(configError)}
                onClick={() => onSelectLevel(card.level)}
                className={`mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] disabled:cursor-not-allowed disabled:opacity-50 sm:mt-7 ${
                  isFeatured
                    ? 'bg-[#167D56] text-white hover:bg-[#123F32]'
                    : 'bg-[#123F32] text-white hover:bg-[#167D56]'
                }`}
              >
                <span>{card.buttonLabel}</span>
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
            </article>
          );
        })}
      </section>

      {/* How the Two-Stage Learning Flow Works */}
      <section className="mt-10 border-t border-[#DCEAE2] pt-8 sm:mt-14 sm:pt-10">
        <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3">
          <div>
            <p className="font-mono text-xs font-semibold text-[#167D56]">01. Guided Practice</p>
            <h3 className="mt-1.5 font-display text-base font-semibold text-[#123F32] sm:mt-2">
              Conceptual Help Before Submit
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#4A665C]">
              Ask your AI tutor about vocabulary or grammar rules at any question—explained in
              Vietnamese with English examples, without spoiling the answer.
            </p>
          </div>
          <div>
            <p className="font-mono text-xs font-semibold text-[#167D56]">02. Deterministic Grading</p>
            <h3 className="mt-1.5 font-display text-base font-semibold text-[#123F32] sm:mt-2">
              Instant Automated Scoring
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#4A665C]">
              Every quiz is graded by server-side code against the verified lesson answer key,
              followed by an 8-part personalized AI study report.
            </p>
          </div>
          <div>
            <p className="font-mono text-xs font-semibold text-[#167D56]">03. Deep Mastery</p>
            <h3 className="mt-1.5 font-display text-base font-semibold text-[#123F32] sm:mt-2">
              Question-by-Question AI Chat
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#4A665C]">
              Review each item with its official explanation and hold a focused multi-turn
              conversation about why an option is right or wrong.
            </p>
          </div>
        </div>

        {/* Canva Lesson Reference Notice */}
        <div className="mt-8 flex flex-col gap-2 border-t border-[#DCEAE2]/80 pt-5 text-xs text-[#4A665C] sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:pt-6">
          <span>Personalized English Lesson · Healthy Lifestyle · CEFR B1–C1</span>
          {config?.canvaViewUrl ? (
            <a
              href={config.canvaViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[36px] items-center gap-1.5 font-medium text-[#167D56] hover:text-[#123F32] hover:underline"
            >
              <span>Back to Canva Lessons</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : (
            <span>Canva lesson link not configured</span>
          )}
        </div>
      </section>
    </main>
  );
}
