const { chromium } = require('playwright');
const path = require('path');
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// 方案G「雙色套印」：票根卡片、摘要卡價格獨立一行、「我的」入口收成一張清單；
// 各頁在 390、320px 都沒有左右捲動、沒有小於 12px 的字、標題欄維持一排
(async () => {
  const b = await chromium.launch();
  for (const w of [390, 320]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 760 }, colorScheme: 'dark' })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(B + '#browse'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('swaptime-intro-v1', '1'); }); await p.reload(); await p.waitForTimeout(400);
    await p.evaluate(() => { const el = document.createElement('button'); el.dataset.act = 'pick'; el.dataset.id = 'u1'; document.body.appendChild(el); el.click(); el.remove(); }); await p.waitForTimeout(200);
    for (const h of ['#browse', '#post', '#mine', '#me', '#bank', '#past', '#favs', '#tags', '#task-t1', '#task-t3', '#task-t8', '#task-t11', '#task-t2', '#task-t10']) {
      await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(250);
      const r = await p.evaluate(() => {
        let min = 99, where = '';
        document.querySelectorAll('body *').forEach(el => {
          if (el.closest('.vh') || !el.getClientRects().length) return;
          const own = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
          if (!own) return;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs < min) { min = fs; where = el.className || el.tagName; }
        });
        return { min, where, sw: document.documentElement.scrollWidth, hh: document.querySelector('header.top').getBoundingClientRect().height, scheme: getComputedStyle(document.documentElement).colorScheme };
      });
      ok(r.min >= 12 && r.sw <= w && r.hh <= 66 && r.scheme === 'light', w + 'px ' + h + '：最小字 ' + r.min + 'px（' + r.where + '），頁寬 ' + r.sw + '，標題欄高 ' + Math.round(r.hh) + '，' + r.scheme);
    }
    // 接案頁：每張卡的票根（撕線）位置一樣，價格右邊對齊，價格在撕線右邊
    await p.evaluate(() => { location.hash = '#browse'; }); await p.waitForTimeout(250);
    const t = await p.evaluate(() => Array.from(document.querySelectorAll('#blist .card.task')).map(c => {
      const s = c.querySelector('.tc-stub').getBoundingClientRect(), pr = c.querySelector('.tc-stub .price').getBoundingClientRect(), m = c.querySelector('.tc-main').getBoundingClientRect();
      return { stub: Math.round(s.left), right: Math.round(pr.right), sep: pr.left >= s.left && m.right <= s.left + 1 };
    }));
    ok(t.length >= 3 && t.every(x => x.stub === t[0].stub && Math.abs(x.right - t[0].right) <= 1 && x.sep), w + 'px 票根撕線和價格在每張卡都對齊 ' + JSON.stringify(t.map(x => x.stub)));
    // 詳情摘要：價格獨立一行，在日期時間下面，收藏星號不會把它擠歪
    await p.evaluate(() => { location.hash = '#task-t1'; }); await p.waitForTimeout(250);
    const s = await p.evaluate(() => { const top = document.querySelector('.sum-top').getBoundingClientRect(), pr = document.querySelector('.sum-price').getBoundingClientRect(), fav = document.querySelector('.card.sum > .favbtn').getBoundingClientRect(); return { below: pr.top >= top.bottom - 1, favAbove: fav.bottom <= pr.top + 1 }; });
    ok(s.below && s.favAbove, w + 'px 摘要卡：價格在日期時間下面獨立一行，星號在它上方');
    // 我的：四個入口在同一張清單卡裡
    await p.evaluate(() => { location.hash = '#me'; }); await p.waitForTimeout(250);
    const me = await p.evaluate(() => { const m = document.querySelector('.card.menu'); return m ? Array.from(m.querySelectorAll('.linkrow')).map(x => x.dataset.act) : []; });
    ok(JSON.stringify(me) === JSON.stringify(['bankPage', 'favs', 'past', 'tagsPage']), w + 'px 我的：收款方式、收藏、過去的案件、標記的人在同一張清單卡');
    ok(!errs.length, w + 'px 沒有程式錯誤 ' + errs.join(' | '));
    await p.close();
  }
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
