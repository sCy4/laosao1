const { chromium } = require('playwright');
const path = require('path');
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// 第十五版（2026-11）：已接滿 3 件的替身、取消案件說明、件數括號、進度「進行中」、狀態有更新的黃點、身分標籤沒有圖示
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
  const fill3 = "const a=s.tasks.find(t=>t.id==='t6');a.assignee='u3';const b=s.tasks.find(t=>t.id==='t9');b.status='assigned';b.assignee='u3';b.start=Date.now()+5*86400e3;b.end=b.start+3600e3;const c=s.tasks.find(t=>t.id==='t5');c.status='assigned';c.start=Date.now()+6*86400e3;c.end=c.start+3600e3;";

  // 1. 林柏翰已經有 3 件待開工或打掃中
  await fresh('u1'); await patch(fill3); await go('#task-t1');
  ok(await js(() => { const row = Array.from(document.querySelectorAll('.offer')).find(r => r.innerText.includes('林柏翰')), f = row.querySelector('.offer-full'), tag = row.querySelector('.offer-tag');
    return f && f.textContent === '已達到同時最多接 3 件的限制' && f.getBoundingClientRect().top >= tag.getBoundingClientRect().bottom - 1 && !!row.querySelector('[data-act="choose"]'); }), '1 出價清單：標記下面註明已達到上限，仍有「選這位」');
  await p.click('[data-act="choose"][data-oid="o2"]'); await W();
  ok((await txt('.sheet h2')) === '你確定仍要選林柏翰嗎？' && (await txt('.sheet')).includes('你選擇的替身不能再接案，因為已達到同時最多接 3 件的限制。') && (await txt('.sheet [data-act="ok"]')) === '仍要選擇', '1 選已接滿的替身：再問一次');
  await p.click('.sheet [data-act="ok"]'); await W();
  ok((await st()).tasks.find(t => t.id === 't1').status === 'pending', '1 仍可以選');
  ok(await js(() => { const c = document.querySelector('.card.next'); return c.innerText.includes('你選擇的替身不能再接案，因為已達到同時最多接 3 件的限制，你可以重新選擇替身。') && !c.querySelector('[data-act="unchoose"]').disabled; }), '1 待替身確認：說明已接滿，不用等 1 小時就能重新選擇替身');
  await p.click('[data-act="unchoose"]'); await W(); await p.click('.sheet [data-act="ok"]'); await W();
  ok((await st()).tasks.find(t => t.id === 't1').status === 'open', '1 馬上重新選擇替身成功');
  // 選了沒滿的人：仍要等 1 小時
  await p.click('[data-act="choose"][data-oid="o1"]'); await W(); await p.click('.sheet [data-act="ok"]'); await W();
  ok(await js(() => document.querySelector('[data-act="unchoose"]').disabled), '1 選了沒滿的替身：仍要等 1 小時');

  // 2、6. 取消案件的說明
  await js(() => document.querySelector('details.trouble').open = true); await p.click('[data-act="cancelTask"]'); await W();
  ok((await txt('.sheet')).includes('將撤銷所有出價並通知出價者。'), '2 待替身確認時取消：將撤銷所有出價並通知出價者');
  await act('close');
  await act('pick', { id: 'u2' }); await go('#task-t3');  /* 陳怡君的待開工案件 */
  await js(() => document.querySelector('details.trouble').open = true);
  ok((await txt('details.trouble')).includes('開工前都可以取消案件，替身會收到通知。') && !(await txt('details.trouble')).includes('建議先在留言板'), '6 待開工的說明');
  await p.click('[data-act="cancelTask"]'); await W();
  ok((await txt('.sheet p')) === '將通知替身。', '6 待開工取消：將通知替身');
  await act('close');

  // 4、7. 進度「進行中」、身分標籤沒有圖示
  ok((await txt('.steps')).replace(/\n/g, '/') === '召喚替身/進行中/驗收/付款/完成', '4 進度第二格是「進行中」');
  ok(await js(() => getComputedStyle(document.querySelector('.sum-role'), '::before').display === 'none'), '7 詳情頁的身分標籤沒有圖示');

  // 3、5. 件數括號；狀態有更新的黃點
  await fresh('u1'); await go('#task-t11'); await act('acceptMatch', { id: 't11' }); await go('#browse');  /* 王小明確認接案：陳怡君的案件從待替身確認變成待開工 */
  await act('pick', { id: 'u2' });
  ok(await js(() => !!document.querySelector('nav.tabs button[data-v="mine"] .upd-dot')), '5 我的案件分頁有黃點');
  await act('tab', { v: 'mine' });
  const m = await js(() => ({ h: Array.from(document.querySelectorAll('h2.grp-h')).map(h => h.textContent), seg: Array.from(document.querySelectorAll('.seg button')).map(b => ({ t: b.textContent, dot: !!b.querySelector('.upd-dot'), on: b.classList.contains('on') })),
    hDot: !!document.querySelector('h2.grp-h .upd-dot'), card: (() => { const c = Array.from(document.querySelectorAll('.card.task')).find(c => c.innerText.includes('15:00 至 16:00') && c.innerText.includes('第一宿舍')); return c && !!c.querySelector('.tc-bar .upd-dot'); })(),
    tag: getComputedStyle(document.querySelector('.tc-tab'), '::before').display }));
  ok(m.h.some(x => /^全部案件（\d+）/.test(x)), '3 全部案件（N）');
  ok(m.seg.every(x => /（\d+）/.test(x.t)), '3 我是替身／我是本體的件數有括號 ' + JSON.stringify(m.seg.map(x => x.t)));
  ok(m.hDot && m.seg.find(x => x.t.startsWith('我是本體')).dot && m.seg.find(x => x.t.startsWith('我是本體')).on && m.card, '5 全部案件、我是本體（先打開這一邊）、案件卡片都有黃點');
  ok(m.tag === 'none', '7 卡片的身分標籤沒有圖示');
  await go('#task-t11'); await go('#mine');
  ok(await js(() => !document.querySelector('.upd-dot')), '5 打開案件後黃點都消失');
  ok(await js(() => document.querySelector('h2.grp-h') && /^待你處理（\d+）$/.test(document.querySelector('h2.grp-h').textContent) || document.querySelector('main').innerText.includes('目前沒有需要你處理的事')), '3 待你處理（N）');
  await act('pick', { id: 'u1' }); await go('#mine');
  ok(await js(() => /^待你處理（\d+）$/.test(document.querySelector('h2.grp-h').textContent)), '3 待你處理（N）');
  // 結束的案件：先留在我的案件，打開後才移走
  await go('#browse'); await act('pick', { id: 'u2' }); await go('#task-t3');
  await js(() => document.querySelector('details.trouble').open = true); await p.click('[data-act="cancelTask"]'); await W(); await p.click('.sheet [data-act="ok"]'); await W();
  await go('#browse'); await act('pick', { id: 'u1' }); await go('#mine'); await act('seg', { k: 'mineRole', v: 'work' });
  ok(await js(() => { const g = Array.from(document.querySelectorAll('.grp')).find(s => s.innerText.startsWith('已完成或取消')); return !!g && !!g.querySelector('.upd-dot') && g.innerText.includes('本體取消了'); }), '5 被取消的案件先留在我的案件「已完成或取消」，有黃點');
  await go('#task-t3'); await go('#mine'); await act('seg', { k: 'mineRole', v: 'work' });
  ok(await js(() => !Array.from(document.querySelectorAll('.grp')).some(s => s.innerText.startsWith('已完成或取消'))), '5 打開後就移到「過去的案件」');
  // 重新整理後黃點還在
  await go('#browse'); await act('pick', { id: 'u2' }); await go('#task-t4'); await act('pick', { id: 'u1' });
  await go('#task-t4'); await act('confirmDone', { id: 't4' }); await p.click('.sheet [data-act="ok"]'); await W(); await go('#browse');
  await act('pick', { id: 'u2' }); await p.reload(); await W(400);
  ok(await js(() => !!document.querySelector('nav.tabs .upd-dot')), '5 重新整理後黃點還在');

  for (const w of [320, 390]) { await p.setViewportSize({ width: w, height: 844 }); await go('#mine'); await p.screenshot({ path: path.resolve(__dirname, 'out', 'r15-mine-' + w + '.png') });
    ok(await js(() => document.documentElement.scrollWidth <= innerWidth), w + 'px 沒有左右捲動'); }
  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
