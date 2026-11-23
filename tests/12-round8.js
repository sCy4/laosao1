const { chromium } = require('playwright');
const path = require('path');
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// 第八版（2026-11）使用者的修改
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

    // 1. 標題欄右邊的「登入」、鈴鐺和下面卡片的右邊對齊，不再太靠右
    const edge = () => js(() => { const W = innerWidth, c = document.querySelector('.card.task').getBoundingClientRect(), r = s => { const e = document.querySelector(s); return e ? W - e.getBoundingClientRect().right : null; };
      return { card: W - c.right, login: r('header.top [data-act="login"]'), bell: r('header.top .bell svg'), badge: r('header.top .nbadge') }; });
    let e = await edge();
    ok(Math.abs(e.login - e.card) < 1, w + 'px 1 「登入」的右邊和卡片對齊 ' + JSON.stringify(e));
    await act('pick', { id: 'u1' }); e = await edge();
    ok(e.bell >= e.card && e.badge >= e.card - 2, w + 'px 1 鈴鐺和紅點都在卡片右邊以內 ' + JSON.stringify(e));

    // 4. 卡片的日期和時間都粗體
    ok(await js(() => Array.from(document.querySelectorAll('.card.task')).every(c => getComputedStyle(c.querySelector('.tc-d')).fontWeight === '700' && getComputedStyle(c.querySelector('.tc-time')).fontWeight === '700')), w + 'px 4 卡片的日期和時間都粗體');

    // 5. 不是待你處理的橫條：黑字（和日期同色），不是灰字
    await go('#mine');
    ok(await js(() => { const n = document.querySelector('.tc-bar:not(.todo)'), t = document.querySelector('.tc-bar.todo'), d = document.querySelector('.tc-date'); return getComputedStyle(n).color === getComputedStyle(d).color && getComputedStyle(n).color !== getComputedStyle(t).color; }), w + 'px 5 一般的橫條是黑字，輪到你仍是紅字');

    // 6. 詳情頁：日期和時間一樣大、都粗體，而且不會撞到右上角的身分標籤
    for (const id of ['t1', 't11']) {
      await go('#task-' + id);
      const d = await js(() => { const a = getComputedStyle(document.querySelector('.sum-date')), b = getComputedStyle(document.querySelector('.sum-time')), dr = document.querySelector('.sum-date .dw').getBoundingClientRect(), rr = document.querySelector('.sum-role').getBoundingClientRect(), dd = document.querySelector('.sum-date').getBoundingClientRect();
        return { same: a.fontSize === b.fontSize && a.fontWeight === '700' && b.fontWeight === '700', apart: dr.right <= rr.left, one: dd.height <= parseFloat(a.lineHeight) + 1, size: a.fontSize }; });
      ok(d.same && d.apart && d.one, w + 'px 6 ' + id + ' 詳情頁日期和時間同樣大小（' + d.size + '）、都粗體，日期一行、不撞到身分標籤');
    }

    // 7. 本體的「取消案件」收在「案件遇到問題？」裡（召喚替身、待替身確認、待開工都一樣）
    for (const id of ['t1', 't11', 't3']) {
      await act('pick', { id: id === 't1' ? 'u1' : 'u2' }); await go('#task-' + id);
      const c = await js(() => { const btn = document.querySelector('.exit [data-act="cancelTask"]'), d = btn && btn.closest('details.trouble'); return { inside: !!d && !d.open && d.querySelector('summary').textContent === '案件遇到問題？', hidden: !!btn && !btn.checkVisibility(), tip: d ? d.querySelector('p').textContent : '' }; });
      ok(c.inside && c.hidden, w + 'px 7 ' + id + ' 本體的「取消案件」收在「案件遇到問題？」裡 → ' + c.tip);
    }
    await p.click('.exit details.trouble summary'); await W();
    ok(await js(() => document.querySelector('.exit [data-act="cancelTask"]').checkVisibility()), w + 'px 7 展開「案件遇到問題？」才看得到「取消案件」');
    await act('pick', { id: 'u1' }); await go('#task-t3');
    ok(await js(() => { const b = document.querySelector('.exit [data-act="withdrawAssign"]'); return !!b && b.checkVisibility() && !b.closest('details'); }), w + 'px 7 替身的「退出案件」照舊（還沒決定要不要藏）');

    // 8. 通知：第二行是「地點・日期 開工至結束時間」，第一行粗體
    await go('#browse'); await act('openNotes'); await W(200);
    const n = await js(() => Array.from(document.querySelectorAll('.note')).map(x => ({ t: x.querySelector('.note-time span').textContent, w: getComputedStyle(x.querySelector('.note-txt')).fontWeight })));
    ok(n.length > 0 && n.every(x => /^\S+・\d+月\d+日（[日一二三四五六]）\d\d:\d\d 至 \d\d:\d\d$/.test(x.t) && x.w === '700'), w + 'px 8 通知第二行寫地點、日期、開工到結束時間，第一行粗體 → ' + (n[0] && n[0].t));
    ok(await js(() => document.documentElement.scrollWidth <= innerWidth && Array.from(document.querySelectorAll('.note-time')).every(x => x.scrollWidth <= x.clientWidth + 1)), w + 'px 8 通知第二行放得下（放不下時「多久以前」換到下一行）');
    await act('close');

    ok(errs.length === 0, w + 'px no console errors ' + JSON.stringify(errs));
    await p.close();
  }
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
