/* CHIGGAS_STEAM_PASS_101C_CONTROLLER_PROMPTS_BEGIN */
(function(){
if(window.__chiggas101c)return; window.__chiggas101c=true;
const PASS='steam_desktop_wrapper_pass_101c';
const state={pass:PASS,enabled:true,visible:false,installedAt:new Date().toISOString(),mode:'menu'};
const sets={
 menu:[['A','Confirm'],['B','Back'],['D-Pad / Left Stick','Navigate'],['Start','Pause']],
 gameplay:[['A','Recruit'],['B','Eat'],['X','Charge'],['RT','Shoot'],['Start','Pause']],
 wardrobe:[['A','Confirm / Equip'],['B','Back'],['LB / RB','Switch Tabs'],['D-Pad / Left Stick','Navigate']],
 legendaryStore:[['A','Confirm / Purchase'],['B','Back'],['X','Restore Purchases'],['D-Pad / Left Stick','Navigate']],
 miniGame:[['A','Action'],['B','Back'],['D-Pad / Left Stick','Move'],['Start','Pause']],
 death:[['A','Continue'],['B','Back'],['Start','Continue']]
};
function save(){try{localStorage.setItem('chiggas_pass101c_prompts',JSON.stringify(state,null,2));}catch(e){}}
function style(){if(document.getElementById('chiggas101cstyle'))return;let s=document.createElement('style');s.id='chiggas101cstyle';s.textContent=`#chiggas101c{position:fixed;right:18px;bottom:18px;z-index:2147483400;pointer-events:none;display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.62);color:#fff;font:700 13px Arial;text-shadow:1px 1px 2px #000;border:1px solid rgba(255,255,255,.25)}#chiggas101c.hidden{display:none}#chiggas101c .r{display:flex;gap:8px;align-items:center;white-space:nowrap}#chiggas101c .b{min-width:26px;height:22px;padding:0 6px;border-radius:10px;background:rgba(255,255,255,.9);color:#111;display:inline-flex;align-items:center;justify-content:center;font-weight:900;text-shadow:none}`;document.head.appendChild(s);}
function box(){style();let b=document.getElementById('chiggas101c');if(!b){b=document.createElement('div');b.id='chiggas101c';document.body.appendChild(b)}return b}
function detect(){let txt='';try{txt=document.body.innerText||''}catch(e){};let k='';try{let gs=[];if(window.game)gs.push(window.game);if(window.phaserGame)gs.push(window.phaserGame);if(window.Phaser?.GAMES)gs.push(...window.Phaser.GAMES);for(const g of gs)for(const s of (g?.scene?.scenes||[]))if(s?.scene?.isActive?.())k=(s.scene.key||s.sys?.settings?.key||'').toLowerCase()}catch(e){};if(/legendary|store/i.test(k+txt))return'legendaryStore';if(/wardrobe|chigga wear/i.test(k+txt))return'wardrobe';if(/mini|maze|match/i.test(k))return'miniGame';if(/unalived|press any key/i.test(txt))return'death';if(/game/i.test(k))return'gameplay';return'menu'}
function render(m){if(!state.enabled)return hide();m=m||detect();let b=box();b.classList.remove('hidden');b.innerHTML=(sets[m]||sets.menu).map(x=>`<div class="r"><span class="b">${x[0]}</span><span>${x[1]}</span></div>`).join('');Object.assign(state,{visible:true,mode:m,updatedAt:new Date().toISOString()});save();return{ok:true,pass:PASS,mode:m,rows:sets[m]||sets.menu}}
function hide(){let b=document.getElementById('chiggas101c');if(b)b.classList.add('hidden');Object.assign(state,{visible:false,updatedAt:new Date().toISOString()});save();return{ok:true,pass:PASS}}
let last=0;function show(){last=Date.now();render();}
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D','Enter',' ','Escape','e','E','r','R','f','F','Tab','q','Q','x','X'].includes(e.key))show()},true);
window.addEventListener('gamepadconnected',show,true);
window.addEventListener('mousemove',()=>{if(Date.now()-last>2000)hide()},true);
setInterval(()=>{if(state.enabled&&Date.now()-last<8000)render()},1000);
window.ChiggasControllerPrompts={pass:PASS,show:render,hide,enable(){state.enabled=true;return render()},disable(){state.enabled=false;return hide()},setMode:render,getState(){save();return{...state}},getPromptSets(){return JSON.parse(JSON.stringify(sets))},selfTest(){return{ok:true,pass:PASS,state:{...state},promptSets:sets,activeMode:detect()}}};
setTimeout(()=>render('menu'),500);
console.log('[Chiggas Pass 101C] Controller prompt overlay loaded');
})();