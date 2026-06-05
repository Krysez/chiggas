/* CHIGGAS_STEAM_PASS_101D_CONTROLLER_DISCONNECT_PAUSE_BEGIN */
(function(){
if(window.__chiggas101d)return; window.__chiggas101d=true;
const PASS='steam_desktop_wrapper_pass_101d';
const state={pass:PASS,installedAt:new Date().toISOString(),enabled:true,lastControllerSeenAt:0,lastInputAt:0,hadController:false,pausedCount:0,lastPauseReason:null};
function save(){try{localStorage.setItem('chiggas_pass101d_disconnect_pause',JSON.stringify(state,null,2));}catch(e){}}
function pads(){try{return Array.from(navigator.getGamepads?navigator.getGamepads():[]).filter(Boolean).filter(p=>p.connected)}catch(e){return[]}}
function activeScene(){try{let gs=[];if(window.game)gs.push(window.game);if(window.phaserGame)gs.push(window.phaserGame);if(window.Phaser?.GAMES)gs.push(...window.Phaser.GAMES);for(const g of gs)for(const s of (g?.scene?.scenes||[]))if(s?.scene?.isActive?.())return s}catch(e){}return null}
function pause(reason){
 if(!state.enabled)return {ok:false,reason:'disabled'};
 state.pausedCount++; state.lastPauseReason=reason; state.lastPauseAt=new Date().toISOString(); save();
 try{window.ChiggasControllerReviewCompliance?.pauseNow?.(reason)}catch(e){}
 try{window.dispatchEvent(new CustomEvent('chiggas-controller-disconnect-pause',{detail:{pass:PASS,reason}}))}catch(e){}
 try{window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true,composed:true}))}catch(e){}
 try{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true,composed:true}))}catch(e){}
 try{let s=activeScene(); if(s?.scene?.pause)s.scene.pause();}catch(e){}
 return {ok:true,pass:PASS,reason};
}
function markInput(source){
 state.lastInputAt=Date.now(); state.lastInputSource=source;
 if(source==='gamepad'||source==='steam_keyboard_output'){state.hadController=true;state.lastControllerSeenAt=Date.now();}
 save();
}
function keyIsControllerLayoutKey(k){return ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D','Enter',' ','Escape','e','E','r','R','f','F','Tab','q','Q','x','X'].includes(k)}
window.addEventListener('gamepadconnected',e=>{state.hadController=true;state.lastControllerSeenAt=Date.now();state.lastGamepadId=e.gamepad?.id||null;save();},true);
window.addEventListener('gamepaddisconnected',e=>{state.lastGamepadDisconnectedAt=new Date().toISOString();state.lastGamepadId=e.gamepad?.id||null;save();pause('gamepad_disconnected_event');},true);
window.addEventListener('keydown',e=>{if(keyIsControllerLayoutKey(e.key))markInput('steam_keyboard_output')},true);
window.addEventListener('mousemove',()=>{state.lastMouseAt=Date.now();save();},true);

setInterval(()=>{
 if(!state.enabled)return;
 const count=pads().length;
 if(count>0){state.hadController=true;state.lastControllerSeenAt=Date.now();state.lastPadCount=count;save();return;}
 const now=Date.now();
 const recentlyUsingController=state.lastInputAt && now-state.lastInputAt<120000 && state.lastInputSource==='steam_keyboard_output';
 const noRecentMouse=!state.lastMouseAt || now-state.lastMouseAt>3000;
 if(state.hadController && recentlyUsingController && noRecentMouse && now-state.lastControllerSeenAt>2500 && now-(state.lastDisconnectPollPauseAt||0)>10000){
   state.lastDisconnectPollPauseAt=now; save(); pause('controller_missing_after_steam_input_activity');
 }
},1000);

window.ChiggasControllerDisconnectPause={
 pass:PASS,
 getState(){save();return {...state,padCount:pads().length}},
 pauseNow:pause,
 enable(){state.enabled=true;save();return{ok:true,enabled:true}},
 disable(){state.enabled=false;save();return{ok:true,enabled:false}},
 markControllerInput(){markInput('manual_controller');return{ok:true}},
 selfTest(){return{ok:true,pass:PASS,state:{...state},padCount:pads().length,hasReviewCompliance:!!window.ChiggasControllerReviewCompliance}}
};
save();
console.log('[Chiggas Pass 101D] Controller disconnect pause restored');
})();