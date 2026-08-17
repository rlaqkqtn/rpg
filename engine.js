/* =========================================================================
   engine.js — 게임 루프 / 물리 / 전투 / 상태 관리
   ========================================================================= */

const CANVAS_W = 960, CANVAS_H = 540;
const GRAVITY = 1900, MOVE_SPEED = 250, JUMP_VEL = -640;
const COOLDOWN_BY_TYPE = { 딜:0.5, 버프:3.0, 제어:2.0, 디버프:2.5, 유틸:1.8 };

const REGIONS = ['천상','지상','지하'];

let G = {
  screen:'title', // title | intro | play | shrineCutscene | ending
  spawnRegion:null,
  visited:new Set(),
  unlockedGates:new Set(),      // 신전 게이트 중 통행 가능한 지역
  keys:new Set(),               // 확보한 신의 은총 파편(지역명)
  learned:new Set(),            // 습득한 직업 id
  slots:[null,null,null],
  activeSlot:0,
  currentRoomId:null,
  cooldowns:{},                 // skillName -> 남은 시간(초)
  haste:0,                      // 캡 브레이크: 남은 시간(초), >0면 쿨타임 대부분 무시
  projectiles:[],
  hitFx:[],
  toasts:[],                    // 화면 하단 로그
  doorLock:0,                   // 방 진입 직후 문 재판정 방지 타이머
  pendingGate:null,             // 확인창 표시 중인 지역명
  altarPrompt:false,
  discoveredRooms:new Set(),
  player:{x:60,y:420,w:30,h:44,vx:0,vy:0,onGround:false,facing:1,hp:100,maxHp:100,shield:0,invuln:0},
  keysDown:{},
};

function maxSlots(){ return Math.min(3, G.keys.size+1); }

function toast(msg, cls){
  G.toasts.unshift({msg, cls:cls||''});
  if(G.toasts.length>5) G.toasts.pop();
  renderToasts();
}

/* ------------------------------ 시작 흐름 ------------------------------ */

function startGame(){
  G.spawnRegion = REGIONS[Math.floor(Math.random()*3)];
  G.screen='intro';
  renderScreenState();
}

function beginPlay(){
  G.visited.add(G.spawnRegion);
  G.unlockedGates.add(G.spawnRegion); // 스폰 지역은 신전에서 언제든 되돌아갈 수 있어야 한다
  G.screen='play';
  loadRoom(G.spawnRegion+'_입구', {x:60,y:420});
  toast(`◆ ${G.spawnRegion}에서 눈을 뜨다.`, 'sys');
  renderScreenState();
  requestAnimationFrame(loop);
}

/* ------------------------------ 방 전환 ------------------------------ */

function loadRoom(roomId, spawn){
  G.currentRoomId = roomId;
  G.discoveredRooms.add(roomId);
  G.player.x = spawn.x; G.player.y = spawn.y;
  G.player.vx=0; G.player.vy=0;
  G.projectiles=[]; G.hitFx=[];
  G.doorLock = 0.35;
  updateMinimap();
}

function currentRoom(){ return ROOMS[G.currentRoomId]; }

function tryDoors(){
  const room = currentRoom();
  if(G.doorLock>0) return;
  const p = G.player;
  for(const d of room.doors){
    if(!aabb(p.x,p.y,p.w,p.h, d.x,d.y,d.w,d.h)) continue;

    if(d.gate){ // 신전 게이트
      if(d.gate==='boss'){
        if(G.keys.size>=3){ /* 제단에서만 진입 가능하도록 별도 처리 (아래 altar 체크) */ }
        continue;
      }
      if(!G.unlockedGates.has(d.gate)){
        handleLockedGate(d.gate);
        return;
      }
    }
    if(d.requiresKey && !G.keys.has(d.region)){
      toast('아직 이 파편의 힘을 온전히 다루지 못한다.', 'warn');
      return;
    }
    loadRoom(d.to, d.spawn);
    return;
  }

  // 제단 체크 (신전 방 전용)
  if(room.altar){
    const a = room.altar;
    if(aabb(p.x,p.y,p.w,p.h, a.x,a.y,a.w,a.h) && G.keys.size>=3 && !G.altarPrompt){
      G.altarPrompt = true;
      showAltarCutscene();
    }
  }
}

function handleLockedGate(region){
  if(G.keys.size===0) return; // 아직 첫 파편도 없으면 아무 문도 못 지남 (사실상 발생 안 함, 첫 방이 이미 던전 안이므로)
  const remaining = REGIONS.filter(r=>!G.visited.has(r));
  if(remaining.length<=1){
    // 마지막 하나 남았으면 자동 개방되어 있어야 정상 — 안전망
    G.unlockedGates.add(region);
    loadRoom(region+'_입구', {x:60,y:420});
    return;
  }
  // 두 곳 중 하나를 선택해야 하는 상황
  G.pendingGate = region;
  renderGateModal();
}

function confirmGate(region){
  G.unlockedGates.add(region);
  G.visited.add(region);
  G.pendingGate = null;
  hideGateModal();
  loadRoom(region+'_입구', {x:60,y:420});
}
function cancelGate(){ G.pendingGate=null; hideGateModal(); }

function onKeyPickup(region){
  G.keys.add(region);
  toast(`✦ 「신의 은총」 파편 확보! (${G.keys.size}/3) — 직업 슬롯 ${maxSlots()}개 해금`, 'sys');
  const remaining = REGIONS.filter(r=>!G.visited.has(r));
  if(remaining.length===1){
    G.unlockedGates.add(remaining[0]);
  }
  renderHUD();
}

/* ------------------------------ 픽업 / 학습 ------------------------------ */

function tryPickups(){
  const room = currentRoom();
  const p = G.player;
  for(const pk of room.pickups){
    if(pk.collected) continue;
    if(!aabb(p.x,p.y,p.w,p.h, pk.x-13,pk.y-13,pk.w,pk.h)) continue;
    pk.collected = true;

    if(pk.kind==='job'){
      const job = jobById(pk.ref);
      const hidden = isHiddenJob(job);
      G.learned.add(pk.ref);
      toast(hidden ? `◆ 히든 직업 「${pk.ref}」를 발견했다!` : `◆ 「${pk.ref}」의 방식을 익혔다.`, 'sys');
      autoEquip(pk.ref);
    } else if(pk.kind==='key'){
      onKeyPickup(pk.region);
    }
    renderHUD();
  }
}

function autoEquip(jobId){
  if(G.slots.includes(jobId)) return; // 이미 장착 중이면 중복 장착 금지
  const idx = G.slots.findIndex((s,i)=> s===null && i<maxSlots());
  if(idx>=0) G.slots[idx]=jobId;
}

function equipToSlot(slotIdx, jobId){
  if(slotIdx>=maxSlots()) return;
  if(G.slots.includes(jobId)){
    // 다른 슬롯에 이미 있으면 그 슬롯과 교체(스왑)하여 중복 방지
    const otherIdx = G.slots.indexOf(jobId);
    G.slots[otherIdx] = G.slots[slotIdx];
  }
  G.slots[slotIdx] = jobId;
  renderHUD();
}

/* ------------------------------ 입력 ------------------------------ */

window.addEventListener('keydown', e=>{
  G.keysDown[e.code]=true;
  if(G.screen!=='play') return;
  if(e.code==='Digit1') setActiveSlot(0);
  if(e.code==='Digit2') setActiveSlot(1);
  if(e.code==='Digit3') setActiveSlot(2);
  if(e.code==='KeyZ') useSkillSlot(0);
  if(e.code==='KeyX') useSkillSlot(1);
  if(e.code==='KeyC') useSkillSlot(2);
});
window.addEventListener('keyup', e=>{ G.keysDown[e.code]=false; });

function setActiveSlot(i){
  if(i>=maxSlots() || !G.slots[i]) { toast('그 슬롯엔 장착된 직업이 없다.'); return; }
  G.activeSlot=i;
  renderHUD();
}

/* ------------------------------ 전투 ------------------------------ */

function useSkillSlot(idx){
  const jobId = G.slots[G.activeSlot];
  if(!jobId){ toast('현재 슬롯에 장착된 직업이 없다.'); return; }
  const job = jobById(jobId);
  const sk = job.skills[idx];
  if(sk) castSkill(sk);
}

// 스킬 팔레트에서 개별 스킬 버튼을 눌렀을 때 실제 사용되는 함수
function castSkill(skill){
  const now = performance.now()/1000;
  const cd = G.cooldowns[skill.name]||0;
  if(cd>now){ return; }

  const p = G.player;
  const room = currentRoom();
  const dmg = 14+Math.floor(Math.random()*8);

  if(skill.type==='유틸'){
    p.hp = Math.min(p.maxHp, p.hp+14);
    toast(`「${skill.name}」 — 체력 회복`, 'heal');
  } else if(skill.type==='버프'){
    p.shield = Math.min(60, p.shield+18);
    toast(`「${skill.name}」 — 방어막 +18`, 'heal');
    if(skill.name==='캡 브레이크'){ G.haste = 3.0; toast('공격속도 상한 제거!', 'sys'); }
  } else {
    // 딜 / 제어 / 디버프 — 히트박스 또는 투사체
    const effect = skill.type==='딜' ? 'dmg' : (skill.type==='제어' ? 'stun' : 'weak');
    if(skill.range==='ranged'){
      const dir = p.facing;
      G.projectiles.push({
        x: dir>0? p.x+p.w : p.x-14, y: p.y+p.h/2-4, vx: dir*480, w:14,h:8,
        owner:'player', effect, value: effect==='dmg'?dmg:(effect==='stun'?1.6:3.5), life:1.1, color:'#f0d98a'
      });
    } else {
      let hx,hy,hw,hh;
      if(skill.aoe){ hx=p.x-42; hy=p.y-24; hw=p.w+84; hh=p.h+48; }
      else { hx = p.facing>0? p.x+p.w : p.x-48; hy = p.y-6; hw=48; hh=p.h+12; }
      G.hitFx.push({x:hx,y:hy,w:hw,h:hh,life:0.15});
      for(const en of room.enemies){
        if(!en.alive) continue;
        if(!aabb(hx,hy,hw,hh, en.x,en.y,en.w,en.h)) continue;
        applyToEnemy(en, effect, effect==='dmg'?dmg:(effect==='stun'?1.6:3.5));
      }
    }
    if(skill.type==='딜') toast(`「${skill.name}」 사용!`);
    else if(skill.type==='제어') toast(`「${skill.name}」 — 제어 효과`);
    else toast(`「${skill.name}」 — 약화 효과`);
  }

  const baseCd = COOLDOWN_BY_TYPE[skill.type]||1;
  G.cooldowns[skill.name] = now + (G.haste>0 ? 0.08 : baseCd);
  renderHUD();
}

function applyToEnemy(en, effect, value){
  if(effect==='dmg'){ en.hp -= value; if(en.hp<=0){ en.alive=false; onEnemyDefeated(en); } }
  else if(effect==='stun'){ en.stun = Math.max(en.stun, value); }
  else if(effect==='weak'){ en.weak = Math.max(en.weak, value); }
}

function onEnemyDefeated(en){
  toast(`◆ ${en.name}을(를) 물리쳤다.`, 'sys');
  if(en.type==='boss'){
    setTimeout(()=>{ showEnding(); }, 900);
  }
}

/* ------------------------------ 게임 루프 ------------------------------ */

let lastT = 0;
function loop(t){
  if(G.screen!=='play'){ return; }
  const dt = Math.min(0.033, lastT? (t-lastT)/1000 : 0.016);
  lastT = t;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function aabb(x1,y1,w1,h1, x2,y2,w2,h2){
  return x1 < x2+w2 && x1+w1 > x2 && y1 < y2+h2 && y1+h1 > y2;
}

function update(dt){
  if(G.doorLock>0) G.doorLock -= dt;
  if(G.haste>0) G.haste -= dt;
  updatePlayer(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  for(const fx of G.hitFx) fx.life -= dt;
  G.hitFx = G.hitFx.filter(f=>f.life>0);
  tryDoors();
  tryPickups();
}

function updatePlayer(dt){
  const p = G.player;
  const room = currentRoom();
  const left = G.keysDown['ArrowLeft']||G.keysDown['KeyA'];
  const right = G.keysDown['ArrowRight']||G.keysDown['KeyD'];
  const jump = G.keysDown['Space']||G.keysDown['ArrowUp']||G.keysDown['KeyW'];

  p.vx = 0;
  if(left){ p.vx=-MOVE_SPEED; p.facing=-1; }
  if(right){ p.vx=MOVE_SPEED; p.facing=1; }

  p.vy += GRAVITY*dt;
  if(jump && p.onGround){ p.vy = JUMP_VEL; p.onGround=false; }

  // X축 이동/충돌
  p.x += p.vx*dt;
  p.x = Math.max(0, Math.min(CANVAS_W-p.w, p.x));
  for(const pl of room.platforms){
    if(!aabb(p.x,p.y,p.w,p.h, pl.x,pl.y,pl.w,pl.h)) continue;
    if(p.vx>0) p.x = pl.x - p.w;
    else if(p.vx<0) p.x = pl.x + pl.w;
  }

  // Y축 이동/충돌
  p.onGround=false;
  p.y += p.vy*dt;
  for(const pl of room.platforms){
    if(!aabb(p.x,p.y,p.w,p.h, pl.x,pl.y,pl.w,pl.h)) continue;
    if(p.vy>0){ p.y = pl.y - p.h; p.vy=0; p.onGround=true; }
    else if(p.vy<0){ p.y = pl.y + pl.h; p.vy=0; }
  }
  if(p.y>CANVAS_H+100){ // 낙사 — 방 시작점 근처로 복귀
    p.y=420; p.x=60; p.vy=0; p.hp=Math.max(1,p.hp-6); toast('발을 헛디뎌 굴러떨어졌다.','warn');
  }

  if(p.invuln>0) p.invuln-=dt;
  if(p.hp<=0){
    p.hp = Math.floor(p.maxHp*0.4);
    p.shield=0;
    toast('정신이 아득해진다... 가까스로 몸을 추스른다.', 'warn');
    loadRoom(G.currentRoomId, {x:60,y:420});
  }
}

function updateEnemies(dt){
  const room = currentRoom();
  const p = G.player;
  for(const en of room.enemies){
    if(!en.alive) continue;
    if(en.stun>0){ en.stun-=dt; continue; }
    if(en.weak>0) en.weak-=dt;

    const [minX,maxX] = en.patrol;
    const speed = en.type==='boss' ? 95 : 55;
    en.x += en.dir*speed*dt;
    if(en.x<minX){ en.x=minX; en.dir=1; }
    if(en.x>maxX-en.w){ en.x=maxX-en.w; en.dir=-1; }

    if(en.type==='ranged' || en.type==='boss'){
      en.shootCd -= dt;
      if(en.shootCd<=0){
        const dir = (p.x > en.x) ? 1 : -1;
        room.projEnemy = room.projEnemy||[];
        G.projectiles.push({
          x: en.x+(dir>0?en.w:-10), y:en.y+en.h/2-4, vx:dir*300, w:12,h:8,
          owner:'enemy', effect:'dmg', value: en.dmg*(en.weak>0?0.6:1), life:2.2, color:'#e08787'
        });
        en.shootCd = 1.5+Math.random()*0.9;
      }
    }

    if(p.invuln<=0 && aabb(p.x,p.y,p.w,p.h, en.x,en.y,en.w,en.h)){
      const dmg = Math.round(en.dmg*(en.weak>0?0.6:1));
      const absorbed = Math.min(p.shield,dmg);
      p.shield-=absorbed;
      p.hp -= (dmg-absorbed);
      p.invuln=0.8;
      toast(`${en.name}에게 피해를 입었다! (-${dmg-absorbed})`, 'warn');
    }
  }
}

function updateProjectiles(dt){
  const p = G.player;
  const room = currentRoom();
  for(const pr of G.projectiles){
    pr.x += pr.vx*dt;
    pr.life -= dt;
    if(pr.owner==='player'){
      for(const en of room.enemies){
        if(!en.alive || pr.dead) continue;
        if(aabb(pr.x,pr.y,pr.w,pr.h, en.x,en.y,en.w,en.h)){
          applyToEnemy(en, pr.effect, pr.value);
          pr.dead=true;
        }
      }
    } else {
      if(p.invuln<=0 && !pr.dead && aabb(pr.x,pr.y,pr.w,pr.h, p.x,p.y,p.w,p.h)){
        const dmg=Math.round(pr.value);
        const absorbed=Math.min(p.shield,dmg);
        p.shield-=absorbed; p.hp-=(dmg-absorbed); p.invuln=0.8; pr.dead=true;
        toast(`원거리 공격에 맞았다! (-${dmg-absorbed})`,'warn');
      }
    }
  }
  G.projectiles = G.projectiles.filter(pr=> !pr.dead && pr.life>0 && pr.x>-30 && pr.x<CANVAS_W+30);
}

/* ------------------------------ 신전 컷씬 / 엔딩 ------------------------------ */

function showAltarCutscene(){
  G.screen='shrineCutscene';
  renderScreenState();
}
function enterBossArena(){
  G.screen='play';
  loadRoom('흑막의땅', {x:60,y:420});
  renderScreenState();
  requestAnimationFrame(loop);
}
function showEnding(){
  G.screen='ending';
  renderScreenState();
}
