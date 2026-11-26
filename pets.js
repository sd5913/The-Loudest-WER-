function petNotice(message){let t=document.querySelector("#toast");if(!t){t=document.createElement("div");t.id="toast";t.setAttribute("role","status");t.setAttribute("aria-live","polite");document.body.append(t);}t.textContent=message;t.classList.add("show");clearTimeout(petNotice.timer);petNotice.timer=setTimeout(()=>t.classList.remove("show"),2500);}
const $ = selector => document.querySelector(selector);
const photo = $('#petPhoto'), preview = $('#photoPreview'), pctx = preview.getContext('2d');
let pixelPortrait = '', voiceData = '', recorder = null, recordStream = null, chunks = [], stopTimer = null, photoImage = null, photoChanged = false;
const esc = text => String(text).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function limitedPalette(data,count){
  const pixels=[];
  for(let i=0;i<data.length;i+=4){data[i+3]=data[i+3]>=128?255:0;if(data[i+3])pixels.push([data[i],data[i+1],data[i+2]])}
  if(!pixels.length)return;
  const distance=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
  const colors=[pixels[Math.floor(pixels.length/2)].slice()];
  while(colors.length<count){
    let candidate=pixels[0],best=-1;
    for(const pixel of pixels){const nearest=Math.min(...colors.map(color=>distance(pixel,color)));if(nearest>best){best=nearest;candidate=pixel}}
    if(best===0)break;
    colors.push(candidate.slice());
  }
  for(let pass=0;pass<7;pass++){
    const sums=colors.map(()=>[0,0,0,0]);
    for(const pixel of pixels){let index=0,best=Infinity;colors.forEach((color,i)=>{const d=distance(pixel,color);if(d<best){best=d;index=i}});const sum=sums[index];sum[0]+=pixel[0];sum[1]+=pixel[1];sum[2]+=pixel[2];sum[3]++}
    colors.forEach((color,i)=>{const sum=sums[i];if(sum[3])for(let c=0;c<3;c++)color[c]=Math.round(sum[c]/sum[3])});
  }
  for(let i=0;i<data.length;i+=4){if(data[i+3]<=20)continue;const pixel=[data[i],data[i+1],data[i+2]];let chosen=colors[0],best=Infinity;for(const color of colors){const d=distance(pixel,color);if(d<best){best=d;chosen=color}}for(let c=0;c<3;c++)data[i+c]=chosen[c]}
}
function drawPortrait(){
  if(!photoImage||(editingPet&&!photoChanged))return;
  const size=Number($('#pixelSize').value),colors=Number($('#pixelColors').value);
  $('#pixelColorsValue').textContent=`${colors} colors`;
  const tiny=document.createElement('canvas');tiny.width=size;tiny.height=size;const t=tiny.getContext('2d',{willReadFrequently:true});
  const scale=Math.max(size/photoImage.width,size/photoImage.height),w=photoImage.width*scale,h=photoImage.height*scale;
  t.imageSmoothingEnabled=true;t.imageSmoothingQuality='high';t.drawImage(photoImage,(size-w)/2,(size-h)/2,w,h);
  const pixels=t.getImageData(0,0,size,size);limitedPalette(pixels.data,colors);t.putImageData(pixels,0,0);
  pctx.clearRect(0,0,192,192);pctx.imageSmoothingEnabled=false;pctx.drawImage(tiny,0,0,192,192);
  pixelPortrait=preview.toDataURL('image/png');$('#photoHint').hidden=true;
}
photo.addEventListener('change',()=>{const file=photo.files?.[0];if(!file)return;if(file.size>12*1024*1024){$('#photoHint').textContent='Choose an image under 12 MB';photo.value='';return;}const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{photoImage=img;photoChanged=true;drawPortrait();URL.revokeObjectURL(url)};img.onerror=()=>{$('#photoHint').textContent='Could not read this photo';URL.revokeObjectURL(url)};img.src=url;});
$('#pixelColors').addEventListener('input',drawPortrait);
$('#pixelSize').addEventListener('change',drawPortrait);
function readDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
$('#petVoice').addEventListener('change',async()=>{const file=$('#petVoice').files?.[0];if(!file)return;if(file.size>1024*1024){$('#voiceStatus').textContent='Please choose a voice clip under 1 MB';return;}try{voiceData=await readDataURL(file);$('#voicePreview').src=voiceData;$('#voicePreview').hidden=false;$('#voiceStatus').textContent=`${file.name} · ready to save`;}catch{$('#voiceStatus').textContent='Could not read this audio';}});
$('#recordVoice').addEventListener('click',async()=>{try{recordStream=await navigator.mediaDevices.getUserMedia({audio:true});recorder=new MediaRecorder(recordStream);chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=async()=>{clearTimeout(stopTimer);$('#recordVoice').disabled=false;$('#stopVoice').disabled=true;recordStream.getTracks().forEach(track=>track.stop());const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});if(blob.size>1024*1024){$('#voiceStatus').textContent='Recording is too large. Try a shorter take';return;}voiceData=await readDataURL(blob);$('#voicePreview').src=voiceData;$('#voicePreview').hidden=false;$('#voiceStatus').textContent='Your pet voice is ready';};recorder.start();$('#recordVoice').disabled=true;$('#stopVoice').disabled=false;$('#voiceStatus').textContent='Recording… max 8 seconds';stopTimer=setTimeout(()=>recorder?.state==='recording'&&recorder.stop(),8000);}catch{$('#voiceStatus').textContent='Allow microphone access to record';}});
$('#stopVoice').addEventListener('click',()=>{if(recorder?.state==='recording')recorder.stop();$('#recordVoice').disabled=false;$('#stopVoice').disabled=true;});
let selectedPetId='',editingPet=null,editingPetId='';
function renderOwned(){
  const owned=WERStore.getOwned(),cards=WERStore.getAllPets().filter(p=>owned.includes(p.id));
  $('#ownedCount').textContent=String(cards.length).padStart(2,'0');
  const root=$('#ownedPets');
  if(!cards.length){root.innerHTML='<p class="empty-hint">Your shelf is ready for a new friend.<small></small></p>';return;}
  root.innerHTML=cards.map(p=>{
    const selected=p.id===selectedPetId;
    return `<article class="library-pet ${selected?'selected':''}" data-owned-pet="${esc(p.id)}"><img src="${p.image||`assets/pets/${p.asset||p.id}.png`}" alt=""><div class="library-pet-info"><b>${esc(p.name)}</b><small>${esc(p.role||'A little friend')} · ${esc(p.kind||'Pet')}</small></div><button class="pet-select ${selected?'active':''}" type="button" data-pet-select="${esc(p.id)}" aria-pressed="${selected}">${selected?'Selected ✓':'Select'}</button>${selected?`<div class="pet-card-actions"><button type="button" class="soft" data-pet-edit="${esc(p.id)}">✎ Edit</button><a class="soft" href="studio.html?pet=${encodeURIComponent(p.id)}">Use in Studio ↗</a><button type="button" class="plain danger" data-pet-delete="${esc(p.id)}">Delete</button></div>`:''}</article>`;
  }).join('');
}
function renderAdoption(){
  const owned=WERStore.getOwned();
  $('#adoptionPets').innerHTML=WERStore.getCatalogPets().map(p=>`<article class="adoption-card ${p.theme||''}"><div class="adoption-art"><img src="${p.image||`assets/pets/${p.asset||p.id}.png`}" alt=""><span>${p.emoji||'✦'}</span></div><div class="adoption-copy"><small>PIXEL PETS</small><h3>${esc(p.name)}</h3><p>${esc(p.role||'A little friend')}<br></p><button class="${owned.includes(p.id)?'soft':'primary'}" data-adopt="${esc(p.id)}" ${owned.includes(p.id)?'disabled':''}>${owned.includes(p.id)?'Adopted ✓':'Adopt'}</button></div></article>`).join('');
}
function resetPetForm(){
  editingPet=null;editingPetId='';pixelPortrait='';photoImage=null;photoChanged=false;voiceData='';
  $('#petForm').reset();$('#voicePreview').hidden=true;$('#voicePreview').removeAttribute('src');$('#voiceStatus').textContent='Optional';
  $('#photoHint').hidden=false;$('#photoHint').textContent='Your pixel preview appears here.';
  pctx.clearRect(0,0,192,192);$('#savePetButton').textContent='Save to My Pets';$('#cancelPetEdit').hidden=true;$('#petFormTitle').innerHTML='<i class="dot"></i> CREATE YOUR PET · new_friend.exe';
}
function beginPetEdit(id){
  const pet=WERStore.getAllPets().find(item=>item.id===id);if(!pet)return;
  editingPet={...pet};editingPetId=id;selectedPetId=id;pixelPortrait=pet.image||'';photoImage=null;photoChanged=false;voiceData='';
  $('#petNameInput').value=pet.name||'';$('#petPhoto').value='';$('#petVoice').value='';
  $('#pixelColors').value='6';$('#pixelSize').value='48';$('#pixelColorsValue').textContent='6 colors';
  pctx.clearRect(0,0,192,192);$('#photoHint').hidden=true;
  const imageSource=pet.image||`assets/pets/${pet.asset||pet.id}.png`;
  const img=new Image();img.onload=()=>{if(editingPetId!==id)return;photoImage=img;pctx.clearRect(0,0,192,192);pctx.imageSmoothingEnabled=false;pctx.drawImage(img,0,0,192,192)};img.onerror=()=>{if(editingPetId!==id)return;photoImage=null;$('#photoHint').hidden=false};img.src=imageSource;
  if(pet.audioData){$('#voicePreview').src=pet.audioData;$('#voicePreview').hidden=false;$('#voiceStatus').textContent='Current voice · upload or record to replace it';}
  else{$('#voicePreview').hidden=true;$('#voicePreview').removeAttribute('src');$('#voiceStatus').textContent='Current pet voice stays unchanged unless you add a new clip';}
  $('#savePetButton').textContent='Update My Pet';$('#cancelPetEdit').hidden=false;$('#petFormTitle').innerHTML='<i class="dot"></i> EDIT YOUR PET · friend_profile.exe';
  renderOwned();$('#petNameInput').focus();$('#petForm').scrollIntoView({behavior:'smooth',block:'center'});
}
$('#ownedPets').addEventListener('click',e=>{
  const select=e.target.closest('[data-pet-select]'),edit=e.target.closest('[data-pet-edit]'),remove=e.target.closest('[data-pet-delete]');
  if(select){selectedPetId=select.dataset.petSelect;renderOwned();return;}
  if(edit){beginPetEdit(edit.dataset.petEdit);return;}
  if(remove){
    const pet=WERStore.getAllPets().find(item=>item.id===remove.dataset.petDelete);if(!pet)return;
    const isCustom=pet.custom||!WERStore.getCatalogPets().some(item=>item.id===pet.id);
    const prompt=isCustom?`Delete ${pet.name} and its custom photo/voice from this browser? Saved songs will remain.`:`Remove ${pet.name} from My Pets? It will return to the Adoption Center.`;
    if(!window.confirm(prompt))return;
    if(!WERStore.removePet(pet.id)){petNotice('Could not update My Pets. Browser storage may be full.');return;}
    if(editingPet?.id===pet.id)resetPetForm();selectedPetId='';renderOwned();renderAdoption();petNotice(isCustom?`${pet.name} was deleted`:`${pet.name} returned to the Adoption Center`);return;
  }
  const card=e.target.closest('[data-owned-pet]');if(card){selectedPetId=card.dataset.ownedPet;renderOwned();}
});
$('#cancelPetEdit').addEventListener('click',resetPetForm);
$('#adoptionPets').addEventListener('click',e=>{const b=e.target.closest('[data-adopt]');if(!b)return;WERStore.adopt(b.dataset.adopt);renderOwned();renderAdoption();});
$('#petForm').addEventListener('submit',e=>{
  e.preventDefault();const name=$('#petNameInput').value.trim();if(!name)return;
  const original=editingPet||{};
  const pet={...original,id:editingPet?editingPet.id:`pet-${Date.now()}`,name,kind:original.kind||'Custom',role:original.role||'A voice all their own',image:pixelPortrait||original.image||'assets/pets/cat.png',audioData:voiceData||original.audioData||'',custom:original.custom??!WERStore.getCatalogPets().some(item=>item.id===original.id),color:original.color||'#e598bf',light:original.light||'#f8c9db',dark:original.dark||'#765080',wave:original.wave||'triangle',base:original.base||440,volume:original.volume??55,pitch:original.pitch??0,tone:voiceData?'custom':original.tone||(original.audioData?'custom':'signature'),repeat:original.repeat||'loop',muted:original.muted||false,steps:original.steps||[0,4]};
  if(!WERStore.savePet(pet)){petNotice('Browser storage is full. Please choose a smaller photo or audio clip.');return;}
  WERStore.adopt(pet.id);selectedPetId=pet.id;const message=editingPet?`${name} was updated`:`${name} is now in My Pets`;
  resetPetForm();renderOwned();renderAdoption();petNotice(message);
});
renderOwned();renderAdoption();
