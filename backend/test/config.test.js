import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const loadConfig = (environment = {}) => {
  const env = {
    ...process.env,
    DATABASE_URL: 'postgres://localhost/test',
    JWT_SECRET: 'test-jwt-secret',
    SERVICE_API_KEY: 'test-service-key',
    AI_SERVICE_URL: 'http://localhost:8000',
    AI_INTERNAL_KEY: 'test-internal-key',
    AI_STUB_SCENARIO: '',
    ...environment,
  };

  return spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', `
      const { config } = await import('./src/config.js');
      process.stdout.write(JSON.stringify({
        aiServiceUrl: config.aiServiceUrl,
        aiStubScenario: config.aiStubScenario,
        hasInternalKey: Boolean(config.aiInternalKey)
      }));
    `],
    { cwd: backendDir, env, encoding: 'utf8' }
  );
};

test('konfigurasi AI valid dimuat dan base URL dinormalisasi', () => {
  const result = loadConfig({
    AI_SERVICE_URL: 'https://ai.example.com/',
  });

  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);
  assert.equal(config.aiServiceUrl, 'https://ai.example.com');
  assert.equal(config.aiStubScenario, '');
  assert.equal(config.hasInternalKey, true);
});

test('AI_SERVICE_URL wajib dan URL tidak valid ditolak jelas', () => {
  const missing = loadConfig({ AI_SERVICE_URL: '' });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /AI_SERVICE_URL/);

  for (const invalidUrl of ['localhost:8000', 'ftp://localhost:8000', 'http://']) {
    const result = loadConfig({ AI_SERVICE_URL: invalidUrl });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stderr, /test-internal-key/);
  }
});

test('AI_INTERNAL_KEY wajib dan tidak terlihat pada pesan error', () => {
  const result = loadConfig({ AI_INTERNAL_KEY: '' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /AI_INTERNAL_KEY/);
});

test('AI_STUB_SCENARIO bersifat optional', () => {
  const result = loadConfig({ AI_STUB_SCENARIO: 'fallback' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).aiStubScenario, 'fallback');
});

test('secret tidak muncul pada konfigurasi yang diserialisasi untuk tes', () => {
  const secret = 'must-never-appear-in-output';
  const result = loadConfig({
    AI_INTERNAL_KEY: secret,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, new RegExp(secret));
});
