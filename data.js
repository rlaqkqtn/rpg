/* =========================================================================
   data.js — 직업 / 지역 데이터
   type: 딜/버프/제어/디버프/유틸 (전투 로직은 engine.js의 범용 리졸버가 처리)
   range: 딜 타입 스킬에만 사용 — 'melee' | 'ranged' (기본 melee)
   aoe: true면 전방이 아니라 자신 주변 원형 범위로 적용
   ========================================================================= */

const REGION_META = {
  지상: { accent:'#a97d4a', sky:['#3a2f1f','#1c1712'], ground:'#2c2416', desc:'세 세계의 한가운데, 마을과 들판과 폐허가 뒤섞인 곳' },
  지하: { accent:'#8a3a3a', sky:['#241214','#0d0709'], ground:'#1a0f0f', desc:'흑막이 가장 먼저 지배한 땅. 광산과 동굴이 끝없이 이어진다' },
  천상: { accent:'#6e8fb8', sky:['#16223a','#0b1120'], ground:'#1c2740', desc:'신들의 영역. 구름 위로 낯선 신성한 건축물이 떠 있다' },
};

const GENERAL_JOBS = [
  // ----- 지상 (도발/근중거리) -----
  { id:'용병', region:'지상', skills:[
      {name:'철갑 태세', type:'버프', desc:'방어력이 상승한다.'},
      {name:'도발의 외침', type:'제어', range:'melee', desc:'주변 적을 도발해 스턴시킨다.'},
      {name:'강타', type:'딜', range:'melee', desc:'근접 강공격을 가한다.'},
    ], advancements:[
      {name:'결사대장', skills:['불굴','전열 유지','최후의 저항']},
      {name:'암살자', skills:['그림자 걸음','약점 간파','일격필살']},
    ]},
  { id:'행상인', region:'지상', skills:[
      {name:'감정의 눈', type:'유틸', desc:'즉시 체력을 소량 회복한다. (탐색 감각을 다잡는다)'},
      {name:'연막탄', type:'디버프', range:'ranged', desc:'적을 약화시키는 연막을 던진다.'},
      {name:'투척 단검', type:'딜', range:'ranged', desc:'단검을 투척한다.'},
    ], advancements:[
      {name:'정보상', skills:['지역 정보망','뒷거래','속임수 협상']},
      {name:'밀수꾼', skills:['위험 지형 적응','빠른 손','탈출 연막']},
    ]},
  { id:'수배꾼', region:'지상', skills:[
      {name:'추적 표식', type:'디버프', range:'ranged', desc:'적을 약화시키는 표식을 남긴다.'},
      {name:'포박 사슬', type:'제어', range:'ranged', desc:'사슬로 적을 묶어 스턴시킨다.'},
      {name:'저격', type:'딜', range:'ranged', desc:'원거리 고정 피해를 가한다.'},
    ], advancements:[
      {name:'현상금 사냥꾼', skills:['처형 선고','연속 사격','마지막 숨통']},
      {name:'함정 사냥꾼', skills:['철망 함정','폭발 표식','덫의 지배자']},
    ]},
  // ----- 지하 (근접, 암귀사냥꾼만 예외) -----
  { id:'광부', region:'지하', skills:[
      {name:'단단한 살갗', type:'버프', desc:'방어막을 얻는다.'},
      {name:'낙석 유도', type:'제어', range:'melee', desc:'전방의 적을 기절시킨다.'},
      {name:'곡괭이 강타', type:'딜', range:'melee', desc:'근접 광역 공격을 가한다.', aoe:true},
    ], advancements:[
      {name:'채굴왕', skills:['채굴 특화','보석 갑주','대지의 축복']},
      {name:'지진술사', skills:['지반 붕괴','진동파','대격변']},
    ]},
  { id:'암귀사냥꾼', region:'지하', skills:[
      {name:'맹독 도포', type:'디버프', range:'ranged', desc:'독을 던져 적을 약화시킨다.'},
      {name:'함정 설치', type:'제어', range:'ranged', desc:'원거리에서 적을 옭아맨다.'},
      {name:'급소 찌르기', type:'딜', range:'ranged', desc:'투척형 급소 공격을 가한다.'},
    ], advancements:[
      {name:'맹독사', skills:['맹독 확산','부식','맹독 폭발']},
      {name:'함정술사', skills:['연쇄 함정','매복','완벽한 덫']},
    ]},
  { id:'혈투사', region:'지하', skills:[
      {name:'피의 갈증', type:'버프', desc:'공격 시 체력을 흡수하는 상태가 된다. (체력 소량 회복)'},
      {name:'광기의 방어', type:'버프', desc:'다음 공격력이 상승하는 상태가 된다. (방어막 획득)'},
      {name:'광기의 연타', type:'딜', range:'melee', desc:'다단 근접 공격을 가한다.'},
    ], advancements:[
      {name:'광전사', skills:['자상','한계돌파','최후의 광란']},
      {name:'투기장의 왕', skills:['제압의 원환','압도','왕좌의 위엄']},
    ]},
  // ----- 천상 (원거리) -----
  { id:'성기사', region:'천상', skills:[
      {name:'수호의 오라', type:'버프', desc:'방어막을 얻는다.'},
      {name:'빛의 사슬', type:'제어', range:'ranged', desc:'원거리에서 적을 속박한다.'},
      {name:'심판의 창', type:'딜', range:'ranged', desc:'창을 투척한다.'},
    ], advancements:[
      {name:'수호기사', skills:['철벽','광역 속박의 빛','반사의 빛']},
      {name:'심판자', skills:['심판의 낙뢰','정화의 빛','최후의 심판']},
    ]},
  { id:'신관', region:'천상', skills:[
      {name:'자가 치유', type:'유틸', desc:'체력을 회복한다.'},
      {name:'결계', type:'디버프', range:'ranged', desc:'결계로 적을 약화시킨다.'},
      {name:'신성탄', type:'딜', range:'ranged', desc:'신성한 탄환을 발사한다.'},
    ], advancements:[
      {name:'치유사', skills:['연속 치유','불멸의 가호','정화']},
      {name:'축복술사', skills:['강화의 축복','가호의 잔영','천상의 개입']},
    ]},
  { id:'의식집행자', region:'천상', skills:[
      {name:'봉인의 사슬', type:'제어', range:'ranged', desc:'적의 행동을 봉쇄한다.'},
      {name:'의식진', type:'버프', desc:'효과 범위를 강화하는 진을 두른다. (방어막)'},
      {name:'저주의 낙인', type:'딜', range:'ranged', desc:'저주를 투사해 지속 피해를 각인시킨다.'},
    ], advancements:[
      {name:'봉인술사', skills:['완전 봉인','약화의 진','최후의 봉인']},
      {name:'강령술사', skills:['혼령 소환','계약의 힘','망자의 군세']},
    ]},
];

const HIDDEN_JOBS = [
  { id:'쉬었음청년', region:'지상', special:'fusion', skills:[
      {name:'스킬 흡수', type:'유틸', desc:'다른 직업의 스킬을 흡수해 체력을 회복한다. (실제 조합/진화 UI는 추후 구현)'},
      {name:'즉흥 대응', type:'버프', desc:'최근 행동을 바탕으로 임시 방어막을 얻는다.'},
      {name:'경험의 축적', type:'딜', range:'melee', desc:'지금까지 배운 흔적을 담아 근접 공격한다.'},
    ]},
  { id:'광대', region:'지상', skills:[
      {name:'패 뽑기', type:'버프', desc:'전투 시작 시 랜덤 방어막을 얻는다.'},
      {name:'광대의 도약', type:'제어', range:'melee', desc:'도약 후 주변 적을 흔든다.'},
      {name:'마지막 웃음', type:'딜', range:'melee', aoe:true, desc:'주변 적 전원에게 큰 피해를 준다. (고위험 고보상)'},
    ]},
  { id:'사기꾼', region:'지상', skills:[
      {name:'속임수 거래', type:'유틸', desc:'회복 효과를 얻는다. (실패 확률 존재라는 설정, 프로토타입에서는 항상 성공)'},
      {name:'가짜 죽음', type:'제어', range:'melee', desc:'위장 사망으로 주변 적을 방심시켜 스턴시킨다.'},
      {name:'도박사의 손', type:'딜', range:'ranged', desc:'배율을 걸고 큰 피해를 노린다.'},
    ]},
  { id:'망령', region:'지하', skills:[
      {name:'반신반의', type:'버프', desc:'일정 시간 큰 방어막을 얻는다.'},
      {name:'빙의', type:'디버프', range:'melee', desc:'적에게 옮겨붙어 약화시킨다.'},
      {name:'원한', type:'딜', range:'melee', aoe:true, desc:'받은 피해를 모아뒀다가 주변에 되돌려준다.'},
    ]},
  { id:'장의사', region:'지하', skills:[
      {name:'해부', type:'유틸', desc:'체력을 회복한다.'},
      {name:'인형 조종', type:'버프', desc:'방어막을 얻는다.'},
      {name:'묘지기의 방벽', type:'제어', range:'melee', desc:'주변 적을 밀쳐내며 스턴시킨다.'},
    ]},
  { id:'오류인간', region:'지하', skills:[
      {name:'캡 브레이크', type:'딜', range:'melee', desc:'3초간 스킬 재사용 대기시간이 사라진다. (공격속도 상한 제거)'},
      {name:'음수 쿨다운', type:'딜', range:'ranged', desc:'규칙을 무시한 공격을 가한다.'},
      {name:'충돌 판정 상실', type:'버프', desc:'일정 시간 적의 타겟팅에서 제외되는 상태가 된다. (방어막)'},
    ]},
  { id:'용의 후계자', region:'천상', skills:[
      {name:'용의 숨결', type:'딜', range:'ranged', desc:'원거리 광역 브레스 공격을 가한다.'},
      {name:'비늘 각성', type:'버프', desc:'저항력이 대폭 상승한다. (큰 방어막)'},
      {name:'용왕의 위엄', type:'제어', range:'ranged', desc:'주변 적 전체를 공포에 빠뜨린다.'},
    ]},
  { id:'시간방랑자', region:'천상', skills:[
      {name:'되감기', type:'유틸', desc:'직전 상태로 되돌아가듯 체력을 회복한다.'},
      {name:'가속의 잔상', type:'버프', desc:'짧은 시간 이동/행동속도가 상승한다.'},
      {name:'정지된 시간', type:'제어', range:'ranged', aoe:true, desc:'광역으로 적의 시간을 정지시킨다.'},
    ]},
  { id:'반사술사', region:'천상', skills:[
      {name:'거울 방패', type:'버프', desc:'원거리 공격을 반사하는 방어막을 얻는다.'},
      {name:'모방', type:'딜', range:'ranged', desc:'최근 맞은 적의 공격을 복사해 반격한다.'},
      {name:'완전 반사', type:'버프', desc:'짧은 시간 모든 피해를 무효화하는 큰 방어막을 얻는다.'},
    ]},
];

function jobById(id){
  return GENERAL_JOBS.find(j=>j.id===id) || HIDDEN_JOBS.find(j=>j.id===id);
}
function isHiddenJob(job){ return HIDDEN_JOBS.indexOf(job) !== -1; }
