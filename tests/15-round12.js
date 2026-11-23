const { chromium } = require('playwright');
const path = require('path');
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// 第十二版（2026-11）：性別 30 天只能改一次、標價和出價 NT$ 1～5,000、一個人同時最多 3 件案件
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const W = (ms = 150) => p.waitForTimeout(ms);
  const js = (f, a) => p.evaluate(f, a);
  const act = async (a, x = {}) => { await js(([a, x]) => { const el = document.createElement('button'); el.dataset.act = a; Object.assign(el.dataset, x); document.body.appendChild(el); el.click(); el.remove(); }, [a, x]); await W(); };
  const go = async h => { await js(h => { location.hash = h; }, h); await W(250); };
  const st = () => js(() => JSON.parse(localStorage.getItem('swaptime-proto-v1')));
  const fresh = async uid => { await p.goto('about:blank'); await p.goto(B + '#browse'); await js(() => { localStorage.clear(); localStorage.setItem('swaptime-intro-v1', '1'); }); await p.reload(); await W(300); if (uid) await act('pick', { id: uid }); };
  const patch = async (src) => { await js(src => { const s = JSON.parse(localStorage.getItem('swaptime-proto-v1')); (new Function('s', src))(s); localStorage.setItem('swaptime-proto-v1', JSON.stringify(s)); }, src); await p.reload(); await W(300); };
  const ff = async min => { await act('openDemo'); await act('ff', { v: String(min) }); await act('close'); };
  const ferrText = () => js(() => (document.querySelector('.ferr') || {}).textContent || '');

  // 1. 性別 30 天內只能改一次（第一次改可以，馬上再改不行，30 天後又可以）
  await fresh('u1'); await go('#profile');
  ok(await js(() => document.querySelector('form[data-form="profile"]').innerText.includes('性別 30 天內只能改一次。')), '1 編輯資料寫「性別 30 天內只能改一次。」');
  await p.click('label[for="m-g1"]'); await p.click('form[data-form="profile"] button[type="submit"]'); await W(600);
  ok((await st()).users.find(x => x.id === 'u1').gender === '女', '1 第一次改性別可以');
  await go('#profile'); await p.click('label[for="m-g0"]'); await p.click('form[data-form="profile"] button[type="submit"]'); await W(300);
  ok(/^性別 30 天內只能改一次，\d+月\d+日（.）\d\d:\d\d 之後才能再改$/.test(await ferrText()) && (await st()).users.find(x => x.id === 'u1').gender === '女', '1 30 天內再改：欄位下面寫什麼時候才能再改 → ' + await ferrText());
  await ff(30 * 1440 + 10); await go('#me'); await go('#profile'); await p.click('label[for="m-g0"]'); await p.click('form[data-form="profile"] button[type="submit"]'); await W(600);
  ok((await st()).users.find(x => x.id === 'u1').gender === '男', '1 30 天後可以再改');
  await fresh('u1'); await go('#profile'); await p.fill('#m-cls', '資工3A'); await p.click('form[data-form="profile"] button[type="submit"]'); await W(600);
  ok((await st()).users.find(x => x.id === 'u1').cls === '資工3A' && !(await st()).users.find(x => x.id === 'u1').genderAt, '1 沒改性別時不算一次');

  // 2. 標價、出價都是 NT$ 1～5,000
  await fresh('u1'); await go('#post');
  await p.fill('#p-b', '第一宿舍'); await p.fill('#p-meet', '大廳');
  for (const [v, good] of [['0', false], ['5001', false], ['1', true]]) {
    await p.fill('#p-budget', v); await p.click('form[data-form="post"] button[type="submit"]'); await W();
    const sheet = await js(() => !!document.querySelector('.sheet [data-act="postOk"]'));
    ok(good ? sheet : (!sheet && (await ferrText()) === '標價請在 NT$ 1 到 5,000 之間'), '2 標價 ' + v + (good ? ' 可以發布' : ' 不行：' + await ferrText()));
    if (sheet) await act('close');
  }
  await fresh('u3'); await go('#task-t2');  /* 林柏翰是 t2 的本體，換張書瑋出價 */
  await act('pick', { id: 'u2' }); await go('#task-t1'); await act('openBid', { id: 't1' }); await W(200);
  for (const [v, good] of [['0', false], ['5001', false], ['5000', true]]) {
    await p.fill('#op', v); await p.click('form[data-form="offer"] button[type="submit"]'); await W();
    const price = (await st()).tasks.find(t => t.id === 't1').offers.find(o => o.user === 'u2').price;
    ok(good ? price === 5000 : ((await ferrText()) === '出價請在 NT$ 1 到 5,000 之間' && price === 420), '2 出價 ' + v + (good ? ' 可以送出' : ' 不行：' + await ferrText()));
    if (good) break;
  }
  ok(await js(() => { const i = document.querySelector('#op'); return !i || (i.min === '1' && i.max === '5000'); }), '2 出價欄位標示 1～5000');

  // 3. 一個人同時最多 3 件（當替身、待開工或打掃中）
  await fresh('u1');  /* 王小明本來是 t3 的替身（待開工），再給兩件，湊滿 3 件 */
  await patch("const a=s.tasks.find(t=>t.id==='t6');a.assignee='u1';const b=s.tasks.find(t=>t.id==='t9');b.status='assigned';b.start=Date.now()+5*86400e3;b.end=b.start+3600e3;b.closedAt=null;");
  await go('#task-t2');
  ok(await js(() => { const c = document.querySelector('.card.next'); return c.innerText.includes('你同時進行的案件已經有 3 件（待開工或打掃中），打掃完成一件後才能再出價。') && !c.querySelector('[data-act="acceptPrice"],[data-act="openBid"]'); }), '3 滿 3 件：出價卡說明上限，沒有出價按鈕');
  await act('acceptPrice', { id: 't2' });
  ok(!(await st()).tasks.find(t => t.id === 't2').offers.some(o => o.user === 'u1'), '3 滿 3 件：不能接受標價');
  await go('#task-t11');  /* 王小明被陳怡君選中、待確認 */
  ok(await js(() => { const c = document.querySelector('.card.next'), btn = c.querySelector('[data-act="acceptMatch"]'); return btn.disabled && c.innerText.includes('打掃完成一件後才能確認接案。') && !c.querySelector('[data-act="declineMatch"]').disabled; }), '3 滿 3 件：確認接案按不了（仍可以婉拒）');
  await act('acceptMatch', { id: 't11' });
  ok((await st()).tasks.find(t => t.id === 't11').status === 'pending', '3 滿 3 件：確認接案不會成功');
  // 本體看出價清單：滿 3 件的替身不能選
  await patch("const t=s.tasks.find(x=>x.id==='t1');t.offers.push({id:'o99',user:'u1',price:300,at:Date.now()});t.poster='u2';");
  await act('pick', { id: 'u2' }); await go('#task-t1');
  ok(await js(() => { const o = document.querySelector('[data-act="choose"][data-oid="o99"]'), row = Array.from(document.querySelectorAll('.offer')).find(r => r.innerText.includes('王小明')); return !o && row.innerText.includes('已滿 3 件，不能選'); }), '3 本體的出價清單：滿 3 件的替身寫「已滿 3 件，不能選」');
  // 打掃完成一件後就空出來
  await patch("s.tasks.find(t=>t.id==='t3').status='done';");
  await act('pick', { id: 'u1' }); await go('#task-t2');
  ok(await js(() => !!document.querySelector('.card.next [data-act="openBid"]')), '3 打掃完成一件後，又可以出價');
  await go('#me');
  ok(await js(() => document.querySelector('.rules').textContent.includes('每個人同時進行的案件（待開工或打掃中）最多 3 件')), '3 使用規則寫上限');

  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
