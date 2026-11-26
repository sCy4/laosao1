const { chromium } = require('playwright');
const path = require('path');
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// 第十三版（2026-11）：沒被選上的替身在待替身確認時也能撤回出價；替身沒有收款方式時，本體不能按「我已付款」
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

  // 1. 沒被選上的替身（林柏翰在 t11 出價 240，陳怡君選了王小明）在待替身確認時可以撤回出價
  await fresh('u3'); await go('#task-t11');
  ok(await js(() => { const c = document.querySelector('.card.next'); return c.innerText.includes('本體已選其他人') && !!c.querySelector('[data-act="withdrawPending"]'); }), '1 沒被選上的替身有「撤回出價」');
  await p.click('[data-act="withdrawPending"]'); await W();
  ok(await js(() => document.querySelector('.sheet h2').textContent === '撤回出價？'), '1 先問「撤回出價？」');
  await p.click('.sheet [data-act="ok"]'); await W();
  let t11 = (await st()).tasks.find(t => t.id === 't11');
  ok(!t11.offers.some(o => o.user === 'u3') && t11.status === 'pending' && t11.assignee === 'u1', '1 撤回後出價不見，案件仍等王小明確認');
  ok(await js(() => !document.querySelector('[data-act="withdrawPending"]') && !document.querySelector('ol.steps')), '1 撤回後變回一般瀏覽者（沒有按鈕、沒有進度條）');
  await go('#mine'); await act('seg', { k: 'mineRole', v: 'work' });
  ok(await js(() => !document.querySelector('main').innerText.includes('本體已選其他人')), '1 我的案件裡不再有這個案件');
  await act('pick', { id: 'u1' }); await go('#task-t11');
  ok(await js(() => !document.querySelector('[data-act="withdrawPending"]') && !!document.querySelector('[data-act="acceptMatch"]')), '1 被選中的替身仍是確認接案／婉拒，沒有這顆按鈕');
  await act('pick', { id: 'u2' }); await go('#task-t11'); await ff(70); await act('unchoose', { id: 't11' }); await p.click('.sheet [data-act="ok"]'); await W();
  t11 = (await st()).tasks.find(t => t.id === 't11');
  ok(t11.status === 'open' && t11.offers.length === 1 && t11.offers[0].user === 'u1', '1 本體改選別人後，清單裡只剩王小明（撤回的人不在）');

  // 2. 替身沒有收款方式：本體不能按「我已付款」（t8：王小明是本體、林柏翰是替身，只有 LINE Pay）
  await fresh('u3'); await go('#bank'); await act('payToggle', { v: 'linepay' });
  await p.click('[data-act="removeLinePay"]'); await W();
  ok(await js(() => document.querySelector('.sheet').innerText.includes('等本體付款的案件，本體也沒辦法付款。')), '2 移除最後一種收款方式時提醒本體會沒辦法付款');
  await p.click('.sheet [data-act="ok"]'); await W();
  await go('#task-t8');
  ok(await js(() => { const c = document.querySelector('.card.next'); return c.querySelector('h2').textContent === '設定收款方式' && !!c.querySelector('[data-act="setupPay"]'); }), '2 替身看到「設定收款方式」');
  await go('#mine');
  ok(await js(() => document.querySelector('section[aria-label="待你處理"]')?.innerText.includes('請設定收款方式，本體才能付款')), '2 替身的待你處理：請設定收款方式');
  await act('pick', { id: 'u1' }); await go('#task-t8');
  ok(await js(() => { const c = document.querySelector('.card.next'); return c.innerText.includes('替身還沒設定收款方式，設定好之後你才能付款') && !c.querySelector('form[data-form="pay"]') && !Array.from(c.querySelectorAll('button')).some(b => b.textContent === '我已付款'); }), '2 本體沒有「我已付款」按鈕');
  await go('#mine');
  ok(await js(() => { const s = document.querySelector('section[aria-label="待你處理"]'); return !s || !s.innerText.includes('第二宿舍') || !s.innerText.includes('請付款'); }), '2 本體的待你處理沒有「請付款」');
  // 直接送出付款表單也不行
  await js(() => { const f = document.createElement('form'); f.dataset.form = 'pay'; f.dataset.id = 't8'; f.innerHTML = '<input type="radio" name="method" value="linepay" checked>'; document.body.appendChild(f); f.requestSubmit(); f.remove(); }); await W();
  ok((await st()).tasks.find(t => t.id === 't8').status === 'confirmed', '2 硬送付款表單也不會變成待確認收款');
  // 替身設定好後，本體收到通知、可以付款
  await act('pick', { id: 'u3' }); await go('#task-t8'); await p.click('[data-act="setupPay"]'); await W(300);
  await act('payToggle', { v: 'bank' });
  await p.selectOption('#b-code', '808'); await p.fill('#b-acct', '1234567890'); await p.click('form[data-form="bank"] button[type="submit"]'); await W(700);
  ok(await js(() => location.hash === '#task-t8'), '2 設定好後回到案件');
  ok((await st()).notes.some(n => n.to === 'u1' && n.taskId === 't8' && n.text === '替身設定好收款方式了，請付款 NT$ 350'), '2 本體收到「替身設定好收款方式了」');
  await act('pick', { id: 'u1' }); await go('#task-t8');
  ok(await js(() => !!document.querySelector('form[data-form="pay"]')), '2 本體現在可以付款');
  await p.fill('#l5', '12345'); await p.click('form[data-form="pay"] button[type="submit"]'); await W();
  ok((await st()).tasks.find(t => t.id === 't8').status === 'paid', '2 付款成功');

  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
