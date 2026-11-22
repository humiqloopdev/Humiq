import { ZodError } from 'zod';

/** Throw from services; the error handler turns it into an HTTP response. */
export class HttpError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
  }
}

export const parse = (schema, data) => schema.parse(data ?? {});

// Express 5 forwards rejected promises here automatically.
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ detail: 'Validation failed.', errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ detail: err.message });
  if (err.code === '22P02') return res.status(400).json({ detail: 'Invalid identifier.' }); // bad uuid
  if (err.code === '23505') return res.status(409).json({ detail: 'Already exists.' });
  if (err.name === 'MulterError') return res.status(400).json({ detail: err.message });
  console.error(err);
  res.status(500).json({ detail: 'Internal server error.' });
}
