// Non-destructive clip boundaries and beat-aligned pattern repetitions.
function clipPatternSteps(p){return stepCount()/(p.clipRepeats||1)}
function effectiveSteps(p){
 const count=stepCount(),repeat=p.clipRepeats||1,period=count/repeat;
 if(repeat===1)return p.steps.filter(step=>step<count);
 const base=p.steps.filter(step=>step>=0&&step<period);
 return Array.from({length:repeat},(_,part)=>base.map(step=>step+part*period)).flat();
}
function toggleClipStep(p,step){
 const base=step%clipPatternSteps(p);
 p.steps=p.steps.includes(base)?p.steps.filter(value=>value!==base):[...p.steps,base].sort((a,b)=>a-b);
}
function setClipRepeats(p,repeats){
 const current=effectiveSteps(p),period=stepCount()/repeats;
 p.clipRepeats=repeats;p.steps=current.filter(step=>step<period);
 p.notes=Object.fromEntries(Object.entries(p.notes||{}).filter(([step])=>Number(step)<period));
}
const synthBuffers=new Map();
function synthBufferFor(p){
 const key=`${p.id}:${p.tone}:${p.base}:${p.wave}`;
 if(synthBuffers.has(key))return synthBuffers.get(key);
 const voices={
  samoyed:{wave:'triangle',from:1.5,to:.85,duration:.24,cutoff:2100},
  hamster:{wave:'sine',from:2.1,to:1.25,duration:.12,cutoff:3200},
  'sea-otter':{wave:'sine',from:.82,to:1.12,duration:.36,cutoff:1100}
 };
 const special=p.tone==='signature'?voices[p.asset]:null;
 const voice=special||{wave:p.tone==='soft'?'sine':p.tone==='bright'||p.tone==='robot'?'square':p.wave||'triangle',from:1,to:1,duration:p.id==='bird'?.13:.2,cutoff:p.tone==='soft'?900:p.tone==='bright'?3200:p.tone==='robot'?1100:p.id==='dog'?950:2500};
 const sampleRate=44100,length=Math.ceil((voice.duration+.015)*sampleRate);
 const offline=new(window.OfflineAudioContext||window.webkitOfflineAudioContext)(1,length,sampleRate);
 const buffer=offline.createBuffer(1,length,sampleRate),data=buffer.getChannelData(0);
 let phase=0,filtered=0;
 for(let i=0;i<length;i++){
  const seconds=i/sampleRate,progress=Math.min(1,seconds/voice.duration);
  const frequency=(p.base||440)*voice.from*(voice.to/voice.from)**progress;
  phase=(phase+frequency/sampleRate)%1;
  const wave=voice.wave==='square'?(phase<.5?1:-1):voice.wave==='triangle'?1-4*Math.abs(phase-.5):Math.sin(phase*2*Math.PI);
  const envelope=seconds>=voice.duration?0:Math.min(1,seconds/.018)*Math.exp(-5*progress);
  const alpha=Math.min(1,2*Math.PI*voice.cutoff/sampleRate);
  filtered+=alpha*(wave*envelope-filtered);data[i]=filtered;
 }
 synthBuffers.set(key,buffer);return buffer;
}
function clipBufferFor(p){
 if(p.source==='instrument')return null;
 if(p.tone==='custom')return customBuffers.get(p.id);
 if(p.tone==='sample')return sampleBuffers.get(p.id);
 if(p.tone==='meow')return singingBuffer;
 return synthBufferFor(p);
}
function quietBoundary(buffer,seconds){
 const data=buffer.getChannelData(0),center=Math.round(seconds*buffer.sampleRate),radius=Math.round(buffer.sampleRate*.025);
 let best=Math.min(data.length-1,Math.max(0,center)),level=Infinity;
 for(let i=Math.max(0,center-radius);i<Math.min(data.length,center+radius);i+=2){const value=Math.abs(data[i]);if(value<level){level=value;best=i}}
 return best/buffer.sampleRate;
}
function clipRange(p,buffer){
 const minimum=Math.min(.08,buffer.duration),rawStart=Math.max(0,Math.min((p.clipStart||0)*buffer.duration,buffer.duration-minimum));
 const rawEnd=Math.max(rawStart+minimum,Math.min((p.clipEnd??1)*buffer.duration,buffer.duration));
 let start=rawStart>0?quietBoundary(buffer,rawStart):0,end=rawEnd<buffer.duration?quietBoundary(buffer,rawEnd):buffer.duration;
 if(end-start<minimum){start=rawStart;end=rawEnd}
 return {start,end,duration:end-start};
}
function drawClipWave(canvas,buffer,start,end){
 if(!canvas||!buffer)return;
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,data=buffer.getChannelData(0),bars=120;
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#1b1434';ctx.fillRect(0,0,w,h);
 for(let bar=0;bar<bars;bar++){
  const from=Math.floor(bar*data.length/bars),to=Math.floor((bar+1)*data.length/bars),stride=Math.max(1,Math.floor((to-from)/28));let peak=0;
  for(let i=from;i<to;i+=stride)peak=Math.max(peak,Math.abs(data[i]));
  const height=Math.max(3,Math.round(Math.sqrt(peak)*h*.76));
  ctx.fillStyle=bar/bars>=start&&bar/bars<=end?'#88d5f3':'#856f9f';
  ctx.fillRect(bar*w/bars+1,(h-height)/2,Math.max(1,w/bars-2),height);
 }
}
function placeHandles(prefix,start,end){
 const shell=document.querySelector(`#${prefix}WaveShell`),selection=document.querySelector(`#${prefix}WaveSelection`);
 if(!shell||shell.hidden)return;
 selection.style.left=`${start*100}%`;selection.style.width=`${(end-start)*100}%`;
 document.querySelector(`#${prefix}StartHandle`).style.left=`${start*100}%`;
 document.querySelector(`#${prefix}EndHandle`).style.left=`${end*100}%`;
}
function renderClipUI(){
 const bpm=Number(document.querySelector('#tempo').value)||92;
 const p=pets.find(item=>item.id===selected),buffer=clipBufferFor(p),shell=document.querySelector('#clipWaveShell');
 document.querySelectorAll('[data-clip-repeat]').forEach(button=>{
  const repeat=Number(button.dataset.clipRepeat),active=repeat===(p.clipRepeats||1);
  const windowSeconds=stepCount()/repeat*60/bpm;
  const soundSeconds=buffer?clipRange(p,buffer).duration/2**(p.pitch/12):0;
  button.disabled=Boolean(buffer&&soundSeconds>windowSeconds-.05&&!active);
  button.title=button.disabled?'Sound is longer than this repeat window · 声音长于循环小段':'';
  button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
 });
 shell.hidden=!buffer;document.querySelector('#clipLoad').hidden=Boolean(buffer)||!['custom','sample','meow'].includes(p.tone);
 document.querySelector('#clipEditorHint').textContent=buffer?'Drag either handle to keep the part you want · 拖动两端保留想要的声音':p.source==='instrument'?'Instrument notes use their full natural length · 乐器音符保持自然时长':samplesReady?'Sound unavailable; try loading again · 声音未加载，请重试':'Loading sound… · 正在加载声音…';
 if(buffer){const start=p.clipStart||0,end=p.clipEnd??1;drawClipWave(document.querySelector('#clipWaveCanvas'),buffer,start,end);placeHandles('clip',start,end);document.querySelector('#clipTimeLabel').textContent=`${(start*buffer.duration).toFixed(2)}s – ${(end*buffer.duration).toFixed(2)}s`}
 else document.querySelector('#clipTimeLabel').textContent=p.source==='instrument'?'Full note · 自然时长':samplesReady?'Sound unavailable · 声音未加载':'Loading sound… · 正在加载声音…';
}
let clipDrag=null,suppressBeatClick=false,boundaryDrag=null,songWaveBuffer=null;
function moveBeat(p,from,to){
 const old=from%clipPatternSteps(p),next=to%clipPatternSteps(p);
 if(old===next)return;
 p.steps=p.steps.filter(step=>step!==old);
 if(!p.steps.includes(next))p.steps.push(next);
 p.steps.sort((a,b)=>a-b);
 selected=p.id;render();scheduleDraftSave();
}
document.querySelector('#petCards').addEventListener('pointerdown',event=>{
 const button=event.target.closest('.track-steps button.enabled');if(!button)return;
 clipDrag={button,id:button.dataset.track,from:Number(button.dataset.step),startX:event.clientX};
 button.setPointerCapture(event.pointerId);
});
document.querySelector('#petCards').addEventListener('pointermove',event=>{
 if(!clipDrag)return;
 const distance=event.clientX-clipDrag.startX;
 clipDrag.button.style.transform=Math.abs(distance)>7?`translateX(${distance}px) scale(1.08)`:'';
 clipDrag.button.classList.toggle('dragging',Math.abs(distance)>7);
});
document.querySelector('#petCards').addEventListener('pointerup',event=>{
 if(!clipDrag)return;
 const {button,id,from,startX}=clipDrag;clipDrag=null;button.style.transform='';button.classList.remove('dragging');
 if(Math.abs(event.clientX-startX)<8)return;
 suppressBeatClick=true;setTimeout(()=>{suppressBeatClick=false},0);
 const p=pets.find(item=>item.id===id),grid=button.parentElement,rect=grid.getBoundingClientRect();
 const cell=Math.max(0,Math.min(15,Math.floor((event.clientX-rect.left)/rect.width*16)));
 const to=Math.min(stepCount()-1,pageStart()+cell);
 if(p)moveBeat(p,from,to);
});
document.querySelector('#petCards').addEventListener('pointercancel',()=>{if(!clipDrag)return;clipDrag.button.style.transform='';clipDrag.button.classList.remove('dragging');clipDrag=null});
document.querySelector('#petCards').addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
 const button=event.target.closest('.track-steps button.enabled');if(!button)return;
 event.preventDefault();const p=pets.find(item=>item.id===button.dataset.track),from=Number(button.dataset.step);
 if(p)moveBeat(p,from,Math.max(0,Math.min(stepCount()-1,from+(event.key==='ArrowLeft'?-1:1))));
});
document.querySelector('.clip-repeat').addEventListener('click',event=>{
 const button=event.target.closest('[data-clip-repeat]');if(!button)return;setClipRepeats(pets.find(p=>p.id===selected),Number(button.dataset.clipRepeat));render();scheduleDraftSave();
});
document.querySelector('#clipLoad').addEventListener('click',async()=>{
 sampleLoad=null;singingLoad=null;samplesReady=false;renderClipUI();
 context ||= new(window.AudioContext||window.webkitAudioContext)();await context.resume();await loadSamples();render();
});
for(const [prefix,kind] of [['clip','pet'],['song','song']])for(const side of ['Start','End']){
 const handle=document.querySelector(`#${prefix}${side}Handle`);handle.addEventListener('pointerdown',event=>{boundaryDrag={prefix,side,id:selected};handle.setPointerCapture(event.pointerId);event.preventDefault()});
 handle.addEventListener('pointermove',event=>{
  if(!boundaryDrag||boundaryDrag.prefix!==prefix||boundaryDrag.side!==side)return;
  const shell=document.querySelector(`#${prefix}WaveShell`),rect=shell.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));
  if(kind==='pet'){
   const p=pets.find(item=>item.id===boundaryDrag.id),buffer=clipBufferFor(p);if(!buffer)return;const gap=Math.min(.12,.08/buffer.duration);
   if(side==='Start')p.clipStart=Math.min(fraction,(p.clipEnd??1)-gap);else p.clipEnd=Math.max(fraction,(p.clipStart||0)+gap);
   placeHandles('clip',p.clipStart||0,p.clipEnd??1);document.querySelector('#clipTimeLabel').textContent=`${((p.clipStart||0)*buffer.duration).toFixed(2)}s – ${((p.clipEnd??1)*buffer.duration).toFixed(2)}s`;
  }else if(songWaveBuffer){
   const duration=songWaveBuffer.duration,gap=Math.min(.5,duration*.02);
   if(side==='Start')aiSongRange.start=Math.min(fraction*duration,aiSongRange.end-gap);else aiSongRange.end=Math.max(fraction*duration,aiSongRange.start+gap);
   document.querySelector('#aiSongStart').value=String(aiSongRange.start);document.querySelector('#aiSongEnd').value=String(aiSongRange.end);updateAiSongRange();placeHandles('song',aiSongRange.start/duration,aiSongRange.end/duration);
  }
 });
 handle.addEventListener('pointerup',()=>{if(!boundaryDrag)return;const was=boundaryDrag.prefix;boundaryDrag=null;if(was==='clip')render();else renderSongWave();scheduleDraftSave()});
 handle.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const delta=(event.key==='ArrowLeft'?-1:1)*.02;if(kind==='pet'){const p=pets.find(item=>item.id===selected);if(side==='Start')p.clipStart=Math.max(0,Math.min((p.clipEnd??1)-.05,(p.clipStart||0)+delta));else p.clipEnd=Math.min(1,Math.max((p.clipStart||0)+.05,(p.clipEnd??1)+delta));render()}else if(songWaveBuffer){if(side==='Start')aiSongRange.start=Math.max(0,Math.min(aiSongRange.end-.2,aiSongRange.start+delta*songWaveBuffer.duration));else aiSongRange.end=Math.min(songWaveBuffer.duration,Math.max(aiSongRange.start+.2,aiSongRange.end+delta*songWaveBuffer.duration));document.querySelector('#aiSongStart').value=String(aiSongRange.start);document.querySelector('#aiSongEnd').value=String(aiSongRange.end);updateAiSongRange();renderSongWave()}scheduleDraftSave()});
}
async function prepareSongWave(blob){
 if(!aiSongData)return;
 try{context ||= new(window.AudioContext||window.webkitAudioContext)();const bytes=blob?await blob.arrayBuffer():await (await fetch(aiSongData)).arrayBuffer();songWaveBuffer=await context.decodeAudioData(bytes);renderSongWave()}catch{songWaveBuffer=null}
}
function renderSongWave(){
 if(!songWaveBuffer)return;document.querySelector('#songWaveShell').hidden=false;
 const duration=songWaveBuffer.duration;drawClipWave(document.querySelector('#songWaveCanvas'),songWaveBuffer,aiSongRange.start/duration,aiSongRange.end/duration);
 placeHandles('song',aiSongRange.start/duration,aiSongRange.end/duration);
}
