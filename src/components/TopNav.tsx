import { ArrowLeftRight, ExternalLink } from 'lucide-react';
import type { CefrLevel } from '../types/quiz';

export type AppScreen = 'levels' | 'intro' | 'quiz' | 'results' | 'review';

interface TopNavProps {
  currentScreen: AppScreen;
  selectedLevel: CefrLevel | null;
  hasActiveAttempt: boolean;
  hasSubmitted: boolean;
  canvaViewUrl: string | null;
  onNavigate: (screen: AppScreen) => void;
  onRequestChangeLevel: () => void;
}

export function TopNav({
  currentScreen,
  selectedLevel,
  hasActiveAttempt,
  hasSubmitted,
  canvaViewUrl,
  onNavigate,
  onRequestChangeLevel,
}: TopNavProps) {
  const navItems: Array<{ id: AppScreen; label: string; enabled: boolean }> = [
    { id: 'levels', label: 'Levels', enabled: true },
    { id: 'quiz', label: 'Quiz', enabled: hasActiveAttempt && !hasSubmitted },
    { id: 'results', label: 'Results', enabled: hasSubmitted },
    { id: 'review', label: 'Review', enabled: hasSubmitted },
  ];

  const showChangeLevelAsPrimary = Boolean(selectedLevel) && !hasSubmitted;

  return (
    <header className="sticky top-0 z-30 border-b border-[#DCEAE2] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:h-16 sm:gap-6 sm:px-6 lg:gap-8 lg:px-8">
        {/* Zone 1: Single-line brand wordmark with safe mobile truncation */}
        <button
          type="button"
          onClick={() => (selectedLevel ? onRequestChangeLevel() : onNavigate('levels'))}
          className="min-w-0 truncate font-display text-sm font-bold tracking-tight text-[#123F32] transition-colors hover:text-[#167D56] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#167D56] sm:text-base lg:text-lg"
        >
          Personalized English Lesson
        </button>

        {/* Zone 2: Clean single-line text navigation links (tablet/desktop) */}
        <nav
          aria-label="Lesson progress navigation"
          className="hidden items-center gap-5 md:flex lg:gap-6"
        >
          {navItems.map((item) => {
            const isActive =
              currentScreen === item.id ||
              (currentScreen === 'intro' && item.id === 'levels');
            return (
              <button
                key={item.id}
                type="button"
                disabled={!item.enabled}
                onClick={() => {
                  if (item.id === 'levels' && selectedLevel && hasActiveAttempt && !hasSubmitted) {
                    onRequestChangeLevel();
                  } else {
                    onNavigate(item.id);
                  }
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#167D56] ${
                  isActive
                    ? 'text-[#167D56] after:absolute after:inset-x-0 after:-bottom-[1.25rem] after:h-0.5 after:bg-[#167D56]'
                    : item.enabled
                      ? 'text-[#4A665C] hover:text-[#123F32]'
                      : 'cursor-not-allowed text-[#4A665C]/40'
                }`}
              >
                {item.label}
              </button>
            );
          })}

          {canvaViewUrl && (
            <a
              href={canvaViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 py-1 text-sm font-medium text-[#167D56] transition-colors hover:text-[#123F32] hover:underline whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#167D56]"
            >
              <span>Canva Lessons</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </nav>

        {/* Zone 3: Primary action + mobile Canva quick return */}
        <div className="flex items-center gap-2 shrink-0">
          {showChangeLevelAsPrimary ? (
            <>
              {canvaViewUrl && (
                <a
                  href={canvaViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[40px] items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#167D56] transition-colors hover:bg-[#E9F8F0] whitespace-nowrap shrink-0 md:hidden"
                >
                  <span>Canva</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
              <button
                type="button"
                onClick={onRequestChangeLevel}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DCEAE2] bg-[#F7FAF8] px-3 py-2 text-xs font-semibold text-[#123F32] transition-colors hover:border-[#167D56]/40 hover:bg-[#E9F8F0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] whitespace-nowrap shrink-0 sm:gap-2 sm:px-4 sm:text-sm"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-[#167D56]" aria-hidden="true" />
                <span className="sm:hidden">Level</span>
                <span className="hidden sm:inline">Change Level</span>
              </button>
            </>
          ) : canvaViewUrl ? (
            <a
              href={canvaViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#167D56] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#123F32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] whitespace-nowrap shrink-0 sm:gap-2 sm:px-4 sm:text-sm"
            >
              <span className="sm:hidden">Canva</span>
              <span className="hidden sm:inline">Back to Canva Lessons</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : (
            <a
              href="#level-cards"
              className="inline-flex min-h-[40px] items-center rounded-xl bg-[#167D56] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#123F32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] whitespace-nowrap shrink-0 sm:px-4 sm:text-sm"
            >
              Choose Level
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
