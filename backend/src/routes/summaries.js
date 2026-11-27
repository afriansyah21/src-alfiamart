import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { summaryQuerySchema } from '../schemas.js';
import { getAiSummaries } from '../services/aiClient.js';
import { createSummaryCache } from '../services/summaryCache.js';

export function createSummariesRouter({
  getSummaries = getAiSummaries,
  cache = createSummaryCache(),
} = {}) {
  const router = Router();
  router.use(requireAuth, requireRole('owner'));

  router.get('/', validate(summaryQuerySchema, 'query'), async (req, res, next) => {
    try {
      const { type, period } = req.valid.query;
      const cached = cache.get(type, period);
      if (cached) {
        return res.json({
          success: true,
          data: cached,
          meta: { cached: true },
        });
      }

      const result = await getSummaries({ type, period });
      const data = result?.data || {
        type,
        period: null,
        facts: null,
        text: 'Ringkasan belum tersedia.',
        fallback: true,
        generated_at: null,
      };

      const canCache = result?.status === 'ok'
        && result?.fallback !== true
        && data.fallback !== true
        && data.facts !== null
        && data.facts !== undefined;

      if (canCache) cache.set(type, period, data);

      return res.json({
        success: true,
        data,
        meta: { cached: false },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createSummariesRouter();
