import { config } from '../config.js';

const FALLBACK_MESSAGES = {
  lambat: 'Jawaban membutuhkan waktu lebih lama dari biasanya. Coba kirim ulang pesan Anda.',
  bersiap: 'Layanan AI belum siap. Silakan coba lagi beberapa saat.',
  gangguan: 'Layanan AI sedang mengalami gangguan. Anda dapat melanjutkan penggunaan aplikasi.',
};

const safeSessionId = (body) => {
  if (typeof body?.session_id !== 'string') return undefined;
  return body.session_id;
};

function buildHeaders(internalKey, stubScenario) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Internal-Key': internalKey,
  };
  if (stubScenario) headers['X-Stub-Scenario'] = stubScenario;
  return headers;
}

function logResult(logger, operation, details) {
  logger?.info?.({
    operation,
    ...details,
  });
}

export function createAiClient({
  fetchImpl = globalThis.fetch,
  timeoutMs = 15_000,
  baseUrl = config.aiServiceUrl,
  internalKey = config.aiInternalKey,
  stubScenario = config.aiStubScenario,
  logger = console,
} = {}) {
  const request = async (operation, path, { method = 'GET', body, sessionId } = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: buildHeaders(internalKey, stubScenario),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      let payload;
      const text = await response.text();
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        logResult(logger, operation, {
          sessionId,
          httpStatus: response.status,
          errorCode: 'INVALID_JSON',
        });
        return createSystemFallback(operation, 'gangguan');
      }

      if (response.status === 503) {
        logResult(logger, operation, {
          sessionId,
          httpStatus: 503,
          errorCode: payload?.error?.code || 'MODEL_UNAVAILABLE',
        });
        return createSystemFallback(operation, 'bersiap');
      }

      if (response.status >= 500) {
        logResult(logger, operation, {
          sessionId,
          httpStatus: response.status,
          errorCode: payload?.error?.code || 'INTERNAL_ERROR',
        });
        return createSystemFallback(operation, 'gangguan');
      }

      if (!response.ok) {
        logResult(logger, operation, {
          sessionId,
          httpStatus: response.status,
          errorCode: payload?.error?.code || 'HTTP_ERROR',
        });
        return createSystemFallback(operation, 'gangguan');
      }

      if (!payload || payload.success !== true || !payload.data) {
        logResult(logger, operation, {
          sessionId,
          httpStatus: response.status,
          errorCode: 'INVALID_RESPONSE',
        });
        return createSystemFallback(operation, 'gangguan');
      }

      logResult(logger, operation, {
        sessionId,
        httpStatus: response.status,
        fallback: payload.data.fallback === true,
      });
      return {
        status: 'ok',
        data: payload.data,
        fallback: payload.data.fallback === true,
        error: null,
      };
    } catch (error) {
      if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') {
        logResult(logger, operation, {
          sessionId,
          httpStatus: null,
          errorCode: 'TIMEOUT',
        });
        return createSystemFallback(operation, 'lambat');
      }

      logResult(logger, operation, {
        sessionId,
        httpStatus: null,
        errorCode: 'NETWORK_ERROR',
      });
      return createSystemFallback(operation, 'bersiap');
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async askAiChat(body) {
      return request('chat', '/v1/chat', {
        method: 'POST',
        body,
        sessionId: safeSessionId(body),
      });
    },

    async getAiSummaries(query = {}) {
      const params = new URLSearchParams();
      if (query.type) params.set('type', query.type);
      if (query.period) params.set('period', query.period);
      const suffix = params.toString();
      return request('summaries', `/v1/summaries${suffix ? `?${suffix}` : ''}`);
    },
  };
}

function createSystemFallback(operation, status) {
  const reply = FALLBACK_MESSAGES[status];
  if (operation === 'chat') {
    return {
      status,
      data: {
        intent: 'di_luar_konteks',
        confidence: 0,
        reply,
        action: null,
        sources: [],
        fallback: true,
      },
      fallback: true,
      error: { code: status === 'lambat' ? 'AI_TIMEOUT' : status === 'bersiap' ? 'AI_UNAVAILABLE' : 'AI_ERROR' },
    };
  }

  return {
    status,
    data: {
      type: null,
      period: null,
      facts: null,
      text: reply,
      fallback: true,
      generated_at: null,
    },
    fallback: true,
    error: { code: status === 'lambat' ? 'AI_TIMEOUT' : status === 'bersiap' ? 'AI_UNAVAILABLE' : 'AI_ERROR' },
  };
}

const defaultAiClient = createAiClient();

export const askAiChat = (body) => defaultAiClient.askAiChat(body);
export const getAiSummaries = (query) => defaultAiClient.getAiSummaries(query);
