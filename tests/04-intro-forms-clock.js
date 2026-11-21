const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const W = (ms = 150) => p.waitForTimeout(ms);
  const js = (f, a) => p.evaluate(f, a);
  const act = async (a, x = {}) => { await js(([a, x]) => { const el = document.createElement('button'); el.dataset.act = a; Object.assign(el.dataset, x); document.body.appendChild(el); el.click(); el.remove(); }, [a, x]); await W(); };
  const go = async h => { await js(h => { location.hash = h; }, h); await W(250); };
  const fresh = async (uid, intro) => { await p.goto('about:blank'); await p.goto(B + '#browse'); await js(i => { localStorage.clear(); if (!i) localStorage.setItem('swaptime-intro-v1', '1'); }, intro); await p.reload(); await W(300); if (uid) await act('pick', { id: uid }); };

  // 第一次進入的介紹
  await fresh(null, true);
  let sh = await js(() => document.querySelector('.sheet') && document.querySelector('.sheet').innerText);
  ok(!!sh && sh.includes('替身掃者') && sh.includes('本體') && sh.includes('替身'), '第一次進入（未登入）就出現介紹');
  await p.click('[data-act="introNext"]'); await W(); ok((await js(() => document.querySelector('.sheet').innerText)).includes('怎麼進行'), '第 2 頁：怎麼進行');
  await p.click('[data-act="introNext"]'); await W(); sh = await js(() => document.querySelector('.sheet').innerText);
  ok(sh.includes('先知道這些') && sh.includes('開始使用'), '第 3 頁：先知道這些，按鈕是「開始使用」');
  await p.click('.sheet .row.between .btn:not(.ghost)'); await W();
  ok(!(await js(() => !!document.querySelector('.sheet'))), '按「開始使用」關閉');
  await p.reload(); await W(300); ok(!(await js(() => !!document.querySelector('.sheet'))), '重新整理後不會再跳');
  await act('openDemo'); await act('showIntro'); ok((await js(() => document.querySelector('.sheet').innerText)).includes('同學幫同學打掃寢室'), '示範工具可以重看介紹'); await act('close');

  // 接案頁頂端變矮、標記圖示、提示在上方
  await fresh('u1'); await go('#browse');
  // 卡片有「我是本體／我是替身」標籤時，從標籤頂端算起
  const top = await js(() => { const c = document.querySelector('#blist .card.task'), g = c.querySelector('.tc-tab'); return Math.round((g || c).getBoundingClientRect().top); });
  ok(top < 190, '第一張卡片從 ' + top + 'px 開始（原本約 260px）');
  ok(await js(() => { const h = document.querySelector('main h1'); return h && h.classList.contains('vh'); }), '頁面大標只留給螢幕閱讀器');
  ok(await js(() => { const r1 = document.querySelector('.search').getBoundingClientRect(), r2 = document.querySelector('[data-act="openFilter"]').getBoundingClientRect(); return Math.abs(r1.top - r2.top) < 4; }), '搜尋、排序、篩選在同一排');
  await act('fav', { id: 't2' });
  ok((await js(() => Math.round(document.getElementById('toast').getBoundingClientRect().top))) < 150, '提示訊息出現在畫面上方');
  await go('#task-t3');
  ok((await js(() => document.querySelector('.tagbtn svg path').getAttribute('d'))).startsWith('M20.6'), '標記按鈕改成標籤圖示');

  // 表單錯誤顯示在欄位下方
  await go('#post'); await p.click('form[data-form="post"] button[type="submit"]'); await W();
  ok((await js(() => { const e = document.querySelector('.ferr'); return e && e.closest('.field').querySelector('#p-b') && e.textContent; })) === '請填地點', '發案沒填地點 → 地點欄位下方顯示錯誤');
  await p.fill('#p-b', '第一宿舍'); await W(100); ok(!(await js(() => !!document.querySelector('.ferr'))), '開始打字後錯誤消失');
  await p.fill('#p-meet', '大廳'); await p.fill('#p-budget', '30'); await p.click('form[data-form="post"] button[type="submit"]'); await W();
  ok((await js(() => document.querySelector('.ferr').textContent)) === '標價請在 NT$ 50 到 5,000 之間', '標價錯誤顯示在標價欄位下');
  await p.click('[data-act="openTime"][data-w="start"]'); await W(); await p.click('[data-act="tInput"]'); await W(); await p.fill('#dlg-h', '25'); await p.click('[data-act="tOk"]'); await W();
  ok((await js(() => document.querySelector('.d-layer .ferr') && document.querySelector('.d-layer .ferr').textContent)) === '小時請填 0 到 23，分鐘請填 0 到 59', '時間視窗的錯誤顯示在視窗裡');
  await act('dlgClose');

  // 時鐘：手機上點小時後自動換分鐘（用觸控模擬）
  const mp = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  await mp.goto(B + '#browse'); await mp.evaluate(() => { localStorage.clear(); localStorage.setItem('swaptime-intro-v1', '1'); }); await mp.reload(); await mp.waitForTimeout(300);
  await mp.evaluate(() => { const el = document.createElement('button'); el.dataset.act = 'pick'; el.dataset.id = 'u1'; document.body.appendChild(el); el.click(); el.remove(); location.hash = '#post'; }); await mp.waitForTimeout(400);
  await mp.tap('[data-act="openTime"][data-w="start"]'); await mp.waitForTimeout(300);
  const dialBefore = await mp.evaluateHandle(() => document.querySelector('.dial'));
  const bx = await mp.locator('.dial').boundingBox();
  await mp.touchscreen.tap(bx.x + bx.width / 2 + 58 * Math.sin(Math.PI / 3), bx.y + bx.height / 2 - 58 * Math.cos(Math.PI / 3)); await mp.waitForTimeout(300);
  ok((await mp.evaluate(() => document.querySelector('.tbox[data-v="h"]').textContent)) === '14' && (await mp.evaluate(() => document.querySelector('.tbox.on').dataset.v)) === 'm', '觸控點小時 14 → 自動換選分鐘');
  await mp.close();
  // 按住時不換掉錶盤本身（手機才收得到放開的訊號）
  await go('#post'); await p.click('[data-act="openTime"][data-w="start"]'); await W();
  const same = await js(() => { const d = document.querySelector('.dial'), r = d.getBoundingClientRect(); d.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + 120, clientY: r.top + 30, pointerId: 1 })); const still = document.querySelector('.dial') === d && d.isConnected; d.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 })); return still; });
  await W(); ok(same && (await js(() => document.querySelector('.tbox.on').dataset.v)) === 'm', '按住時錶盤沒有被換掉，放開後換選分鐘');
  await act('dlgClose');

  // 出價前要先設定收款方式（林柏翰沒有收款方式）
  await fresh('u3'); await js(() => { const s = JSON.parse(localStorage.getItem('swaptime-proto-v1')); s.users.find(x => x.id === 'u3').linepay = null; localStorage.setItem('swaptime-proto-v1', JSON.stringify(s)); }); await p.reload(); await W(300); await go('#task-t1');
  ok(!(await js(() => !!document.querySelector('[data-act="acceptPrice"]'))) && (await js(() => !!document.querySelector('[data-act="setupPay"]'))), '沒有收款方式：看不到出價按鈕，只有「設定收款方式」');
  await p.click('[data-act="setupPay"]'); await W(300);
  ok((await js(() => location.hash)) === '#bank' && (await js(() => document.querySelector('main h1').textContent)) === '收款方式', '進入收款方式頁');
  await p.click('[data-act="payToggle"][data-v="bank"]'); await W();
  await p.selectOption('#b-code', '700'); await p.fill('#b-acct', '12345678901'); await p.fill('#b-name', '林柏翰');
  await p.click('form[data-form="bank"] button[type="submit"]'); await W(600);
  ok((await js(() => location.hash)) === '#task-t1' && (await js(() => !!document.querySelector('[data-act="acceptPrice"]'))), '儲存後自動回到案件，可以出價了');
  await p.click('[data-act="openBid"]'); await W();
  ok((await js(() => document.getElementById('op').placeholder)) === '輸入金額', '出價欄提示字改成「輸入金額」');
  await p.fill('#op', ''); await p.click('form[data-form="offer"] button[type="submit"]'); await W();
  ok((await js(() => document.querySelector('.sheet .ferr').textContent)) === '請輸入出價金額', '出價金額錯誤顯示在欄位下');
  await act('close');

  // 過去的案件
  await go('#me');
  ok((await js(() => document.querySelector('main').innerText)).includes('過去的案件') && !(await js(() => document.querySelector('main').innerText)).includes('\n已取消\n'), '我的：已完成和已取消合成「過去的案件」');
  await p.click('[data-act="past"]'); await W(300);
  ok((await js(() => location.hash)) === '#past' && (await js(() => document.querySelector('.seg .on').textContent)).startsWith('已完成'), '打開是已完成');
  await p.click('[data-act="seg"][data-k="pastKind"][data-v="cancelled"]'); await W();
  ok((await js(() => document.querySelector('.seg .on').textContent)).startsWith('已取消'), '切換到已取消');
  await go('#cancelled'); ok((await js(() => document.querySelector('.seg .on').textContent)).startsWith('已取消'), '舊網址 #cancelled 照樣打開已取消');
  // 字級
  ok((await js(() => getComputedStyle(document.querySelector('.small')).fontSize)) === '14px', '小字放大到 14px');
  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
