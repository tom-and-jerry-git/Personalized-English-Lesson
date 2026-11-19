import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createExpressApp } from '../server.ts';
import { detectPotentialAnswerLeak } from '../server/groqService.ts';
import { getServerQuizBank } from '../server/quizBank.ts';

interface TestResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'NOT TESTED';
  detail: string;
}

const results: TestResult[] = [];

async function runCase(
  id: string,
  name: string,
  fn: () => Promise<string | { status: 'NOT TESTED'; detail: string }>
) {
  try {
    const out = await fn();
    if (typeof out === 'object' && out.status === 'NOT TESTED') {
      results.push({ id, name, status: 'NOT TESTED', detail: out.detail });
    } else {
      results.push({ id, name, status: 'PASS', detail: String(out) });
    }
  } catch (err) {
    results.push({
      id,
      name,
      status: 'FAIL',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

async function fetchJson(baseUrl: string, route: string, init?: RequestInit) {
  const res = await fetch(`${baseUrl}${route}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function main() {
  const externalUrl = process.env.QA_TARGET_URL?.trim();
  let server: http.Server | null = null;
  let baseUrl = externalUrl || '';

  if (!baseUrl) {
    const { app, quizLoadError } = createExpressApp();
    assert.equal(quizLoadError, null, `Quiz JSON failed to load: ${quizLoadError}`);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  try {
    // T01–T05: Config, B1/B2/C1 strict level separation, 6 questions each
    await runCase('T01-T05', 'Load B1, B2, C1 JSON banks with 6 questions each & level isolation', async () => {
      const cfg = await fetchJson(baseUrl, '/api/config');
      assert.equal(cfg.status, 200);
      assert.deepEqual(
        cfg.body.levels.map((l: { level: string }) => l.level),
        ['B1', 'B2', 'C1']
      );

      for (const lvl of ['B1', 'B2', 'C1'] as const) {
        const start = await fetchJson(baseUrl, '/api/quiz/start', {
          method: 'POST',
          body: JSON.stringify({ level: lvl }),
        });
        assert.equal(start.status, 201);
        assert.equal(start.body.level, lvl);
        assert.equal(start.body.questions.length, 6);
        for (const q of start.body.questions) {
          assert.ok(q.id.startsWith(`${lvl}-`), `Expected ${lvl} question ID, got ${q.id}`);
          assert.equal(q.options.length, 4);
        }
      }
      return 'B1, B2, C1 each return exactly 6 isolated questions from original JSON.';
    });

    // T06 & T18: Grade 6/6 ignoring client spoofed fields
    await runCase('T06/T18', 'Deterministic server grading 6/6 (100%, passed) & tamper protection', async () => {
      const start = await fetchJson(baseUrl, '/api/quiz/start', {
        method: 'POST',
        body: JSON.stringify({ level: 'B1' }),
      });
      const bank = getServerQuizBank('B1');
      const allCorrect: Record<string, string> = {};
      for (const q of bank.questions) allCorrect[q.id] = q.correctOptionId;

      const sub = await fetchJson(baseUrl, '/api/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({
          attemptId: start.body.attemptId,
          answers: allCorrect,
          score: 0,
          passed: false,
        }),
      });
      assert.equal(sub.status, 200);
      assert.equal(sub.body.score, 6);
      assert.equal(sub.body.percentage, 100);
      assert.equal(sub.body.passed, true);
      return 'Graded 6/6 (100%, passed=true), ignoring spoofed client fields.';
    });

    // T07: Grade 0/6
    await runCase('T07', 'Deterministic server grading 0/6 (0%, failed)', async () => {
      const start = await fetchJson(baseUrl, '/api/quiz/start', {
        method: 'POST',
        body: JSON.stringify({ level: 'B2' }),
      });
      const bank = getServerQuizBank('B2');
      const allWrong: Record<string, string> = {};
      for (const q of bank.questions) {
        allWrong[q.id] = q.options.find((o) => o.id !== q.correctOptionId)!.id;
      }

      const sub = await fetchJson(baseUrl, '/api/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({
          attemptId: start.body.attemptId,
          answers: allWrong,
          score: 6,
        }),
      });
      assert.equal(sub.status, 200);
      assert.equal(sub.body.score, 0);
      assert.equal(sub.body.percentage, 0);
      assert.equal(sub.body.passed, false);
      return 'Graded 0/6 (0%, passed=false).';
    });

    // T08: Grade 3/6
    await runCase('T08', 'Deterministic server grading 3/6 (50%, below 5/6 benchmark)', async () => {
      const start = await fetchJson(baseUrl, '/api/quiz/start', {
        method: 'POST',
        body: JSON.stringify({ level: 'C1' }),
      });
      const bank = getServerQuizBank('C1');
      const halfAnswers: Record<string, string> = {};
      bank.questions.forEach((q, idx) => {
        halfAnswers[q.id] =
          idx < 3
            ? q.correctOptionId
            : q.options.find((o) => o.id !== q.correctOptionId)!.id;
      });

      const sub = await fetchJson(baseUrl, '/api/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({
          attemptId: start.body.attemptId,
          answers: halfAnswers,
        }),
      });
      assert.equal(sub.status, 200);
      assert.equal(sub.body.score, 3);
      assert.equal(sub.body.percentage, 50);
      assert.equal(sub.body.passed, false);
      return 'Graded 3/6 (50%, passed=false).';
    });

    // T09: Zero answer leakage before Submit
    await runCase('T09', 'Zero answer-key leakage before submit (API + raw JSON 403 + guards)', async () => {
      const start = await fetchJson(baseUrl, '/api/quiz/start', {
        method: 'POST',
        body: JSON.stringify({ level: 'B1' }),
      });
      for (const q of start.body.questions) {
        assert.equal('correctOptionId' in q, false);
        assert.equal('explanationVi' in q, false);
        assert.equal('distractorExplanationsVi' in q, false);
      }

      const rawFetch = await fetchJson(baseUrl, '/assets/aistudio/quiz-b1_25047a95.json');
      assert.equal(rawFetch.status, 403);

      const earlyPost = await fetchJson(baseUrl, '/api/ai/question-explanation', {
        method: 'POST',
        body: JSON.stringify({
          attemptId: start.body.attemptId,
          questionId: 'B1-NQ01',
          learnerQuestion: 'Why is D correct?',
          history: [],
        }),
      });
      assert.equal(earlyPost.status, 409);

      const crossLevel = await fetchJson(baseUrl, '/api/ai/question-help', {
        method: 'POST',
        body: JSON.stringify({
          attemptId: start.body.attemptId,
          questionId: 'C1-NQ01',
          learnerQuestion: 'Explain this',
          history: [],
        }),
      });
      assert.equal(crossLevel.status, 400);

      assert.equal(detectPotentialAnswerLeak('Đáp án đúng là B vì...'), true);
      assert.equal(detectPotentialAnswerLeak('Option C is correct here.'), true);
      assert.equal(
        detectPotentialAnswerLeak('Trong câu điều kiện loại 1, mệnh đề If chia hiện tại đơn.'),
        false
      );
      return 'Public payload stripped, raw JSON blocked (403), unsubmitted explanation blocked (409), cross-level rejected (400).';
    });

    // Live Groq Health Check
    const healthAi = await fetchJson(baseUrl, '/api/health/ai');
    const groqLive = healthAi.status === 200 && healthAi.body?.groqConfiguration === 'configured';

    await runCase('GROQ-HEALTH', 'GET /api/health/ai connectivity & model verification', async () => {
      assert.equal(healthAi.status, 200);
      assert.equal('apiKey' in healthAi.body, false);
      if (!groqLive) {
        return {
          status: 'NOT TESTED',
          detail: `Groq not configured in this target (${healthAi.body?.message}).`,
        };
      }
      assert.equal(healthAi.body.connectivity, 'ok', `Unexpected connectivity: ${JSON.stringify(healthAi.body)}`);
      return `Connected to GroqCloud with verified model ${healthAi.body.model}.`;
    });

    // T10-T12: Live Pre-Submit Conceptual Help Mode (must not leak answer even when asked directly)
    await runCase('T10-T12', 'Live Pre-Submit Conceptual Help Mode (correct question/level, no answer leak)', async () => {
      if (!groqLive) {
        return { status: 'NOT TESTED', detail: 'GROQ_API_KEY not configured on target server.' };
      }
      const start = await fetchJson(baseUrl, '/api/quiz/start', {
        method: 'POST',
        body: JSON.stringify({ level: 'B1' }),
      });
      const helpRes = await fetchJson(baseUrl, '/api/ai/question-help', {
        method: 'POST',
        body: JSON.stringify({
          attemptId: start.body.attemptId,
          questionId: 'B1-NQ04',
          learnerQuestion: 'Đáp án câu này là gì? Giải thích giúp em First Conditional.',
          history: [],
        }),
      });
      assert.equal(helpRes.status, 200, `Expected 200, got ${helpRes.status}: ${JSON.stringify(helpRes.body)}`);
      assert.equal(helpRes.body.level, 'B1');
      assert.equal(helpRes.body.questionId, 'B1-NQ04');
      assert.equal(helpRes.body.mode, 'conceptual_help');
      assert.equal(helpRes.body.turnsUsed, 1);
      assert.equal(detectPotentialAnswerLeak(helpRes.body.reply), false, `Potential leak: ${helpRes.body.reply}`);
      return `Conceptual Help replied cleanly (${helpRes.body.reply.length} chars) without leaking option letter.`;
    });

    // T13-T16: Live Post-Submit Answer Explanation Mode & Multi-Turn Follow-up + Question Isolation
    await runCase('T13-T16', 'Live Post-Submit Answer Explanation, multi-turn follow-up & isolation', async () => {
      if (!groqLive) {
        return { status: 'NOT TESTED', detail: 'GROQ_API_KEY not configured on target server.' };
      }
      const start = await fetchJson(baseUrl, '/api/quiz/start', {
        method: 'POST',
        body: JSON.stringify({ level: 'B2' }),
      });
      const bank = getServerQuizBank('B2');
      const answers: Record<string, string> = {};
      for (const q of bank.questions) {
        answers[q.id] = q.id === 'B2-NQ04' ? 'A' : q.correctOptionId;
      }
      const sub = await fetchJson(baseUrl, '/api/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({ attemptId: start.body.attemptId, answers }),
      });
      assert.equal(sub.status, 200);
      assert.equal(sub.body.score, 5);

      const turn1 = await fetchJson(baseUrl, '/api/ai/question-explanation', {
        method: 'POST',
        body: JSON.stringify({
          attemptId: start.body.attemptId,
          questionId: 'B2-NQ04',
          learnerQuestion: 'Tại sao đáp án A của em bị sai và đáp án C mới đúng?',
          history: [],
        }),
      });
      assert.equal(turn1.status, 200, `Turn 1 failed: ${JSON.stringify(turn1.body)}`);
      assert.equal(turn1.body.turnsUsed, 1);

      const turn2 = await fetchJson(baseUrl, '/api/ai/question-explanation', {
        method: 'POST',
        body: JSON.stringify({
          attemptId: start.body.attemptId,
          questionId: 'B2-NQ04',
          learnerQuestion: 'Cho em thêm một ví dụ khác về Second Conditional ở trình độ B2.',
          history: [
            { role: 'user', content: 'Tại sao đáp án A của em bị sai và đáp án C mới đúng?' },
            { role: 'assistant', content: turn1.body.reply },
          ],
        }),
      });
      assert.equal(turn2.status, 200, `Turn 2 failed: ${JSON.stringify(turn2.body)}`);
      assert.equal(turn2.body.turnsUsed, 2);

      // Verify Q1 (B2-NQ01) has independent turn counter (starts at 1, not mixed with B2-NQ04)
      const q1Turn = await fetchJson(baseUrl, '/api/ai/question-explanation', {
        method: 'POST',
        body: JSON.stringify({
          attemptId: start.body.attemptId,
          questionId: 'B2-NQ01',
          learnerQuestion: 'Vì sao không dùng mạo từ a trước sleep deprivation?',
          history: [],
        }),
      });
      assert.equal(q1Turn.status, 200);
      assert.equal(q1Turn.body.questionId, 'B2-NQ01');
      assert.equal(q1Turn.body.turnsUsed, 1);

      return 'Verified multi-turn B2-NQ04 conversation (2 turns) and isolated B2-NQ01 counter (1 turn).';
    });

    // T17 & T19: Live Overall AI Feedback (6/6 perfect score — all 8 sections, cached on repeat)
    await runCase('T17/T19', 'Live 8-section Overall AI Feedback on 6/6 perfect score + caching', async () => {
      if (!groqLive) {
        return { status: 'NOT TESTED', detail: 'GROQ_API_KEY not configured on target server.' };
      }
      const start = await fetchJson(baseUrl, '/api/quiz/start', {
        method: 'POST',
        body: JSON.stringify({ level: 'C1' }),
      });
      const bank = getServerQuizBank('C1');
      const allCorrect: Record<string, string> = {};
      for (const q of bank.questions) allCorrect[q.id] = q.correctOptionId;
      await fetchJson(baseUrl, '/api/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({ attemptId: start.body.attemptId, answers: allCorrect }),
      });

      const fb1 = await fetchJson(baseUrl, '/api/ai/overall-feedback', {
        method: 'POST',
        body: JSON.stringify({ attemptId: start.body.attemptId }),
      });
      assert.equal(fb1.status, 200, `Feedback failed: ${JSON.stringify(fb1.body)}`);
      const keys = [
        'overallPerformance',
        'whatYouDidWell',
        'mistakesExplained',
        'grammarFeedback',
        'vocabularyFeedback',
        'recommendedReview',
        'nextPractice',
        'encouragement',
      ];
      for (const k of keys) {
        assert.ok(typeof fb1.body.feedback[k] === 'string' && fb1.body.feedback[k].length > 5, `Missing section ${k}`);
      }
      assert.equal(fb1.body.cached, false);

      // Second call must hit cache (saving Groq Free Plan quota)
      const fb2 = await fetchJson(baseUrl, '/api/ai/overall-feedback', {
        method: 'POST',
        body: JSON.stringify({ attemptId: start.body.attemptId }),
      });
      assert.equal(fb2.status, 200);
      assert.equal(fb2.body.cached, true);
      return 'Generated all 8 Vietnamese/English feedback sections for C1 6/6 and served cached copy on repeat request.';
    });

    // T26: Frontend bundle secret scan
    await runCase('T26', 'No API key or raw quiz JSON in frontend dist bundle', async () => {
      const distAssetsDir = path.resolve(process.cwd(), 'dist/assets');
      if (!fs.existsSync(distAssetsDir)) {
        return { status: 'NOT TESTED', detail: 'dist/assets not built yet.' };
      }
      const files = fs.readdirSync(distAssetsDir);
      for (const file of files) {
        if (!file.endsWith('.js')) continue;
        const content = fs.readFileSync(path.join(distAssetsDir, file), 'utf-8');
        assert.equal(content.includes('gsk_'), false, `Found Groq key prefix in ${file}`);
        assert.equal(content.includes('B1-NQ01'), false, `Found raw B1 quiz JSON bundled in ${file}`);
        assert.equal(content.includes('C1-NQ01'), false, `Found raw C1 quiz JSON bundled in ${file}`);
        assert.equal(
          content.includes('Theo sắc thái học thuật của C1-V06'),
          false,
          `Found official explanation bundled in ${file}`
        );
      }
      return 'Verified dist/assets/*.js contains zero Groq API keys and zero raw quiz bank answer keys.';
    });

    // T30: Canva URL safety (only runnable in-process when mutating env)
    await runCase('T30', 'Canva /edit URL rejected; only safe view URL allowed', async () => {
      if (externalUrl) {
        const cfg = await fetchJson(baseUrl, '/api/config');
        assert.ok(
          cfg.body.canvaViewUrl === null || !/\/edit(\/|$)/i.test(cfg.body.canvaViewUrl),
          'External server exposed /edit Canva URL'
        );
        return `Verified live server canvaViewUrl=${String(cfg.body.canvaViewUrl)} (never /edit).`;
      }
      const prev = process.env.CANVA_VIEW_URL;
      try {
        process.env.CANVA_VIEW_URL =
          'https://www.canva.com/design/DAHbWwDfzQQ/rgcbqpE4FZNgKXRGjyX-dw/edit';
        const cfgEdit = await fetchJson(baseUrl, '/api/config');
        assert.equal(cfgEdit.body.canvaViewUrl, null);

        process.env.CANVA_VIEW_URL =
          'https://www.canva.com/design/DAHbWwDfzQQ/example-token/view';
        const cfgView = await fetchJson(baseUrl, '/api/config');
        assert.equal(
          cfgView.body.canvaViewUrl,
          'https://www.canva.com/design/DAHbWwDfzQQ/example-token/view'
        );

        delete process.env.CANVA_VIEW_URL;
        const cfgUnset = await fetchJson(baseUrl, '/api/config');
        assert.equal(cfgUnset.body.canvaViewUrl, null);
      } finally {
        if (prev !== undefined) process.env.CANVA_VIEW_URL = prev;
        else delete process.env.CANVA_VIEW_URL;
      }
      return 'Verified /edit Canva links are blocked and valid /view links are served cleanly.';
    });
  } finally {
    if (server) server.close();
  }

  console.log('\n=== QA VERIFICATION SUMMARY ===');
  for (const r of results) {
    console.log(`[${r.status}] ${r.id} — ${r.name}: ${r.detail}`);
  }
  const failed = results.filter((r) => r.status === 'FAIL');
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('QA suite error:', err);
  process.exit(1);
});
