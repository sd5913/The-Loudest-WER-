function localRoomTime(){const h=new Date().getHours();return h>=6&&h<19?'sunset':'night';}
function applyRoomTime(){let selected=WERStore.getMode();if(selected==='day'){selected='sunset';WERStore.saveMode(selected);}document.body.dataset.time=selected==='auto'?localRoomTime():selected;}
applyRoomTime();setInterval(()=>{if(WERStore.getMode()==='auto')applyRoomTime()},60000);
