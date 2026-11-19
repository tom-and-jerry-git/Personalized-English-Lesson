import React from 'react';

interface FormattedAiTextProps {
  text: string;
  compact?: boolean;
}

function normalizeRawText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?(?:p|div|ul|ol|li|b|strong|i|em|span)[^>]*>/gi, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderInlineFormatting(line: string, keyPrefix: string): React.ReactNode[] {
  // Tokenize **bold**, `inline phrase`, and Question IDs like B1-NQ01 / B2-NQ04 / C1-NQ06
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\b(?:B1|B2|C1)-NQ0[1-6]\b)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }

    const token = match[0];
    const tokenKey = `${keyPrefix}-${match.index}`;

    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={tokenKey} className="font-semibold text-[#123F32]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <span
          key={tokenKey}
          className="rounded-md bg-[#E9F8F0] px-1.5 py-0.5 font-medium text-[#123F32]"
        >
          {token.slice(1, -1)}
        </span>
      );
    } else {
      // CEFR Question ID like B2-NQ04
      nodes.push(
        <span
          key={tokenKey}
          className="font-mono text-[12px] font-semibold text-[#167D56]"
        >
          {token}
        </span>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  return nodes;
}

type Block =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'bullet_list'; items: string[] }
  | { type: 'ordered_list'; items: Array<{ num: string; text: string }> };

function parseBlocks(text: string): Block[] {
  const normalized = normalizeRawText(text);
  const rawLines = normalized.split('\n');
  const blocks: Block[] = [];

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;

    const bulletMatch = line.match(/^(?:[-•*])\s+(.+)$/);
    if (bulletMatch) {
      const content = bulletMatch[1].trim();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === 'bullet_list') {
        prev.items.push(content);
      } else {
        blocks.push({ type: 'bullet_list', items: [content] });
      }
      continue;
    }

    const orderedMatch = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (orderedMatch) {
      const num = orderedMatch[1];
      const content = orderedMatch[2].trim();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === 'ordered_list') {
        prev.items.push({ num, text: content });
      } else {
        blocks.push({ type: 'ordered_list', items: [{ num, text: content }] });
      }
      continue;
    }

    const prev = blocks[blocks.length - 1];
    if (prev && prev.type === 'paragraph') {
      prev.lines.push(line);
    } else {
      blocks.push({ type: 'paragraph', lines: [line] });
    }
  }

  return blocks;
}

export function FormattedAiText({ text, compact = false }: FormattedAiTextProps) {
  const blocks = parseBlocks(text);
  const textSize = compact ? 'text-sm leading-relaxed' : 'text-sm leading-relaxed sm:text-[15px]';

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className={`min-w-0 space-y-3 break-words text-[#123F32]/90 ${textSize}`}>
      {blocks.map((block, bIdx) => {
        if (block.type === 'bullet_list') {
          return (
            <ul key={`bl-${bIdx}`} className="space-y-2.5">
              {block.items.map((item, iIdx) => (
                <li
                  key={`bli-${bIdx}-${iIdx}`}
                  className="flex min-w-0 items-start gap-2.5 rounded-xl border border-[#DCEAE2]/80 bg-[#F7FAF8] px-3 py-2.5 sm:px-3.5"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#167D56]"
                  />
                  <span className="min-w-0 flex-1 break-words">
                    {renderInlineFormatting(item, `bl-${bIdx}-${iIdx}`)}
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ordered_list') {
          return (
            <ol key={`ol-${bIdx}`} className="space-y-2.5">
              {block.items.map((item, iIdx) => (
                <li
                  key={`oli-${bIdx}-${iIdx}`}
                  className="flex min-w-0 items-start gap-2.5 rounded-xl border border-[#DCEAE2]/80 bg-[#F7FAF8] px-3 py-2.5 sm:gap-3 sm:px-3.5"
                >
                  <span className="mt-0.5 shrink-0 font-mono text-xs font-semibold text-[#167D56] tabular-nums">
                    {item.num}.
                  </span>
                  <span className="min-w-0 flex-1 break-words">
                    {renderInlineFormatting(item.text, `ol-${bIdx}-${iIdx}`)}
                  </span>
                </li>
              ))}
            </ol>
          );
        }

        return (
          <div key={`p-${bIdx}`} className="min-w-0 space-y-2">
            {block.lines.map((line, lIdx) => (
              <p key={`pl-${bIdx}-${lIdx}`} className="break-words">
                {renderInlineFormatting(line, `p-${bIdx}-${lIdx}`)}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
