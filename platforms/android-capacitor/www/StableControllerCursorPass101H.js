/* CHIGGAS_STEAM_PASS_101H_STABLE_CURSOR_ONLY_BEGIN */
(function(){
if(window.__chiggas101h)return; window.__chiggas101h=true;
const PASS='steam_desktop_wrapper_pass_101h';
const st={pass:PASS,enabled:true,controllerMode:false,lastControllerAt:0,lastMouseAt:0,installedAt:new Date().toISOString()};
function save(){try{localStorage.setItem('chiggas_pass101h_stable_cursor_only',JSON.stringify(st,null,2));}catch(e){}}
function hide(){try{document.body.style.cursor='none';document.documentElement.style.cursor='none'}catch(e){}}
function show(){try{document.body.style.cursor='';document.documentElement.style.cursor=''}catch(e){}}
function controller(){st.controllerMode=true;st.lastControllerAt=Date.now();hide();save();}
function mouse(){st.lastMouseAt=Date.now();if(Date.now()-st.lastControllerAt>750){st.controllerMode=false;show();save();}}
function key(k){return ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D','Enter',' ','Escape','e','E','r','R','f','F','Tab','q','Q','x','X'].includes(k)}
window.addEventListener('keydown',e=>{if(key(e.key))controller()},true);
window.addEventListener('keyup',e=>{if(key(e.key))controller()},true);
window.addEventListener('gamepadconnected',controller,true);
window.addEventListener('mousemove',mouse,true);
window.addEventListener('mousedown',mouse,true);
setInterval(()=>{if(st.enabled&&st.controllerMode)hide()},1000);
window.ChiggasStableControllerCursor={pass:PASS,getState(){save();return{...st}},hideCursor:hide,showCursor:show,enable(){st.enabled=true;save();return{ok:true}},disable(){st.enabled=false;show();save();return{ok:true}},selfTest(){return{ok:true,pass:PASS,state:{...st}}}};
save();console.log('[Chiggas Pass 101H] Stable controller cursor loaded');
})();