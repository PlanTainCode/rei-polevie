import { AsyncLocalStorage } from 'node:async_hooks';

export const aiDiagnosticContext = new AsyncLocalStorage<{ generationId: string; projectId: string }>();

// Do not log prompts, document contents, API keys or raw provider responses.
export function diagnosticError(error: unknown) {
  const value = error as { name?: string; code?: string; cause?: { code?: string } } | null;
  return { errorName: value?.name || 'UnknownError', code: value?.code, causeCode: value?.cause?.code };
}

export function logAiDiagnostic(event: string, details: Record<string, unknown> = {}) {
  console.log('[AiDiagnostics]', JSON.stringify({
    at: new Date().toISOString(), ...aiDiagnosticContext.getStore(), event, ...details,
  }));
}
