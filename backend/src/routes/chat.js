import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { chatSchema, chatSessionParamSchema } from '../schemas.js';
import { notFound } from '../errors.js';
import { askAiChat } from '../services/aiClient.js';

async function getOwnedSession(sessionId, ownerId) {
  const { rows } = await query(
    'SELECT id, owner_id FROM chat_sessions WHERE id = $1 AND owner_id = $2',
    [sessionId, ownerId]
  );
  return rows[0] || null;
}

async function createOwnedSession(sessionId, ownerId) {
  await withTransaction(async (client) => {
    await client.query(
      'INSERT INTO chat_sessions (id, owner_id) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
      [sessionId, ownerId]
    );
  });
  return getOwnedSession(sessionId, ownerId);
}

export function createChatRouter({ askAiChat: askAi = askAiChat } = {}) {
  const router = Router();
  router.use(requireAuth, requireRole('owner'));

  router.post('/', validate(chatSchema), async (req, res, next) => {
    try {
      const { message, session_id, channel } = req.valid.body;
      let session = await getOwnedSession(session_id, req.user.id);
      if (!session) {
        session = await createOwnedSession(session_id, req.user.id);
        if (!session) throw notFound('Session chat tidak ditemukan');
      }

      const historyResult = await query(
        `SELECT role, content
         FROM (
           SELECT role, content, created_at, id
           FROM chat_messages
           WHERE session_id = $1
           ORDER BY created_at DESC, id DESC
           LIMIT 6
         ) latest
         ORDER BY created_at ASC, id ASC`,
        [session_id]
      );
      const history = historyResult.rows.map(({ role, content }) => ({ role, content }));

      await query(
        `INSERT INTO chat_messages
         (session_id, role, content, intent, confidence, action, sources, fallback)
         VALUES ($1, 'user', $2, NULL, NULL, NULL, '[]'::jsonb, FALSE)`,
        [session_id, message]
      );

      const aiResult = await askAi({
        message,
        session_id,
        channel,
        history,
      });

      const aiData = aiResult?.data || {};
      const reply = typeof aiData.reply === 'string' && aiData.reply.trim()
        ? aiData.reply
        : 'Layanan AI sedang mengalami gangguan. Anda dapat melanjutkan penggunaan aplikasi.';
      const intent = typeof aiData.intent === 'string' ? aiData.intent : 'di_luar_konteks';
      const confidence = Number.isFinite(aiData.confidence) ? aiData.confidence : 0;
      const action = aiData.action ?? null;
      const sources = Array.isArray(aiData.sources) ? aiData.sources : [];
      const fallback = aiResult?.fallback === true || aiData.fallback === true;

      await query(
        `INSERT INTO chat_messages
         (session_id, role, content, intent, confidence, action, sources, fallback)
         VALUES ($1, 'assistant', $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
        [session_id, reply, intent, confidence,
         action ? JSON.stringify(action) : null,
         JSON.stringify(sources),
         fallback]
      );
      await query('UPDATE chat_sessions SET updated_at = now() WHERE id = $1', [session_id]);

      res.json({
        success: true,
        data: {
          session_id,
          intent,
          confidence,
          reply,
          action,
          sources,
          fallback,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/sessions/:session_id',
    validate(chatSessionParamSchema, 'params'),
    async (req, res, next) => {
      try {
        const sessionId = req.valid.params.session_id;
        const session = await getOwnedSession(sessionId, req.user.id);
        if (!session) throw notFound('Session chat tidak ditemukan');

        const { rows } = await query(
          `SELECT id, role, content, intent, confidence, action, sources, fallback, created_at
           FROM chat_messages
           WHERE session_id = $1
           ORDER BY created_at ASC, id ASC`,
          [sessionId]
        );

        res.json({
          success: true,
          data: {
            session_id: sessionId,
            messages: rows.map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
              intent: message.intent,
              confidence: message.confidence,
              action: message.action,
              sources: message.sources,
              fallback: message.fallback,
              created_at: message.created_at,
            })),
          },
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export default createChatRouter();
