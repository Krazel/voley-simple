import {mkdir,copyFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
await mkdir(new URL('ios/Web/',root),{recursive:true});
await copyFile(new URL('demo/voley-offline.html',root),new URL('ios/Web/voley-offline.html',root));
console.log('Bundled offline game prepared for iOS 0.20 (1)');
