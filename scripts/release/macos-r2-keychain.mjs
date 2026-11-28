import { execFileSync } from 'node:child_process';

/** Decode security(1)'s hex rendering without logging or changing the Keychain item. */
export function decodeR2SecretOutput(output) {
  if (typeof output !== 'string' || output.length > 1024) throw new Error('R2_KEYCHAIN_FORMAT_INVALID');
  const raw = output.trim();
  if (/^[a-fA-F0-9]{64}$/.test(raw)) return raw;
  if (/^(?:[a-fA-F0-9]{2})+$/.test(raw)) {
    const bytes = Buffer.from(raw, 'hex');
    const decoded = bytes.toString('utf8');
    if (Buffer.from(decoded, 'utf8').equals(bytes) && /^[a-fA-F0-9]{64}$/.test(decoded.trim())) return decoded.trim();
  }
  throw new Error('R2_KEYCHAIN_FORMAT_INVALID');
}

export function readR2KeychainCredentials({ service, keychain, execute = execFileSync }) {
  if (!/^digital-observer-r2-[a-z0-9-]{1,100}$/.test(service) || typeof keychain !== 'string' || !keychain.startsWith('/'))
    throw new Error('R2_KEYCHAIN_LOCATION_INVALID');
  const options = { encoding: 'utf8', timeout: 45_000, maxBuffer: 16_384, stdio: ['ignore', 'pipe', 'pipe'] };
  try {
    const base = ['find-generic-password', '-s', service];
    const metadata = execute('/usr/bin/security', [...base, keychain], options);
    const account = metadata.match(/"acct"<blob>=(?:0x[0-9A-Fa-f]+\s+)?"([\s\S]*?)"/)?.[1];
    const accessKeyId = account?.replace(/\\012|\\n/g, '\n').trim();
    if (!/^[a-f0-9]{32}$/.test(accessKeyId || '')) throw new Error('R2_KEYCHAIN_FORMAT_INVALID');
    const secretAccessKey = decodeR2SecretOutput(execute('/usr/bin/security', [...base, '-w', keychain], options));
    return { accessKeyId, secretAccessKey };
  } catch {
    // exec errors can contain captured password output; never propagate them.
    throw new Error('R2_KEYCHAIN_READ_FAILED');
  }
}
