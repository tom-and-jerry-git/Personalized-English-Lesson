import type {
  ApiErrorPayload,
  AppRuntimeConfig,
  CefrLevel,
  GradingResult,
  OptionId,
  OverallFeedbackData,
  PublicQuizPayload,
  TutorReplyPayload,
} from '../types/quiz';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorPayload['code'];
  public readonly retryable: boolean;

  constructor(message: string, status: number, code: ApiErrorPayload['code'], retryable = false) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new ApiClientError(
      'Unable to reach the server. Please check your connection and try again.',
      0,
      'UPSTREAM_ERROR',
      true
    );
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errObj = (data && typeof data === 'object' ? data : {}) as Partial<ApiErrorPayload>;
    throw new ApiClientError(
      errObj.error || `Request failed with status ${response.status}.`,
      response.status,
      errObj.code || 'UPSTREAM_ERROR',
      Boolean(errObj.retryable)
    );
  }

  return data as T;
}

export function fetchRuntimeConfig(): Promise<AppRuntimeConfig> {
  return requestJson<AppRuntimeConfig>('/api/config');
}

export function startQuizAttempt(level: CefrLevel): Promise<PublicQuizPayload> {
  return requestJson<PublicQuizPayload>('/api/quiz/start', {
    method: 'POST',
    body: JSON.stringify({ level }),
  });
}

export function submitQuizAttempt(
  attemptId: string,
  answers: Record<string, OptionId | null>
): Promise<GradingResult> {
  return requestJson<GradingResult>('/api/quiz/submit', {
    method: 'POST',
    body: JSON.stringify({ attemptId, answers }),
  });
}

export function askPreSubmitTutor(params: {
  attemptId: string;
  questionId: string;
  learnerQuestion: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<TutorReplyPayload> {
  return requestJson<TutorReplyPayload>('/api/ai/question-help', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function askPostSubmitTutor(params: {
  attemptId: string;
  questionId: string;
  learnerQuestion: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<TutorReplyPayload> {
  return requestJson<TutorReplyPayload>('/api/ai/question-explanation', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function fetchOverallFeedback(attemptId: string): Promise<{
  attemptId: string;
  level: CefrLevel;
  feedback: OverallFeedbackData;
  cached: boolean;
  model: string;
}> {
  return requestJson('/api/ai/overall-feedback', {
    method: 'POST',
    body: JSON.stringify({ attemptId }),
  });
}
