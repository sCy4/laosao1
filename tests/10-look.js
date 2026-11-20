const { chromium } = require('playwright');
const path = require('path');
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// 版面外觀（方案B 磁磚）：各頁在 320、390px 寬沒有左右捲動、看得到的字都不小於 12px；
// 手機設成深色模式也維持淺色；品牌磁磚讀出來仍是「替身掃者」
(async () => {
  const b = await chromium.launch();
  for (const w of [320, 390]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 760 }, colorScheme: 'dark' })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(B + '#browse'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('swaptime-intro-v1', '1'); }); await p.reload(); await p.waitForTimeout(400);
    const act = (a, x = {}) => p.evaluate(([a, x]) => { const el = document.createElement('button'); el.dataset.act = a; Object.assign(el.dataset, x); document.body.appendChild(el); el.click(); el.remove(); }, [a, x]);
    ok(await p.evaluate(() => document.querySelector('header .brand').innerText === '替身掃者'), w + 'px 品牌磁磚讀出來是「替身掃者」');
    await act('pick', { id: 'u1' }); await p.waitForTimeout(200);
    for (const h of ['#browse', '#mine', '#post', '#me', '#bank', '#past', '#task-t1', '#task-t3', '#task-t8', '#task-t11']) {
      await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(250);
      const r = await p.evaluate(() => {
        let min = 99, where = '';
        for (const el of document.querySelectorAll('#app *')) {
          if (el.closest('.vh')) continue;
          const hasText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
          if (!hasText) continue;
          const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs < min) { min = fs; where = el.className + '「' + el.textContent.trim().slice(0, 10) + '」'; }
        }
        const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g).slice(0, 3).map(Number);
        return { min, where, sw: document.documentElement.scrollWidth, light: bg.every(c => c >= 225) };
      });
      ok(r.min >= 12, w + 'px ' + h + '：最小字 ' + r.min + 'px（' + r.where + '）');
      ok(r.sw <= w, w + 'px ' + h + '：沒有左右捲動（' + r.sw + '）');
      ok(r.light, w + 'px ' + h + '：深色模式下仍是淺色背景');
    }
    // 卡片的日期和時間換成兩行時，中間的細線不會跑到第二行開頭
    await p.evaluate(() => { location.hash = '#browse'; }); await p.waitForTimeout(250);
    const line = await p.evaluate(() => { const d = document.querySelector('#blist .tc-date'), t = d.querySelector('.tc-time'); const dr = d.getBoundingClientRect(), tr = t.getBoundingClientRect(); return { wrapped: tr.top > dr.top + 4, lineX: tr.left - 11, boxLeft: dr.left }; });
    ok(!line.wrapped || line.lineX < line.boxLeft, w + 'px 卡片時間' + (line.wrapped ? '換行時細線被裁掉' : '沒換行，細線在日期和時間中間'));
    ok(!errs.length, w + 'px 沒有程式錯誤 ' + JSON.stringify(errs));
    await p.close();
  }
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
