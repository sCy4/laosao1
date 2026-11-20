const { chromium } = require('playwright');
const path = require('path');
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// 標題欄固定一排：各種手機寬度、各種狀態下，高度不變、品牌名不被截斷、沒有左右捲動
(async () => {
  const b = await chromium.launch();
  for (const w of [280, 320, 360, 390, 480]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 500 } })).newPage();
    await p.goto(B + '#browse'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('swaptime-intro-v1', '1'); }); await p.reload(); await p.waitForTimeout(500);
    const act = (a, x = {}) => p.evaluate(([a, x]) => { const el = document.createElement('button'); el.dataset.act = a; Object.assign(el.dataset, x); document.body.appendChild(el); el.click(); el.remove(); }, [a, x]);
    const check = async label => {
      const r = await p.evaluate(() => {
        const h = document.querySelector('header.top'), brand = h.querySelector('.brand');
        const mids = Array.from(h.querySelectorAll('.icon-btn, .btn, .hd-brand')).map(e => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; });
        return { h: h.getBoundingClientRect().height, sw: document.documentElement.scrollWidth, cut: brand.scrollWidth > brand.clientWidth, spread: Math.max(...mids) - Math.min(...mids) };
      });
      ok(r.h <= 66 && r.sw <= w && !r.cut && r.spread <= 4, w + 'px ' + label + '：標題欄一排（高 ' + Math.round(r.h) + 'px）');
    };
    await check('未登入');
    await act('pick', { id: 'u1' }); await p.waitForTimeout(200); await check('已登入');
    await p.evaluate(() => { location.hash = '#task-t1'; }); await p.waitForTimeout(300); await check('案件詳情');
    await act('openDemo'); await act('ff', { v: '60' }); await act('close'); await p.waitForTimeout(200); await check('案件詳情＋模擬時間');
    await p.close();
  }
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
