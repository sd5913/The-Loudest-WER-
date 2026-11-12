// Original local WAV samples. Each pet can independently switch between pet voice and instrument.
const instruments=[
 {id:'piano',name:'Piano',zh:'像素钢琴',category:'keys',base:523.25,shift:0},
 {id:'guitar',name:'Guitar',zh:'吉他',category:'strings',base:392,shift:-12},
 {id:'bass',name:'Bass',zh:'贝斯',category:'strings',base:130.81,shift:-24},
 {id:'drum',name:'Drum',zh:'架子鼓',category:'perc',base:110,shift:0},
 {id:'synth',name:'Synth',zh:'合成器',category:'keys',base:523.25,shift:0},
 {id:'bell',name:'Bell',zh:'钟琴',category:'perc',base:659.25,shift:0},
 {id:'violin',name:'Violin',zh:'小提琴',category:'strings',base:440,shift:0},
 {id:'flute',name:'Flute',zh:'长笛',category:'wind',base:587.33,shift:0}
];
const instrumentBuffers=new Map();
let instrumentLoad=null,instrumentCategory='all';
async function loadInstrumentSamples(){
 if(instrumentLoad)return instrumentLoad;
 instrumentLoad=Promise.all(instruments.map(async instrument=>{
  try{
   const response=await fetch(`assets/instruments/${instrument.id}.wav`);
   if(!response.ok)throw new Error('Missing instrument audio');
   instrumentBuffers.set(instrument.id,await context.decodeAudioData(await response.arrayBuffer()));
  }catch(error){console.warn('Instrument sample unavailable:',instrument.id,error)}
 }));
 return instrumentLoad;
}
function playInstrument(p,time,noteOffset=0){
 const instrument=instruments.find(item=>item.id===(p.instrument||'piano'));
 const buffer=instrumentBuffers.get(instrument?.id);
 if(!instrument||!buffer||!context)return false;
 const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
 source.buffer=buffer;
 const frequency=(p.base||440)*2**(((p.pitch||0)+noteOffset+instrument.shift)/12);
 const rate=instrument.id==='drum'?2**((p.pitch||0)/24):Math.max(.25,Math.min(4,frequency/instrument.base));
 source.playbackRate.setValueAtTime(rate,time);
 filter.type='lowpass';
 filter.frequency.setValueAtTime(p.tone==='soft'?1300:p.tone==='robot'?2200:6500,time);
 const volume=Math.max(.001,(p.volume||0)/100*.55*((p.strength??70)/100*.7+.3));
 gain.gain.setValueAtTime(.0001,time);
 gain.gain.linearRampToValueAtTime(volume,time+.012);
 const duration=Math.min(buffer.duration/rate,1.2);
 gain.gain.exponentialRampToValueAtTime(.0001,time+Math.max(.06,duration));
 source.connect(filter).connect(gain);connectOutput(gain,p);
 source.start(time);source.stop(time+duration+.02);
 animate(p.id);
 return true;
}
function renderInstrumentPicker(p){
 const selected=p.instrument||'piano';
 document.querySelector('#instrumentPicker').hidden=p.source!=='instrument';
 document.querySelector('#voicePicker').hidden=p.source==='instrument';
 document.querySelector('#sourceInstrument').classList.toggle('active',p.source==='instrument');
 document.querySelector('#sourceSynth').classList.toggle('active',p.source!=='instrument');
 document.querySelectorAll('[data-instrument-category]').forEach(button=>{
  const active=button.dataset.instrumentCategory===instrumentCategory;
  button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
 });
 document.querySelector('#instrumentGrid').innerHTML=instruments.filter(item=>instrumentCategory==='all'||item.category===instrumentCategory).map(item=>
  `<button type="button" class="instrument-card ${item.id===selected?'active':''}" data-instrument="${item.id}" aria-pressed="${item.id===selected}"><img src="assets/instruments/${item.id}.svg" alt=""><b>${item.name}</b><small>${item.zh}</small></button>`
 ).join('');
}
document.querySelector('#sourceInstrument').addEventListener('click',async()=>{
 const p=pets.find(item=>item.id===selected);
 p.source='instrument';p.instrument||='piano';render();
 context ||= new(window.AudioContext||window.webkitAudioContext)();
 await context.resume();await loadInstrumentSamples();sound(p);
});
document.querySelector('#instrumentFilters').addEventListener('click',e=>{
 const button=e.target.closest('[data-instrument-category]');if(!button)return;
 instrumentCategory=button.dataset.instrumentCategory;
 renderInstrumentPicker(pets.find(item=>item.id===selected));
});
document.querySelector('#instrumentGrid').addEventListener('click',async e=>{
 const button=e.target.closest('[data-instrument]');if(!button)return;
 const p=pets.find(item=>item.id===selected);
 p.source='instrument';p.instrument=button.dataset.instrument;render();
 context ||= new(window.AudioContext||window.webkitAudioContext)();
 await context.resume();await loadInstrumentSamples();sound(p);
});
