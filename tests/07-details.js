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
  const main = () => js(() => document.querySelector('main').innerText);
  const st = () => js(() => JSON.parse(localStorage.getItem('swaptime-proto-v1')));
  const fresh = async uid => { await p.goto('about:blank'); await p.goto(B + '#browse'); await js(() => { localStorage.clear(); localStorage.setItem('swaptime-intro-v1', '1'); }); await p.reload(); await W(300); if (uid) await act('pick', { id: uid }); };
  const okDlg = async () => { await p.click('.sheet [data-act="ok"]'); await W(); };
  const files = n => Array.from({ length: n }, (_, i) => ({ name: 'p' + i + '.png', mimeType: 'image/png', buffer: PNG }));
  const toastTxt = () => js(() => (document.getElementById('toast') || {}).textContent || '');

  // 1. 「案件遇到問題？」：替身開工後馬上可以結束（t6：張書瑋，已開工）
  await fresh('u4'); await go('#task-t6');
  ok(await js(() => !!document.querySelector('details.trouble [data-act="failTask"]')), '替身開工後：「案件遇到問題？」裡有「結束案件：無法完成」');
  // 本體開工後就看得到，但只有說明（t6：陳怡君）
  await fresh('u2'); await go('#task-t6');
  await p.click('details.trouble summary'); await W();
  const tr = await js(() => document.querySelector('details.trouble').innerText);
  ok(tr.includes('有疑慮請先在留言板跟替身溝通') && /也就是 \d+月\d+日（.）\d\d:\d\d 之後/.test(tr) && !(await js(() => !!document.querySelector('[data-act="openNotDone"]'))), '本體開工後看得到「案件遇到問題？」，裡面寫什麼時候才能結束，沒有按鈕');
  // 開工前沒有（t3：開工前）
  await fresh('u2'); await go('#task-t3');
  ok(!(await js(() => !!document.querySelector('details.trouble'))), '開工前沒有「案件遇到問題？」（還可以直接取消）');

  // 2. 自行出價
  await fresh('u4'); await go('#task-t1');
  ok((await js(() => document.querySelector('[data-act="openBid"]').textContent)) === '自行出價', '出價按鈕是「自行出價」');
  // 8. 出價視窗：沒有「關閉」；有標價才寫本體標價
  await p.click('[data-act="openBid"]'); await W();
  let sh = await js(() => document.querySelector('.sheet').innerText);
  ok(sh.startsWith('自行出價') && sh.includes('本體標價：NT$ 400') && !(await js(() => !!document.querySelector('.sheet [data-act="close"]'))), '出價視窗標題「自行出價」，有標價時顯示，沒有「關閉」按鈕');
  await p.fill('#op', '350'); await p.click('form[data-form="offer"] button[type="submit"]'); await W();
  await p.click('[data-act="openBid"]'); await W();
  ok(await js(() => document.querySelector('.sheet [data-act="withdrawOffer"]').classList.contains('quiet')), '「撤回出價」改成淡色文字按鈕');
  await act('close');
  await go('#task-t2'); await p.click('[data-act="openBid"]'); await W();
  ok(!(await js(() => document.querySelector('.sheet').innerText)).includes('本體標價'), '自由出價的案件，出價視窗不寫「本體標價：自由出價」');
  await act('close');

  // 6. 卡片只在限男、限女時顯示性別
  await go('#browse');
  const g = await js(() => Array.from(document.querySelectorAll('.tc-g')).map(e => e.textContent));
  ok(g.length > 0 && g.every(x => x !== '不限' && !x.includes('不限')), '卡片只顯示「限男／限女」，不限的不顯示 ' + JSON.stringify(g));

  // 9. 出價清單「選這位」在右邊價格下面（t1：王小明）
  await fresh('u1'); await go('#task-t1');
  ok(await js(() => { const s = document.querySelector('.offer .offer-side'); return !!s && !!s.querySelector('.price') && !!s.querySelector('[data-act="choose"]'); }), '「選這位」在右邊價格下面');
  const pos = await js(() => { const s = document.querySelector('.offer .offer-side'), pr = s.querySelector('.price').getBoundingClientRect(), bt = s.querySelector('[data-act="choose"]').getBoundingClientRect(), of = document.querySelector('.offer').getBoundingClientRect(); return { below: bt.top >= pr.bottom - 1, right: of.right - bt.right < 30 }; });
  ok(pos.below && pos.right, '按鈕在價格正下方、靠右');

  // 3. 收款方式：展開列表（陳怡君兩種都有）
  await fresh('u2'); await go('#bank');
  let rows = await js(() => Array.from(document.querySelectorAll('main .acc-h')).map(e => e.innerText.replace(/\s+/g, ' ')));
  ok(rows.length === 2 && rows[0].includes('銀行轉帳') && rows[0].includes('已設定・****9012') && rows[1].includes('LINE Pay') && rows[1].includes('已設定'), '收款方式頁兩列並排，各自顯示狀態 ' + JSON.stringify(rows));
  ok(!(await js(() => !!document.querySelector('main .acc-b'))), '一開始全部收合，不用往下滑就看得到兩種');
  await p.click('[data-act="payToggle"][data-v="linepay"]'); await W();
  ok((await js(() => !!document.querySelector('main img.qr'))) && (await js(() => document.querySelector('[data-v="linepay"]').getAttribute('aria-expanded'))) === 'true', '點 LINE Pay 展開');
  await p.click('[data-act="payToggle"][data-v="bank"]'); await W();
  ok((await js(() => !!document.querySelector('#b-acct'))) && !(await js(() => !!document.querySelector('main img.qr'))), '點銀行轉帳：換展開銀行，LINE Pay 收起來');
  await p.click('[data-act="payToggle"][data-v="bank"]'); await W();
  ok(!(await js(() => !!document.querySelector('main .acc-b'))), '再點一次收合');
  await fresh('u3'); await go('#bank');
  rows = await js(() => Array.from(document.querySelectorAll('main .acc-h')).map(e => e.innerText.replace(/\s+/g, ' ')));
  ok(rows[0].includes('未設定') && rows[1].includes('已設定'), '林柏翰：銀行轉帳「未設定」、LINE Pay「已設定」');
  await p.click('[data-act="payToggle"][data-v="bank"]'); await W();
  await p.selectOption('#b-code', '700'); await p.fill('#b-acct', '12345678901'); await p.fill('#b-name', '林柏翰');
  await p.click('form[data-form="bank"] button[type="submit"]'); await W();
  ok((await js(() => document.querySelector('[data-v="bank"] .acc-s').textContent)) === '已設定・****8901' && !(await js(() => !!document.querySelector('main .acc-b'))), '儲存銀行轉帳後收合並顯示「已設定・****8901」');

  // 3. 付款給替身：點開哪一種就是選哪一種（t4：陳怡君兩種都有）
  await fresh('u1'); await go('#task-t4');
  await p.click('[data-act="confirmDone"]'); await W(); await okDlg();
  ok((await js(() => document.querySelectorAll('.card.next .pway-b').length)) === 2 && (await js(() => Array.from(document.querySelectorAll('.card.next .pway-b')).every(e => getComputedStyle(e).display === 'none'))), '付款卡兩種付款方式都收合，一眼看得到兩種');
  await p.click('label[for="pm-bank"]'); await W();
  ok((await js(() => document.querySelector('#pm-bank').checked)) && (await js(() => getComputedStyle(document.querySelector('#l5')).display)) !== 'none', '點「銀行轉帳」= 選了銀行轉帳，展開帳號和末五碼');
  await p.click('label[for="pm-linepay"]'); await W();
  ok((await js(() => document.querySelector('#pm-linepay').checked)) && (await js(() => getComputedStyle(document.querySelector('.card.next img.qr')).display)) !== 'none' && (await js(() => getComputedStyle(document.querySelector('#l5').closest('.pway-b')).display)) === 'none', '點「LINE Pay」= 改選 LINE Pay，銀行收起來');
  const shot = await p.locator('.card.next').screenshot({ path: path.join(OUT, 'paycard.png') });

  // D1. 替身退出後，舊留言清掉（t3：王小明是替身，開工前）
  await fresh('u1'); await go('#task-t3');
  await p.click('[data-act="withdrawAssign"]'); await W(); await okDlg();
  const t3 = (await st()).tasks.find(t => t.id === 't3');
  ok(t3.status === 'open' && t3.comments.length === 0, '替身退出後，留言清空，新的替身看不到');

  // D2. 發布前確認；D3. 草稿重新整理不會不見
  await fresh('u3'); await go('#post');
  await p.fill('#p-b', '第五宿舍'); await p.fill('#p-meet', '五舍大廳'); await p.fill('#p-budget', '260'); await p.fill('#p-note', '只有地板');
  await p.reload(); await W(400); await go('#post');
  ok((await js(() => [document.querySelector('#p-b').value, document.querySelector('#p-meet').value, document.querySelector('#p-budget').value, document.querySelector('#p-note').value].join('|'))) === '第五宿舍|五舍大廳|260|只有地板', '重新整理後，發案草稿還在');
  await act('pick', { id: 'u4' }); await go('#post');
  ok((await js(() => document.querySelector('#p-b').value)) === '', '換別的帳號看不到前一個人的草稿');
  await act('pick', { id: 'u3' }); await go('#post');
  ok((await js(() => document.querySelector('#p-b').value)) === '第五宿舍', '換回來草稿還在');
  const n0 = (await st()).tasks.length;
  await p.click('form[data-form="post"] button[type="submit"]'); await W();
  sh = await js(() => document.querySelector('.sheet').innerText);
  ok(sh.includes('確認發布？') && sh.includes('第五宿舍') && sh.includes('五舍大廳') && sh.includes('NT$ 260') && sh.includes('只有地板') && sh.includes('發布後不能修改，只能取消重發。'), '按發布先出現確認視窗，列出內容');
  ok((await st()).tasks.length === n0, '還沒確認不會發布');
  await p.click('.sheet [data-act="close"]'); await W();
  ok((await js(() => location.hash)) === '#post' && (await js(() => document.querySelector('#p-b').value)) === '第五宿舍', '「返回修改」回到表單，內容都在');
  await p.click('form[data-form="post"] button[type="submit"]'); await W(); await p.click('.sheet [data-act="postOk"]'); await W(300);
  ok((await st()).tasks.length === n0 + 1 && (await js(() => location.hash)).startsWith('#task-t'), '「確認發布」才發布');
  await go('#post');
  ok((await js(() => document.querySelector('#p-b').value)) === '', '發布後草稿清空');
  await p.reload(); await W(400); await go('#post');
  ok((await js(() => document.querySelector('#p-b').value)) === '', '重新整理也不會跑回舊草稿');

  // D4. 照片張數上限（t6：張書瑋，打掃中）
  await fresh('u4'); await go('#task-t6');
  await p.setInputFiles('#f-ph', files(13)); await W(1500);
  ok((await st()).tasks.find(t => t.id === 't6').photos.length === 12 && (await toastTxt()).includes('最多 12 張'), '打掃證明最多 12 張，多的會提醒');
  ok(!(await js(() => !!document.querySelector('#f-ph'))) && (await main()).includes('選填・12／12 張'), '滿了就沒有「加照片」，顯示 12／12 張');
  await p.setInputFiles('#cmt-f', files(14)); await W(1500);
  ok((await js(() => document.querySelectorAll('.cmt-pre img').length)) === 12 && (await toastTxt()).includes('留言照片每個案件最多 12 張'), '留言照片一次選太多會提醒');
  await fresh('u2'); await act('ff', { v: '1440' }); await go('#task-t6');
  await p.click('details.trouble summary'); await W(); await p.click('[data-act="openNotDone"]'); await W();
  await p.setInputFiles('#nd-f', files(8)); await W(1200);
  ok((await js(() => document.querySelectorAll('.sheet .ph img').length)) === 6 && !(await js(() => !!document.querySelector('#nd-f'))), '結束案件照片最多 6 張，滿了沒有「加照片」');
  ok(!(await js(() => document.querySelector('#nd-text').placeholder)), '原因欄不放「例如」範例字');
  await act('close');

  // D5. 姓名 30 天內只能改一次（林柏翰沒有銀行帳戶）
  await fresh('u3'); await go('#profile'); await p.click('[data-act="editProfile"]'); await W();
  ok((await main()).includes('姓名 30 天內只能改一次。'), '編輯資料寫「姓名 30 天內只能改一次」');
  await p.fill('#m-name', '林柏瀚'); await p.click('form[data-form="profile"] button[type="submit"]'); await W();
  ok((await st()).users.find(x => x.id === 'u3').name === '林柏瀚', '第一次改名成功');
  await p.click('[data-act="editProfile"]'); await W();
  await p.fill('#m-name', '林柏翰'); await p.click('form[data-form="profile"] button[type="submit"]'); await W();
  const fe = await js(() => (document.querySelector('.ferr') || {}).textContent || '');
  ok(/^姓名 30 天內只能改一次，\d+月\d+日（.）\d\d:\d\d 之後才能再改$/.test(fe), '30 天內再改 → 提示什麼時候能改：' + fe);
  await p.fill('#m-cls', '資工3A'); await p.fill('#m-name', '林柏瀚'); await p.click('form[data-form="profile"] button[type="submit"]'); await W();
  ok((await st()).users.find(x => x.id === 'u3').cls === '資工3A', '名字不變時，其他欄位照樣可以改');

  // D10. 登入時游標自動放進輸入框
  await fresh(); await p.click('header [data-act="login"]'); await W();
  ok((await js(() => document.activeElement && document.activeElement.id)) === 'lg-id', '登入視窗打開，游標在學號欄');
  await p.fill('#lg-id', 's19990001'); await p.click('form[data-form="loginEmail"] button[type="submit"]'); await W();
  ok((await js(() => document.activeElement && document.activeElement.id)) === 'lg-code', '寄出驗證碼後，游標在驗證碼欄');
  const code = await js(() => (document.querySelector('.sheet').innerText.match(/\b\d{6}\b/) || [])[0]);
  await p.fill('#lg-code', code); await W(300);
  ok((await js(() => document.activeElement && document.activeElement.id)) === 'lp-name', '驗證碼滿 6 碼自動送出，游標跳到姓名欄');
  await p.fill('#lp-name', '新同學'); await js(() => document.querySelector('form[data-form="loginProfile"] input[value="女"]').click());
  await p.click('form[data-form="loginProfile"] button[type="submit"]'); await W(300);

  // D12. 我的案件空白提示
  await go('#mine');
  ok((await main()).includes('你目前沒有當替身的案件'), '我是替身空白：「你目前沒有當替身的案件」');
  await p.click('[data-act="seg"][data-v="own"]'); await W();
  ok((await main()).includes('你目前沒有當本體的案件'), '我是本體空白：「你目前沒有當本體的案件」');

  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
