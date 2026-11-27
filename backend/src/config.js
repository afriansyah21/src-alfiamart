import 'dotenv/config';

export function validateAiServiceUrl(value) {
  if (!value) {
    throw new Error('Variabel lingkungan untuk "AI_SERVICE_URL" belum diisi (lihat .env.example)');
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('AI_SERVICE_URL harus berupa URL absolut yang valid (lihat .env.example)');
  }

  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new Error('AI_SERVICE_URL hanya menerima protokol http atau https');
  }

  return url.toString().replace(/\/+$/, '');
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === 'true',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  corsOrigin: (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),
  serviceApiKey: process.env.SERVICE_API_KEY,
  aiServiceUrl: validateAiServiceUrl(process.env.AI_SERVICE_URL),
  aiInternalKey: process.env.AI_INTERNAL_KEY,
  aiStubScenario: process.env.AI_STUB_SCENARIO || '',
};

const requiredConfig = [
  ['databaseUrl', 'DATABASE_URL'],
  ['jwtSecret', 'JWT_SECRET'],
  ['aiInternalKey', 'AI_INTERNAL_KEY'],
];

for (const [key, envName] of requiredConfig) {
  if (!config[key]) throw new Error(`Variabel lingkungan untuk "${envName}" belum diisi (lihat .env.example)`);
}
