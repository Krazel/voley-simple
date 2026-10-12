import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const args=Object.fromEntries(process.argv.slice(2).map(s=>{const [k,...v]=s.split('=');return [k.replace(/^--/,''),v.join('=')||true]}));
let source=args.ref?execFileSync('git',['show',`${args.ref}:demo/engine.js`],{encoding:'utf8'}):null;
if(source?.includes("from './trajectory.js'")){
 const maps=source.includes("from './maps.js'")?execFileSync('git',['show',`${args.ref}:demo/maps.js`],{encoding:'utf8'}):'';
 const projection=execFileSync('git',['show',`${args.ref}:demo/projection.js`],{encoding:'utf8'});
 const trajectory=execFileSync('git',['show',`${args.ref}:demo/trajectory.js`],{encoding:'utf8'}).replace(/^import .*?;\r?\n/gm,'');
 source=maps+'\n'+projection+'\n'+trajectory+'\n'+source.replace(/^import .*?;\r?\n/gm,'');
}
const {Match,seededRandom}=await import(source?'data:text/javascript;base64,'+Buffer.from(source).toString('base64'): '../demo/engine.js');
const count=Number(args.seeds||12),dt=1/Number(args.hz||120),results=[];
for(const profile of ['balanced','playable'])for(let seed=1;seed<=count;seed++){
 const row={profile,seed,score:null,finished:false,seconds:0,contacts:[0,0,0,0],attackTouches:{1:0,2:0,3:0},passes:0,attacks:0,serves:0,aerial:0,repeated:0,targets:[],points:[],invalid:0};
 const last=[null,null];let pointStart=0;let m;
 m=new Match({random:seededRandom(seed),autoplay:profile==='balanced',onEvent:e=>{
  if(e.type==='pass')row.passes++;
  if(e.type==='attack'||e.type==='serve'){
   const b=m.ball,t=(b.vz+Math.sqrt(b.vz*b.vz+19.6*b.z))/9.8;
   const target={x:b.x+b.vx*t,y:b.y+b.vy*t};
   if(last[e.team]&&Math.hypot(target.x-last[e.team].x,target.y-last[e.team].y)<.8)row.repeated++;
   last[e.team]=target;row.targets.push({team:e.team,x:+target.x.toFixed(2),y:+target.y.toFixed(2)});
   if(e.type==='attack'){row.attacks++;row.attackTouches[e.touch]++;if(m.players[e.player].z>.2)row.aerial++}else row.serves++;
  }
  if(e.type==='point'){row.points.push({team:e.team,reason:e.reason,contacts:m.rally,seconds:+(m.time-pointStart).toFixed(2)});pointStart=m.time}
 }});
 m.start();m.players[0].human=false;m.servingTeam=seed%2;
 if(profile==='balanced')m.players.forEach(p=>{p.speed=4.2;p.homeX=p.id%2?5.7:2.3;p.homeY=p.team===0?12:4;p.x=p.homeX;p.y=p.homeY});
 for(let i=0;i<900/dt&&m.phase!=='finished';i++){
  m.update(dt);
  if(i%120===0&&[m.ball,...m.players].some(p=>!Number.isFinite(p.x+p.y+p.z))){row.invalid++;break}
 }
 row.finished=m.phase==='finished';row.seconds=+m.time.toFixed(2);row.score=m.score;row.contacts=m.stats.contacts;
 row.distinctTargets=new Set(row.targets.map(p=>`${Math.round(p.x)}:${Math.round(p.y)}`)).size;
 results.push(row);
}
const summary={};
for(const profile of ['balanced','playable']){
 const rows=results.filter(r=>r.profile===profile),points=rows.flatMap(r=>r.points),touches={1:0,2:0,3:0};
 for(const r of rows)for(const k of [1,2,3])touches[k]+=r.attackTouches[k];
 summary[profile]={matches:rows.length,finished:rows.filter(r=>r.finished).length,wins:[0,1].map(t=>rows.filter(r=>r.score[t]>=7).length),points:points.length,
  averageRallyContacts:+(points.reduce((s,p)=>s+p.contacts,0)/points.length).toFixed(2),maxRallyContacts:Math.max(...points.map(p=>p.contacts)),
  faults:Object.fromEntries(['Red','Fuera','Cuatro toques'].map(reason=>[reason,points.filter(p=>p.reason===reason).length])),
  attackTouches:touches,passes:rows.reduce((s,r)=>s+r.passes,0),aerial:rows.reduce((s,r)=>s+r.aerial,0),
  repeatedRate:+(rows.reduce((s,r)=>s+r.repeated,0)/rows.reduce((s,r)=>s+r.attacks+r.serves,0)).toFixed(3),
  contacts:[0,1,2,3].map(i=>rows.reduce((s,r)=>s+r.contacts[i],0)),invalid:rows.reduce((s,r)=>s+r.invalid,0)};
}
const report={label:args.label||'working',source:args.ref||'working tree',hz:1/dt,createdAt:new Date().toISOString(),summary,matches:results};
const folder=new URL('../evidence/simulation-2026-10-10/',import.meta.url);await mkdir(folder,{recursive:true});
await writeFile(new URL(`${report.label}.json`,folder),JSON.stringify(report,null,2));console.log(JSON.stringify({label:report.label,...summary},null,2));
