import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://localhost/test';
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.AI_SERVICE_URL ||= 'http://localhost:8000';
process.env.AI_INTERNAL_KEY ||= 'test-internal-key';
process.env.AI_STUB_SCENARIO ||= '';

const { createAiClient } = await import('../src/services/aiClient.js');

const silentLogger = { info() {}, error() {} };

test('chat sukses mengirim header dan menormalisasi respons', async () => {
  let captured;
  const ai = createAiClient({
    baseUrl: 'http://ai.test',
    internalKey: 'secret-key',
    stubScenario: 'fallback',
    logger: silentLogger,
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({
        success: true,
        data: {
          intent: 'cek_penjualan',
          confidence: 0.9,
          reply: 'Kemarin terjual 142 item.',
          action: null,
          sources: [],
          fallback: true,
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  const result = await ai.askAiChat({
    message: 'Berapa penjualan kemarin?',
    session_id: '3f6c2a10-8b1e-4c7a-9e52-0d4f1a7b9c11',
    channel: 'web',
    history: [],
  });

  assert.equal(captured.url, 'http://ai.test/v1/chat');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers['X-Internal-Key'], 'secret-key');
  assert.equal(captured.options.headers['X-Stub-Scenario'], 'fallback');
  assert.equal(result.status, 'ok');
  assert.equal(result.fallback, true);
  assert.equal(result.data.reply, 'Kemarin terjual 142 item.');
});

test('stub scenario tidak dikirim bila kosong', async () => {
  let headers;
  const ai = createAiClient({
    fetchImpl: async (_url, options) => {
      headers = options.headers;
      return new Response(JSON.stringify({ success: true, data: { fallback: false } }), { status: 200 });
    },
    stubScenario: '',
    logger: silentLogger,
  });

  await ai.askAiChat({ session_id: 'session-1', message: 'Halo', channel: 'web', history: [] });
  assert.equal(headers['X-Stub-Scenario'], undefined);
  assert.equal(headers['Content-Type'], 'application/json');
});

test('ringkasan sukses meneruskan query', async () => {
  let capturedUrl;
  const ai = createAiClient({
    baseUrl: 'http://ai.test',
    fetchImpl: async (url) => {
      capturedUrl = url;
      return new Response(JSON.stringify({
        success: true,
        data: {
          type: 'sales',
          period: { name: 'kemarin' },
          facts: { revenue: 3100000 },
          text: 'Ringkasan tersedia',
          fallback: false,
          generated_at: '2026-11-26T12:00:00+07:00',
        },
      }), { status: 200 });
    },
    logger: silentLogger,
  });

  const result = await ai.getAiSummaries({ type: 'sales', period: 'kemarin' });
  assert.equal(capturedUrl, 'http://ai.test/v1/summaries?type=sales&period=kemarin');
  assert.equal(result.status, 'ok');
  assert.equal(result.data.facts.revenue, 3100000);
});

test('ringkasan no_data mempertahankan facts null', async () => {
  const ai = createAiClient({
    fetchImpl: async () => new Response(JSON.stringify({
      success: true,
      data: { type: 'sales', period: {}, facts: null, text: 'Data belum tersedia', fallback: true, generated_at: null },
    }), { status: 200 }),
    logger: silentLogger,
  });

  const result = await ai.getAiSummaries({ type: 'sales', period: 'kemarin' });
  assert.equal(result.fallback, true);
  assert.equal(result.data.facts, null);
});

test('chat timeout menghasilkan lambat dan tidak retry', async () => {
  let calls = 0;
  const ai = createAiClient({
    timeoutMs: 5,
    fetchImpl: async () => {
      calls++;
      throw new DOMException('Aborted', 'AbortError');
    },
    logger: silentLogger,
  });

  const result = await ai.askAiChat({ session_id: 'session-1', message: 'Halo', channel: 'web', history: [] });
  assert.equal(result.status, 'lambat');
  assert.equal(result.fallback, true);
  assert.equal(calls, 1);
});

test('network failure menghasilkan bersiap', async () => {
  const ai = createAiClient({
    fetchImpl: async () => {
      throw new Error('connection refused');
    },
    logger: silentLogger,
  });

  const result = await ai.askAiChat({ session_id: 'session-1', message: 'Halo', channel: 'web', history: [] });
  assert.equal(result.status, 'bersiap');
});

test('503 menghasilkan bersiap dan tidak retry', async () => {
  let calls = 0;
  const ai = createAiClient({
    fetchImpl: async () => {
      calls++;
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'MODEL_UNAVAILABLE', message: 'Belum siap' },
      }), { status: 503 });
    },
    logger: silentLogger,
  });

  const result = await ai.askAiChat({ session_id: 'session-1', message: 'Halo', channel: 'web', history: [] });
  assert.equal(result.status, 'bersiap');
  assert.equal(calls, 1);
});

test('500 menghasilkan gangguan', async () => {
  const ai = createAiClient({
    fetchImpl: async () => new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Kesalahan layanan' },
    }), { status: 500 }),
    logger: silentLogger,
  });

  const result = await ai.getAiSummaries({ type: 'sales', period: 'kemarin' });
  assert.equal(result.status, 'gangguan');
  assert.equal(result.data.facts, null);
});

test('JSON invalid menghasilkan gangguan', async () => {
  const ai = createAiClient({
    fetchImpl: async () => new Response('not-json', { status: 200 }),
    logger: silentLogger,
  });

  const result = await ai.askAiChat({ session_id: 'session-1', message: 'Halo', channel: 'web', history: [] });
  assert.equal(result.status, 'gangguan');
  assert.equal(result.fallback, true);
});

test('chat fallback FastAPI mempertahankan reply dan fallback true', async () => {
  const ai = createAiClient({
    fetchImpl: async () => new Response(JSON.stringify({
      success: true,
      data: {
        intent: 'cek_penjualan',
        confidence: 0.9,
        reply: 'Jawaban otomatis terbatas.',
        action: null,
        sources: [],
        fallback: true,
      },
    }), { status: 200 }),
    logger: silentLogger,
  });

  const result = await ai.askAiChat({ session_id: 'session-1', message: 'Omzet kemarin?', channel: 'web', history: [] });
  assert.equal(result.data.reply, 'Jawaban otomatis terbatas.');
  assert.equal(result.data.fallback, true);
  assert.equal(result.fallback, true);
});
