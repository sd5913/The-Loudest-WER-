/* UI-only behavior; audio processing stays in the main sound engine. */
(() => {
 const zone=document.querySelector('#voiceDropZone'),input=document.querySelector('#voiceUpload');
 if(zone&&input){
  zone.addEventListener('click',()=>input.click());
  for(const name of ['dragenter','dragover'])zone.addEventListener(name,e=>{e.preventDefault();zone.classList.add('drag-over')});
  for(const name of ['dragleave','drop'])zone.addEventListener(name,e=>{e.preventDefault();zone.classList.remove('drag-over')});
  zone.addEventListener('drop',e=>{
   const file=e.dataTransfer.files[0];if(!file)return;
   if(!file.type.startsWith('audio/')&&!/\.(wav|mp3|m4a|ogg|webm)$/i.test(file.name)){zone.querySelector('span').textContent='Please choose an audio file.';return;}
   if(file.size>16*1024*1024){zone.querySelector('span').textContent='Please choose a file smaller than 16 MB.';return;}
   const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  input.addEventListener('change',()=>{const file=input.files[0];if(file){zone.querySelector('b').textContent=file.name;zone.querySelector('span').textContent='Check the sound status below, then preview or trim your clip.';}});
 }
 const mixer=document.querySelector('#petMixer'),tools=document.querySelector('.creative-tools');
 if(mixer&&tools){document.querySelector('.left-column').append(tools);}
 const photo=document.querySelector('.file-drop'),photoInput=document.querySelector('#petPhoto');
 if(photo&&photoInput){
  photo.addEventListener('dragover',e=>{e.preventDefault();photo.classList.add('drag-over')});
  photo.addEventListener('dragleave',()=>photo.classList.remove('drag-over'));
  photo.addEventListener('drop',e=>{e.preventDefault();photo.classList.remove('drag-over');const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/')){const t=new DataTransfer();t.items.add(f);photoInput.files=t.files;photoInput.dispatchEvent(new Event('change',{bubbles:true}));}});
 }
 // Remove empty translation remnants in UI labels, while preserving user data.
 function tidy(root){for(const el of root.querySelectorAll('button,small,label,option,[role=status],.titlebar,.range-labels,.stage-caption,.rail-heading,.song-actions,#timeLabel,#roomStatus,#petRole')){
   for(const node of el.childNodes)if(node.nodeType===Node.TEXT_NODE)node.textContent=node.textContent.replace(/\s*[·/]\s*$/,'').replace(/\s*·\s*·\s*/g,' · ');
 }}
 tidy(document);
 let pending=false;
 const observer=new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{observer.disconnect();tidy(document);if(document.body?.isConnected)observer.observe(document.body,{childList:true,subtree:true});pending=false;});});observer.observe(document.body,{childList:true,subtree:true});
})();
