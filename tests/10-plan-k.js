const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// 方案 K（Material Design 3）：全站
(async () => {
  const b = await chromium.launch();
  for (const w of [320, 390]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 844 }, colorScheme: 'dark' })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const W = (ms = 150) => p.waitForTimeout(ms);
    const js = (f, a) => p.evaluate(f, a);
    const act = async (a, x = {}) => { await js(([a, x]) => { const el = document.createElement('button'); el.dataset.act = a; Object.assign(el.dataset, x); document.body.appendChild(el); el.click(); el.remove(); }, [a, x]); await W(); };
    const go = async h => { await js(h => { location.hash = h; }, h); await W(250); };
    await p.goto(B + '#browse'); await js(() => { localStorage.clear(); localStorage.setItem('swaptime-intro-v1', '1'); }); await p.reload(); await W(300);
    await act('pick', { id: 'u1' });

    // 全站都是方案 K：方案 I 的樣式和閃屏都拿掉了；手機是深色模式時每一頁仍是淺色底
    ok(await js(() => !document.getElementById('theme-i') && !!document.getElementById('theme-k') && !document.getElementById('theme-k').media), w + 'px 只有方案 K 一套樣式');
    const pages = ['#browse', '#post', '#mine', '#me', '#bank', '#past', '#favs', '#tags', '#profile', '#task-t1', '#task-t8', '#task-t11'];
    for (const h of pages) {
      await go(h);
      const f = await js(() => {
        const small = [];
        document.querySelectorAll('header.top *, main *, nav.tabs *').forEach(el => {
          if (!Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())) return;
          const cs = getComputedStyle(el), rc = el.getBoundingClientRect();
          if (rc.width < 2 || cs.visibility === 'hidden') return;  /* 視覺隱藏、給螢幕閱讀器的字不算 */
          if (parseFloat(cs.fontSize) < 12) small.push(el.textContent.trim().slice(0, 10) + ' ' + cs.fontSize);
        });
        return { bg: getComputedStyle(document.body).backgroundColor, sw: document.documentElement.scrollWidth, small };
      });
      ok(f.bg === 'rgb(247, 249, 255)' && f.sw <= w && f.small.length === 0, w + 'px ' + h + '：淺色底、沒有左右捲動、字不小於 12px ' + (f.small.length ? JSON.stringify(f.small) : ''));
    }
    await go('#mine');
    if (w === 390) await p.screenshot({ path: OUT + '/k-mine-390.png', fullPage: true });

    // 元件的樣子
    ok(await js(() => { const on = document.querySelector('nav.tabs button.on'), bf = getComputedStyle(on, '::before'), f = on.querySelector('svg .i-f');
      return on.dataset.v === 'mine' && bf.backgroundColor === 'rgb(217, 226, 255)' && bf.width === '64px' && !!f && getComputedStyle(f).display !== 'none'; }), w + 'px 底部導覽列：圖示在膠囊裡，選中的分頁膠囊有底色、圖示換成實心');
    ok(await js(() => { const c = getComputedStyle(document.querySelector('.card.task')); return c.borderRadius === '12px' && c.boxShadow !== 'none'; }), w + 'px 案件卡片：12px 圓角、浮起的陰影');
    ok(await js(() => { const t = document.querySelector('.tc-bar.todo'), n = document.querySelector('.tc-bar:not(.todo)');
      return !!t && getComputedStyle(t).backgroundColor === 'rgb(255, 218, 214)' && !!n && getComputedStyle(n).backgroundColor === 'rgba(0, 0, 0, 0)'; }), w + 'px 輪到你的狀態列是淺紅底，其他是透明底灰字');
    // 我是本體＝琥珀、我是替身＝青：兩個都有醒目的底色，而且顏色不同
    ok(await js(() => { const bg = s => getComputedStyle(document.querySelector(s)).backgroundColor;
      return bg('.card.task.is-poster .tc-tab') === 'rgb(255, 204, 133)' && bg('.card.task.is-worker .tc-tab') === 'rgb(122, 228, 239)'; }), w + 'px 身分標籤：我是本體是琥珀色、我是替身是青色');
    ok(await js(() => Array.from(document.querySelectorAll('.tc-d')).every(d => /^\d+月\d+日（[日一二三四五六]）$/.test(d.textContent))), w + 'px 日期方塊的文字內容仍是「11月20日（五）」');

    // 動態只在「換了」的那一次播放：切換身分時勾勾長出來；收藏等其他原因重畫時不重播
    await act('seg', { k: 'mineRole', v: 'own' });
    ok(await js(() => !!document.querySelector('.seg button.on.k-in')), w + 'px 切換「我是替身／我是本體」時勾勾有動畫');
    const fid = await js(() => document.querySelector('.favbtn').dataset.id);
    await act('fav', { id: fid }); await act('fav', { id: fid });
    ok(!(await js(() => !!document.querySelector('.seg button.on.k-in, nav.tabs button.on.k-in'))), w + 'px 其他原因重畫畫面時不重播動畫');
    await go('#browse'); await p.click('nav.tabs [data-v="mine"]'); await W(250);
    ok(await js(() => !!document.querySelector('nav.tabs button.on.k-in')), w + 'px 換到別的分頁時，膠囊從中間展開');

    // 上方應用程式列往下捲時換底色
    await js(() => window.scrollTo(0, 400)); await W(400);  /* 底色有 0.2 秒的漸變，等它跑完再量 */
    ok(await js(() => document.querySelector('header.top').classList.contains('scrolled') && getComputedStyle(document.querySelector('header.top')).backgroundColor === 'rgb(232, 238, 249)'), w + 'px 往下捲時上方應用程式列換底色');
    await js(() => window.scrollTo(0, 0)); await W(250);
    ok(!(await js(() => document.querySelector('header.top').classList.contains('scrolled'))), w + 'px 捲回最上面時換回原本的底色');

    // 水波紋：按下卡片時出現（每一頁都有）
    const press = async () => { const bx = await p.locator('main .tc-open').first().boundingBox(); await p.mouse.move(bx.x + 60, bx.y + 30); await p.mouse.down(); await W(60);
      const has = await js(() => !!document.querySelector('.k-ripple')); await p.mouse.move(2, 2); await p.mouse.up(); await W(650); return has; };
    ok(await press(), w + 'px 我的案件：按下卡片時有水波紋');
    await go('#browse');
    ok(await press(), w + 'px 接案頁：按下卡片時也有水波紋');

    // 詳情頁：頂端的日期、時間、標價由上到下；收藏星號在卡片右上角
    await go('#task-t1');
    ok(await js(() => { const d = document.querySelector('.sum-date').getBoundingClientRect(), t = document.querySelector('.sum-time').getBoundingClientRect(), pr = document.querySelector('.sum-price').getBoundingClientRect();
      return d.bottom <= t.top + 1 && t.bottom <= pr.top + 1 && !!document.querySelector('.steps li.cur'); }), w + 'px 詳情頁頂端：日期 → 時間 → 標價由上到下');
    await go('#browse');
    ok(await js(() => { const c = document.querySelector('.card.task').getBoundingClientRect(), f = document.querySelector('.card.task .favbtn').getBoundingClientRect();
      return Math.abs(f.right - (c.right - 8)) < 2 && Math.abs(f.top - (c.top + 8)) < 2; }), w + 'px 收藏星號在卡片右上角');
    ok(errs.length === 0, w + 'px no console errors ' + JSON.stringify(errs));
    await p.close();
  }
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
