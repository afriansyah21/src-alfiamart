import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler, notFound } from './errors.js';
import authRouter from './routes/auth.js';
import productsRouter, { catalogRouter, priceHistoryRouter } from './routes/products.js';
import transactionsRouter from './routes/transactions.js';
import exportsRouter from './routes/exports.js';
import { createChatRouter } from './routes/chat.js';
import { askAiChat } from './services/aiClient.js';
import { createSummariesRouter } from './routes/summaries.js';
import { getAiSummaries } from './services/aiClient.js';
import { createSummaryCache } from './services/summaryCache.js';

export function createApp(options = {}) {
  const app = express();
  app.use(cors({ origin: config.corsOrigin.length ? config.corsOrigin : true }));
  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
  api.use('/auth', authRouter);
  api.use('/catalog', catalogRouter);
  api.use('/products', productsRouter);
  api.use('/price-history', priceHistoryRouter);
  api.use('/transactions', transactionsRouter);
  api.use('/export', exportsRouter);
  api.use('/chat', createChatRouter({ askAiChat: options.askAiChat || askAiChat }));
  api.use('/summaries', createSummariesRouter({
    getSummaries: options.getAiSummaries || getAiSummaries,
    cache: options.summaryCache || createSummaryCache(),
  }));
  app.use('/api/v1', api);

  app.use((_req, _res, next) => next(notFound('Endpoint tidak ditemukan')));
  app.use(errorHandler);
  return app;
}
