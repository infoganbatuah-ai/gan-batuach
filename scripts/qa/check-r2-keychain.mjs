import assert from 'node:assert/strict';
import { decodeR2SecretOutput, readR2KeychainCredentials } from '../release/macos-r2-keychain.mjs';

const secret = 'a'.repeat(64); // Synthetic fixture, never a provider credential.
assert.equal(decodeR2SecretOutput(`${secret}\n`), secret);
assert.equal(decodeR2SecretOutput(Buffer.from(`${secret}\n`).toString('hex')), secret);
assert.equal(decodeR2SecretOutput(Buffer.from(`${secret}\r\n`).toString('hex')), secret);
for (const invalid of ['', 'not-an-s3-secret', 'a'.repeat(63), 'z'.repeat(64), 'ab'.repeat(900),
  Buffer.from(`${secret}\0`).toString('hex'), Buffer.from(`${secret}extra`).toString('hex')])
  assert.throws(() => decodeR2SecretOutput(invalid), /R2_KEYCHAIN_FORMAT_INVALID/);
const config = { service: 'digital-observer-r2-test', keychain: '/test/login.keychain-db' };
const calls = [];
const credentials = readR2KeychainCredentials({ ...config, execute: (binary, args, options) => {
  calls.push({ binary, args });
  assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
  return args.includes('-w') ? Buffer.from(`${secret}\n`).toString('hex') : `"acct"<blob>="${'b'.repeat(32)}"`;
} });
assert.equal(credentials.secretAccessKey, secret);
assert.equal(credentials.accessKeyId, 'b'.repeat(32));
assert.equal(calls.length, 2);
assert.throws(() => readR2KeychainCredentials({ ...config, execute: () => { throw new Error(`private ${secret}`); } }),
  error => error.message === 'R2_KEYCHAIN_READ_FAILED' && !error.message.includes(secret));
assert.throws(() => readR2KeychainCredentials({ ...config, service: 'unrelated', execute: () => assert.fail() }), /LOCATION_INVALID/);
console.log(JSON.stringify({ result: 'PASS', cases: 13, scope: 'KEYCHAIN_DECODING_SYNTHETIC_ONLY' }));
