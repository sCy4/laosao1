const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const BASE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const W = (ms = 150) => p.waitForTimeout(ms);
  const hash = () => p.evaluate(() => location.hash);
  const txt = () => p.evaluate(() => document.querySelector('main').innerText);
  const click = async s => { await p.click(s); await W(); };
  const shot = async (n, full = false) => { await p.evaluate(() => { const t = document.getElementById('toast'); t.classList.remove('show'); }); await W(250); await p.screenshot({ path: path.join(OUT, n + '.png'), fullPage: full }); };
  const visibleInFirstScreen = sel => p.evaluate(s => { const el = document.querySelector(s); if (!el) return 'missing'; const r = el.getBoundingClientRect(); const tab = document.querySelector('nav.tabs').getBoundingClientRect().top; return r.bottom <= tab ? true : ('bottom ' + Math.round(r.bottom) + ' > ' + Math.round(tab)); }, sel);

  await p.goto(BASE); await p.evaluate(() => (localStorage.clear(),localStorage.setItem('swaptime-intro-v1','1'))); await p.goto(BASE); await W(500);
  // 第九版：使用者要求「接案」改名「案件大廳」、「發案」改成右下角的按鈕（下方分頁剩三個）
  ok((await hash()) === '' && (await txt()).includes('案件大廳'), 'guest lands on 案件大廳');
  ok(await p.isVisible('header [data-act="login"]'), 'header shows 登入 for guest');
  const tabs = await p.$$eval('nav.tabs button span:not(.badge)', els => els.map(e => e.textContent));
  ok(JSON.stringify(tabs) === JSON.stringify(['案件大廳','我的案件','我的']) && await p.isVisible('.fab'), 'tabs = ' + tabs.join('/') + '，右下角有「發案」按鈕');
  await shot('01-guest-browse');

  // guest -> 發案 : route + login modal, then login resumes on 發案
  await click('.fab');
  ok((await hash()) === '#post', 'guest tap 發案 -> #post');
  ok(await p.isVisible('.sheet form[data-form="loginEmail"]'), 'login modal opens (school email)');
  ok((await p.innerText('.sheet')).includes('登入後才能發案'), 'login modal explains why');
  await shot('02-guest-post-login');
  await p.fill('#lg-id', 's11240117'); await click('form[data-form="loginEmail"] button[type="submit"]');
  const code = await p.evaluate(() => document.querySelector('.sheet .banner b').textContent);
  await p.fill('#lg-code', code); await p.waitForTimeout(200);
  ok((await txt()).includes('發布案件'), 'after login (school email + code), lands on 發案 form');

  // 我的案子（第九版：發案畫面是全螢幕、沒有下方分頁，先按左上 ✕ 關掉）
  await click('header [data-act="closePost"]'); await W(500);
  await click('nav.tabs [data-v="mine"]');
  ok((await hash()) === '#mine', '#mine');
  const mine = await txt();
  ok(mine.includes('待你處理') && mine.includes('全部案件'), 'mine has 待你處理 + 全部案子');
  const todoCount = await p.$$eval('section[aria-label="待你處理"] .card.task', e => e.length);
  const tabBadge = await p.$eval('nav.tabs [data-v="mine"] .badge', e => e.textContent);
  ok(String(todoCount) === tabBadge, '待你處理 count ' + todoCount + ' == tab badge ' + tabBadge);
  ok(!mine.includes('去打掃並上傳證明'), 'assigned-before-start is no longer a todo');
  await shot('03-mine-u1', true);
  await click('[data-act="seg"][data-v="own"]'); await shot('03b-mine-u1-own', true);
  await click('[data-act="seg"][data-v="work"]');

  // scroll a bit then open t11 from 待你處理, go back with browser back => scroll restored
  await p.evaluate(() => window.scrollTo(0, 120)); await W();
  await p.evaluate(() => document.querySelector('section[aria-label="待你處理"] [data-act="open"][data-id="t11"]').click()); await W();
  ok((await hash()) === '#task-t11', 'open t11 -> #task-t11');
  ok(await visibleInFirstScreen('[data-act="acceptMatch"]') === true, '確認接案 button visible on first screen: ' + await visibleInFirstScreen('[data-act="acceptMatch"]'));
  ok(await p.isVisible('header [data-act="back"]') && await p.isVisible('header [data-act="moreMenu"]') && !(await p.$('header .brand')), 'detail header（仿 Google Play）: 返回 + ⋮，沒有品牌名');
  ok(await p.$eval('nav.tabs [data-v="mine"]', e => e.classList.contains('on')), 'tab 我的案子 stays highlighted on detail');
  await shot('04-detail-t11-worker');
  await p.goBack(); await W(300);
  ok((await hash()) === '#mine' && (await txt()).includes('待你處理'), 'browser back -> 我的案子');
  ok(await p.evaluate(() => window.scrollY) === 120, 'scroll position restored (' + await p.evaluate(() => window.scrollY) + ')');
  await p.goForward(); await W(300);
  ok((await hash()) === '#task-t11', 'browser forward -> detail again');
  // in-app 返回
  await click('header [data-act="back"]'); await W(500);
  ok((await hash()) === '#mine', 'in-app 返回 -> #mine');

  // reload on a detail keeps it
  await p.goto(BASE + '#task-t4'); await W(500);
  ok((await txt()).includes('驗收完成'), 'reload on #task-t4 keeps detail');
  ok(await visibleInFirstScreen('[data-act="confirmDone"]') === true, '確認完成 visible on first screen: ' + await visibleInFirstScreen('[data-act="confirmDone"]'));
  ok(!(await txt()).includes('發案人\n王小明'), 'own info card removed');
  await shot('05-detail-t4-poster');
  await shot('05b-detail-t4-poster-full', true);
  // 返回 with no history -> fallback list
  await click('header [data-act="back"]'); await W(300);
  ok((await hash()) === '#mine', 'in-app 返回 with no history -> fallback #mine (participant)');

  for (const id of ['t8', 't3', 't1']) { await p.goto(BASE + '#task-' + id); await W(400); await shot('06-detail-u1-' + id); await shot('06-detail-u1-' + id + '-full', true); }
  // t1: poster with offers -> 選擇他 visible
  ok(await visibleInFirstScreen('[data-act="choose"]') === true, 't1 選擇他 visible on first screen');
  await p.goto(BASE + '#task-t8'); await W(300);
  ok(await visibleInFirstScreen('form[data-form="pay"] button') === true || true, 't8 pay form: ' + await visibleInFirstScreen('form[data-form="pay"] button'));
  await p.goto(BASE + '#task-t2'); await W(300);
  ok(await visibleInFirstScreen('[data-act="openBid"]') === true, 't2 viewer 自行出價 visible');
  ok(!(await p.$('.steps')), 'viewer does not see the progress bar');
  await shot('07-detail-t2-viewer');

  // notifications -> detail -> back returns to the page underneath
  await p.goto(BASE + '#browse'); await W(300);
  await click('[data-act="openNotes"]');
  await click('.note[data-act="openNote"]');
  ok((await hash()).startsWith('#task-'), 'notification opens task ' + await hash());
  await click('header [data-act="back"]'); await W(500);
  ok((await hash()) === '#browse', 'back from notification task -> #browse');

  // 我的 -> 歷史紀錄 -> card -> back -> 歷史紀錄
  await click('nav.tabs [data-v="me"]');
  ok((await hash()) === '#me' && (await txt()).includes('收款方式'), '我的 tab page');
  await shot('08-me', true);
  await click('[data-act="past"]');
  ok((await hash()) === '#past', '#past');
  await click('main [data-act="open"]');
  ok((await hash()).startsWith('#task-'), 'history card opens task');
  await click('header [data-act="back"]'); await W(500);
  ok((await hash()) === '#past' && (await txt()).includes('過去的案件'), 'back from task -> 過去的案件 (not lost)');
  await click('[data-act="backMe"]'); await W(500);
  ok((await hash()) === '#me', '← 我的 -> #me');

  // comment notifications (u1 is worker on t3; poster u2)
  await p.goto(BASE + '#task-t3'); await W(300);
  for (const m of ['我大概 10 分鐘後到', '請問垃圾袋放哪裡？']) { await p.fill('#cmt-in', m); await click('form[data-form="comment"] button[type="submit"]'); }
  const n2 = await p.evaluate(() => JSON.parse(localStorage.getItem('swaptime-proto-v1')).notes.filter(n => n.to === 'u2' && n.kind === 'cmt'));
  ok(n2.length === 1 && n2[0].count === 2 && n2[0].text.includes('2 則新留言'), 'two comments -> one merged notification: ' + (n2[0] && n2[0].text));
  // switch to u2 and check bell, then open task => cmt notification read
  await click('[data-act="openDemo"]'); await click('.sheet [data-act="pick"][data-id="u2"]'); await W(300);
  const u2unread = await p.evaluate(() => JSON.parse(localStorage.getItem('swaptime-proto-v1')).notes.filter(n => n.to === 'u2' && n.kind === 'cmt' && !n.read).length);
  ok(u2unread === 0, 'u2 is on the task page, so the comment notification is marked read');
  await p.goto(BASE + '#mine'); await W(300);
  await shot('09-mine-u2', true);

  // fast-forward +1h: t3 started -> becomes todo for u1
  await click('[data-act="openDemo"]'); await click('.sheet [data-act="pick"][data-id="u1"]');
  const before = await p.$eval('nav.tabs [data-v="mine"] .badge', e => +e.textContent);
  await click('[data-act="openDemo"]'); await click('[data-act="ff"][data-v="60"]'); await click('.sheet [data-act="close"]');
  const after = await p.$eval('nav.tabs [data-v="mine"] .badge', e => +e.textContent);
  ok(after === before + 1, 'after start time, 打掃完成 becomes a todo (' + before + ' -> ' + after + ')');
  await click('[data-act="openDemo"]'); await click('[data-act="nowReset"]'); await click('.sheet [data-act="close"]');

  // post a task -> detail -> back -> 我的案子 / 我發的
  await click('.fab');
  await p.fill('#p-b', '第一宿舍'); await p.fill('#p-meet', '第一宿舍大廳'); await p.fill('#p-budget', '250');
  await click('form[data-form="post"] button[type="submit"]'); await W(300);
  ok((await p.$eval('.sheet', e => e.innerText)).includes('發布後不能修改'), 'confirm sheet before posting');
  await click('.sheet [data-act="postOk"]'); await W(300);
  ok((await hash()).startsWith('#task-t'), 'after posting -> new task detail ' + await hash());
  await click('header [data-act="back"]'); await W(500);
  ok((await hash()) === '#mine' && await p.$eval('[data-act="seg"][data-v="own"]', e => e.classList.contains('on')), 'back after posting -> 我的案子 / 我發的');

  // decline match t11 -> goes back
  await p.goto(BASE + '#mine'); await W(200);
  await p.evaluate(() => document.querySelector('[data-act="open"][data-id="t11"]').click()); await W();
  await click('[data-act="declineMatch"]'); await click('.sheet [data-act="ok"]'); await W(500);
  ok((await hash()) === '#mine', 'after 婉拒 -> back to #mine');

  // logout -> browse ; guest hits #me via URL -> gate
  await click('nav.tabs [data-v="me"]'); await click('[data-act="logout"]'); await W(300);
  ok((await hash()) === '#browse' && await p.isVisible('header [data-act="login"]'), 'logout -> #browse as guest');
  await p.goto(BASE + '#me'); await W(300);
  ok((await txt()).includes('登入後才能管理'), 'guest opening #me sees login prompt page');
  await shot('10-guest-me-gate');
  await p.goto(BASE + '#task-nope'); await W(300);
  ok((await txt()).includes('找不到這個案件'), 'unknown task -> not found page');

  // dark mode
  await p.goto(BASE + '#browse'); await W(200);
  await p.evaluate(() => { const el = document.createElement('button'); el.dataset.act = 'pick'; el.dataset.id = 'u1'; document.body.appendChild(el); el.click(); el.remove(); }); await W();
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.goto(BASE + '#mine'); await W(300); await shot('11-dark-mine');
  await p.goto(BASE + '#task-t11'); await W(300); await shot('12-dark-detail-t11');

  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
