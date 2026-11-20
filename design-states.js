/* Repeatable local fixture-driven SVG export; not a real-user playtest. */
const frame=document.querySelector('#app'),status=document.querySelector('#status'),results=document.querySelector('#results');
const wait=ms=>new Promise(r=>setTimeout(r,ms));let w,d,report=[],count=0;
async function load(page){
 await new Promise(resolve=>{frame.onload=resolve;frame.src=page+(page.includes('?')?'&':'?')+'design=1';});w=frame.contentWindow;d=w.document;
 await d.fonts.ready;await Promise.all([...d.images].map(img=>img.decode().catch(()=>{})));await wait(240);
}
function el(s){const x=d.querySelector(s);if(!x)throw Error('Missing control: '+s);return x}
function click(s){el(s).click()}
function change(s,value,event='change'){el(s).value=value;el(s).dispatchEvent(new w.Event(event,{bubbles:true}));}
async function upload(s,url,type,name){const blob=await (await fetch(url)).blob();const t=new w.DataTransfer();t.items.add(new w.File([blob],name,{type}));el(s).files=t.files;el(s).dispatchEvent(new w.Event('change',{bubbles:true}));await wait(400);}
function assert(ok,message){if(!ok)throw Error(message)}
async function capture(name,trigger,expect){
 await wait(100);w.scrollTo(0,0);await new Promise(r=>w.requestAnimationFrame(()=>w.requestAnimationFrame(r)));
 const file=String(++count).padStart(2,'0')+'-'+name;
 const svg=w.WERDesignExport.capture();const r=await fetch('/__design-export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:file,svg})});if(!r.ok)throw Error('SVG save failed');
 const item={file:file+'.svg',page:frame.src.split('/').pop(),trigger,expected:expect||'',width:w.innerWidth,height:Math.max(d.documentElement.scrollHeight,w.innerHeight),fixture:true};report.push(item);
 const li=document.createElement('li');li.innerHTML=`<a style="color:#ffce96" href="figma-svg/${file}.svg" target="_blank">${file}.svg</a> — ${trigger}`;results.append(li);status.textContent=`Exported ${count} states · ${name}`;
}
document.querySelector('#run').addEventListener('click',async()=>{
 const btn=document.querySelector('#run');btn.disabled=true;let originalStorage;
 try{
  await load('index.html');originalStorage={...w.localStorage};w.localStorage.clear();w.WERStore.saveMode('sunset');
  await load('index.html');await capture('home-sunset','Open Home in Sunset mode');
  click('[data-room-pet="orange-cat"]');await capture('home-pet-clicked','Click Orange Cat','Pet enlarges; no page navigation');
  click('#pullCord');await capture('home-night','Pull mood cord','Night artwork and theme');
  click('[data-room-pet="white-cat"]');await capture('home-night-pet-clicked','Click White Cat');
  await load('pets.html');await capture('pets-create-empty','Open My Pets');
  change('#petNameInput','Figma Test Pet','input');await upload('#petPhoto','assets/pets/gray-cat.png','image/png','test-pet.png');await capture('pets-photo-preview','Choose pet photo','Pixelated preview, not AI cutout');
  change('#pixelColors','4','input');change('#pixelSize','24');await capture('pets-pixel-adjusted','Change palette and pixel detail');
  await upload('#petVoice','fixtures/wer-test-call.wav','audio/wav','test-call.wav');await capture('pets-voice-uploaded','Upload synthetic test call');
  el('#petForm').requestSubmit();await wait(200);assert(d.querySelector('#ownedPets').textContent.includes('Figma Test Pet'),'Pet not saved');await capture('pets-created','Save to My Pets','Pet card appears');
  const adopt=d.querySelector('#adoptionPets button');if(adopt){adopt.click();await capture('pets-adopted','Adopt a preset pet');}
  await load('collection.html');await capture('collection-empty','Open My Collection before saving music');
  await load('gallery.html');await capture('gallery','Open Gallery');
  await load('studio.html');await capture('studio-beginner','Open Music Studio','Beginner mode and templates');
  for(const scene of [...d.querySelectorAll('[data-scene-tile]')].map(e=>e.dataset.sceneTile)){click(`[data-scene-tile="${scene}"]`);await capture('studio-scene-'+scene,'Click round scene shortcut');}
  click('#mixerPetSwitcher [data-mixer-pet="ghost-cat"]');assert(el('#petName').textContent==='Dachshund','Mixer selection mismatch');await capture('studio-selected-dachshund','Click Dachshund mixer tab');
  click('#mixerPetSwitcher [data-mixer-pet="bat-cat"]');await capture('studio-selected-samoyed','Click Samoyed mixer tab');
  click('[data-studio-mode="advanced"]');click('[data-compose-mode="rhythm"]');await capture('studio-advanced','Switch to Advanced mode');
  click('#mixerPetSwitcher [data-mixer-pet="cat"]');
  el('.stage-pet[data-id="cat"]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));await capture('studio-pet-repositioned','Move selected pet with keyboard','Position changes and is stored for current scene');
  click('[data-mute="cat"]');await capture('studio-track-muted','Mute Gray Cat track');click('[data-mute="cat"]');
  change('#volume','45','input');change('#pitch','5','input');change('#pitch','5','change');change('#toneStrength','85','input');change('#repeat','alternate');await capture('studio-sound-adjusted','Adjust volume, pitch, tone strength and repeat');
  click('#effectTab');change('#echo','35','input');await capture('studio-effect','Open Effect and adjust echo');click('#soundTab');
  click('[data-track="cat"][data-step="1"]');await capture('studio-rhythm-edited','Toggle a rhythm square');
  click('[data-solfege-row="5"]');await capture('studio-sampler-note','Tap sampler Mi','Note placed at selected beat');
  click('#soloBeat');await capture('studio-solo-beat','Only selected beat');
  await upload('#voiceUpload','fixtures/wer-test-call.wav','audio/wav','test-call.wav');assert(el('#voiceStatus').textContent.includes('test-call'),'Uploaded audio not loaded');await capture('studio-uploaded-voice','Upload synthetic test call','Custom voice and trim controls');
  click('[data-clip-repeat="2"]');await capture('studio-clip-repeat','Repeat clip pattern twice');
  change('#songLength','2');await capture('studio-eight-bars','Change section length to eight bars');
  click('[data-phrase-page="1"]');await capture('studio-phrase-b','Switch to phrase B');
  change('#meter','3/4');change('#musicKey','Am');await capture('studio-meter-key','Choose 3/4 and A Minor');change('#meter','4/4');
  click('[data-phrase-page="0"]');click('[data-compose-mode="melody"]');click('[data-note-step="0"][data-note-row="5"]');await capture('studio-melody','Open Melody and place a note');
  click('[data-compose-mode="rhythm"]');click('#sourceInstrument');await wait(300);await capture('studio-instruments-all','Switch selected pet to Instrument');
  for(const category of ['keys','strings','wind','perc']){click(`[data-instrument-category="${category}"]`);await capture('studio-instruments-'+category,'Filter instruments by '+category);}
  click('[data-instrument-category="all"]');click('[data-instrument="piano"]');await capture('studio-piano-selected','Choose Piano');
  click('#sourceSynth');await capture('studio-pet-voice','Switch back to pet voice');
  click('#add');assert(el('#picker').open,'Pet picker did not open');await capture('dialog-add-pet','Click Add Pet');
  const newFriend=d.querySelector('#choices [data-add]:not([disabled])');if(newFriend)newFriend.click();else click('#closePicker');
  await capture('studio-pet-added','Select a new pet','New pet and track appear');
  const addedId=el('#petName').textContent;click('#remove');await capture('studio-pet-removed','Remove selected pet','Stage and tracks update');
  click('#addScene');assert(el('#sceneDialog').open,'Scene dialog did not open');await capture('dialog-add-scene','Click Add Scene');click('#closeScene');
  click('#help');await capture('dialog-help','Click Help');click('#closeHelp');
  click('#mixerPetSwitcher [data-mixer-pet="cat"]');
  el('#voicePicker .optional-ai').open=true;await capture('studio-ai-backing-options','Expand optional backing song','API setup requirement is visible; no request sent');el('#voicePicker .optional-ai').open=false;
  el('.creative-tools .optional-ai').open=true;await capture('studio-ai-sample-options','Expand optional sound effect','Text-only sample generation, not reference-audio cloning');el('.creative-tools .optional-ai').open=false;
  click('#random');await capture('studio-surprise','Click Surprise me','Editable preset arrangement');
  click('#christmasTemplate');await capture('studio-jingle-bells','Load Jingle Bells','Editable seasonal melody');
  click('#play');await wait(500);assert(/Pause/.test(el('#play').textContent),'Playback did not start');await capture('studio-playing','Play together','Shared playback state');
  click('#play');await capture('studio-paused','Pause the band');click('#stop');await capture('studio-stopped','Stop playback');
  // Save a synthetic uploaded call, then verify the serialized voice survives reload.
  click('#mixerPetSwitcher [data-mixer-pet="cat"]');await upload('#voiceUpload','fixtures/wer-test-call.wav','audio/wav','test-call.wav');
  const referenceAudio=await w.renderExportAudio();
  click('#saveSong');assert(el('#saveDialog').open,'Save dialog did not open');await capture('dialog-save','Click Save Music');
  change('#songName','Figma Test Session','input');await capture('dialog-save-named','Enter a song title');el('#saveForm').requestSubmit();await wait(200);await capture('studio-saved','Save to My Collection');
  const song=w.WERStore.getSongs().find(s=>s.name==='Figma Test Session');assert(song,'Saved song not found');assert(song.pets.find(p=>p.id==='cat').customAudioData?.startsWith('data:audio/'),'Saved voice data missing');
  await load('collection.html');await capture('collection-saved','Open collection after saving','Saved song card with Replay / Edit and local-link label');
  await load('studio.html?song='+encodeURIComponent(song.id));await wait(600);assert(el('#voiceStatus').textContent.includes('test-call'),'Reopened custom voice missing');
  const reopenedAudio=await w.renderExportAudio();assert(referenceAudio.length===reopenedAudio.length,'Reopened rendered audio duration differs');
  let maxDifference=0;for(let c=0;c<2;c++){const a=referenceAudio.getChannelData(c),b=reopenedAudio.getChannelData(c);for(let i=0;i<a.length;i++)maxDifference=Math.max(maxDifference,Math.abs(a[i]-b[i]));}
  assert(maxDifference<0.0001,'Reopened rendered audio differs: '+maxDifference);report.push({test:'Studio upload → save → reopen → offline render',maxSampleDifference:maxDifference,passed:true});
  await capture('studio-reopened','Reopen saved song','Custom audio and settings restored; offline waveform comparison passed');
  const createdPet=w.WERStore.getPets().find(p=>p.name==='Figma Test Pet');
  await load('studio.html?pet='+encodeURIComponent(createdPet.id));await wait(500);click(`[data-mixer-pet="${createdPet.id}"]`);await capture('studio-created-pet-voice','Open pet created with uploaded voice');
  click('#saveSong');change('#songName','Pet Creation Path Test','input');el('#saveForm').requestSubmit();await wait(150);
  const creationSong=w.WERStore.getSongs().find(s=>s.name==='Pet Creation Path Test');assert(creationSong.pets.find(p=>p.id===createdPet.id).customAudioData,'Pet-creation voice was not serialized');
  await load('studio.html?song='+encodeURIComponent(creationSong.id));await wait(600);assert(el('#voice').value==='custom','Created pet voice not restored');await capture('studio-created-pet-reopened','Reopen song using pet-creation voice','Second audio persistence path verified');
  report.push({test:'Pet creation upload → compose → save → reopen',passed:true});
  await load('studio.html');if(!el('#draftResume').hidden){await capture('studio-draft-resume','Open Studio with an existing draft');click('#resumeDraft');await capture('studio-draft-restored','Continue last session');}
  frame.style.width='390px';frame.style.height='844px';
  for(const page of ['index','pets','studio','collection','gallery']){
   await load(page+'.html');assert(d.documentElement.scrollWidth<=392,'Mobile page overflows: '+page);await capture('mobile-'+page,'Open '+page+' at 390px viewport');
   if(page==='studio'){click('[data-studio-mode="advanced"]');await capture('mobile-studio-advanced','Open Advanced mode at 390px');}
  }
 }catch(error){
  status.textContent='Stopped: '+error.message;report.push({error:error.message});
 }finally{
  try{await fetch('/__design-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});}catch{}
  if(originalStorage){w.localStorage.clear();for(const [k,v] of Object.entries(originalStorage))w.localStorage.setItem(k,v);}
  btn.disabled=false;if(!report.some(r=>r.error))status.textContent=`Completed ${count} editable SVG states`;
 }
});
