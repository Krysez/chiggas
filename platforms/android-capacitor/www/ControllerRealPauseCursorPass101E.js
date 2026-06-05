/* CHIGGAS_STEAM_PASS_101E_REAL_PAUSE_CURSOR_FIX_BEGIN */
(function(){
if(window.__chiggas101e)return; window.__chiggas101e=true;
const PASS='steam_desktop_wrapper_pass_101e';
const st={pass:PASS,enabled:true,installedAt:new Date().toISOString(),controllerMode:false,lastControllerInputAt:0,lastMouseAt:0,pauseCount:0,lastPauseReason:null};
function save(){try{localStorage.setItem('chiggas_pass101e_real_pause_cursor',JSON.stringify(st,null,2));}catch(e){}}
function games(){let out=[];try{if(window.game)out.push(window.game);if(window.phaserGame)out.push(window.phaserGame);if(window.Phaser?.GAMES)out.push(...window.Phaser.GAMES)}catch(e){}return out.filter(Boolean)}
function scenes(){let out=[];for(const g of games()){try{out.push(...(g.scene?.scenes||[]))}catch(e){}}return out}
function activeScenes(){return scenes().filter(s=>{try{return s.scene?.isActive?.()}catch(e){return false}})}
function hideCursor(){try{document.body.style.cursor='none';document.documentElement.style.cursor='none'}catch(e){}}
function showCursor(){try{document.body.style.cursor='';document.documentElement.style.cursor=''}catch(e){}}
function markController(){st.controllerMode=true;st.lastControllerInputAt=Date.now();hideCursor();save();}
function markMouse(){st.lastMouseAt=Date.now();if(Date.now()-st.lastControllerInputAt>750){st.controllerMode=false;showCursor();save();}}
function realPause(reason){
 st.pauseCount++;st.lastPauseReason=reason;st.lastPauseAt=new Date().toISOString();save();
 let did=false;
 try{window.ChiggasControllerReviewCompliance?.pauseNow?.(reason);did=true}catch(e){}
 for(const s of activeScenes()){
   try{if(typeof s.pauseGame==='function'){s.pauseGame();did=true}}catch(e){}
   try{if(typeof s.showPauseMenu==='function'){s.showPauseMenu();did=true}}catch(e){}
   try{if(typeof s.togglePause==='function'){s.togglePause(true);did=true}}catch(e){}
   try{if(typeof s.handlePause==='function'){s.handlePause();did=true}}catch(e){}
   try{if(typeof s.openPauseMenu==='function'){s.openPauseMenu();did=true}}catch(e){}
   try{if(typeof s.setPaused==='function'){s.setPaused(true);did=true}}catch(e){}
   try{if('isPaused' in s){s.isPaused=true;did=true}}catch(e){}
   try{if('paused' in s){s.paused=true;did=true}}catch(e){}
   try{if(s.physics?.world){s.physics.world.pause();did=true}}catch(e){}
   try{if(s.sound?.pauseAll){s.sound.pauseAll();did=true}}catch(e){}
 }
 try{window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true,composed:true}));did=true}catch(e){}
 try{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true,composed:true}));did=true}catch(e){}
 try{window.dispatchEvent(new CustomEvent('chiggas-pass101e-real-pause',{detail:{pass:PASS,reason,did}}))}catch(e){}
 return{ok:true,pass:PASS,reason,did};
}
function controllerKey(k){return ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D','Enter',' ','Escape','e','E','r','R','f','F','Tab','q','Q','x','X'].includes(k)}
window.addEventListener('keydown',e=>{if(controllerKey(e.key))markController()},true);
window.addEventListener('keyup',e=>{if(controllerKey(e.key))markController()},true);
window.addEventListener('gamepadconnected',markController,true);
window.addEventListener('gamepaddisconnected',()=>realPause('gamepad_disconnected_event'),true);
window.addEventListener('mousemove',markMouse,true);
window.addEventListener('mousedown',markMouse,true);

let lastControllerPoll=0;
setInterval(()=>{
 if(!st.enabled)return;
 let pads=[];
 try{pads=Array.from(navigator.getGamepads?navigator.getGamepads():[]).filter(Boolean).filter(p=>p.connected)}catch(e){}
 if(pads.length){lastControllerPoll=Date.now();markController();return}
 const wasController=st.controllerMode || (Date.now()-st.lastControllerInputAt<120000);
 if(wasController && lastControllerPoll && Date.now()-lastControllerPoll>2500 && Date.now()-(st.lastPollPauseAt||0)>10000){
   st.lastPollPauseAt=Date.now();realPause('controller_missing_poll_real_pause');
 }
 if(st.controllerMode)hideCursor();
},1000);

window.ChiggasControllerRealPause={
 pass:PASS,
 getState(){save();return{...st,activeScenes:activeScenes().map(s=>s.scene?.key||s.sys?.settings?.key||null)}},
 pauseNow:realPause,
 hideCursor,
 showCursor,
 enable(){st.enabled=true;save();return{ok:true}},
 disable(){st.enabled=false;showCursor();save();return{ok:true}},
 selfTest(){return{ok:true,pass:PASS,state:{...st},activeScenes:activeScenes().map(s=>s.scene?.key||s.sys?.settings?.key||null),hasReviewCompliance:!!window.ChiggasControllerReviewCompliance}}
};
save();console.log('[Chiggas Pass 101E] Real pause + cursor fix loaded');
})();