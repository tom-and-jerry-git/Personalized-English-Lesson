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

  return (
    <header className="sticky top-0 z-30 border-b border-[#DCEAE2] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line brand wordmark */}
        <button
          type="button"
          onClick={() => (selectedLevel ? onRequestChangeLevel() : onNavigate('levels'))}
          className="font-display text-base font-bold tracking-tight text-[#123F32] transition-colors hover:text-[#167D56] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#167D56] whitespace-nowrap shrink-0 sm:text-lg"
        >
          Personalized English Lesson
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Lesson progress navigation"
          className="hidden items-center gap-6 md:flex"
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
        </nav>

        {/* Zone 3: Single contextual primary action */}
        <div className="flex items-center shrink-0">
          {selectedLevel ? (
            <button
              type="button"
              onClick={onRequestChangeLevel}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[#DCEAE2] bg-[#F7FAF8] px-4 py-2 text-xs font-semibold text-[#123F32] transition-colors hover:border-[#167D56]/40 hover:bg-[#E9F8F0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] whitespace-nowrap shrink-0 sm:text-sm"
            >
              <ArrowLeftRight className="h-3.5 w-3.5 text-[#167D56]" aria-hidden="true" />
              <span>Change Level</span>
            </button>
          ) : canvaViewUrl ? (
            <a
              href={canvaViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#167D56] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#123F32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] whitespace-nowrap shrink-0 sm:text-sm"
            >
              <span>Back to Canva Lessons</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : (
            <a
              href="#level-cards"
              className="inline-flex min-h-[40px] items-center rounded-xl bg-[#167D56] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#123F32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D56] whitespace-nowrap shrink-0 sm:text-sm"
            >
              Choose Level
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
