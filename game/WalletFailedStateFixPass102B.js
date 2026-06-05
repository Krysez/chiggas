/* CHIGGAS_STEAM_PASS_102B_WALLET_FAILED_STATE_FIX_BEGIN */
(function(){
if(window.__chiggas102b)return; window.__chiggas102b=true;
const PASS='steam_desktop_wrapper_pass_102b';
const st={pass:PASS,installedAt:new Date().toISOString(),enabled:true,clearCount:0,lastClear:null,lastSeen:null};
function save(){try{localStorage.setItem('chiggas_pass102b_wallet_failed_state_fix',JSON.stringify(st,null,2));}catch(e){}}
function textIsWalletNotice(t){
 t=String(t||'').toLowerCase();
 return t.includes('steam wallet opened') ||
        t.includes('steam wallet purchase canceled') ||
        t.includes('steam wallet purchase cancelled') ||
        t.includes('purchase canceled or not completed') ||
        t.includes('purchase cancelled or not completed') ||
        t.includes('steam wallet purchase already in progress');
}
function removeWalletNotices(){
 let count=0;
 try{
  for(const el of [...document.querySelectorAll('body *')]){
    const txt=(el.innerText||el.textContent||'').trim();
    if(!txt || txt.length>260)continue;
    if(textIsWalletNotice(txt)){
      el.remove(); count++;
    }
  }
 }catch(e){}
 return count;
}
function getTrace(){
 try{return window.ChiggasSteamWalletPurchase?.getTrace?.()||null}catch(e){return null}
}
function steamTxnStatus(trace){
 try{
  return trace?.lastQuery?.body?.steam?.body?.response?.params?.status ||
         trace?.lastQuery?.body?.steam?.body?.response?.params?.items?.[0]?.itemstatus ||
         trace?.lastQuery?.body?.response?.params?.status ||
         null;
 }catch(e){return null}
}
function clear(reason){
 const api=window.ChiggasSteamWalletPurchase;
 try{api?.clearPendingSafe?.(reason)}catch(e){}
 try{api?.clearPending?.(reason)}catch(e){}
 const removed=removeWalletNotices();
 st.clearCount++; st.lastClear={reason,removed,at:new Date().toISOString()}; save();
 return{ok:true,pass:PASS,reason,removed};
}
function watchdog(){
 if(!st.enabled)return;
 const tr=getTrace();
 if(!tr)return;
 const status=steamTxnStatus(tr);
 st.lastSeen={pending:!!tr.pending,activeOrderId:tr.activeOrderId||null,activeItemDefId:tr.activeItemDefId||null,status,at:new Date().toISOString()};
 const bad=/failed|fail|denied|cancel|canceled|cancelled|void|refund/i.test(String(status||''));
 if(tr.pending && bad) clear('steam_query_terminal_status_'+status);
 if(!tr.pending) removeWalletNotices();
 save();
}
setInterval(watchdog,1000);
window.addEventListener('keydown',()=>setTimeout(watchdog,100),true);
window.addEventListener('mousedown',()=>setTimeout(watchdog,100),true);
window.ChiggasWalletFailedStateFix={
 pass:PASS,
 watchdog,
 clearNow(reason='manual_clear'){return clear(reason)},
 removeWalletNotices,
 getState(){watchdog();return{...st,trace:getTrace()}},
 enable(){st.enabled=true;save();return{ok:true}},
 disable(){st.enabled=false;save();return{ok:true}},
 selfTest(){return{ok:true,pass:PASS,state:{...st},hasWalletApi:!!window.ChiggasSteamWalletPurchase}}
};
save();
console.log('[Chiggas Pass 102B] Wallet failed-state fix loaded');
})();