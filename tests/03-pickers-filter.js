const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const W = (ms = 150) => p.waitForTimeout(ms);
  const js = (f, a) => p.evaluate(f, a);
  const act = async (a, x = {}) => { await js(([a, x]) => { const el = document.createElement('button'); el.dataset.act = a; Object.assign(el.dataset, x); document.body.appendChild(el); el.click(); el.remove(); }, [a, x]); await W(); };
  const go = async h => { await js(h => { location.hash = h; }, h); await W(250); };
  const st = () => js(() => JSON.parse(localStorage.getItem('swaptime-proto-v1')));
  const task = async id => (await st()).tasks.find(t => t.id === id);
  const fresh = async uid => { await p.goto('about:blank'); await p.goto(B + '#browse'); await js(() => (localStorage.clear(),localStorage.setItem('swaptime-intro-v1','1'))); await p.reload(); await W(300); if (uid) await act('pick', { id: uid }); };
  const ff = async min => { await act('openDemo'); await act('ff', { v: String(min) }); await act('close'); };
  const dialClick = async (deg, R) => { const bx = await p.locator('.dial').boundingBox(); const cx = bx.x + bx.width / 2, cy = bx.y + bx.height / 2, a = deg * Math.PI / 180; await p.mouse.click(cx + R * Math.sin(a), cy - R * Math.cos(a)); await W(); };

  // 淺色模式：手機設成深色也維持淺色
  await fresh('u1');
  // 只檢查「是淺色」，不綁定某一個色碼（方案 E 把底色換成紙張色 #eff1ea）
  ok(await js(() => { const c = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number); return c.slice(0, 3).every(x => x >= 220); }), '手機是深色模式時，背景仍是淺色');
  ok(await js(() => { const c = getComputedStyle(document.body).color.match(/\d+/g).map(Number); return c.slice(0, 3).every(x => x <= 80); }), '手機是深色模式時，文字仍是深色');
  // 日曆刪除
  ok(!(await js(() => !!document.querySelector('[data-act="openBcal"]'))) && (await js(() => document.querySelectorAll('.toolbar .tool').length)) === 2, '日曆按鈕已刪除，只剩排序和篩選');
  // 發案頁的 24 小時時鐘
  await go('#post'); await p.click('[data-act="openTime"][data-w="start"]'); await W();
  const dt = await js(() => document.querySelector('.d-layer').innerText);
  ok(dt.includes('選取開工時間') && !dt.includes('上午') && !dt.includes('下午'), '時間視窗沒有上午／下午');
  ok((await js(() => document.querySelectorAll('.dial .dial-n').length)) === 24, '小時錶盤有 24 個數字（外圈 00～11、內圈 12～23）');
  await dialClick(60, 58);
  ok((await js(() => document.querySelector('.tbox').textContent)) === '14', '點內圈 2 點方向 → 14 點');
  ok((await js(() => document.querySelector('.tbox.on').getAttribute('data-v'))) === 'm', '放開後換選分鐘');
  await dialClick(180, 92); await p.click('[data-act="tOk"]'); await W();
  ok((await js(() => document.querySelectorAll('.dt-btn span')[1].textContent)) === '14:30', '開工時間設成 14:30');
  await p.click('[data-act="openTime"][data-w="end"]'); await W(); await p.click('[data-act="tInput"]'); await W();
  await p.fill('#dlg-h', '23'); await p.fill('#dlg-m', '15'); await p.click('[data-act="tOk"]'); await W();
  ok((await js(() => document.querySelectorAll('.dt-btn span')[2].textContent)) === '23:15', '用鍵盤輸入 23:15');
  // 篩選：日期和時間用同一套視窗，疊在篩選上面
  await go('#browse'); await p.click('[data-act="openFilter"]'); await W();
  await p.fill('input[name="pmin"]', '100');
  await p.click('[data-act="openDate"][data-w="from"]'); await W();
  ok(await js(() => !!document.querySelector('.m-layer') && !!document.querySelector('.d-layer')), '日期視窗疊在篩選視窗上面');
  ok((await js(() => document.querySelector('.d-layer').innerText)).includes('不限'), '篩選的日期視窗有「不限」');
  await js(() => { const b = Array.from(document.querySelectorAll('.d-layer .dd:not([disabled])')); b[1].click(); }); await W();
  await p.click('[data-act="dOk"]'); await W();
  const fromLbl = await js(() => document.querySelector('[data-act="openDate"][data-w="from"]').innerText);
  ok(/月\d+日/.test(fromLbl) && (await p.inputValue('input[name="pmin"]')) === '100', '選好日期回到篩選，剛打的標價還在：' + fromLbl);
  await p.click('[data-act="openTime"][data-w="tmin"]'); await W(); await p.click('[data-act="tInput"]'); await W();
  await p.fill('#dlg-h', '13'); await p.fill('#dlg-m', '0'); await p.click('[data-act="tOk"]'); await W();
  await p.click('[data-act="openTime"][data-w="tmax"]'); await W();
  await p.mouse.click(5, 5); await W();
  ok(!(await js(() => !!document.querySelector('.d-layer'))) && (await js(() => !!document.querySelector('.m-layer'))), '點時間視窗外面只關掉時間視窗，篩選還在');
  await p.click('[data-act="openTime"][data-w="tmax"]'); await W(); await p.keyboard.press('Escape'); await W();
  ok(await js(() => !document.querySelector('.d-layer') && !!document.querySelector('.m-layer')), '按 Esc 先關時間視窗');
  await p.click('form[data-form="filter"] button[type="submit"]'); await W();
  const f = await js(() => 0);
  ok((await js(() => document.querySelector('[data-act="openFilter"] .badge').textContent)) === '3', '套用後篩選數字是 3（日期、時段、標價）');
  await p.click('[data-act="openFilter"]'); await W();
  ok((await js(() => document.querySelector('[data-act="openTime"][data-w="tmin"]').innerText)).includes('13:00') && (await js(() => document.querySelector('[data-act="openTime"][data-w="tmax"]').innerText)).includes('不限'), '再打開篩選，時段顯示 13:00 到 不限');
  await p.click('[data-act="resetFilter"]'); await W();
  ok((await js(() => !!document.querySelector('form[data-form="filter"]'))) && (await js(() => document.querySelector('[data-act="openTime"][data-w="tmin"]').innerText)).includes('不限'), '按「清除」只清空欄位，視窗還開著');
  await p.click('form[data-form="filter"] button[type="submit"]'); await W();
  ok(!(await js(() => !!document.querySelector('[data-act="openFilter"] .badge'))), '清除後套用：沒有篩選條件');
  // 已取消案件的照片 7 天後刪除（t6：張書瑋上傳打掃證明和留言照片後無法完成）
  await fresh('u4'); await go('#task-t6');
  await p.setInputFiles('#f-ph', { name: 'a.png', mimeType: 'image/png', buffer: PNG }); await W(500);
  await p.setInputFiles('#cmt-f', { name: 'b.png', mimeType: 'image/png', buffer: PNG }); await W(500);
  await p.click('form[data-form="comment"] button[type="submit"]'); await W();
  await p.click('details.trouble summary'); await W();
  ok((await js(() => document.querySelector('details.trouble summary').textContent)) === '案件遇到問題？', '收合區塊的文字是「案件遇到問題？」');
  await p.click('[data-act="failTask"]'); await W(); await p.click('.sheet [data-act="ok"]'); await W();
  await act('pick', { id: 'u2' }); await W();
  ok((await js(() => document.querySelectorAll('main .photos img').length)) === 1, '已取消的案件裡，本體看得到替身的打掃證明');
  await ff(10080); await ff(1440);
  const t6 = await task('t6');
  ok(t6.photos.length === 0 && t6.comments.every(c => !(c.imgs && c.imgs.length)), '取消 7 天後打掃證明和留言照片都刪除');
  const m = await js(() => document.querySelector('main').innerText);
  ok(m.includes('打掃證明已在案件取消 7 天後自動刪除。') && m.includes('照片已在案件取消 7 天後自動刪除'), '畫面說明照片已刪除');
  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
