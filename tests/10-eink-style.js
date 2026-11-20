const { chromium } = require('playwright');
const path = require('path');
const BASE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// 方案 J「低彩度電子紙」的設計規則：沒有陰影、光暈、漸層；沒有純白、純黑；
// 動畫只有 100ms 以內的瞬間切換；字不小於 12px；選取用墨色反白；手機設深色也維持紙面
(async () => {
  const b = await chromium.launch();
  for (const w of [390, 320]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 844 }, colorScheme: 'dark' })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const W = (ms = 150) => p.waitForTimeout(ms);
    const js = (f, a) => p.evaluate(f, a);
    const act = async (a, x = {}) => { await js(([a, x]) => { const el = document.createElement('button'); el.dataset.act = a; Object.assign(el.dataset, x); document.body.appendChild(el); el.click(); el.remove(); }, [a, x]); await W(); };
    const go = async h => { await js(h => { location.hash = h; }, h); await W(300); };
    // 掃過畫面上看得到的每個元素，列出違反規則的地方
    const audit = () => js(() => {
      const bad = { shadow: [], gradient: [], pure: [], motion: [], small: [] };
      const pure = v => /rgba?\((255, 255, 255|0, 0, 0)(, 1)?\)/.test(v);
      const name = e => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '');
      document.querySelectorAll('body *').forEach(e => {
        if (e.closest('svg') || e.tagName === 'IMG') return;
        const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
        if (cs.boxShadow !== 'none') bad.shadow.push(name(e));
        if (/gradient/.test(cs.backgroundImage)) bad.gradient.push(name(e));
        if (pure(cs.backgroundColor) || (pure(cs.color) && e.textContent.trim())) bad.pure.push(name(e) + ' ' + cs.backgroundColor + '/' + cs.color);
        const d = cs.transitionDuration.split(',').map(parseFloat).filter(x => x > 0.1);
        if (d.length || (cs.animationName && cs.animationName !== 'none')) bad.motion.push(name(e));
        const text = Array.from(e.childNodes).some(c => c.nodeType === 3 && c.textContent.trim());
        if (text && parseFloat(cs.fontSize) < 12) bad.small.push(name(e) + ' ' + cs.fontSize);
      });
      return bad;
    });
    const check = async label => {
      const a = await audit();
      ok(!a.shadow.length, w + 'px ' + label + '：沒有陰影 ' + a.shadow.slice(0, 3).join(' '));
      ok(!a.gradient.length, w + 'px ' + label + '：沒有漸層 ' + a.gradient.slice(0, 3).join(' '));
      ok(!a.pure.length, w + 'px ' + label + '：沒有純白、純黑 ' + a.pure.slice(0, 3).join(' '));
      ok(!a.motion.length, w + 'px ' + label + '：沒有超過 100ms 的動畫 ' + a.motion.slice(0, 3).join(' '));
      ok(!a.small.length, w + 'px ' + label + '：字不小於 12px ' + a.small.slice(0, 3).join(' '));
      ok((await js(() => document.documentElement.scrollWidth)) <= w, w + 'px ' + label + '：沒有左右捲動');
    };
    await p.goto(BASE + '#browse'); await js(() => { localStorage.clear(); localStorage.setItem('swaptime-intro-v1', '1'); }); await p.reload(); await W(500);
    await check('未登入接案頁');
    await act('pick', { id: 'u1' });
    for (const h of ['#browse', '#post', '#mine', '#me', '#bank', '#past', '#tags', '#task-t1', '#task-t3', '#task-t4', '#task-t8', '#task-t10', '#task-t11']) { await go(h); await check(h); }
    await go('#browse'); await act('openFilter'); await check('篩選視窗');
    await act('close'); await act('openNotes'); await check('通知');
    await act('close'); await go('#post'); await p.click('[data-act="openTime"][data-w="start"]'); await W(); await check('時間錶盤');
    await act('dlgClose'); await p.click('[data-act="openDate"]'); await W(); await check('日期');
    await act('dlgClose');

    if (w === 390) {
      // 色票：紙面、亞麻色卡片、墨色文字
      await go('#browse');
      const c = await js(() => ({ body: getComputedStyle(document.body).backgroundColor, card: getComputedStyle(document.querySelector('.card')).backgroundColor, ink: getComputedStyle(document.body).color }));
      ok(c.body === 'rgb(244, 239, 230)' && c.card === 'rgb(234, 228, 216)' && c.ink === 'rgb(30, 31, 33)', '紙面 #F4EFE6、卡片 #EAE4D8、文字 #1E1F21（手機設深色也一樣）' + JSON.stringify(c));
      ok((await js(() => getComputedStyle(document.body).backgroundImage)).includes('feTurbulence'), '紙面有很淡的霧面紙紋');
      // 主要按鈕＝墨色實心；選取＝墨色反白
      await go('#mine');
      const sel = await js(() => { const on = document.querySelector('.seg button.on'); const cs = getComputedStyle(on); return [cs.backgroundColor, cs.color]; });
      ok(sel[0] === 'rgb(30, 31, 33)' && sel[1] === 'rgb(244, 239, 230)', '選取中的分段按鈕是墨色反白');
      await go('#task-t11');
      const btn = await js(() => { const cs = getComputedStyle(document.querySelector('.card.next .btn:not(.ghost)')); return [cs.backgroundColor, cs.color]; });
      ok(btn[0] === 'rgb(30, 31, 33)' && btn[1] === 'rgb(244, 239, 230)', '主要按鈕是墨色實心、骨色字');
      ok((await js(() => getComputedStyle(document.querySelector('.card.next.act')).borderTopWidth)) === '2px', '輪到你的「你的下一步」卡片是 2px 墨色實線框');
      // 數字用等寬字；學號維持一般字型
      ok(/Plex Mono/.test(await js(() => getComputedStyle(document.querySelector('.price')).fontFamily)), '金額用等寬字');
      await go('#me');
      ok(!/Mono|Menlo|Consolas/.test(await js(() => getComputedStyle(document.querySelector('.idline .num')).fontFamily)), '學號維持一般字型（數字等寬）');
      // 提醒色只用霧鏽紅
      ok((await js(() => getComputedStyle(document.querySelector('nav.tabs .badge')).backgroundColor)) === 'rgb(158, 90, 73)', '「我的案件」紅點是霧鏽紅 #9E5A49');
    }
    ok(errs.length === 0, w + 'px no console errors ' + JSON.stringify(errs));
    await p.close();
  }
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
