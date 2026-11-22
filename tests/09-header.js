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
        /* 下一層頁面（案件詳情）沒有品牌名，只檢查一排和沒有左右捲動 */
        return { h: h.getBoundingClientRect().height, sw: document.documentElement.scrollWidth, cut: !!brand && brand.scrollWidth > brand.clientWidth, spread: Math.max(...mids) - Math.min(...mids) };
      });
      ok(r.h <= 66 && r.sw <= w && !r.cut && r.spread <= 4, w + 'px ' + label + '：標題欄一排（高 ' + Math.round(r.h) + 'px）');
    };
    await check('未登入');
    await act('pick', { id: 'u1' }); await p.waitForTimeout(200); await check('已登入');
    await p.evaluate(() => { location.hash = '#mine'; }); await p.waitForTimeout(300); await check('我的案件（方案 K）');
    await p.evaluate(() => { location.hash = '#task-t1'; }); await p.waitForTimeout(300); await check('案件詳情');
    await act('openDemo'); await act('ff', { v: '60' }); await act('close'); await p.waitForTimeout(200); await check('案件詳情＋模擬時間');
    await p.close();
  }
  // 示範工具不在標題欄，在每一頁最下面，捲到底時不會被下方分頁擋住
  {
    const p = await (await b.newContext({ viewport: { width: 360, height: 640 } })).newPage();
    await p.goto(B + '#browse'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('swaptime-intro-v1', '1'); }); await p.reload(); await p.waitForTimeout(500);
    await p.evaluate(() => { const el = document.createElement('button'); el.dataset.act = 'pick'; el.dataset.id = 'u2'; document.body.appendChild(el); el.click(); el.remove(); }); await p.waitForTimeout(300);
    for (const h of ['#browse', '#post', '#mine', '#me', '#bank', '#task-t1', '#task-t6']) {
      await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(300);
      await p.evaluate(() => window.scrollTo(0, 1e6)); await p.waitForTimeout(150);
      const r = await p.evaluate(() => {
        const d = document.querySelector('main .demo-entry button'); if (!d) return { missing: true };
        const br = d.getBoundingClientRect(), tab = document.querySelector('nav.tabs').getBoundingClientRect();
        return { inHeader: !!document.querySelector('header [data-act="openDemo"]'), clear: br.bottom <= tab.top && br.top >= 0 };
      });
      ok(!r.missing && !r.inHeader && r.clear, h + '：示範工具在頁面最下面，捲到底看得到，不在標題欄');
    }
    await p.click('main .demo-entry button'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => (document.querySelector('.sheet') || {}).innerText || '').then(t => t.includes('切換帳號')), '點了打開示範工具');
    await p.close();
  }
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
