const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const BASE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const BANNED = ['發案人','接案人','媒合','案子','價碼','完成證明','結案','歷史紀錄','交換時間','執行時間','進行中','交付中','等待收款','自己出價','接受此價','選擇他','標記他','報價','找替身','已開始','上午','下午','日曆找','收款帳戶'];
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const W = (ms = 120) => p.waitForTimeout(ms);
  const js = (f, a) => p.evaluate(f, a);
  const act = async (act, extra = {}) => { await js(([a, x]) => { const el = document.createElement('button'); el.dataset.act = a; Object.assign(el.dataset, x); document.body.appendChild(el); el.click(); el.remove(); }, [act, extra]); await W(); };
  const pageText = () => js(() => document.body.innerText + ' ' + Array.from(document.querySelectorAll('[aria-label],[placeholder],title')).map(e => (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('placeholder') || '') + ' ' + (e.textContent || '')).join(' '));
  const seen = {};
  const scan = async where => { const t = await pageText(); for (const w of BANNED) if (t.includes(w)) (seen[w] = seen[w] || []).push(where); };
  await p.goto(BASE); await js(() => (localStorage.clear(),localStorage.setItem('swaptime-intro-v1','1'))); await p.goto(BASE); await W(400);
  await scan('guest browse');
  await act('login'); await scan('login modal'); await act('close');
  ok((await js(() => document.title)) === '替身掃者' && (await js(() => document.querySelector('.brand').textContent)) === '替身掃者', 'title + brand = 替身掃者');
  for (const uid of ['u1','u2','u3','u4']) {
    await act('pick', { id: uid });
    for (const h of ['#browse','#post','#mine','#me','#profile','#bank','#favs','#history','#cancelled','#tags']) {
      await js(h => { location.hash = h; }, h); await W(150); await scan(uid + ' ' + h);
      if (h === '#mine') { await act('seg', { k: 'mineRole', v: 'own' }); await scan(uid + ' mine/own'); await act('seg', { k: 'mineRole', v: 'work' }); }
    }
    for (const id of ['t1','t2','t3','t4','t5','t6','t7','t8','t9','t10','t11']) { await js(h => { location.hash = h; }, '#task-' + id); await W(150); await scan(uid + ' ' + id); }
    await act('openNotes'); await scan(uid + ' notes'); await act('close');
    for (const m of ['openSort','openFilter','openBcal']) { await js(() => { location.hash = '#browse'; }); await W(100); await act(m); await scan(uid + ' ' + m); await act('close'); }
  }
  ok(Object.keys(seen).length === 0, 'no old terms on any screen ' + JSON.stringify(seen).slice(0, 600));

  // 指定的長句與確認視窗
  await act('pick', { id: 'u1' }); await js(() => { location.hash = '#task-t1'; }); await W(200);
  await js(() => document.querySelector('[data-act="choose"][data-oid="o1"]').click()); await W();
  const dlg = await js(() => document.querySelector('.sheet').innerText);
  ok(dlg.startsWith('選擇陳怡君作為你的替身（NT$ 420）？') && !(await js(() => !!document.querySelector('.sheet p'))), 'choose dialog: title only → ' + dlg.split('\n')[0]);
  await js(() => document.querySelector('.sheet [data-act="ok"]').click()); await W();
  const pt = await js(() => document.querySelector('.card.next').innerText);
  // 使用者同意把長句拆開：期限一行（「確認期限 … 前（還剩 …）」），誰要確認、逾時和改選規則放下面小字
  // 第七版：使用者取消「選中後 24 小時沒確認就自動撤銷」，確認期限就是開工前；標題改成「等替身確認接案」，灰框裡的價格叫「出價」（還沒成交）
  ok(/^待替身確認接案/.test(pt) && /NT\$ 420/.test(pt) && !/出價|成交價|確認期限/.test(pt) && /你在 1 小時後可以重新選擇替身（還剩 \d+ (分鐘|小時)）。/.test(pt) && /重新選擇替身$/.test(pt.trim()), 'poster pending: ' + pt.replace(/\n/g, ' | '));
  await act('pick', { id: 'u2' }); await W();
  const wt = await js(() => document.querySelector('.card.next').innerText);
  ok(/本體選了你！/.test(wt) && /你的出價\s*NT\$ 420/.test(wt) && /確認期限\s*開工前（還剩 \d+ (小時|天)）/.test(wt) && /開工時還沒確認，案件會自動取消。本體 1 小時後可以重新選擇替身（還剩 \d+ (分鐘|小時)）。/.test(wt), 'worker pending: ' + wt.replace(/\n/g, ' | '));
  await act('openDemo'); await act('ff', { v: '60' }); await act('close');
  ok((await js(() => document.querySelector('.card.next').innerText)).includes('本體現在可以重新選擇替身了。'), 'after 1h: 本體現在可以重新選擇替身了');
  await act('pick', { id: 'u1' }); await W();
  await js(() => document.querySelector('[data-act="unchoose"]').click()); await W();
  const un = await js(() => document.querySelector('.sheet').innerText);
  ok(un.includes('重新選擇替身？') && un.includes('這次選擇會作廢並通知陳怡君，對方的出價仍會保留。'), 'unchoose dialog: ' + un.replace(/\n/g, ' | '));
  await act('close');
  // 確認已收款視窗 (u3 is 替身 on t8 confirmed; pay as u1 first)
  await js(() => { location.hash = '#task-t8'; }); await W(200);
  await js(() => document.querySelector('form[data-form="pay"] button').click()); await W();
  await act('pick', { id: 'u3' }); await W();
  await js(() => document.querySelector('[data-act="received"]').click()); await W();
  const rc = await js(() => document.querySelector('.sheet').innerText);
  ok(rc.includes('確認已收款？') && rc.includes('確認後案件就完成了。'), 'received dialog: ' + rc.replace(/\n/g, ' | '));
  await js(() => document.querySelector('.sheet [data-act="ok"]').click()); await W();
  ok((await js(() => document.querySelector('main').innerText)).includes('案件已完成'), 'after received: 案件已完成');
  // stepper + notifications format
  await js(() => { location.hash = '#task-t3'; }); await act('pick', { id: 'u1' }); await W(200);
  ok((await js(() => document.querySelector('.steps').innerText.replace(/\n/g, '/'))) === '召喚替身/打掃/驗收/付款/完成', 'stepper = 召喚替身/打掃/驗收/付款/完成');
  await act('openNotes');
  const n1 = await js(() => Array.from(document.querySelectorAll('.note')).map(n => n.innerText.replace(/\n/g, ' | ')));
  ok(n1.length > 0 && n1.every(x => x.split(' | ').length === 3), 'notes: text | 案件 | 時間 → ' + n1.slice(0, 3).join(' ;; '));
  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
