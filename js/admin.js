(function () {
  const { money, esc, minPrice } = window.CH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  const STATUSES = [['new', 'Новый'], ['accepted', 'Принят'], ['cooking', 'Готовится'], ['delivery', 'В пути'], ['done', 'Доставлен'], ['canceled', 'Отменён']];
  const stName = (s) => (STATUSES.find(x => x[0] === s) || [s, s])[1];

  let doc = null, orders = [], knownIds = null, filter = 'active', menuCat = 'all', menuQ = '', orderQ = '', period = 'today';
  const NEXT = { new: 'accepted', accepted: 'cooking', cooking: 'delivery', delivery: 'done' };

  // ================= Старт =================
  (async function init() {
    try { await Store.init(); } catch (e) { toast('Не удалось подключиться к базе: ' + e.message, true); }
    $('#emailField').hidden = !Store.needsEmail();
    $('#loginHint').textContent = 'Вход только для администратора';
    const s = await Store.session().catch(() => null);
    $('#loading').hidden = true;
    if (s) enter(); else $('#login').hidden = false;
  })();

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginErr').textContent = '';
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
    try { await Store.login($('#l-email').value.trim(), $('#l-pass').value); $('#login').hidden = true; enter(); }
    catch (err) { await new Promise(r => setTimeout(r, 700)); $('#loginErr').textContent = err.message; $('#l-pass').select(); }
    btn.disabled = false;
  });
  $('#eyeBtn').addEventListener('click', () => { const i = $('#l-pass'); i.type = i.type === 'password' ? 'text' : 'password'; i.focus(); });

  $('#logoutBtn').addEventListener('click', async () => { await Store.logout(); location.reload(); });

  async function enter() {
    $('#app').hidden = false;
    $('#demoBanner').hidden = Store.mode !== 'demo';
    const r = await Store.getSite();
    doc = r.doc;
    if (Store.mode === 'supabase' && !r.exists && !r.error) {
      try { await Store.saveSite(doc); toast('Стандартное меню загружено в базу'); } catch (e) { toast(errText(e), true); }
    }
    renderMenu(); renderPromos(); fillSettings();
    await loadOrders();
    Store.onNewOrder(() => loadOrders());
    setInterval(loadOrders, 30000);
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  }

  function errText(e) {
    const m = (e && e.message) || String(e);
    if (/row-level security|permission|42501/i.test(m)) return 'Нет прав. Добавьте ваш email в таблицу admins (см. README).';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Нет связи с базой. Проверьте интернет.';
    return 'Ошибка: ' + m;
  }

  async function persist(msg) {
    try { await Store.saveSite(doc); toast(msg || 'Сохранено ✓'); return true; }
    catch (e) { toast(errText(e), true); return false; }
  }

  // ================= Вкладки =================
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    $$('#tabs button').forEach(x => x.classList.toggle('on', x === b));
    $$('.tab').forEach(t => t.hidden = t.id !== 'tab-' + b.dataset.tab);
    if (b.dataset.tab === 'orders') { $('#newDot').hidden = true; loadOrders(); }
    if (b.dataset.tab === 'report') loadOrders().then(renderReport);
    window.scrollTo(0, 0);
  });

  // ================= Заказы =================
  async function loadOrders() {
    try { orders = await Store.listOrders(); }
    catch (e) { $('#orders').innerHTML = `<div class="empty">${esc(errText(e))}</div>`; return; }
    const ids = new Set(orders.map(o => String(o.id)));
    if (knownIds) {
      const fresh = orders.filter(o => !knownIds.has(String(o.id)) && o.status === 'new');
      if (fresh.length) notifyNew(fresh[0]);
    }
    knownIds = ids;
    renderOrders();
    if (!$('#tab-report').hidden) renderReport();
  }

  function notifyNew(o) {
    beep();
    toast(`Новый заказ №${o.code || ''} на ${money(o.total)}`);
    if ($('#tab-orders').hidden) $('#newDot').hidden = false;
    document.title = '🔔 Новый заказ · Chicken Hot';
    setTimeout(() => (document.title = 'Админ-панель · Chicken Hot'), 8000);
    try { if (Notification.permission === 'granted') new Notification('Chicken Hot: новый заказ', { body: `${o.name || ''} — ${money(o.total)}`, icon: 'img/logo.png' }); } catch (e) {}
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18, 0.36].forEach((t, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = [880, 1100, 1320][i]; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.2, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.16);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.17);
      });
    } catch (e) {}
  }

  function renderOrders() {
    const today = new Date().toDateString();
    const todays = orders.filter(o => new Date(o.created_at).toDateString() === today && o.status !== 'canceled');
    const fresh = orders.filter(o => o.status === 'new').length;
    $('#stats').innerHTML = `
      <div class="stat"><b>${fresh}</b><span>новых</span></div>
      <div class="stat"><b>${todays.length}</b><span>заказов сегодня</span></div>
      <div class="stat"><b>${money(todays.reduce((s, o) => s + (+o.total || 0), 0))}</b><span>сумма за сегодня</span></div>`;

    const active = (o) => !['done', 'canceled'].includes(o.status);
    const groups = [['active', 'В работе', active], ['all', 'Все', () => true], ...STATUSES.map(([k, n]) => [k, n, (o) => o.status === k])];
    $('#orderFilter').innerHTML = groups.map(([k, n, f]) => `<button class="chip ${filter === k ? 'on' : ''}" data-f="${k}">${n}<b>${orders.filter(f).length}</b></button>`).join('');
    const fn = (groups.find(g => g[0] === filter) || groups[0])[2];
    const q = orderQ.toLowerCase(), qd = orderQ.replace(/\D/g, '');
    const match = (o) => !q || [o.name, o.address, o.code, o.comment].some(x => String(x || '').toLowerCase().includes(q))
      || (qd.length >= 3 && String(o.phone || '').replace(/\D/g, '').includes(qd));
    const list = orders.filter(fn).filter(match);

    $('#orders').innerHTML = list.length ? list.map(orderCard).join('')
      : `<div class="empty">${orders.length ? 'Здесь пока пусто' : 'Заказов пока нет. Они появятся здесь, когда клиенты оформят заказ на сайте.'}</div>`;
  }

  function orderCard(o) {
    const d = new Date(o.created_at);
    const time = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    let digits = String(o.phone || '').replace(/\D/g, ''); if (digits.startsWith('8')) digits = '7' + digits.slice(1);
    const items = Array.isArray(o.items) ? o.items : [];
    return `<article class="order st-${esc(o.status)}">
      <div class="o-head"><b>№${esc(o.code || o.id)}</b><time>${time}</time>
        <select class="st-select" data-status="${esc(o.id)}">${STATUSES.map(([k, n]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="o-cust">${esc(o.name)} · <a href="tel:+${digits}">${esc(o.phone)}</a></div>
      <div class="o-meta">
        <span>📍 ${esc(o.address)}</span>
        <span>💳 ${esc(o.payment)}${o.promo ? ` · 🏷 промокод <b>${esc(o.promo)}</b>` : ''}</span>
        ${o.comment ? `<span>💬 ${esc(o.comment)}</span>` : ''}
      </div>
      <div class="o-items">${items.map(i => `<div><span>${esc(i.name)}${i.variant ? ' (' + esc(i.variant) + ')' : ''} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}</div>
      <div class="o-total"><span>${money(o.total)}</span>
        <span class="o-actions">
          ${NEXT[o.status] ? `<button class="btn sm next-btn" data-next="${esc(o.id)}">→ ${stName(NEXT[o.status])}</button>` : ''}
          <a class="btn btn-ghost sm" href="https://wa.me/${digits}" target="_blank" rel="noopener">WhatsApp</a>
          <button class="icon-btn" data-copy-order="${esc(o.id)}" title="Скопировать заказ">⧉</button>
          <button class="icon-btn red" data-del-order="${esc(o.id)}" title="Удалить">🗑</button>
        </span></div>
    </article>`;
  }

  $('#orderFilter').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; renderOrders(); } });
  $('#refreshOrders').addEventListener('click', () => loadOrders().then(() => toast('Обновлено')));
  $('#orderSearch').addEventListener('input', (e) => { orderQ = e.target.value.trim(); renderOrders(); });
  async function setStatus(o, st) {
    try { await Store.updateOrder(o.id, { status: st }); o.status = st; renderOrders(); toast('Статус: ' + stName(st)); }
    catch (err) { toast(errText(err), true); }
  }
  $('#orders').addEventListener('change', async (e) => {
    const s = e.target.closest('[data-status]'); if (!s) return;
    const o = orders.find(x => String(x.id) === s.dataset.status); if (o) setStatus(o, s.value);
  });
  $('#orders').addEventListener('click', async (e) => {
    const nx = e.target.closest('[data-next]');
    if (nx) { const o = orders.find(x => String(x.id) === nx.dataset.next); if (o && NEXT[o.status]) setStatus(o, NEXT[o.status]); return; }
    const cp = e.target.closest('[data-copy-order]');
    if (cp) { const o = orders.find(x => String(x.id) === cp.dataset.copyOrder); if (o) copyText(orderText(o)); return; }
    const b = e.target.closest('[data-del-order]'); if (!b) return;
    const o = orders.find(x => String(x.id) === b.dataset.delOrder);
    if (!o || !confirm(`Удалить заказ №${o.code || o.id}?`)) return;
    try { await Store.deleteOrder(o.id); orders = orders.filter(x => x !== o); renderOrders(); toast('Заказ удалён'); }
    catch (err) { toast(errText(err), true); }
  });

  function orderText(o) {
    const items = Array.isArray(o.items) ? o.items : [];
    return [`Заказ №${o.code || o.id}`, ...items.map(i => `• ${i.name}${i.variant ? ' (' + i.variant + ')' : ''} × ${i.qty} = ${money(i.price * i.qty)}`),
      `Сумма: ${money(o.total)}`, `Имя: ${o.name}`, `Телефон: ${o.phone}`, `Адрес: ${o.address}`, `Оплата: ${o.payment}`,
      o.promo ? `Промокод: ${o.promo}` : '', o.comment ? `Комментарий: ${o.comment}` : ''].filter(Boolean).join('\n');
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); }
    catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); }
    toast('Заказ скопирован — можно вставить курьеру');
  }

  // ================= Отчёт =================
  const PERIODS = [['today', 'Сегодня', 1], ['7', '7 дней', 7], ['30', '30 дней', 30], ['all', 'Всё время', 0]];
  function renderReport() {
    $('#reportPeriod').innerHTML = PERIODS.map(([k, n]) => `<button class="chip ${period === k ? 'on' : ''}" data-period="${k}">${n}</button>`).join('');
    const days = PERIODS.find(p => p[0] === period)[2];
    const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - Math.max(0, days - 1));
    const inPeriod = orders.filter(o => !days || new Date(o.created_at) >= from);
    const ok = inPeriod.filter(o => o.status !== 'canceled');
    const sum = ok.reduce((s, o) => s + (+o.total || 0), 0);
    $('#reportStats').innerHTML = `
      <div class="stat"><b>${money(sum)}</b><span>выручка</span></div>
      <div class="stat"><b>${ok.length}</b><span>заказов${inPeriod.length - ok.length ? ` · отмен ${inPeriod.length - ok.length}` : ''}</span></div>
      <div class="stat"><b>${money(ok.length ? sum / ok.length : 0)}</b><span>средний чек</span></div>`;

    const top = {};
    ok.forEach(o => (o.items || []).forEach(i => {
      const k = i.name + (i.variant ? ' (' + i.variant + ')' : '');
      top[k] = top[k] || { qty: 0, sum: 0 }; top[k].qty += +i.qty || 0; top[k].sum += (+i.price || 0) * (+i.qty || 0);
    }));
    const topList = Object.entries(top).sort((a, b) => b[1].sum - a[1].sum).slice(0, 10);
    const maxT = topList.length ? topList[0][1].sum : 1;
    $('#topItems').innerHTML = topList.length ? topList.map(([n, v]) => `<div class="rrow"><span>${esc(n)} <span class="num">× ${v.qty}</span></span><b>${money(v.sum)}</b><small><i style="width:${v.sum / maxT * 100}%"></i></small></div>`).join('') : '<p class="muted small">Нет заказов за период</p>';

    const byDay = {};
    ok.forEach(o => { const d = new Date(o.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', weekday: 'short' }); byDay[d] = byDay[d] || { n: 0, s: 0, t: new Date(o.created_at) }; byDay[d].n++; byDay[d].s += +o.total || 0; });
    const dl = Object.entries(byDay).sort((a, b) => b[1].t - a[1].t).slice(0, 31);
    $('#byDay').innerHTML = dl.length ? dl.map(([d, v]) => `<div class="rrow"><span>${esc(d)} <span class="num">· ${v.n} зак.</span></span><b>${money(v.s)}</b></div>`).join('') : '<p class="muted small">—</p>';

    const pays = {};
    ok.forEach(o => { const k = o.payment || '—'; pays[k] = pays[k] || { n: 0, s: 0 }; pays[k].n++; pays[k].s += +o.total || 0; });
    $('#byPay').innerHTML = Object.keys(pays).length ? Object.entries(pays).sort((a, b) => b[1].s - a[1].s).map(([k, v]) => `<div class="rrow"><span>${esc(k)} <span class="num">· ${v.n}</span></span><b>${money(v.s)}</b><small><i style="width:${v.s / (sum || 1) * 100}%"></i></small></div>`).join('') : '<p class="muted small">—</p>';
  }
  $('#reportPeriod').addEventListener('click', (e) => { const b = e.target.closest('[data-period]'); if (b) { period = b.dataset.period; renderReport(); } });

  // ================= Меню =================
  const catName = (id) => (doc.categories.find(c => c.id === id) || { name: '— без категории —' }).name;

  function renderMenu() {
    const sel = $('#menuCat');
    sel.innerHTML = `<option value="all">Все категории</option>` + doc.categories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    if (menuCat !== 'all' && !doc.categories.some(c => c.id === menuCat)) menuCat = 'all';
    sel.value = menuCat;
    const q = menuQ.toLowerCase();
    const cats = [...doc.categories, ...[...new Set(doc.items.map(i => i.cat))].filter(id => !doc.categories.some(c => c.id === id)).map(id => ({ id, name: catName(id) }))];
    let html = '';
    cats.forEach(c => {
      if (menuCat !== 'all' && c.id !== menuCat) return;
      const its = doc.items.filter(i => i.cat === c.id && (!q || i.name.toLowerCase().includes(q)));
      if (!its.length) return;
      html += `<div class="cat-head">${esc(c.name)} · ${its.length}</div>` + its.map(itemRow).join('');
    });
    $('#items').innerHTML = html || `<div class="empty">Ничего не найдено</div>`;
  }

  function itemRow(it) {
    const priceTxt = it.variants && it.variants.length ? `от ${money(minPrice(it))} · ${it.variants.length} вар.` : money(it.price);
    return `<div class="item ${it.available === false ? 'off' : ''}">
      ${it.img ? `<img class="thumb" src="${esc(it.img)}" alt="">` : `<span class="thumb">${esc(it.name.slice(0, 2).toUpperCase())}</span>`}
      <div class="item-info"><b>${esc(it.name)}${it.hit ? '<span class="tag">ХИТ</span>' : ''}</b><small>${priceTxt}</small></div>
      <div class="item-acts">
        <label class="sw" title="В наличии"><input type="checkbox" data-avail="${esc(it.id)}" ${it.available !== false ? 'checked' : ''}><span class="switch"></span></label>
        <button class="icon-btn move" data-move="${esc(it.id)}" data-d="-1" title="Выше">↑</button>
        <button class="icon-btn move" data-move="${esc(it.id)}" data-d="1" title="Ниже">↓</button>
        <button class="icon-btn" data-edit="${esc(it.id)}" title="Изменить">✎</button>
      </div>
    </div>`;
  }

  $('#menuCat').addEventListener('change', (e) => { menuCat = e.target.value; renderMenu(); });
  $('#menuSearch').addEventListener('input', (e) => { menuQ = e.target.value.trim(); renderMenu(); });
  $('#addItemBtn').addEventListener('click', () => itemModal(null));
  $('#catsBtn').addEventListener('click', catsModal);
  $('#bulkBtn').addEventListener('click', bulkModal);

  function bulkModal() {
    openModal('Изменить цены', `
      <form class="form" id="bulkForm">
        <p class="muted small">Например, +10 поднимет цены на 10%, −5 снизит на 5%. Затронет и варианты (крылышки, кола и т.д.).</p>
        <div class="field"><label>Категория</label><select name="cat"><option value="all">Все блюда</option>${doc.categories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Изменение, %</label><input name="pct" type="number" step="1" placeholder="10 или -5"></div>
        <div class="field"><label>Округление</label><select name="round"><option value="90">До …90 (2 890, 3 190)</option><option value="10">До 10 ₸</option><option value="100">До 100 ₸</option></select></div>
        <p class="hint small muted" id="bulkPrev"></p>
        <button class="btn btn-primary" type="submit">Применить</button>
      </form>`);
    const f = $('#bulkForm');
    const calc = (p, pct, r) => {
      const raw = p * (1 + pct / 100);
      let v = r === '90' ? Math.round((raw + 10) / 100) * 100 - 10 : Math.round(raw / +r) * +r;
      if ((pct > 0 && v <= p) || (pct < 0 && v >= p) || v <= 0) v = Math.round(raw / 10) * 10; // для мелких цен (соусы)
      return Math.max(0, v);
    };
    const targets = () => doc.items.filter(i => f.cat.value === 'all' || i.cat === f.cat.value);
    const prev = () => {
      const pct = +f.pct.value, t = targets();
      if (!pct || !t.length) { $('#bulkPrev').textContent = ''; return; }
      const ex = t.find(i => !i.variants) || t[0], p0 = ex.variants ? +ex.variants[0].p : +ex.price;
      $('#bulkPrev').textContent = `Блюд: ${t.length}. Пример: «${ex.name}» ${money(p0)} → ${money(calc(p0, pct, f.round.value))}`;
    };
    f.oninput = prev; f.onchange = prev;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const pct = +f.pct.value; if (!pct) return toast('Введите процент', true);
      const t = targets(); if (!confirm(`Изменить цены у ${t.length} блюд на ${pct > 0 ? '+' : ''}${pct}%?`)) return;
      const backup = clone(doc.items);
      t.forEach(i => { if (i.variants) i.variants.forEach(v => v.p = calc(+v.p, pct, f.round.value)); else i.price = calc(+i.price, pct, f.round.value); });
      if (await persist('Цены обновлены')) { closeModal(); renderMenu(); } else doc.items = backup;
    };
  }

  $('#items').addEventListener('change', async (e) => {
    const t = e.target.closest('[data-avail]'); if (!t) return;
    const it = doc.items.find(i => i.id === t.dataset.avail);
    it.available = t.checked; renderMenu();
    await persist(t.checked ? `«${it.name}» снова в наличии` : `«${it.name}» в стоп-листе`);
  });
  $('#items').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]'); if (ed) return itemModal(doc.items.find(i => i.id === ed.dataset.edit));
    const mv = e.target.closest('[data-move]'); if (!mv) return;
    const idx = doc.items.findIndex(i => i.id === mv.dataset.move), it = doc.items[idx], d = +mv.dataset.d;
    let j = idx + d; while (j >= 0 && j < doc.items.length && doc.items[j].cat !== it.cat) j += d;
    if (j < 0 || j >= doc.items.length) return;
    [doc.items[idx], doc.items[j]] = [doc.items[j], doc.items[idx]];
    renderMenu(); await persist('Порядок сохранён');
  });

  // ---------- Окно блюда ----------
  function itemModal(src) {
    const isNew = !src;
    const it = src ? clone(src) : { id: uid('item'), cat: menuCat !== 'all' ? menuCat : (doc.categories[0] || {}).id, name: '', desc: '', price: '', img: '', available: true, hit: false, variants: [] };
    openModal(isNew ? 'Новое блюдо' : 'Изменить блюдо', `
      <form class="form" id="itemForm">
        <div class="field"><label>Название *</label><input name="name" value="${esc(it.name)}" required></div>
        <div class="field"><label>Категория</label><select name="cat">${doc.categories.map(c => `<option value="${esc(c.id)}" ${c.id === it.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Описание / состав</label><textarea name="desc" placeholder="Для комбо пишите через «+»: 20 крылышек + 1 фри">${esc(it.desc)}</textarea></div>
        <div class="field"><label>Цена, ₸</label><input name="price" type="number" min="0" step="10" value="${esc(it.price ?? '')}" placeholder="Если нет вариантов"></div>
        <div class="field"><label>Варианты (размер, количество, вкус) — у каждого своя цена</label>
          <div class="vars" id="vars">${(it.variants || []).map(varRow).join('')}</div>
          <button type="button" class="btn btn-ghost sm" id="addVar" style="margin-top:6px">+ Вариант</button>
        </div>
        <div class="field"><label>Фото</label>
          <div class="img-pick">
            <span id="imgPrev">${thumbHtml(it.img, it.name)}</span>
            <div class="col">
              <label class="btn btn-ghost sm">📷 Загрузить фото<input type="file" accept="image/*" id="imgFile" hidden></label>
              <input name="img" value="${esc(it.img)}" placeholder="или ссылка на фото" style="height:38px">
            </div>
          </div>
        </div>
        <label class="switch-row"><input type="checkbox" name="available" ${it.available !== false ? 'checked' : ''}><span class="switch"></span>В наличии</label>
        <label class="switch-row"><input type="checkbox" name="hit" ${it.hit ? 'checked' : ''}><span class="switch"></span>Метка «Хит»</label>
        <div class="row-btns">
          <button class="btn btn-primary" type="submit">Сохранить</button>
          ${isNew ? '' : '<button class="btn btn-ghost" type="button" id="dupItem">Копировать</button><button class="btn btn-danger" type="button" id="delItem">Удалить</button>'}
        </div>
      </form>`);

    const f = $('#itemForm');
    $('#addVar').onclick = () => { $('#vars').insertAdjacentHTML('beforeend', varRow({ n: '', p: '' })); };
    $('#vars').onclick = (e) => { const b = e.target.closest('[data-rm-var]'); if (b) b.parentElement.remove(); };
    f.img.oninput = () => { $('#imgPrev').innerHTML = thumbHtml(f.img.value, f.name.value); };
    $('#imgFile').onchange = (e) => uploadInto(e.target.files[0], f.img, '#imgPrev', f.name.value);
    if (!isNew) $('#dupItem').onclick = async () => {
      const c = clone(src); c.id = uid('item'); c.name = src.name + ' (копия)';
      doc.items.splice(doc.items.findIndex(i => i.id === src.id) + 1, 0, c);
      if (await persist('Копия создана')) { renderMenu(); itemModal(c); }
    };
    if (!isNew) $('#delItem').onclick = async () => {
      if (!confirm(`Удалить «${it.name}» из меню?`)) return;
      doc.items = doc.items.filter(i => i.id !== it.id); closeModal(); renderMenu(); persist('Блюдо удалено');
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const variants = $$('.var-row', f).map(r => ({ n: r.children[0].value.trim(), p: Math.round(+r.children[1].value) })).filter(v => v.n && Number.isFinite(v.p) && v.p >= 0);
      const price = Math.round(+f.price.value);
      if (!f.name.value.trim()) return toast('Введите название', true);
      if (!variants.length && !(price > 0)) return toast('Укажите цену или добавьте варианты', true);
      Object.assign(it, { name: f.name.value.trim(), cat: f.cat.value, desc: f.desc.value.trim(), img: f.img.value.trim(), available: f.available.checked, hit: f.hit.checked });
      if (variants.length) { it.variants = variants; delete it.price; } else { it.price = price; delete it.variants; }
      if (isNew) doc.items.push(it); else doc.items[doc.items.findIndex(i => i.id === it.id)] = it;
      if (await persist(isNew ? 'Блюдо добавлено' : 'Сохранено ✓')) { closeModal(); renderMenu(); }
    };
  }
  const varRow = (v) => `<div class="var-row"><input placeholder="Напр. 30 шт" value="${esc(v.n)}"><input type="number" min="0" step="10" placeholder="Цена" value="${esc(v.p)}"><button type="button" class="icon-btn red" data-rm-var>✕</button></div>`;
  const thumbHtml = (src, name) => src ? `<img class="thumb" src="${esc(src)}" alt="">` : `<span class="thumb">${esc((name || 'Фото').slice(0, 2).toUpperCase())}</span>`;

  async function uploadInto(file, input, prevSel, name) {
    if (!file) return;
    toast('Загружаю фото…');
    try { const url = await Store.uploadImage(file); input.value = url; $(prevSel).innerHTML = thumbHtml(url, name); toast('Фото загружено ✓'); }
    catch (e) { toast(errText(e), true); }
  }

  // ---------- Категории ----------
  function catsModal() {
    const draw = () => doc.categories.map((c, i) => `
      <div class="var-row" style="grid-template-columns:1fr 36px 36px 36px">
        <input data-cat-name="${i}" value="${esc(c.name)}">
        <button type="button" class="icon-btn" data-cat-mv="${i}" data-d="-1">↑</button>
        <button type="button" class="icon-btn" data-cat-mv="${i}" data-d="1">↓</button>
        <button type="button" class="icon-btn red" data-cat-del="${i}">✕</button>
      </div>`).join('');
    openModal('Категории', `
      <div class="form">
        <p class="muted small">Порядок категорий = порядок на сайте. Категория без блюд на сайте не показывается.</p>
        <div class="vars" id="catList">${draw()}</div>
        <div class="var-row" style="grid-template-columns:1fr auto"><input id="newCat" placeholder="Новая категория, напр. Десерты"><button type="button" class="btn btn-ghost sm" id="addCat">Добавить</button></div>
        <button class="btn btn-primary" id="saveCats">Сохранить</button>
      </div>`);
    const list = $('#catList');
    const sync = () => $$('[data-cat-name]', list).forEach(inp => { doc.categories[+inp.dataset.catName].name = inp.value.trim() || doc.categories[+inp.dataset.catName].name; });
    list.onclick = (e) => {
      const mv = e.target.closest('[data-cat-mv]'), del = e.target.closest('[data-cat-del]');
      sync();
      if (mv) { const i = +mv.dataset.catMv, j = i + +mv.dataset.d; if (j < 0 || j >= doc.categories.length) return; [doc.categories[i], doc.categories[j]] = [doc.categories[j], doc.categories[i]]; }
      if (del) {
        const c = doc.categories[+del.dataset.catDel], n = doc.items.filter(i => i.cat === c.id).length;
        if (n && !confirm(`В категории «${c.name}» ${n} блюд. Удалить категорию вместе с блюдами?`)) return;
        doc.items = doc.items.filter(i => i.cat !== c.id); doc.categories.splice(+del.dataset.catDel, 1);
      }
      list.innerHTML = draw();
    };
    $('#addCat').onclick = () => { const v = $('#newCat').value.trim(); if (!v) return; sync(); doc.categories.push({ id: uid('cat'), name: v }); $('#newCat').value = ''; list.innerHTML = draw(); };
    $('#saveCats').onclick = async () => { sync(); if (await persist('Категории сохранены')) { closeModal(); renderMenu(); } };
  }

  // ================= Акции =================
  function renderPromos() {
    $('#promoList').innerHTML = doc.promos.length ? doc.promos.map((p, i) => `
      <div class="item ${p.active ? '' : 'off'}">
        ${thumbHtml(p.img, p.title)}
        <div class="item-info"><b>${esc(p.title)}</b><small>${esc(p.text)}</small></div>
        <div class="item-acts">
          <label class="sw" title="Показывать"><input type="checkbox" data-pr-active="${i}" ${p.active ? 'checked' : ''}><span class="switch"></span></label>
          <button class="icon-btn" data-pr-edit="${i}" title="Изменить">✎</button>
          <button class="icon-btn red" data-pr-del="${i}" title="Удалить">🗑</button>
        </div>
      </div>`).join('') : `<div class="empty">Акций нет. Нажмите «+ Акция».</div>`;
  }
  $('#addPromoBtn').addEventListener('click', () => promoModal(-1));
  $('#promoList').addEventListener('change', async (e) => {
    const t = e.target.closest('[data-pr-active]'); if (!t) return;
    doc.promos[+t.dataset.prActive].active = t.checked; renderPromos(); persist(t.checked ? 'Акция показана на сайте' : 'Акция скрыта');
  });
  $('#promoList').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pr-edit]'); if (b) return promoModal(+b.dataset.prEdit);
    const d = e.target.closest('[data-pr-del]'); if (!d) return;
    const p = doc.promos[+d.dataset.prDel]; if (!confirm(`Удалить акцию «${p.title}»?`)) return;
    doc.promos.splice(+d.dataset.prDel, 1); renderPromos(); persist('Акция удалена');
  });

  function promoModal(i) {
    const p = i >= 0 ? clone(doc.promos[i]) : { id: uid('promo'), title: '', text: '', code: '', img: '', active: true };
    openModal(i >= 0 ? 'Изменить акцию' : 'Новая акция', `
      <form class="form" id="promoForm">
        <div class="field"><label>Заголовок *</label><input name="title" value="${esc(p.title)}" placeholder="Комбо дня −10%"></div>
        <div class="field"><label>Текст</label><textarea name="text">${esc(p.text)}</textarea></div>
        <div class="field"><label>Промокод (необязательно)</label><input name="code" value="${esc(p.code)}" placeholder="HOT10"></div>
        <div class="field"><label>Картинка</label>
          <div class="img-pick"><span id="prPrev">${thumbHtml(p.img, p.title)}</span>
            <div class="col"><label class="btn btn-ghost sm">📷 Загрузить<input type="file" accept="image/*" id="prFile" hidden></label>
            <input name="img" value="${esc(p.img)}" placeholder="или ссылка" style="height:38px"></div></div></div>
        <label class="switch-row"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}><span class="switch"></span>Показывать на сайте</label>
        <div class="row-btns"><button class="btn btn-primary" type="submit">Сохранить</button>
          ${i >= 0 ? '<button class="btn btn-danger" type="button" id="delPromo">Удалить</button>' : ''}</div>
      </form>`);
    const f = $('#promoForm');
    $('#prFile').onchange = (e) => uploadInto(e.target.files[0], f.img, '#prPrev', f.title.value);
    f.img.oninput = () => { $('#prPrev').innerHTML = thumbHtml(f.img.value, f.title.value); };
    if (i >= 0) $('#delPromo').onclick = async () => { if (!confirm('Удалить акцию?')) return; doc.promos.splice(i, 1); closeModal(); renderPromos(); persist('Акция удалена'); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (!f.title.value.trim()) return toast('Введите заголовок', true);
      Object.assign(p, { title: f.title.value.trim(), text: f.text.value.trim(), code: f.code.value.trim(), img: f.img.value.trim(), active: f.active.checked });
      if (i >= 0) doc.promos[i] = p; else doc.promos.push(p);
      if (await persist('Акция сохранена')) { closeModal(); renderPromos(); }
    };
  }

  // ================= Настройки =================
  function fillSettings() {
    const f = $('#settingsForm'), s = doc.settings;
    ['city', 'phone', 'whatsapp', 'instagram', 'tagline', 'address', 'open', 'close', 'deliveryFrom', 'freeFrom', 'notice'].forEach(k => { if (f[k]) f[k].value = s[k] ?? ''; });
    f.payments.value = (s.payments || []).join(', ');
    f.acceptOrders.checked = s.acceptOrders !== false;
    f.kaspiRed.checked = !!s.kaspiRed;
  }
  $('#settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, s = doc.settings;
    ['city', 'phone', 'instagram', 'tagline', 'address', 'open', 'close', 'notice'].forEach(k => s[k] = f[k].value.trim());
    s.instagram = s.instagram.replace(/^@/, '');
    s.whatsapp = f.whatsapp.value.replace(/\D/g, '');
    s.deliveryFrom = Math.max(0, Math.round(+f.deliveryFrom.value || 0));
    s.freeFrom = Math.max(0, Math.round(+f.freeFrom.value || 0));
    s.payments = f.payments.value.split(',').map(x => x.trim()).filter(Boolean);
    s.acceptOrders = f.acceptOrders.checked; s.kaspiRed = f.kaspiRed.checked;
    if (s.whatsapp.length < 11) return toast('Проверьте номер WhatsApp: нужно 11 цифр, начиная с 7', true);
    persist('Настройки сохранены');
  });

  $('#exportBtn').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
    a.download = 'chicken-hot-menu-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click(); URL.revokeObjectURL(a.href);
  });
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!Array.isArray(d.items) || !Array.isArray(d.categories)) throw new Error('Неверный файл');
      if (!confirm(`Заменить меню данными из файла (${d.items.length} блюд)?`)) return;
      doc = { settings: Object.assign({}, doc.settings, d.settings), categories: d.categories, items: d.items, promos: d.promos || [] };
      if (await persist('Меню восстановлено из файла')) { renderMenu(); renderPromos(); fillSettings(); }
    } catch (err) { toast('Не удалось прочитать файл: ' + err.message, true); }
    e.target.value = '';
  });
  $('#resetBtn').addEventListener('click', async () => {
    if (!confirm('Вернуть стандартное меню, акции и настройки? Ваши изменения пропадут (сначала можно скачать копию).')) return;
    doc = clone(window.CH_DEFAULT);
    if (await persist('Стандартное меню восстановлено')) { renderMenu(); renderPromos(); fillSettings(); }
  });

  // ================= Модалка / тосты =================
  function openModal(title, html) { $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modal').hidden = false; document.body.style.overflow = 'hidden'; }
  function closeModal() { $('#modal').hidden = true; $('#modalBody').innerHTML = ''; document.body.style.overflow = ''; }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close-modal]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

  let tt;
  function toast(m, err) { const t = $('#toast'); t.textContent = m; t.classList.toggle('err', !!err); t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), err ? 4000 : 2000); }
})();
