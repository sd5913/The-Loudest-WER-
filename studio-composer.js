// Each phrase has 16 visible cells; longer songs use a second editable phrase.
let composerMode='rhythm', meter='4/4', musicKey='C', songLength=1, phrasePage=0;
let chordEnabled=false, chordPattern=['C','G','Am','F'];
let audioAnalyser=null, waveFrame=0;
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
 const petMidi=69+12*Math.log2((p.base||440)/440);
 return 72+(keyOffsets[musicKey]||0)+(musicKey==='Am'?minorScale:majorScale)[row]-petMidi;
}
function melodyOffset(p,step){const row=p.notes?.[step];return Number.isInteger(row)?noteOffset(row,p):0}
function ensureAnalyser(){
 if(audioAnalyser||!context)return;
 audioAnalyser=context.createAnalyser();
 audioAnalyser.fftSize=256;
 audioAnalyser.smoothingTimeConstant=.72;
 audioAnalyser.connect(context.destination);
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
 const rhythm=document.querySelector('.band-section'),melody=document.querySelector('#melodyPanel'),chords=document.querySelector('#chordsPanel');
 rhythm.hidden=composerMode!=='rhythm';melody.hidden=composerMode!=='melody';chords.hidden=composerMode!=='chords';
 document.querySelectorAll('[data-compose-mode]').forEach(button=>{
  const active=button.dataset.composeMode===composerMode;
  button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));
 });
 document.querySelector('#meter').value=meter;
 document.querySelector('#musicKey').value=musicKey;
 document.querySelector('#songLength').value=String(songLength);
 document.querySelector('#lengthHint').textContent=`${stepCount()} beats · ${stepCount()} 拍`;
 document.querySelector('#phraseNav').hidden=songLength===1;
 document.querySelectorAll('[data-phrase-page]').forEach(button=>{const active=Number(button.dataset.phrasePage)===phrasePage;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
 document.querySelector('#chordLoop').checked=chordEnabled;
 const p=pets.find(p=>p.id===selected)||pets[0];
 document.querySelector('#melodyTitle').textContent=`Melody · 旋律（${p.name}）`;
 const notes=p.notes||{};
 document.querySelector('#melodyGrid').innerHTML=noteNames[musicKey].map((name,row)=>
  `<div class="note-name">${name}</div>`+
  Array.from({length:16},(_,i)=>{const step=pageStart()+i;return `<button type="button" class="note-cell ${notes[step]===row&&p.steps.includes(step)?'on':''} ${step>=stepCount()?'outside-meter':''} ${playing&&step===beat?'current':''}" data-note-step="${step}" data-note-row="${row}" aria-label="${p.name} ${name} beat ${step+1}" aria-pressed="${notes[step]===row&&p.steps.includes(step)}" ${step>=stepCount()?'disabled':''}></button>`}).join('')
 ).join('');
 document.querySelector('#chordSlots').innerHTML=chordPattern.slice(0,stepCount()/4).map((chord,i)=>
  `<button type="button" class="chord-slot ${playing&&Math.floor(beat/4)===i?'current':''}" data-chord-slot="${i}" aria-label="Beat ${i+1}: ${chord==='—'?'No chord':chordLabels[musicKey][chord]}. Click to change."><small>BEAT ${i+1}</small><b>${chord==='—'?'—':chordLabels[musicKey][chord]}</b><span>${chord==='—'?'Silent · 静音':'Click to change · 点击切换'}</span></button>`
 ).join('');
}
function updateComposerPlayhead(){
 document.querySelectorAll('.note-cell').forEach(el=>el.classList.toggle('current',playing&&Number(el.dataset.noteStep)===beat));
 document.querySelectorAll('.chord-slot').forEach(el=>el.classList.toggle('current',playing&&Number(el.dataset.chordSlot)===Math.floor(beat/4)));
}
function playChord(step,time){
 if(!chordEnabled||step%4||!context)return;
 const chord=chordPattern[Math.floor(step/4)];
 if(!chord||chord==='—')return;
 const offset=musicKey==='Am'?0:keyOffsets[musicKey]||0,root=130.8128;
 const tones=musicKey==='Am'?({C:[9,12,16],G:[4,7,11],Am:[5,9,12],F:[2,5,9]})[chord]:chordDegrees[chord];
 tones.forEach((semitones,index)=>{
  const osc=context.createOscillator(),gain=context.createGain();
  osc.type='sine';osc.frequency.setValueAtTime(root*2**((semitones+offset)/12),time);
  gain.gain.setValueAtTime(.0001,time);
  gain.gain.linearRampToValueAtTime(index===0?.024:.013,time+.025);
  gain.gain.exponentialRampToValueAtTime(.0001,time+Math.min(.75,240/(Number(document.querySelector('#tempo').value)||92)*.7));
  osc.connect(gain);connectOutput(gain,{echo:0});
  osc.start(time);osc.stop(time+1);
 });
}
function getComposerSaveState(){return {meter,musicKey,songLength,chordEnabled,chordPattern:[...chordPattern]}}
function loadComposerState(song){
 meter=song.meter==='3/4'?'3/4':'4/4';
 musicKey=Object.hasOwn(keyOffsets,song.musicKey)?song.musicKey:'C';
 songLength=song.songLength===2?2:1;
 chordEnabled=Boolean(song.chordEnabled);
 if(Array.isArray(song.chordPattern))chordPattern=song.chordPattern.slice(0,stepCount()/4).map(v=>chordChoices.includes(v)?v:'—');
 while(chordPattern.length<stepCount()/4)chordPattern.push(chordPattern[chordPattern.length%4]||'C');
}
document.querySelectorAll('[data-compose-mode]').forEach(button=>button.addEventListener('click',()=>{composerMode=button.dataset.composeMode;renderComposer()}));
document.querySelector('#songLength').addEventListener('change',e=>{songLength=Number(e.target.value)===2?2:1;phrasePage=0;while(chordPattern.length<stepCount()/4)chordPattern.push(chordPattern[chordPattern.length%4]||'C');beat=-1;if(playing)startTime=performance.now();render()});
document.querySelector('#phraseNav').addEventListener('click',e=>{const button=e.target.closest('[data-phrase-page]');if(!button)return;phrasePage=Number(button.dataset.phrasePage);render()});
document.querySelector('#meter').addEventListener('change',e=>{meter=e.target.value;beat=-1;if(playing)startTime=performance.now();render();});
document.querySelector('#musicKey').addEventListener('change',e=>{musicKey=e.target.value;renderComposer()});
document.querySelector('#chordLoop').addEventListener('change',e=>{chordEnabled=e.target.checked;renderComposer()});
document.querySelector('#melodyGrid').addEventListener('click',e=>{
 const cell=e.target.closest('[data-note-step]');if(!cell)return;
 const p=pets.find(p=>p.id===selected),step=Number(cell.dataset.noteStep),row=Number(cell.dataset.noteRow);
 p.notes||={};
 if(p.notes[step]===row&&p.steps.includes(step)){delete p.notes[step];p.steps=p.steps.filter(s=>s!==step)}
 else{p.notes[step]=row;if(!p.steps.includes(step))p.steps.push(step);p.steps.sort((a,b)=>a-b);context ||= new(window.AudioContext||window.webkitAudioContext)();context.resume().then(()=>sound(p,0,noteOffset(row,p)))}
 render();
});
document.querySelector('#chordSlots').addEventListener('click',e=>{
 const slot=e.target.closest('[data-chord-slot]');if(!slot)return;
 const i=Number(slot.dataset.chordSlot);
 chordPattern[i]=chordChoices[(chordChoices.indexOf(chordPattern[i])+1)%chordChoices.length];
 renderComposer();
});
document.querySelector('#chordPreset').addEventListener('change',e=>{
 const pattern=({pop:['C','G','Am','F'],dream:['Am','F','C','G'],bright:['C','F','G','C']})[e.target.value];
 chordPattern=Array.from({length:stepCount()/4},(_,i)=>pattern[i%pattern.length]);
 chordEnabled=true;renderComposer();
});
