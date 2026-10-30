import { createServer, type Server } from 'node:http';
import { createSign, generateKeyPairSync, type KeyObject } from 'node:crypto';
import type { AddressInfo } from 'node:net';

export const TEST_PROJECT_ID = 'miniworld-test-project';

interface TestKey {
  kid: string;
  privateKey: KeyObject;
  publicJwk: Record<string, unknown>;
}

function makeKey(kid: string): TestKey {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { kid, privateKey, publicJwk: { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' } };
}

const b64 = (value: object | Buffer) =>
  (Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))).toString('base64url');

/**
 * A stand-in for Google's securetoken key endpoint. It serves a JWK set made of keys it
 * generated itself, and it signs test tokens with them. It never talks to Firebase.
 */
export class StandInKeyServer {
  private server!: Server;
  private keys: TestKey[] = [];
  private rotations = 0;
  url = '';
  requests = 0;
  maxAgeSeconds = 3600;

  static async start(): Promise<StandInKeyServer> {
    const instance = new StandInKeyServer();
    instance.keys = [makeKey('test-key-1')];
    instance.server = createServer((req, res) => {
      if (req.url !== '/jwk') {
        res.writeHead(404).end();
        return;
      }
      instance.requests += 1;
      res.writeHead(200, {
        'content-type': 'application/json',
        'cache-control': `public, max-age=${instance.maxAgeSeconds}`,
      });
      res.end(JSON.stringify({ keys: instance.keys.map((k) => k.publicJwk) }));
    });
    await new Promise<void>((resolve) => instance.server.listen(0, '127.0.0.1', resolve));
    instance.url = `http://127.0.0.1:${(instance.server.address() as AddressInfo).port}/jwk`;
    return instance;
  }

  get currentKid(): string {
    return this.keys[this.keys.length - 1].kid;
  }

  /** Replaces the published key set with a fresh key, like Google's periodic key rotation. */
  rotate(): string {
    this.rotations += 1;
    this.keys = [makeKey(`test-key-${this.rotations + 1}`)];
    return this.currentKid;
  }

  /** Signs claims with the published key (or a key the server does not publish). */
  sign(claims: Record<string, unknown>, opts: { kid?: string; alg?: string; foreignKey?: boolean } = {}): string {
    const key = opts.foreignKey ? makeKey('unused') : this.keys[this.keys.length - 1];
    const header = { alg: opts.alg ?? 'RS256', kid: opts.kid ?? key.kid, typ: 'JWT' };
    const signingInput = `${b64(header)}.${b64(claims)}`;
    const signature = createSign('RSA-SHA256').update(signingInput).sign(key.privateKey);
    return `${signingInput}.${b64(signature)}`;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}

export function claimsFor(
  uid: string,
  overrides: Record<string, unknown> = {},
  nowSeconds = Math.floor(Date.now() / 1000),
): Record<string, unknown> {
  return {
    iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
    aud: TEST_PROJECT_ID,
    auth_time: nowSeconds - 60,
    iat: nowSeconds - 60,
    exp: nowSeconds + 3600,
    sub: uid,
    user_id: uid,
    email: `${uid}@example.test`,
    ...overrides,
  };
}
