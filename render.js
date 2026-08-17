/* =========================================================================
   render.js — 캔버스 드로잉 & HUD / 미니맵 / 모달 렌더링
   ========================================================================= */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

/* ------------------------------ 화면 전환 ------------------------------ */

function renderScreenState(){
  document.getElementById('screen-title').classList.toggle('hidden', G.screen!=='title');
  document.getElementById('screen-intro').classList.toggle('hidden', G.screen!=='intro');
  document.getElementById('screen-shrine').classList.toggle('hidden', G.screen!=='shrineCutscene');
  document.getElementById('screen-ending').classList.toggle('hidden', G.screen!=='ending');
  document.getElementById('game-wrap').classList.toggle('hidden', !(G.screen==='play'));

  if(G.screen==='intro'){
    document.getElementById('intro-region').textContent = G.spawnRegion+' · 랜덤 스폰';
    document.getElementById('intro-text').textContent = OPENING_TEXT[G.spawnRegion];
  }
  if(G.screen==='shrineCutscene'){
    document.getElementById('screen-shrine').innerHTML = altarCutsceneHTML();
  }
  if(G.screen==='ending'){
    document.getElementById('ending-meta').textContent =
      `이번 회차 스폰: ${G.spawnRegion} · 방문 순서: ${[...G.visited].join(' → ')}`;
  }
  if(G.screen==='play'){ renderHUD(); }
}

const OPENING_TEXT = {
  천상:`정신이 들었을 때, 당신은 구름 위 어딘가에 위태롭게 걸쳐 있었다. 발밑은 끝없는 낭떠러지, 머리 위로는 낯선 신들의 성역이 빛나고 있다. 이름도, 얼굴도, 어쩌다 이곳까지 떨어졌는지도 — 아무것도 기억나지 않는다.`,
  지상:`정신이 들었을 때, 당신은 이름 모를 들판에 쓰러져 있었다. 하늘 저편에서 떨어진 것 같은 느낌만 어렴풋할 뿐, 그 외엔 아무것도 기억나지 않는다.`,
  지하:`정신이 들었을 때, 당신은 차갑고 축축한 동굴 바닥에 쓰러져 있었다. 아득히 먼 머리 위에서 희미한 빛 한 줄기가 새어 들어올 뿐, 그 외엔 아무것도 기억나지 않는다.`,
};

/* ------------------------------ 캔버스 드로잉 ------------------------------ */

function draw(){
  const room = currentRoom();
  const meta = REGION_META[room.region] || {sky:['#141414','#050505'], ground:'#2a2a2a', accent:'#d4af37'};

  const grad = ctx.createLinearGradient(0,0,0,CANVAS_H);
  grad.addColorStop(0, meta.sky[0]); grad.addColorStop(1, meta.sky[1]);
  ctx.fillStyle = grad; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);

  if(!room._deco){
    room._deco = [];
    const n = room.region==='천상'?46 : room.region==='지하'?26 : 22;
    for(let i=0;i<n;i++) room._deco.push({x:Math.random()*CANVAS_W, y:Math.random()*(CANVAS_H-80), r:Math.random()*2+0.6});
  }
  ctx.fillStyle = room.region==='천상' ? 'rgba(255,255,255,0.55)'
    : room.region==='지하' ? 'rgba(150,100,100,0.35)'
    : room.region==='지상' ? 'rgba(170,210,140,0.3)' : 'rgba(212,175,55,0.25)';
  for(const d of room._deco){ ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2); ctx.fill(); }

  // 발판
  for(const pl of room.platforms){
    ctx.fillStyle = meta.ground;
    ctx.fillRect(pl.x,pl.y,pl.w,pl.h);
    ctx.strokeStyle = meta.accent; ctx.lineWidth=2;
    ctx.strokeRect(pl.x+1,pl.y+1,Math.max(0,pl.w-2),Math.max(0,pl.h-2));
  }

  // 문
  for(const d of room.doors){
    let locked=false;
    if(d.gate && d.gate!=='boss' && !G.unlockedGates.has(d.gate)) locked=true;
    if(d.requiresKey && !G.keys.has(d.region)) locked=true;
    ctx.fillStyle = locked ? 'rgba(70,70,80,0.55)' : 'rgba(212,175,55,0.30)';
    ctx.fillRect(d.x,d.y,d.w,d.h);
    ctx.strokeStyle = locked ? '#555a6b' : '#d4af37';
    ctx.lineWidth=2; ctx.strokeRect(d.x,d.y,d.w,d.h);
  }

  // 제단
  if(room.altar){
    const a=room.altar;
    ctx.beginPath(); ctx.arc(a.x+a.w/2, a.y+a.h/2, a.w/2, 0, Math.PI*2);
    ctx.fillStyle = G.keys.size>=3 ? '#fff6da' : '#332c18';
    ctx.fill(); ctx.strokeStyle='#d4af37'; ctx.lineWidth=2; ctx.stroke();
  }

  // 픽업
  for(const pk of room.pickups){
    if(pk.collected) continue;
    ctx.beginPath(); ctx.arc(pk.x,pk.y,10,0,Math.PI*2);
    ctx.fillStyle = pk.kind==='key' ? '#fff6da' : (isHiddenJob(jobById(pk.ref)) ? '#d4af37' : '#9fd6a8');
    ctx.fill(); ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1.5; ctx.stroke();
  }

  // 적
  for(const en of room.enemies){
    if(!en.alive) continue;
    ctx.fillStyle = en.type==='boss' ? '#7a2e2e' : (en.type==='ranged' ? '#6e8fb8' : '#8a3a3a');
    ctx.fillRect(en.x,en.y,en.w,en.h);
    if(en.stun>0){ ctx.fillStyle='#fff6da'; ctx.fillRect(en.x+en.w/2-3, en.y-16, 6,6); }
    ctx.fillStyle='#0d0e14'; ctx.fillRect(en.x-2,en.y-10,en.w+4,5);
    ctx.fillStyle='#c65a5a'; ctx.fillRect(en.x-2,en.y-10,(en.w+4)*Math.max(0,en.hp/en.maxHp),5);
  }

  // 히트 이펙트
  ctx.fillStyle='rgba(255,255,255,0.30)';
  for(const fx of G.hitFx) ctx.fillRect(fx.x,fx.y,fx.w,fx.h);

  // 투사체
  for(const pr of G.projectiles){ ctx.fillStyle = pr.color||'#fff'; ctx.fillRect(pr.x,pr.y,pr.w,pr.h); }

  // 플레이어
  const p = G.player;
  ctx.fillStyle = p.invuln>0 ? 'rgba(232,226,208,0.55)' : '#e8e2d0';
  ctx.fillRect(p.x,p.y,p.w,p.h);
  ctx.fillStyle='#12141f';
  ctx.fillRect(p.facing>0? p.x+p.w-9:p.x+3, p.y+10, 6,6);
  if(p.shield>0){ ctx.strokeStyle='#6e8fb8'; ctx.lineWidth=2; ctx.strokeRect(p.x-3,p.y-3,p.w+6,p.h+6); }

  document.getElementById('room-title').textContent = room.title;
  renderHUD();
}

/* ------------------------------ HUD ------------------------------ */

function renderHUD(){
  const p = G.player;
  document.getElementById('hp-bar').style.width = `${100*Math.max(0,p.hp)/p.maxHp}%`;
  document.getElementById('hp-num').textContent = `${Math.max(0,Math.round(p.hp))}/${p.maxHp}`;
  document.getElementById('shield-bar').style.width = `${Math.min(100,p.shield*1.6)}%`;
  document.getElementById('shield-num').textContent = `${Math.round(p.shield)}`;

  const keyChips = REGIONS.map(r=>{
    const on = G.keys.has(r);
    return `<div class="key-chip ${on?'on':''}" title="${r}">${on?'✦':'·'}</div>`;
  }).join('');
  document.getElementById('key-row').innerHTML = keyChips;

  const slotsEl = document.getElementById('job-slots');
  slotsEl.innerHTML = [0,1,2].map(i=>{
    if(i>=maxSlots()) return `<div class="slot empty"><div class="name">잠김</div><div class="region-tag">파편 ${i}개 필요</div></div>`;
    const jobId = G.slots[i];
    const job = jobId? jobById(jobId): null;
    return `<div class="slot ${G.activeSlot===i?'active':''}" onclick="setActiveSlot(${i})">
      <div class="name">${i+1}. ${job? job.id : '― 비어있음 ―'}</div>
      <div class="region-tag">${job? (job.region+(isHiddenJob(job)?' · 히든':' 직업')) : '아래 목록에서 배치'}</div>
    </div>`;
  }).join('');

  const job = G.slots[G.activeSlot] ? jobById(G.slots[G.activeSlot]) : null;
  const now = performance.now()/1000;
  const paletteEl = document.getElementById('skill-palette');
  if(!job){
    paletteEl.innerHTML = `<p style="color:var(--parchment-dim); font-size:12px;">현재 슬롯에 직업이 없다. 아래 습득 목록에서 배치하라.</p>`;
  } else {
    const keys=['Z','X','C'];
    paletteEl.innerHTML = job.skills.map((sk,i)=>{
      const cd = G.cooldowns[sk.name]||0;
      const remain = Math.max(0, cd-now);
      const ready = remain<=0.05;
      return `<button class="skill-btn" ${ready?'':'disabled'} onclick='castSkill(${JSON.stringify(sk).replace(/'/g,"&#39;")})'>
        <span class="sk-name">[${keys[i]}] ${sk.name}</span><span class="sk-type">${sk.type}</span>
        <div class="sk-desc">${sk.desc}${ready? '' : ` · ${remain.toFixed(1)}s`}</div>
      </button>`;
    }).join('');
  }

  const learnedIds = [...G.learned];
  const learnedEl = document.getElementById('learned-list');
  if(learnedIds.length){
    learnedEl.innerHTML = learnedIds.map(id=>{
      const j = jobById(id);
      return `<button class="chip-btn" onclick="equipToSlot(G.activeSlot,'${id}')">${id}<span class="mini-tag">${isHiddenJob(j)?'히든':'일반'}</span></button>`;
    }).join('');
  } else {
    learnedEl.innerHTML = `<span style="color:var(--parchment-dim); font-size:11px;">아직 습득한 직업이 없다</span>`;
  }
}

function renderToasts(){
  const el = document.getElementById('toasts');
  el.innerHTML = G.toasts.map(t=>`<p class="${t.cls}">${t.msg}</p>`).join('');
}

/* ------------------------------ 미니맵 ------------------------------ */

function svgEl(html){
  const wrap = document.createElementNS('http://www.w3.org/2000/svg','svg');
  wrap.setAttribute('viewBox','0 0 260 210');
  wrap.innerHTML = html;
  return wrap;
}

function updateMinimap(){
  renderTriangleMap();
  renderRoomGraph();
}

function renderTriangleMap(){
  const W=260,H=170;
  const top={x:W/2,y:16}, left={x:26,y:150}, right={x:W-26,y:150}, center={x:W/2,y:112};
  const coords={천상:top,지상:left,지하:right};
  const lines=[[top,left],[left,right],[right,top]].map(([a,b])=>{
    const bright = G.keys.size>=1;
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${bright?'#7a6a2e':'#2a2d3d'}" stroke-width="1.5"/>`;
  }).join('');
  const nodes = REGIONS.map(r=>{
    const p=coords[r];
    const cur = currentRoom().region===r;
    const got = G.keys.has(r);
    const visited = G.visited.has(r);
    const fill = got? '#d4af37' : (visited? (REGION_META[r].accent) : '#2a2d3d');
    return `<circle cx="${p.x}" cy="${p.y}" r="${cur?11:8}" fill="${fill}" stroke="${cur?'#fff6da':'transparent'}" stroke-width="2"/>
      <text x="${p.x}" y="${p.y-(r==='천상'?16:-20)}" text-anchor="middle" class="node-label">${r}</text>`;
  }).join('');
  const shrineFill = G.keys.size>0 ? '#fff6da':'#191c2b';
  const shrine = `<circle cx="${center.x}" cy="${center.y}" r="6" fill="${shrineFill}" stroke="#d4af37" stroke-width="1.5"/>
    <text x="${center.x}" y="${center.y+18}" text-anchor="middle" class="node-sub">신전</text>`;
  const holder = document.getElementById('minimap-triangle');
  holder.innerHTML='';
  holder.appendChild(svgEl(`<g>${lines}${nodes}${shrine}</g>`));
}

function renderRoomGraph(){
  const holder = document.getElementById('minimap-room');
  const region = currentRoom().region;
  if(!DUNGEON_ROOMS[region]){ holder.innerHTML = `<p class="mini-note">허브 / 특수 구역</p>`; return; }
  const ids = DUNGEON_ROOMS[region];
  const cellW=70, cellH=56, offX=20, offY=14;
  const pos = {};
  ids.forEach(id=>{ const l=MINIMAP_LAYOUT[id]; pos[id]={x:offX+l.col*cellW+20, y:offY+l.row*cellH+20}; });
  const edges = MINIMAP_EDGES[region].map(([a,b])=>{
    const pa=pos[a], pb=pos[b];
    const seen = G.discoveredRooms.has(a) && G.discoveredRooms.has(b);
    return `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="${seen?'#7a6a2e':'#20222f'}" stroke-width="2"/>`;
  }).join('');
  const nodes = ids.map(id=>{
    const p=pos[id];
    const known = G.discoveredRooms.has(id);
    const cur = G.currentRoomId===id;
    const fill = !known? '#181a26' : (cur? '#d4af37' : '#4a4530');
    return `<rect x="${p.x-16}" y="${p.y-12}" width="32" height="24" rx="4" fill="${fill}" stroke="${cur?'#fff6da':'#2a2d3d'}" stroke-width="1.5"/>`;
  }).join('');
  holder.innerHTML='';
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 250 130');
  svg.innerHTML = `<g>${edges}${nodes}</g>`;
  holder.appendChild(svg);
}

/* ------------------------------ 게이트 선택 모달 ------------------------------ */

function renderGateModal(){
  const remaining = REGIONS.filter(r=>!G.visited.has(r));
  const btns = remaining.map(r=>`<button class="btn primary" onclick="confirmGate('${r}')">${r}(으)로 향한다</button>`).join('');
  document.getElementById('gate-modal-body').innerHTML = `
    <p class="panel-title">신전의 힘 — 다음 목적지 선택</p>
    <p style="font-size:13px; color:var(--parchment-dim); margin-bottom:14px;">
      파편 하나를 손에 넣자, 신전으로 향하는 길이 두 갈래로 열렸다. 둘 중 하나만 지금 나아갈 수 있다.
    </p>
    <div class="btn-row">${btns}</div>
    <button class="btn" style="margin-top:10px;" onclick="cancelGate()">돌아가기</button>
  `;
  document.getElementById('gate-modal').classList.remove('hidden');
}
function hideGateModal(){ document.getElementById('gate-modal').classList.add('hidden'); }

/* ------------------------------ 신전 컷씬 / 엔딩 보조 ------------------------------ */

function altarCutsceneHTML(){
  return `
    <div class="eyebrow">무게중심 · 중앙지점 신전</div>
    <h1 style="font-size:34px;">세 파편이 모이다</h1>
    <p style="max-width:520px;">세 세계에서 모은 「신의 은총」 파편 셋이 제단 위에서 공명한다.
    빛이 소용돌이치며 흑막을 옭아매던 봉인의 일부가 풀려나간다 — 그 힘이 이제, 흑막을 약화시킨다.
    흑막의 땅으로 향하는 길이 열렸다.</p>
    <button class="btn primary" onclick="enterBossArena()">흑막의 땅으로 진입한다</button>
  `;
}
