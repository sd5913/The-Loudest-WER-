/* A focused manual workflow; the same composition and audio engine remain in use. */
(() => {
 const q=s=>document.querySelector(s),mixer=q('.pet-mixer-body'),source=q('.sound-source'),composition=q('.sound-composition');
 const guide=document.createElement('nav');guide.className='creation-steps';guide.setAttribute('aria-label','Manual creation steps');
 guide.innerHTML='<a href="#chooseSound">1 <span>Choose a sound</span></a><a href="#makePattern">2 <span>Make a pattern</span></a><a href="#listenSave">3 <span>Listen & save</span></a>';
 // Step links scroll inside the manual view without changing the mode route.
 guide.querySelectorAll('a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();q(a.getAttribute('href')).scrollIntoView({behavior:'smooth',block:'start'})}));
 mixer.prepend(guide);source.id='chooseSound';composition.id='makePattern';q('.bottom-row').id='listenSave';
 const soundTitle=document.createElement('h2');soundTitle.className='step-title';soundTitle.textContent='1 · Choose a sound';source.querySelector('b').replaceWith(soundTitle);
 const voice=q('#voicePicker');source.querySelector('.source-actions').after(voice);
 const instrument=q('#instrumentPicker');source.append(instrument);
 const clipDetails=document.createElement('details');clipDetails.className='sound-details clip-details';
 clipDetails.innerHTML='<summary>Trim your sound</summary>';clipDetails.append(q('#clipEditor'));source.append(clipDetails);
 // Keep volume visible; additional sound controls are optional.
 const more=document.createElement('details');more.className='sound-details more-sound';more.innerHTML='<summary>More sound settings</summary>';
 for(const id of ['pitch','toneStrength'])more.append(q('#'+id).closest('.control'));
 const effect=q('.effect-panel');effect.hidden=false;more.append(effect);
 q('.sound-panel').append(more);q('.editor-tabs').hidden=true;
 composition.insertAdjacentHTML('afterbegin','<div class="pattern-heading"><h2>2 · Make a pattern</h2><p id="patternHint">Choose when your pet sounds.</p></div>');
 q('.band-section h3').childNodes[0].textContent='Pet rhythm ';
 const count=q('#petCount');count.hidden=true;
 const actions=document.createElement('div');actions.className='rhythm-actions';
 actions.innerHTML='<button type="button" class="soft" id="simpleBeat">Simple beat</button><button type="button" class="soft" id="clearBeat">Clear</button><button type="button" class="soft" id="previewBeat">Preview pet</button><button type="button" class="plain" id="allTracks" aria-expanded="false">View all tracks</button>';
 q('.band-section').append(actions);
 const loopControl=q('#repeat').closest('.control');loopControl.classList.add('rhythm-loop');
 loopControl.querySelector('label span').textContent='Track Loop';
 q('#repeat').innerHTML='<option value="once">1 time</option><option value="twice">2 times</option><option value="four">4 times</option><option value="loop">Keep looping</option><option value="alternate" hidden>Every other loop (saved)</option>';
 const loopHint=document.createElement('small');loopHint.id='petLoopHint';loopHint.setAttribute('aria-live','polite');loopControl.append(loopHint);
 composition.querySelector('.compose-tabs').before(loopControl);
 function updateLoopLabel(){
  const seconds=stepCount()*60/(Number(q('#tempo').value)||92);
  const format=n=>n<60?Math.round(n)+'s':Math.floor(n/60)+'m '+Math.round(n%60)+'s';
  for(const [value,count] of [['once',1],['twice',2],['four',4]])q('#repeat option[value="'+value+'"]').textContent=count+'× · about '+format(seconds*count);
  const p=pets.find(p=>p.id===selected);q('#repeat').value=p?.repeat||'loop';
  loopHint.textContent='Repeats this pet’s rhythm and melody together, from the start of playback.';
 }
 q('#repeat').addEventListener('change',()=>{if(q('#repeat').value!=='once'){loopPlayback=true;q('#loopPlayback').checked=true;}updateLoopLabel();scheduleDraftSave()});
 q('#tempo').addEventListener('change',updateLoopLabel);

 q('.track-help>span').textContent='Lit squares make a sound. Empty squares stay quiet.';
 q('#soloBeat').hidden=true;
 q('.track-head>span').textContent='CURRENT PET';
 q('#allTracks').addEventListener('click',()=>{const all=q('.band-section').classList.toggle('show-all-tracks');q('#allTracks').textContent=all?'Show current pet':'View all tracks';q('#allTracks').setAttribute('aria-expanded',String(all))});
 function setPattern(clear){const p=pets.find(p=>p.id===selected);if(!p)return;p.clipRepeats=1;p.steps=clear?[]:Array.from({length:stepCount()/4},(_,i)=>i*4);p.notes={};p.muted=false;focusBeat=0;render();scheduleDraftSave()}
 q('#simpleBeat').addEventListener('click',()=>setPattern(false));q('#clearBeat').addEventListener('click',()=>setPattern(true));
 q('#previewBeat').addEventListener('click',()=>{const p=pets.find(p=>p.id===selected);if(p)sound(p)});
 const saveTitle=document.createElement('h2');saveTitle.className='step-title';saveTitle.textContent='3 · Listen & save';q('.bottom-row>p').replaceWith(saveTitle);
 const collection=document.createElement('a');collection.href='collection.html';collection.className='plain';collection.textContent='My Collection →';q('.save-cluster').append(collection);
 q('#localSaveStatus').textContent='Saves stay in this browser';
 const listen=document.createElement('button');listen.type='button';listen.id='listenTogether';listen.className='primary';listen.textContent='Play together';listen.addEventListener('click',()=>q('#play').click());q('.save-cluster').prepend(listen);
 const hints={rhythm:'Choose when your pet sounds.',melody:'Choose the notes your pet sings.'};
 const renderBefore=render;
 render=function(){renderBefore();refreshSimple()};
 const composerBefore=renderComposer;
 renderComposer=function(){composerBefore();refreshSimple()};
 function refreshSimple(){updateLoopLabel();if(q('#listenTogether'))q('#listenTogether').textContent=playing?'Pause the band':'Play together';q('#melodyTitle').textContent='Melody · '+q('#petName').textContent;q('#patternHint').textContent=hints[composerMode];q('#solfegePanel').hidden=composerMode!=='melody';}
 q('#voiceUpload').addEventListener('change',()=>{clipDetails.open=true});
 q('#sourceRecord').addEventListener('click',()=>{clipDetails.open=true});
 q('#melodyTitle').textContent='Pet melody';
 refreshSimple();
})();
