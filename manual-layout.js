/* Presentation only. Share the mode switch and two-column visual language. */
(() => {
 const q=s=>document.querySelector(s),workspace=q('.workspace');
 const header=document.createElement('header');header.id='manualStudioHeader';header.className='ai-layout-header';
 header.innerHTML='<div><p class="eyebrow">EVERY BEAT IS YOURS</p><h1>Music Studio</h1></div><nav class="ai-mode-switch" aria-label="Studio mode"><a href="#ai">AI Generate</a><a href="#manual" class="active" aria-current="page">Manual Compose</a></nav>';
 workspace.before(header);
 const dock=document.createElement('div');dock.className='manual-stage-dock';q('.left-column').prepend(dock);
 const stage=q('.stage-window'),save=q('.bottom-row');
 function route(){if(document.body.dataset.studioView==='manual')dock.append(stage,save)}
 window.addEventListener('hashchange',route);route();
})();
