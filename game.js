(() => {
'use strict';
// Aetherwilds V4.6: depth/occlusion hardening — Y-sorted actors, authored plate occlusion, grass depth, signage correction.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W=1280,H=720;
const BUILD='V4.6.0-depth-hardened';
const PLAYER_TOP_SAFE_Y=138;
const DIR_DOWN=0, DIR_RIGHT=1, DIR_LEFT=2, DIR_UP=3;
ctx.imageSmoothingEnabled = false;

const A='assets/';
const assetNames = [
 'battle_forest_clean.webp',
 'brambit_battle.webp',
 'brambit_ow_hd.webp',
 'cave_plate.webp',
 'elara_portrait.webp',
 'forest_plate.webp',
 'kael_portrait.webp',
 'kael_sheet_hd.webp',
 'lodge_plate.webp',
 'mira_portrait.webp',
 'mira_sheet_hd.webp',
 'mossprig_battle.webp',
 'mossprig_ow_hd.webp',
 'player_portrait.webp',
 'player_sheet_authored.webp',
 'pyrel_battle.webp',
 'pyrel_ow_hd.webp',
 'ripplefin_battle.webp',
 'ripplefin_ow_hd.webp',
 'ruins_plate.webp',
 'title_concept.webp',
 'town_plate.webp'
];
const assets={};
let loaded=0,assetFailures=0,booted=false;

function load(){
  const settle=(n,im,ok)=>{
    if(ok)assets[n]=im;else{assetFailures++;console.error('Missing asset',n);}
    loaded++;if(loaded===assetNames.length)start();
  };
  for(const n of assetNames){
    const im=new Image();let done=false;
    im.onload=()=>{if(done)return;done=true;settle(n,im,true);};
    im.onerror=()=>{if(done)return;done=true;settle(n,im,false);};
    im.src=A+n;
  }
  // A stalled CDN request should not leave the entire game on a permanent blank screen.
  setTimeout(()=>{if(!booted&&loaded<assetNames.length){console.warn(`Booting with ${assetNames.length-loaded} unresolved asset(s).`);start();}},8000);
}

const state={
  scene:'title', previousScene:'town', started:false, debug:false, menuOpen:false,
  starter:null, marks:300, capsules:5, party:[], reserve:[], encounterCooldown:0, autosaveClock:0,
  flags:{intro:false,starterChosen:false,rivalWon:false,captured:false,trainerWon:false,caveCrystal:false,wardenWon:false,ruinsSeen:false},
  quests:{fractured:{title:'The Fractured Aether',text:'Investigate unusual Aether readings beyond Emberbrook.',done:false},
          lost:{title:'A Flicker in the Grass',text:'Capture a wild Lumling on Verdant Route.',done:false}},
  player:{x:640,y:640,dir:0,frame:0,moving:false},
  dialogue:null,battle:null,toast:null
};

const keys={};
let justPressed=new Set();
window.addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if(!keys[e.code]) justPressed.add(e.code); keys[e.code]=true;
  if(e.code==='F2'){state.debug=!state.debug;e.preventDefault();}
  if(e.code==='F3'&&typeof VALID_SCENES!=='undefined'&&VALID_SCENES.has(state.scene)){
    const safe=SAFE_SPAWNS[state.scene]||[640,600];state.player.x=safe[0];state.player.y=safe[1];state.player.moving=false;showToast('Position recovered to a safe waypoint.');saveGame(false);e.preventDefault();
  }
  if(state.menuOpen&&e.code==='KeyS'){saveGame(true);e.preventDefault();}
  if(e.code==='Escape'){
    if(state.dialogue){advanceDialogue();e.preventDefault();}
    else if(state.scene!=='title'&&state.scene!=='battle'){state.menuOpen=!state.menuOpen;state.player.moving=false;if(state.menuOpen)saveGame(false);}
  }
});
window.addEventListener('keyup',e=>keys[e.code]=false);
function clearHeldKeys(){for(const k of Object.keys(keys))keys[k]=false;justPressed.clear();state.player.moving=false;}
window.addEventListener('blur',clearHeldKeys);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearHeldKeys();});
window.addEventListener('beforeunload',()=>saveGame(false));
canvas.addEventListener('pointerdown',e=>{canvas.focus();onPointer(e);});

function start(){
  if(booted)return;booted=true;canvas.focus();requestAnimationFrame(loop);
  if(assetFailures)showToast(`Loaded with ${assetFailures} missing art asset${assetFailures===1?'':'s'}.`);
}

let last=performance.now(),runtimeFault=null;
function loop(t){
 const dt=Math.min(0.033,(t-last)/1000);last=t;
 try{if(!runtimeFault){update(dt);render(t/1000);}else drawRuntimeFault(runtimeFault);}
 catch(err){runtimeFault=err instanceof Error?err:new Error(String(err));console.error('Aetherwilds runtime fault',runtimeFault);drawRuntimeFault(runtimeFault);}
 justPressed.clear();requestAnimationFrame(loop);
}
function drawRuntimeFault(err){
 ctx.save();ctx.fillStyle='#080b14';ctx.fillRect(0,0,W,H);ctx.fillStyle='#182039';ctx.fillRect(150,205,980,300);ctx.strokeStyle='#d9b253';ctx.lineWidth=3;ctx.strokeRect(151.5,206.5,977,297);
 ctx.fillStyle='#f1c760';ctx.font='700 28px Georgia';ctx.fillText('EXPEDITION PAUSED',195,260);ctx.fillStyle='#f3e8cf';ctx.font='18px Georgia';ctx.fillText('A runtime error was caught before it could crash the page.',195,305);
 ctx.fillStyle='#c6af88';ctx.font='13px ui-monospace,monospace';wrapText(String(err?.message||err),195,348,885,22,'13px ui-monospace,monospace','#c6af88');
 ctx.fillStyle='#91a6bb';ctx.fillText('Reload the page to resume from the latest autosave.',195,455);ctx.restore();
}

function key(...codes){return codes.some(c=>keys[c]);}
function pressed(...codes){return codes.some(c=>justPressed.has(c));}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function dist(a,b,x,y){return Math.hypot(a-x,b-y);}
function rectHit(x,y,r){return x>=r[0]&&x<=r[2]&&y>=r[1]&&y<=r[3];}
function showToast(text){state.toast={text,t:3};}
function setScene(s,x=640,y=600){
  state.previousScene=state.scene;state.scene=s;state.player.x=x;state.player.y=y;state.player.moving=false;state.menuOpen=false;
  if(s!=='title'&&s!=='battle'&&state.started)saveGame(false);
}

// Keep the storage key stable so V4.4/V4.5 browser saves continue to load after visual hardening.
const SAVE_KEY='aetherwilds.v44.save.1';
const VALID_SCENES=new Set(['lodge','town','forest','cave','ruins']);
function hydrateMon(raw){
  if(!raw||!creatures[raw.id])return null;
  const level=clamp(Number(raw.level)||5,1,99), mon=cloneMon(raw.id,level);
  mon.hp=clamp(Number(raw.hp ?? mon.maxHp),0,mon.maxHp);
  return mon;
}
function saveGame(notify=false){
  if(!state.started||state.scene==='title'||state.scene==='battle')return false;
  try{
    const payload={
      v:1,scene:VALID_SCENES.has(state.scene)?state.scene:'lodge',
      player:{x:Math.round(state.player.x),y:Math.round(state.player.y),dir:state.player.dir},
      starter:state.starter,marks:state.marks,capsules:state.capsules,
      party:state.party.map(m=>({id:m.id,level:m.level,hp:m.hp})),
      reserve:state.reserve.map(m=>({id:m.id,level:m.level,hp:m.hp})),
      flags:{...state.flags},
      quests:{fractured:{done:!!state.quests.fractured.done},lost:{done:!!state.quests.lost.done}}
    };
    localStorage.setItem(SAVE_KEY,JSON.stringify(payload));
    if(notify)showToast('Expedition saved.');
    return true;
  }catch(err){console.warn('Save unavailable',err);if(notify)showToast('Save unavailable in this browser session.');return false;}
}
function hasSave(){try{return !!localStorage.getItem(SAVE_KEY);}catch{return false;}}
const SAFE_SPAWNS={lodge:[640,650],town:[640,430],forest:[640,580],cave:[640,650],ruins:[640,665]};
function loadGame(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);if(!raw)return false;
    const data=JSON.parse(raw);if(!data||data.v!==1)return false;
    state.started=true;state.starter=creatures[data.starter]?data.starter:null;
    state.marks=Math.max(0,Number(data.marks)||0);state.capsules=Math.max(0,Number(data.capsules)||0);
    state.flags={...state.flags,...(data.flags||{})};
    state.quests.lost.done=!!data.quests?.lost?.done;state.quests.fractured.done=!!data.quests?.fractured?.done;
    state.party=(Array.isArray(data.party)?data.party:[]).map(hydrateMon).filter(Boolean).slice(0,4);
    state.reserve=(Array.isArray(data.reserve)?data.reserve:[]).map(hydrateMon).filter(Boolean);
    if(!state.party.length&&state.starter)state.party=[cloneMon(state.starter,5)];
    const scene=VALID_SCENES.has(data.scene)?data.scene:'lodge';
    state.scene=scene;state.previousScene='town';state.menuOpen=false;state.dialogue=null;state.battle=null;state.toast=null;state.encounterCooldown=1.2;state.autosaveClock=0;
    state.player.x=clamp(Number(data.player?.x)||640,24,W-24);
    state.player.y=clamp(Number(data.player?.y)||600,PLAYER_TOP_SAFE_Y,H-18);
    state.player.dir=clamp(Number(data.player?.dir)||0,0,3);state.player.frame=0;state.player.moving=false;
    if(collidesAt(scene,state.player.x,state.player.y)){const safe=SAFE_SPAWNS[scene]||[640,600];state.player.x=safe[0];state.player.y=safe[1];}
    showToast('Expedition restored.');
    return true;
  }catch(err){console.warn('Invalid save',err);return false;}
}
function resetProgress(){
  try{localStorage.removeItem(SAVE_KEY);}catch{}
  state.started=true;state.starter=null;state.marks=300;state.capsules=5;state.party=[];state.reserve=[];state.encounterCooldown=0;state.autosaveClock=0;
  Object.assign(state.flags,{intro:false,starterChosen:false,rivalWon:false,captured:false,trainerWon:false,caveCrystal:false,wardenWon:false,ruinsSeen:false});
  state.quests.lost.done=false;state.quests.fractured.done=false;state.dialogue=null;state.battle=null;state.toast=null;state.menuOpen=false;
  Object.assign(state.player,{x:640,y:650,dir:DIR_UP,frame:0,moving:false});
}

// Collision is evaluated at the player's feet. Rectangles/circles deliberately leave
// authored walkways and transition lanes open instead of treating the whole plate as a wall.
const collisionMap={
  lodge:[
    {r:[0,55,350,292]},{r:[945,55,1280,300]},{r:[40,330,350,626]},{r:[940,335,1280,625]},
    {c:[475,235,48]},{c:[690,235,48]},{c:[900,235,48]},{c:[810,405,30]}
  ],
  town:[
    {r:[0,55,455,405]},{r:[0,510,275,720]},{r:[930,55,1280,455]},
    {c:[682,650,96]},{r:[300,560,505,690]},{c:[275,445,34]},
    {c:[392,456,25]},{c:[855,350,25]}
  ],
  forest:[
    {r:[0,395,190,720]},{r:[0,55,500,155]},{r:[780,55,980,155]},{r:[0,340,200,382]},
    {r:[980,55,1280,470]},{r:[980,610,1280,720]},
    {r:[0,635,450,720]},{r:[830,635,980,720]},{c:[625,175,52]},{c:[135,255,26]}
  ],
  cave:[
    {r:[0,55,315,720]},{r:[815,55,1280,720]},{r:[315,55,815,165]},{c:[650,440,56]}
  ],
  ruins:[
    {r:[0,55,390,720]},{r:[890,55,1280,720]},{r:[390,55,890,175]},{c:[640,455,72]}
  ]
};
function rectCircleHit(x,y,rad,r){
  const nx=clamp(x,r[0],r[2]),ny=clamp(y,r[1],r[3]);
  return Math.hypot(x-nx,y-ny)<rad;
}
function collidesAt(scene,x,y){
  const rad=14;
  for(const sh of collisionMap[scene]||[]){
    if(sh.r&&rectCircleHit(x,y,rad,sh.r))return true;
    if(sh.c&&Math.hypot(x-sh.c[0],y-sh.c[1])<rad+sh.c[2])return true;
  }
  if(scene==='town'&&state.flags.captured&&Math.hypot(x-900,y-385)<44)return true;
  if(scene==='forest'&&!state.flags.trainerWon&&Math.hypot(x-760,y-555)<42)return true;
  if(scene==='forest'&&!state.flags.wardenWon&&x>500&&x<780&&y<158)return true;
  return false;
}
function moveWithCollision(p,dx,dy){
  const nx=clamp(p.x+dx,24,W-24);if(!collidesAt(state.scene,nx,p.y))p.x=nx;
  const ny=clamp(p.y+dy,PLAYER_TOP_SAFE_Y,H-18);if(!collidesAt(state.scene,p.x,ny))p.y=ny;
}
function drawCollisionDebug(){
  if(!state.debug)return;ctx.save();ctx.globalAlpha=.22;ctx.fillStyle='#ff4466';ctx.strokeStyle='#ff7890';ctx.lineWidth=2;
  for(const sh of collisionMap[state.scene]||[]){if(sh.r){ctx.fillRect(sh.r[0],sh.r[1],sh.r[2]-sh.r[0],sh.r[3]-sh.r[1]);ctx.strokeRect(sh.r[0],sh.r[1],sh.r[2]-sh.r[0],sh.r[3]-sh.r[1]);}
    else if(sh.c){ctx.beginPath();ctx.arc(sh.c[0],sh.c[1],sh.c[2],0,Math.PI*2);ctx.fill();ctx.stroke();}}
  ctx.restore();
}

const mapInfo={
 lodge:{bg:'lodge_plate.webp',label:'EMBERBROOK RESEARCH LODGE',embeddedLabel:true},
 town:{bg:'town_plate.webp',label:'EMBERBROOK',embeddedLabel:true},
 forest:{bg:'forest_plate.webp',label:'VERDANT ROUTE',embeddedLabel:true},
 cave:{bg:'cave_plate.webp',label:'HOLLOWSTONE CAVE',embeddedLabel:true},
 ruins:{bg:'ruins_plate.webp',label:'AETHER RUINS',embeddedLabel:true}
};

const creatures={
 pyrel:{name:'Pyrel',type:'EMBER',maxHp:24,atk:9,def:6,spd:9,asset:'pyrel_battle.webp',ow:'pyrel_ow_hd.webp',moves:[['Cinder Pounce',7,'EMBER'],['Ash Snap',6,'EMBER'],['Quickstep',5,'GALE'],['Kindle',4,'EMBER']]},
 mossprig:{name:'Mossprig',type:'GROVE',maxHp:27,atk:7,def:9,spd:6,asset:'mossprig_battle.webp',ow:'mossprig_ow_hd.webp',moves:[['Bramble Tap',7,'GROVE'],['Root Brace',5,'GROVE'],['Seed Pop',6,'GROVE'],['Nuzzle',4,'NEUTRAL']]},
 ripplefin:{name:'Ripplefin',type:'TIDE',maxHp:25,atk:8,def:7,spd:8,asset:'ripplefin_battle.webp',ow:'ripplefin_ow_hd.webp',moves:[['Ripple Lash',7,'TIDE'],['Foam Dart',6,'TIDE'],['Slipstream',5,'GALE'],['Bubble Bash',5,'TIDE']]},
 brambit:{name:'Brambit',type:'GROVE',maxHp:22,atk:7,def:7,spd:7,asset:'brambit_battle.webp',ow:'brambit_ow_hd.webp',moves:[['Thorn Flick',6,'GROVE'],['Brush Rush',5,'GROVE'],['Berry Bonk',5,'NEUTRAL'],['Leaf Screen',4,'GROVE']]}
};

function cloneMon(id,level=5){const c=creatures[id];return {id,name:c.name,type:c.type,level,hp:c.maxHp+level-5,maxHp:c.maxHp+level-5,atk:c.atk+Math.floor((level-5)/2),def:c.def+Math.floor((level-5)/2),spd:c.spd+Math.floor((level-5)/2),moves:c.moves};}

function update(dt){
 if(state.toast){state.toast.t-=dt;if(state.toast.t<=0)state.toast=null;}
 if(state.scene==='title') return updateTitle(dt);
 if(state.scene==='battle') return updateBattle(dt);
 if(state.dialogue){ if(pressed('Space','KeyE','Enter')) advanceDialogue(); return; }
 if(state.menuOpen) return;
 updateWorld(dt);
}

let titleSel=0,newExpeditionArmUntil=0;
function updateTitle(){
 if(pressed('ArrowDown','KeyS')) titleSel=(titleSel+1)%4;
 if(pressed('ArrowUp','KeyW')) titleSel=(titleSel+3)%4;
 if(pressed('Enter','Space','KeyE')) titleAction(titleSel);
}
function titleAction(i){
 if(i===0){
   const now=performance.now();
   if(hasSave()&&now>newExpeditionArmUntil){
     newExpeditionArmUntil=now+5000;
     showToast('Existing expedition found · choose New Expedition again within 5 seconds to overwrite.');
     return;
   }
   newExpeditionArmUntil=0;
   resetProgress();setScene('lodge',640,650);
   setTimeout(()=>beginDialogue('elara',["Ah, you made it. Welcome to the Emberbrook Research Lodge.","The Aether readings beyond town changed overnight. Before you head out, choose a Lumling partner.","Approach one of the three research stations and press E."]),60);
 }
 else {
   newExpeditionArmUntil=0;
   if(i===1){if(!loadGame())showToast('No saved expedition found yet.');}
   else if(i===2){showToast(hasSave()?'Expedition Record: saved progress available.':'Expedition Record: Chapter I — The Fractured Aether');}
   else {showToast('Keyboard + pointer · battle menus support arrows/WASD + Enter · F2 debug');}
 }
}

function updateWorld(dt){
 const p=state.player; let dx=0,dy=0;
 state.encounterCooldown=Math.max(0,state.encounterCooldown-dt);
 state.autosaveClock+=dt;if(state.autosaveClock>=5){state.autosaveClock=0;saveGame(false);}
 if(key('ArrowLeft','KeyA'))dx--;if(key('ArrowRight','KeyD'))dx++;if(key('ArrowUp','KeyW'))dy--;if(key('ArrowDown','KeyS'))dy++;
 p.moving=false;
 if(dx||dy){
   const len=Math.hypot(dx,dy);dx/=len;dy/=len;const running=key('ShiftLeft','ShiftRight'),speed=running?230:150,ox=p.x,oy=p.y;
   moveWithCollision(p,dx*speed*dt,dy*speed*dt);p.moving=Math.hypot(p.x-ox,p.y-oy)>.01;
   if(Math.abs(dx)>Math.abs(dy)) p.dir=dx<0?DIR_LEFT:DIR_RIGHT; else p.dir=dy<0?DIR_UP:DIR_DOWN;
   if(p.moving)p.frame=(p.frame+dt*(running?11:8))%4;else p.frame=0;
 } else p.frame=0;
 transitions();
 if(state.scene==='forest'&&!state.flags.wardenWon&&key('ArrowUp','KeyW')&&p.y<185&&p.x>500&&p.x<780){
   if(!state.toast||!state.toast.text.includes('ancient seal'))showToast('An ancient seal resists you. The Verdant Sigil may open it.');
 }
 if(pressed('Space','KeyE')) interact();
 if(state.scene==='forest'&&p.moving&&state.flags.starterChosen&&!state.battle&&state.encounterCooldown<=0){
   const inGrass=rectHit(p.x,p.y,[330,255,835,500])||rectHit(p.x,p.y,[210,190,355,330]);
   if(inGrass&&Math.random()<dt*0.28){state.encounterCooldown=2.2;startBattle({kind:'wild',enemy:'brambit',level:4});}
 }
}

function transitions(){const p=state.player;
 if(state.scene==='lodge'&&p.y>=688&&p.x>535&&p.x<745){
   if(state.flags.starterChosen){setScene('town',640,165);showToast('Emberbrook · Verdant Route lies west.');}
   else{p.y=676;if(!state.toast)showToast('Choose a Lumling partner before leaving the lodge.');}
 }
 else if(state.scene==='town'&&p.y<=145&&p.x>500&&p.x<805)setScene('lodge',640,665);
 else if(state.scene==='town'&&p.x<=28&&p.y>420&&p.y<505)setScene('forest',1180,540);
 else if(state.scene==='town'&&p.x>=1252&&p.y>485&&p.y<655)setScene('cave',640,650);
 else if(state.scene==='forest'&&p.x>=1252&&p.y>470&&p.y<610)setScene('town',60,460);
 else if(state.scene==='cave'&&p.y>=688&&p.x>360&&p.x<900)setScene('town',1210,560);
 else if(state.scene==='forest'&&p.y<=145&&p.x>500&&p.x<780&&state.flags.wardenWon){
   setScene('ruins',640,665);showToast('The Verdant Sigil answers the northern seal.');
 }
 else if(state.scene==='ruins'&&p.y>=688&&p.x>390&&p.x<890)setScene('forest',640,180);
}
function interact(){const p=state.player;
 if(state.scene==='lodge'){
   if(dist(p.x,p.y,810,405)<115){beginDialogue('elara',state.flags.starterChosen?["Your Lumling seems to trust you already.","Verdant Route lies west of Emberbrook. Watch the tall grass."]:["Choose one of the three Lumlings at the stations behind me.","Pyrel, Mossprig, and Ripplefin each respond differently to Aether resonance."]);return;}
   if(!state.flags.starterChosen){
     const opts=[['pyrel',475,235],['mossprig',690,235],['ripplefin',900,235]];
     for(const [id,x,y] of opts)if(dist(p.x,p.y,x,y)<90){chooseStarter(id);return;}
   }
 }
 if(state.scene==='town'){
   if(dist(p.x,p.y,705,650)<105){showToast('Emberbrook Fountain — fed by springs below Hollowstone.');return;}
   if(dist(p.x,p.y,900,385)<105&&state.flags.captured){
     if(!state.flags.trainerWon){beginDialogue('mira',["You made it back with a wild Lumling.","Kael is waiting on Verdant Route. Finish that field trial first, then come see me."]);return;}
     if(!state.flags.wardenWon){beginDialogue('mira',["So you're Elara's new field researcher.","You crossed Verdant Route and proved yourself against Kael. Good.","Show me how you handle pressure. The Verdant Sigil is earned, not given."],()=>startBattle({kind:'warden',enemy:'mossprig',level:8}));return;}
     beginDialogue('mira',["The Verdant Sigil is yours now.","Take it to the northern seal on Verdant Route. If the ruins answer, record everything before you touch anything else."]);return;
   }
 }
 if(state.scene==='forest'){
   if(dist(p.x,p.y,760,555)<105&&!state.flags.trainerWon){beginDialogue('kael',["There you are. Elara said you'd take the scenic route.","Let's see whether your first expedition taught you anything."],()=>startBattle({kind:'trainer',enemy:'brambit',level:6}));return;}
 }
 if(state.scene==='cave'&&dist(p.x,p.y,650,440)<120&&!state.flags.caveCrystal){state.flags.caveCrystal=true;state.marks+=80;saveGame(false);showToast('Aether sample collected · +80 Marks');return;}
 if(state.scene==='ruins'&&dist(p.x,p.y,640,455)<150&&!state.flags.ruinsSeen){state.flags.ruinsSeen=true;state.quests.fractured.done=true;saveGame(false);beginDialogue('elara',["Your scanner is transmitting through the ruins... impossible.","These structures aren't merely storing Aether. They're routing it.","Whatever woke beneath the Aetherwilds is connected to every Lumling in the region." ]);return;}
}

function chooseStarter(id){
 const c=creatures[id]; beginDialogue('elara',[`${c.name}. A strong choice.`,`${c.name} has synchronized with your field scanner. From here on, you travel together.`],()=>{
 state.starter=id;state.flags.starterChosen=true;state.flags.intro=true;state.party=[cloneMon(id,5)];saveGame(false);showToast(`${c.name} joined your expedition.`);
 });
}

function beginDialogue(who,lines,onDone){state.dialogue={who,lines,i:0,onDone};}
function advanceDialogue(){const d=state.dialogue;if(!d)return;if(d.i<d.lines.length-1)d.i++;else{const cb=d.onDone;state.dialogue=null;if(cb)cb();}}

function startBattle(opts){
 if(!state.party.length){showToast('Choose a starter first.');return;}
 const usable=state.party.findIndex(m=>m.hp>0);if(usable<0){healParty();showToast('Your party needed recovery.');return;}
 if(usable!==0){const tmp=state.party[0];state.party[0]=state.party[usable];state.party[usable]=tmp;}
 const enemy=cloneMon(opts.enemy,opts.level||4);
 saveGame(false); // checkpoint the exact pre-battle world position
 state.toast=null;state.menuOpen=false;
 state.battle={
   kind:opts.kind,enemy,player:state.party[0],phase:'menu',message:`A ${opts.kind==='wild'?'wild ':''}${enemy.name} appeared!`,
   sel:0,cool:.12,origin:state.scene,originX:state.player.x,originY:state.player.y,anim:null,hitFlash:0,shake:0,captureFx:null,
   enemyDisplayHp:enemy.hp,playerDisplayHp:state.party[0].hp
 };
 state.scene='battle';clearHeldKeys();
}
function approach(v,target,rate,dt){if(v<target)return Math.min(target,v+rate*dt);if(v>target)return Math.max(target,v-rate*dt);return target;}
function updateBattle(dt){
 const b=state.battle;if(!b)return;
 b.cool=Math.max(0,b.cool-dt);b.hitFlash=Math.max(0,(b.hitFlash||0)-dt);b.shake=Math.max(0,(b.shake||0)-dt);
 b.enemyDisplayHp=approach(b.enemyDisplayHp,b.enemy.hp,42,dt);b.playerDisplayHp=approach(b.playerDisplayHp,b.player.hp,42,dt);
 if(b.anim){b.anim.t+=dt;if(b.anim.t>=b.anim.duration)b.anim=null;}
 if(b.captureFx){b.captureFx.t+=dt;if(b.captureFx.t>=b.captureFx.duration)b.captureFx=null;}
 if(b.phase==='busy')return;
 if(pressed('Escape')){
   if(b.phase==='moves'||b.phase==='party'){b.phase='menu';b.sel=0;b.message='What will you do?';}
   return;
 }
 const left=pressed('ArrowLeft','KeyA'),right=pressed('ArrowRight','KeyD'),up=pressed('ArrowUp','KeyW'),down=pressed('ArrowDown','KeyS');
 if(b.phase==='menu'||b.phase==='moves'){
   if(left&&b.sel%2===1)b.sel--;if(right&&b.sel%2===0)b.sel++;if(up&&b.sel>=2)b.sel-=2;if(down&&b.sel<2)b.sel+=2;
 }else if(b.phase==='party'){
   const n=Math.max(1,Math.min(4,state.party.length));
   if(left&&b.sel%2===1)b.sel--;if(right&&b.sel%2===0&&b.sel+1<n)b.sel++;
   if(up&&b.sel>=2)b.sel-=2;if(down&&b.sel+2<n)b.sel+=2;
   b.sel=clamp(b.sel,0,n-1);
 }
 if(pressed('Enter','Space','KeyE')){
   if(b.phase==='menu')battleMenuAction(b.sel);
   else if(b.phase==='moves')useMove(b.sel);
   else if(b.phase==='party')switchParty(b.sel);
 }
}
function battleMenuAction(sel){
 const b=state.battle;if(!b||b.phase!=='menu'||b.cool>0)return;
 if(sel===0){b.phase='moves';b.sel=0;b.message='Choose an ability.';}
 else if(sel===1)captureAttempt();
 else if(sel===2){b.phase='party';b.sel=0;b.message='Choose a Lumling to send out.';}
 else runBattle();
}
function typeMult(moveType,targetType){if(moveType==='EMBER'&&targetType==='GROVE')return 1.35;if(moveType==='GROVE'&&targetType==='TIDE')return 1.35;if(moveType==='TIDE'&&targetType==='EMBER')return 1.35;if(moveType==='GROVE'&&targetType==='EMBER')return .78;if(moveType==='EMBER'&&targetType==='TIDE')return .78;if(moveType==='TIDE'&&targetType==='GROVE')return .78;return 1;}
function damage(att,def,move){const power=move[1],mult=typeMult(move[2],def.type),variance=.9+Math.random()*.2;return Math.max(1,Math.round((power+att.atk*.65-def.def*.35)*mult*variance));}
function useMove(idx){
 const b=state.battle;if(!b||b.cool>0||b.phase!=='moves')return;const mv=b.player.moves[idx];if(!mv)return;
 const dmg=damage(b.player,b.enemy,mv);b.enemy.hp=Math.max(0,b.enemy.hp-dmg);b.message=`${b.player.name} used ${mv[0]} — ${dmg} damage!`;
 b.phase='busy';b.cool=.65;b.anim={actor:'player',target:'enemy',moveType:mv[2],t:0,duration:.58};b.hitFlash=.22;b.shake=.18;
 setTimeout(()=>{if(!state.battle||state.battle!==b)return;if(b.enemy.hp<=0){battleWin();return;}enemyTurn();},650);
}
function enemyTurn(){
 const b=state.battle;if(!b)return;b.phase='busy';
 const mv=b.enemy.moves[Math.floor(Math.random()*b.enemy.moves.length)],dmg=damage(b.enemy,b.player,mv);
 b.player.hp=Math.max(0,b.player.hp-dmg);b.message=`${b.enemy.name} used ${mv[0]} — ${dmg} damage!`;
 b.anim={actor:'enemy',target:'player',moveType:mv[2],t:0,duration:.58};b.hitFlash=.22;b.shake=.18;
 setTimeout(()=>{
   if(!state.battle||state.battle!==b)return;
   if(b.player.hp<=0){
     const next=state.party.findIndex((m,i)=>i>0&&m.hp>0);
     if(next>=0){const tmp=state.party[0];state.party[0]=state.party[next];state.party[next]=tmp;b.player=state.party[0];b.playerDisplayHp=b.player.hp;b.phase='menu';b.sel=0;b.message=`${b.player.name} steps in!`;return;}
     healParty();state.battle=null;setScene('lodge',640,640);state.encounterCooldown=2;showToast('Elara recovered your party at the lodge.');saveGame(false);return;
   }
   b.phase='menu';b.sel=0;b.message='What will you do?';
 },720);
}
function healParty(){for(const m of state.party)m.hp=m.maxHp;}
function switchParty(idx){
 const b=state.battle;if(!b||b.phase!=='party'||b.cool>0)return;const mon=state.party[idx];if(!mon)return;
 if(mon===b.player){b.message=`${mon.name} is already active.`;return;}
 if(mon.hp<=0){b.message=`${mon.name} cannot battle right now.`;return;}
 const active=state.party.indexOf(b.player);[state.party[active],state.party[idx]]=[state.party[idx],state.party[active]];
 b.player=state.party[active];if(active!==0){[state.party[0],state.party[active]]=[state.party[active],state.party[0]];b.player=state.party[0];}
 b.playerDisplayHp=b.player.hp;b.phase='busy';b.cool=.55;b.message=`Go, ${b.player.name}!`;
 setTimeout(()=>{if(state.battle===b)enemyTurn();},560);
}
function battleWin(){
 const b=state.battle;if(!b)return;const kind=b.kind;state.marks+=kind==='warden'?180:kind==='trainer'?90:35;
 if(kind==='trainer')state.flags.trainerWon=true;if(kind==='warden')state.flags.wardenWon=true;
 b.phase='busy';b.message=kind==='warden'?'Warden Mira yields. You earned the Verdant Sigil!':'Victory!';
 setTimeout(()=>{if(state.battle!==b)return;const origin=b.origin,ox=b.originX,oy=b.originY;state.battle=null;setScene(origin,ox,oy);state.encounterCooldown=2.2;saveGame(false);if(kind==='warden')showToast('Verdant Sigil acquired · Northern seal unlocked');},900);
}
function captureAttempt(){
 const b=state.battle;if(!b||b.phase!=='menu'||b.cool>0)return;
 if(b.kind!=='wild'){b.message='You cannot capture another trainer’s Lumling.';return;}
 if(state.capsules<=0){b.message='No Aether Capsules left.';return;}
 b.phase='busy';b.cool=.8;state.capsules--;const ratio=1-b.enemy.hp/b.enemy.maxHp,chance=.28+ratio*.55;
 if(Math.random()<chance){
   const mon={...b.enemy,hp:b.enemy.maxHp};let destination='party';
   if(state.party.length<4)state.party.push(mon);else{state.reserve.push(mon);destination='reserve';}
   state.flags.captured=true;state.quests.lost.done=true;b.message=`Captured ${b.enemy.name}!`;b.captureFx={t:0,duration:.8,success:true};
   setTimeout(()=>{if(state.battle!==b)return;const origin=b.origin,ox=b.originX,oy=b.originY;state.battle=null;setScene(origin,ox,oy);state.encounterCooldown=2.4;saveGame(false);showToast(destination==='party'?`${mon.name} joined your party.`:`${mon.name} was sent to reserve.`);},850);
 }else{
   b.message='The capsule flashed twice… and broke free!';b.captureFx={t:0,duration:.65,success:false};
   setTimeout(()=>{if(state.battle===b)enemyTurn();},700);
 }
}
function runBattle(){
 const b=state.battle;if(!b||b.phase!=='menu'||b.cool>0)return;
 if(b.kind==='wild'){b.phase='busy';const origin=b.origin,ox=b.originX,oy=b.originY;state.battle=null;setScene(origin,ox,oy);state.encounterCooldown=2.2;showToast('You slipped away safely.');}
 else b.message='There is no running from this challenge.';
}
function onPointer(e){
 const r=canvas.getBoundingClientRect();const x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;
 if(state.dialogue){advanceDialogue();return;}
 if(state.scene==='title'){
   const ys=[399,454,507,560];for(let i=0;i<4;i++)if(x>226&&x<558&&y>ys[i]-26&&y<ys[i]+26){titleSel=i;titleAction(i);return;}
 }
 if(state.scene==='battle'&&state.battle){
   const b=state.battle;if(b.phase==='busy')return;
   if(b.phase==='moves'){
     for(let i=0;i<4;i++){const rx=750+(i%2)*235,ry=545+Math.floor(i/2)*65;if(x>rx&&x<rx+220&&y>ry&&y<ry+54){b.sel=i;useMove(i);return;}}
   }else if(b.phase==='party'){
     for(let i=0;i<Math.min(4,state.party.length);i++){const rx=750+(i%2)*235,ry=545+Math.floor(i/2)*65;if(x>rx&&x<rx+220&&y>ry&&y<ry+54){b.sel=i;switchParty(i);return;}}
   }else if(b.phase==='menu'){
     const buttons=[[750,545,220,54,0],[985,545,220,54,1],[750,610,220,54,2],[985,610,220,54,3]];
     for(const [bx,by,bw,bh,i] of buttons)if(x>bx&&x<bx+bw&&y>by&&y<by+bh){b.sel=i;battleMenuAction(i);return;}
   }
 }
}
function render(time){ctx.clearRect(0,0,W,H);if(state.scene==='title')drawTitle(time);else if(state.scene==='battle')drawBattle(time);else drawWorld(time);if(state.toast)drawToast(state.toast.text);}
function bg(n){const im=assets[n];if(im)ctx.drawImage(im,0,0,W,H);}

function drawTitle(t){
 bg('title_concept.webp');
 // Small atmospheric motes stay behind the menu and preserve the illustrated composition.
 for(let i=0;i<30;i++){
   const x=(i*97+t*(5+i%4)*7)%W, y=45+((i*53+Math.sin(t*.8+i)*10)%600);
   ctx.fillStyle=i%5===0?'#65e9e588':'#fff0c04a';ctx.fillRect(Math.floor(x),Math.floor(y),i%7===0?2:1,i%7===0?2:1);
 }
 const rows=[399,454,507,560];
 const y=rows[titleSel];
 // Tight selection frame aligned to the painted menu instead of covering half the scene.
 ctx.save();ctx.shadowColor='#f2c85f';ctx.shadowBlur=10;ctx.strokeStyle='#f6d66d';ctx.lineWidth=3;
 ctx.strokeRect(228,y-27,326,52);ctx.restore();
 // corner ornaments
 ctx.fillStyle='#f3c95b';
 for(const [x0,y0,sx,sy] of [[228,y-27,1,1],[554,y-27,-1,1],[228,y+25,1,-1],[554,y+25,-1,-1]]){
   ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x0+12*sx,y0);ctx.lineTo(x0,y0+12*sy);ctx.closePath();ctx.fill();
 }
 // The illustrated title plate already carries the control legend; avoid duplicating it.
}
function drawWorld(t){
 const m=mapInfo[state.scene];if(m)bg(m.bg);
 // Correct baked topology before any dynamic cues/actors are painted.
 drawCorrectedTownSign();
 drawAmbientLighting(t);
 drawObjectiveFx(t);
 drawWorldInteractionCues(t);

 // Dynamic actors are depth-sorted by their foot anchor so walking behind an NPC/companion
 // actually reads as "behind" rather than painting the player over everything.
 drawDepthSortedActors(t);
 drawForegroundDepth(t);
 drawCollisionDebug();

 if(!m.embeddedLabel){
   ctx.fillStyle='#11182edd';ctx.fillRect(18,18,310,38);ctx.strokeStyle='#d7b258';ctx.strokeRect(18.5,18.5,310,38);
   ctx.fillStyle='#f4e7c6';ctx.font='700 16px ui-monospace,monospace';ctx.textAlign='left';ctx.fillText(m.label,34,43);
 }
 drawQuestTracker();
 if(state.debug)drawDebug();
 if(state.menuOpen)drawPause();
 if(state.dialogue)drawDialogue(state.dialogue);
}

function drawWorldInteractionCues(t){
 const p=state.player;
 if(state.scene==='lodge'){
   // South doorway cue: this is also the actual transition zone used by transitions().
   const nearExit=p.y>610&&p.x>500&&p.x<780;
   if(state.flags.starterChosen){
     ctx.save();
     const pulse=.72+.18*Math.sin(t*4.2);
     ctx.globalAlpha=pulse;
     ctx.globalCompositeOperation='screen';
     const g=ctx.createRadialGradient(640,699,4,640,699,105);
     g.addColorStop(0,'rgba(91,232,224,.28)');g.addColorStop(.45,'rgba(225,181,79,.16)');g.addColorStop(1,'rgba(0,0,0,0)');
     ctx.fillStyle=g;ctx.fillRect(520,650,240,70);
     ctx.restore();
     ctx.save();
     ctx.fillStyle=nearExit?'#f2cf6d':'#d7b75a';
     ctx.beginPath();ctx.moveTo(640,706);ctx.lineTo(628,689);ctx.lineTo(636,689);ctx.lineTo(636,678);ctx.lineTo(644,678);ctx.lineTo(644,689);ctx.lineTo(652,689);ctx.closePath();ctx.fill();
     if(nearExit){
       ctx.fillStyle='rgba(7,14,27,.88)';ctx.fillRect(554,638,172,31);ctx.strokeStyle='#d9b352';ctx.lineWidth=1;ctx.strokeRect(554.5,638.5,171,30);
       ctx.fillStyle='#f3e6c7';ctx.font='700 12px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText('TO EMBERBROOK',640,658);ctx.textAlign='left';
     }
     ctx.restore();
   } else if(nearExit){
     ctx.save();ctx.fillStyle='rgba(7,14,27,.90)';ctx.fillRect(503,638,274,34);ctx.strokeStyle='#b98d45';ctx.strokeRect(503.5,638.5,273,33);
     ctx.fillStyle='#ead6a5';ctx.font='700 12px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText('CHOOSE A LUMLING BEFORE DEPARTING',640,660);ctx.textAlign='left';ctx.restore();
   }

   // Starter proximity feedback makes the detailed display read as interactive rather than baked scenery.
   if(!state.flags.starterChosen){
     const stations=[['PYREL',475,235,'#ff9c54'],['MOSSPRIG',690,235,'#86d76a'],['RIPPLEFIN',900,235,'#69d8f0']];
     for(const [name,x,y,color] of stations){
       const d=dist(p.x,p.y,x,y); if(d>125) continue;
       ctx.save();ctx.globalAlpha=.55+.25*Math.sin(t*5);
       ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y+35,58,19,0,0,Math.PI*2);ctx.stroke();
       ctx.globalAlpha=1;ctx.fillStyle='rgba(8,15,29,.92)';ctx.fillRect(x-59,y+68,118,30);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.strokeRect(x-58.5,y+68.5,117,29);
       ctx.fillStyle='#f7ecd1';ctx.font='700 11px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(`E · ${name}`,x,y+88);ctx.textAlign='left';ctx.restore();
     }
   }
 }
 // Transition affordances are rendered independently of the painted plate so the real
 // traversal rules never depend on ambiguous baked signage.
 ctx.save();ctx.font='700 11px ui-monospace,monospace';ctx.textAlign='center';
 const cue=(x,y,label)=>{ctx.fillStyle='rgba(8,15,29,.82)';ctx.fillRect(x-62,y-14,124,28);ctx.strokeStyle='#c9a64f';ctx.strokeRect(x-61.5,y-13.5,123,27);ctx.fillStyle='#f3e6c7';ctx.fillText(label,x,y+4);};
 if(state.scene==='town'){
   // V4.6 corrects the in-world wayfinder itself; keep the normal exploration HUD clear.
   if(p.x<145&&p.y>390&&p.y<535)cue(78,454,'WEST · ROUTE');if(p.x>1130&&p.y>455)cue(1200,520,'EAST · CAVE');
   if(!state.toast&&p.y<175&&p.x>480&&p.x<825)cue(640,150,'NORTH · LODGE');
   if(state.flags.captured&&dist(p.x,p.y,900,385)<145)cue(900,445,!state.flags.trainerWon?'E · SPEAK':!state.flags.wardenWon?'E · CHALLENGE':'E · MIRA');
 }
 if(state.scene==='forest'){
   if(p.x>1110&&p.y>440&&p.y<625)cue(1195,520,'EAST · TOWN');if(p.y<220&&p.x>470&&p.x<810)cue(640,92,state.flags.wardenWon?'NORTH · RUINS':'NORTH · SEALED');
   if(!state.flags.trainerWon&&dist(p.x,p.y,760,555)<145)cue(760,615,'E · KAEL');
 }
 if(state.scene==='cave'){if(p.y>590)cue(640,667,'SOUTH · EXIT');if(!state.flags.caveCrystal&&dist(p.x,p.y,650,440)<150)cue(650,500,'E · SAMPLE');}
 if(state.scene==='ruins'){if(p.y>590)cue(640,667,'SOUTH · ROUTE');if(!state.flags.ruinsSeen&&dist(p.x,p.y,640,455)<180)cue(640,525,'E · SCAN');}
 ctx.restore();
}

function drawObjectiveFx(t){
 if(state.scene==='cave'&&!state.flags.caveCrystal)drawCrystalGlyph(650,420,.48,t);
 if(state.scene==='ruins'&&!state.flags.ruinsSeen)drawCrystalGlyph(640,430,.62,t);
}
function drawCrystalGlyph(x,y,scale,t){
 ctx.save();ctx.translate(x,y+Math.sin(t*2.4)*3);ctx.shadowColor='#5ef3ec';ctx.shadowBlur=22;
 ctx.fillStyle='#2d809c';ctx.beginPath();ctx.moveTo(0,-34*scale);ctx.lineTo(18*scale,0);ctx.lineTo(0,38*scale);ctx.lineTo(-18*scale,0);ctx.closePath();ctx.fill();
 ctx.fillStyle='#68f2ea';ctx.beginPath();ctx.moveTo(0,-31*scale);ctx.lineTo(8*scale,0);ctx.lineTo(0,30*scale);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#d7ffff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-2*scale,-22*scale);ctx.lineTo(-9*scale,0);ctx.lineTo(-1*scale,17*scale);ctx.stroke();ctx.restore();
}

function drawAmbientLighting(t){
 ctx.save();ctx.globalCompositeOperation='screen';
 if(state.scene==='lodge'){
   for(const [x,y] of [[385,91],[991,91],[460,520],[875,520]]){const g=ctx.createRadialGradient(x,y,0,x,y,115);g.addColorStop(0,'rgba(255,202,105,.22)');g.addColorStop(.45,'rgba(255,160,70,.07)');g.addColorStop(1,'rgba(255,140,40,0)');ctx.fillStyle=g;ctx.fillRect(x-120,y-120,240,240);}
 }
 if(state.scene==='lodge'){
   for(let i=0;i<16;i++){const x=(83+i*79+(t*(3+i%3)))%W,y=125+((i*97+t*(4+i%2))%470);ctx.fillStyle=i%4===0?'rgba(255,222,146,.34)':'rgba(245,196,110,.18)';ctx.fillRect(Math.floor(x),Math.floor(y),i%5===0?2:1,i%5===0?2:1);}
 }
 if(state.scene==='cave'||state.scene==='ruins'){
   const x=state.scene==='cave'?650:640,y=state.scene==='cave'?420:440;const r=state.scene==='cave'?210:280;
   const g=ctx.createRadialGradient(x,y,5,x,y,r);g.addColorStop(0,'rgba(80,236,245,.20)');g.addColorStop(.45,'rgba(70,160,240,.08)');g.addColorStop(1,'rgba(60,80,220,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
 }
 ctx.restore();
 // atmosphere motes
 if(state.scene==='forest'||state.scene==='cave'||state.scene==='ruins'){
   for(let i=0;i<26;i++){const x=(i*83+t*(8+i%3)*4)%W,y=(i*47+t*(4+i%2)*3)%H;ctx.fillStyle=state.scene==='forest'?(i%3?'#dbe98a4d':'#f1d46c5a'):(i%2?'#68edf078':'#9d82ff65');ctx.fillRect(Math.floor(x),Math.floor(y),i%6===0?2:1,i%6===0?2:1);}
 }
}

function drawDepthSortedActors(t){
 const actors=[];
 const push=(y,draw)=>actors.push({y,draw});
 if(state.scene==='forest'&&!state.flags.trainerWon)push(555,()=>drawSprite('kael_sheet_hd.webp',760,555,0,Math.floor(t*2)%4,1.0));
 if(state.scene==='town'&&state.flags.captured)push(385,()=>drawSprite('mira_sheet_hd.webp',900,385,0,Math.floor(t*2)%4,1.0));
 if(state.flags.starterChosen&&state.starter&&!(state.scene==='lodge'&&state.dialogue)){
   const p=state.player,offsets={
     [DIR_DOWN]:[-38,-26],[DIR_UP]:[38,28],[DIR_LEFT]:[36,-4],[DIR_RIGHT]:[-36,-4]
   },o=offsets[p.dir]||[-36,-18];
   const stride=p.moving?Math.sin(t*9)*3:Math.sin(t*2.5)*1.5;
   const cx=p.x+o[0],cy=p.y+o[1]+stride;
   push(cy,()=>drawOw(state.starter,cx,cy,.54));
 }
 push(state.player.y,()=>drawPlayer(t));
 actors.sort((a,b)=>a.y-b.y);
 for(const a of actors)a.draw();
}

// Re-draw exact pieces of the authored environment after the actors. Because these pixels
// come from the same plate already on screen, there are no rectangular seams; the patch
// simply becomes a foreground layer when the actor is logically behind that object.
function drawPlatePatch(x,y,w,h,alpha=1){
 const m=mapInfo[state.scene],im=m&&assets[m.bg];if(!im||w<=0||h<=0)return;
 const sx=x/W*im.naturalWidth,sy=y/H*im.naturalHeight,sw=w/W*im.naturalWidth,sh=h/H*im.naturalHeight;
 ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(im,sx,sy,sw,sh,x,y,w,h);ctx.restore();
}
function nearRect(p,r,pad=0){return p.x>=r[0]-pad&&p.x<=r[2]+pad&&p.y>=r[1]-pad&&p.y<=r[3]+pad;}
function drawGrassOcclusion(p,r){
 if(!nearRect(p,r,22))return;
 // Only cover the lower quarter of the character, preserving face/readability while making
 // dense grass visibly pass in front of boots and the companion's feet.
 const top=Math.max(r[1],p.y-34),bottom=Math.min(r[3],p.y+12);
 const left=Math.max(r[0],p.x-76),right=Math.min(r[2],p.x+76);
 if(bottom>top&&right>left)drawPlatePatch(left,top,right-left,bottom-top);
}
function drawAuthoredOcclusion(t){
 const p=state.player;
 if(state.scene==='lodge'){
   // Starter plinths and their creatures become foreground when the researcher walks north of them.
   for(const [x,anchor] of [[475,286],[690,286],[900,286]]){
     if(p.y<anchor&&Math.abs(p.x-x)<118)drawPlatePatch(x-88,158,176,146,.97);
   }
   // Bottom study desks/book stacks sit in front of actors approaching the exit aisle.
   if(p.y<625&&p.y>470&&p.x<475)drawPlatePatch(0,505,475,215);
   if(p.y<625&&p.y>470&&p.x>805)drawPlatePatch(805,500,475,220);
 }
 if(state.scene==='town'){
   // Fountain depth anchor: north-side actors pass behind the basin; south-side actors remain in front.
   if(p.y<654&&p.x>510&&p.x<850)drawPlatePatch(520,558,330,162,.98);
   // Foreground roof/planter mass at southwest and the dense east-side tree canopy.
   if(p.y<690&&p.x<315)drawPlatePatch(0,500,315,220);
   if(p.x>960&&p.y<495)drawPlatePatch(955,80,325,415);
 }
 if(state.scene==='forest'){
   // Tall grass should hide boots rather than behaving like a flat decal under the character.
   drawGrassOcclusion(p,[255,220,930,405]);
   // Bottom conifers/cliff lip and the east-bank foliage act as real foreground silhouettes.
   if(p.y<650&&p.y>430&&p.x<335)drawPlatePatch(0,385,355,275);
   if(p.y<650&&p.y>435&&p.x>650&&p.x<965)drawPlatePatch(645,490,325,170);
   if(p.x>970&&p.y<520)drawPlatePatch(965,100,315,430);
 }
 if(state.scene==='cave'){
   // Central crystal cluster/rocks occlude actors walking on the back side of the sample node.
   if(p.y<465&&Math.abs(p.x-650)<160)drawPlatePatch(545,300,220,185,.94);
   // Lower cave walls/crystals frame the walkable lane as foreground instead of a painted border.
   if(p.y<680&&p.x<365)drawPlatePatch(0,420,370,300);
   if(p.y<680&&p.x>805)drawPlatePatch(805,420,475,300);
 }
 if(state.scene==='ruins'){
   // The central dais and near stair rails provide an actual depth break around the scanner objective.
   if(p.y<500&&Math.abs(p.x-640)<190)drawPlatePatch(500,300,280,230,.93);
   if(p.y<650&&p.x<430)drawPlatePatch(0,360,455,360);
   if(p.y<650&&p.x>850)drawPlatePatch(835,360,445,360);
 }
}
function drawCorrectedTownSign(){
 if(state.scene!=='town')return;
 // The painted plate points every board east. Re-label only the three wooden slats so the
 // correction stays diegetic and does not cover the flowers/fountain around the sign.
 const boards=[
   [1008,548,232,34,'W  VERDANT ROUTE'],
   [1008,590,232,34,'N  RESEARCH LODGE'],
   [1008,632,232,34,'E  HOLLOWSTONE']
 ];
 ctx.save();ctx.textAlign='center';ctx.font='700 12px ui-monospace,monospace';
 for(const [x,y,w,h,label] of boards){
   const g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,'rgba(92,55,31,.97)');g.addColorStop(1,'rgba(55,32,23,.97)');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
   ctx.strokeStyle='#c99753';ctx.lineWidth=2;ctx.strokeRect(x+.5,y+.5,w-1,h-1);ctx.fillStyle='#f3dfb4';ctx.fillText(label,x+w/2,y+22);
 }
 ctx.restore();
}

function drawForegroundDepth(t){
 // Authored plate patches are the primary depth layer; atmosphere is added afterward.
 drawAuthoredOcclusion(t);
 // restrained vignette and edge silhouettes increase depth without obscuring the playfield.
 const g=ctx.createRadialGradient(W/2,H/2,260,W/2,H/2,720);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,state.scene==='cave'?'rgba(2,7,15,.34)':'rgba(3,8,12,.18)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 if(state.scene==='forest'){
   // water shimmer near the eastern stream and subtle grass sway
   ctx.save();ctx.strokeStyle='rgba(154,238,255,.36)';ctx.lineWidth=2;for(let i=0;i<7;i++){const yy=250+i*46+Math.sin(t*2+i)*4;ctx.beginPath();ctx.arc(1088,yy,55+i*4,.15,1.35);ctx.stroke();}ctx.strokeStyle='rgba(172,220,124,.28)';for(let i=0;i<28;i++){const x=325+(i*37)%520,y=260+(i*61)%235;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.sin(t*2.8+i)*4,y-12);ctx.stroke();}ctx.restore();
   ctx.fillStyle='#0b2d2952';for(let i=0;i<8;i++){const x=i<4?i*42:W-(i-3)*45, y=20+(i%3)*55;ctx.beginPath();ctx.ellipse(x,y,72,32,(i%2?.3:-.3),0,Math.PI*2);ctx.fill();}
 }
}
function drawSprite(sheet,x,y,dir=0,frame=0,scale=1){
 const im=assets[sheet];if(!im)return;
 // Character atlases are 4 columns x 4 directional rows. Deriving frame size
 // from the loaded image keeps high-detail replacements compatible with runtime.
 const sw=Math.floor(im.naturalWidth/4), sh=Math.floor(im.naturalHeight/4);
 const hiDetail=sw>=90 || sh>=120;
 const sx=Math.floor(frame)%4*sw,sy=(dir%4)*sh;
 // Layered contact shadow: broad ambient footprint + tight grounding core.
 ctx.save();
 ctx.fillStyle='rgba(5,8,14,.16)';ctx.beginPath();ctx.ellipse(x,y+7,(hiDetail?27:20)*scale,(hiDetail?9:7)*scale,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='rgba(4,6,10,.24)';ctx.beginPath();ctx.ellipse(x,y+5,(hiDetail?17:12)*scale,(hiDetail?5:4)*scale,0,0,Math.PI*2);ctx.fill();
 ctx.restore();
 const dx=x-sw*scale/2, dy=y-sh*scale+(hiDetail?12:16);
 ctx.save();
 // Preserve authored pixel clusters; nearest-neighbor keeps the live character as crisp as the environment.
 ctx.imageSmoothingEnabled=false;
 ctx.drawImage(im,sx,sy,sw,sh,dx,dy,sw*scale,sh*scale);
 ctx.restore();
 ctx.imageSmoothingEnabled=false;
}
function drawPlayer(t){
 const p=state.player;
 // Slightly larger authored character scale improves facial/clothing readability against the HD plates.
 const movingBob=p.moving?Math.sin(t*14)*1.0:Math.sin(t*2.2)*0.3;
 drawSprite('player_sheet_authored.webp',p.x,p.y+movingBob,p.dir,Math.floor(p.frame),1.08);
}
function drawOw(id,x,y,scale=1){const im=assets[creatures[id].ow];if(im){ctx.save();ctx.translate(x,y+Math.sin(performance.now()/330+x)*2);ctx.fillStyle='rgba(10,12,16,.22)';ctx.beginPath();ctx.ellipse(0,8,27*scale,8*scale,0,0,Math.PI*2);ctx.fill();ctx.drawImage(im,-48*scale,-80*scale,96*scale,96*scale);ctx.restore();}}
function currentObjective(){
 if(!state.flags.starterChosen)return {title:'Choose Your Partner',step:'Choose a Lumling at a Research Lodge station.',done:false};
 if(!state.flags.captured)return {title:'A Flicker in the Grass',step:'Capture a wild Lumling on Verdant Route.',done:false};
 if(!state.flags.trainerWon)return {title:"Kael's Field Trial",step:'Find Kael on Verdant Route and win the trial.',done:false};
 if(!state.flags.wardenWon)return {title:'The Verdant Sigil',step:'Return to Warden Mira in Emberbrook.',done:false};
 if(!state.flags.ruinsSeen)return {title:'The Fractured Aether',step:'Use the Sigil at the northern seal.',done:false};
 return {title:'The Fractured Aether',step:'Chapter I objective complete.',done:true};
}
function drawQuestTracker(){
 if(state.scene==='title'||state.scene==='battle')return;
 const q=currentObjective(),x=900,y=18,w=352,h=82;
 const g=ctx.createLinearGradient(x,y,x+w,y+82);g.addColorStop(0,'rgba(8,15,29,.96)');g.addColorStop(1,'rgba(16,23,43,.90)');ctx.fillStyle=g;ctx.fillRect(x,y,w,82);
 ctx.strokeStyle='#d8ad4f';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,w-2,80);ctx.strokeStyle='#55476c';ctx.lineWidth=1;ctx.strokeRect(x+7,y+7,w-14,68);
 ctx.fillStyle=q.done?'#79d39b':'#e5bb55';ctx.beginPath();ctx.moveTo(x+18,y+18);ctx.lineTo(x+25,y+25);ctx.lineTo(x+18,y+32);ctx.lineTo(x+11,y+25);ctx.closePath();ctx.fill();
 ctx.fillStyle='#dcb64f';ctx.font='700 9px ui-monospace,monospace';ctx.fillText(q.done?'EXPEDITION UPDATE · COMPLETE':'EXPEDITION UPDATE · ACTIVE',x+35,y+21);
 ctx.fillStyle='#f6e9c7';ctx.font='700 15px Georgia';ctx.fillText(q.title,x+35,y+43);
 ctx.fillStyle='#aab9c9';ctx.font='10px ui-monospace,monospace';const short=q.step.length>46?q.step.slice(0,45)+'…':q.step;ctx.fillText(short,x+35,y+62);
 ctx.fillStyle='#8ba0b8';ctx.fillRect(x+35,y+70,w-58,3);
 const progress=!state.flags.starterChosen?.08:!state.flags.captured?.25:!state.flags.trainerWon?.48:!state.flags.wardenWon?.70:!state.flags.ruinsSeen?.90:1;
 ctx.fillStyle=q.done?'#79d39b':'#d8ad4f';ctx.fillRect(x+35,y+70,(w-58)*progress,3);
}
function drawDialogue(d){
 const portraits={elara:'elara_portrait.webp',kael:'kael_portrait.webp',mira:'mira_portrait.webp'};const names={elara:'Professor Elara',kael:'Kael',mira:'Warden Mira'};
 const y=534,h=178;
 ctx.fillStyle='#071020d9';ctx.fillRect(0,y-8,W,h+16);
 ctx.fillStyle='#10182cf4';ctx.fillRect(18,y,1244,h);ctx.strokeStyle='#e1b84f';ctx.lineWidth=3;ctx.strokeRect(19.5,y+1.5,1241,h-3);
 // double inner line and corner accents
 ctx.strokeStyle='#5c4d74';ctx.lineWidth=1;ctx.strokeRect(27.5,y+9.5,1225,h-19);
 for(const [cx,cy,sx,sy] of [[28,y+10,1,1],[1252,y+10,-1,1],[28,y+h-10,1,-1],[1252,y+h-10,-1,-1]]){ctx.fillStyle='#e5bd56';ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+14*sx,cy);ctx.lineTo(cx,cy+14*sy);ctx.closePath();ctx.fill();}
 const im=assets[portraits[d.who]||'elara_portrait.webp'];if(im){ctx.save();ctx.beginPath();ctx.rect(34,y+18,150,150);ctx.clip();ctx.drawImage(im,34,y+18,150,150);ctx.restore();ctx.strokeStyle='#cba64f';ctx.lineWidth=2;ctx.strokeRect(34.5,y+18.5,150,150);}
 ctx.fillStyle='#d5a944';ctx.fillRect(197,y+10,255,34);ctx.fillStyle='#10172b';ctx.font='700 16px ui-monospace,monospace';ctx.textAlign='left';ctx.fillText(names[d.who]||'Field Log',214,y+33);
 wrapText(d.lines[d.i],214,y+76,1000,29,'20px Georgia','#f2ead6');
 ctx.fillStyle='#eac55c';ctx.beginPath();ctx.moveTo(1216,y+143);ctx.lineTo(1238,y+143);ctx.lineTo(1227,y+157);ctx.fill();
}
function drawPause(){
 ctx.fillStyle='#07101de8';ctx.fillRect(0,0,W,H);drawPanel(205,72,870,575,true);
 ctx.textAlign='center';ctx.font='900 36px Georgia';ctx.fillStyle='#efc45a';ctx.fillText('EXPEDITION PACK',640,124);
 const portrait=assets['player_portrait.webp'];if(portrait){ctx.save();ctx.beginPath();ctx.rect(245,154,218,286);ctx.clip();ctx.drawImage(portrait,245,154,218,286);ctx.restore();ctx.strokeStyle='#d7ac50';ctx.lineWidth=3;ctx.strokeRect(245.5,154.5,218,286);}
 ctx.textAlign='left';ctx.fillStyle='#f5e9cb';ctx.font='700 20px Georgia';ctx.fillText('Field Researcher',500,180);ctx.fillStyle='#9bb1c7';ctx.font='13px ui-monospace,monospace';ctx.fillText('AETHERWILDS EXPEDITION · CHAPTER I',500,204);
 ctx.strokeStyle='#4e5d78';ctx.beginPath();ctx.moveTo(500,220);ctx.lineTo(1028,220);ctx.stroke();
 ctx.font='700 17px ui-monospace,monospace';ctx.fillStyle='#f4e8cb';ctx.fillText(`Marks  ${state.marks}`,500,253);ctx.fillText(`Aether Capsules  ${state.capsules}`,750,253);
 ctx.fillStyle='#e5bd58';ctx.font='700 14px ui-monospace,monospace';ctx.fillText('ACTIVE PARTY',500,300);let y=338;for(const mon of state.party){ctx.fillStyle='#151f38e6';ctx.fillRect(500,y-25,528,58);ctx.strokeStyle='#556384';ctx.strokeRect(500.5,y-24.5,528,58);ctx.fillStyle='#f4e8cb';ctx.font='700 17px Georgia';ctx.fillText(`${mon.name}`,520,y);ctx.fillStyle='#9cb2c9';ctx.font='13px ui-monospace,monospace';ctx.fillText(`LV.${mon.level} · ${mon.type}`,700,y);ctx.fillStyle='#202b39';ctx.fillRect(838,y-9,164,13);ctx.fillStyle='#74cf88';ctx.fillRect(840,y-7,160*(mon.hp/mon.maxHp),9);ctx.fillStyle='#cfe4d3';ctx.font='11px ui-monospace,monospace';ctx.fillText(`${mon.hp}/${mon.maxHp}`,946,y+21);y+=70;}
 ctx.fillStyle='#9fb0c7';ctx.font='13px ui-monospace,monospace';ctx.fillText(`Reserve ${state.reserve.length} · Autosave active`,500,574);ctx.fillStyle='#c8b985';ctx.font='15px Georgia';ctx.fillText('Esc · return to expedition',500,596);
}

function drawBattle(t){
 const b=state.battle;bg('battle_forest_clean.webp');
 ctx.save();ctx.globalCompositeOperation='screen';
 for(let i=0;i<5;i++){const x=120+i*280+Math.sin(t*.45+i)*32;ctx.fillStyle='rgba(255,240,175,.035)';ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+150,0);ctx.lineTo(x+360,510);ctx.lineTo(x+250,510);ctx.closePath();ctx.fill();}
 for(let i=0;i<34;i++){const x=(i*113+t*(8+i%4)*5)%W,y=105+((i*67+t*(5+i%3)*4)%395);ctx.fillStyle=i%4===0?'rgba(255,225,112,.55)':'rgba(224,244,164,.3)';ctx.fillRect(x,y,i%7===0?2:1,i%7===0?2:1);}ctx.restore();
 let px=310,py=455,ex=930,ey=275,ps=1,es=1;
 if(b.anim){const q=Math.min(1,b.anim.t/b.anim.duration),l=Math.sin(q*Math.PI);if(b.anim.actor==='player'){px+=l*75;py-=l*16;ps=1+l*.04;}else{ex-=l*70;ey+=l*14;es=1+l*.04;}}
 if(b.shake>0){const mag=7*(b.shake/.18);if(b.anim?.target==='enemy')ex+=Math.sin(t*90)*mag;else if(b.anim?.target==='player')px+=Math.sin(t*90)*mag;}
 let enemyCaptureScale=1,enemyCaptureAlpha=1;
 if(b.captureFx?.success){const q=Math.min(1,b.captureFx.t/b.captureFx.duration);enemyCaptureScale=Math.max(.15,1-q*.85);enemyCaptureAlpha=1-q*.82;}
 drawBattleMon(b.enemy,ex,ey,220*es*enemyCaptureScale,false,b.hitFlash>0&&b.anim?.target==='enemy',enemyCaptureAlpha);
 drawBattleMon(b.player,px,py,250*ps,true,b.hitFlash>0&&b.anim?.target==='player',1);
 if(b.anim)drawAttackFx(b.anim,t,px,py,ex,ey);
 if(b.captureFx)drawCaptureFx(b.captureFx,ex,ey);
 statusPlate(58,42,b.enemy,b.enemyDisplayHp);statusPlate(792,350,b.player,b.playerDisplayHp);
 ctx.fillStyle='#0f172cf2';ctx.fillRect(0,515,W,205);ctx.strokeStyle='#d6ae4f';ctx.lineWidth=3;ctx.strokeRect(8,523,W-16,188);
 ctx.fillStyle='#f0e6cf';ctx.font='20px Georgia';ctx.textAlign='left';wrapText(b.message,32,560,665,27,'20px Georgia','#f0e6cf');
 if(b.phase==='menu'){
   battleButton(750,545,'⚔  Fight',b.sel===0);battleButton(985,545,`◈  Capsule (${state.capsules})`,b.sel===1);
   battleButton(750,610,'✦  Lumlings',b.sel===2);battleButton(985,610,'↪  Run',b.sel===3);
 }else if(b.phase==='moves'){
   for(let i=0;i<4;i++){const mv=b.player.moves[i],x=750+(i%2)*235,y=545+Math.floor(i/2)*65;moveButton(x,y,mv,b.sel===i);}
   ctx.fillStyle='#d7c792';ctx.font='12px ui-monospace,monospace';ctx.fillText('ARROWS / WASD · ENTER select · ESC back',750,532);
 }else if(b.phase==='party'){
   for(let i=0;i<Math.min(4,state.party.length);i++){const mon=state.party[i],x=750+(i%2)*235,y=545+Math.floor(i/2)*65;partyButton(x,y,mon,b.sel===i,mon===b.player);}
   ctx.fillStyle='#d7c792';ctx.font='12px ui-monospace,monospace';ctx.fillText('Choose a healthy Lumling · ESC back',750,532);
 }
}
function drawBattleMon(mon,x,y,size,flip,flash,alpha=1){
 const im=assets[creatures[mon.id].asset];if(!im)return;ctx.save();ctx.translate(x,y);if(flip)ctx.scale(-1,1);
 ctx.globalAlpha=alpha;ctx.filter=flash?'brightness(2.25) saturate(.25)':'none';
 ctx.drawImage(im,-size/2,-size/2,size,size);ctx.filter='none';ctx.restore();
}
function drawAttackFx(a,t,px,py,ex,ey){const q=Math.min(1,a.t/a.duration),sx=a.actor==='player'?px:ex,sy=a.actor==='player'?py:ey,tx=a.actor==='player'?ex:px,ty=a.actor==='player'?ey:py;ctx.save();
 const cx=sx+(tx-sx)*q,cy=sy+(ty-sy)*q-35*Math.sin(q*Math.PI),typ=a.moveType;
 if(typ==='EMBER'){for(let i=0;i<12;i++){const ang=i*.7+t*9,r=12+(i%4)*5;ctx.fillStyle=i%3===0?'#fff0a6':i%3===1?'#ff9a3d':'#e94a32';ctx.beginPath();ctx.arc(cx+Math.cos(ang)*r,cy+Math.sin(ang)*r,4+(i%3),0,Math.PI*2);ctx.fill();}}
 else if(typ==='TIDE'){ctx.strokeStyle='#7be8ff';ctx.lineWidth=7;ctx.beginPath();ctx.arc(cx,cy,28,0,Math.PI*1.7);ctx.stroke();for(let i=0;i<8;i++){ctx.fillStyle='#b8f5ff';ctx.beginPath();ctx.arc(cx+(i-4)*8,cy+Math.sin(i+t*8)*10,3,0,Math.PI*2);ctx.fill();}}
 else if(typ==='GROVE'){for(let i=0;i<10;i++){ctx.save();ctx.translate(cx+Math.cos(i*1.9+t*5)*25,cy+Math.sin(i*1.4+t*4)*18);ctx.rotate(i);ctx.fillStyle=i%2?'#8fd464':'#4d9f52';ctx.fillRect(-5,-2,10,4);ctx.restore();}}
 else{ctx.strokeStyle='#e8e5ca';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(cx,cy);ctx.stroke();}
 ctx.restore();
}
function drawCaptureFx(fx,ex,ey){
 const q=Math.min(1,fx.t/fx.duration),x=300+(ex-300)*q,y=455+(ey-455)*q-180*Math.sin(q*Math.PI);ctx.save();
 ctx.shadowColor='#71e7ec';ctx.shadowBlur=15;ctx.fillStyle='#e7d9bd';ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle=fx.success?'#6ff5dc':'#4ad6dc';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.stroke();
 if(fx.success&&q>.65){ctx.globalAlpha=(q-.65)/.35;ctx.strokeStyle='#b9fff5';ctx.lineWidth=3;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(ex,ey,20+i*18,0,Math.PI*2);ctx.stroke();}}
 ctx.restore();
}
function statusPlate(x,y,m,displayHp=m.hp){
 const hp=clamp(displayHp,0,m.maxHp),ratio=hp/m.maxHp;ctx.fillStyle='#10182be8';ctx.fillRect(x,y,430,104);ctx.strokeStyle='#d6ae4f';ctx.lineWidth=3;ctx.strokeRect(x+1.5,y+1.5,427,101);
 ctx.fillStyle='#f3e7c8';ctx.font='700 25px Georgia';ctx.fillText(m.name,x+22,y+34);ctx.font='700 15px ui-monospace,monospace';ctx.fillText(`Lv.${m.level}  ${m.type}`,x+280,y+34);
 ctx.fillStyle='#272b31';ctx.fillRect(x+22,y+55,375,23);ctx.fillStyle=ratio>.5?'#62ca73':ratio>.25?'#e9c94d':'#df5c52';ctx.fillRect(x+25,y+58,369*ratio,17);
 ctx.strokeStyle='#d7d0b4';ctx.strokeRect(x+22.5,y+55.5,375,23);ctx.fillStyle='#e7ddc3';ctx.font='13px ui-monospace,monospace';ctx.fillText(`${Math.round(hp)}/${m.maxHp}`,x+329,y+96);
}
function fitFont(label,maxWidth,start=17,min=12,fontFamily='ui-monospace,monospace'){
 let size=start;while(size>min){ctx.font=`700 ${size}px ${fontFamily}`;if(ctx.measureText(label).width<=maxWidth)break;size--;}return size;
}
function battleButton(x,y,label,sel){
 drawPanel(x,y,220,54,sel);const size=fitFont(label,188,17,12);ctx.fillStyle='#f4e8ca';ctx.font=`700 ${size}px ui-monospace,monospace`;ctx.fillText(label,x+16,y+34);
}
function moveButton(x,y,mv,sel){
 drawPanel(x,y,220,54,sel);ctx.fillStyle='#f4e8ca';const size=fitFont(mv[0],145,16,12,'Georgia');ctx.font=`700 ${size}px Georgia`;ctx.fillText(mv[0],x+14,y+24);
 ctx.fillStyle=mv[2]==='EMBER'?'#ffb36a':mv[2]==='TIDE'?'#7ee8ff':mv[2]==='GROVE'?'#9ddd7b':'#d8d2c2';ctx.font='700 10px ui-monospace,monospace';ctx.fillText(mv[2],x+14,y+43);
 ctx.fillStyle='#9fb0c7';ctx.textAlign='right';ctx.fillText(`PWR ${mv[1]}`,x+205,y+43);ctx.textAlign='left';
}
function partyButton(x,y,mon,sel,active){
 drawPanel(x,y,220,54,sel);ctx.fillStyle=mon.hp>0?'#f4e8ca':'#8b8f9c';ctx.font='700 15px Georgia';ctx.fillText(mon.name,x+14,y+22);
 ctx.fillStyle=active?'#efc45a':'#9fb0c7';ctx.font='700 10px ui-monospace,monospace';ctx.fillText(active?'ACTIVE':`LV.${mon.level} · ${mon.type}`,x+14,y+41);
 ctx.textAlign='right';ctx.fillStyle=mon.hp>0?'#8ed59a':'#d17a7a';ctx.fillText(`${mon.hp}/${mon.maxHp}`,x+204,y+41);ctx.textAlign='left';
}
function drawPanel(x,y,w,h,active=false){ctx.fillStyle=active?'#273458ee':'#121a31dd';ctx.fillRect(x,y,w,h);ctx.strokeStyle=active?'#f1c74f':'#9c8450';ctx.lineWidth=active?3:2;ctx.strokeRect(x+1,y+1,w-2,h-2);ctx.fillStyle='#ffffff12';ctx.fillRect(x+5,y+5,w-10,2);}
function drawToast(text){ctx.font='700 16px ui-monospace,monospace';const mw=Math.min(900,ctx.measureText(text).width+50);ctx.fillStyle='#10172bea';ctx.fillRect((W-mw)/2,92,mw,46);ctx.strokeStyle='#dfb64f';ctx.strokeRect((W-mw)/2+.5,92.5,mw,46);ctx.fillStyle='#f4e8ca';ctx.textAlign='center';ctx.fillText(text,W/2,121);ctx.textAlign='left';}
function wrapText(text,x,y,maxWidth,lineHeight,font='20px Georgia',fill='#fff'){ctx.font=font;ctx.fillStyle=fill;ctx.textAlign='left';const words=text.split(' ');let line='';for(const word of words){const test=line+word+' ';if(ctx.measureText(test).width>maxWidth&&line){ctx.fillText(line,x,y);line=word+' ';y+=lineHeight;}else line=test;}ctx.fillText(line,x,y);}
function drawDebug(){const p=state.player;ctx.fillStyle='#05070bdc';ctx.fillRect(16,92,315,142);ctx.fillStyle='#83f0dd';ctx.font='13px ui-monospace,monospace';ctx.fillText(`${BUILD} · scene: ${state.scene}`,28,116);ctx.fillText(`x/y: ${p.x.toFixed(0)} / ${p.y.toFixed(0)}`,28,138);ctx.fillText(`starter: ${state.starter||'none'}`,28,160);ctx.fillText(`party/reserve: ${state.party.length}/${state.reserve.length}`,28,182);ctx.fillText(`sigil: ${state.flags.wardenWon}`,28,204);ctx.fillStyle='#ff8fa3';ctx.fillText('red overlay = collision geometry',28,226);}

if(typeof location!=='undefined'&&new URLSearchParams(location.search).get('qa')==='1'){
 window.__AETHERWILDS_QA__={BUILD,state,collisionMap,collidesAt,moveWithCollision,transitions,interact,currentObjective,startBattle,updateBattle,updateWorld,battleMenuAction,useMove,captureAttempt,switchParty,saveGame,loadGame,resetProgress,setScene,creatures,beginDialogue,advanceDialogue,qaPress:(code)=>{justPressed.clear();justPressed.add(code);},qaHold:(code,on=true)=>{keys[code]=on;}};
}
load();
})();
