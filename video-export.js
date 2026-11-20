/* Record a clean stage performance locally; no screen or microphone capture. */
(() => {
 const q=s=>document.querySelector(s);
 const trigger=document.createElement('button');trigger.id='exportVideo';trigger.type='button';trigger.className='soft export-video';trigger.textContent='⇩ Export Video';
 q('#exportAudio').after(trigger);
 const dialog=document.createElement('dialog');dialog.id='videoExportDialog';
 dialog.innerHTML='<div class="titlebar lavender"><span>pet_performance.video</span><button type="button" class="plain" id="closeVideoExport" aria-label="Close video export">×</button></div><div class="dialog-body video-export-body"><h2>Your little music video</h2><p>Your stage, pets and music in one video. Everything is created on this device.</p><label class="video-length-label" for="videoLoops">Performance length<select id="videoLoops"><option value="1">1 round</option><option value="2">2 rounds</option><option value="4">4 rounds</option></select></label><canvas id="videoStagePreview" width="1280" height="540" aria-label="Music video stage preview"></canvas><video id="videoResult" controls playsinline hidden></video><p id="videoExportStatus" role="status" aria-live="polite">Choose a length, then create your video.</p><progress id="videoExportProgress" max="1" value="0" hidden aria-label="Video export progress"></progress><div class="video-export-actions"><button type="button" class="primary" id="startVideoExport">Create video</button><button type="button" class="soft" id="cancelVideoExport" hidden>Cancel</button><a id="downloadVideo" class="soft" hidden>Download video</a></div><small>MP4 when supported; otherwise WebM. Keep this tab open while recording.</small></div>';
 document.body.append(dialog);
 const canvas=q('#videoStagePreview'),ctx=canvas.getContext('2d'),status=q('#videoExportStatus');
 let sceneSnapshot=null,active=null,previewUrl='';
 const loadImage=async src=>{const image=new Image();image.src=src;await image.decode();return image};
 async function snapshotStage(){
  const stage=q('#stage').getBoundingClientRect();
  const box=el=>{const b=el.getBoundingClientRect();return {x:(b.left-stage.left)/stage.width,y:(b.top-stage.top)/stage.height,w:b.width/stage.width,h:b.height/stage.height}};
  const captureImage=async el=>{if(el.tagName.toLowerCase()==='svg')return loadImage('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(el)));return loadImage(el.currentSrc||el.src)};
  const background=await captureImage(q('#sceneArt'));
  const performers=await Promise.all([...q('#stagePets').children].map(async el=>{
   const p=pets.find(p=>p.id===el.dataset.id),art=el.querySelector('img,svg');
   if(!p||!art)return null;
   return {pet:{...p,steps:[...effectiveSteps(p)]},image:await captureImage(art),box:box(art),label:box(el.querySelector('.pet-label')),selected:p.id===selected};
  }));
  const mic=q('.mic svg');
  canvas.height=Math.max(240,Math.round(1280*stage.height/stage.width/2)*2);
  return {background,performers:performers.filter(Boolean),mic:mic?{image:await captureImage(mic),box:box(q('.mic'))}:null,bpm:Number(q('#tempo').value)||92,steps:stepCount(),name:q('#sceneLabel').textContent};
 }
 function drawContained(image,b){
  const ratio=Math.min(b.w*canvas.width/image.naturalWidth,b.h*canvas.height/image.naturalHeight),w=image.naturalWidth*ratio,h=image.naturalHeight*ratio;
  ctx.drawImage(image,b.x*canvas.width+(b.w*canvas.width-w)/2,b.y*canvas.height+(b.h*canvas.height-h)/2,w,h);
 }
 function drawStage(t=0,animate=false){
  if(!sceneSnapshot)return;
  const s=sceneSnapshot,w=canvas.width,h=canvas.height;
  ctx.imageSmoothingEnabled=false;ctx.fillStyle='#20142f';ctx.fillRect(0,0,w,h);
  const scale=Math.max(w/s.background.naturalWidth,h/s.background.naturalHeight),bw=s.background.naturalWidth*scale,bh=s.background.naturalHeight*scale;
  ctx.drawImage(s.background,(w-bw)/2,(h-bh)/2,bw,bh);
  if(s.mic)drawContained(s.mic.image,s.mic.box);
  const beats=Math.max(0,t-.04)*s.bpm/60,step=Math.floor(beats)%s.steps,cycle=Math.floor(beats/s.steps),phase=beats%1;
  for(const item of s.performers){
   const p=item.pet,on=animate&&!p.muted&&petPlaysInLoop(p,cycle)&&p.steps.includes(step),bounce=on?Math.sin(Math.min(1,phase*2)*Math.PI)*9:0;
   ctx.save();ctx.globalAlpha=p.muted?.55:1;
   drawContained(item.image,{...item.box,y:item.box.y-bounce/h});
   const label=item.label,x=label.x*w,y=label.y*h,lw=label.w*w,lh=Math.max(24,label.h*h);
   ctx.fillStyle='#fa9acb';ctx.fillRect(x+3,y+3,lw,lh);ctx.fillStyle=item.selected?'#ffe18c':'#241637';ctx.fillRect(x,y,lw,lh);ctx.strokeStyle=item.selected?'#ef9cc7':'#ffe18c';ctx.lineWidth=2;ctx.strokeRect(x,y,lw,lh);
   ctx.font=Math.max(12,Math.round(lh*.43))+'px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=item.selected?'#29163a':'#fff0d6';ctx.fillText(p.name,x+lw/2,y+lh/2,lw-10);
   ctx.restore();
   if(on&&phase<.55){ctx.fillStyle='#fff0a6';ctx.font='bold 26px monospace';ctx.fillText('♪',(item.box.x+item.box.w*.85)*w,(item.box.y-.015)*h-bounce);}
  }
  ctx.fillStyle='#21162ee8';ctx.fillRect(16,16,Math.min(w-32,300),34);ctx.fillStyle='#ffe8ad';ctx.textAlign='left';ctx.textBaseline='middle';ctx.font='16px monospace';ctx.fillText(s.name,28,33,274);
  ctx.fillStyle='#21162ed9';ctx.font='bold 13px monospace';ctx.textAlign='right';ctx.fillText('THE LOUDEST WER!',w-16,h-14);
 }
 function setBusy(busy){q('#startVideoExport').disabled=busy;q('#videoLoops').disabled=busy;q('#cancelVideoExport').hidden=!busy;q('#videoExportProgress').hidden=!busy;trigger.disabled=busy;}
 function dispose(run){cancelAnimationFrame(run.frame);clearTimeout(run.timeout);try{run.source?.stop()}catch{}run.stream?.getTracks().forEach(t=>t.stop());run.source?.disconnect();}
 function cancel(){if(!active)return;const run=active;run.cancelled=true;if(run.recorder?.state==='recording')run.recorder.stop();else{dispose(run);active=null;setBusy(false);}status.textContent='Video cancelled. Your composition is unchanged.';}
 q('#cancelVideoExport').addEventListener('click',cancel);
 q('#closeVideoExport').addEventListener('click',()=>{cancel();q('#videoResult').pause();dialog.close()});
 dialog.addEventListener('cancel',()=>{cancel();q('#videoResult').pause()});
 trigger.addEventListener('click',async()=>{
  if(playing)await togglePlay();
  dialog.showModal();status.textContent='Preparing your stage…';q('#videoResult').hidden=true;canvas.hidden=false;q('#downloadVideo').hidden=true;
  try{sceneSnapshot=await snapshotStage();drawStage();for(const option of q('#videoLoops').options){const n=Number(option.value);option.textContent=n+' round'+(n>1?'s':'')+' · about '+Math.round(sceneSnapshot.steps*60/sceneSnapshot.bpm*n)+'s';}status.textContent='Ready. Create a video with your current stage and music.';}
  catch(error){sceneSnapshot=null;status.textContent='Stage preview unavailable: '+error.message;}
 });
 q('#startVideoExport').addEventListener('click',async()=>{
  if(active||!sceneSnapshot)return;
  if(!window.MediaRecorder||!canvas.captureStream){status.textContent='Video export is not supported in this browser. Try a recent Chrome or Safari.';return;}
  q('#videoResult').pause();
  const run={cancelled:false};active=run;setBusy(true);q('#videoResult').hidden=true;canvas.hidden=false;q('#downloadVideo').hidden=true;q('#videoExportProgress').value=0;status.textContent='Preparing the soundtrack…';
  try{
   const loops=Number(q('#videoLoops').value),duration=sceneSnapshot.steps*60/sceneSnapshot.bpm*loops+1.2;
   const audio=await renderExportAudio({loops});if(run.cancelled)return;
   context ||= new(window.AudioContext||window.webkitAudioContext)();await context.resume();
   const destination=context.createMediaStreamDestination(),source=context.createBufferSource();source.buffer=audio;source.connect(destination);run.source=source;
   drawStage();const picture=canvas.captureStream(30);run.stream=new MediaStream([...picture.getVideoTracks(),...destination.stream.getAudioTracks()]);
   const type=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
   if(!type)throw Error('No supported video format found');
   const recorder=new MediaRecorder(run.stream,{mimeType:type,videoBitsPerSecond:3000000,audioBitsPerSecond:192000});run.recorder=recorder;const chunks=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
   recorder.onerror=e=>{status.textContent='Video encoding failed. Please try again.';run.cancelled=true;if(recorder.state!=='inactive')recorder.stop()};
   recorder.onstop=()=>{
    dispose(run);active=null;setBusy(false);
    if(run.cancelled)return;
    const blob=new Blob(chunks,{type:recorder.mimeType});if(!blob.size){status.textContent='Video was empty. Please try again.';return;}
    if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(blob);
    const link=q('#downloadVideo');link.href=previewUrl;link.download='WER-pet-performance.'+(recorder.mimeType.includes('mp4')?'mp4':'webm');link.hidden=false;
    q('#videoResult').src=previewUrl;q('#videoResult').hidden=false;canvas.hidden=true;q('#videoExportProgress').value=1;
    status.textContent='Your video is ready — preview it, then download.';
   };
   recorder.start(250);const start=context.currentTime+.1;source.start(start,0,Math.min(duration,audio.duration));
   function frame(){if(run.cancelled)return;const elapsed=Math.max(0,context.currentTime-start);drawStage(elapsed,elapsed<duration-1.2);q('#videoExportProgress').value=Math.min(1,elapsed/duration);status.textContent='Creating video · '+Math.floor(elapsed)+' / '+Math.ceil(duration)+'s';if(elapsed>=duration){if(recorder.state==='recording')recorder.stop();return;}run.frame=requestAnimationFrame(frame);}
   run.frame=requestAnimationFrame(frame);run.timeout=setTimeout(()=>{if(recorder.state==='recording')recorder.stop()},(duration+3)*1000);
  }catch(error){dispose(run);active=null;setBusy(false);status.textContent=error.message||'Video export failed';}
  finally{if(run.cancelled&&active===run&& !run.recorder){dispose(run);active=null;setBusy(false)}}
 });
})();
