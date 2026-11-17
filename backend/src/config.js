import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === 'true',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  corsOrigin: (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),
  serviceApiKey: process.env.SERVICE_API_KEY,
};

for (const key of ['databaseUrl', 'jwtSecret']) {
  if (!config[key]) throw new Error(`Variabel lingkungan untuk "${key}" belum diisi (lihat .env.example)`);
}
