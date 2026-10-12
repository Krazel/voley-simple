import math, struct, wave, zlib, json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
rate=44100
sounds={"pass":[(400,160,.12,.075,0)],"attack":[(225,55,.15,.11,0),(760,190,.05,.025,0)],"jump":[(240,550,.16,.025,0)],"land":[(90,38,.09,.035,0)],"serve":[(650,400,.11,.035,0)],"point-blue":[(n,n,.2,.04,i*.095) for i,n in enumerate([523,659,784])],"point-orange":[(n,n,.2,.04,i*.095) for i,n in enumerate([392,330])],"finish":[(n,n,.35,.045,i*.12) for i,n in enumerate([523,659,784,1047])]}
for name,notes in sounds.items():
 samples=[0.] * int((max(d+t for a,b,d,v,t in notes)+.02)*rate)
 for a,b,d,v,start in notes:
  phase=0
  for i in range(int(d*rate)):
   t=i/rate;phase+=2*math.pi*a*(b/a)**(t/d)/rate
   envelope=min(1,t/.006)*(.0001/v)**(t/d)
   samples[int(start*rate)+i]+=math.sin(phase)*v*envelope
 with wave.open(str(root/'ios/Audio'/f'{name}.wav'),'wb') as out:
  out.setparams((1,2,rate,0,'NONE','not compressed'))
  out.writeframes(b''.join(struct.pack('<h',int(max(-1,min(1,v))*32767)) for v in samples))
# Code-drawn provisional volleyball icon; no external image or private asset.
size=1024;rows=[]
for y in range(size):
 row=bytearray([0])
 for x in range(size):
  dx=x-512;dy=y-512;r=math.hypot(dx,dy)
  color=(25+int(y/64),73+int(y/45),132+int(y/40))
  if r<330:
   shade=int(18*(dx+dy)/660);color=(245-shade,247-shade,239-shade)
   seam=abs(dx*.78+dy*.3-40*math.sin(dy/150))<6 or abs(dy*.75-dx*.28+65*math.sin(dx/140))<6
   if seam:color=(34,78,121)
  row.extend(max(0,min(255,v)) for v in color)
 rows.append(row)
def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b'')
folder=root/'ios/Assets.xcassets/AppIcon.appiconset'
(folder/'icon.png').write_bytes(png)
(folder/'Contents.json').write_text(json.dumps({'images':[{'filename':'icon.png','idiom':'universal','platform':'ios','size':'1024x1024'}],'info':{'author':'xcode','version':1}}))
print('Eight recorded native WAV effects and provisional icon generated')
