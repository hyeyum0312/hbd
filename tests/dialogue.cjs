const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('SpaceQuest.dc.html', 'utf8');
const logic = source.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
let now = 0, id = 0;
const timers = new Map();
function schedule(fn, ms, repeat = false) { const key = ++id; timers.set(key, {fn, at: now + ms, ms, repeat}); return key; }
function advance(ms) {
  const end = now + ms;
  for (;;) {
    const next = [...timers].filter(([, t]) => t.at <= end).sort((a,b) => a[1].at-b[1].at)[0];
    if (!next) break;
    const [key,t] = next; now=t.at;
    if (t.repeat) t.at+=t.ms; else timers.delete(key);
    t.fn();
  }
  now=end;
}
class DCLogic {
  props = {};
  setState(patch, callback) {
    const prev = this.state;
    this.state = {...prev, ...(typeof patch === 'function' ? patch(prev) : patch)};
    // dc-runtime supplies only previous props, not previous state.
    this.componentDidUpdate?.(this.props);
    callback?.();
  }
}
const React = {
  createElement: (type, props, ...children) => ({type, props: {...props, children}}),
  cloneElement: (element, props) => ({...element, props: {...element.props, ...props}})
};
const Component = vm.runInNewContext(logic+'\nComponent', {DCLogic, React,
  setTimeout: schedule, clearTimeout: key => timers.delete(key),
  setInterval: (fn,ms) => schedule(fn,ms,true), clearInterval: key => timers.delete(key)});
const app = new Component(); app.componentDidMount();
function button(label) { return app.renderVals().choices.find(b => b.props.children[0].includes(label)); }
function click(label) { const b=button(label); assert(b, label); b.props.onClick(); }
assert.equal(button('POWER').props.disabled, false);
click('POWER'); assert.equal(app.state.bootN, 1);
advance(160 * (vm.runInNewContext(logic + '\nBOOT.length', { DCLogic, React }) - 1));
assert.equal(button('START').props.disabled, false);
click('START'); assert.equal(app.state.ch, 'space');
console.log('PASS immediate POWER and START without waiting for intro text');
assert(button('ATTACK').props.disabled);
click('ATTACK'); assert.equal(app.state.killed,0);
advance(200); assert.equal(app.state.li,0);
assert(app.renderVals().dialogue.length > 0);
const intro = vm.runInNewContext(logic + '\nSCRIPT.space.lines', { DCLogic, React });
advance(Array.from(intro[0]).length * 26 + 700 - 200);
assert.equal(app.state.li,1);
assert(button('ATTACK').props.disabled);
advance(Array.from(intro[1]).length * 26 + 700);
assert.equal(app.state.li,2);
assert.equal(app.renderVals(true).fullDialogue,intro[2]);
assert(button('ATTACK').props.disabled);
advance(Array.from(intro[2]).length * 26 + 700);
assert.equal(app.state.li,3);
assert(button('ATTACK').props.disabled);
advance(5000);
assert.equal(button('ATTACK').props.disabled,false);
assert.equal(app.renderVals().dialogue,'BUG MONSTER 이(가) 나타났다!');
const enemies = vm.runInNewContext(logic + '\nENEMIES', { DCLogic, React });
assert.equal(enemies.length,3);
assert(!enemies.some(e=>e.n==="OVERTIME BOSS"));
let transcript;
for (let i = 0; i < enemies.length; i++) {
  const e = enemies[i];
  assert.equal(button('ATTACK').props.disabled,false);
  const encounterState = app.renderVals();
  const encounterScene = JSON.stringify(encounterState.scene);
  const encounterExp = app.state.exp;
  const attack = button('ATTACK');
  attack.props.onClick(); attack.props.onClick(); assert.equal(app.state.killed,i + 1);
  assert.equal(app.renderVals().dialogue, '');
  assert.equal(app.state.dialogueHistory.length, 0);
  const expected = e.n + " defeated.  +" + e.exp + " EXP\n" + e.m +
    (i === enemies.length - 1 ? "\n적은 전부 정리됐다. 좋은 기억도 경험치가 된다." : "");
  assert.equal(app.renderVals(true).fullDialogue,expected);
  assert(app.renderVals().choices.every(b => b.props.disabled));
  advance(200); assert.equal(app.state.killed,i + 1);
  advance(12000);
  transcript = expected;
  assert.equal(app.renderVals().dialogue,transcript);
  assert.equal(app.state.lastKill,null);
  if (i + 1 < enemies.length) assert(!app.renderVals().dialogue.includes(enemies[i+1].n));
  advance(5000); assert.equal(app.renderVals().dialogue,transcript);
  click('BACK');
  assert.equal(app.renderVals().dialogue,encounterState.dialogue);
  assert.equal(JSON.stringify(app.renderVals().scene),encounterScene);
  assert.equal(app.state.killed,i);
  assert.equal(app.state.exp,encounterExp);
  assert.equal(button('ATTACK').props.disabled,false);
  click('ATTACK'); advance(12000);
  assert.equal(app.renderVals().dialogue,expected);
  assert.equal(app.state.killed,i+1);
  if (i + 1 < enemies.length) {
    assert.equal(button('ATTACK'),undefined);
    assert.equal(button('NEXT').props.disabled,false);
    const rewardScene = JSON.stringify(app.renderVals().scene);
    const next = button('NEXT'); next.props.onClick(); next.props.onClick();
    assert.equal(app.state.killed,i + 1);
    assert.equal(app.renderVals().dialogue,'');
    assert(button('ATTACK').props.disabled);
    advance(5000);
    assert.equal(app.renderVals().dialogue,enemies[i+1].n + ' 이(가) 나타났다!');
    click('BACK');
    assert.equal(app.renderVals().dialogue,expected);
    assert.equal(JSON.stringify(app.renderVals().scene),rewardScene);
    assert.equal(button('NEXT').props.disabled,false);
    click('NEXT'); advance(5000);
    assert.equal(button('ATTACK').props.disabled,false);
  }
}
assert.equal(app.state.exp,70);
console.log('PASS encounter → ATTACK → reward → NEXT → next encounter, message reset and rapid-click guards');
assert(button('NEXT'));
const travelNext = button('NEXT'); travelNext.props.onClick(); travelNext.props.onClick();
assert.equal(app.renderVals().dialogue,'');
assert.equal(app.state.exp,100);
assert(button('계속').props.disabled);
advance(8000); assert.equal(button('계속').props.disabled,false);
assert.equal(app.renderVals().dialogue,'함께한 여행 defeated.  +30 EXP\n아직 정리 안 된 여행 사진이 절반이다.\nEXP 100 획득. 올해도 살아남았다.');
assert.equal(app.state.dialogueHistory.length,0);
console.log('PASS final NEXT replaces combat text with travel reward only and awards EXP once');
app.go('message');
assert.equal(app.renderVals().dialogue.includes(intro[0]), false);
advance(6000); assert.equal(app.state.endPhase,2);
advance(10000); assert.equal(app.state.endPhase,2);
assert.equal(button('NEXT').props.disabled,false); click('NEXT');
assert.equal(app.renderVals().dialogue,''); assert.equal(app.state.endPhase,3);
assert(button('NEXT').props.disabled); click('NEXT'); assert.equal(app.state.endPhase,3);
advance(8000); assert.equal(button('NEXT').props.disabled,false);
assert(app.renderVals().dialogue.startsWith('앞으로도'));
assert.equal(app.renderVals().dialogue,app.renderVals(true).fullDialogue);
click('BACK'); assert.equal(app.state.ch,'message'); assert.equal(app.state.endPhase,2);
assert.equal(app.renderVals().dialogue.endsWith('...!'),true);
advance(8000); assert.equal(app.state.endPhase,2);
click('BACK'); assert.equal(app.state.endPhase,1);
click('BACK'); assert.equal(app.state.endPhase,0);
click('BACK'); assert.equal(app.state.ch,'space');
console.log('PASS BACK restores message, pixel scene, enemy, EXP, buttons and cancels future timers');
app.go('message'); advance(13000); click('NEXT'); advance(8000);
click('NEXT'); assert.equal(app.state.endPhase,5);
assert.equal(app.renderVals().dialogue,'');
advance(13000);
assert(app.renderVals().dialogue.startsWith('다음 생일까지 계속됩니다...'));
assert.equal(app.renderVals().dialogue,app.renderVals(true).fullDialogue);
advance(13000); click('처음부터'); assert.equal(app.state.ch,'boot');
assert.equal(button('POWER').props.disabled, false);
assert.equal(app.renderVals().dialogue.includes(intro[0]), false);
const log = app.renderVals().dialogueLog;
const scroll = {scrollTop: 0, scrollHeight: 1000, clientHeight: 200};
log.props.ref(scroll); assert.equal(scroll.scrollTop,1000);
scroll.scrollTop=100; log.props.onScroll({currentTarget:scroll});
log.props.ref(scroll); assert.equal(scroll.scrollTop,100);
scroll.scrollTop=800; log.props.onScroll({currentTarget:scroll});
scroll.scrollHeight=1100; log.props.ref(scroll); assert.equal(scroll.scrollTop,1100);
console.log('PASS chapter history, chapter reset, scroll follows only at bottom');
app.go('murim'); advance(5000); click('NEXT'); advance(5000);
const portal = app.renderVals();
click('[ YES ]'); assert.equal(app.renderVals().dialogue,'');
assert(app.renderVals().choices.every(b => b.props.disabled));
advance(12000);
assert(app.renderVals().dialogue.startsWith('개발계의 고수'));
assert.equal(app.renderVals().dialogue,app.renderVals(true).fullDialogue);
assert.equal(app.state.dialogueHistory.length,0);
click('BACK');
assert.equal(app.renderVals().dialogue,portal.dialogue);
assert.equal(JSON.stringify(app.renderVals().scene),JSON.stringify(portal.scene));
click('당연히 YES'); assert.equal(app.renderVals().dialogue,''); advance(12000);
assert.equal(app.renderVals().dialogue,app.renderVals(true).fullDialogue);
console.log('PASS both portal choices clear old text, show only murim message, and preserve BACK');
app.go('quantum'); advance(5000); click('NEXT'); advance(8000); click('NEXT'); advance(5000);
const observePrompt = app.renderVals();
click('관측하기'); assert.equal(app.renderVals().dialogue,'');
advance(8000);
assert.equal(app.renderVals().dialogue,'OBSERVING...\n\nWAVE FUNCTION COLLAPSED.\nRESULT : 자는 중.\n무협 읽다가 그대로 잠든 것으로 추정. 역시.');
assert.equal(button('계속').props.disabled,false);
app.go('planet'); advance(5000); click('NEXT'); advance(5000); click('NEXT'); advance(5000);
const landing = app.renderVals();
click('NEXT'); assert.equal(app.renderVals().dialogue,'');
advance(8000);
assert.equal(app.renderVals().dialogue,'1994.09.16\nPLAYER 지운이\n지구에 접속한 날.');
assert.equal(app.renderVals().scene.props['data-memory-scene'],'earth');
assert.equal(app.renderVals().dialogue,app.renderVals(true).fullDialogue);
assert.equal(app.state.level,31);
assert.equal(app.state.birthdayLog,true);
click('BACK');
assert.equal(app.renderVals().dialogue,landing.dialogue);
assert.equal(app.state.level,31);
assert.equal(JSON.stringify(app.renderVals().scene),JSON.stringify(landing.scene));
console.log('PASS observation and mission messages reset, ending waits for both NEXT clicks, BACK restores landing');
// Follow the real birth-record → memory → birthday route.
click('NEXT'); advance(8000); click('NEXT');
assert.equal(app.state.ch,'memory'); assert.equal(app.state.level,31);
assert.equal(app.renderVals(true).fullDialogue,'...!');
function until(predicate, budget=50000) {
  for(let ms=0; ms<budget && !predicate(); ms+=25) advance(25);
  assert(predicate(),'timed sequence should reach its destination');
}
function memoryTo(target) {
  while(app.state.memoryPhase < target) {
    const phase=app.state.memoryPhase;
    advance(20000);
    assert.equal(app.state.ch,'memory');
    assert.equal(app.state.memoryPhase,phase,'memory must not auto advance');
    const next=button('NEXT');
    next.props.onClick(); next.props.onClick();
    assert.equal(app.state.memoryPhase,phase+1,'rapid clicks cannot skip unread scenes');
  }
}
function elements(node) {
  if(Array.isArray(node)) return node.flatMap(elements);
  if(!node || typeof node!=='object') return [];
  return [node,...elements(node.props?.children)];
}
memoryTo(1);
assert.equal(app.renderVals().scene.props['data-memory-scene'],'arrival');
assert(!app.renderVals(true).fullDialogue.includes('LOADING'));
memoryTo(3);
assert.equal(app.renderVals().scene.props['data-memory-scene'],'office');
const officeNodes=elements(app.renderVals().scene);
assert.equal(officeNodes.filter(n=>n.props?.['data-office-laptop']).length,2);
const desks=officeNodes.filter(n=>n.props?.['data-office-desk']);
assert.equal(desks.length,2);
const topDesk=elements(desks[0]).find(n=>n.type==='rect').props;
const bottomDesk=elements(desks[1]).find(n=>n.type==='rect').props;
assert.equal(topDesk.x,bottomDesk.x); assert(topDesk.y<bottomDesk.y);
memoryTo(5);

assert.equal(app.renderVals().scene.props['data-memory-scene'],'coffee');
memoryTo(6);
assert.equal(app.renderVals().scene.props['data-memory-scene'],'commute');
memoryTo(7);
assert.equal(app.renderVals(true).fullDialogue,'PARTY MEMBER ADDED : 혜연 ♥');
memoryTo(9);

assert.equal(app.renderVals().scene.props['data-memory-scene'],'nap');
assert.equal(button('PAUSE'),undefined);
assert.equal(button('PLAY'),undefined); advance(15000); assert.equal(app.state.memoryPhase,9);
const napScene=JSON.stringify(app.renderVals().scene);
click('NEXT'); advance(5000); assert.equal(app.state.memoryPhase,10);
assert.equal(app.renderVals().scene.props['data-memory-scene'],'tv');
click('BACK'); assert.equal(app.state.memoryPhase,9);
assert.equal(JSON.stringify(app.renderVals().scene),napScene);
advance(10000); assert.equal(app.state.memoryPhase,9);
memoryTo(15);
advance(6000);
assert.equal(app.renderVals().scene.props['data-memory-scene'],'saved');
assert.equal(app.renderVals().dialogue,'MEMORY DATA SAVED ✓');
const memoryVisits=app._backHistory.filter(s=>s.state.ch==='memory').map(s=>s.state.memoryPhase);
for(let phase=0;phase<15;phase++) assert(memoryVisits.includes(phase),'memory phase '+phase);
advance(15000); assert.equal(app.state.ch,'memory');
click('NEXT'); assert.equal(app.state.ch,'message');
assert.equal(app.state.level,32);
assert.equal(app.renderVals().scene.props['data-ending-characters'],2);
assert(app.renderVals(true).fullDialogue.includes('HAPPY BIRTHDAY'));
advance(6500); assert.equal(app.state.endPhase,2);
assert.equal(app.renderVals().scene.props['data-kiss'],true);
click('NEXT'); advance(10000);
assert.equal(app.state.endPhase,3);
assert.equal(app.renderVals().scene.props['data-kiss'],true);
assert(app.renderVals().dialogue.startsWith('앞으로도 하고 싶은 거 실컷 하고,'));
click('BACK'); assert.equal(app.state.endPhase,2);
click('BACK'); assert.equal(app.state.endPhase,1);
click('BACK'); assert.equal(app.state.endPhase,0);
click('BACK'); assert.equal(app.state.ch,'memory'); assert.equal(app.state.memoryPhase,15);
assert.equal(app.state.level,31);
console.log('PASS encounter before loading, face-to-face office, montage, saved → present, couple kiss persists under letter, BACK');
app.componentWillUnmount(); assert.equal(timers.size,0);
console.log('PASS final result, ending message lock, BACK, replay, timer cleanup');
const bundle = fs.readFileSync('index.html','utf8');
const template = JSON.parse(bundle.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
assert.equal(template.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1],logic);
assert(template.includes('{{ dialogueLog }}'));
assert(template.includes('const GIRL')); assert(template.includes('◀ BACK'));
console.log('PASS deployed bundle matches source, girl ending and BACK included');

for (const search of ['', '?sample', '?sample=1', '?other=sample']) {
  const Variant = vm.runInNewContext(logic + '\nComponent', { DCLogic, React, URLSearchParams,
    window: { location: { search }, innerWidth: 960 },
    setTimeout: schedule, clearTimeout: key => timers.delete(key),
    setInterval: (fn,ms) => schedule(fn,ms,true), clearInterval: key => timers.delete(key) });
  const variant = new Variant(); variant.componentDidMount();
  variant.go('message'); advance(6000);
  variant.renderVals().choices.find(b => b.props.children[0].includes('NEXT')).props.onClick();
  assert(variant.renderVals().locked);
  advance(10000);
  const text = variant.renderVals().dialogue;
  if (search.startsWith('?sample')) assert.equal(text, '생일 진짜 많이 축하해 ❤️');
  else assert(text.startsWith('앞으로도 하고 싶은 거 실컷 하고,'));
  assert.equal(variant.renderVals().locked,false);
  variant.renderVals().choices.find(b => b.props.children[0].includes('NEXT')).props.onClick();
  advance(13000);
  assert(variant.renderVals().dialogue.startsWith('다음 생일까지 계속됩니다...'));
  variant.back(); assert.equal(variant.renderVals().dialogue,text);
  variant.componentWillUnmount();
}
assert.equal(timers.size,0);
console.log('PASS regular and ?sample endings, NEXT and BACK in both modes');
