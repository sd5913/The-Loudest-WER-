/* Presentation only: existing nodes and event handlers are retained. */
(() => {
 const q=s=>document.querySelector(s),body=q('.ai-creation-body');
 body.classList.add('ai-layout-body');
 const header=document.createElement('header');header.className='ai-layout-header';header.innerHTML='<div><p class="eyebrow">LITTLE VOICES / BIG LITTLE SOUNDS</p><h1>Music Studio</h1></div><div class="ai-mode-switch"><button type="button" class="active" aria-pressed="true">AI Generate</button><a href="#manual">Manual Compose</a></div>';
 const grid=document.createElement('div');grid.className='ai-create-grid';
 const left=document.createElement('section');left.className='ai-listen-column';left.innerHTML='<h2>Tap a pet. Hear its voice.</h2><p>Listen to a starter voice, then try your own recording.</p><div class="ai-demo-cards"></div><div class="ai-demo-player"><div><span id="layoutPreviewName">Your preview plays here</span></div><audio id="layoutPreviewAudio" controls preload="none"></audio><p class="ai-listen-note">Preview a voice above, or listen to the Jingle Bells choir below.</p></div>';
 const right=document.createElement('section');right.className='ai-input-column';right.innerHTML='<div class="ai-band-toggle"><button type="button" id="layoutCurrentPet">Selected pet</button><button type="button" id="layoutBand">Manage band</button></div><h2>Use your own pet voice</h2><div id="layoutUpload"></div><div class="ai-record-row"></div><p class="ai-preset-heading">No recording? Preview a starter voice.</p><div class="ai-preset-chips"></div><p class="ai-listen-note">To make a remix, record or upload a call for the selected pet. Starter voices remain available in Manual Compose.</p>';
 grid.append(left,right);body.prepend(header,grid);
 q('#aiTitle').hidden=true;q('#aiTitle').nextElementSibling.hidden=true;q('.ai-steps').hidden=true;q('.starter-voices').hidden=true;
 body.querySelectorAll(':scope > .eyebrow,:scope > .ai-step-heading').forEach(el=>el.hidden=true);
 const moveable=[];
 function borrow(node,host){const marker=document.createComment('manual control location');node.before(marker);moveable.push({node,marker,host})}
 const drop=q('#voiceDropZone');borrow(drop,q('#layoutUpload'));
 const record=q('#sourceRecord');borrow(record,right.querySelector('.ai-record-row'));
 const feedback=q('#voiceStatus');borrow(feedback,q('#layoutUpload'));
 const remix=q('#generateMeowRemix').closest('details');borrow(remix,right);remix.classList.add('ai-remix-tool');remix.open=true;
 const trim=q('#clipEditor').closest('details');borrow(trim,right);trim.classList.add('ai-extra-tools');
 const info=document.createElement('p');info.className='ai-source-note';info.textContent='Remix uses the selected pet’s recording. ElevenLabs music generation is available separately below.';right.append(info);
 const performers=q('.ai-performers');const manage=document.createElement('details');manage.className='ai-performer-details';manage.innerHTML='<summary>Performers & sound sources</summary>';manage.append(performers);right.append(manage);
 right.querySelector('.ai-record-row').append(q('#aiAddPet'));
 q('#aiRecordPet').hidden=true;q('#aiUploadPet').hidden=true;
 q('#layoutCurrentPet').onclick=()=>{manage.open=true;manage.scrollIntoView({behavior:'smooth',block:'nearest'})};q('#layoutBand').onclick=q('#layoutCurrentPet').onclick;
 const tabs=q('.ai-task-tabs');tabs.hidden=true;
 const eleven=document.createElement('section');eleven.className='layout-eleven';eleven.innerHTML='<h2>ElevenLabs generation</h2><p>Generate music from a description, or create a new sound for a pet.</p><div class="ai-task-tabs" role="group" aria-label="ElevenLabs creation type"><button type="button" data-layout-task="song">Backing music</button><button type="button" data-layout-task="sample">Pet sound</button></div>';
 right.append(eleven);eleven.append(q('#aiSongDestination'),q('#aiSampleDestination'));
 function task(which){tabs.querySelector('[data-ai-task="'+which+'"]').click();eleven.querySelectorAll('[data-layout-task]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layoutTask===which)))}
 eleven.addEventListener('click',e=>{const b=e.target.closest('[data-layout-task]');if(b)task(b.dataset.layoutTask)});task('song');
 left.append(q('.ai-example'));q('.ai-example h2').textContent='Hear a finished pet choir';
 const result=document.createElement('section');result.className='ai-performance-result';result.innerHTML='<div class="ai-result-heading"><h2>Your pet performance</h2><p>Choose a scene, move your pets, then listen and save.</p></div>';q('.ai-stage-host').before(result);result.append(q('.ai-stage-host'),q('.ai-result-actions'),q('.ai-next'));
 const starters=[
  {name:'Gray Cat',asset:'gray-cat',file:'starter-cat.mp3'},
  {name:'Dachshund',asset:'dachshund',file:'starter-dachshund.mp3'},
  {name:'Samoyed',asset:'samoyed',file:'starter-samoyed.mp3'}
 ];
 const demos=[
  {...starters[0],file:'preview-gray-cat.wav',scene:'stage-neon-night.png'},
  {...starters[1],file:'preview-dachshund.wav',scene:'stage-sunny-park.png'},
  {name:'White Cat',asset:'white-cat-christmas',file:'preview-white-cat.wav',scene:'stage-seaside.png'},
  {name:'Bunny synth',asset:'bunny',file:'bunny-call.wav',scene:'stage-sunny-park.png'}
 ];
 const examples=[...demos,...starters];
 left.querySelector('.ai-demo-cards').innerHTML=demos.map((p,i)=>`<button type="button" class="ai-demo-card" data-layout-preview="${i}" aria-label="Preview ${p.name}" style="--demo-scene:url('assets/backgrounds/${p.scene}')"><img src="assets/pets/${p.asset}.png" alt=""><span><b>${p.name}</b><small>${i===3?'Synthesized voice':'Starter call'}</small></span><i aria-hidden="true">▶</i></button>`).join('');
 right.querySelector('.ai-preset-chips').innerHTML=starters.map((p,i)=>`<button type="button" data-layout-preview="${demos.length+i}"><img src="assets/pets/${p.asset}.png" alt=""><span>${p.name}</span><i>▶</i></button>`).join('');
 const audio=q('#layoutPreviewAudio');
 body.addEventListener('click',e=>{const b=e.target.closest('[data-layout-preview]');if(!b)return;const example=examples[Number(b.dataset.layoutPreview)];if(playing)q('#stop').click();pauseAiSong();if(q('#aiExamplePlay').textContent.includes('Stop'))q('#aiExamplePlay').click();audio.src='assets/sounds/'+example.file;q('#layoutPreviewName').textContent=example.name;audio.play().catch(()=>notify('Could not play this preview. Try again.'))});
 q('#aiExamplePlay').addEventListener('click',()=>audio.pause());q('#play').addEventListener('click',()=>audio.pause());q('#playMeowRemix').addEventListener('click',()=>audio.pause());
 function route(){const ai=document.body.dataset.studioView==='ai';for(const {node,marker,host} of moveable){if(ai)host.append(node);else marker.after(node)}audio.pause()}
 window.addEventListener('hashchange',route);window.addEventListener('pagehide',()=>audio.pause());route();
})();
