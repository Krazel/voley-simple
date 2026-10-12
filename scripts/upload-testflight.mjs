import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {asc} from './asc-client.mjs';

const expected='fe33f26bdad8d789d5ae9a0c39055ce7daca5cff29071972337459d33ff7bbc7';
const dir='candidate';
const files=await fs.readdir(dir);
const ipas=files.filter(f=>f.endsWith('.ipa'));
assert.equal(ipas.length,1);
const ipa=path.resolve(dir,ipas[0]);
assert.equal(crypto.createHash('sha256').update(await fs.readFile(ipa)).digest('hex'),expected);
const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
assert.equal(manifest.bundleId,'com.krazel.voleysimple');
assert.equal(manifest.marketingVersion,'0.17');
assert.equal(Number(manifest.buildNumber),1);
const keys=path.join(os.homedir(),'.appstoreconnect/private_keys');
await fs.mkdir(keys,{recursive:true});
const key=path.join(keys,`AuthKey_${process.env.ASC_KEY_ID}.p8`);
await fs.writeFile(key,Buffer.from(process.env.ASC_PRIVATE_KEY_BASE64,'base64'),{mode:0o600});
process.env.ASC_PRIVATE_KEY_PATH=key;
await fs.mkdir('upload-receipt',{recursive:true});
try {
  const app=(await asc('GET','/v1/apps/6822062720')).data;
  assert.equal(app.attributes.bundleId,manifest.bundleId);
  const result=await asc('GET','/v1/builds?filter[app]=6822062720&include=preReleaseVersion&limit=200');
  const duplicate=result.data.some(b=>b.attributes.version==='1' && result.included?.some(v=>v.id===b.relationships.preReleaseVersion.data.id && v.attributes.version==='0.17'));
  assert.equal(duplicate,false,'Build 0.17 (1) already exists; do not upload twice');
  execFileSync('xcrun',['altool','--upload-app','-f',ipa,'-t','ios','--apiKey',process.env.ASC_KEY_ID,'--apiIssuer',process.env.ASC_ISSUER_ID],{stdio:'inherit'});
  await fs.writeFile('upload-receipt/accepted.json',JSON.stringify({appId:'6822062720',version:'0.17',build:1,sha256:expected,sourceRun:'38298920493',uploadRun:process.env.GITHUB_RUN_ID,uploadAccepted:true,processingVerified:false,at:new Date().toISOString()},null,2));
} finally {
  await fs.rm(key,{force:true});
}
