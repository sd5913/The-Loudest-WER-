/* Optional local design handoff: real DOM → native SVG shapes/text/images.
   Add ?design=1 to enable. No foreignObject or flattened page screenshot. */
(() => {
 if(!new URLSearchParams(location.search).has('design'))return;
 const NS='http://www.w3.org/2000/svg';let seq=0,serial=0;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const n=x=>Math.round(x*100)/100;
 const attrs=o=>Object.entries(o).filter(([,v])=>v!==undefined).map(([k,v])=>`${k}="${esc(v)}"`).join(' ');
 const tag=(name,a,body='')=>`<${name} ${attrs(a)}>${body}</${name}>`;
 const transparent=c=>!c||c==='transparent'||c==='rgba(0, 0, 0, 0)';
 function label(e){return e.id||e.getAttribute('aria-label')||e.className?.baseVal||e.className||e.tagName.toLowerCase()}
 function rect(e){const r=e.getBoundingClientRect();return {x:n(r.left+scrollX),y:n(r.top+scrollY),width:n(r.width),height:n(r.height)}}
 function dataImage(img){try{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);return c.toDataURL('image/png')}catch{return img.currentSrc||img.src}}
 function svgText(value,x,y,s,extra={}){return tag('text',{x:n(x),y:n(y),fill:s.color,'font-family':s.fontFamily,'font-size':parseFloat(s.fontSize),'font-weight':s.fontWeight,'font-style':s.fontStyle,'letter-spacing':s.letterSpacing==='normal'?undefined:s.letterSpacing,...extra},esc(value))}
 function capture(){
  seq=0;let defs=[];
  const w=Math.max(document.documentElement.clientWidth,document.documentElement.scrollWidth),h=Math.max(document.documentElement.scrollHeight,innerHeight);
  const makeRect=(r,fill,stroke,width,rx=0)=>tag('rect',{...r,rx:n(rx),fill,stroke,'stroke-width':width||undefined});
  function gradient(s,r){
   if(!s.backgroundImage.startsWith('linear-gradient'))return s.backgroundColor;
   let cols=s.backgroundImage.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}\b/gi);if(!cols?.length)return s.backgroundColor;
   const id='gradient-'+(++seq);defs.push(tag('linearGradient',{id,x1:0,y1:0,x2:'100%',y2:0},cols.map((c,i)=>{const m=c.match(/^rgba\(([^,]+),([^,]+),([^,]+),([^\)]+)\)$/);return tag('stop',{offset:(i/(cols.length-1||1)*100)+'%','stop-color':m?`rgb(${m[1]},${m[2]},${m[3]})`:c,'stop-opacity':m?Number(m[4]):undefined})}).join('')));return `url(#${id})`;
  }
  function textNode(node,e,s){
   if(!node.textContent.trim())return '';
   const text=node.textContent,range=document.createRange();let lines=[],group=null;
   for(let i=0;i<text.length;i++){
    range.setStart(node,i);range.setEnd(node,i+1);const rr=range.getBoundingClientRect();if(!rr.width&&!rr.height)continue;
    if(!group||Math.abs(group.top-rr.top)>2||rr.left<group.right-2){group={top:rr.top,left:rr.left,right:rr.right,text:text[i],height:rr.height};lines.push(group)}
    else{group.text+=text[i];group.right=rr.right;}
   }
   return lines.map(l=>svgText(l.text.replace(/\s+/g,' '),l.left+scrollX,l.top+scrollY+l.height*.79,s,{'xml:space':'preserve'})).join('');
  }
  function paint(e){
   if(e.nodeType!==1||['SCRIPT','STYLE','LINK','META','TITLE','OPTION'].includes(e.tagName)||e.closest('.design-tools'))return '';
   const s=getComputedStyle(e),r=rect(e);
   if(s.display==='none'||s.visibility==='hidden'||s.opacity==='0')return '';
   if((!r.width||!r.height)&&!e.children.length)return '';
   const id='layer-'+(++seq),out=[];let fill=gradient(s,r),stroke=s.borderTopColor,border=parseFloat(s.borderTopWidth)||0;
   if(!transparent(fill)||border)out.push(makeRect(r,transparent(fill)?'none':fill,border?stroke:undefined,border,parseFloat(s.borderTopLeftRadius)||0));
   if(e.tagName==='IMG'&&e.complete&&e.naturalWidth){
    out.push(tag('image',{...r,href:dataImage(e),'preserveAspectRatio':s.objectFit==='cover'?'xMidYMid slice':'xMidYMid meet','data-name':'Pixel artwork — replaceable image'}));
   } else if(e.tagName==='CANVAS'){
    if(e.id==='landscape'&&!e.hidden||!['landscape','photoPreview'].includes(e.id)){
     try{out.push(tag('image',{...r,href:e.toDataURL(),'data-name':'Canvas preview'}))}catch{}
    }else if(e.id==='photoPreview'){try{out.push(tag('image',{...r,href:e.toDataURL(),'data-name':'Pixel photo preview'}))}catch{}}
   } else if(e.tagName.toLowerCase()==='svg'){
    const clone=e.cloneNode(true);clone.setAttribute('x',r.x);clone.setAttribute('y',r.y);clone.setAttribute('width',r.width);clone.setAttribute('height',r.height);out.push(new XMLSerializer().serializeToString(clone));
   } else if(e.tagName==='INPUT'){
    const x=r.x+12,y=r.y+r.height/2;
    if(e.type==='range'){
     const pct=(Number(e.value)-Number(e.min||0))/(Number(e.max||100)-Number(e.min||0)),cy=r.y+r.height/2,cx=r.x+9+pct*(r.width-18);
     out.push(makeRect({x:r.x+8,y:cy-3,width:r.width-16,height:6},'#755184',undefined,0,3));out.push(makeRect({x:r.x+8,y:cy-3,width:n(Math.max(0,cx-r.x-8)),height:6},'#f4a3d1',undefined,0,3));out.push(tag('circle',{cx:n(cx),cy:n(cy),r:9,fill:'#ffe2ef',stroke:'#c98ab7','stroke-width':2}));
    }else if(e.type==='checkbox'){
     out.push(makeRect({x:r.x,y:r.y,width:Math.min(r.width,18),height:Math.min(r.height,18)},e.checked?'#bd78bd':'#362448','#bf92ca',1,3));if(e.checked)out.push(svgText('✓',r.x+2,r.y+14,{...s,color:'#ffffff',fontSize:'14px',fontFamily:'Arial',fontWeight:700}));
    }else if(e.type==='file'){out.push(svgText(e.files?.[0]?.name||'Choose file',x,y+5,s));}
    else out.push(svgText(e.value||e.placeholder,x,y+parseFloat(s.fontSize)*.34,{color:e.value?s.color:'#a99aaf',fontSize:s.fontSize,fontFamily:s.fontFamily,fontWeight:s.fontWeight}));
   }else if(e.tagName==='SELECT'){
    out.push(svgText(e.selectedOptions[0]?.text||'',r.x+10,r.y+r.height/2+parseFloat(s.fontSize)*.34,s));out.push(svgText('⌄',r.x+r.width-20,r.y+r.height/2+4,s));
   }else if(e.tagName==='TEXTAREA'){
    const value=e.value||e.placeholder;let words=value.split(' '),lines=[''];for(const word of words){let last=lines.length-1;if((lines[last]+word).length>r.width/(parseFloat(s.fontSize)*.55))lines.push(word+' ');else lines[last]+=word+' ';}
    lines.slice(0,Number(e.rows)||3).forEach((line,i)=>out.push(svgText(line,r.x+10,r.y+parseFloat(s.fontSize)*(1.4+i*1.4),s)));
   }else if(e.tagName==='AUDIO'){
    out.push(makeRect(r,'#f1ebf4',undefined,0,20));out.push(svgText('▶   0:00   ━━━━━━━━━   ◖))',r.x+15,r.y+r.height/2+5,{color:'#31233b',fontFamily:'Arial',fontSize:'13px',fontWeight:400}));
   }else{
    let children=[...e.childNodes];
    if(e.tagName==='DETAILS'&&!e.open)children=children.filter(x=>x.nodeType===1&&x.tagName==='SUMMARY');
    // Preserve DOM text order; position-only layers are painted after ordinary content.
    const normal=children.filter(x=>x.nodeType!==1||Number(getComputedStyle(x).zIndex)<=0||getComputedStyle(x).zIndex==='auto');
    const high=children.filter(x=>x.nodeType===1&&Number(getComputedStyle(x).zIndex)>0).sort((a,b)=>Number(getComputedStyle(a).zIndex)-Number(getComputedStyle(b).zIndex));
    for(const child of [...normal,...high])out.push(child.nodeType===3?textNode(child,e,s):paint(child));
   }
   let clip;
   if(['hidden','auto','scroll'].includes(s.overflowX)||['hidden','auto','scroll'].includes(s.overflowY)||e.tagName==='IMG'){
    clip='clip-'+(++seq);defs.push(tag('clipPath',{id:clip},makeRect(r,'white',undefined,0,parseFloat(s.borderTopLeftRadius)||0)));
   }
   return tag('g',{id,'data-name':label(e),'data-bounds':[r.x,r.y,r.width,r.height].join(' '),opacity:s.opacity==='1'?undefined:s.opacity,'clip-path':clip?`url(#${clip})`:undefined},out.join(''));
  }
  const bodyStyle=getComputedStyle(document.body);let background=gradient(bodyStyle,{x:0,y:0,width:w,height:h});if(transparent(background))background='#100d20';let scene=makeRect({x:0,y:0,width:w,height:h},transparent(bodyStyle.backgroundColor)?'#100d20':bodyStyle.backgroundColor);scene+=makeRect({x:0,y:0,width:w,height:h},background);
  const dialogs=[...document.querySelectorAll('dialog[open]')];
  for(const child of document.body.children)if(child.tagName!=='DIALOG')scene+=paint(child);
  if(dialogs.length){scene+=makeRect({x:0,y:scrollY,width:w,height:innerHeight},'#0a071b','none',0);scene+=tag('rect',{x:0,y:scrollY,width:w,height:innerHeight,fill:'#211329',opacity:.65});for(const d of dialogs)scene+=paint(d);}
  return `<svg xmlns="${NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>${esc(document.title)}</title><desc>Actual rendered page. Editable UI shapes and text; pixel artwork is embedded as separate images. Exported at ${innerWidth}px viewport.</desc><defs>${defs.join('')}</defs>${scene}</svg>`;
 }
 const box=document.createElement('div');box.className='design-tools';box.innerHTML='<input aria-label="SVG state name" id="svgStateName" placeholder="page-state-name"><button id="exportDesignSvg" type="button">Export editable SVG</button><span id="svgExportStatus" role="status"></span>';document.body.append(box);
 async function save(){
  try{
   const page=location.pathname.split('/').pop().replace('.html','')||'home',dialog=document.querySelector('dialog[open]')?.id;
   const name=document.querySelector('#svgStateName').value||`${page}-${dialog||document.body.dataset.time||'state'}-${String(++serial).padStart(2,'0')}`;
   const svg=capture();const response=await fetch('/__design-export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,svg})});
   if(!response.ok)throw Error('No local export endpoint');document.querySelector('#svgExportStatus').textContent='Saved';
  }catch(error){const svg=capture(),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));a.download=(document.querySelector('#svgStateName').value||'WER-page-state')+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
 }
 window.WERDesignExport={capture,save};
 document.querySelector('#exportDesignSvg').addEventListener('click',save);
 document.addEventListener('keydown',e=>{if(e.altKey&&e.shiftKey&&e.code==='KeyE'){e.preventDefault();save();}});
})();
