const $ = selector => document.querySelector(selector);
const photo = $('#petPhoto'), preview = $('#photoPreview'), pctx = preview.getContext('2d');
let pixelPortrait = '', voiceData = '', recorder = null, recordStream = null, chunks = [], stopTimer = null, photoImage = null;
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
  if(!photoImage)return;
  const size=Number($('#pixelSize').value),colors=Number($('#pixelColors').value);
  $('#pixelColorsValue').textContent=`${colors} colors · ${colors} 色`;
  const tiny=document.createElement('canvas');tiny.width=size;tiny.height=size;const t=tiny.getContext('2d',{willReadFrequently:true});
  const scale=Math.max(size/photoImage.width,size/photoImage.height),w=photoImage.width*scale,h=photoImage.height*scale;
  t.imageSmoothingEnabled=true;t.imageSmoothingQuality='high';t.drawImage(photoImage,(size-w)/2,(size-h)/2,w,h);
  const pixels=t.getImageData(0,0,size,size);limitedPalette(pixels.data,colors);t.putImageData(pixels,0,0);
  pctx.clearRect(0,0,192,192);pctx.imageSmoothingEnabled=false;pctx.drawImage(tiny,0,0,192,192);
  pixelPortrait=preview.toDataURL('image/png');$('#photoHint').hidden=true;
}
photo.addEventListener('change',()=>{const file=photo.files?.[0];if(!file)return;if(file.size>12*1024*1024){$('#photoHint').textContent='Choose an image under 12 MB · 请选小于 12 MB 的图片';photo.value='';return;}const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{photoImage=img;drawPortrait();URL.revokeObjectURL(url)};img.onerror=()=>{$('#photoHint').textContent='Could not read this photo · 无法读取照片';URL.revokeObjectURL(url)};img.src=url;});
$('#pixelColors').addEventListener('input',drawPortrait);
$('#pixelSize').addEventListener('change',drawPortrait);
function readDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
$('#petVoice').addEventListener('change',async()=>{const file=$('#petVoice').files?.[0];if(!file)return;if(file.size>1024*1024){$('#voiceStatus').textContent='Please choose a voice clip under 1 MB · 请上传小于 1 MB 的声音';return;}try{voiceData=await readDataURL(file);$('#voicePreview').src=voiceData;$('#voicePreview').hidden=false;$('#voiceStatus').textContent=`${file.name} · ready to save · 声音已准备好`;}catch{$('#voiceStatus').textContent='Could not read this audio · 无法读取音频';}});
$('#recordVoice').addEventListener('click',async()=>{try{recordStream=await navigator.mediaDevices.getUserMedia({audio:true});recorder=new MediaRecorder(recordStream);chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=async()=>{clearTimeout(stopTimer);$('#recordVoice').disabled=false;$('#stopVoice').disabled=true;recordStream.getTracks().forEach(track=>track.stop());const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});if(blob.size>1024*1024){$('#voiceStatus').textContent='Recording is too large. Try a shorter take · 文件过大，请缩短录音';return;}voiceData=await readDataURL(blob);$('#voicePreview').src=voiceData;$('#voicePreview').hidden=false;$('#voiceStatus').textContent='Your pet voice is ready · 宠物声音已录好';};recorder.start();$('#recordVoice').disabled=true;$('#stopVoice').disabled=false;$('#voiceStatus').textContent='Recording… max 8 seconds · 正在录制，最长 8 秒';stopTimer=setTimeout(()=>recorder?.state==='recording'&&recorder.stop(),8000);}catch{$('#voiceStatus').textContent='Allow microphone access to record · 请允许麦克风权限';}});
$('#stopVoice').addEventListener('click',()=>{if(recorder?.state==='recording')recorder.stop();$('#recordVoice').disabled=false;$('#stopVoice').disabled=true;});
function renderOwned(){const owned=WERStore.getOwned(), custom=WERStore.getPets(), all=[...WERStore.starters,...WERStore.defaultPets,...custom], cards=all.filter(p=>owned.includes(p.id));$('#ownedCount').textContent=String(cards.length).padStart(2,'0');const root=$('#ownedPets');if(!cards.length){root.innerHTML='<p class="empty-hint">Your shelf is ready for a new friend.<small>领养灰猫、腊肠狗或萨摩耶，或保存你创建的宠物，它们就会出现在这里。</small></p>';return;}root.innerHTML=cards.map(p=>`<article class="library-pet"><img src="${p.image||`assets/pets/${p.asset||p.id}.png`}" alt=""><div><b>${esc(p.name)}</b><small>${esc(p.role||'A little friend')} · ${esc(p.kind||'Pet')}</small></div><a href="studio.html?pet=${encodeURIComponent(p.id)}">Select · 选择 ↗</a></article>`).join('');}
function renderAdoption(){const owned=WERStore.getOwned();$('#adoptionPets').innerHTML=[...WERStore.starters,...WERStore.defaultPets].map((p,i)=>`<article class="adoption-card ${p.theme}"><div class="adoption-art"><img src="assets/pets/${p.asset||p.id}.png" alt=""><span>${p.emoji}</span></div><div class="adoption-copy"><small>PIXEL PETS · 像素伙伴</small><h3>${esc(p.name)}</h3><p>${esc(p.role)}<br>${['活泼的灰猫旋律','温暖的腊肠狗低音','清亮的萨摩耶高音','轻快小节拍','柔和旋律'][i]}</p><button class="${owned.includes(p.id)?'soft':'primary'}" data-adopt="${p.id}" ${owned.includes(p.id)?'disabled':''}>${owned.includes(p.id)?'Adopted ✓ · 已领养':'Adopt · 领养'}</button></div></article>`).join('');}
$('#adoptionPets').addEventListener('click',e=>{const b=e.target.closest('[data-adopt]');if(!b)return;WERStore.adopt(b.dataset.adopt);renderOwned();renderAdoption();});
$('#petForm').addEventListener('submit',e=>{e.preventDefault();const name=$('#petNameInput').value.trim();if(!name)return;const image=pixelPortrait||'assets/pets/cat.png', pet={id:`pet-${Date.now()}`,name,kind:'Custom',role:'A voice all their own',image,audioData:voiceData||'',custom:true,color:'#e598bf',light:'#f8c9db',dark:'#765080',wave:'triangle',base:440,volume:55,pitch:0,tone:voiceData?'custom':'signature',repeat:'loop',muted:false,steps:[0,4]};if(!WERStore.savePet(pet)){alert('Browser storage is full. Please choose a smaller audio clip. · 浏览器空间不足，请使用更小的音频。');return;}WERStore.adopt(pet.id);$('#petForm').reset();$('#voicePreview').hidden=true;$('#voicePreview').removeAttribute('src');$('#voiceStatus').textContent='Optional · 可稍后添加';pixelPortrait='';photoImage=null;voiceData='';pctx.clearRect(0,0,192,192);$('#photoHint').hidden=false;renderOwned();alert(`${name} is now in My Pets · 已加入我的宠物`);});
renderOwned();renderAdoption();
