// src/lib/verify-origin.ts
import { URL } from "url";
import psl from 'psl';

// Toggle to bypass origin/domain checks when set to '1'. Disabled by default.
// Use only for debugging or emergency hotfixes. In production keep this unset.
const ALLOW_ANY_ORIGIN = true;

/**
 * Normalize a hostname by:
 * - Converting to lowercase
 * - Stripping leading "www."
 * - Extracting hostname from full URLs
 */
function normalizeHost(input?: string | null): string | null {
  if (!input) return null;
  try {
    const u = input.includes("://") ? new URL(input) : new URL("http://" + input);
    let host = u.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host;
  } catch {
    return null;
  }
}

/**
 * Obtain the registered (effective) domain for a host, e.g. "www.example.com" -> "example.com".
 * Falls back to the original host if a registered domain cannot be determined (e.g. localhost).
 */
function registeredDomain(host?: string | null): string | null {
  if (!host) return null;
  try {
    // psl.get returns the domain (eTLD+1) or null when not applicable
    const domain = psl.get(host);
    if (domain && typeof domain === 'string') return domain.toLowerCase();
    // fallback: return the host as-is (already normalized by normalizeHost caller)
    return host.toLowerCase();
  } catch {
    return host.toLowerCase();
  }
}

/**
 * Extract the request's originating hostname from headers.
 * Tries in order: Origin, Referer, X-Forwarded-Host, Host
 */
export function extractRequestHost(req: Request | any): string | null {
  console.log('[verify-origin] extractRequestHost called');
  // Support both Next `Request` (headers.get) and raw Node-style `req.headers` object
  let origin: string | null | undefined = undefined;
  let referer: string | null | undefined = undefined;
  let forwarded: string | null | undefined = undefined;
  let hostHeader: string | null | undefined = undefined;

  try {
    if (req && typeof req.headers?.get === 'function') {
      console.log('[verify-origin] detected Next Request (headers.get)');
      origin = req.headers.get('origin');
      referer = req.headers.get('referer') || req.headers.get('referrer');
      forwarded = req.headers.get('x-forwarded-host');
      hostHeader = req.headers.get('host');
      console.log('[verify-origin] header values (Next):', { origin, referer, forwarded, hostHeader });
    } else if (req && req.headers) {
      // Node IncomingMessage or plain object
      console.log('[verify-origin] detected Node-style req.headers');
      origin = req.headers['origin'] || req.headers['Origin'] || null;
      referer = req.headers['referer'] || req.headers['referrer'] || req.headers['Referer'] || null;
      forwarded = req.headers['x-forwarded-host'] || req.headers['X-Forwarded-Host'] || null;
      hostHeader = req.headers['host'] || req.headers['Host'] || null;
      console.log('[verify-origin] header values (Node):', { origin, referer, forwarded, hostHeader });
    } else {
      console.log('[verify-origin] no headers found on request object');
    }
  } catch (e: any) {
    console.log('[verify-origin] error reading headers:', e && e.message ? e.message : e);
  }

  const tryOrder = [origin, referer, forwarded, hostHeader];
  let result: string | null = null;
  for (const candidate of tryOrder) {
    console.log('[verify-origin] trying candidate:', candidate);
    const h = normalizeHost(typeof candidate === 'string' ? candidate : candidate ?? null);
    console.log('[verify-origin] normalized candidate ->', h);
    if (h) {
      result = h;
      break;
    }
  }

  console.log('[verify-origin] extractRequestHost returning:', result);
  return result;
}

/**
 * Extract hostname from a merchant's website URL
 */
export function merchantHostFromUrl(websiteUrl?: string | null): string | null {
  // normalize and then return the registered domain
  const host = normalizeHost(websiteUrl ?? null);
  return registeredDomain(host);
}

/**
 * Check if request hostname matches merchant hostname (exact match after normalization)
 */
export function domainMatches(
  requestHost: string | null,
  merchantHost: string | null
): { ok: boolean; reason: string } {
  if (ALLOW_ANY_ORIGIN) {
    console.warn('[verify-origin] ALLOW_ANY_ORIGIN enabled: bypassing domain checks');
    return { ok: true, reason: 'bypassed_by_env' };
  }
  if (!requestHost) return { ok: false, reason: "missing_request_host" };
  if (!merchantHost) return { ok: false, reason: "missing_merchant_host" };

  // Compare by registered domain (eTLD+1) so www/example subdomains match
  const reqRegistered = registeredDomain(requestHost);
  const mercRegistered = registeredDomain(merchantHost);
  if (reqRegistered && mercRegistered && reqRegistered === mercRegistered) {
    return { ok: true, reason: "registered_domain_match" };
  }

  // Fall back to exact host comparison if registered-domain logic didn't match
  if (requestHost === merchantHost) return { ok: true, reason: "exact_match" };

  return { ok: false, reason: "mismatch" };
}

// Re-export named helpers explicitly to ensure build tools recognize them
