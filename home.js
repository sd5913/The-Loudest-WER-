const $ = selector => document.querySelector(selector);
const scene=$('.room-scene'), layoutItems=[...document.querySelectorAll('.room-pet')], layoutKey='loudestwer.homeLayout.v2';
const layoutId=item=>item.dataset.roomPet;
function readLayout(){try{return JSON.parse(localStorage.getItem(layoutKey))||{};}catch{return {};}}
function applyLayout(mode){const saved=readLayout()[mode]||{};layoutItems.forEach(item=>{item.style.removeProperty('left');item.style.removeProperty('top');const pos=saved[layoutId(item)];if(pos){item.style.left=`${pos.left}%`;item.style.top=`${pos.top}%`;}});}
function savePosition(mode,item){const all=readLayout(),positions=all[mode]||{},rect=item.getBoundingClientRect(),bounds=scene.getBoundingClientRect();positions[layoutId(item)]={left:+((rect.left-bounds.left)/bounds.width*100).toFixed(3),top:+((rect.top-bounds.top)/bounds.height*100).toFixed(3)};all[mode]=positions;try{localStorage.setItem(layoutKey,JSON.stringify(all));}catch{}}
function clockMode() {
  const hour=new Date().getHours();
  return hour>=6&&hour<19?'sunset':'night';
}
function drawRoom(mode) {
  const image=$('#roomBackground'), night=mode==='night';
  const src=night?'assets/backgrounds/home-night.png?v=3':'assets/backgrounds/home-sunset.png?v=3';
  if(image.getAttribute('src')!==src)image.src=src;
  image.alt=night?'Cozy pixel pet room at night · 夜晚像素宠物房间':'Cozy pixel pet room at sunset · 黄昏像素宠物房间';
}
function setMode(mode, persist=false) {
  const effective = mode==='auto' ? clockMode() : mode;
  document.body.dataset.time = effective; drawRoom(effective); applyLayout(effective);
  $('#timeLabel').textContent = `${effective.toUpperCase()} · ${{sunset:'黄昏',night:'夜晚'}[effective]}`;
  $('#pullCord').setAttribute('aria-pressed',String(effective==='sunset'));
  $('#roomStatus').textContent = effective==='night'?'Night theme · 夜晚主题':'Sunset theme · 黄昏主题';
  if(persist) WERStore.saveMode(mode);
}
const storedMode=WERStore.getMode(), savedMode=storedMode==='day'?'sunset':storedMode;
if(storedMode!==savedMode)WERStore.saveMode(savedMode);
setMode(savedMode);
setInterval(()=>{if(WERStore.getMode()==='auto')setMode('auto')},60000);
function toggleLamp(){const next=document.body.dataset.time==='night'?'sunset':'night';setMode(next,true);$('#pullCord').classList.remove('pulled');void $('#pullCord').offsetWidth;$('#pullCord').classList.add('pulled');}
let dragStart=null, skipClick=false;
$('#pullCord').addEventListener('pointerdown',e=>{dragStart=e.clientY;e.currentTarget.setPointerCapture(e.pointerId);});
$('#pullCord').addEventListener('pointerup',e=>{if(dragStart!==null&&e.clientY-dragStart>12){skipClick=true;toggleLamp();setTimeout(()=>skipClick=false,100);}dragStart=null;});
$('#pullCord').addEventListener('click',e=>{if(skipClick){e.preventDefault();return;}toggleLamp();});
const layoutMode=$('#layoutMode'),layoutReset=$('#layoutReset');
layoutMode.addEventListener('click',()=>{const active=document.body.classList.toggle('layout-editing');layoutMode.setAttribute('aria-pressed',String(active));layoutMode.innerHTML=active?'Done <small>完成</small>':'Arrange <small>调整位置</small>';layoutReset.hidden=!active;$('#roomStatus').textContent=active?'Drag items to align · 拖动物品调整位置':'Sunset and night layout · 黄昏与夜晚布局';});
layoutReset.addEventListener('click',()=>{const mode=document.body.dataset.time,all=readLayout();delete all[mode];try{localStorage.setItem(layoutKey,JSON.stringify(all));}catch{}applyLayout(mode);$('#roomStatus').textContent='Layout restored · 已恢复默认位置';});
let moving=null,ignoreNextClick=false;
document.addEventListener('pointerdown',e=>{if(!document.body.classList.contains('layout-editing'))return;const item=e.target.closest('.room-pet');if(!item)return;const itemRect=item.getBoundingClientRect(),sceneRect=scene.getBoundingClientRect();moving={item,x:e.clientX,y:e.clientY,left:(itemRect.left-sceneRect.left)/sceneRect.width*100,top:(itemRect.top-sceneRect.top)/sceneRect.height*100,sceneRect,moved:false};item.setPointerCapture(e.pointerId);e.preventDefault();},true);
document.addEventListener('pointermove',e=>{if(!moving)return;if(!moving.moved&&Math.hypot(e.clientX-moving.x,e.clientY-moving.y)<4)return;moving.moved=true;const width=moving.item.getBoundingClientRect().width/moving.sceneRect.width*100,height=moving.item.getBoundingClientRect().height/moving.sceneRect.height*100;moving.item.style.left=`${Math.max(0,Math.min(100-width,moving.left+(e.clientX-moving.x)/moving.sceneRect.width*100))}%`;moving.item.style.top=`${Math.max(0,Math.min(100-height,moving.top+(e.clientY-moving.y)/moving.sceneRect.height*100))}%`;e.preventDefault();},{passive:false});
function finishMove(){if(!moving)return;if(moving.moved){savePosition(document.body.dataset.time,moving.item);ignoreNextClick=true;$('#roomStatus').textContent='Position saved · 位置已保存';setTimeout(()=>ignoreNextClick=false,100);}moving=null;}
document.addEventListener('pointerup',finishMove);document.addEventListener('pointercancel',finishMove);
document.addEventListener('click',e=>{if(!ignoreNextClick&&(!document.body.classList.contains('layout-editing')||!e.target.closest('.room-pet')))return;e.preventDefault();e.stopPropagation();},true);
const petCall=new Audio('assets/sounds/cat-call.wav');petCall.volume=.45;
const roomPets={
  'mystery-cat':{name:'Mystery Cat',zh:'神秘猫',rate:.78},
  'orange-cat':{name:'Orange Cat',zh:'橘猫',rate:1},
  'white-cat':{name:'White Cat',zh:'白猫',rate:1.3}
};
document.querySelectorAll('[data-room-pet]').forEach(button=>button.addEventListener('click',()=>{
  if(document.body.classList.contains('layout-editing'))return;
  const pet=roomPets[button.dataset.roomPet];if(!pet)return;
  const wasZoomed=button.classList.contains('is-zoomed');
  document.querySelectorAll('.room-pet.is-zoomed').forEach(item=>{item.classList.remove('is-zoomed');item.setAttribute('aria-pressed','false');});
  if(!wasZoomed){button.classList.add('is-zoomed');button.setAttribute('aria-pressed','true');}
  petCall.pause();petCall.currentTime=0;petCall.playbackRate=pet.rate;petCall.play().catch(()=>{});
  $('#roomStatus').textContent=`${pet.name} says hello · ${pet.zh}和你打招呼`;
}));
// A couple of recent sessions make the home feel lived in.
const recent=WERStore.getSongs().slice(0,2), list=$('#recentSongs');
if(recent.length){ list.replaceChildren(...recent.map(song=>{const a=document.createElement('a');a.className='recent-song';a.href=`studio.html?song=${encodeURIComponent(song.id)}`;a.innerHTML=`<span>♫</span><b></b><small></small><i>↗</i>`;a.querySelector('b').textContent=song.name;a.querySelector('small').textContent=`${song.tempo} BPM · ${song.pets.length} pets · ${new Date(song.savedAt).toLocaleDateString()}`;return a;})); }
