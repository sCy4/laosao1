const { chromium } = require('playwright');
const path = require('path');
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// 第十版（2026-11）：發案畫面從下面滑上來、自訂標記改淡黃色、出過價的案件顯示進度條
(async () => {
  const b = await chromium.launch();
  for (const w of [320, 390]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 844 } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const W = (ms = 150) => p.waitForTimeout(ms);
    const js = (f, a) => p.evaluate(f, a);
    const act = async (a, x = {}) => { await js(([a, x]) => { const el = document.createElement('button'); el.dataset.act = a; Object.assign(el.dataset, x); document.body.appendChild(el); el.click(); el.remove(); }, [a, x]); await W(); };
    const go = async h => { await js(h => { location.hash = h; }, h); await W(250); };
    await p.goto(B + '#browse'); await js(() => { localStorage.clear(); localStorage.setItem('swaptime-intro-v1', '1'); }); await p.reload(); await W(300);
    await act('pick', { id: 'u1' }); await go('#browse');

    // 3. 發案畫面從下面滑上來：底下留一份原本畫面的複本，新畫面蓋上去；關掉時發案畫面往下滑走
    const open = await js(() => new Promise(res => { document.querySelector('.fab').click(); setTimeout(() => {
      const g = document.querySelector('.k-ghost.under'), h = document.querySelector('header.top.full'), m = document.querySelector('main.full');
      res({ ghost: !!g && !!g.querySelector('.card.task') && !g.querySelector('[id]'), anim: !!h && getComputedStyle(h).animationName === 'kSlideUp' && getComputedStyle(m).animationName === 'kSlideUp', moving: !!m && m.getBoundingClientRect().top > 100 }); }, 40); }));
    ok(open.ghost && open.anim && open.moving, w + 'px 3 按「發案」：發案畫面從下面滑上來，底下是原本的案件大廳 ' + JSON.stringify(open));
    await W(500);
    ok(await js(() => !document.querySelector('.k-ghost') && document.querySelector('main.full').getBoundingClientRect().top >= 63 && document.querySelector('main.full').getBoundingClientRect().top < 70), w + 'px 3 滑完之後複本拿掉，發案畫面停在原位');
    ok(await js(() => { const m = document.querySelector('main.full'); return getComputedStyle(m).backgroundColor === 'rgb(255, 255, 255)' && getComputedStyle(m).position === 'relative'; }), w + 'px 3 發案畫面是不透明的白底（不會透出底下的畫面）');
    const close = await js(() => new Promise(res => { document.querySelector('[data-act="closePost"]').click(); setTimeout(() => {
      const g = document.querySelector('.k-ghost.over'); res({ ghost: !!g && !!g.querySelector('form[data-form="post"]'), anim: !!g && getComputedStyle(g).animationName === 'kSlideDown' }); }, 40); }));
    await W(600);
    ok(close.ghost && close.anim && await js(() => location.hash === '#browse' && !document.querySelector('.k-ghost')), w + 'px 3 按 ✕：發案畫面往下滑走，回到案件大廳 ' + JSON.stringify(close));

    // 4. 標記「自訂內容」是淡黃色，和提示框（淡紫、淺藍紫）、本體標籤（琥珀）都不一樣
    await go('#task-t1');  /* 示範資料：王小明把林柏翰標成自訂內容 */
    const col = await js(() => { const bg = e => e ? getComputedStyle(e).backgroundColor : null; const tmp = document.createElement('div'); tmp.innerHTML = '<div class="banner warn">x</div><div class="banner info">x</div>'; document.querySelector('main').appendChild(tmp);
      const r = { chip: bg(document.querySelector('.tagchip.tg-custom')), warn: bg(tmp.children[0]), info: bg(tmp.children[1]), role: bg(document.querySelector('.sum-role')) }; tmp.remove(); return r; });
    ok(col.chip === 'rgb(251, 238, 176)' && new Set(Object.values(col)).size === 4, w + 'px 4 自訂標記是淡黃色，和提示框、本體標籤分得開 ' + JSON.stringify(col));
    await go('#tags');
    ok(await js(() => getComputedStyle(document.querySelector('.tagbtn.tg-custom')).backgroundColor === 'rgb(251, 238, 176)'), w + 'px 4 標記過的人頁的自訂標記也是淡黃色');

    // 5. 出過價的案件顯示進度條（召喚替身階段）；沒出價的人照樣看不到
    await act('pick', { id: 'u3' }); await go('#task-t1');
    ok(await js(() => { const c = document.querySelector('.steps li.cur'); return !!c && c.textContent === '召喚替身'; }), w + 'px 5 出過價的案件：進度條停在「召喚替身」');
    await go('#task-t11');  /* 林柏翰也出過價，但本體選了別人 */
    ok(await js(() => !!document.querySelector('.steps')), w + 'px 5 本體選了別人、還在等確認時，出過價的人也看得到進度條');
    await act('pick', { id: 'u4' }); await go('#task-t1');
    ok(await js(() => !document.querySelector('.steps')), w + 'px 5 沒出價的人看不到進度條');
    await act('pick', { id: 'u3' }); await go('#task-t1');
    ok(await js(() => { const b = document.querySelector('[data-act="acceptPrice"]'), r = b.getBoundingClientRect(), n = document.querySelector('nav.tabs').getBoundingClientRect(); return r.bottom <= n.top; }), w + 'px 5 加了進度條之後，出價的按鈕仍在第一屏');

    ok(errs.length === 0, w + 'px no console errors ' + JSON.stringify(errs));
    await p.close();
  }
  // 手機設定「減少動態效果」時不滑動
  {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })).newPage();
    await p.goto(B + '#browse'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('swaptime-intro-v1', '1'); }); await p.reload(); await p.waitForTimeout(300);
    const r = await p.evaluate(() => new Promise(res => { document.querySelector('.fab').click(); setTimeout(() => res(!document.querySelector('.k-ghost') && getComputedStyle(document.querySelector('header.top')).animationName === 'none'), 30); }));
    ok(r, '減少動態效果：發案畫面直接出現，不滑動');
    await p.close();
  }
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
