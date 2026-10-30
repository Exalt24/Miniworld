import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { FirebaseTokenVerifier, JwkKeyStore, TokenError } from '../../src/saas/firebase.js';
import { claimsFor, StandInKeyServer, TEST_PROJECT_ID } from './support/keyserver.js';

const NOW = 1_800_000_000;

let server: StandInKeyServer;
let verifier: FirebaseTokenVerifier;

async function reasonOf(token: string, v: FirebaseTokenVerifier = verifier): Promise<string> {
  try {
    await v.verify(token);
  } catch (err) {
    assert.ok(err instanceof TokenError, `expected a TokenError, got ${String(err)}`);
    return err.reason;
  }
  return 'accepted';
}

describe('Firebase ID token verification against the stand-in key server', () => {
  before(async () => {
    server = await StandInKeyServer.start();
    verifier = new FirebaseTokenVerifier({
      projectId: TEST_PROJECT_ID,
      keys: new JwkKeyStore(server.url, { minRefetchMs: 0 }),
      now: () => NOW,
    });
  });
  after(() => server.close());

  it('accepts a well-formed token and returns its claims', async () => {
    const claims = await verifier.verify(server.sign(claimsFor('user-1', {}, NOW)));
    assert.equal(claims.sub, 'user-1');
    assert.equal(claims.email, 'user-1@example.test');
  });

  it('refuses an expired token and accepts one a second before expiry', async () => {
    assert.equal(await reasonOf(server.sign(claimsFor('u', { exp: NOW }, NOW))), 'expired');
    assert.equal(await reasonOf(server.sign(claimsFor('u', { exp: NOW + 1 }, NOW))), 'accepted');
  });

  it('refuses a token for another audience', async () => {
    assert.equal(await reasonOf(server.sign(claimsFor('u', { aud: 'some-other-project' }, NOW))), 'bad_audience');
  });

  it('refuses a token from another issuer', async () => {
    const forged = claimsFor('u', { iss: 'https://securetoken.google.com/some-other-project' }, NOW);
    assert.equal(await reasonOf(server.sign(forged)), 'bad_issuer');
    assert.equal(await reasonOf(server.sign(claimsFor('u', { iss: 'https://accounts.example.test' }, NOW))), 'bad_issuer');
  });

  it('refuses a token issued in the future, beyond the allowed drift', async () => {
    assert.equal(await reasonOf(server.sign(claimsFor('u', { iat: NOW + 600 }, NOW))), 'bad_iat');
    assert.equal(await reasonOf(server.sign(claimsFor('u', { auth_time: NOW + 600 }, NOW))), 'bad_auth_time');
    assert.equal(await reasonOf(server.sign(claimsFor('u', { iat: NOW + 3 }, NOW))), 'accepted');
  });

  it('refuses a token with no usable subject', async () => {
    assert.equal(await reasonOf(server.sign(claimsFor('u', { sub: '' }, NOW))), 'bad_subject');
    assert.equal(await reasonOf(server.sign(claimsFor('u', { sub: 42 }, NOW))), 'bad_subject');
    assert.equal(await reasonOf(server.sign(claimsFor('u', { sub: 'x'.repeat(129) }, NOW))), 'bad_subject');
  });

  it('refuses a token whose payload was changed after signing', async () => {
    const [header, , signature] = server.sign(claimsFor('victim', {}, NOW)).split('.');
    const swapped = Buffer.from(JSON.stringify(claimsFor('attacker', {}, NOW))).toString('base64url');
    assert.equal(await reasonOf(`${header}.${swapped}.${signature}`), 'bad_signature');
  });

  it('refuses a token signed by a key the server does not publish, even with a published kid', async () => {
    assert.equal(await reasonOf(server.sign(claimsFor('u', {}, NOW), { foreignKey: true, kid: server.currentKid })), 'bad_signature');
  });

  it('refuses an unknown kid, a missing kid and any algorithm other than RS256', async () => {
    assert.equal(await reasonOf(server.sign(claimsFor('u', {}, NOW), { kid: 'nobody' })), 'unknown_kid');
    assert.equal(await reasonOf(server.sign(claimsFor('u', {}, NOW), { alg: 'HS256' })), 'bad_alg');
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify(claimsFor('u', {}, NOW))).toString('base64url')}.`;
    assert.equal(await reasonOf(none), 'bad_alg');
    const noKid = `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.e30.AAAA`;
    assert.equal(await reasonOf(noKid), 'no_kid');
  });

  it('refuses malformed input', async () => {
    assert.equal(await reasonOf('not-a-token'), 'malformed');
    assert.equal(await reasonOf('a.b.c'), 'malformed');
    assert.equal(await reasonOf(''), 'malformed');
  });

  it('caches the key set for the max-age and refetches when a new kid appears after rotation', async () => {
    const local = await StandInKeyServer.start();
    try {
      let clock = 1_000_000;
      const v = new FirebaseTokenVerifier({
        projectId: TEST_PROJECT_ID,
        keys: new JwkKeyStore(local.url, { minRefetchMs: 0, nowMs: () => clock }),
        now: () => NOW,
      });
      assert.equal(await reasonOf(local.sign(claimsFor('u', {}, NOW)), v), 'accepted');
      assert.equal(await reasonOf(local.sign(claimsFor('u', {}, NOW)), v), 'accepted');
      assert.equal(local.requests, 1, 'the second check used the cached key set');

      local.rotate();
      assert.equal(await reasonOf(local.sign(claimsFor('u', {}, NOW)), v), 'accepted');
      assert.equal(local.requests, 2, 'an unknown kid triggered one refetch');

      clock += 3601 * 1000;
      assert.equal(await reasonOf(local.sign(claimsFor('u', {}, NOW)), v), 'accepted');
      assert.equal(local.requests, 3, 'an expired cache refetched');
    } finally {
      await local.close();
    }
  });

  it('does not let a stream of unknown kids hammer the key server', async () => {
    const local = await StandInKeyServer.start();
    try {
      const v = new FirebaseTokenVerifier({
        projectId: TEST_PROJECT_ID,
        keys: new JwkKeyStore(local.url, { minRefetchMs: 60_000 }),
        now: () => NOW,
      });
      for (let i = 0; i < 5; i += 1) await reasonOf(local.sign(claimsFor('u', {}, NOW), { kid: `bad-${i}` }), v);
      assert.ok(local.requests <= 2, `expected at most 2 key fetches, saw ${local.requests}`);
    } finally {
      await local.close();
    }
  });
});
