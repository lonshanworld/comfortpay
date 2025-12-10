import path from 'path';

/**
 * Return the base upload directory resolved depending on environment.
 * - In development: treat `UPLOADS_DIR` as relative to the project root
 *   (strip any leading slashes) and default to `public/uploads`.
 * - In production: prefer an absolute `UPLOADS_DIR` if provided,
 *   otherwise fall back to `public/uploads` inside the project.
 */
export function getBaseUploadDir(): string {
  const env = process.env.UPLOADS_DIR;

  if (process.env.NODE_ENV === 'production') {
    if (env) {
      return path.isAbsolute(env) ? env : path.join(process.cwd(), env);
    }
    return path.join(process.cwd(), 'public', 'uploads');
  }

  // development: prefer project-relative `public/uploads` and
  // guard against an env value starting with a leading slash.
  const val = env || 'public/uploads';
  const cleaned = val.replace(/^\/+/, '');
  return path.join(process.cwd(), cleaned);
}
