import { badRequest } from '../errors.js';

// validate(schema, 'body' | 'query' | 'params') -> hasil tervalidasi ditaruh di req.valid[source]
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const { value, error } = schema.validate(req[source], { abortEarly: false, stripUnknown: true, convert: true });
  if (error) {
    return next(badRequest('Data yang dikirim tidak valid', error.details.map((d) => ({ field: d.path.join('.'), message: d.message }))));
  }
  req.valid = { ...(req.valid || {}), [source]: value };
  next();
};
