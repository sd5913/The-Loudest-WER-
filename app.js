const petTypes = [
  {id:'cat',name:'Miso',kind:'Cat',role:'The warm little meow',color:'#e6aa7d',light:'#f6d6a8',dark:'#a56e68',wave:'triangle',base:523.25,emoji:'✦'},
  {id:'dog',name:'Biscuit',kind:'Pup',role:'The happy little woof',color:'#c88768',light:'#efc49e',dark:'#815a69',wave:'sine',base:392,emoji:'♡'},
  {id:'bird',name:'Pip',kind:'Bird',role:'The bright little tweet',color:'#8a9da0',light:'#bfd3c3',dark:'#645d7f',wave:'square',base:783.99,emoji:'♪'},
  {id:'bunny',name:'Clover',kind:'Bunny',role:'A soft, sleepy hum',color:'#c59eaa',light:'#f1d9df',dark:'#85657f',wave:'sine',base:329.63,emoji:'☾'},
  {id:'frog',name:'Mallow',kind:'Frog',role:'A bouncy little boop',color:'#8eaa85',light:'#cee0a9',dark:'#617c70',wave:'triangle',base:440,emoji:'♫'},
  {id:'fox',name:'Peach',kind:'Fox',role:'A curious high note',color:'#d28b71',light:'#f3c39b',dark:'#81596a',wave:'triangle',base:587.33,emoji:'✧'}
];
const catalogPets=WERStore.getCatalogPets();
petTypes.splice(0,3, ...catalogPets.slice(0,3));
petTypes.push(...catalogPets.slice(3),...WERStore.getPets().map(p=>({...p,kind:p.kind||'Custom',wave:p.wave||'triangle',base:p.base||440})));
const templates = [
  {name:'Sunset stroll',tempo:92,steps:{cat:[0,4,8,12],'ghost-cat':[2,6,10,14],'bat-cat':[0,3,5,8,11,13]}},
  {name:'Seaside swing',tempo:116,steps:{cat:[0,3,4,7,8,11,12,15],'ghost-cat':[2,6,10,14],'bat-cat':[1,3,5,7,9,11,13,15]}},
  {name:'Moonlight lullaby',tempo:72,steps:{cat:[0,8],'ghost-cat':[4,12],'bat-cat':[2,6,10,14]}}
];
let pets=petTypes.slice(0,3).map((p,i)=>({...p,volume:[62,55,48][i],pitch:0,tone:'sample',clipStart:0,clipEnd:i===2?.36:1,strength:70,echo:0,repeat:'loop',muted:false,steps:templates[0].steps[p.id].slice()}));
let loopPlayback=true;
let aiSongData='',aiSongRange={start:0,end:0},aiSongVolume=70;
let selected=pets[0].id, focusBeat=0, playing=false, context=null, timer=null, beat=0, loop=0, startTime=0, toastTimer;
let positioning=false, positionDraft={}, activeDrag=null;
let recording=null;
const starterStagePositions={cat:{x:76,y:61},'ghost-cat':{x:50,y:55},'bat-cat':{x:24,y:61}};
const extraStagePositions=[{x:36,y:69},{x:64,y:69},{x:50,y:71}];
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const scalePitchClasses={C:[0,2,4,5,7,9,11],G:[7,9,11,0,2,4,6],F:[5,7,9,10,0,2,4],Am:[9,11,0,2,4,5,7]};
const solfegeNames=['Do','Re','Mi','Fa','Sol','La','Si'];
const solfegeRows=[7,6,5,4,3,2,1];
const solfegeForRow={0:'Do↑',1:'Si',2:'La',3:'Sol',4:'Fa',5:'Mi',6:'Re',7:'Do',8:'Si↓'};
function trackNoteLabel(p,step){if(!effectiveSteps(p).includes(step))return '';const row=p.notes?.[step%clipPatternSteps(p)];return Number.isInteger(row)?solfegeForRow[row]||'♫':'♫'}
function randomScalePitch(p){
 const baseMidi=Math.round(69+12*Math.log2((p.base||440)/440));
 const choices=Array.from({length:13},(_,i)=>i-6).filter(offset=>scalePitchClasses[musicKey].includes((baseMidi+offset+120)%12));
 return choices[Math.floor(Math.random()*choices.length)]||0;
}
function setStudioHint(message){const hint=document.querySelector('#studioHint');if(hint)hint.textContent=message}

function stagePosition(p,i,positions){const fallback=starterStagePositions[p.id]||extraStagePositions[(i-3+extraStagePositions.length)%extraStagePositions.length];const stored=positions[p.id];return stored&&Number.isFinite(Number(stored.x))&&Number.isFinite(Number(stored.y))?{x:clamp(Number(stored.x),0,100),y:clamp(Number(stored.y),0,100)}:fallback;}
const sampleBuffers=new Map(),customBuffers=new Map(),customLevels=new Map();
function trimOnset(buffer, cropRecording=false){
 const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
 let peak=0;
 for(const data of channels)for(let i=0;i<data.length;i++)peak=Math.max(peak,Math.abs(data[i]));
 if(peak<.005)throw new Error('No clear sound found');
 const threshold=Math.max(.002,peak*.04);
 let first=buffer.length,last=0;
 for(let i=0;i<buffer.length;i++)if(channels.some(data=>Math.abs(data[i])>=threshold)){first=Math.min(first,i);last=i}
 if(first===buffer.length)throw new Error('No clear sound found');
 let start=Math.max(0,first-Math.round(buffer.sampleRate*.015));
 let end=Math.min(buffer.length,last+1+Math.round(buffer.sampleRate*.08));
 const maxLength=3*buffer.sampleRate;
 if(end-start>maxLength){
  if(!cropRecording)throw new Error('Choose a pet sound with no more than 3 seconds of audible sound');
  const energy=index=>channels.reduce((sum,data)=>sum+data[index]**2,0);
  const firstStart=start;
  let current=0;
  for(let i=firstStart;i<firstStart+maxLength;i++)current+=energy(i);
  let best=current;
  for(let i=firstStart+maxLength;i<end;i++){
   current+=energy(i)-energy(i-maxLength);
   if(current>best){
    best=current;
    start=i-maxLength+1;
   }
  }
  end=start+maxLength;
  peak=0;
  for(const data of channels)for(let i=start;i<end;i++)peak=Math.max(peak,Math.abs(data[i]));
 }
 const length=end-start;
 const trimmed=context.createBuffer(buffer.numberOfChannels,length,buffer.sampleRate);
 channels.forEach((data,i)=>trimmed.copyToChannel(data.subarray(start,end),i));
 return {buffer:trimmed,peak};
}
function useCustomVoice(p,buffer,name,cropRecording=false){
 if(!buffer.duration||buffer.duration>12)throw new Error('Please use a recording under 12 seconds');
 const prepared=trimOnset(buffer,cropRecording);
 p.aiPerformance='voice';
 delete p.remixPitch;
 customBuffers.set(p.id,prepared.buffer);
 customLevels.set(p.id,Math.min(2.5,.55/prepared.peak));
 p.customAudioData=audioBufferData(prepared.buffer);
 p.customVoiceName=name;p.customLevel=customLevels.get(p.id);p.tone='custom';p.source='voice';
 p.clipStart=0;p.clipEnd=1;
 if(!p.steps.length)p.steps=[0,4,8,12];
 scheduleDraftSave();
}let sampleLoad=null,singingLoad=null,singingBuffer=null,samplesReady=false;
function audioBufferData(buffer){
 const samples=buffer.length,bytes=new ArrayBuffer(44+samples*2),view=new DataView(bytes);
 const word=(offset,value)=>view.setUint32(offset,value,true),short=(offset,value)=>view.setUint16(offset,value,true);
 for(const [offset,value] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']])for(let i=0;i<4;i++)view.setUint8(offset+i,value.charCodeAt(i));
 word(4,36+samples*2);word(16,16);short(20,1);short(22,1);word(24,buffer.sampleRate);word(28,buffer.sampleRate*2);short(32,2);short(34,16);word(40,samples*2);
 const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
 for(let i=0;i<samples;i++){let sample=0;for(const channel of channels)sample+=channel[i]/channels.length;view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,sample))*32767),true)}
 const bytes8=new Uint8Array(bytes);let binary='';for(let i=0;i<bytes8.length;i+=8192)binary+=String.fromCharCode(...bytes8.subarray(i,i+8192));
 return 'data:audio/wav;base64,'+btoa(binary);
}
function showAiSong(){
 const audio=$('#aiSongAudio');if(!aiSongData)return;audio.src=aiSongData;audio.volume=aiSongVolume/100;
 $('#aiSongEditor').hidden=false;$('#aiSongVolume').value=aiSongVolume;$('#aiSongVolumeValue').textContent=`${aiSongVolume}%`;
 audio.onloadedmetadata=()=>{const duration=audio.duration||0;aiSongRange.end=Math.min(aiSongRange.end||duration,duration);for(const id of ['aiSongStart','aiSongEnd'])$('#'+id).max=String(duration);$('#aiSongStart').value=String(aiSongRange.start);$('#aiSongEnd').value=String(aiSongRange.end);updateAiSongRange();renderSongWave()};
 prepareSongWave();
}
function updateAiSongRange(){
 aiSongRange.start=Math.min(Number($('#aiSongStart').value),Math.max(0,Number($('#aiSongEnd').value)-.2));
 aiSongRange.end=Math.max(Number($('#aiSongEnd').value),aiSongRange.start+.2);
 $('#aiSongStart').value=String(aiSongRange.start);$('#aiSongEnd').value=String(aiSongRange.end);
 $('#aiSongStartValue').textContent=`${aiSongRange.start.toFixed(1)}s`;$('#aiSongEndValue').textContent=`${aiSongRange.end.toFixed(1)}s`;
}
function pauseAiSong(){const audio=$('#aiSongAudio');if(audio&&!audio.paused)audio.pause()}
function startAiSong(){const audio=$('#aiSongAudio');if(!aiSongData)return;audio.currentTime=aiSongRange.start;audio.play().catch(()=>{})}
async function loadSamples(){
 const Decoder=window.OfflineAudioContext||window.webkitOfflineAudioContext;
 const decoder=context||(Decoder?new Decoder(1,1,44100):new(window.AudioContext||window.webkitAudioContext)());
 if(!sampleLoad)sampleLoad=(async()=>{for(const p of [...pets,...petTypes]){const sample=p.sampleId||p.id;if(!p.custom&&!sampleBuffers.has(p.id)){try{const response=await fetch(`assets/sounds/${p.sampleFile||sample+"-call.wav"}?v=3`);if(response.ok)sampleBuffers.set(p.id,await decoder.decodeAudioData(await response.arrayBuffer()))}catch{}}if((p.customAudioData||p.audioData)&&!customBuffers.has(p.id)){try{const raw=atob((p.customAudioData||p.audioData).split(',').pop()),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const restored=await decoder.decodeAudioData(bytes.buffer);customBuffers.set(p.id,restored);let peak=0;for(let c=0;c<restored.numberOfChannels;c++)for(const value of restored.getChannelData(c))peak=Math.max(peak,Math.abs(value));customLevels.set(p.id,p.customLevel??Math.min(2.5,.55/Math.max(peak,.001)));p.tone='custom'}catch{}}}})();
 await sampleLoad;await loadSingingMeow(decoder);samplesReady=true;if(context&&pets.some(p=>p.source==='instrument'))await loadInstrumentSamples();renderClipUI();
}
async function loadSingingMeow(decoder=context){if(!singingLoad)singingLoad=fetch('assets/sounds/pet-singing-meow.wav?v=1').then(async response=>{if(response.ok)singingBuffer=await decoder.decodeAudioData(await response.arrayBuffer())}).catch(()=>{});await singingLoad}
const requestedPet=new URLSearchParams(location.search).get('pet');if(requestedPet){const friend=petTypes.find(p=>p.id===requestedPet);if(friend){if(!pets.some(p=>p.id===friend.id))pets.push({...friend,volume:50,pitch:0,tone:friend.audioData?'custom':'signature',strength:70,echo:0,repeat:'loop',muted:false,steps:[0,8]});selected=friend.id;}}
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const html=s=>String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const stagePet=(id)=>$(`.stage-pet[data-id="${id}"]`);
const kindZh={Cat:'',Pup:'',Bird:'',Bunny:'',Frog:'',Fox:'',Custom:'',Hamster:'',Otter:'',Dog:''};const roleZh={cat:'','ghost-cat':'','bat-cat':'',dog:'',bird:'',bunny:'',frog:'',fox:'',hamster:'','sea-otter':'','gray-cat':'','dachshund':'',samoyed:''};
window.petTypes=petTypes;window.petSvg=id=>window.spriteSvg(petTypes.find(p=>p.id===id)||petTypes.find(p=>(p.asset||p.id)===id)||petTypes[0]);

function sprite(p){const src=p.image||`assets/pets/${p.asset||p.id}.png`;return `<img class="pet-png" src="${src}" alt="${html(p.name)}" onload="this.dataset.fallback=''" onerror="if(this.dataset.fallback){this.outerHTML=window.petSvg('${p.asset||p.id}')}else{this.dataset.fallback='1';this.src='${src}'}">`;}
function render(){
 const switches=$('#mixerPetSwitcher');if(switches)switches.innerHTML=pets.map(p=>`<div class="mixer-pet-item"><button type="button" data-mixer-pet="${html(p.id)}" aria-pressed="${p.id===selected}" class="${p.id===selected?'active':''}">${sprite(p)}<span>${html(p.name)}</span></button><button type="button" class="mixer-pet-remove" data-remove="${html(p.id)}" aria-label="Remove ${html(p.name)} from this band" title="Remove from this band · stays in My Pets" ${pets.length<=1||positioning?'disabled':''}>×</button></div>`).join('');
 focusBeat=clamp(focusBeat,0,stepCount()-1);
 if(focusBeat<pageStart()||focusBeat>=pageStart()+16)focusBeat=pageStart();
 $('#soloBeat').innerHTML=`♪ Only beat ${focusBeat+1}`;
 $('#stage').classList.toggle('is-playing',playing);
 $('#stage').classList.toggle('is-positioning',positioning);
 $('#petCount').textContent=`${String(pets.length).padStart(2,'0')} / 06`;
 $('#trackNumbers').innerHTML=Array.from({length:16},(_,i)=>{const step=pageStart()+i;return `<span class="${step>=stepCount()?'outside-meter':''}">${step+1}</span>`}).join('');
 $('#petCards').innerHTML=pets.map(p=>`<div data-pet-id="${p.id}" class="track-row ${p.id===selected?'selected':''} ${p.muted?'muted':''}"><button class="track-pet" data-select="${p.id}" aria-pressed="${p.id===selected}">${sprite(p)}<span><b>${html(p.name)}</b><small>${p.muted?'Muted':p.source==='instrument'?`♬ ${instruments.find(i=>i.id===p.instrument)?.name||'Piano'}`:p.id==='cat'&&p.tone==='sample'?'♫ Cat meow':p.tone==='meow'?'♫ Singing Meow':p.asset==='dachshund'&&p.tone==='sample'?'♫ Short bark':p.asset==='samoyed'&&p.tone==='sample'?'♫ Bright bark':p.asset==='samoyed'&&p.tone==='signature'?'♫ Snowy synth':p.asset==='hamster'&&p.tone==='signature'?'♫ Tiny synth':p.asset==='sea-otter'&&p.tone==='signature'?'♫ Soft synth':'Playing'}</small></span></button><button class="track-mute" data-mute="${p.id}" type="button" aria-label="${p.muted?'Unmute':'Mute'} ${html(p.name)}">${p.muted?'◌':'♫'}</button><button class="track-remove" data-remove="${p.id}" type="button" aria-label="Remove ${html(p.name)} from stage" title="Remove" ${pets.length<=1?'disabled':''}>×</button><div class="track-steps">${Array.from({length:16},(_,cell)=>{const i=pageStart()+cell;return `<button type="button" class="${effectiveSteps(p).includes(i)?'enabled':''} ${playing&&beat===i?'current':''} ${p.id===selected&&focusBeat===i?'edit-target':''} ${i>=stepCount()?'outside-meter':''}" data-track="${p.id}" data-step="${i}" aria-label="${html(p.name)} beat ${i+1} ${effectiveSteps(p).includes(i)?'on':'off'}" aria-pressed="${effectiveSteps(p).includes(i)}" ${i>=stepCount()?'disabled':''}>${trackNoteLabel(p,i)}</button>`}).join('')}</div></div>`).join('');
 const positions=positioning?positionDraft:WERStore.getStagePositions($('#sceneSelect').value);
 if(!activeDrag)$('#stagePets').innerHTML=pets.map((p,i)=>{const {x,y}=stagePosition(p,i,positions);return `<button class="stage-pet ${p.id===selected?'selected':''} ${p.muted?'muted':''}" data-id="${p.id}" style="left:${x}%;top:${y}%" aria-label="${positioning?'Move':'Select'} ${html(p.name)} · ${positioning?'':''}${html(kindZh[p.kind]||'')}" aria-pressed="${p.id===selected}">${sprite(p)}<span class="pet-label">${html(p.name)}</span></button>`}).join('');
 const pet=pets.find(p=>p.id===selected)||pets[0];if(!pet)return;
 selected=pet.id;$('#portrait').innerHTML=sprite(pet);$('#petName').textContent=pet.name;$('#petRole').textContent=pet.source==='instrument'?`♬ ${instruments.find(item=>item.id===pet.instrument)?.name||'Piano'}`:`${pet.role}`;
 $('#solfegeTarget').textContent=`Beat ${focusBeat+1}`;
 $('#solfegeHint').textContent=pet.source==='instrument'?'Current sound is an instrument. Choose Pet voice above to use this pet’s call.':'Long, clear calls work well for melody; short barks work well on beat squares. Tap a note to place it on the selected beat.';
 $('#solfegeKeys').innerHTML=solfegeNames.map((name,index)=>{const row=solfegeRows[index],active=effectiveSteps(pet).includes(focusBeat)&&pet.notes?.[focusBeat%clipPatternSteps(pet)]===row;return `<button type="button" data-solfege-row="${row}" class="${active?'active':''}" aria-label="${html(pet.name)} ${name} beat ${focusBeat+1}" aria-pressed="${active}"><b>${name}</b></button>`}).join('');
 $('#volume').value=pet.volume;$('#pitch').value=pet.pitch;$('#volumeValue').textContent=`${pet.volume}%`;$('#pitchValue').textContent=`${pet.pitch>0?'+':''}${pet.pitch} st`;
 $('#repeat').value=pet.repeat;renderInstrumentPicker(pet);const hasCustom=customBuffers.has(pet.id);$('#voice').value=hasCustom&&pet.tone==='custom'?'custom':pet.tone==='custom'?'signature':pet.tone||'signature';$('#voice option[value="sample"]').textContent=pet.id==='cat'?'Cat meow':pet.asset==='dachshund'?'Short bark':pet.asset==='samoyed'?'Bright barks':'Sample call';$('#voice option[value="custom"]').hidden=!hasCustom;$('#voice option[value="custom"]').textContent=hasCustom?`My electronic voice · ${pet.customVoiceName}`:'My electronic voice';$('#sourceRecord').innerHTML=recording?'■ Stop <small></small>':'◉ Record <small></small>';$('#voiceStatus').textContent=recording?.petId===pet.id?'Recording… click Stop to finish':hasCustom?`${pet.customVoiceName} · Converted on this device`:'WAV / MP3 / M4A · up to 12s, 16MB · local only';$('#mute').textContent=pet.muted?'Unmute pet':'Mute pet';$('#toneStrength').value=pet.strength??70;$('#toneStrengthValue').textContent=`${pet.strength??70}%`;$('#echo').value=pet.echo??0;$('#echoValue').textContent=`${pet.echo??0}%`;$('#remove').disabled=pets.length<=1||positioning;
 $('#rhythm').innerHTML=Array.from({length:16},(_,cell)=>{const i=pageStart()+cell;return `<button class="${effectiveSteps(pet).includes(i)?'enabled':''} ${playing&&beat===i?'current':''} ${i>=stepCount()?'outside-meter':''}" data-step="${i}" aria-label="Beat ${i+1}, ${effectiveSteps(pet).includes(i)?'on':'off'}" ${i>=stepCount()?'disabled':''}>${String(i+1).padStart(2,'0')}</button>`}).join('');
 $('#choices').innerHTML=petTypes.filter(p=>!pets.some(a=>a.id===p.id)).map(p=>`<button data-add="${p.id}">${sprite(p)}<b>${html(p.name)}</b><small>${html(p.kind)} · ${html(kindZh[p.kind]||'')} · ${html(p.role.split(' ').slice(1).join(' '))}</small></button>`).join('')||'<p>Your band is full! Six friends, one very happy stage.</p>';
 $('#add').disabled=pets.length>=6||positioning;$('#play').innerHTML=playing?'Ⅱ <span>Pause the band</span>':'▶ <span>Play together</span>';$('#stageState').textContent=playing?'● The little band is playing':'● Ready when you are';
 $('#beatLights').innerHTML=Array.from({length:stepCount()/4},(_,i)=>`<i class="${playing&&Math.floor(beat/4)===i?'on':''}"></i>`).join('');
 $$('.template').forEach(b=>b.classList.toggle('active',Number(b.dataset.template)===currentTemplate));$('#christmasTemplate').classList.toggle('active',currentTemplate===-1);renderComposer();renderClipUI();updateTimeDisplay();
}
let currentTemplate=0;
const sharedScenes=(window.WERStageScenes||[]).map(scene=>({id:scene.id,name:scene.name,zh:scene.zh||'',src:`assets/backgrounds/${scene.file}`,shared:true}));
const personalScenes=WERStore.getScenes();
const stageScenes=Object.fromEntries([...sharedScenes,...personalScenes].map(scene=>[scene.id,scene]));
function renderSceneOptions(preferred){
 const options=[...sharedScenes,...personalScenes];
 $('#sceneSelect').innerHTML=options.map(scene=>`<option value="${html(scene.id)}">${html(scene.name)}${scene.zh?` · ${html(scene.zh)}`:''}</option>`).join('');
 $('#sceneSelect').value=stageScenes[preferred]?preferred:options[0]?.id||'';$('#sceneTiles').innerHTML=options.map(scene=>`<button type="button" class="scene-tile ${scene.id===$('#sceneSelect').value?'active':''}" aria-label="${html(scene.name)}" title="${html(scene.name)}" data-scene-tile="${html(scene.id)}" aria-pressed="${scene.id===$('#sceneSelect').value}"><img src="${scene.src}" alt=""><span>${html(scene.name)}${scene.zh?`<small>${html(scene.zh)}</small>`:''}</span></button>`).join('');
}
renderSceneOptions(WERStore.getSelectedScene());
const incomingSong=new URLSearchParams(location.search).get('song');
function captureSession(){
 return {tempo:Number($('#tempo').value)||92,masterVolume:Number($('#masterVolume').value),version:3,template:currentTemplate,scene:$('#sceneSelect').value,selected,loopPlayback,
  aiSong:aiSongData?{data:aiSongData,range:{...aiSongRange},volume:aiSongVolume}:null,
  aiSongPrompt:$('#aiSongPrompt').value,aiSongDuration:$('#aiSongDuration').value,
  aiSongInstrumental:$('#aiSongInstrumental').checked,aiSamplePrompt:$('#aiSoundPrompt').value,
  ...getComposerSaveState(),
  pets:pets.map(({id,name,volume,pitch,tone,strength,echo,repeat,muted,steps,notes,source,instrument,customAudioData,audioData,customVoiceName,customLevel,remixPitch,kind,asset,image,sampleId,sampleFile,base,wave,custom,aiPerformance,clipStart,clipEnd,clipRepeats})=>
   ({id,name,volume,pitch,tone,strength,echo,repeat,muted,steps:[...steps],notes:notes?{...notes}:{},source:source||'voice',instrument:instrument||'piano',customAudioData:customAudioData||audioData||'',customVoiceName:customVoiceName||'My uploaded voice',customLevel,remixPitch,kind,asset,image,sampleId,sampleFile,base,wave,custom,aiPerformance,clipStart:clipStart||0,clipEnd:clipEnd??1,clipRepeats:clipRepeats||1}))};
}
function restoreSession(saved){
 if(!Array.isArray(saved?.pets))return false;
 const restored=saved.pets.map(item=>{const base=petTypes.find(p=>p.id===item.id)||(item.customAudioData?{id:item.id,kind:item.kind||'Custom',custom:true}:null);return base?{...base,...item,tone:item.tone==='hum'?'meow':item.tone,strength:item.strength??70,echo:item.echo??0,steps:saved.version>=2?item.steps:item.steps.map(step=>step*2)}:null}).filter(Boolean);
 if(!restored.length)return false;
 pets=restored;selected=restored.some(p=>p.id===saved.selected)?saved.selected:restored[0].id;
 $('#tempo').value=saved.tempo||92;currentTemplate=saved.template||0;loadComposerState(saved);
 $('#masterVolume').value=saved.masterVolume??80;$('#masterVolumeValue').textContent=`${$('#masterVolume').value}%`;
 if(saved.aiSong?.data){aiSongData=saved.aiSong.data;aiSongRange=saved.aiSong.range||{start:0,end:0};aiSongVolume=saved.aiSong.volume??70;showAiSong()}
 else {aiSongData='';$('#aiSongAudio').removeAttribute('src');$('#aiSongEditor').hidden=true}
 $('#aiSongPrompt').value=saved.aiSongPrompt||'';$('#aiSongDuration').value=saved.aiSongDuration||'30000';
 $('#aiSongInstrumental').checked=saved.aiSongInstrumental!==false;$('#aiSoundPrompt').value=saved.aiSamplePrompt||'';
 loopPlayback=saved.loopPlayback!==false;$('#loopPlayback').checked=loopPlayback;
 if(saved.scene&&stageScenes[saved.scene])$('#sceneSelect').value=saved.scene;
 customBuffers.clear();customLevels.clear();sampleLoad=null;samplesReady=false;
 return true;
}
if(incomingSong){const saved=WERStore.getSongs().find(song=>song.id===incomingSong);if(saved)restoreSession(saved)}
const digitalCurve=Float32Array.from({length:512},(_,i)=>{const x=i*2/511-1;return Math.tanh(x*4)*.82});
function connectOutput(gain,p){ensureAnalyser();gain.connect(audioAnalyser);if((p.echo||0)>0){const delay=context.createDelay(.6),feedback=context.createGain(),wet=context.createGain();delay.delayTime.value=.23;feedback.gain.value=.18;wet.gain.value=(p.echo||0)/100*.35;gain.connect(delay);delay.connect(wet).connect(audioAnalyser);delay.connect(feedback).connect(delay)}}
function playSynthClip(p,t,rate){
 const buffer=clipBufferFor(p);if(!buffer)return false;
 const source=context.createBufferSource(),gain=context.createGain(),range=clipRange(p,buffer);
 const duration=range.duration/rate,fade=Math.min(.045,duration*.4);
 const level=Math.max(.001,p.volume/100*.22*((p.strength??70)/100*.7+.3));
 source.buffer=buffer;source.playbackRate.setValueAtTime(rate,t);
 gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(level,t+Math.min(.018,duration*.22));
 gain.gain.setValueAtTime(level,t+Math.max(.018,duration-fade));gain.gain.linearRampToValueAtTime(0,t+duration);
 source.connect(gain);connectOutput(gain,p);
 source.start(t,range.start,range.duration);source.stop(t+duration+.01);animate(p.id);return true;
}
function sound(p,time=0,noteOffset=0){if(p.aiPerformance==='music'){animate(p.id);return}if(!context||context.state==='closed')return;const t=Math.max(context.currentTime+.005,time),rate=2**((p.pitch+noteOffset)/12);if(p.source==='instrument'&&playInstrument(p,t,noteOffset))return;if(p.tone==='custom'&&customBuffers.has(p.id)){const source=context.createBufferSource(),high=context.createBiquadFilter(),shape=context.createWaveShaper(),low=context.createBiquadFilter(),gain=context.createGain();source.buffer=customBuffers.get(p.id);source.playbackRate.setValueAtTime(rate,t);high.type='highpass';high.frequency.setValueAtTime(170,t);shape.curve=digitalCurve;shape.oversample='2x';low.type='lowpass';low.frequency.setValueAtTime(2800,t);const range=clipRange(p,source.buffer),duration=range.duration/rate,level=Math.max(.001,p.volume/100*.24*(customLevels.get(p.id)||1)*((p.strength??70)/100*.7+.3)),attack=Math.min(.018,duration*.22),fade=Math.min(.045,duration*.4);gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(level,t+attack);gain.gain.setValueAtTime(level,t+Math.max(attack,duration-fade));gain.gain.linearRampToValueAtTime(0,t+duration);if(p.remixPitch)source.connect(gain);else source.connect(high).connect(shape).connect(low).connect(gain);connectOutput(gain,p);source.start(t,range.start,range.duration);source.stop(t+duration+.01);animate(p.id);return}if(p.tone==='meow'&&singingBuffer){
 const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
 source.buffer=singingBuffer;
 const target=(p.base||440)*rate*2,singingRate=Math.max(.5,Math.min(4,target/520));
 source.playbackRate.setValueAtTime(singingRate,t);
 filter.type='lowpass';filter.frequency.setValueAtTime(3200,t);
 const range=clipRange(p,singingBuffer),duration=range.duration/singingRate,volume=Math.max(.001,p.volume/100*.4*((p.strength??70)/100*.7+.3));
 gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(volume,t+.022);
 gain.gain.setValueAtTime(volume*.85,t+Math.min(.14,duration*.5));
 gain.gain.setValueAtTime(volume*.85,t+Math.max(.022,duration-.045));gain.gain.linearRampToValueAtTime(0,t+duration);
 source.connect(filter).connect(gain);connectOutput(gain,p);source.start(t,range.start,range.duration);source.stop(t+duration+.01);animate(p.id);return
 }if(p.tone==='sample'&&sampleBuffers.has(p.id)){
 const source=context.createBufferSource(),gain=context.createGain(),filter=context.createBiquadFilter();
 source.buffer=sampleBuffers.get(p.id);source.playbackRate.setValueAtTime(rate,t);
 filter.type='lowpass';filter.frequency.setValueAtTime(p.id==='cat'?2500:3200,t);
 const range=clipRange(p,source.buffer),duration=range.duration/rate;
 const volume=Math.max(.001,p.volume/100*(p.id==='cat'?.24:.36)*((p.strength??70)/100*.7+.3));
 gain.gain.setValueAtTime(.0001,t);
 gain.gain.linearRampToValueAtTime(volume,t+Math.min(.035,duration*.25));
 gain.gain.setValueAtTime(volume*.82,t+Math.max(Math.min(.035,duration*.25),duration-Math.min(.05,duration*.4)));
 gain.gain.linearRampToValueAtTime(0,t+duration);
 source.connect(filter).connect(gain);connectOutput(gain,p);
 source.start(t,range.start,range.duration);source.stop(t+duration+.01);animate(p.id);return
 }
 if(playSynthClip(p,t,rate))return;
 const freq=p.base*rate,gain=context.createGain(),osc=context.createOscillator(),filter=context.createBiquadFilter();osc.type=p.tone==='soft'?'sine':p.tone==='bright'||p.tone==='robot'?'square':p.wave;osc.frequency.setValueAtTime(freq,t);filter.type='lowpass';filter.frequency.setValueAtTime(p.tone==='soft'?900:p.tone==='bright'?3200:p.tone==='robot'?1100:p.id==='dog'?950:2500,t);const vol=(p.volume/100)*.11*((p.strength??70)/100*.7+.3);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.001,vol),t+.018);gain.gain.exponentialRampToValueAtTime(.0001,t+(p.id==='bird'?.13:.2));osc.connect(filter).connect(gain);connectOutput(gain,p);osc.start(t);osc.stop(t+.22);animate(p.id)}
const animationAsset={cat:'gray-cat','ghost-cat':'dachshund','bat-cat':'samoyed',hamster:'hamster','sea-otter':'sea-otter'};
const animationFrames=new Map();
const animationImages=new Map();
function preloadAnimationFrames(){
 for(const asset of new Set(Object.values(animationAsset))){
  if(animationImages.get(asset)?.every(image=>image.complete&&image.naturalWidth))continue;
  animationImages.set(asset,Array.from({length:4},(_,frame)=>{
   const image=new Image();image.src=`assets/pets/animation/${asset}-${frame}.png`;return image;
  }));
 }
}
function advancePetFrame(id){
 const el=stagePet(id),img=el?.querySelector('.pet-png'),asset=animationAsset[id];
 if(!img||!asset)return;
 const frames=animationImages.get(asset),frame=(animationFrames.get(id)||0)%4;
 const next=frames?.[frame];
 // Keep the last visible image when an animation frame cannot load.
 if(next?.complete&&next.naturalWidth)img.src=next.src;
 animationFrames.set(id,frame+1);
}
function animate(id){
 const el=stagePet(id);if(!el)return;
 advancePetFrame(id);
 el.classList.remove('hit');void el.offsetWidth;el.classList.add('hit');
}
preloadAnimationFrames();
setInterval(()=>{if(playing)pets.forEach(p=>{if(!p.muted)advancePetFrame(p.id)})},240);
function timeLabel(seconds){const n=Math.floor(seconds);return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`}
function updateTimeDisplay(){const bpm=Number($('#tempo').value)||92;const duration=stepCount()*60/bpm;const elapsed=playing?((performance.now()-startTime)/1000)%duration:0;$('#timeDisplay').textContent=`${timeLabel(elapsed)} / ${timeLabel(Math.ceil(duration))}`}
function updateBeatUI(){const loopBeat=Math.floor(beat/4);$('#beatLights').querySelectorAll('i').forEach((el,i)=>el.classList.toggle('on',playing&&i===loopBeat));$('#rhythm').querySelectorAll('[data-step]').forEach(el=>el.classList.toggle('current',playing&&Number(el.dataset.step)===beat));$$('.track-steps [data-step]').forEach(el=>el.classList.toggle('current',playing&&Number(el.dataset.step)===beat))}
function petPlaysInLoop(p,cycle){
 const limit={once:1,twice:2,four:4}[p.repeat];
 if(limit)return cycle<limit;
 return p.repeat==='alternate'?cycle%2===0:true;
}
function tick(){if(!playing)return;const ms=60000/Number($('#tempo').value||92),count=stepCount();const elapsed=performance.now()-startTime;if(!loopPlayback&&elapsed>=ms*count){playing=false;clearTimeout(timer);stopWave();pauseAiSong();beat=-1;render();notify('Phrase finished');return}const step=Math.floor(elapsed/ms)%count,nowLoop=Math.floor(elapsed/(ms*count));loop=nowLoop;updateTimeDisplay();if(step!==beat){beat=step;const nextPage=Math.floor(step/phraseSteps());if(nextPage!==phrasePage){phrasePage=nextPage;render()}const at=context.currentTime+.035;pets.forEach(p=>{const repeatOk=petPlaysInLoop(p,loop);if(!p.muted&&repeatOk&&effectiveSteps(p).includes(step))schedulePetBeat(p,step,at,ms/1000,(time,offset)=>sound(p,time,offset))});playChord(step,at);updateBeatUI();updateComposerPlayhead()}timer=setTimeout(tick,15)}
async function togglePlay(){if(playing){playing=false;clearTimeout(timer);stopWave();pauseAiSong();if(context&&context.state==='running')await context.suspend();render();return}try{context ||= new(window.AudioContext||window.webkitAudioContext)();await context.resume();await loadSamples();preloadAnimationFrames();playing=true;loop=0;beat=-1;startTime=performance.now();startAiSong();render();setStudioHint('Tap a glowing square to change when a pet plays');startWave();tick()}catch(e){notify('Audio could not start. Try again after a click.')}}
function notify(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2300)}
function drawScene(){const c=$('#landscape'),x=c.getContext('2d'),scene=$('#sceneSelect').value;x.imageSmoothingEnabled=false;const rect=(a,b,w,h,col)=>{x.fillStyle=col;x.fillRect(a,b,w,h)};const line=(a,b,cx,dy,col)=>{x.strokeStyle=col;x.lineWidth=2;x.beginPath();x.moveTo(a,b);x.lineTo(cx,dy);x.stroke()};if(scene==='cozy'){rect(0,0,640,340,'#21183d');for(let i=0;i<42;i++)rect(i*31%640,i*53%220,2,2,'#ffe16a');rect(65,35,510,213,'#422758');rect(79,47,482,185,'#ab4e91');rect(90,55,460,172,'#301c50');for(let i=0;i<6;i++){rect(112+i*78,249,8,58,'#ef90d6');rect(110+i*78,241,12,12,'#ffe16a')}rect(78,298,486,13,'#dd79d4');rect(116,311,8,24,'#77529b');rect(512,311,8,24,'#77529b');rect(25,215,75,82,'#392656');rect(37,227,51,44,'#60bfd1');rect(548,209,68,87,'#392656');rect(560,221,44,51,'#d878ca');rect(0,335,640,5,'#f59ad7');return}const colors=['#302d53','#464064','#635477','#a46f7b','#d79a84','#efbf96'];let g=x.createLinearGradient(0,0,0,280);g.addColorStop(0,'#423c68');g.addColorStop(.48,'#aa7181');g.addColorStop(1,'#e5a67f');x.fillStyle=g;x.fillRect(0,0,640,340);for(let i=0;i<140;i++){const a=(i*97)%640,b=(i*47)%175;if(i%4===0)rect(a,b,2,2,'#ffe4bf');}x.fillStyle='#f7c789';x.beginPath();x.arc(479,111,46,0,Math.PI*2);x.fill();x.fillStyle='#f5c89930';x.beginPath();x.arc(479,111,65,0,Math.PI*2);x.fill();
 // distant pixel headland
 rect(0,182,640,40,'#73637d');for(let i=0;i<40;i++)rect(i*17,178+(i*19%18),15,35,'#73637d');rect(0,215,640,49,'#748695');for(let i=0;i<30;i++)rect(i*23,222+(i%3)*13,9+(i%4)*3,2,'#f6dfbc');rect(0,264,640,76,'#dfb27f');rect(0,263,640,4,'#f4d3a3');for(let i=0;i<18;i++){const a=i*39%640,b=278+i*17%53;rect(a,b,6,2,'#ba8e78');}
 // path, grass and stepping stones
 rect(0,293,640,47,'#e8c8ad');for(let i=0;i<35;i++){const a=i*53%640,b=282+i*29%58;rect(a,b,3,3,'#90a38d');rect(a+3,b-3,2,4,'#90a38d')}for(let i=0;i<5;i++){const a=25+i*132;rect(a,311,46,9,'#aab5aa');rect(a+6,308,34,3,'#cad0b8');rect(a+14,313,20,2,'#f7e0bb')}
 // park lamps
 for(const a of [75,560]){rect(a,178,3,81,'#594c67');rect(a-6,254,16,4,'#594c67');rect(a-7,167,17,13,'#594c67');rect(a-4,169,11,8,'#f6d7a0');rect(a-2,170,7,6,'#fff0c8')}
 // blocky seaside shrubs
 for(const [a,b] of [[20,224],[107,229],[207,218],[405,224],[510,228],[604,219]]){for(let j=0;j<8;j++){const xx=a+(j*13%33),yy=b+(j*17%22);rect(xx,yy,12,9,['#657c75','#81947c','#9aa087'][j%3])}}
 // umbrella and blanket on sand
 rect(131,252,3,42,'#62556c');rect(102,250,60,4,'#62556c');for(let i=0;i<6;i++)rect(104+i*10,238+Math.abs(2-i)*3,10,14,i%2?'#ebc3bf':'#f7dcc4');rect(457,299,71,14,'#b4839b');rect(460,302,64,8,'#e5b9bf');for(let i=0;i<5;i++)rect(463+i*13,303,7,6,i%2?'#df9a9c':'#f6d0bf');
 // skyline/clouds
 for(const [a,b] of [[12,58],[94,73],[184,42],[330,69]]){rect(a,b,43,7,'#e6b6a3');rect(a+8,b-6,19,8,'#e6b6a3');rect(a+24,b-4,12,6,'#e6b6a3');rect(a+6,b+7,31,4,'#ecc4aa')}if(scene==='sunset'){rect(0,213,640,51,'#607d70');for(let i=0;i<22;i++){const a=i*31;rect(a,203+(i*11%21),30,16,'#506d68');rect(a+8,197+(i*7%18),14,20,'#6b806d')}rect(0,260,640,80,'#c39873');rect(0,263,640,4,'#f1c493');for(let i=0;i<6;i++){rect(23+i*108,277,43,4,'#e7c598');rect(44+i*91,295,48,4,'#e7c598')}for(const a of [75,560]){rect(a,178,3,81,'#594c67');rect(a-5,166,13,14,'#ffe29b')}}
}
function loadBackground(){const image=$('#sceneArt'),canvas=$('#landscape'),scene=stageScenes[$('#sceneSelect').value]||sharedScenes[0];if(!scene)return;image.classList.remove('loaded');canvas.hidden=false;image.onload=()=>{image.classList.add('loaded');canvas.hidden=true};image.onerror=()=>{image.classList.remove('loaded');canvas.hidden=false};image.alt=`${scene.name} pixel music stage · ${scene.zh}`;$('#sceneLabel').textContent=`✦ ${scene.name.toUpperCase()}${scene.zh?` · ${scene.zh}`:''}`;image.src=scene.src;if(image.complete&&image.naturalWidth)image.onload()}
function applyTemplate(i){currentTemplate=i;const t=templates[i];songLength=1;phrasePage=0;$('#tempo').value=t.tempo;pets.forEach(p=>{p.steps=(t.steps[p.id]||[0,8]).slice();p.clipRepeats=1;p.notes={};p.muted=false});render();setStudioHint('Press Play together to hear this mood');notify(`${t.name} is ready · ${t.name}`)}
$('#play').addEventListener('click',togglePlay);$('#stop').addEventListener('click',async()=>{playing=false;clearTimeout(timer);stopWave();pauseAiSong();if(context?.state==='running')await context.suspend();loop=0;beat=-1;startTime=0;render();notify('Playback stopped')});
let suppressedPetClick=null;
function savePetPlacement(id,x,y){
 const scene=$('#sceneSelect').value, positions=WERStore.getStagePositions(scene);
 positions[id]={x,y};
 if(!WERStore.saveStagePositions(scene,positions))notify('Position could not be saved: browser storage is full');
}
const petDragSurface=$('#stagePets');
petDragSurface.addEventListener('dragstart',e=>e.preventDefault());
petDragSurface.addEventListener('contextmenu',e=>{if(e.target.closest('.stage-pet'))e.preventDefault()});
petDragSurface.addEventListener('pointerdown',e=>{
 const el=e.target.closest('.stage-pet');if(!el||e.button!==0||activeDrag)return;
 const stage=$('#stage').getBoundingClientRect();
 activeDrag={id:el.dataset.id,pointerId:e.pointerId,el,startX:e.clientX,startY:e.clientY,
 offsetX:e.clientX-stage.left-stage.width*parseFloat(el.style.left)/100,
 offsetY:e.clientY-stage.top-stage.height*parseFloat(el.style.top)/100,
 originalX:el.style.left,originalY:el.style.top,pointerType:e.pointerType,moved:false,ready:false};
 const drag=activeDrag;
 drag.holdTimer=setTimeout(()=>{
  if(activeDrag!==drag)return;
  drag.ready=true;el.classList.add('drag-ready');
  $('#stageState').textContent='● Drag to move · release to place';
 },320);
 petDragSurface.setPointerCapture(e.pointerId);
});
petDragSurface.addEventListener('pointermove',e=>{
 if(!activeDrag||e.pointerId!==activeDrag.pointerId)return;
 const d=activeDrag,distance=Math.hypot(e.clientX-d.startX,e.clientY-d.startY);
 if(!d.ready){
  if(d.pointerType==='mouse'&&distance>=6){clearTimeout(d.holdTimer);d.ready=true;}
  else {if(distance>10){clearTimeout(d.holdTimer);d.cancelled=true;}return;}
 }
 if(d.cancelled||distance<4&&!d.moved)return;
 e.preventDefault();d.moved=true;
 const stage=$('#stage').getBoundingClientRect(),el=d.el;
 el.classList.add('dragging');
 const hx=Math.min(49,el.offsetWidth/stage.width*50),hy=Math.min(49,el.offsetHeight/stage.height*50);
 const x=clamp((e.clientX-d.offsetX-stage.left)/stage.width*100,hx,100-hx);
 const y=clamp((e.clientY-d.offsetY-stage.top)/stage.height*100,hy,100-hy);
 el.style.left=x+'%';el.style.top=y+'%';
});
function finishPetDrag(e){
 if(!activeDrag||e.pointerId!==activeDrag.pointerId)return;
 const d=activeDrag;activeDrag=null;clearTimeout(d.holdTimer);
 d.el.classList.remove('dragging','drag-ready');
 if(petDragSurface.hasPointerCapture(e.pointerId))petDragSurface.releasePointerCapture(e.pointerId);
 if(e.type==='pointercancel'){d.el.style.left=d.originalX;d.el.style.top=d.originalY;}
 else if(d.moved){savePetPlacement(d.id,parseFloat(d.el.style.left),parseFloat(d.el.style.top));scheduleDraftSave();}
 if(d.moved||d.ready||d.cancelled){suppressedPetClick=d.id;setTimeout(()=>suppressedPetClick=null,350);}
 $('#stageState').textContent=playing?'● The little band is playing':'● Ready when you are';
}
petDragSurface.addEventListener('pointerup',finishPetDrag);
petDragSurface.addEventListener('pointercancel',finishPetDrag);
petDragSurface.addEventListener('lostpointercapture',e=>{if(activeDrag)finishPetDrag({...e,pointerId:e.pointerId,type:'pointercancel'})});
$('#stagePets').addEventListener('keydown',e=>{
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
 const el=e.target.closest('.stage-pet');if(!el)return;e.preventDefault();
 const step=e.shiftKey?5:2,x=clamp(parseFloat(el.style.left)+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),10,90),
 y=clamp(parseFloat(el.style.top)+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0),20,80);
 savePetPlacement(el.dataset.id,x,y);render();
});
$('#sceneTiles').addEventListener('click',e=>{const tile=e.target.closest('[data-scene-tile]');if(!tile||positioning)return;$('#sceneSelect').value=tile.dataset.sceneTile;$('#sceneSelect').dispatchEvent(new Event('change'))});$('#railAddScene').addEventListener('click',()=>$('#addScene').click());
$('#sceneSelect').addEventListener('change',e=>{$('#stage').dataset.scene=e.target.value;WERStore.saveSelectedScene(e.target.value);drawScene();loadBackground();render();renderSceneOptions(e.target.value);notify(`${e.target.selectedOptions[0].text}`)});
$('#addScene').addEventListener('click',()=>{$('#removeScene').hidden=!personalScenes.some(scene=>scene.id===$('#sceneSelect').value);$('#sceneDialog').showModal()});
$('#closeScene').addEventListener('click',()=>$('#sceneDialog').close());
$('#sceneForm').addEventListener('submit',async e=>{e.preventDefault();const file=$('#sceneFile').files?.[0],name=$('#sceneName').value.trim(),zh=$('#sceneZh').value.trim();if(!file||!name)return;if(!['image/png','image/jpeg'].includes(file.type)){notify('Choose a PNG or JPGPNGJPG');return}if(file.size>2*1024*1024){notify('Image must be under 2 MB');return}try{const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)});const scene={id:`personal-${Date.now()}`,name,zh,src,shared:false};if(!WERStore.saveScene(scene)){notify('Browser storage is full');return}personalScenes.push(scene);stageScenes[scene.id]=scene;renderSceneOptions(scene.id);WERStore.saveSelectedScene(scene.id);$('#stage').dataset.scene=scene.id;drawScene();loadBackground();$('#sceneForm').reset();$('#sceneDialog').close();notify('Scene added on this device')}catch{notify('Image could not be read')}});
$('#removeScene').addEventListener('click',()=>{const id=$('#sceneSelect').value;if(!personalScenes.some(scene=>scene.id===id))return;if(!WERStore.removeScene(id)){notify('Could not remove scene');return}personalScenes.splice(personalScenes.findIndex(scene=>scene.id===id),1);delete stageScenes[id];renderSceneOptions(sharedScenes[0]?.id);WERStore.saveSelectedScene($('#sceneSelect').value);$('#stage').dataset.scene=$('#sceneSelect').value;drawScene();loadBackground();$('#sceneDialog').close();notify('Personal scene removed')});
$('#saveSong').addEventListener('click',()=>{$('#songName').value=currentTemplate===-1?'':'Sunset session';$('#saveDialog').showModal();$('#songName').focus()});
$('#saveForm').addEventListener('submit',event=>{
 event.preventDefault();const name=$('#songName').value.trim();if(!name)return;
 const song={id:incomingSong||`song-${Date.now()}`,name,savedAt:new Date().toISOString(),...captureSession()};
 if(WERStore.saveSong(song)){clearTimeout(draftTimer);draftTimer=null;if(!incomingSong)WERStore.clearDraft();$('#draftResume').hidden=true;$('#localSaveStatus').textContent='Saved in this browser';notify('Saved to My Collection');$('#saveDialog').close()}
 else $('#localSaveStatus').textContent='Browser storage is full';
});
$('#restart').addEventListener('click',()=>{if(playing){startTime=performance.now();startAiSong();loop=0;beat=-1;notify('Back to the first beat')}else{beat=-1;render()}});
$('#tempo').addEventListener('change',e=>{e.target.value=Math.min(160,Math.max(60,Number(e.target.value)||92));updateTimeDisplay()});
function removeFromStage(id){
 if(pets.length<=1||positioning)return;
 customBuffers.delete(id);customLevels.delete(id);animationFrames.delete(id);
 pets=pets.filter(p=>p.id!==id);
 if(selected===id)selected=pets[0].id;
 render();notify('Pet removed from this band');
}
$('#petCards').addEventListener('click',e=>{if(suppressBeatClick)return;const remove=e.target.closest('[data-remove]');if(remove){removeFromStage(remove.dataset.remove);return}const mute=e.target.closest('[data-mute]');if(mute){const p=pets.find(a=>a.id===mute.dataset.mute);p.muted=!p.muted;render();return}const step=e.target.closest('[data-track][data-step]');if(step){const p=pets.find(a=>a.id===step.dataset.track),i=Number(step.dataset.step);focusBeat=i;toggleClipStep(p,i);selected=p.id;render();setStudioHint('Lit squares start a call; empty squares stay quiet');if(effectiveSteps(p).includes(i))sound(p);return}const b=e.target.closest('[data-select]');if(b){selected=b.dataset.select;render()}});$('#stagePets').addEventListener('click',e=>{if(activeDrag?.moved)return;const b=e.target.closest('[data-id]');if(b&&suppressedPetClick===b.dataset.id)return;if(b){selected=b.dataset.id;render()}});
$('#rhythm').addEventListener('click',e=>{const b=e.target.closest('[data-step]');if(!b)return;const p=pets.find(a=>a.id===selected),i=Number(b.dataset.step);focusBeat=i;toggleClipStep(p,i);render();if(effectiveSteps(p).includes(i))sound(p)});
$('#soloBeat').addEventListener('click',()=>{const p=pets.find(a=>a.id===selected);if(!p)return;p.clipRepeats=1;p.steps=[focusBeat];p.notes=Object.fromEntries(Object.entries(p.notes||{}).filter(([step])=>Number(step)===focusBeat));p.muted=false;render();scheduleDraftSave();setStudioHint(`${p.name} plays only on beat ${focusBeat+1}; the sound fades naturally · ${p.name}${focusBeat+1}`)});
$('#solfegeKeys').addEventListener('click',async event=>{
 const key=event.target.closest('[data-solfege-row]');if(!key)return;
 const p=pets.find(item=>item.id===selected),row=Number(key.dataset.solfegeRow);if(!p)return;
 if((p.clipRepeats||1)>1){const period=clipPatternSteps(p),steps=effectiveSteps(p),notes={};for(const step of steps){const prior=p.notes?.[step%period];if(Number.isInteger(prior))notes[step]=prior}p.clipRepeats=1;p.steps=steps;p.notes=notes}
 p.notes||={};p.notes[focusBeat]=row;if(!p.steps.includes(focusBeat))p.steps.push(focusBeat);p.steps.sort((a,b)=>a-b);p.muted=false;
 render();scheduleDraftSave();setStudioHint(`${p.name} sings ${solfegeForRow[row]} on beat ${focusBeat+1} · ${p.name}${focusBeat+1}${solfegeForRow[row]}`);
 try{context ||= new(window.AudioContext||window.webkitAudioContext)();await context.resume();await loadSamples();sound(p,0,noteOffset(row,p))}catch{notify('Could not preview this note')}
});
$('#volume').addEventListener('input',e=>{const p=pets.find(a=>a.id===selected);p.volume=Number(e.target.value);$('#volumeValue').textContent=`${p.volume}%`});$('#toneStrength').addEventListener('input',e=>{const p=pets.find(a=>a.id===selected);p.strength=Number(e.target.value);$('#toneStrengthValue').textContent=`${p.strength}%`});$('#echo').addEventListener('input',e=>{const p=pets.find(a=>a.id===selected);p.echo=Number(e.target.value);$('#echoValue').textContent=`${p.echo}%`});$('#pitch').addEventListener('input',e=>{const p=pets.find(a=>a.id===selected);p.pitch=Number(e.target.value);$('#pitchValue').textContent=`${p.pitch>0?'+':''}${p.pitch} st`});$('#repeat').addEventListener('change',e=>{pets.find(a=>a.id===selected).repeat=e.target.value});$('#voice').addEventListener('change',async e=>{const pet=pets.find(a=>a.id===selected);pet.tone=e.target.value;pet.source='voice';pet.clipStart=0;pet.clipEnd=pet.tone==='sample'&&pet.asset==='samoyed'?.36:1;render();if(pet.tone==='sample'||pet.tone==='meow'){context ||= new(window.AudioContext||window.webkitAudioContext)();await context.resume();await loadSamples()}sound(pet)});
$('#soundTab').addEventListener('click',()=>{document.querySelector('.sound-panel').hidden=false;document.querySelector('.effect-panel').hidden=true;$('#soundTab').classList.add('active');$('#effectTab').classList.remove('active')});$('#effectTab').addEventListener('click',()=>{document.querySelector('.sound-panel').hidden=true;document.querySelector('.effect-panel').hidden=false;$('#effectTab').classList.add('active');$('#soundTab').classList.remove('active')});$('#sourceRecord').addEventListener('click',async()=>{
 if(recording){
  if(recording.recorder.state==='recording')recording.recorder.stop();
  return;
 }
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){notify('Recording is unavailable in this browser');return}
 const button=$('#sourceRecord'),petId=selected;
 let stream;
 button.disabled=true;
 try{
  context ||= new(window.AudioContext||window.webkitAudioContext)();
  context.resume().catch(()=>{});
  stream=await navigator.mediaDevices.getUserMedia({audio:true});
  const mimeType=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus']
   .find(type=>MediaRecorder.isTypeSupported?.(type));
  const recorder=mimeType?new MediaRecorder(stream,{mimeType}):new MediaRecorder(stream);
  const chunks=[],session={petId,stream,recorder,chunks,timer:null};
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  recorder.onerror=()=>{session.failed=true};
  recorder.onstop=async()=>{
   button.disabled=true;
   clearTimeout(session.timer);
   stream.getTracks().forEach(track=>track.stop());
   let failure;
   try{
    if(session.failed)throw new Error('Recording was interrupted. Try again or upload a WAV.');
    if(!chunks.length)throw new Error('No audio was captured. Check the microphone and record again.');
    const blob=new Blob(chunks,{type:chunks[0].type||recorder.mimeType});
    const bytes=await blob.arrayBuffer();
    const buffer=await context.decodeAudioData(bytes).catch(()=>{
     throw new Error('This browser could not decode the recording. Try another browser or upload a WAV.');
    });
    const pet=pets.find(p=>p.id===petId);
    if(!pet)return;
    useCustomVoice(pet,buffer,'Recorded call',true);
    if(context.state==='running')sound(pet);
    notify('Recording is now this pet’s beat-aligned track');
   }catch(error){failure=error.message;notify(failure)}
   finally{
    recording=null;
    button.disabled=false;
    render();
    if(failure&&selected===petId)$('#voiceStatus').textContent=failure;
   }
  };
  recorder.start();
  recording=session;
  session.timer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop()},12000);
  render();notify('Recording for up to 12 seconds. The strongest 3 seconds are kept if needed.');
 }catch(error){
  stream?.getTracks().forEach(track=>track.stop());
  notify(error.name==='NotAllowedError'?'Allow microphone access to record':
   error.name==='NotFoundError'?'No microphone found. Check your input device.':'Could not start the microphone. Check your device or upload a WAV.');
 }finally{button.disabled=false}
});
$('#sourceUpload').addEventListener('click',()=>$('#voiceUpload').click());$('#sourceSynth').addEventListener('click',async()=>{const p=pets.find(a=>a.id===selected);p.source='voice';render();context ||= new(window.AudioContext||window.webkitAudioContext)();await context.resume();await loadSamples();sound(p)});
$('#importVoice').addEventListener('click',()=>$('#voiceUpload').click());
$('#voiceUpload').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;const pet=pets.find(a=>a.id===selected);$('#voiceStatus').textContent='Converting your pet voice on this device…';try{if(file.size>16*1024*1024)throw new Error('Please choose an audio file under 16 MB.MB');context ||= new(window.AudioContext||window.webkitAudioContext)();await context.resume();const buffer=await context.decodeAudioData(await file.arrayBuffer());if(buffer.duration>12)throw new Error('Please choose a clip under 12 seconds.');useCustomVoice(pet,buffer,file.name.replace(/\.[^.]+$/,'').slice(0,28)||'My pet voice');render();sound(pet);notify('Your pet voice is now a beat-aligned track')}catch(error){$('#voiceStatus').textContent='Try a short WAV, MP3 or M4A recordingWAV、MP3M4A';notify(error.message||'This browser could not read that audio')}finally{e.target.value=''}});
$('#preview').addEventListener('click',async()=>{context ||= new(window.AudioContext||window.webkitAudioContext)();await context.resume();await loadSamples();render();sound(pets.find(a=>a.id===selected))});
$('#pitch').addEventListener('change',async()=>{
 const pet=pets.find(item=>item.id===selected);
 context ||= new(window.AudioContext||window.webkitAudioContext)();
 await context.resume();await loadSamples();sound(pet);
 setStudioHint(`Pitch ${pet.pitch>0?'+':''}${pet.pitch} st`);
});
$('#mute').addEventListener('click',()=>{const p=pets.find(a=>a.id===selected);p.muted=!p.muted;render()});$('#remove').addEventListener('click',()=>removeFromStage(selected));
$('#add').addEventListener('click',()=>{if(pets.length<6)$('#picker').showModal()});$('#closePicker').addEventListener('click',()=>$('#picker').close());$('#choices').addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(!b)return;const base=petTypes.find(p=>p.id===b.dataset.add);pets.push({...base,volume:50,pitch:0,tone:base.audioData?'custom':'signature',strength:70,echo:0,repeat:'loop',muted:false,steps:[0,8]});selected=base.id;$('#picker').close();render()});
$('#random').addEventListener('click',()=>{
 if(!window.confirm('Replace this arrangement? This changes every pet’s rhythm, pitch and volume, and the song tempo. Save your current music first if you want to keep it.'))return;
 currentTemplate=Math.floor(Math.random()*templates.length);
 const t=templates[currentTemplate];
 $('#tempo').value=t.tempo;
 pets.forEach(p=>{
  p.muted=false;
  p.volume=38+Math.floor(Math.random()*23);
  p.pitch=randomScalePitch(p);
  p.repeat='loop';
  p.clipRepeats=1;
  p.notes={};
  p.steps=Array.from({length:stepCount()},(_,i)=>i).filter(()=>Math.random()<.3);
  if(!p.steps.length)p.steps=[Math.floor(Math.random()*stepCount())];
 });
 render();
 setStudioHint('Pitches use one scale and share a beat');
 notify('A new arrangement is ready');
});
$('#help').addEventListener('click',()=>$('#guide').showModal());$('#closeHelp').addEventListener('click',()=>$('#guide').close());document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','BUTTON','SELECT'].includes(document.activeElement.tagName)&&document.body.dataset.studioView==='manual'&&!$('#picker').open&&!$('#guide').open){e.preventDefault();togglePlay()}});
$('#stage').dataset.scene=$('#sceneSelect').value;drawScene();loadBackground();renderSceneOptions($('#sceneSelect').value);render();drawWave();loadSamples().then(()=>render()).catch(()=>{});

// Beginner and advanced share the same stage and playback state.
function setStudioMode(mode){
 const advanced=mode==='advanced';
 document.body.classList.toggle('advanced-mode',advanced);
 document.querySelectorAll('[data-studio-mode]').forEach(button=>{
  const active=button.dataset.studioMode===mode;
  button.classList.toggle('active',active);
  button.setAttribute('aria-pressed',String(active));
 });
 WERStore.saveStudioMode(mode);
}
$('#christmasTemplate').addEventListener('click',()=>{
 for(const id of ['cat','ghost-cat','bat-cat'])if(!pets.some(p=>p.id===id)&&pets.length<6){
  const starter=petTypes.find(p=>p.id===id);
  pets.push({...starter,volume:60,pitch:0,tone:'sample',clipStart:0,clipEnd:1,strength:70,echo:0,repeat:'loop',muted:false,steps:[]});
 }
 const [cat,dog,samoyed]=['cat','ghost-cat','bat-cat'].map(id=>pets.find(p=>p.id===id));
 if(!cat||!dog||!samoyed){notify('Make room for the three starter pets');return}
 pauseAiSong();aiSongData='';$('#aiSongEditor').hidden=true;
 songLength=2;meter='4/4';musicKey='C';phrasePage=0;composerMode='melody';chordEnabled=false;currentTemplate=-1;
 $('#tempo').value='140';
 const melody=[[0,5],[1,5],[2,5],[4,5],[5,5],[6,5],[8,5],[9,3],[10,7],[11,6],[12,5],[16,5],[17,5],[18,5],[20,5],[21,5],[22,5],[24,5],[25,3],[26,7],[27,6],[28,5]];
 for(const p of pets)p.muted=![cat,dog,samoyed].includes(p);
 const notes=Object.fromEntries(melody),steps=melody.map(([step])=>step);
 Object.assign(cat,{source:'voice',tone:'sample',volume:70,pitch:0,strength:78,echo:8,clipStart:0,clipEnd:1,clipRepeats:1,steps,notes:{...notes},repeat:'loop'});
 Object.assign(dog,{source:'voice',tone:'sample',volume:48,pitch:-12,strength:70,echo:5,clipStart:0,clipEnd:1,clipRepeats:1,steps:[...steps],notes:{...notes},repeat:'loop'});
 Object.assign(samoyed,{source:'voice',tone:'sample',volume:44,pitch:12,strength:70,echo:10,clipStart:0,clipEnd:1,clipRepeats:1,steps:[...steps],notes:{...notes},repeat:'loop'});
 selected=cat.id;setStudioMode('advanced');
 if(playing){startTime=performance.now();loop=0;beat=-1}
 render();scheduleDraftSave();
 setStudioHint('Jingle Bells: cat sings “mi mi mi”; both dogs join in harmony');
 notify('Jingle Bells pet choir is ready');
});
document.querySelectorAll('[data-studio-mode]').forEach(button=>button.addEventListener('click',()=>setStudioMode(button.dataset.studioMode)));
setStudioMode('advanced');
document.querySelector('#masterVolume').addEventListener('input',e=>{
 const level=Number(e.target.value)/100;
 document.querySelector('#masterVolumeValue').textContent=`${e.target.value}%`;
 if(masterGain&&context)masterGain.gain.setTargetAtTime(level,context.currentTime,.01);
});

document.querySelector('#loopPlayback').addEventListener('change',e=>{
 loopPlayback=e.target.checked;
 notify(loopPlayback?'Loop on':'Play once');
});
let pendingAiSample=null;
document.querySelector('#generateAiSample').addEventListener('click',async()=>{
 const button=document.querySelector('#generateAiSample'),status=document.querySelector('#aiSampleStatus');
 const useButton=document.querySelector('#useAiSample');
 const idea=document.querySelector('#aiSoundPrompt').value.trim();
 const speech=document.querySelector('#aiSampleType').value==='speech';
 if(!idea){status.textContent='Describe a sound first';return}
 pendingAiSample=null;useButton.hidden=true;
 button.disabled=true;status.textContent='Generating a short sample……';
 try{
  const response=await fetch(speech?'/api/generate-speech':'/api/generate-sample',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:idea})});
  if(!response.ok)throw new Error(response.status===503?'API key is not configured · API':'Generation unavailable');
  context ||= new(window.AudioContext||window.webkitAudioContext)();
  await context.resume();
  const buffer=await context.decodeAudioData(await response.arrayBuffer());
  if(buffer.duration>12)throw new Error('Keep speech under 12 seconds');
  pendingAiSample=buffer;
  const preview=context.createBufferSource();preview.buffer=buffer;preview.connect(context.destination);preview.start();
  useButton.hidden=false;
  status.textContent='Preview ready';
 }catch(error){status.textContent=error.message||'Generation unavailable'}
 finally{button.disabled=false}
});
document.querySelector('#useAiSample').addEventListener('click',()=>{
 if(!pendingAiSample)return;
 const pet=pets.find(item=>item.id===selected);
 try{useCustomVoice(pet,pendingAiSample,'AI sound sample');pendingAiSample=null;document.querySelector('#useAiSample').hidden=true;render();sound(pet);document.querySelector('#aiSampleStatus').textContent='Sample added to the selected pet'}
 catch(error){document.querySelector('#aiSampleStatus').textContent=error.message}
});
$('#generateAiSong').addEventListener('click',async()=>{
 const idea=$('#aiSongPrompt').value.trim(),button=$('#generateAiSong'),status=$('#aiSongStatus');
 if(idea.length<8){status.textContent='Describe the song in a little more detail';return}
 button.disabled=true;status.textContent='Composing a full song……';
 try{
  const response=await fetch('/api/generate-song',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:idea,duration_ms:Number($('#aiSongDuration').value),instrumental:$('#aiSongInstrumental').checked})});
  if(!response.ok)throw new Error(response.status===503?'API key is not configured · API':'Song generation unavailable');
  const blob=await response.blob();
  aiSongData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});
  pauseAiSong();aiSongRange={start:0,end:0};aiSongVolume=70;showAiSong();
  scheduleDraftSave();
  status.textContent='Song ready';
 }catch(error){status.textContent=error.message||'Song generation unavailable'}
 finally{button.disabled=false}
});
for(const id of ['aiSongStart','aiSongEnd'])$('#'+id).addEventListener('input',()=>{updateAiSongRange();$('#aiSongAudio').currentTime=aiSongRange.start;renderSongWave()});
$('#aiSongVolume').addEventListener('input',e=>{aiSongVolume=Number(e.target.value);$('#aiSongAudio').volume=aiSongVolume/100;$('#aiSongVolumeValue').textContent=`${aiSongVolume}%`});
let aiSongFadeFrame=0;
function updateAiSongFade(){
 const audio=$('#aiSongAudio');if(audio.paused){aiSongFadeFrame=0;audio.volume=aiSongVolume/100;return}
 const remaining=aiSongRange.end-audio.currentTime;
 if(aiSongRange.end&&remaining<=0){if(playing&&loopPlayback){audio.currentTime=aiSongRange.start;audio.volume=aiSongVolume/100}else{audio.pause();return}}
 else audio.volume=aiSongVolume/100*Math.max(0,Math.min(1,remaining/.09));
 aiSongFadeFrame=requestAnimationFrame(updateAiSongFade);
}
$('#aiSongAudio').addEventListener('play',()=>{if(!aiSongFadeFrame)aiSongFadeFrame=requestAnimationFrame(updateAiSongFade)});
$('#aiSongAudio').addEventListener('pause',()=>{if(aiSongFadeFrame)cancelAnimationFrame(aiSongFadeFrame);aiSongFadeFrame=0;$('#aiSongAudio').volume=aiSongVolume/100});
let draftTimer=null;
function saveDraftNow(){
 if(incomingSong)return;
 clearTimeout(draftTimer);draftTimer=null;
 const saved=WERStore.saveDraft({...captureSession(),updatedAt:new Date().toISOString()});
 $('#localSaveStatus').textContent=saved?'Draft saved in this browser':'Browser storage is full';
 if(saved)$('#draftResume').hidden=true;
}
function scheduleDraftSave(){
 if(incomingSong)return;
 clearTimeout(draftTimer);
 $('#localSaveStatus').textContent='Saving draft on this device…';
 draftTimer=setTimeout(saveDraftNow,600);
}
if(!incomingSong&&WERStore.getDraft())$('#draftResume').hidden=false;
$('#resumeDraft').addEventListener('click',()=>{
 const draft=WERStore.getDraft();
 if(draft&&restoreSession(draft)){$('#stage').dataset.scene=$('#sceneSelect').value;drawScene();loadBackground();renderSceneOptions($('#sceneSelect').value);render();$('#draftResume').hidden=true;$('#localSaveStatus').textContent='Last session restored';notify('Last session restored');loadSamples().then(()=>render()).catch(()=>{})}
 else {$('#draftResume').hidden=true;$('#localSaveStatus').textContent='Draft could not be restored'}
});
$('#skipDraft').addEventListener('click',()=>{$('#draftResume').hidden=true;$('#localSaveStatus').textContent='New session'});
const editClicks='#generateMusic,#random,.template,#beginnerChords,[data-track][data-step],#rhythm [data-step],[data-remove],[data-mute],#remove,#mute,[data-add],[data-chord-slot],[data-note-step],[data-instrument],#sourceSynth,#positionToggle';
document.addEventListener('click',event=>{if(event.target.closest(editClicks))scheduleDraftSave()});
$('.workspace').addEventListener('input',event=>{if(event.target.matches('input,textarea,select'))scheduleDraftSave()});
$('.workspace').addEventListener('change',event=>{if(event.target.matches('input,textarea,select'))scheduleDraftSave()});
window.addEventListener('pagehide',()=>{if(draftTimer)saveDraftNow()});

$('#mixerPetSwitcher').addEventListener('click',e=>{const remove=e.target.closest('[data-remove]');if(remove){removeFromStage(remove.dataset.remove);return;}const b=e.target.closest('[data-mixer-pet]');if(b){selected=b.dataset.mixerPet;render();}});
