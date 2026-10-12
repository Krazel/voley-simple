import crypto from 'node:crypto';
import fs from 'node:fs';

export async function asc(method, endpoint, data) {
  const keyId = process.env.ASC_KEY_ID;
  const issuer = process.env.ASC_ISSUER_ID;
  const keyPath = process.env.ASC_PRIVATE_KEY_PATH;
  if (!keyId || !issuer || !keyPath) throw new Error('App Store Connect credentials are required');
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const message = `${encode({alg:'ES256',kid:keyId,typ:'JWT'})}.${encode({iss:issuer,aud:'appstoreconnect-v1',iat:now,exp:now+600})}`;
  const signature = crypto.sign('sha256', Buffer.from(message), {key:fs.readFileSync(keyPath),dsaEncoding:'ieee-p1363'}).toString('base64url');
  const response = await fetch(`https://api.appstoreconnect.apple.com${endpoint}`, {
    method, headers: {Authorization:`Bearer ${message}.${signature}`,'Content-Type':'application/json'},
    body: data ? JSON.stringify(data) : undefined,
  });
  const raw = await response.text();
  const json = raw ? JSON.parse(raw) : {};
  if (!response.ok) throw new Error(`${method} ${endpoint}: ${response.status} ${JSON.stringify(json.errors)}`);
  return json;
}
