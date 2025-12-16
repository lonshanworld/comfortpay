export async function verifySession(token: string) {
  const key = process.env.SESSION_SIGNING_KEY;
  if (!key) throw new Error('SESSION_SIGNING_KEY not set');

  if (typeof globalThis.crypto?.subtle === 'undefined') {
    throw new Error('Web Crypto not available in this runtime');
  }

  function b64urlToBase64(s: string) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return s;
  }

  function base64ToUtf8(b64: string) {
    const bin = atob(b64);
    try {
      return decodeURIComponent(Array.prototype.map.call(bin, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    } catch (_) {
      return bin;
    }
  }

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const headerJson = base64ToUtf8(b64urlToBase64(parts[0]));
  const header = JSON.parse(headerJson);
  if (header.alg !== 'HS256') throw new Error('Unsupported alg');

  const signingInput = new TextEncoder().encode(parts[0] + '.' + parts[1]);
  const sigB64 = b64urlToBase64(parts[2]);
  const sigBin = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));

  const keyData = new TextEncoder().encode(key);
  const cryptoKey = await globalThis.crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const valid = await globalThis.crypto.subtle.verify('HMAC', cryptoKey, sigBin, signingInput);
  if (!valid) throw new Error('Invalid signature');

  const payloadJson = base64ToUtf8(b64urlToBase64(parts[1]));
  const payload = JSON.parse(payloadJson);
  if (payload.exp && typeof payload.exp === 'number') {
    const now = Math.floor(Date.now() / 1000);
    if (now >= payload.exp) throw new Error('Token expired');
  }
  return payload as any;
}

export default { verifySession };
