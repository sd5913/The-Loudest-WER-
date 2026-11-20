/* Separate creation routes while keeping one shared, persistent composition. */
(() => {
 const entry=document.querySelector('#studioEntry'), ai=document.querySelector('#aiCreation');
 const sample=document.querySelector('[aria-label="AI pet sound sample · AI"]');
 const song=document.querySelector('.ai-song-panel');
 const sampleWrapper=sample.closest('details'),songWrapper=song.closest('details');
 document.querySelector('#aiSampleDestination').append(sample);
 document.querySelector('#aiSongDestination').append(song);
 sampleWrapper.remove();songWrapper.remove();
 document.querySelector('.creative-tools').remove();
 song.querySelector('b').textContent='AI Backing Song';
 song.querySelector('small').textContent='Eleven Music';
 sample.querySelector('.ai-badge').textContent='ElevenLabs';
 for(const panel of [sample,song]){const old=panel.querySelector('b'),heading=document.createElement('h2');heading.textContent=old.textContent;old.replaceWith(heading);}
 // Keep composition tools next to the sound they edit.
 const composition=document.createElement('section');
 composition.className='sound-composition';composition.setAttribute('aria-label','Music arrangement editor');
 const tabs=document.querySelector('.compose-tabs');
 composition.append(tabs,document.querySelector('.band-section'),document.querySelector('#melodyPanel'));
 document.querySelector('.sound-source').after(composition);
 const target=document.querySelector('#aiTargetPet');
 function updatePets(){
  target.replaceChildren(...pets.map(p=>{const option=document.createElement('option');option.value=p.id;option.textContent=p.name;return option}));
  target.value=selected;
 }
 target.addEventListener('change',()=>{selected=target.value;render()});
 function showTask(task){
  document.querySelector('#aiSampleDestination').hidden=task!=='sample';
  document.querySelector('#aiSongDestination').hidden=task!=='song';
  document.querySelectorAll('[data-ai-task]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.aiTask===task)));
 }
 function showView(){
  const route=location.hash.slice(1);
  const view=['ai','manual'].includes(route)?route:'choose';
  if(playing&&view!=='manual')togglePlay();
  if(view!=='ai')pauseAiSong();
  document.body.dataset.studioView=view;
  entry.hidden=view!=='choose';ai.hidden=view!=='ai';
  if(view==='manual'){setStudioMode('advanced');renderComposer()}
  if(view==='ai')updatePets();
  document.title=(view==='choose'?'Choose Your Mode':view==='ai'?'AI Generate':'Manual Compose')+' — The Loudest WER!';
  window.scrollTo({top:0,behavior:'instant'});
 }
 document.querySelectorAll('[data-flow]').forEach(b=>b.addEventListener('click',()=>{location.hash=b.dataset.flow==='choose'?'choose':b.dataset.flow}));
 document.querySelectorAll('[data-ai-task]').forEach(b=>b.addEventListener('click',()=>showTask(b.dataset.aiTask)));
 document.querySelector('#resumeDraft').addEventListener('click',()=>{location.hash='manual'});
 for(const event of ['input','change'])ai.addEventListener(event,e=>{if(e.target.matches('input,textarea,select'))scheduleDraftSave()});
 window.addEventListener('hashchange',showView);
 if(new URLSearchParams(location.search).has('song')&&!location.hash)history.replaceState(null,'','#manual');
 showView();
})();
