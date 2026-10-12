// Browser sound effects, unlocked only by a user gesture. No network or audio files.
export class GameAudio {
 constructor(){this.native=globalThis.window?.webkit?.messageHandlers?.voleyAudio??null;this.context=null;this.enabled=true;this.voices=[];try{this.enabled=localStorage.getItem('voley-sound')!=='off'}catch{}}
 unlock(){
  if(!this.enabled||this.native)return;
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;if(!this.context)this.context=new Audio();this.context.resume().catch(()=>{})}catch{}
 }
 toggle(){this.enabled=!this.enabled;try{localStorage.setItem('voley-sound',this.enabled?'on':'off')}catch{};if(this.enabled)this.unlock();else this.stop();return this.enabled}
 stop(){this.native?.postMessage({kind:'stop'});for(const voice of this.voices){try{voice.stop()}catch{}}this.voices=[]}
 tone(frequency,duration,volume,type='sine',delay=0,end=frequency){
  const c=this.context;if(!this.enabled||!c||c.state!=='running'||this.voices.length>=12)return;
  const oscillator=c.createOscillator(),gain=c.createGain(),t=c.currentTime+delay;
  oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,t);oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  oscillator.connect(gain);gain.connect(c.destination);oscillator.start(t);oscillator.stop(t+duration+.015);this.voices.push(oscillator);
  oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices=this.voices.filter(v=>v!==oscillator)};
 }
 play(kind,team=0,power=.5){
  if(this.native){if(this.enabled&&!(kind==='finish'&&team!==0))this.native.postMessage({kind:kind==='point'?(team===0?'point-blue':'point-orange'):kind,power});return;}
  if(kind==='pass')this.tone(400,.12,.075,'sine',0,160);
  if(kind==='attack'){this.tone(180+power*90,.15,.11,'triangle',0,55);this.tone(760,.05,.025,'sine',0,190)}
  if(kind==='jump')this.tone(240,.16,.025,'sine',0,550);
  if(kind==='land')this.tone(90,.09,.035,'sine',0,38);
  if(kind==='serve')this.tone(650,.11,.035,'sine',0,400);
  if(kind==='point'){const notes=team===0?[523,659,784]:[392,330];notes.forEach((n,i)=>this.tone(n,.2,.04,'sine',i*.095))}
  if(kind==='finish'&&team===0)[523,659,784,1047].forEach((n,i)=>this.tone(n,.35,.045,'sine',i*.12));
 }
}
