// Render one complete section to a local 16-bit WAV. No recording permission or server is used.
function exportConnect(node,pet,mix,offline){
 node.connect(mix);
 if((pet.echo||0)>0){
  const delay=offline.createDelay(.6),feedback=offline.createGain(),wet=offline.createGain();
  delay.delayTime.value=.23;feedback.gain.value=.18;wet.gain.value=(pet.echo||0)/100*.35;
  node.connect(delay);delay.connect(wet).connect(mix);delay.connect(feedback).connect(delay);
 }
}
function exportVoice(p,when,offset,mix,offline){
 const strength=(p.strength??70)/100*.7+.3;
 let buffer,rate=2**(((p.pitch||0)+offset)/12),level,range,filter=null;
 if(p.source==='instrument'){
  const instrument=instruments.find(item=>item.id===(p.instrument||'piano'));
  buffer=instrumentBuffers.get(instrument?.id);
  if(!buffer)return;
  const frequency=(p.base||440)*2**(((p.pitch||0)+offset+instrument.shift)/12);
  rate=instrument.id==='drum'?2**((p.pitch||0)/24):Math.max(.25,Math.min(4,frequency/instrument.base));
  range={start:0,duration:Math.min(buffer.duration,1.2*rate)};
  level=Math.max(.001,(p.volume||0)/100*.55*strength);
  filter=offline.createBiquadFilter();filter.type='lowpass';filter.frequency.value=p.tone==='soft'?1300:p.tone==='robot'?2200:6500;
 }else{
  buffer=clipBufferFor(p);
  if(!buffer)return;
  if(p.tone==='meow')rate=Math.max(.5,Math.min(4,(p.base||440)*rate*2/520));
  range=clipRange(p,buffer);
  level=Math.max(.001,p.volume/100*(p.tone==='custom'?.24*(customLevels.get(p.id)||1):p.tone==='meow'?.4:p.tone==='sample'?(p.id==='cat'?.24:.36):.22)*strength);
  if(['sample','meow','custom'].includes(p.tone)){
   filter=offline.createBiquadFilter();filter.type='lowpass';
   filter.frequency.value=p.tone==='sample'&&p.id==='cat'?2500:p.tone==='custom'?2800:3200;
  }
 }
 const source=offline.createBufferSource(),gain=offline.createGain(),duration=range.duration/rate;
 source.buffer=buffer;source.playbackRate.setValueAtTime(rate,when);
 const attack=Math.min(.025,duration*.2),fade=Math.min(.055,duration*.4);
 gain.gain.setValueAtTime(0,when);
 gain.gain.linearRampToValueAtTime(level,when+attack);
 gain.gain.setValueAtTime(level,when+Math.max(attack,duration-fade));
 gain.gain.linearRampToValueAtTime(0,when+duration);
 if(filter)source.connect(filter).connect(gain);else source.connect(gain);
 exportConnect(gain,p,mix,offline);
 source.start(when,range.start,range.duration);source.stop(when+duration+.01);
}
function exportChord(step,when,mix,offline,bpm){
 if(!chordEnabled||step%4)return;
 const chord=chordPattern[Math.floor(step/4)],tones=chordDegrees[chord];
 if(!tones)return;
 const offset=musicKey==='Am'?0:keyOffsets[musicKey]||0;
 tones.forEach((semitones,index)=>{
  const osc=offline.createOscillator(),gain=offline.createGain(),duration=Math.min(.75,240/bpm*.7);
  osc.type='sine';osc.frequency.setValueAtTime(130.8128*2**((semitones+offset)/12),when);
  gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(index===0?.024:.013,when+.025);
  gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
  osc.connect(gain).connect(mix);osc.start(when);osc.stop(when+duration+.02);
 });
}
async function exportAiSong(mix,offline,sectionSeconds){
 if(!aiSongData)return;
 const bytes=await (await fetch(aiSongData)).arrayBuffer();
 const buffer=await offline.decodeAudioData(bytes);
 const start=Math.max(0,Math.min(aiSongRange.start||0,buffer.duration));
 const end=Math.max(start,Math.min(aiSongRange.end||buffer.duration,buffer.duration));
 const clipSeconds=end-start;
 if(clipSeconds<.05)return;
 for(let at=0;at<sectionSeconds;at+=clipSeconds){
  const duration=Math.min(clipSeconds,sectionSeconds-at),source=offline.createBufferSource(),gain=offline.createGain();
  source.buffer=buffer;gain.gain.setValueAtTime(aiSongVolume/100,at);
  gain.gain.setValueAtTime(aiSongVolume/100,at+Math.max(0,duration-.09));
  gain.gain.linearRampToValueAtTime(0,at+duration);
  source.connect(gain).connect(mix);source.start(at,start,duration);source.stop(at+duration+.01);
 }
}
async function renderExportAudio({loops=1}={}){
 loops=[1,2,4].includes(loops)?loops:1;
 if(!pets.some(p=>!p.muted&&effectiveSteps(p).length)||!pets.length){
  if(!chordEnabled&&!aiSongData)throw new Error('Add a sound before exporting');
 }
 context ||= new(window.AudioContext||window.webkitAudioContext)();
 await loadSamples();
 if(pets.some(p=>p.source==='instrument'))await loadInstrumentSamples();
 const bpm=Number($('#tempo').value)||92,seconds=stepCount()*loops*60/bpm,sampleRate=44100;
 const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
 if(!Offline)throw new Error('This browser cannot export WAV');
 const offline=new Offline(2,Math.ceil((seconds+8)*sampleRate),sampleRate);
 const mix=offline.createGain(),limiter=offline.createDynamicsCompressor(),master=offline.createGain();
 limiter.threshold.value=-18;limiter.knee.value=12;limiter.ratio.value=4;
 master.gain.value=Number($('#masterVolume').value)/100;
 mix.connect(limiter).connect(master).connect(offline.destination);
 for(let absoluteStep=0;absoluteStep<stepCount()*loops;absoluteStep++){
  const step=absoluteStep%stepCount(),cycle=Math.floor(absoluteStep/stepCount());
  const at=.04+absoluteStep*60/bpm;
  for(const p of pets){
   if(p.muted||!petPlaysInLoop(p,cycle)||!effectiveSteps(p).includes(step))continue;
   exportVoice(p,at,melodyOffset(p,step%clipPatternSteps(p)),mix,offline);
  }
  exportChord(step,at,mix,offline,bpm);
 }
 await exportAiSong(mix,offline,seconds);
 return offline.startRendering();
}
function wavBlob(buffer){
 const sampleRate=buffer.sampleRate,channels=2,left=buffer.getChannelData(0),right=buffer.getChannelData(1);
 let last=0;
 for(let i=left.length-1;i>=0;i--)if(Math.abs(left[i])>.0003||Math.abs(right[i])>.0003){last=i;break}
 const frames=Math.min(buffer.length,Math.max(Math.ceil(.2*sampleRate),last+Math.ceil(.14*sampleRate)));
 const bytes=new ArrayBuffer(44+frames*channels*2),view=new DataView(bytes);
 const write=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i))};
 write(0,'RIFF');view.setUint32(4,36+frames*4,true);write(8,'WAVE');write(12,'fmt ');
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);
 view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);
 write(36,'data');view.setUint32(40,frames*4,true);
 for(let i=0;i<frames;i++){
  view.setInt16(44+i*4,Math.max(-32768,Math.min(32767,Math.round(left[i]*32767))),true);
  view.setInt16(46+i*4,Math.max(-32768,Math.min(32767,Math.round(right[i]*32767))),true);
 }
 return new Blob([bytes],{type:'audio/wav'});
}
$('#exportAudio').addEventListener('click',async()=>{
 const button=$('#exportAudio'),status=$('#exportStatus');
 if(playing)await togglePlay();
 button.disabled=true;button.setAttribute('aria-busy','true');status.textContent='Rendering WAV on this device…';
 try{
  const buffer=await renderExportAudio(),blob=wavBlob(buffer);
  const saved=incomingSong&&WERStore.getSongs().find(song=>song.id===incomingSong);
  const title=saved?.name||(currentTemplate===-1?'Jingle Bells · Pet Band':'WER pet song');
  const filename=title.replace(/[\\/:*?"<>|]/g,'').trim().slice(0,60)||'WER pet song';
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`${filename}.wav`;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  status.textContent='WAV downloaded';
  notify('WAV ready · WAV');
 }catch(error){status.textContent=error.message||'Export failed'}
 finally{button.disabled=false;button.removeAttribute('aria-busy')}
});
