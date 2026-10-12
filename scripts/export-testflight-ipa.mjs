import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { asc } from './asc-client.mjs';
const cfg = JSON.parse(fs.readFileSync('store/testflight.json', 'utf8'));
const upload = process.env.VOLEY_TESTFLIGHT_UPLOAD === 'true'; // Only the owner-dispatched upload workflow opts in.
const exportOnly = process.env.VOLEY_NATIVE_EXPORT === 'true';
if (process.platform !== 'darwin' || (!upload && !exportOnly) || !cfg.appId) throw Error('An explicit macOS export/upload run and App Store record are required');
const temp = process.env.RUNNER_TEMP;
if (!temp) throw Error('Runner temporary directory required');
function run(cmd, args, quiet = false) {
  const r = spawnSync(cmd, args, { encoding:'utf8', maxBuffer:40*1024*1024 });
  if (!quiet) process.stdout.write(r.stdout || '');
  if (r.status !== 0) throw Error(`${cmd} failed${quiet ? '' : ': ' + (r.stderr || r.stdout)}`);
  return r.stdout.trim();
}
function decode(name, file) {
  if (!process.env[name]) throw Error('Missing '+name);
  fs.writeFileSync(file, Buffer.from(process.env[name], 'base64'), {mode:0o600});
}
const keychain = path.join(temp,'voley-signing.keychain-db');
const p12 = path.join(temp,'voley-distribution.p12');
const profile = path.join(temp,'voley.mobileprovision');
const profilePlist = path.join(temp,'voley-profile.plist');
const password = crypto.randomBytes(24).toString('hex');
const keyDir = path.join(process.env.HOME,'.appstoreconnect/private_keys');
fs.mkdirSync(keyDir,{recursive:true});
const key = path.join(keyDir,`AuthKey_${process.env.ASC_KEY_ID}.p8`);
let installedProfile;
try {
  decode('ASC_PRIVATE_KEY_BASE64',key);
  process.env.ASC_PRIVATE_KEY_PATH = key;
  const app = (await asc('GET',`/v1/apps/${cfg.appId}`)).data;
  if (app.attributes.bundleId !== cfg.bundleId) throw Error('Wrong app record');
  const builds = await asc('GET',`/v1/builds?filter[app]=${cfg.appId}&filter[version]=${cfg.buildNumber}&include=preReleaseVersion&limit=200`);
  if (builds.data.some(b=>builds.included?.some(v=>v.id===b.relationships.preReleaseVersion.data.id && v.attributes.version===cfg.marketingVersion))) throw Error('Version/build already uploaded; refusing duplicate');
  decode('IOS_DISTRIBUTION_P12_BASE64',p12);
  decode('IOS_APP_STORE_PROFILE_BASE64',profile);
  run('security',['cms','-D','-i',profile,'-o',profilePlist]);
  const pp = JSON.parse(run('python3',['-c',"import plistlib,json,sys; p=plistlib.load(open(sys.argv[1],'rb')); print(json.dumps({k:p[k] for k in ['Name','UUID','Entitlements']}))",profilePlist],true));
  if (pp.Entitlements['application-identifier'] !== `${cfg.teamId}.${cfg.bundleId}` || pp.Entitlements['get-task-allow'] !== false || pp.Entitlements['beta-reports-active'] !== true) throw Error('Incorrect App Store provisioning profile');
  const ppDir = path.join(process.env.HOME,'Library/MobileDevice/Provisioning Profiles');
  fs.mkdirSync(ppDir,{recursive:true});
  installedProfile=path.join(ppDir,pp.UUID+'.mobileprovision');
  fs.copyFileSync(profile,installedProfile);
  run('security',['create-keychain','-p',password,keychain],true);
  run('security',['set-keychain-settings','-lut','21600',keychain]);
  run('security',['unlock-keychain','-p',password,keychain],true);
  run('security',['import',p12,'-k',keychain,'-P',process.env.IOS_DISTRIBUTION_P12_PASSWORD,'-T','/usr/bin/codesign','-T','/usr/bin/security'],true);
  run('security',['list-keychains','-d','user','-s',keychain]);
  run('security',['set-key-partition-list','-S','apple-tool:,apple:,codesign:','-s','-k',password,keychain],true);
  const archive = path.join(temp,'VoleySimple.xcarchive');
  run('xcodebuild',['archive','-project','ios/VoleySimple.xcodeproj','-scheme','VoleySimple','-configuration','Release','-destination','generic/platform=iOS','-archivePath',archive,'ARCHS=arm64','ONLY_ACTIVE_ARCH=NO','CODE_SIGN_STYLE=Manual',`DEVELOPMENT_TEAM=${cfg.teamId}`,'CODE_SIGN_IDENTITY=Apple Distribution',`PROVISIONING_PROFILE_SPECIFIER=${pp.Name}`,`MARKETING_VERSION=${cfg.marketingVersion}`,`CURRENT_PROJECT_VERSION=${cfg.buildNumber}`]);
  const appPath = path.join(archive,'Products/Applications/VoleySimple.app');
  run('codesign',['--verify','--deep','--strict',appPath]);
  const plist = JSON.parse(run('plutil',['-convert','json','-o','-',path.join(appPath,'Info.plist')]));
  if(plist.CFBundleIdentifier!==cfg.bundleId||plist.CFBundleShortVersionString!==cfg.marketingVersion||plist.CFBundleVersion!==String(cfg.buildNumber))throw Error('Candidate identity mismatch');
  for(const file of ['Web/voley-offline.html','Audio/jump.wav','Audio/attack.wav'])if(!fs.existsSync(path.join(appPath,file)))throw Error('Required offline/audio resource missing');
  const options = path.join(temp,'ExportOptions.plist');
  const json = path.join(temp,'export-options.json');
  fs.writeFileSync(json,JSON.stringify({method:'app-store-connect',destination:'export',teamID:cfg.teamId,signingStyle:'manual',signingCertificate:'Apple Distribution',provisioningProfiles:{[cfg.bundleId]:pp.Name},manageAppVersionAndBuildNumber:false,uploadSymbols:true,stripSwiftSymbols:true}));
  run('python3',['-c',"import plistlib,json,sys; plistlib.dump(json.load(open(sys.argv[1])),open(sys.argv[2],'wb'))",json,options]);
  const out = path.join(temp,'voley-export');
  run('xcodebuild',['-exportArchive','-archivePath',archive,'-exportOptionsPlist',options,'-exportPath',out]);
  const ipa = path.join(out,fs.readdirSync(out).find(n=>n.endsWith('.ipa')));
  fs.mkdirSync('artifacts/testflight',{recursive:true});
  const final = `artifacts/testflight/VoleySimple-${cfg.marketingVersion}-build${cfg.buildNumber}-${process.env.GITHUB_SHA.slice(0,7)}-${upload ? 'TestFlight' : 'NonCommercialCandidate'}.ipa`;
  fs.copyFileSync(ipa,final);
  const manifest = {...cfg,commit:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,ipa:path.basename(final),sha256:crypto.createHash('sha256').update(fs.readFileSync(final)).digest('hex'),signatureVerified:true};
  fs.writeFileSync('artifacts/testflight/manifest.json',JSON.stringify(manifest,null,2));
  run('xcrun',['altool','--validate-app','-f',final,'-t','ios','--apiKey',process.env.ASC_KEY_ID,'--apiIssuer',process.env.ASC_ISSUER_ID]);
  fs.writeFileSync('artifacts/testflight/export-only.json',JSON.stringify({...manifest,validated:true,uploadAccepted:false},null,2));
  if(upload){
    run('xcrun',['altool','--upload-app','-f',final,'-t','ios','--apiKey',process.env.ASC_KEY_ID,'--apiIssuer',process.env.ASC_ISSUER_ID]);
    fs.writeFileSync('artifacts/testflight/upload-accepted.json',JSON.stringify({...manifest,validated:true,uploadAccepted:true,processingVerified:false},null,2));
  }
} finally {
  spawnSync('security',['delete-keychain',keychain],{stdio:'ignore'});
  for (const file of [key,p12,profile,profilePlist,installedProfile]) if(file && fs.existsSync(file)) fs.unlinkSync(file);
}
