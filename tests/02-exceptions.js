const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const W = (ms = 150) => p.waitForTimeout(ms);
  const js = (f, a) => p.evaluate(f, a);
  const act = async (a, x = {}) => { await js(([a, x]) => { const el = document.createElement('button'); el.dataset.act = a; Object.assign(el.dataset, x); document.body.appendChild(el); el.click(); el.remove(); }, [a, x]); await W(); };
  const go = async h => { await js(h => { location.hash = h; }, h); await W(250); };
  const st = () => js(() => JSON.parse(localStorage.getItem('swaptime-proto-v1')));
  const task = async id => (await st()).tasks.find(t => t.id === id);
  const notes = async uid => (await st()).notes.filter(n => n.to === uid).map(n => n.text);
  const main = () => js(() => document.querySelector('main').innerText);
  const fresh = async uid => { await p.goto('about:blank'); await p.goto(B + '#browse'); await js(() => (localStorage.clear(),localStorage.setItem('swaptime-intro-v1','1'))); await p.reload(); await W(300); if (uid) await act('pick', { id: uid }); };
  const ff = async min => { await act('openDemo'); await act('ff', { v: String(min) }); await act('close'); };
  const okDlg = async () => { await p.click('.sheet [data-act="ok"]'); await W(); };

  // A. 學號・性別・系級 間距
  await fresh('u1'); await go('#me');
  const gap = await js(() => { const s = document.querySelectorAll('.me-card .idline > span'); const a = s[0].getBoundingClientRect(), c = s[2].getBoundingClientRect(); return [Math.round(c.left - a.right), getComputedStyle(s[0]).fontFamily]; });
  ok(gap[0] <= 20 && !/mono|Menlo|Consolas/i.test(gap[0 + 1]), '學號到性別的距離 ' + gap[0] + 'px（原本約 33px），字型不是等寬');

  // B. 標題欄
  await go('#task-t3');
  ok(await js(() => !!document.querySelector('header [data-act="back"]') && !!document.querySelector('header [data-act="openNotes"]') && !document.querySelector('header [data-act="fav"]')), '詳情頁標題欄有返回和鈴鐺，沒有收藏');
  ok(await js(() => !!document.querySelector('.card.sum [data-act="fav"]')), '收藏星號在摘要卡上');
  await act('openNotes'); ok(await js(() => !!document.querySelector('.sheet .notes')), '在詳情頁可以打開通知'); await act('close');
  await act('logout'); await go('#task-t1');
  ok(await js(() => !document.querySelector('[data-act="fav"]')) && (await main()).includes('登入後出價'), '未登入：詳情頁沒有收藏，保留「登入後出價」');
  await go('#browse'); ok(await js(() => !document.querySelector('[data-act="fav"]')), '未登入：接案頁沒有收藏星號');

  // C. 過了開工時間的案件自動取消
  await fresh('u1'); await ff(2880);
  const t1 = await task('t1');
  ok(t1.status === 'cancelled' && t1.cancelKind === 'expired', 't1 過了開工時間 → 已取消（' + t1.status + '）');
  await go('#browse');
  ok(await js(() => { const s = JSON.parse(localStorage.getItem('swaptime-proto-v1')); const now = Date.now() + s.clockOffset; return Array.from(document.querySelectorAll('#blist [data-act="open"]')).every(e => s.tasks.find(t => t.id === e.dataset.id).start > now); }), '接案頁只剩還沒開工的案件');
  ok((await notes('u1')).some(x => x.includes('開工時間到了還沒有確定替身')), '本體收到自動取消通知');
  ok((await notes('u2')).some(x => x.includes('案件到了開工時間還沒選替身')), '出過價的替身也收到通知');
  await go('#cancelled'); ok((await main()).includes('已取消・沒有確定替身'), '已取消卡片寫原因：' + (await main()).match(/已取消・\S+/)?.[0]);

  // D. 接案頁避開黑名單本體
  await fresh('u1'); await act('setTag', { uid: 'u3', type: 'black' }); await go('#browse');
  let ids = await js(() => Array.from(document.querySelectorAll('#blist [data-act="open"]')).map(e => e.dataset.id));
  ok(!ids.includes('t2') && (await main()).includes('已隱藏 1 個黑名單本體的案件'), '黑名單本體的案件預設隱藏 ' + ids);
  await p.click('[data-act="toggleBlack"]'); await W();
  ids = await js(() => Array.from(document.querySelectorAll('#blist [data-act="open"]')).map(e => e.dataset.id));
  ok(ids.includes('t2') && (await main()).includes('你的黑名單'), '按「顯示」後出現，並標示「你的黑名單」');
  await p.click('[data-act="toggleBlack"]'); await W();

  // E. 替身：結束案件：無法完成（t6：張書瑋是替身、已開工）
  await fresh('u4'); await go('#task-t6');
  ok(await js(() => !!document.querySelector('details.trouble') && !document.querySelector('details.trouble').open), '「遇到問題？」預設收合');
  ok(!(await p.isVisible('[data-act="failTask"]')), '收合時看不到「結束案件」按鈕');
  await p.click('details.trouble summary'); await W();
  await p.click('[data-act="failTask"]'); await W();
  ok((await js(() => document.querySelector('.sheet').innerText)).includes('也可以把你加入黑名單'), '確認視窗說明後果');
  await okDlg();
  let t6 = await task('t6'); ok(t6.status === 'cancelled' && t6.cancelKind === 'fail', '案件取消（無法完成）');
  ok((await notes('u2')).some(x => x === '張書瑋無法完成，案件已取消'), '本體收到通知');
  await act('pick', { id: 'u2' }); await W();
  ok((await main()).includes('替身表示無法完成，案件已取消，你不用付款。'), '本體看到原因');
  await p.click('[data-act="setTag"][data-uid="u4"]'); await W();
  ok((await st()).tags.u2.u4.type === 'black', '本體一鍵把替身加入黑名單');

  // F. 本體：結束案件：替身未完成（結束時間 24 小時後才出現；替身沒按完成會自動算完成）
  await fresh('u2'); await go('#task-t6');
  await p.click('details.trouble summary'); await W();
  ok((await js(() => document.querySelector('details.trouble').innerText)).includes('開工時間結束 24 小時後') && !(await js(() => !!document.querySelector('[data-act="openNotDone"]'))), '結束時間未滿 24 小時：「案件遇到問題？」只有說明，沒有結束按鈕');
  await ff(1440);
  t6 = await task('t6'); ok(t6.status === 'done' && t6.autoDone, '結束 24 小時後替身沒按完成 → 自動算打掃完成');
  ok((await notes('u2')).some(x => x.includes('已自動算打掃完成，請驗收')), '本體收到自動完成通知');
  await go('#mine'); await go('#task-t6');
  await p.click('details.trouble summary'); await W(); await p.click('[data-act="openNotDone"]'); await W();
  await p.click('form[data-form="notdone"] button[type="submit"]'); await W(100);
  ok((await js(() => document.querySelector('.sheet .ferr').textContent)) === '請寫下原因', '沒寫原因不能送出（錯誤顯示在欄位下）');
  await p.fill('#nd-text', '浴室沒有洗，地板也沒拖');
  await p.click('form[data-form="notdone"] button[type="submit"]'); await W(100);
  ok((await js(() => document.querySelector('.sheet .ferr').textContent)) === '請至少附上 1 張照片', '沒附照片不能送出（錯誤顯示在欄位下）');
  await p.setInputFiles('#nd-f', { name: 'a.png', mimeType: 'image/png', buffer: PNG }); await W(500);
  ok(await js(() => document.querySelectorAll('.sheet .ph img').length) === 1 && (await js(() => document.getElementById('nd-text').value)) === '浴室沒有洗，地板也沒拖', '照片加入，原因沒有被清掉');
  await p.click('form[data-form="notdone"] button[type="submit"]'); await W();
  t6 = await task('t6'); ok(t6.status === 'cancelled' && t6.cancelKind === 'notdone' && t6.endNote.photos.length === 1, '案件取消（替身未完成），存下原因和照片');
  ok((await notes('u4')).some(x => x.includes('本體結束了案件，表示你未完成')), '替身收到通知');
  await act('pick', { id: 'u4' }); await W();
  const m4 = await main();
  ok(m4.includes('本體寫的原因') && m4.includes('浴室沒有洗') && (await js(() => document.querySelectorAll('.endnote-photos img').length)) === 1, '替身看得到原因和照片');
  ok(await js(() => !!document.querySelector('[data-act="setTag"][data-uid="u2"]')), '替身可以一鍵把本體加入黑名單');
  await p.screenshot({ path: path.join(OUT, 'notdone-worker.png'), fullPage: true });

  // G. 自動驗收（t4：王小明是本體，陳怡君是替身，替身 2 小時前按完成）
  await fresh('u1'); await go('#task-t4');
  ok((await main()).includes('會自動驗收完成（還剩'), '驗收卡片顯示自動驗收時間');
  await ff(2880);
  ok((await notes('u1')).some(x => x === '1 天後會自動驗收完成，請盡快驗收'), '自動驗收前 1 天提醒本體');
  ok((await task('t4')).status === 'done', '還沒滿 3 天，仍是待驗收');
  await ff(1440);
  const t4 = await task('t4'); ok(t4.status === 'confirmed' && t4.autoConfirmed, '滿 3 天自動驗收完成');
  ok((await notes('u2')).some(x => x.includes('本體 3 天內沒有驗收，已自動驗收完成')), '替身收到自動驗收通知');

  // H. 替身：結束案件：沒收到款項（t8：林柏翰是替身，3 小時前驗收）
  await fresh('u3'); await go('#task-t8');
  await p.click('details.trouble summary'); await W();
  ok((await js(() => document.querySelector('details.trouble').innerText)).includes('驗收 7 天後') && !(await js(() => !!document.querySelector('[data-act="unpaid"]'))), '驗收未滿 7 天：「案件遇到問題？」只有說明，沒有結束按鈕');
  await ff(10080); await go('#mine'); await go('#task-t8');
  ok((await notes('u3')).some(x => x.includes('驗收已超過 7 天還沒收到款項，建議先在留言板跟本體確認')), '7 天提醒只建議溝通');
  await p.click('details.trouble summary'); await W(); await p.click('[data-act="unpaid"]'); await W(); await okDlg();
  const dlg = await js(() => document.querySelector('.sheet').innerText);
  ok(dlg.includes('要把王小明加入黑名單嗎？') && dlg.includes('先不要'), '結束後提示加入黑名單');
  await okDlg();
  ok((await st()).tags.u3.u1.type === 'black' && (await task('t8')).cancelKind === 'unpaid', '已結束並加入黑名單');
  ok((await notes('u1')).some(x => x === '林柏翰結束了案件：沒收到款項'), '本體收到通知');
  await go('#cancelled'); ok((await main()).includes('已取消・沒收到款項'), '替身的已取消卡片寫原因');

  // I. 留言板照片 + 通知
  await fresh('u1'); await go('#task-t3');
  await p.setInputFiles('#cmt-f', { name: 'k.png', mimeType: 'image/png', buffer: PNG }); await W(500);
  ok(await js(() => document.querySelectorAll('.cmt-pre img').length) === 1, '送出前可以預覽要傳的照片');
  await p.click('form[data-form="comment"] button[type="submit"]'); await W();
  ok(await js(() => document.querySelectorAll('.cmt-imgs img').length) === 1, '照片出現在留言裡');
  ok((await notes('u2')).some(x => x === '王小明傳了 1 張照片'), '對方收到「傳了 1 張照片」通知');
  await p.fill('#cmt-in', '鑰匙拿到了'); await p.click('form[data-form="comment"] button[type="submit"]'); await W();
  ok((await notes('u2')).some(x => x === '王小明留了 2 則新留言，最新一則：「鑰匙拿到了」'), '同一案件的留言通知合併');
  await p.click('.cmt-imgs img'); await W(); ok(await js(() => !!document.querySelector('.sheet .big-photo')), '點照片可以放大'); await act('close');

  // J. 案件完成 7 天後，留言照片自動刪除
  await fresh('u3'); await go('#task-t8');
  await p.setInputFiles('#cmt-f', { name: 'k.png', mimeType: 'image/png', buffer: PNG }); await W(400);
  await p.click('form[data-form="comment"] button[type="submit"]'); await W();
  await act('pick', { id: 'u1' }); await W();
  await p.click('form[data-form="pay"] button'); await W();
  await act('pick', { id: 'u3' }); await W(); await p.click('[data-act="received"]'); await W(); await okDlg();
  ok((await task('t8')).status === 'closed', 't8 完成');
  await ff(10080); await ff(1440);
  const t8 = await task('t8'); ok(t8.comments.every(c => !(c.imgs && c.imgs.length)) && (await main()).includes('照片已在案件完成 7 天後自動刪除'), '完成 7 天後留言照片自動刪除');

  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
