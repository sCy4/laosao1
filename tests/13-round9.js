const { chromium } = require('playwright');
const path = require('path');
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// 第九版（2026-11）：「發案」改成右下角的按鈕、「接案」改名「案件大廳」、替身的「退出案件」收起來、日期時間字體
(async () => {
  const b = await chromium.launch();
  for (const w of [320, 390]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 700 } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const W = (ms = 150) => p.waitForTimeout(ms);
    const js = (f, a) => p.evaluate(f, a);
    const act = async (a, x = {}) => { await js(([a, x]) => { const el = document.createElement('button'); el.dataset.act = a; Object.assign(el.dataset, x); document.body.appendChild(el); el.click(); el.remove(); }, [a, x]); await W(); };
    const go = async h => { await js(h => { location.hash = h; }, h); await W(250); };
    const fresh = async () => { await p.goto('about:blank'); await p.goto(B + '#browse'); await js(() => { localStorage.clear(); localStorage.setItem('swaptime-intro-v1', '1'); }); await p.reload(); await W(300); };
    const hasFab = () => js(() => !!document.querySelector('.fab'));

    // 下方分頁剩三個，第一個叫「案件大廳」
    await fresh();
    ok(await js(() => Array.from(document.querySelectorAll('nav.tabs button span:not(.badge)')).map(e => e.textContent).join('/') === '案件大廳/我的案件/我的' && document.querySelector('main h1.vh').textContent === '案件大廳'), w + 'px 下方分頁：案件大廳／我的案件／我的');
    // 第十一版：使用者選了公事包當案件大廳的圖示（選中時是實心的公事包）
    ok(await js(() => { const b = document.querySelector('nav.tabs [data-v="browse"]'), f = b.querySelector('svg .i-f'); return b.classList.contains('on') && !!f && f.getAttribute('d').startsWith('M20 6h-4V4') && getComputedStyle(f).display !== 'none'; }), w + 'px 案件大廳的圖示是公事包');

    // 未登入按「發案」：到發案畫面並打開登入，登入後就是發案表單
    await p.click('.fab'); await W(250);
    ok(await js(() => location.hash === '#post' && (document.querySelector('.m-layer .sheet') || {}).innerText.includes('登入後才能發案')), w + 'px 未登入按「發案」：要求登入，說明原因');
    await act('close'); await act('pick', { id: 'u1' });
    ok(await js(() => !!document.querySelector('form[data-form="post"]')), w + 'px 登入後就是發案表單');

    // 發案畫面是全螢幕：左上 ✕、標題「發案」，沒有下方分頁和發案按鈕
    ok(await js(() => { const h = document.querySelector('header.top'); return !!h.querySelector('[data-act="closePost"]') && h.querySelector('.hd-title').textContent === '發案' && !document.querySelector('nav.tabs') && !document.querySelector('.fab') && !h.querySelector('.brand'); }), w + 'px 發案畫面：左上 ✕＋「發案」，沒有下方分頁');

    // 哪些頁有發案按鈕：第十版使用者決定只有案件大廳有（我的案件也拿掉）
    const where = {};
    for (const h of ['#browse', '#mine', '#me', '#bank', '#task-t1']) { await go(h); where[h] = await hasFab(); }
    ok(where['#browse'] && !where['#mine'] && !where['#me'] && !where['#bank'] && !where['#task-t1'], w + 'px 發案按鈕只在案件大廳 ' + JSON.stringify(where));

    // 從案件大廳按「發案」，按 ✕ 回到案件大廳；草稿還在（第十版：我的案件沒有發案按鈕，改從案件大廳）
    await go('#browse'); await p.click('.fab'); await W(400); await p.fill('#p-b', '第五宿舍'); await W();
    await p.click('[data-act="closePost"]'); await W(600);
    ok(await js(() => location.hash === '#browse'), w + 'px 按 ✕ 回到原本的頁面（案件大廳）');
    await p.click('.fab'); await W(400);
    ok(await js(() => document.querySelector('#p-b').value === '第五宿舍'), w + 'px 關掉再打開，填到一半的內容還在');
    // 重新整理後沒有上一頁：按 ✕ 回到打開發案前的分頁（沒有就回案件大廳）
    await p.reload(); await W(400); await p.click('[data-act="closePost"]'); await W(600);
    ok(await js(() => location.hash === '#browse' || location.hash === '#mine'), w + 'px 重新整理後按 ✕ 也回得去');

    // 發案按鈕的樣子和位置：右下角、在下方分頁上面，捲到底時不蓋住最後一張卡片
    await go('#browse');
    const f = await js(() => { const r = document.querySelector('.fab').getBoundingClientRect(), n = document.querySelector('nav.tabs').getBoundingClientRect(), c = getComputedStyle(document.querySelector('.fab'));
      return { right: Math.round(innerWidth - r.right), gap: Math.round(n.top - r.bottom), h: Math.round(r.height), radius: c.borderRadius, label: document.querySelector('.fab').textContent }; });
    ok(f.right === 16 && f.gap === 16 && f.h === 56 && f.radius === '16px' && f.label === '發案', w + 'px 發案按鈕：右下角、離下方分頁 16px、高 56 ' + JSON.stringify(f));
    await go('#browse'); await js(() => window.scrollTo(0, 1e6)); await W(300);
    ok(await js(() => { const cards = Array.from(document.querySelectorAll('main .card.task')), last = cards[cards.length - 1].getBoundingClientRect(), fr = document.querySelector('.fab').getBoundingClientRect(); return last.bottom <= fr.top; }), w + 'px 捲到底時，最後一張卡片在發案按鈕上面');

    // 往下捲時縮成只有「＋」，往上捲時展開（案件大廳的案件不多，把畫面調矮才捲得動）
    await p.setViewportSize({ width: w, height: 420 }); await go('#mine'); await go('#browse');
    await js(() => window.scrollTo(0, 0)); await W(300); await js(() => window.scrollTo(0, 300)); await W(400);
    const mini = await js(() => { const f = document.querySelector('.fab'); return f.classList.contains('mini') && f.getBoundingClientRect().width <= 60; });
    await js(() => window.scrollTo(0, 100)); await W(400);
    const big = await js(() => { const f = document.querySelector('.fab'); return !f.classList.contains('mini') && f.getBoundingClientRect().width > 80; });
    ok(mini && big, w + 'px 往下捲時縮成「＋」，往上捲時展開');
    await p.setViewportSize({ width: w, height: 700 });

    // 用詞：「接案頁」改叫「案件大廳」
    await go('#me');
    ok(await js(() => document.querySelector('.rules').textContent.includes('案件大廳不會顯示') && !document.body.innerText.includes('接案頁')), w + 'px 使用規則寫「案件大廳」');

    // 2. 替身的「退出案件」收在「案件遇到問題？」裡
    await go('#task-t3');
    ok(await js(() => { const b = document.querySelector('[data-act="withdrawAssign"]'), d = b && b.closest('details.trouble'); return !!d && !d.open && !b.checkVisibility(); }), w + 'px 2 替身的「退出案件」收在「案件遇到問題？」裡');

    // 3、4. 字體：卡片日期時間一般字體；詳情頁日期比時間大一點、都不粗體
    await go('#browse');
    ok(await js(() => { const d = getComputedStyle(document.querySelector('.tc-d')), t = getComputedStyle(document.querySelector('.tc-time')); return d.fontWeight === '400' && t.fontWeight === '400'; }), w + 'px 3 卡片的日期和時間是一般字體');
    await go('#task-t1');
    ok(await js(() => { const d = getComputedStyle(document.querySelector('.sum-date')), t = getComputedStyle(document.querySelector('.sum-time')); return parseFloat(d.fontSize) > parseFloat(t.fontSize) && d.fontWeight === '400' && t.fontWeight === '400'; }), w + 'px 4 詳情頁日期比時間大一點、都不粗體');

    ok(errs.length === 0, w + 'px no console errors ' + JSON.stringify(errs));
    await p.close();
  }
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
