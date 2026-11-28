const { chromium } = require('playwright');
const path = require('path');
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// 第十七版（2026-11）：退出不通知其他出價者、標記說明、自動算打掃完成對本體不提、打掃完成後也能「案件失敗：打掃未完成」、驗收卡
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
  const notes = uid => st().then(s => s.notes.filter(n => n.to === uid).map(n => n.text));

  // 7. 驗收卡（t4：王小明是本體、陳怡君是替身，待驗收）
  await fresh('u1'); await go('#task-t4');
  const c = await js(() => { const c = document.querySelector('.card.next'), b = c.querySelector('[data-act="confirmDone"]'), tip = b.nextElementSibling; return { lead: c.querySelector('.np-lead').textContent, btn: b.textContent, tip: tip && tip.textContent, text: c.innerText,
    leadTop: c.querySelector('.np-lead').getBoundingClientRect().top < c.querySelector('.photos').getBoundingClientRect().top }; });
  ok(c.lead === '確認打掃完成？' && c.leadTop, '7 驗收卡上面寫「確認打掃完成？」');
  ok(c.btn === '確認打掃完成', '7 按鈕是「確認打掃完成」');
  ok(/^\d+ (分鐘|小時|天)後將自動確認打掃完成$/.test(c.tip || ''), '7 按鈕下面寫多久後自動確認：' + c.tip);
  ok(!c.text.includes('驗收完成後會顯示替身的收款方式'), '7 拿掉舊的長句');
  // 6. 沒有「照片只有你們兩人看得到。」
  ok(!(await txt('main')).includes('照片只有你們兩人看得到'), '6 打掃證明下面不寫「照片只有你們兩人看得到。」');
  await p.click('[data-act="confirmDone"]'); await W();
  ok((await txt('.sheet h2')) === '確認打掃完成？' && (await txt('.sheet [data-act="ok"]')) === '確認打掃完成', '7 確認視窗：確認打掃完成？');
  await act('close');

  // 4、5. 替身按了打掃完成後也能「案件失敗：打掃未完成」（t4 的替身是陳怡君）
  await act('pick', { id: 'u2' }); await go('#task-t4');
  await js(() => { const d = document.querySelector('details.trouble'); if (d) d.open = true; });
  ok((await txt('[data-act="failTask"]')) === '案件失敗：打掃未完成', '4、5 待驗收時替身仍有「案件失敗：打掃未完成」');
  await p.click('[data-act="failTask"]'); await W();
  ok((await txt('.sheet h2')) === '案件失敗：打掃未完成？', '5 確認視窗標題');
  await p.click('.sheet [data-act="ok"]'); await W();
  ok((await st()).tasks.find(t => t.id === 't4').cancelKind === 'fail', '4 待驗收時也能結束案件');
  ok((await notes('u1')).includes('陳怡君表示打掃未完成，案件已取消'), '5 本體收到「表示打掃未完成」');
  ok(await js(() => document.querySelector('.banner').textContent === '你表示打掃未完成，案件已取消。'), '5 替身看到的原因');

  // 3. 自動算打掃完成（t6：陳怡君是本體、張書瑋是替身，已開工）
  await fresh('u2'); await go('#task-t6'); await ff(70);
  ok(!(await txt('.card.next')).includes('自動算打掃完成'), '3 本體在結束時間後不會看到「會自動算打掃完成」');
  await ff(1440);
  const n2 = await notes('u2'), n4 = await notes('u4');
  ok(n2.includes('替身打掃完成了，請驗收') && !n2.some(x => x.includes('自動算')), '3 本體收到的和替身自己按完成一樣');
  ok(n4.includes('你沒有按打掃完成，已自動算打掃完成'), '3 替身收到說明');
  await go('#mine'); await go('#task-t6');
  ok(!(await txt('main')).includes('自動算打掃完成'), '3 本體的驗收卡不提自動');
  await act('pick', { id: 'u4' }); await go('#mine'); await go('#task-t6');
  ok((await txt('.card.next')).includes('你沒有按打掃完成，已自動算打掃完成。'), '3 替身的卡片有說明');
  // 本體選「案件失敗：打掃未完成」的按鈕名稱
  await act('pick', { id: 'u2' }); await go('#mine'); await go('#task-t6'); await js(() => { const d = document.querySelector('details.trouble'); if (d) d.open = true; });
  ok((await txt('[data-act="openNotDone"]')) === '案件失敗：打掃未完成', '5 本體的按鈕也叫「案件失敗：打掃未完成」');
  await p.click('[data-act="openNotDone"]'); await W();
  ok((await txt('.sheet h2')) === '案件失敗：打掃未完成', '5 本體的表單標題');

  for (const w of [320, 390]) { await p.setViewportSize({ width: w, height: 844 }); await act('close'); await fresh('u1'); await go('#task-t4');
    await p.evaluate(() => document.querySelector('.card.next').scrollIntoView()); await p.screenshot({ path: path.resolve(__dirname, 'out', 'r17-check-' + w + '.png') });
    ok(await js(() => document.documentElement.scrollWidth <= innerWidth), w + 'px 沒有左右捲動'); }
  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
