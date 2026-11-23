const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// 第七版（2026-11）使用者的修改和採用的建議
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const W = (ms = 150) => p.waitForTimeout(ms);
  const js = (f, a) => p.evaluate(f, a);
  const act = async (a, x = {}) => { await js(([a, x]) => { const el = document.createElement('button'); el.dataset.act = a; Object.assign(el.dataset, x); document.body.appendChild(el); el.click(); el.remove(); }, [a, x]); await W(); };
  const go = async h => { await js(h => { location.hash = h; }, h); await W(250); };
  const st = () => js(() => JSON.parse(localStorage.getItem('swaptime-proto-v1')));
  const task = async id => (await st()).tasks.find(t => t.id === id);
  const notes = async uid => (await st()).notes.filter(n => n.to === uid).map(n => n.text);
  const fresh = async uid => { await p.goto('about:blank'); await p.goto(B + '#browse'); await js(() => (localStorage.clear(), localStorage.setItem('swaptime-intro-v1', '1'))); await p.reload(); await W(300); if (uid) await act('pick', { id: uid }); };
  const ff = async min => { await act('openDemo'); await act('ff', { v: String(min) }); await act('close'); };
  const okDlg = async () => { await p.click('.sheet [data-act="ok"]'); await W(); };
  /* 直接改示範資料（例如把案件的開工時間移到幾小時後），改完重新整理 */
  const patch = async (fn, arg) => { await js(([src, arg]) => { const s = JSON.parse(localStorage.getItem('swaptime-proto-v1')); (new Function('s', 'arg', src))(s, arg); localStorage.setItem('swaptime-proto-v1', JSON.stringify(s)); }, [fn, arg]); await p.reload(); await W(300); };
  const sheetText = () => js(() => document.querySelector('.m-layer .sheet').innerText);

  // 1. 篩選視窗沒有三句說明
  await fresh('u1'); await act('openFilter'); await W(200);
  const ft = await sheetText();
  ok(!/只看這幾天開工的案件|只顯示整個案件都在這段時間內的|設定標價區間後/.test(ft), '1 篩選視窗沒有星期、時段、標價的說明句');

  // 2. 設定標價區間後，自由出價的案件照樣顯示（t2 自由出價、t1 標價 400、t7 標價 180）
  await js(() => { const f = document.querySelector('form[data-form="filter"]'); f.elements.pmin.value = '300'; f.querySelector('button[type="submit"]').click(); }); await W(250);
  let ids = await js(() => Array.from(document.querySelectorAll('#blist [data-act="open"]')).map(e => e.dataset.id));
  ok(ids.includes('t2') && ids.includes('t1') && !ids.includes('t7'), '2 標價 300 以上：自由出價的 t2 照樣顯示，180 的 t7 不顯示 ' + ids);

  // 介面 1：記住篩選條件（重新整理後還在）
  await p.reload(); await W(300);
  ok(await js(() => document.querySelectorAll('.fchip').length === 1 && document.querySelector('.fchip').textContent.includes('NT$ 300 以上') && !document.querySelector('#blist [data-id="t7"]')), '介面 1：重新整理後篩選條件還在');
  await act('pickSort', { k: 'price', v: 'desc' }); await p.reload(); await W(300);
  ok(await js(() => document.querySelector('.sortbtn').textContent.includes('標價：高到低')), '介面 1：排序也記住了');
  await js(() => { localStorage.setItem('swaptime-filter-v1', JSON.stringify({ f: { from: '2020-01-01', to: '', days: [5], tmin: '', tmax: '', pmin: '', pmax: '', genders: ['不限', '限男生', '限女生'] }, sort: 'start', dir: 'asc' })); }); await p.reload(); await W(300);
  ok(await js(() => { const c = Array.from(document.querySelectorAll('.fchip')).map(x => x.textContent); return c.length === 1 && c[0].includes('週五'); }), '介面 1：已經過去的日期自動拿掉，其他條件留著');
  await act('reset'); await okDlg();
  ok(await js(() => !document.querySelector('.fchip') && !localStorage.getItem('swaptime-filter-v1')), '介面 1：重設示範資料也會清掉記住的篩選');

  // 3. 篩選按「清除」時，視窗停在原本的位置，不會跳回最上面
  await p.setViewportSize({ width: 390, height: 600 });
  await fresh('u1'); await act('openFilter'); await W(250);
  const before = await js(() => { const s = document.querySelector('.m-layer .sheet'); s.scrollTop = s.scrollHeight; return s.scrollTop; });
  await p.click('[data-act="resetFilter"]'); await W(250);
  const after = await js(() => document.querySelector('.m-layer .sheet').scrollTop);
  ok(before > 50 && Math.abs(after - before) < 2, '3 篩選按「清除」後視窗沒有跳到最上面（' + before + ' → ' + after + '）');
  await act('close'); await p.setViewportSize({ width: 390, height: 844 });

  // 4. 自行出價視窗：「輸入金額」字小一點、沒有說明句；出過價之後是「改接受本體標價」
  await fresh('u3'); await go('#task-t1');
  ok(await js(() => document.querySelector('[data-act="acceptPrice"]').textContent === '改接受本體標價'), '4 出過價的案件：按鈕寫「改接受本體標價」');
  await act('openBid', { id: 't1' }); await W(200);
  ok(await js(() => { const i = document.querySelector('#op'), ph = parseFloat(getComputedStyle(i, '::placeholder').fontSize); return ph <= 16 && ph >= 14; }) && !(await sheetText()).includes('本體會看到'), '4 出價視窗：「輸入金額」16px、沒有「本體會看到你的姓名、學號和出價。」');
  await act('close');
  await fresh('u4'); await go('#task-t1');
  ok(await js(() => document.querySelector('[data-act="acceptPrice"]').textContent === '接受本體標價'), '4 還沒出價時仍是「接受本體標價」');

  // 5. 待你處理的紅字橫條也有一條分隔線
  await fresh('u1'); await go('#mine');
  ok(await js(() => { const t = document.querySelector('.tc-bar.todo'), n = document.querySelector('.tc-bar:not(.todo)'), a = getComputedStyle(t), c = getComputedStyle(n);
    return a.borderTopWidth === '1px' && a.borderTopColor === c.borderTopColor && a.borderTopColor !== 'rgba(0, 0, 0, 0)'; }), '5 待你處理的紅字橫條上面有和其他卡片一樣的分隔線');

  // 介面 2：待辦寫出期限
  const bars = await js(() => Object.fromEntries(Array.from(document.querySelectorAll('.tc-bar.todo')).map(x => [x.closest('.card.task').querySelector('[data-act="open"]').dataset.id, (() => { const g = x.querySelector('.grow').cloneNode(true); g.querySelectorAll('.vh').forEach(v => v.remove()); return g.textContent.trim(); })()])));
  ok(/^2 人出價，請選替身（還剩 \d+ (分鐘|小時|天)）$/.test(bars.t1 || '') && /^請驗收（\d+ (小時|天)後自動驗收）$/.test(bars.t4 || '') && bars.t8 === '請付款 NT$ 350' && /^本體選了你，請確認（還剩 \d+ (小時|天)）$/.test(bars.t11 || ''), '介面 2：待辦寫期限 ' + JSON.stringify(bars));
  await ff(1440); await go('#mine');
  ok(await js(() => { const g = document.querySelector('[data-act="open"][data-id="t8"]').closest('.card.task').querySelector('.tc-bar .grow').cloneNode(true); g.querySelectorAll('.vh').forEach(v => v.remove()); return g.textContent.trim() === '請付款 NT$ 350（已過 1 天）'; }), '介面 2：驗收超過 1 天還沒付款，寫「（已過 1 天）」');

  // 6. 標記全站都有書籤符號；黑名單和可信賴、自訂內容同一種樣子；出價清單不寫「你的標記」
  await fresh('u1'); await go('#task-t1');  /* 示範資料：王小明把林柏翰（u3）標成自訂內容 */
  ok(await js(() => { const o = document.querySelector('[data-oid="o2"]').closest('.offer'), c = o.querySelector('.tagchip.tg-custom');
    return !!c && !!c.querySelector('svg') && c.querySelector('.tg-lbl').textContent === '打掃很仔細，但遲到 20 分鐘' && !Array.from(o.querySelectorAll('.muted')).some(e => e.textContent.includes('你的標記')); }), '6 出價清單：書籤符號＋標記內容，不寫「你的標記」');
  await act('setTag', { uid: 'u2', type: 'black' }); await act('setTag', { uid: 'u3', type: 'trust' });
  const chips = await js(() => Array.from(document.querySelectorAll('.offer .tagchip')).map(c => { const s = getComputedStyle(c); return [c.className, s.backgroundColor, s.color]; }));
  const todoRed = await js(() => { document.body.insertAdjacentHTML('beforeend', '<div class="card task" id="x"><div class="tc-bar bottom todo">x</div></div>'); const s = getComputedStyle(document.querySelector('#x .tc-bar')); const r = [s.backgroundColor, s.color]; document.getElementById('x').remove(); return r; });
  const blk = chips.find(c => c[0].includes('tg-black')), tru = chips.find(c => c[0].includes('tg-trust'));
  ok(!!blk && blk[1] === 'rgb(255, 218, 214)' && !!tru && tru[1] === 'rgb(200, 240, 207)' && blk[1] !== todoRed[0] && blk[2] !== todoRed[1], '6 黑名單是淺紅底深色字（和可信賴的淺綠底同一種樣子），和待你處理的白底紅字不同 ' + JSON.stringify([blk, tru, todoRed]));
  await fresh('u1'); await act('setTag', { uid: 'u3', type: 'black' }); await go('#browse'); await p.click('[data-act="toggleBlack"]'); await W();
  ok(await js(() => { const g = document.querySelector('[data-id="t2"]').closest('.card.task').querySelector('.tagchip.tg-black'); return !!g && !!g.querySelector('svg'); }), '6 接案頁卡片的黑名單也是書籤符號');
  await fresh('u4'); await act('setTag', { uid: 'u1', type: 'trust' }); await go('#task-t1');
  ok(await js(() => { const n = document.querySelector('.banner.tagnote'); return !!n && n.innerText.includes('這位本體') && !!n.querySelector('.tagchip.tg-trust svg'); }), '6 瀏覽別人的案件時，提醒你標記過這位本體（書籤符號）');
  await go('#tags');
  ok(await js(() => Array.from(document.querySelectorAll('.tagbtn')).every(x => !!x.querySelector('svg'))), '6 標記過的人頁：每個標記都有書籤符號');

  // 8. 取消「替身 24 小時沒確認就自動撤銷」：本體想等就等，開工時還沒確認才自動取消
  await fresh('u1'); await patch("const t=s.tasks.find(x=>x.id==='t1');const n=Date.now()+s.clockOffset;t.start=Math.ceil((n+3*86400e3)/60e3)*60e3;t.end=t.start+7200e3;");
  await go('#task-t1'); await js(() => document.querySelector('[data-act="choose"][data-oid="o1"]').click()); await W(); await okDlg();
  ok((await notes('u2')).includes('本體選了你，請在開工前確認接案'), '8 被選中的通知：「本體選了你，請在開工前確認接案」');
  await ff(25 * 60);
  ok((await task('t1')).status === 'pending' && !(await notes('u1')).some(x => /撤銷|期限內/.test(x)), '8 選中 25 小時後仍是「待替身確認」，沒有自動撤銷');
  await act('pick', { id: 'u1' }); await go('#me');
  ok(await js(() => document.querySelector('.rules').textContent.includes('替身要在開工前確認接案，開工時還沒確認，案件會自動取消。') && !document.querySelector('.rules').textContent.includes('24 小時內、而且')), '8 使用規則改成開工前確認');
  await ff(3 * 1440);
  const t1c = await task('t1');
  ok(t1c.status === 'cancelled' && t1c.cancelKind === 'noconfirm' && (await notes('u1')).includes('替身沒有在開工前確認，案件已自動取消'), '8 開工時還沒確認：整個案件自動取消');

  // 9、10 價格：選中後寫「選中的出價」和原標價；確認接案後是「成交價」；瀏覽的人只看本體標價
  await fresh('u1'); await go('#task-t1'); await js(() => document.querySelector('[data-act="choose"][data-oid="o1"]').click()); await W(); await okDlg();
  const sp = await js(() => { const s = document.querySelector('.sum-price'), o = s.querySelector('.sum-orig'), pr = s.querySelector('.price'); return { t: s.innerText.replace(/\n/g, ' '), above: !!o && o.getBoundingClientRect().bottom <= pr.getBoundingClientRect().top + 1, small: o ? getComputedStyle(o).fontSize : '' }; });
  ok(/選中的出價/.test(sp.t) && /原標價 NT\$ 400/.test(sp.t) && /NT\$ 420/.test(sp.t) && sp.above && sp.small === '12px', '9、10 等替身確認接案：「選中的出價」，上方小字「原標價 NT$ 400」 → ' + sp.t);
  ok(await js(() => document.querySelector('.card.next h2').textContent === '等替身確認接案'), '10 卡片標題「等替身確認接案」');
  await act('pick', { id: 'u4' }); await go('#task-t1');
  ok(await js(() => { const s = document.querySelector('.sum-price').innerText; return s.includes('本體標價') && s.includes('400') && !s.includes('420') && !document.querySelector('.sum-orig'); }), '瀏覽的人只看得到本體標價，看不到選中的出價');
  await act('pick', { id: 'u2' }); await go('#task-t1'); await js(() => document.querySelector('[data-act="acceptMatch"]').click()); await W(300);
  ok(await js(() => { const s = document.querySelector('.sum-price').innerText; return s.includes('成交價') && s.includes('原標價 NT$ 400') && s.includes('420'); }), '9 確認接案後：「成交價 NT$ 420」，上方小字「原標價 NT$ 400」');
  await go('#task-t3');  /* t3：成交價和標價一樣 */
  await act('pick', { id: 'u1' }); await go('#task-t3');
  ok(await js(() => !document.querySelector('.sum-orig') && document.querySelector('.sum-price').innerText.includes('成交價')), '9 成交價和標價一樣時不寫原標價');

  // 建議 1：時間重疊提醒（出價、確認接案）
  await fresh('u1'); await patch("const a=s.tasks.find(x=>x.id==='t2'),b=s.tasks.find(x=>x.id==='t11');a.start=b.start;a.end=b.end;");
  await go('#task-t2');
  ok(await js(() => { const c = document.querySelector('.card.next .banner.clash'); return !!c && c.innerText.startsWith('這段時間你已經有案件：第一宿舍・'); }), '建議 1：出價卡提醒「這段時間你已經有案件：…」');
  await fresh('u1'); await patch("const a=s.tasks.find(x=>x.id==='t11'),b=s.tasks.find(x=>x.id==='t3');a.start=b.start;a.end=b.end;");
  await go('#task-t11');
  ok(await js(() => { const c = document.querySelector('.card.next .banner.clash'); return !!c && c.innerText.includes('第一宿舍・') && document.querySelector('.card.next [data-act="acceptMatch"]').compareDocumentPosition(c) & Node.DOCUMENT_POSITION_PRECEDING; }), '建議 1：確認接案卡也提醒，放在「確認接案」按鈕上面');
  await fresh('u1'); await go('#task-t2');
  ok(!(await js(() => !!document.querySelector('.banner.clash'))), '建議 1：時間沒有重疊就不提醒');

  // 建議 5：開工前 5 小時還沒選替身，有人出價才提醒本體一次
  await fresh('u1'); await patch("const n=Date.now()+s.clockOffset;for(const id of ['t1','t7']){const t=s.tasks.find(x=>x.id===id);t.start=Math.ceil((n+6*3600e3)/60e3)*60e3;t.end=t.start+3600e3;}");
  await ff(30);
  ok(!(await notes('u1')).some(x => x.includes('請盡快選替身')), '建議 5：開工前 5 小時以前不提醒');
  await ff(40);
  const r5 = (await notes('u1')).filter(x => x.includes('請盡快選替身'));
  ok(r5.length === 1 && /^\d+ (小時|分鐘)後開工，請盡快選替身，開工時還沒確定替身，案件會自動取消$/.test(r5[0]), '建議 5：開工前 5 小時提醒本體 → ' + r5[0]);
  ok(!(await notes('u4')).some(x => x.includes('請盡快選替身')), '建議 5：沒人出價的案件不提醒');
  await ff(60);
  ok((await notes('u1')).filter(x => x.includes('請盡快選替身')).length === 1, '建議 5：只提醒一次');

  // 建議 4：照片可以點開下載
  await fresh('u1'); await go('#task-t4');
  await p.click('.photos img'); await W(200);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.click('.m-layer [data-act="dlImg"]')]);
  ok(!!dl && /^photo-\d{8}-\d{6}\.svg$/.test(dl.suggestedFilename()), '建議 4：放大照片的視窗有「下載」，按了會下載 → ' + (dl && dl.suggestedFilename()));
  await act('close');

  // 介面 4：從留言通知打開案件時，直接捲到留言板
  await p.setViewportSize({ width: 390, height: 640 });
  await fresh('u2'); await go('#task-t3');
  await js(() => { const f = document.querySelector('form[data-form="comment"]'); f.elements.text.value = '鑰匙在櫃檯'; f.querySelector('button[type="submit"]').click(); }); await W(200);
  await act('pick', { id: 'u1' }); await go('#browse'); await act('openNotes'); await W(200);
  await p.click('.note:has-text("陳怡君留言")'); await W(400);
  const cs = await js(() => { const r = document.getElementById('cmt-sec').getBoundingClientRect(); return { top: Math.round(r.top), y: Math.round(scrollY), hash: location.hash }; });
  ok(cs.hash === '#task-t3' && cs.y > 0 && cs.top >= 64 && cs.top <= 90, '介面 4：從留言通知進來，留言板在畫面最上面（標題欄下面） ' + JSON.stringify(cs));
  await go('#browse'); await act('openNotes'); await W(200);
  await p.click('.note:has-text("有人出價")'); await W(400);
  ok(await js(() => scrollY === 0), '介面 4：其他通知照樣從案件最上面開始');
  await p.setViewportSize({ width: 390, height: 844 });

  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
