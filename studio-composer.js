// Each phrase has 16 visible cells; longer songs use a second editable phrase.
let composerMode='rhythm', meter='4/4', musicKey='C', songLength=1, phrasePage=0;
let backingStyle='bright', chordEnabled=false, chordPattern=['C','Am','F','G'];
let audioAnalyser=null, masterGain=null, waveFrame=0;
const keyOffsets={C:0,G:7,F:5,Am:9};
const majorScale=[0,-1,-3,-5,-7,-8,-10,-12,-13],minorScale=[0,-2,-4,-5,-7,-9,-10,-12,-14];
const noteNames={C:['C5','B4','A4','G4','F4','E4','D4','C4','B3'],G:['G5','F#5','E5','D5','C5','B4','A4','G4','F#4'],F:['F5','E5','D5','C5','Bb4','A4','G4','F4','E4'],Am:['A5','G5','F5','E5','D5','C5','B4','A4','G4']};
const chordDegrees={C:[0,4,7],G:[7,11,14],Am:[9,12,16],F:[5,9,12]};
const chordChoices=['C','G','Am','F','—'];
const chordLabels={C:{C:'C',G:'G',Am:'Am',F:'F'},G:{C:'G',G:'D',Am:'Em',F:'C'},F:{C:'F',G:'C',Am:'Dm',F:'Bb'},Am:{C:'Am',G:'Em',Am:'F',F:'Dm'}};
function phraseSteps(){return meter==='3/4'?12:16}
function stepCount(){return phraseSteps()*songLength}
function pageStart(){return phrasePage*phraseSteps()}
function noteOffset(row,p){
 const base=(p.tone==='custom'&&p.source!=='instrument'?p.remixPitch:null)||p.base||440;
 const petMidi=69+12*Math.log2(base/440);
 return 72+(keyOffsets[musicKey]||0)+(musicKey==='Am'?minorScale:majorScale)[row]-petMidi;
}
function melodyOffset(p,step){const row=p.notes?.[step];return Number.isInteger(row)?noteOffset(row,p):0}
function ensureAnalyser(){
 if(audioAnalyser||!context)return;
 audioAnalyser=context.createAnalyser();
 audioAnalyser.fftSize=256;
 audioAnalyser.smoothingTimeConstant=.72;
 const limiter=context.createDynamicsCompressor();
 limiter.threshold.value=-18;
 limiter.knee.value=12;
 limiter.ratio.value=4;
 limiter.attack.value=.003;
 limiter.release.value=.2;
 masterGain=context.createGain();
 masterGain.gain.value=Number(document.querySelector('#masterVolume').value)/100;
 audioAnalyser.connect(limiter).connect(masterGain).connect(context.destination);
}
function drawWave(){
 const canvas=document.querySelector('#waveform');
 if(!canvas)return;
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);
 const values=new Uint8Array(128);
 if(playing&&audioAnalyser)audioAnalyser.getByteFrequencyData(values);
 const count=48,gap=3,bar=3,offset=(w-count*(bar+gap))/2;
 const peak=playing?Math.max(...values.slice(1,25))/255:0;
 const level=Math.min(1,Math.sqrt(peak*1.8));
 for(let i=0;i<count;i++){
  const profile=(.35+.65*Math.abs(Math.sin(i*.47)))*(1-.4*Math.abs(i-(count-1)/2)/(count/2));
  const energy=level*profile;
  const height=Math.max(2,Math.round(energy*35));
  ctx.fillStyle=energy>.22?'#ffb3e5':'#c478d4';
  ctx.fillRect(Math.round(offset+i*(bar+gap)),Math.round((h-height)/2),bar,height);
  if(energy>.25){ctx.fillStyle='#ffe0ad';ctx.fillRect(Math.round(offset+i*(bar+gap)),Math.round((h-height)/2),bar,2)}
 }
 if(playing)waveFrame=requestAnimationFrame(drawWave);
}
function startWave(){ensureAnalyser();cancelAnimationFrame(waveFrame);drawWave()}
function stopWave(){cancelAnimationFrame(waveFrame);waveFrame=0;drawWave()}
function renderComposer(){
 const rhythm=document.querySelector('.band-section'),melody=document.querySelector('#melodyPanel');
 rhythm.hidden=composerMode!=='rhythm';melody.hidden=composerMode!=='melody';
 document.querySelectorAll('[data-compose-mode]').forEach(button=>{
  const active=button.dataset.composeMode===composerMode;
  button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));
 });
 document.querySelector('#meter').value=meter;
 document.querySelector('#meowBacking').checked=chordEnabled;
 document.querySelector('#musicKey').value=musicKey;
 document.querySelector('#songLength').value=String(songLength);
 document.querySelector('#lengthHint').textContent=`${stepCount()/ (meter==='3/4'?3:4)} bars · ${stepCount()} beats`;
 document.querySelector('#phraseNav').hidden=songLength===1;
 document.querySelectorAll('[data-phrase-page]').forEach(button=>{const active=Number(button.dataset.phrasePage)===phrasePage;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
 const p=pets.find(p=>p.id===selected)||pets[0];
 document.querySelector('#melodyTitle').textContent=`Melody${p.name}）`;
 const notes=p.notes||{};
 document.querySelector('#melodyGrid').innerHTML=noteNames[musicKey].map((name,row)=>
  `<div class="note-name">${name}</div>`+
  Array.from({length:16},(_,i)=>{const step=pageStart()+i,base=step%clipPatternSteps(p);return `<button type="button" class="note-cell ${notes[base]===row&&effectiveSteps(p).includes(step)?'on':''} ${step>=stepCount()?'outside-meter':''} ${playing&&step===beat?'current':''}" data-note-step="${step}" data-note-row="${row}" aria-label="${p.name} ${name} beat ${step+1}" aria-pressed="${notes[base]===row&&effectiveSteps(p).includes(step)}" ${step>=stepCount()?'disabled':''}></button>`}).join('')
 ).join('');

}
function updateComposerPlayhead(){
 document.querySelectorAll('.note-cell').forEach(el=>el.classList.toggle('current',playing&&Number(el.dataset.noteStep)===beat));
 document.querySelectorAll('.chord-slot').forEach(el=>el.classList.toggle('current',playing&&Number(el.dataset.chordSlot)===Math.floor(beat/4)));
}
const backingNoise = new WeakMap();
const backingProfiles = {
 mellow: {kick:[0], snare:[1,3], hat:.62, wave:'sine', bass:[0,2]},
 bright: {kick:[0], snare:[1,3], hat:.5, wave:'triangle', bass:[0,2]},
 disco: {kick:[0,1,2,3], snare:[1,3], hat:.5, wave:'triangle', bass:[0,1,2,3]},
 dub: {kick:[2], snare:[2], hat:.67, wave:'sine', bass:[0,3], chordOffset:.5},
 arcade: {kick:[0,2], snare:[1,3], hat:.5, wave:'square', bass:[0,2,3]},
 halftime: {kick:[0,3], snare:[2], hat:.58, wave:'triangle', bass:[0,3]},
 dream: {kick:[0], snare:[2], hat:.75, wave:'sine', bass:[0,2]},
 house: {kick:[0,1,2,3], snare:[1,3], hat:.5, wave:'triangle', bass:[1,3], chordOffset:.5},
 swing: {kick:[0,2], snare:[1,3], hat:.67, wave:'sine', bass:[0,1,2,3], chordOffset:.16, seventh:true},
 rock: {kick:[0,2,3], snare:[1,3], hat:.5, wave:'sawtooth', bass:[0,1,2,3], powerChord:true},
 trap: {kick:[0,3], snare:[2], hat:.5, wave:'triangle', bass:[0,3], hatRoll:true},
 punk: {kick:[0,2], snare:[1,3], hat:.5, wave:'sawtooth', bass:[0,1,2,3], powerChord:true}
};
const remixRhythms = {
 mellow: {pickup:[3], hats:[.50,.76], keys:[2]},
 bright: {pickup:[1,3], hats:[0,.50], keys:[1,3]},
 disco: {pickup:[1,3], hats:[.25,.50,.75], keys:[0,1,2,3], ghost:[1.75,3.75]},
 dub: {pickup:[0,2], hats:[.33,.67], keys:[1,2,3], ghost:[3.5]},
 arcade: {pickup:[0,1,3], hats:[0,.25,.50,.75], keys:[1,2,3]},
 halftime: {pickup:[0,3], hats:[0,.50,.75], keys:[3], kicks:[.75,2.5]},
 dream: {pickup:[2], hats:[.50], keys:[1,3]},
 house: {pickup:[0,2], hats:[.50,.75], keys:[0,2], ghost:[3.5]},
 swing: {pickup:[1,3], hats:[0,.67], keys:[1,2,3], ghost:[.67,2.67]},
 rock: {pickup:[0,2], hats:[0,.50], keys:[0,1,2,3], kicks:[2.5], ghost:[3.75]},
 trap: {pickup:[0,2,3], hats:[0,.25,.50,.75], keys:[2], kicks:[.75,1.5,3.75]},
 punk: {pickup:[0,1,2,3], hats:[0,.25,.50,.75], keys:[0,1,2,3], kicks:[.5,1.75,2.5,3.5], ghost:[1.5,3.75]}
};
function schedulePetBeat(pet,step,time,seconds,play){
 const row=pet.notes?.[step%clipPatternSteps(pet)];
 const offset=Number.isInteger(row)?noteOffset(row,pet):0;
 play(time,offset);
 if(!pet.remixPitch||pet.tone!=='custom'||pet.source==='instrument'||!Number.isInteger(row))return;
 const beat=step%(meter==='3/4'?3:4);
 if(row===7&&step%phraseSteps()>=phraseSteps()-2)return;
 if(!remixRhythms[backingStyle].pickup.includes(beat))return;
 const answer=clamp(row+(step>=phraseSteps()?-2:1),1,8);
 play(time+seconds*backingProfiles[backingStyle].hat,noteOffset(answer,pet));
}
function backingTone(audio,output,type,pitch,time,level,duration,endPitch=pitch){
 const osc=audio.createOscillator(),gain=audio.createGain();
 const attack=Math.min(.012,duration/4);
 osc.type=type;
 osc.frequency.setValueAtTime(pitch,time);
 if(endPitch!==pitch)osc.frequency.exponentialRampToValueAtTime(endPitch,time+.055);
 gain.gain.setValueAtTime(.0001,time);
 gain.gain.linearRampToValueAtTime(level,time+attack);
 gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
 osc.connect(gain).connect(output);
 osc.start(time);
 osc.stop(time+duration);
}
function backingPercussion(audio,output,time,level,duration,cutoff){
 let buffer=backingNoise.get(audio);
 if(!buffer){
  buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*.16),audio.sampleRate);
  const samples=buffer.getChannelData(0);
  let seed=17;
  for(let i=0;i<samples.length;i++){
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   samples[i]=seed/2147483648-1;
  }
  backingNoise.set(audio,buffer);
 }
 const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();
 source.buffer=buffer;
 filter.type='highpass';
 filter.frequency.value=cutoff;
 gain.gain.setValueAtTime(.0001,time);
 gain.gain.linearRampToValueAtTime(level,time+.002);
 gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
 source.connect(filter).connect(gain).connect(output);
 source.start(time);
 source.stop(time+duration);
}
function scheduleBacking(audio,output,step,time,bpm){
 if(!chordEnabled)return;
 const barLength=meter==='3/4'?3:4;
 const bar=Math.floor(step/barLength),beat=step%barLength;
 const full=step>=phraseSteps();
 const profile=backingProfiles[backingStyle];
 const rhythm=remixRhythms[backingStyle];
 const seconds=60/bpm;
 const fill=beat===barLength-1&&bar%4===3;
 if(profile.kick.includes(beat)||(full&&backingStyle==='bright'&&beat===2)){
  backingTone(audio,output,'sine',145,time,.11,.17,44);
 }
 if(profile.snare.includes(beat))backingPercussion(audio,output,time,.062,.105,950);
 for(const hit of rhythm.kicks||[]){
  if(Math.floor(hit)===beat)backingTone(audio,output,'sine',130,time+seconds*(hit-beat),.075,.13,46);
 }
 for(const hit of rhythm.ghost||[]){
  if(Math.floor(hit)===beat)backingPercussion(audio,output,time+seconds*(hit-beat),.033,.075,1300);
 }
 if(full||!['mellow','dream'].includes(backingStyle)){
  backingPercussion(audio,output,time+seconds*profile.hat,.027,.044,5400);
  if(full||backingStyle==='punk')for(const offset of rhythm.hats){
   if(Math.abs(offset-profile.hat)>.04)backingPercussion(audio,output,time+seconds*offset,.018,.031,6400);
  }
  if(fill||(profile.hatRoll&&beat===3))backingPercussion(audio,output,time+seconds*.76,.036,.051,4200);
 }
 const tones=chordDegrees[chordPattern[bar]];
 if(!tones)return;
 const transpose=musicKey==='Am'?0:keyOffsets[musicKey]||0;
 const frequency=(root,note)=>root*2**((note+transpose)/12);
 if(beat===0||((full||backingStyle==='punk')&&rhythm.keys.includes(beat))){
  const voicing=profile.powerChord?[tones[0],tones[2],tones[0]+12]:
   profile.seventh?[...tones,tones[0]+(chordPattern[bar]==='C'||chordPattern[bar]==='F'?11:10)]:tones;
  voicing.forEach((note,i)=>backingTone(audio,output,profile.wave,
   frequency(130.8128,note),time+seconds*(beat===0?(profile.chordOffset||0):.5),
   (beat===0?.028:.023)-i*.005,Math.min(.8,seconds*(beat===0?1.65:.35))));
 }
 if((profile.bass.includes(beat)&&(full||beat===profile.bass[0]))||fill){
  const note=tones[beat===2?2:0];
  backingTone(audio,output,'triangle',frequency(65.4064,note),
   time+(fill?seconds*.5:0),full?.09:.045,Math.min(.32,seconds*.6));
 }
 if((full&&beat!==0)||fill){
  const note=tones[(beat+bar)%tones.length];
  backingTone(audio,output,'sine',frequency(523.251,note),time+seconds*.54,.026,.16);
 }
}
function playChord(step,time){
 if(!context||!chordEnabled)return;
 ensureAnalyser();
 scheduleBacking(context,audioAnalyser,step,time,Number(document.querySelector('#tempo').value)||92);
}
function getComposerSaveState(){return {meter,musicKey,songLength,chordEnabled,backingStyle,chordPattern:[...chordPattern]}}
function loadComposerState(song){
 meter=song.meter==='3/4'?'3/4':'4/4';
 musicKey=Object.hasOwn(keyOffsets,song.musicKey)?song.musicKey:'C';
 songLength=song.songLength===2?2:1;
 chordEnabled=song.chordEnabled===true;
 backingStyle=Object.hasOwn(backingProfiles,song.backingStyle)?song.backingStyle:'bright';
 chordPattern=[];
 if(Array.isArray(song.chordPattern))chordPattern=song.chordPattern.slice(0,8).map(v=>chordChoices.includes(v)?v:'—');
 while(chordPattern.length<stepCount()/4)chordPattern.push(chordPattern[chordPattern.length%4]||'C');
}
document.querySelectorAll('[data-compose-mode]').forEach(button=>button.addEventListener('click',()=>{composerMode=button.dataset.composeMode;renderComposer()}));
document.querySelector('#songLength').addEventListener('change',e=>{songLength=Number(e.target.value)===2?2:1;phrasePage=0;while(chordPattern.length<stepCount()/4)chordPattern.push(chordPattern[chordPattern.length%4]||'C');beat=-1;if(playing)startTime=performance.now();render()});
document.querySelector('#phraseNav').addEventListener('click',e=>{const button=e.target.closest('[data-phrase-page]');if(!button)return;phrasePage=Number(button.dataset.phrasePage);render()});
document.querySelector('#meter').addEventListener('change',e=>{meter=e.target.value;beat=-1;if(playing)startTime=performance.now();render();});
document.querySelector('#musicKey').addEventListener('change',e=>{musicKey=e.target.value;renderComposer()});
document.querySelector('#melodyGrid').addEventListener('click',e=>{
 const cell=e.target.closest('[data-note-step]');if(!cell)return;
 const p=pets.find(p=>p.id===selected),step=Number(cell.dataset.noteStep)%clipPatternSteps(p),row=Number(cell.dataset.noteRow);
 p.notes||={};
 if(p.notes[step]===row&&p.steps.includes(step)){delete p.notes[step];p.steps=p.steps.filter(s=>s!==step)}
 else{p.notes[step]=row;if(!p.steps.includes(step))p.steps.push(step);p.steps.sort((a,b)=>a-b);context ||= new(window.AudioContext||window.webkitAudioContext)();context.resume().then(()=>sound(p,0,noteOffset(row,p)))}
 render();
});
