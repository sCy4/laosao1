const { chromium } = require('playwright');
const path = require('path');
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// 第十六版（2026-11）：有更新的點改成藍點、標記說明、替身確認接案後退出案件就取消
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
  const txt = sel => js(s => (document.querySelector(s) || {}).innerText || '', sel);

  // 1. 有更新的點是主色藍
  await fresh('u1'); await go('#task-t11'); await act('acceptMatch', { id: 't11' }); await go('#browse'); await act('pick', { id: 'u2' });
  ok(await js(() => getComputedStyle(document.querySelector('nav.tabs .upd-dot')).backgroundColor === 'rgb(0, 99, 156)'), '1 有更新的點是主色藍 #00639c');

  // 3. 標記的說明
  await go('#task-t11'); await p.click('.card.mini .taglink'); await W();
  ok((await txt('.tagmenu .tm-note')) === '標記只有你看得到。之後與這位替身互動時會顯示。', '3 標記替身的說明');
  await act('pick', { id: 'u1' }); await go('#task-t11'); await p.click('.card.mini .taglink'); await W();
  ok((await txt('.tagmenu .tm-note')) === '標記只有你看得到。之後與這位本體互動時會顯示。', '3 標記本體的說明');

  // 4. 替身確認接案後退出：案件取消
  await fresh('u1'); await go('#task-t11'); await act('acceptMatch', { id: 't11' });
  await p.click('.exit details.trouble summary'); await W();
  ok((await txt('details.trouble')).includes('退出後案件會取消，本體會收到通知。'), '4 說明寫退出後案件會取消');
  await p.click('[data-act="withdrawAssign"]'); await W();
  ok((await txt('.sheet p')) === '案件會取消，本體會收到通知。', '4 確認視窗：案件會取消');
  await p.click('.sheet [data-act="ok"]'); await W();
  const s = await st(), t = s.tasks.find(x => x.id === 't11');
  ok(t.status === 'cancelled' && t.cancelKind === 'withdraw', '4 案件變成已取消');
  ok(s.notes.some(n => n.to === 'u2' && n.taskId === 't11' && n.text === '王小明退出了，案件已取消') && s.notes.some(n => n.to === 'u3' && n.taskId === 't11' && n.text === '案件已取消'), '4 本體、其他出價的人都收到通知');
  ok(/^你在 .+ 退出了案件，案件已取消。$/.test(await txt('.banner')), '4 替身看到的原因：' + await txt('.banner'));
  await go('#browse'); await act('pick', { id: 'u2' }); await go('#past'); await act('seg', { k: 'pastKind', v: 'cancelled' });
  ok(await js(() => Array.from(document.querySelectorAll('.card.task')).some(c => c.innerText.includes('已取消・替身退出了'))), '4 本體的已取消清單寫「已取消・替身退出了」');
  await go('#task-t11');
  ok(/^替身在 .+ 退出了案件，案件已取消。$/.test(await txt('.banner')), '4 本體看到的原因');
  ok(!(await st()).tasks.some(x => x.id === 't11' && x.status === 'open'), '4 沒有回到召喚替身');

  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
