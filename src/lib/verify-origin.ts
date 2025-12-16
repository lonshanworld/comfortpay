// src/lib/verify-origin.ts
import { URL } from "url";
import psl from 'psl';

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
export function extractRequestHost(req: Request): string | null {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const forwarded = req.headers.get("x-forwarded-host");
  const hostHeader = req.headers.get("host");

  const tryOrder = [origin, referer, forwarded, hostHeader];
  for (const candidate of tryOrder) {
    const h = normalizeHost(candidate);
    if (h) return h;
  }
  return null;
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
