/* CHIGGAS_STEAM_PASS_102A_WALLET_NOTICE_OVERLAY_PAUSE_BEGIN */
(function(){
if(window.__chiggas102a)return; window.__chiggas102a=true;
const PASS='steam_desktop_wrapper_pass_102a';
const st={pass:PASS,enabled:true,installedAt:new Date().toISOString(),overlayPauseCount:0,noticeClearCount:0,lastOverlayPause:null,lastNoticeClear:null};
function save(){try{localStorage.setItem('chiggas_pass102a_wallet_notice_overlay_pause',JSON.stringify(st,null,2));}catch(e){}}
function esc(){
 const opt={key:'Escape',code:'Escape',which:27,keyCode:27,bubbles:true,cancelable:true,composed:true};
 try{window.dispatchEvent(new KeyboardEvent('keydown',opt))}catch(e){}
 try{document.dispatchEvent(new KeyboardEvent('keydown',opt))}catch(e){}
 try{document.body&&document.body.dispatchEvent(new KeyboardEvent('keydown',opt))}catch(e){}
}
function overlayPause(reason){
 if(!st.enabled)return;
 const now=Date.now();
 if(now-(st.lastOverlayPauseMs||0)<2500)return;
 st.lastOverlayPauseMs=now; st.overlayPauseCount++; st.lastOverlayPause={reason,at:new Date().toISOString()}; save();
 setTimeout(esc,40);
 setTimeout(esc,140);
 try{window.dispatchEvent(new CustomEvent('chiggas-pass102a-overlay-pause',{detail:{pass:PASS,reason}}))}catch(e){}
}
function isWalletCancelNoticeText(t){
 t=String(t||'').toLowerCase();
 return t.includes('steam wallet purchase canceled') ||
        t.includes('steam wallet purchase cancelled') ||
        t.includes('steam wallet purchase already in progress') ||
        t.includes('purchase canceled or not completed') ||
        t.includes('purchase cancelled or not completed');
}
function hideElement(el){
 try{
   el.style.transition='opacity 160ms ease';
   el.style.opacity='0';
   setTimeout(()=>{try{el.remove()}catch(e){}},180);
   st.noticeClearCount++; st.lastNoticeClear={at:new Date().toISOString(),text:(el.innerText||el.textContent||'').slice(0,160)}; save();
   return true;
 }catch(e){return false}
}
function clearWalletNotices(){
 let cleared=0;
 try{
   const nodes=[...document.querySelectorAll('body *')];
   for(const el of nodes){
     const text=(el.innerText||el.textContent||'').trim();
     if(!text || text.length>260)continue;
     if(isWalletCancelNoticeText(text)){
       if(hideElement(el))cleared++;
     }
   }
 }catch(e){}
 return{ok:true,pass:PASS,cleared};
}
function installNoticeAutoCleaner(){
 setInterval(()=>{
   if(!st.enabled)return;
   clearWalletNotices();
 },5000);
 window.addEventListener('keydown',()=>setTimeout(clearWalletNotices,300),true);
 window.addEventListener('mousedown',()=>setTimeout(clearWalletNotices,300),true);
}
window.addEventListener('blur',()=>overlayPause('window_blur_or_steam_overlay'),true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)overlayPause('document_hidden_or_steam_overlay')},true);

window.ChiggasWalletNoticeOverlayFix={
 pass:PASS,
 clearWalletNotices,
 overlayPauseNow(reason='manual_test'){overlayPause(reason);return{ok:true,pass:PASS,reason}},
 getState(){save();return{...st}},
 enable(){st.enabled=true;save();return{ok:true}},
 disable(){st.enabled=false;save();return{ok:true}},
 selfTest(){return{ok:true,pass:PASS,state:{...st},hasApi:true}}
};
installNoticeAutoCleaner();
save();
console.log('[Chiggas Pass 102A] Wallet notice cleanup + overlay pause restore loaded');
})();