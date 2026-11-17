// Format respons error seragam untuk seluruh API:
// { success:false, error:{ code, message, details? } }
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export const badRequest = (message, details) => new ApiError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Perlu login') => new ApiError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Tidak memiliki izin untuk aksi ini') => new ApiError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Data tidak ditemukan') => new ApiError(404, 'NOT_FOUND', message);
export const conflict = (message, code = 'CONFLICT') => new ApiError(409, code, message);

export function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_JSON', message: 'Format JSON tidak valid' } });
  }
  console.error(err);
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server' } });
}
