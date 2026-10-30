import { createPublicKey, createVerify, type KeyObject } from 'node:crypto';

/**
 * Firebase Auth ID token verification, written from the Firebase Admin docs ("Verify ID
 * tokens using a third-party JWT library"). The rules there are:
 *   - the header alg is RS256 and kid names one of Google's current public keys
 *   - exp is in the future, iat and auth_time are in the past
 *   - aud is the Firebase project id
 *   - iss is https://securetoken.google.com/<project id>
 *   - sub is a non-empty string (the user's uid)
 *   - the signature verifies against the key for that kid
 * Keys come from the JWK endpoint Google publishes for securetoken@system.gserviceaccount.com.
 */

export class TokenError extends Error {
  constructor(
    public readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = 'TokenError';
  }
}

export interface FirebaseClaims {
  sub: string;
  email?: string;
  platform_admin?: boolean;
  [claim: string]: unknown;
}

export interface VerifierOptions {
  projectId: string;
  keys: KeyProvider;
  /** Seconds since the epoch. Injectable so expiry tests do not depend on the wall clock. */
  now?: () => number;
  /** Tolerated clock drift in seconds for iat and auth_time. */
  clockSkewSeconds?: number;
}

export interface KeyProvider {
  getKey(kid: string): Promise<KeyObject | null>;
}

interface Jwk {
  kid?: string;
  kty?: string;
  n?: string;
  e?: string;
  [field: string]: unknown;
}

/**
 * Fetches and caches the JWK set. The cache lives as long as the response's Cache-Control
 * max-age says. An unknown kid triggers one refetch (Google rotates keys), throttled so a
 * flood of bad tokens cannot turn into a flood of requests to the key server.
 */
export class JwkKeyStore implements KeyProvider {
  private keys = new Map<string, KeyObject>();
  private expiresAt = 0;
  private lastFetchAt = 0;
  private inflight: Promise<void> | null = null;

  constructor(
    private readonly url: string,
    private readonly opts: { minRefetchMs?: number; fetchImpl?: typeof fetch; nowMs?: () => number } = {},
  ) {}

  private nowMs(): number {
    return (this.opts.nowMs ?? Date.now)();
  }

  private async refresh(): Promise<void> {
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      const res = await (this.opts.fetchImpl ?? fetch)(this.url);
      if (!res.ok) throw new TokenError('key_fetch_failed', `key server answered ${res.status}`);
      const body = (await res.json()) as { keys?: Jwk[] };
      const next = new Map<string, KeyObject>();
      for (const jwk of body.keys ?? []) {
        if (jwk.kty !== 'RSA' || typeof jwk.kid !== 'string') continue;
        next.set(jwk.kid, createPublicKey({ key: jwk as never, format: 'jwk' }));
      }
      const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1];
      this.keys = next;
      this.lastFetchAt = this.nowMs();
      this.expiresAt = this.lastFetchAt + (maxAge ? parseInt(maxAge, 10) : 3600) * 1000;
    })().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  async getKey(kid: string): Promise<KeyObject | null> {
    if (this.nowMs() >= this.expiresAt) await this.refresh();
    const known = this.keys.get(kid);
    if (known) return known;
    if (this.nowMs() - this.lastFetchAt >= (this.opts.minRefetchMs ?? 10_000)) {
      await this.refresh();
      return this.keys.get(kid) ?? null;
    }
    return null;
  }
}

function decodeSegment(segment: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed as Record<string, unknown>;
  } catch {
    throw new TokenError('malformed', 'token segment is not valid base64url JSON');
  }
}

export class FirebaseTokenVerifier {
  private readonly now: () => number;
  private readonly skew: number;

  constructor(private readonly opts: VerifierOptions) {
    this.now = opts.now ?? (() => Math.floor(Date.now() / 1000));
    this.skew = opts.clockSkewSeconds ?? 5;
  }

  async verify(token: string): Promise<FirebaseClaims> {
    const parts = token.split('.');
    if (parts.length !== 3) throw new TokenError('malformed', 'token must have three segments');
    const [headerPart, payloadPart, signaturePart] = parts;
    const header = decodeSegment(headerPart);

    if (header.alg !== 'RS256') throw new TokenError('bad_alg', 'token must be signed with RS256');
    if (typeof header.kid !== 'string' || header.kid === '') throw new TokenError('no_kid', 'token header has no kid');

    const key = await this.opts.keys.getKey(header.kid);
    if (!key) throw new TokenError('unknown_kid', 'no signing key matches the token kid');

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${headerPart}.${payloadPart}`);
    const signatureOk = verifier.verify(key, Buffer.from(signaturePart, 'base64url'));
    if (!signatureOk) throw new TokenError('bad_signature', 'token signature does not verify');

    const claims = decodeSegment(payloadPart) as FirebaseClaims;
    const now = this.now();

    if (typeof claims.exp !== 'number' || claims.exp <= now) throw new TokenError('expired', 'token has expired');
    if (typeof claims.iat !== 'number' || claims.iat > now + this.skew) throw new TokenError('bad_iat', 'token was issued in the future');
    if (typeof claims.auth_time !== 'number' || claims.auth_time > now + this.skew) throw new TokenError('bad_auth_time', 'auth_time is in the future');
    if (claims.aud !== this.opts.projectId) throw new TokenError('bad_audience', 'token audience is not this project');
    if (claims.iss !== `https://securetoken.google.com/${this.opts.projectId}`) throw new TokenError('bad_issuer', 'token issuer is not this project');
    if (typeof claims.sub !== 'string' || claims.sub === '' || claims.sub.length > 128) throw new TokenError('bad_subject', 'token has no valid subject');

    return claims;
  }
}
