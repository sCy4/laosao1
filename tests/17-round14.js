const { chromium } = require('playwright');
const path = require('path');
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// 第十四版（2026-11）：使用者逐項修改的 12 點（用詞、標價區間、日期粗體、限男限女外框、待替身確認接案卡片排版）
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const W = (ms = 150) => p.waitForTimeout(ms);
  const js = (f, a) => p.evaluate(f, a);
  const act = async (a, x = {}) => { await js(([a, x]) => { const el = document.createElement('button'); el.dataset.act = a; Object.assign(el.dataset, x); document.body.appendChild(el); el.click(); el.remove(); }, [a, x]); await W(); };
  const go = async h => { await js(h => { location.hash = h; }, h); await W(250); };
  const st = () => js(() => JSON.parse(localStorage.getItem('swaptime-proto-v1')));
  const fresh = async uid => { await p.goto('about:blank'); await p.goto(B + '#browse'); await js(() => { localStorage.clear(); localStorage.setItem('swaptime-intro-v1', '1'); }); await p.reload(); await W(300); if (uid) await act('pick', { id: uid }); };
  const patch = async (src) => { await js(src => { const s = JSON.parse(localStorage.getItem('swaptime-proto-v1')); (new Function('s', src))(s); localStorage.setItem('swaptime-proto-v1', JSON.stringify(s)); }, src); await p.reload(); await W(300); };
  const ff = async min => { await act('openDemo'); await act('ff', { v: String(min) }); await act('close'); };
  const ferrText = () => js(() => (document.querySelector('.ferr') || {}).textContent || '');
  const txt = sel => js(s => (document.querySelector(s) || {}).innerText || '', sel);

  // 1、2. 登入視窗標題、未登入「我的」的說明
  await fresh(); await act('login'); await W(200);
  ok((await txt('.sheet h2')) === '以東海學生信箱（tMail）登入替身掃者', '1 登入視窗標題');
  await act('close'); await go('#me');
  ok((await txt('main')).includes('登入後才能管理個人資料。') && !(await txt('main')).includes('收款方式和收藏'), '2 未登入「我的」的說明');

  // 3、4. 發案頁的說明；篩選的標價區間只收 1～5,000 的整數
  await fresh('u1'); await go('#post');
  const post = await txt('main');
  ok(post.includes('不填＝替身自由出價') && post.includes('等有人接受你的標價或自行出價後，你再從中選擇你的替身。'), '3、4 發案頁的說明');
  await go('#browse');
  for (const [v, good] of [['0', false], ['5001', false], ['2.5', false], ['1', true]]) {
    await act('openFilter'); await W(200);
    await p.fill('input[name=pmin]', v); await p.click('form[data-form="filter"] button[type="submit"]'); await W();
    const open = await js(() => !!document.querySelector('form[data-form="filter"]'));
    ok(good ? !open : (open && (await ferrText()) === '標價區間請填 NT$ 1 到 5,000 的整數，或不填'), '3 標價區間 ' + v + (good ? ' 可以' : ' 不行'));
    if (open) await act('close');
  }
  await act('clearF', { k: 'price' });

  // 5. 確認發布視窗沒有「發布後不能修改」
  await fresh('u1'); await go('#post'); await p.fill('#p-b', '第一宿舍'); await p.fill('#p-meet', '大廳');
  await p.click('form[data-form="post"] button[type="submit"]'); await W();
  ok((await txt('.sheet')).includes('確認發布？') && !(await txt('.sheet')).includes('發布後不能修改'), '5 確認發布視窗沒有「發布後不能修改」');
  await p.click('.sheet [data-act="postOk"]'); await W(400);
  // 9. 沒寫備註：詳情頁不顯示「備註」
  ok(await js(() => !Array.from(document.querySelectorAll('.card.sum dt')).some(d => d.textContent === '備註')), '9 沒寫備註時不顯示「備註」');
  await go('#task-t1');
  ok(await js(() => Array.from(document.querySelectorAll('.card.sum dt')).some(d => d.textContent === '備註')), '9 有備註時照常顯示');

  for (const w of [320, 390]) {
    await p.setViewportSize({ width: w, height: 844 });
    await fresh('u1'); await go('#browse');
    // 6. 卡片日期粗體、和時間靠近；所有卡片的時間仍對齊
    const c = await js(() => { const cards = Array.from(document.querySelectorAll('.card.task')); const lefts = cards.map(c => Math.round(c.querySelector('.tc-time').getBoundingClientRect().left));
      const d = cards[0].querySelector('.tc-d'), r = document.createRange(); r.selectNodeContents(d); const ink = r.getBoundingClientRect().right, gap = cards[0].querySelector('.tc-time').getBoundingClientRect().left - ink;
      return { bold: getComputedStyle(d).fontWeight, same: new Set(lefts).size === 1, gap }; });
    ok(c.bold === '700' && c.same, w + 'px 6 卡片日期粗體，時間仍對齊');
    ok(c.gap < 12, w + 'px 6 日期和時間的距離變短（' + Math.round(c.gap) + 'px）');
    // 7. 限男、限女：透明底加外框
    const g = await js(() => { const e = document.querySelector('.gtxt'); const s = getComputedStyle(e); return { bg: s.backgroundColor, sh: s.boxShadow }; });
    ok(g.bg === 'rgba(0, 0, 0, 0)' && /inset/.test(g.sh), w + 'px 7 限男／限女透明底、有外框');
    // 10. 本體的橫條、詳情頁寫「距開工」
    await go('#mine'); await act('seg', { k: 'mineRole', v: 'own' });
    ok(/2 人出價，請選替身（距開工 \d+ (分鐘|小時|天)）$/.test(await js(() => Array.from(document.querySelectorAll('.card.task')).map(c => c.querySelector('.tc-bar').innerText.trim()).find(t => t.includes('人出價')) || '')), w + 'px 10 本體的待辦寫「距開工」');
    await go('#task-t1');
    ok(/^距開工 \d+ (分鐘|小時|天)$/.test(await txt('.sum-time .small')), w + 'px 10 詳情頁寫「距開工」');
    // 8. 取消案件的說明
    await js(() => document.querySelector('details.trouble').open = true); await p.click('[data-act="cancelTask"]'); await W();
    ok((await txt('.sheet')).includes('將撤銷所有出價並通知出價者。'), w + 'px 8 取消案件的說明');
    await act('close');
    // 11、12. 待替身確認接案（陳怡君選了王小明）
    await act('pick', { id: 'u2' }); await go('#task-t11');
    const k = await js(() => { const c = document.querySelector('.card.next'), box = c.querySelector('.pickbox'), pr = box.querySelector(':scope > .price'), tag = box.querySelector('.taglink'), id = box.querySelector('.idline'), nm = box.querySelector('.id-name');
      const P = pr.getBoundingClientRect(), Tg = tag.getBoundingClientRect(), I = id.getBoundingClientRect(), N = nm.getBoundingClientRect();
      return { title: c.querySelector('h2').textContent, text: c.innerText, bg: getComputedStyle(box).backgroundColor, priceRight: P.left > N.right && Math.abs(P.top - N.top) < 8, tagBelow: Tg.top >= I.bottom - 1,
        size: parseFloat(getComputedStyle(pr).fontSize), sumSize: parseFloat(getComputedStyle(document.querySelector('.sum-price .price')).fontSize), offerSize: 22 }; });
    ok(k.title === '待替身確認接案', w + 'px 11 卡片標題「待替身確認接案」');
    ok(k.bg === 'rgba(0, 0, 0, 0)' && k.priceRight && k.tagBelow, w + 'px 11 沒有灰底、出價在右上角、標記在學號下面');
    ok(!/出價|確認期限|開工時/.test(k.text) && k.size > 16 && k.size <= k.sumSize, w + 'px 11 不寫「出價」，價格 ' + k.size + 'px（摘要 ' + k.sumSize + 'px）');
    ok(/你在 1 小時後可以重新選擇替身（還剩 \d+ (分鐘|小時)）。|你現在可以重新選擇替身。/.test(k.text) && /重新選擇替身$/.test(k.text.trim()), w + 'px 12 說明和按鈕');
    await p.screenshot({ path: path.resolve(__dirname, 'out', 'r14-pending-' + w + '.png') });
    ok(await js(() => document.documentElement.scrollWidth <= innerWidth), w + 'px 沒有左右捲動');
  }

  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
