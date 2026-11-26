/* Independent desktop scrolling; music and API handlers stay unchanged. */
(() => {
 const q=s=>document.querySelector(s),aiLeft=q('.ai-listen-column'),aiRight=q('.ai-input-column');
 const manualLeft=q('.manual-stage-dock'),manualRight=q('#petMixer');
 const performance=q('.ai-performance-result');aiLeft.prepend(performance);
 const rail=q('.scene-rail');
 const stageHeading=document.createElement('div');stageHeading.className='ai-result-heading manual-performance-heading';stageHeading.innerHTML='<h2>Your pet performance</h2><p>Choose a scene, move your pets, then listen and save.</p>';manualLeft.prepend(stageHeading);
 const columns=[aiLeft,aiRight,manualLeft,manualRight];
 columns.forEach((column,i)=>{column.classList.add('studio-scroll-column');column.tabIndex=0;column.setAttribute('role','region');column.setAttribute('aria-label',['AI stage and previews','AI sound and generation controls','Manual stage and playback','Manual sound and composition controls'][i])});
 const desktop=matchMedia('(min-width: 901px)');
 function measure(){
  if(!desktop.matches)return;
  const mode=document.body.dataset.studioView;
  const grid=mode==='ai'?q('.ai-create-grid'):mode==='manual'?q('.workspace .left-column'):null;
  if(!grid)return;
  const top=grid.getBoundingClientRect().top;
  const height=Math.max(300,Math.floor(window.innerHeight-Math.max(0,top)-42));
  grid.style.setProperty('--studio-column-height',height+'px');
 }
 function route(){
  if(document.body.dataset.studioView==='manual'){manualLeft.prepend(stageHeading);manualLeft.insertBefore(rail,q('.bottom-row'));}
  requestAnimationFrame(measure);
 }
 window.addEventListener('resize',measure);desktop.addEventListener('change',measure);window.addEventListener('hashchange',route);
 if(document.fonts?.ready)document.fonts.ready.then(measure);
 if(window.ResizeObserver){const observer=new ResizeObserver(measure);observer.observe(q('.topbar'))}
 route();
})();
