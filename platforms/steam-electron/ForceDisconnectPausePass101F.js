/* CHIGGAS_STEAM_PASS_101F_FORCE_DISCONNECT_PAUSE_BEGIN */
(function(){
if(window.__chiggas101f)return; window.__chiggas101f=true;
const PASS='steam_desktop_wrapper_pass_101f';
const st={pass:PASS,installedAt:new Date().toISOString(),enabled:true,lastPause:null,pauseCount:0,lastControllerInputAt:0,lastMouseAt:0,controllerMode:false};
function save(){try{localStorage.setItem('chiggas_pass101f_force_disconnect_pause',JSON.stringify(st,null,2));}catch(e){}}
function allScenes(){let out=[];try{let gs=[];if(window.game)gs.push(window.game);if(window.phaserGame)gs.push(window.phaserGame);if(window.Phaser?.GAMES)gs.push(...window.Phaser.GAMES);for(const g of gs)out.push(...(g.scene?.scenes||[]))}catch(e){}return out.filter(Boolean)}
function activeScenes(){return allScenes().filter(s=>{try{return s.scene?.isActive?.()}catch(e){return false}})}
function hideCursor(){try{document.body.style.cursor='none';document.documentElement.style.cursor='none'}catch(e){}}
function showCursor(){try{document.body.style.cursor='';document.documentElement.style.cursor=''}catch(e){}}
function dispatchEsc(){
 try{window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',which:27,keyCode:27,bubbles:true,cancelable:true,composed:true}))}catch(e){}
 try{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',which:27,keyCode:27,bubbles:true,cancelable:true,composed:true}))}catch(e){}
 try{document.body&&document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',which:27,keyCode:27,bubbles:true,cancelable:true,composed:true}))}catch(e){}
}
function freezeScene(s){
 let did=false;
 try{if(s.physics?.world){s.physics.world.pause();did=true}}catch(e){}
 try{if(s.time){s.time.paused=true;did=true}}catch(e){}
 try{if(s.tweens?.pauseAll){s.tweens.pauseAll();did=true}}catch(e){}
 try{if(s.anims?.pauseAll){s.anims.pauseAll();did=true}}catch(e){}
 try{if(s.sound?.pauseAll){s.sound.pauseAll();did=true}}catch(e){}
 try{if('isPaused' in s){s.isPaused=true;did=true}}catch(e){}
 try{if('paused' in s){s.paused=true;did=true}}catch(e){}
 try{if(typeof s.pauseGame==='function'){s.pauseGame();did=true}}catch(e){}
 try{if(typeof s.showPauseMenu==='function'){s.showPauseMenu();did=true}}catch(e){}
 try{if(typeof s.openPauseMenu==='function'){s.openPauseMenu();did=true}}catch(e){}
 try{if(typeof s.togglePause==='function'){s.togglePause(true);did=true}}catch(e){}
 try{if(typeof s.handlePause==='function'){s.handlePause();did=true}}catch(e){}
 return did;
}
function forcePause(reason){
 if(!st.enabled)return{ok:false,reason:'disabled'};
 st.pauseCount++; st.lastPause={reason,at:new Date().toISOString()}; save();
 let did=false;
 try{window.ChiggasControllerReviewCompliance?.pauseNow?.(reason);did=true}catch(e){}
 try{window.ChiggasControllerRealPause?.pauseNow?.(reason);did=true}catch(e){}
 dispatchEsc(); setTimeout(dispatchEsc,80); setTimeout(dispatchEsc,180);
 for(const s of activeScenes()) if(freezeScene(s)) did=true;
 setTimeout(()=>{for(const s of activeScenes())freezeScene(s)},250);
 try{window.dispatchEvent(new CustomEvent('chiggas-force-disconnect-pause',{detail:{pass:PASS,reason,did}}))}catch(e){}
 return{ok:true,pass:PASS,reason,did,activeScenes:activeScenes().map(s=>s.scene?.key||s.sys?.settings?.key||null)};
}
function controllerKey(k){return ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D','Enter',' ','Escape','e','E','r','R','f','F','Tab','q','Q','x','X'].includes(k)}
function markController(){st.controllerMode=true;st.lastControllerInputAt=Date.now();hideCursor();save();}
function markMouse(){st.lastMouseAt=Date.now();if(Date.now()-st.lastControllerInputAt>750){st.controllerMode=false;showCursor();save();}}
window.addEventListener('keydown',e=>{if(controllerKey(e.key))markController()},true);
window.addEventListener('keyup',e=>{if(controllerKey(e.key))markController()},true);
window.addEventListener('gamepadconnected',markController,true);
window.addEventListener('gamepaddisconnected',()=>forcePause('gamepad_disconnected_force_pause'),true);
window.addEventListener('mousemove',markMouse,true);
window.addEventListener('mousedown',markMouse,true);

let everHadPad=false,lastPadSeen=0,lastPausePoll=0;
setInterval(()=>{
 if(!st.enabled)return;
 let pads=[];try{pads=Array.from(navigator.getGamepads?navigator.getGamepads():[]).filter(Boolean).filter(p=>p.connected)}catch(e){}
 if(pads.length){everHadPad=true;lastPadSeen=Date.now();markController();return}
 const now=Date.now();
 const wasUsingController=st.controllerMode || now-st.lastControllerInputAt<120000 || everHadPad;
 if(wasUsingController && lastPadSeen && now-lastPadSeen>2000 && now-lastPausePoll>10000){
   lastPausePoll=now; forcePause('controller_missing_force_pause_poll');
 }
 if(st.controllerMode)hideCursor();
},500);

window.ChiggasForceDisconnectPause={
 pass:PASS,
 forcePause,
 getState(){save();return{...st,everHadPad,lastPadSeen,lastPadAgeMs:lastPadSeen?Date.now()-lastPadSeen:null,activeScenes:activeScenes().map(s=>s.scene?.key||s.sys?.settings?.key||null)}},
 selfTest(){return{ok:true,pass:PASS,state:this.getState(),activeSceneCount:activeScenes().length}},
 enable(){st.enabled=true;save();return{ok:true}},
 disable(){st.enabled=false;showCursor();save();return{ok:true}}
};
save();console.log('[Chiggas Pass 101F] Force disconnect pause loaded');
})();