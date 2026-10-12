const preferenceKey='voley-preferences-v1';
export function readPreferences(storage){
 let value;try{value=JSON.parse(storage?.getItem(preferenceKey)||'null')}catch{}
 return {
  handedness:value?.handedness==='left'?'left':'right',
  map:['rooftop','mobile'].includes(value?.map)?value.map:'pavilion',
  mode:value?.mode==='2v2'?'2v2':'1v1',
  zoom:Object.fromEntries(['rooftop','pavilion','mobile'].map(id=>{
   const n=value?.zoom?.[id];return [id,typeof n==='number'&&Number.isFinite(n)?Math.round(Math.max(.8,Math.min(1.2,n))*10)/10:1];
  }))
 };
}
export function writePreferences(storage,value){
 try{storage?.setItem(preferenceKey,JSON.stringify(value));return !!storage}catch{return false}
}
