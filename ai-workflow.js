/* AI creation uses the same stage, session and exports as manual composition. */
(() => {
 const q=s=>document.querySelector(s),body=q('.ai-creation-body');
 q('#aiTitle').nextElementSibling.textContent='Choose your pixel performers, give them a voice, then listen to the whole stage together.';
 q('.ai-steps').innerHTML='<li><b>01</b><span>Choose pets & voices</span></li><li><b>02</b><span>Create music</span></li><li><b>03</b><span>Listen & save</span></li>';
 const demo=document.createElement('section');demo.className='ai-example';demo.innerHTML='<div><h2>Hear a little pet choir</h2><p>Jingle Bells · Gray Cat, Dachshund & Samoyed</p></div><button type="button" class="soft" id="aiExamplePlay">▶ Listen to example</button><small>Separate from your current composition.</small>';
 q('.ai-steps').before(demo);
 let demoContext,demoNodes=[];
 q('#aiExamplePlay').onclick=async()=>{
  if(demoContext){await demoContext.close();demoContext=null;demoNodes=[];q('#aiExamplePlay').textContent='▶ Listen to example';return}
  try{
   const ctx=new(window.AudioContext||window.webkitAudioContext)();demoContext=ctx;await ctx.resume();
   q('#aiExamplePlay').textContent='■ Stop example';
   const files=['starter-cat.mp3','starter-dachshund.mp3','starter-samoyed.mp3'];
   const buffers=await Promise.all(files.map(async f=>ctx.decodeAudioData(await(await fetch('assets/sounds/'+f)).arrayBuffer())));
   if(demoContext!==ctx)return;
   const notes=[4,4,4,null,4,4,4,null,4,7,0,2,4],start=ctx.currentTime+.1;
   buffers.forEach((buffer,i)=>notes.forEach((note,n)=>{if(note===null)return;const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.playbackRate.value=2**((note+(i===1?-12:i===2?12:0))/12);gain.gain.value=i===0?.28:.12;source.connect(gain).connect(ctx.destination);source.start(start+n*.38,0,Math.min(buffer.duration,.32));demoNodes.push(source)}));
   setTimeout(()=>{if(demoContext===ctx)q('#aiExamplePlay').click()},6500);
  }catch{if(demoContext)await demoContext.close();demoContext=null;q('#aiExamplePlay').textContent='▶ Listen to example';notify('Example could not play. Please try again.')}
 };
 const headings=body.querySelectorAll('.ai-step-heading');headings[0].innerHTML='<span>01</span> Choose pets & voices';headings[1].innerHTML='<span>02</span> Create music';headings[2].innerHTML='<span>03</span> Listen & save';
 const petsPanel=document.createElement('section');petsPanel.className='ai-performers';petsPanel.innerHTML='<div class="ai-performer-heading"><p>Add up to six pets. Choose what each performer sounds like.</p><button class="soft" type="button" id="aiAddPet">＋ Add pet</button></div><div id="aiPerformerList"></div><p class="ai-source-note">Pet voice plays its rhythm track. AI music plays the generated full mix alongside the pets; it is shared music, not separate animal vocals.</p><div class="ai-input-actions"><button class="soft" type="button" id="aiRecordPet">● Record</button><button class="soft" type="button" id="aiUploadPet">Upload audio</button><button class="soft" type="button" id="aiUsePreset">Use existing pet voice</button></div><small>Select a pet, then record for up to 12 seconds. The strongest 3 seconds are kept if needed. For uploads, use WAV, MP3 or M4A under 16 MB with up to 3 seconds of audible sound.</small>';
 headings[0].after(petsPanel);
 const stage=q('.stage-window'),stageMarker=document.createComment('shared stage');stage.before(stageMarker);
 const stageHost=document.createElement('div');stageHost.className='ai-stage-host';headings[2].after(stageHost);
 const bottom=q('.bottom-row'),bottomMarker=document.createComment('shared save');bottom.before(bottomMarker);
 const actionHost=document.createElement('div');actionHost.className='ai-result-actions';q('.ai-next').before(actionHost);
 q('.ai-next p').textContent='Save this performance, export audio or video, or continue to Manual Compose to edit rhythms and melodies.';
 const again=document.createElement('button');again.type='button';again.className='soft';again.textContent='Generate another version';again.onclick=()=>{if(confirm('Generate another version? Save this performance first if you want to keep the current music.'))q('#generateAiSong').click()};q('#aiSongEditor').append(again);
 q('#aiAddPet').onclick=()=>q('#add').click();
 q('#aiRecordPet').onclick=()=>q('#sourceRecord').click();q('#aiUploadPet').onclick=()=>q('#sourceUpload').click();
 q('#aiUsePreset').onclick=()=>{const p=pets.find(p=>p.id===selected);if(!p)return;p.aiPerformance='voice';p.source='voice';p.tone=p.customAudioData||p.audioData?'custom':p.sampleFile?'sample':'signature';render();scheduleDraftSave()};
 const voice=q('.voice-entry')||q('#voiceStatus');if(voice){const status=document.createElement('p');status.id='aiVoiceFeedback';status.setAttribute('role','status');petsPanel.append(status);new MutationObserver(()=>{if(status.textContent!==voice.textContent)status.textContent=voice.textContent}).observe(voice,{subtree:true,childList:true,characterData:true})}
 function update(){
  const list=q('#aiPerformerList');list.innerHTML=pets.map(p=>`<div class="ai-performer ${p.id===selected?'selected':''}"><button class="plain" data-ai-select="${html(p.id)}">${sprite(p)}<b>${html(p.name)}</b></button><label>Sound<select data-ai-source="${html(p.id)}"><option value="voice" ${p.aiPerformance!=='music'?'selected':''}>Pet voice / AI sound sample</option><option value="music" ${p.aiPerformance==='music'?'selected':''} ${!aiSongData?'disabled':''}>Generated AI music</option></select></label><button class="plain" data-ai-remove="${html(p.id)}" ${pets.length<=1?'disabled':''} aria-label="Remove ${html(p.name)} from this band">×</button></div>`).join('');
  const target=q('#aiTargetPet');target.innerHTML=pets.map(p=>`<option value="${html(p.id)}">${html(p.name)}</option>`).join('');target.value=selected;
  q('#aiAddPet').disabled=pets.length>=6;q('#aiRecordPet').textContent=recording?'■ Stop recording':'● Record';
 }
 petsPanel.addEventListener('click',e=>{const select=e.target.closest('[data-ai-select]'),remove=e.target.closest('[data-ai-remove]');if(select){selected=select.dataset.aiSelect;render()}if(remove)removeFromStage(remove.dataset.aiRemove)});
 petsPanel.addEventListener('change',e=>{if(!e.target.matches('[data-ai-source]'))return;const p=pets.find(p=>p.id===e.target.dataset.aiSource);p.aiPerformance=e.target.value;render();scheduleDraftSave()});
 function route(){const ai=document.body.dataset.studioView==='ai';if(ai){stageHost.append(stage);actionHost.append(bottom)}else{stageMarker.after(stage);bottomMarker.after(bottom)}if(demoContext)q('#aiExamplePlay').click();update()}
 new MutationObserver(update).observe(q('#mixerPetSwitcher'),{childList:true});
 new MutationObserver(update).observe(q('#aiSongEditor'),{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('hashchange',route);route();
})();
