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

  // 2. 我是本體／我是替身
  await fresh('u1'); await go('#browse');
  ok((await main()).includes('我是本體') && !(await main()).includes('我發的'), '接案頁卡片標「我是本體」');
  await go('#mine'); const mm = await main();
  ok(mm.includes('我是替身') && mm.includes('我是本體') && !mm.includes('我接的') && !mm.includes('我發的'), '我的案件：切換和卡片標籤都改成我是替身／我是本體');
  await go('#past'); ok((await main()).includes('我是替身') && (await main()).includes('我是本體'), '過去的案件的篩選也改了');

  // 3. 收款方式頁：銀行轉帳＋LINE Pay
  await fresh('u4'); await go('#bank');
  let bk = await main();
  ok(bk.includes('銀行轉帳') && bk.includes('LINE Pay') && !bk.includes('現金'), '收款方式頁有銀行轉帳和 LINE Pay，沒有現金');
  await p.click('[data-act="payToggle"][data-v="linepay"]'); await W();
  ok((await main()).includes('上傳收款碼'), '展開 LINE Pay 可以上傳收款碼');
  await p.setInputFiles('#lp-f', { name: 'qr.png', mimeType: 'image/png', buffer: PNG }); await W(500);
  ok((await js(() => document.querySelector('[data-v="linepay"] .acc-s').textContent)) === '已設定' && !(await js(() => !!document.querySelector('main .acc-b'))), '上傳後收合，LINE Pay 顯示「已設定」');
  await p.click('[data-act="payToggle"][data-v="linepay"]'); await W();
  ok((await js(() => !!document.querySelector('main img.qr'))) && (await main()).includes('換一張收款碼'), '再展開看得到收款碼和「換一張收款碼」');
  await go('#me'); ok((await main()).includes('銀行轉帳 ****8123、LINE Pay'), '我的頁顯示兩種收款方式');
  await go('#bank'); await p.click('[data-act="payToggle"][data-v="bank"]'); await W(); await p.click('[data-act="removeBank"]'); await W();
  ok(!(await js(() => document.querySelector('.sheet p'))), '還有 LINE Pay 時，移除銀行轉帳不用額外警告');
  await okDlg(); ok((await st()).users.find(x => x.id === 'u4').bank === null, '銀行轉帳已移除');
  await go('#task-t1'); ok(await js(() => !!document.querySelector('[data-act="acceptPrice"]')), '只有 LINE Pay 也可以出價');
  await go('#bank'); await p.click('[data-act="payToggle"][data-v="linepay"]'); await W(); await p.click('[data-act="removeLinePay"]'); await W();
  ok((await js(() => document.querySelector('.sheet').innerText)).includes('移除後沒有任何收款方式'), '移除最後一種時會提醒');
  await okDlg(); await go('#task-t1'); ok(await js(() => !!document.querySelector('[data-act="setupPay"]')), '都沒有了 → 出價卡回到「設定收款方式」');
  await p.click('[data-act="setupPay"]'); await W(300); await p.click('[data-act="payToggle"][data-v="linepay"]'); await W();
  await p.setInputFiles('#lp-f', { name: 'qr.png', mimeType: 'image/png', buffer: PNG }); await W(700);
  ok((await js(() => location.hash)) === '#task-t1' && (await js(() => !!document.querySelector('[data-act="acceptPrice"]'))), '從案件去上傳 LINE Pay 收款碼，存好自動回到案件');

  // 付款：替身有兩種方式（t4：陳怡君有銀行轉帳和 LINE Pay）
  await fresh('u1'); await go('#task-t4');
  await p.click('[data-act="confirmDone"]'); await W(); await okDlg();
  let pc = await js(() => document.querySelector('.card.next').innerText);
  ok(pc.includes('銀行轉帳') && pc.includes('LINE Pay') && pc.includes('選一種付款方式') && (await js(() => !!document.querySelector('.card.next img.qr'))), '本體看到兩種收款方式，要選用哪一種付款');
  await p.click('form[data-form="pay"] button[type="submit"]'); await W();
  ok((await js(() => document.querySelector('.ferr').textContent)) === '請選擇付款方式', '沒選付款方式 → 提示');
  await js(() => document.querySelector('form[data-form="pay"] input[value="linepay"]').click()); await W();
  ok((await js(() => getComputedStyle(document.querySelector('#l5').closest('.pway-b')).display)) === 'none' && (await js(() => getComputedStyle(document.querySelector('.card.next img.qr').closest('.pway-b')).display)) !== 'none', '選 LINE Pay：展開收款碼，不用填末五碼');
  await js(() => document.querySelector('form[data-form="pay"] input[value="bank"]').click()); await W();
  ok((await js(() => getComputedStyle(document.querySelector('#l5').closest('.pway-b')).display)) !== 'none' && (await js(() => getComputedStyle(document.querySelector('.card.next img.qr').closest('.pway-b')).display)) === 'none', '選銀行轉帳：展開帳號和末五碼，收款碼收起來');
  await p.click('form[data-form="pay"] button[type="submit"]'); await W();
  ok((await js(() => document.querySelector('.ferr').textContent)) === '請輸入 5 位數字', '沒填末五碼 → 提示');
  await js(() => document.querySelector('form[data-form="pay"] input[value="linepay"]').click());
  await p.click('form[data-form="pay"] button[type="submit"]'); await W();
  const t4 = (await st()).tasks.find(t => t.id === 't4');
  ok(t4.status === 'paid' && t4.payment.method === 'LINE Pay', '用 LINE Pay 付款完成');
  await act('pick', { id: 'u2' }); await W();
  ok((await js(() => document.querySelector('.card.next').innerText)).includes('本體表示已用 LINE Pay 付款'), '替身看到「本體表示已用 LINE Pay 付款」');
  await p.click('[data-act="received"]'); await W(); await okDlg();
  ok((await main()).includes('案件已完成（用 LINE Pay 付款）。'), '完成後顯示「用 LINE Pay 付款」');

  // 付款：替身只有 LINE Pay（t8：林柏翰）
  await fresh('u1'); await go('#task-t8');
  pc = await js(() => document.querySelector('.card.next').innerText);
  ok(!pc.includes('選一種付款方式') && !(await js(() => !!document.querySelector('#l5'))) && (await js(() => !!document.querySelector('.card.next img.qr'))), '替身只有 LINE Pay：直接顯示收款碼，不用選、不用填末五碼');
  await p.click('form[data-form="pay"] button[type="submit"]'); await W();
  ok((await st()).tasks.find(t => t.id === 't8').payment.method === 'LINE Pay', '按「我已付款」完成');

  // 1. 刪掉「從學校信箱取得，不能修改。」
  await fresh('u1'); await go('#me'); await p.click('[data-act="editProfile"]');  /* 「我的」個人資料旁的「編輯」直接進入編輯 */ await W();
  ok(!(await main()).includes('不能修改'), '編輯資料沒有「從學校信箱取得，不能修改」');
  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
