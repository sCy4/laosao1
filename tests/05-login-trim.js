const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const B = 'file://' + path.resolve(__dirname, '..', 'index.html');
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
  const fresh = async () => { await p.goto('about:blank'); await p.goto(B + '#browse'); await js(() => { localStorage.clear(); localStorage.setItem('swaptime-intro-v1', '1'); }); await p.reload(); await W(300); };
  const ferr = () => js(() => { const e = document.querySelector('.ferr'); return e ? e.textContent : ''; });

  // 1. 「我的」分頁從下一層頁面回到我的
  await fresh(); await act('pick', { id: 'u1' }); await go('#me');
  await p.click('[data-act="bankPage"]'); await W(300);
  await p.click('nav.tabs [data-v="me"]'); await W(300);
  ok((await js(() => location.hash)) === '#me' && (await main()).includes('過去的案件'), '在收款方式頁按「我的」→ 回到我的');
  await p.click('[data-act="past"]'); await W(300); await p.click('nav.tabs [data-v="me"]'); await W(300);
  ok((await js(() => location.hash)) === '#me', '在過去的案件頁按「我的」→ 回到我的');

  // 2. 學校信箱登入：新帳號
  await fresh(); await p.click('header [data-act="login"]'); await W();
  const sh = await js(() => document.querySelector('.sheet').innerText);
  ok(sh.includes('學校信箱') && sh.includes('@thu.edu.tw') && !(await js(() => !!document.querySelector('.sheet [data-act="pick"]'))), '登入視窗只有學校信箱，沒有帳號清單');
  await p.fill('#lg-id', 'abc'); await p.click('form[data-form="loginEmail"] button[type="submit"]'); await W();
  ok((await ferr()) === '請輸入學號，例如 s15330124', '信箱格式不對 → 欄位下方提示');
  await p.fill('#lg-id', 'S15330124@thu.edu.tw'); await p.click('form[data-form="loginEmail"] button[type="submit"]'); await W();
  ok((await js(() => document.querySelector('.sheet').innerText)).includes('s15330124@thu.edu.tw'), '貼上整個信箱也可以，驗證碼寄到 s15330124@thu.edu.tw');
  const code = await js(() => document.querySelector('.sheet .banner b').textContent);
  await p.fill('#lg-code', '000000'); await W();
  ok((await ferr()) === '驗證碼不對，請再確認一次', '驗證碼錯誤 → 提示');
  await p.fill('#lg-code', code); await W();
  const prof = await js(() => document.querySelector('.sheet').innerText);
  ok(prof.includes('第一次登入') && prof.includes('S15330124') && !prof.includes('不能修改'), '新帳號：顯示學號（已鎖定），請填基本資料');
  await p.click('form[data-form="loginProfile"] button[type="submit"]'); await W();
  ok((await ferr()) === '請填姓名', '沒填姓名 → 提示');
  await p.fill('#lp-name', '蘇同學'); await js(() => document.getElementById('lp-g1').click()); await p.fill('#lp-cls', '資工3a');
  await p.click('form[data-form="loginProfile"] button[type="submit"]'); await W();
  const st = await js(() => JSON.parse(localStorage.getItem('swaptime-proto-v1')));
  const me = st.users.find(x => x.id === st.me);
  ok(me && me.name === '蘇同學' && me.sid === 'S15330124' && me.email === 's15330124@thu.edu.tw' && me.gender === '女' && me.cls === '資工3A', '建立帳號並登入：' + JSON.stringify(me && [me.name, me.sid, me.email, me.gender, me.cls]));
  await go('#me'); await p.click('[data-act="editProfile"]');  /* 「我的」個人資料旁的「編輯」直接進入編輯 */ await W();
  ok(!(await js(() => !!document.querySelector('#m-sid'))) && (await main()).includes('S15330124') && !(await main()).includes('不能修改'), '編輯資料時學號不能改（沒有多餘說明）');

  // 3. 學校信箱登入：已有帳號、驗證碼過期
  await fresh(); await p.click('header [data-act="login"]'); await W();
  await p.fill('#lg-id', 's11330422'); await p.click('form[data-form="loginEmail"] button[type="submit"]'); await W();
  await js(() => { const s = JSON.parse(localStorage.getItem('swaptime-proto-v1')); }); 
  const c2 = await js(() => document.querySelector('.sheet .banner b').textContent);
  await p.fill('#lg-code', c2); await W();
  ok((await js(() => { const s = JSON.parse(localStorage.getItem('swaptime-proto-v1')); return s.users.find(x => x.id === s.me).name; })) === '陳怡君', '已有帳號（陳怡君）直接登入');
  await act('logout'); await p.click('header [data-act="login"]'); await W();
  await p.fill('#lg-id', 's11330422'); await p.click('form[data-form="loginEmail"] button[type="submit"]'); await W();
  const c3 = await js(() => document.querySelector('.sheet .banner b').textContent);
  await js(() => { const el = document.createElement('button'); el.dataset.act = 'ff'; el.dataset.v = '30'; document.body.appendChild(el); el.click(); el.remove(); }); await W();
  await p.fill('#lg-code', c3); await W();
  ok((await ferr()) === '驗證碼已過期，請按「重新寄送」', '超過 10 分鐘 → 驗證碼過期');
  await p.click('[data-act="loginResend"]'); await W();
  const c4 = await js(() => document.querySelector('.sheet .banner b').textContent);
  await p.fill('#lg-code', c4); await W();
  ok((await js(() => JSON.parse(localStorage.getItem('swaptime-proto-v1')).me)) === 'u2', '重新寄送後登入成功');

  // 4. 發案頁精簡
  await go('#post');
  const post = await js(() => document.querySelector('form[data-form="post"]').innerText + '|' + Array.from(document.querySelectorAll('form[data-form="post"] [placeholder]')).map(e => e.placeholder).join(','));
  ok(!post.includes('例如') && !post.includes('所有人都看得到') && !post.includes('會顯示在案件卡片上') && !post.includes('開工前都可以取消') && post.includes('不填＝替身自由出價') && post.includes('等有人接受你的標價或自行出價後，你再從中選擇你的替身。'), '發案頁只剩必要說明');
  // 5. 其他精簡抽查
  await go('#me'); const mm = await main();
  ok(!mm.includes('也可以在這裡標記合作過的人') && !mm.includes('你收藏的案件'), '我的頁的說明字變短');
  ok(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
