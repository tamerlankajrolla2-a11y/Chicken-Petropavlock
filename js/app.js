(function () {
  const { money, esc, minPrice } = window.CH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const LS_CART = 'ch_cart_v1', LS_CUST = 'ch_customer_v1';

  let SITE = window.CH_DEFAULT;
  let S = SITE.settings;
  let cart = load(LS_CART, []);          // [{key,id,v,qty}]
  const selVar = {};                     // выбранный вариант на карточке
  let step = 'cart';

  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // ---------- Init ----------
  async function init() {
    $('#year').textContent = new Date().getFullYear();
    renderAll();                         // сразу показываем стандартное меню
    try {
      await Store.init();
      const { doc } = await Store.getSite();
      SITE = doc; S = SITE.settings;
      renderAll();
    } catch (e) { console.warn(e); }
    setInterval(renderStatus, 60000);
  }

  function renderAll() {
    cleanCart();
    renderSettings(); renderStatus(); renderPromos(); renderMenu(); renderCart();
  }

  const itemById = (id) => SITE.items.find(i => i.id === id);
  const waLink = (text) => 'https://wa.me/' + String(S.whatsapp || '').replace(/\D/g, '') + (text ? '?text=' + encodeURIComponent(text) : '');

  function cleanCart() {
    cart = cart.filter(l => { const it = itemById(l.id); if (!it || it.available === false) return false;
      return (it.variants && it.variants.length) ? !!it.variants[l.v] : l.v === -1; });
    save(LS_CART, cart);
  }

  // ---------- Settings ----------
  function renderSettings() {
    const map = {
      city: S.city, tagline: S.tagline, address: S.address ? 'Адрес: ' + S.address : '',
      hours: `${S.open}–${S.close}`,
      deliveryFromTxt: 'от ' + money(S.deliveryFrom),
      freeFromTxt: 'от ' + money(S.freeFrom),
      paymentsTxt: (S.payments || []).join(', ') + '.'
    };
    $$('[data-s]').forEach(el => { const v = map[el.dataset.s]; if (v !== undefined) el.textContent = v; });
    $$('[data-phone]').forEach(a => { a.textContent = S.phone; a.href = 'tel:' + String(S.phone).replace(/[^\d+]/g, ''); });
    $$('[data-wa]').forEach(a => { a.href = waLink('Здравствуйте! Хочу сделать заказ'); });
    $$('[data-ig]').forEach(a => { a.href = 'https://instagram.com/' + S.instagram; a.textContent = '@' + S.instagram; });
    $('.hero-sticker').hidden = !S.kaspiRed;
    const n = $('#notice'); n.hidden = !S.notice; n.textContent = S.notice || '';
  }

  function renderStatus() {
    const el = $('#status'), open = CH.isOpen(S);
    el.className = 'status ' + (open ? 'open' : 'closed');
    el.lastElementChild.textContent = open ? `Открыто до ${S.close} · принимаем заказы` : `Сейчас закрыто · откроемся в ${S.open}`;
  }

  // ---------- Promos ----------
  function renderPromos() {
    const list = (SITE.promos || []).filter(p => p.active);
    const box = $('#promos'); box.hidden = !list.length;
    box.innerHTML = list.map(p => `
      <article class="promo">
        <div class="promo-txt">
          <h3>${esc(p.title)}</h3><p>${esc(p.text)}</p>
          ${p.code ? `<span class="code">Промокод: ${esc(p.code)}</span>` : ''}
        </div>
        ${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : ''}
      </article>`).join('');
  }

  // ---------- Menu ----------
  function renderMenu() {
    const cats = SITE.categories.filter(c => SITE.items.some(i => i.cat === c.id && !i.hidden));
    $('#catsIn').innerHTML = cats.map(c => `<button class="cat-chip" data-go="${esc(c.id)}">${esc(c.name)}</button>`).join('');
    $('#menu').innerHTML = cats.map(c => {
      const items = SITE.items.filter(i => i.cat === c.id && !i.hidden);
      const isCombo = c.id === 'combo';
      return `<section class="cat-sec" id="cat-${esc(c.id)}" data-cat="${esc(c.id)}">
        <h2 class="sec-title">${esc(c.name)} <small>${items.length}</small></h2>
        <div class="grid ${isCombo ? 'grid-combo' : ''}">${items.map(it => isCombo && !it.img ? comboCard(it) : card(it)).join('')}</div>
      </section>`;
    }).join('');
    setupSpy();
  }

  function curVar(it) { return it.variants && it.variants.length ? Math.min(selVar[it.id] || 0, it.variants.length - 1) : -1; }
  function priceOf(it, v) { return v >= 0 ? +it.variants[v].p : +it.price; }
  const keyOf = (id, v) => id + '|' + v;

  function buyHtml(it) {
    if (it.available === false) return `<span class="off-tag">Нет в наличии</span>`;
    const v = curVar(it), line = cart.find(l => l.key === keyOf(it.id, v));
    if (line) return `<div class="stepper"><button data-dec="${esc(line.key)}" aria-label="Меньше">−</button><b>${line.qty}</b><button data-inc="${esc(line.key)}" aria-label="Больше">+</button></div>`;
    return `<button class="add" data-add="${esc(it.id)}" aria-label="В корзину">+<span class="t"> В корзину</span></button>`;
  }

  function card(it) {
    const v = curVar(it);
    const img = it.img
      ? `<div class="card-img"><img src="${esc(it.img)}" alt="${esc(it.name)}" loading="lazy"></div>`
      : `<div class="card-img ph"><span>${esc(it.name)}<small>Chicken Hot</small></span></div>`;
    const vars = v >= 0 ? `<div class="variants">${it.variants.map((x, i) =>
      `<button class="var ${i === v ? 'on' : ''}" data-var="${esc(it.id)}" data-i="${i}">${esc(x.n)}</button>`).join('')}</div>` : '';
    const wide = it.cat === 'wings' && it.variants && it.variants.length > 3;
    return `<article class="card ${wide ? 'wide' : ''} ${it.available === false ? 'off' : ''}" data-item="${esc(it.id)}">
      ${it.hit ? '<span class="badge">Хит</span>' : ''}
      ${img}
      <div class="card-body">
        <h3>${esc(it.name)}</h3>
        ${it.desc ? `<p class="desc">${esc(it.desc)}</p>` : ''}
        ${vars}
        <div class="card-foot"><span class="price">${money(priceOf(it, v))}</span><span class="buy">${buyHtml(it)}</span></div>
      </div>
    </article>`;
  }

  function comboCard(it) {
    const parts = String(it.desc || '').split('+').map(s => s.trim()).filter(Boolean);
    return `<article class="combo ${it.available === false ? 'off' : ''}" data-item="${esc(it.id)}">
      ${it.hit ? '<span class="badge">Хит</span>' : ''}
      <h3>${esc(it.name)}</h3>
      <ul>${parts.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      <div class="card-foot"><span class="price">${money(it.price)}</span><span class="buy">${buyHtml(it)}</span></div>
    </article>`;
  }

  function refreshCard(id) {
    const it = itemById(id); if (!it) return;
    $$(`[data-item="${CSS.escape(id)}"]`).forEach(el => {
      const tmp = document.createElement('div');
      tmp.innerHTML = (it.cat === 'combo' && !it.img) ? comboCard(it) : card(it);
      el.replaceWith(tmp.firstElementChild);
    });
  }

  // ---------- Scroll spy ----------
  let spy;
  function setupSpy() {
    if (spy) spy.disconnect();
    spy = new IntersectionObserver((ents) => {
      ents.forEach(e => {
        if (!e.isIntersecting) return;
        $$('.cat-chip').forEach(c => c.classList.toggle('active', c.dataset.go === e.target.dataset.cat));
        const a = $('.cat-chip.active'); if (a) a.parentElement.scrollTo({ left: a.offsetLeft - 18, behavior: 'smooth' });
      });
    }, { rootMargin: '-140px 0px -60% 0px' });
    $$('.cat-sec').forEach(s => spy.observe(s));
  }

  // ---------- Cart ----------
  function addToCart(id, v) {
    const key = keyOf(id, v), l = cart.find(x => x.key === key);
    if (l) l.qty++; else cart.push({ key, id, v, qty: 1 });
    changed(id);
    const b = $('#cartBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
    toast('Добавлено в корзину');
  }
  function setQty(key, d) {
    const l = cart.find(x => x.key === key); if (!l) return;
    l.qty += d; if (l.qty <= 0) cart = cart.filter(x => x !== l);
    changed(l.id);
  }
  function changed(id) { save(LS_CART, cart); refreshCard(id); renderCart(); }

  function lines() {
    return cart.map(l => {
      const it = itemById(l.id), v = l.v;
      return { ...l, it, name: (it.cat === 'combo' ? 'Комбо ' : '') + it.name, variant: v >= 0 ? it.variants[v].n : '', price: priceOf(it, v), sum: priceOf(it, v) * l.qty };
    });
  }
  const it0 = (l) => l.it.name.slice(0, 2).toUpperCase();
  const subtotal = () => lines().reduce((s, l) => s + l.sum, 0);
  const count = () => cart.reduce((s, l) => s + l.qty, 0);

  function renderCart() {
    const n = count(), sum = subtotal();
    $('#cartCount').textContent = n;
    $('#cartSum').textContent = n ? money(sum) : '';
    $('#cartBar').hidden = !n || $('#drawer').classList.contains('open');
    $('#barCount').textContent = n; $('#barSum').textContent = money(sum);
    if ($('#drawer').classList.contains('open')) renderDrawer();
  }

  function freeBlock(sum) {
    const left = S.freeFrom - sum;
    if (left <= 0) return `<div class="free ok">🎉 Доставка бесплатная!<div class="bar"><i style="width:100%"></i></div></div>`;
    return `<div class="free">Ещё <b>${money(left)}</b> до бесплатной доставки<div class="bar"><i style="width:${Math.max(4, sum / S.freeFrom * 100)}%"></i></div></div>`;
  }
  const deliveryTxt = (sum) => sum >= S.freeFrom ? 'Бесплатно' : `от ${money(S.deliveryFrom)}`;

  function renderDrawer() {
    const body = $('#drawerBody'), foot = $('#drawerFoot');
    $('#backBtn').hidden = step !== 'checkout';
    $('#drawerTitle').textContent = step === 'checkout' ? 'Оформление' : step === 'done' ? 'Готово' : 'Корзина';
    const L = lines(), sum = subtotal();

    if (step === 'done') { foot.innerHTML = ''; return; }

    if (!L.length) {
      step = 'cart';
      body.innerHTML = `<div class="empty"><img src="img/logo.png" alt="">Корзина пока пустая.<br>Добавьте что-нибудь вкусное!</div>`;
      foot.innerHTML = `<button class="btn btn-dark btn-block" data-close>Перейти в меню</button>`;
      return;
    }

    if (step === 'cart') {
      body.innerHTML = L.map(l => `
        <div class="line">
          ${l.it.img ? `<img src="${esc(l.it.img)}" alt="">` : `<span class="ph" style="background:var(--orange)">${esc(it0(l))}</span>`}
          <div class="line-info"><b>${esc(l.name)}</b><small>${l.variant ? esc(l.variant) + ' · ' : ''}${money(l.price)}</small></div>
          <div class="stepper"><button data-dec="${esc(l.key)}">−</button><b>${l.qty}</b><button data-inc="${esc(l.key)}">+</button></div>
        </div>`).join('') + freeBlock(sum);
      foot.innerHTML = `
        <div class="sum-row"><span class="muted">Сумма</span><span>${money(sum)}</span></div>
        <div class="sum-row"><span class="muted">Доставка</span><span>${deliveryTxt(sum)}</span></div>
        <button class="btn btn-primary btn-block" id="toCheckout" style="margin-top:12px">Оформить заказ · ${money(sum)}</button>`;
      return;
    }

    // checkout
    const c = load(LS_CUST, {});
    const pays = S.payments && S.payments.length ? S.payments : ['Kaspi перевод', 'Наличные курьеру'];
    const open = CH.isOpen(S);
    body.innerHTML = `
      ${!open ? `<div class="warn">Сейчас мы закрыты. Заказ примем, оператор ответит после ${esc(S.open)}.</div>` : ''}
      ${S.acceptOrders === false ? `<div class="warn">Онлайн-заказы временно не принимаются. Позвоните нам: ${esc(S.phone)}</div>` : ''}
      <form class="form" id="orderForm" novalidate>
        <div class="field"><label for="f-name">Имя</label><input id="f-name" name="name" autocomplete="name" value="${esc(c.name || '')}" placeholder="Как к вам обращаться"></div>
        <div class="field"><label for="f-phone">Телефон</label><input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" value="${esc(c.phone || '+7 ')}" placeholder="+7 7__ ___ __ __"></div>
        <div class="field"><label for="f-street">Улица и дом</label><input id="f-street" name="street" autocomplete="street-address" value="${esc(c.street || '')}" placeholder="ул. Конституции Казахстана, 15"></div>
        <div class="row2">
          <div class="field"><label for="f-flat">Кв / офис</label><input id="f-flat" name="flat" value="${esc(c.flat || '')}" placeholder="12"></div>
          <div class="field"><label for="f-entr">Подъезд, этаж</label><input id="f-entr" name="entr" value="${esc(c.entr || '')}" placeholder="2 подъезд, 4 этаж"></div>
        </div>
        <div class="field"><label>Оплата</label><div class="pays">${pays.map((p, i) =>
          `<label><input type="radio" name="pay" value="${esc(p)}" ${(c.pay ? c.pay === p : i === 0) ? 'checked' : ''}><span>${esc(p)}</span></label>`).join('')}</div></div>
        <div class="field"><label for="f-promo">Промокод</label><input id="f-promo" name="promo" placeholder="Если есть"><p class="hint" id="promoHint"></p></div>
        <div class="field"><label for="f-comment">Комментарий</label><textarea id="f-comment" name="comment" placeholder="Например: острее, сдача с 10 000"></textarea></div>
      </form>`;
    foot.innerHTML = `
      <div class="sum-row"><span class="muted">Сумма</span><span>${money(sum)}</span></div>
      <div class="sum-row"><span class="muted">Доставка</span><span>${deliveryTxt(sum)}</span></div>
      <div class="sum-row total"><span>Итого</span><span>${money(sum)}${sum < S.freeFrom ? ' + доставка' : ''}</span></div>
      <button class="btn btn-wa btn-block" id="sendOrder" style="margin-top:12px" ${S.acceptOrders === false ? 'disabled' : ''}>Отправить заказ в WhatsApp</button>
      <p class="hint" style="text-align:center;margin-top:8px">Оператор подтвердит заказ и стоимость доставки</p>`;
    $('#f-promo').addEventListener('input', checkPromo);
  }

  function checkPromo() {
    const v = $('#f-promo').value.trim().toLowerCase(), h = $('#promoHint');
    const p = (SITE.promos || []).find(x => x.active && x.code && x.code.toLowerCase() === v);
    h.className = 'hint' + (p ? ' good' : '');
    h.textContent = !v ? '' : p ? '✓ ' + p.title + ' — оператор применит акцию' : 'Такого промокода нет, но мы передадим его оператору';
  }

  function submitOrder() {
    const f = $('#orderForm'); if (!f) return;
    const val = (n) => (f.elements[n] ? f.elements[n].value.trim() : '');
    const phoneDigits = val('phone').replace(/\D/g, '');
    let bad = null;
    $$('.field input', f).forEach(i => i.classList.remove('err'));
    if (!val('name')) bad = 'f-name';
    else if (phoneDigits.length < 11) bad = 'f-phone';
    else if (!val('street')) bad = 'f-street';
    if (bad) { const el = $('#' + bad); el.classList.add('err'); el.focus(); toast(bad === 'f-phone' ? 'Проверьте номер телефона' : 'Заполните обязательные поля'); return; }

    const cust = { name: val('name'), phone: val('phone'), street: val('street'), flat: val('flat'), entr: val('entr'), pay: (f.elements.pay && f.elements.pay.value) || '' };
    save(LS_CUST, cust);
    const address = [cust.street, cust.flat && 'кв. ' + cust.flat, cust.entr].filter(Boolean).join(', ');
    const L = lines(), sum = subtotal(), code = String(Math.floor(1000 + Math.random() * 9000));
    const promo = val('promo'), comment = val('comment');

    const msg = [
      `🍗 Заказ с сайта №${code}`,
      '',
      ...L.map(l => `• ${l.name}${l.variant ? ' (' + l.variant + ')' : ''} × ${l.qty} = ${money(l.sum)}`),
      '',
      `Сумма: ${money(sum)}`,
      `Доставка: ${deliveryTxt(sum)}`,
      promo ? `Промокод: ${promo}` : null,
      '',
      `Имя: ${cust.name}`,
      `Телефон: ${cust.phone}`,
      `Адрес: ${address}`,
      `Оплата: ${cust.pay}`,
      comment ? `Комментарий: ${comment}` : null
    ].filter(x => x !== null).join('\n');

    const url = waLink(msg);
    const w = window.open(url, '_blank');   // открываем синхронно, чтобы не заблокировал браузер

    Store.createOrder({
      code, name: cust.name, phone: cust.phone, address, payment: cust.pay, promo, comment,
      items: L.map(l => ({ id: l.id, name: l.name, variant: l.variant, qty: l.qty, price: l.price })),
      total: sum, status: 'new'
    }).catch(e => console.warn('Заказ не сохранён в базе', e));

    cart = []; save(LS_CART, cart);
    $$('[data-item]').forEach(el => refreshCard(el.dataset.item));
    step = 'done';
    renderCart(); renderDrawer();
    $('#drawerBody').innerHTML = `<div class="done">
      <div class="ok-ic">✓</div>
      <h3>Заказ №${code} готов</h3>
      <p>${w ? 'Мы открыли WhatsApp — отправьте сообщение, и оператор подтвердит заказ.' : 'Нажмите кнопку ниже, чтобы отправить заказ в WhatsApp.'}</p>
      <a class="btn btn-wa btn-block" href="${esc(url)}" target="_blank" rel="noopener">Открыть WhatsApp</a>
      <button class="btn btn-dark btn-block" style="margin-top:10px" data-close>Вернуться в меню</button>
    </div>`;
  }

  // ---------- Drawer ----------
  function openDrawer() {
    step = 'cart';
    $('#overlay').hidden = false; $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    renderDrawer(); renderCart();
  }
  function closeDrawer() {
    $('#overlay').hidden = true; $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (step === 'done') step = 'cart';
    renderCart();
  }

  // ---------- Events ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a'); if (!t) return;
    if (t.dataset.add) { const it = itemById(t.dataset.add); addToCart(it.id, curVar(it)); }
    else if (t.dataset.inc) setQty(t.dataset.inc, 1);
    else if (t.dataset.dec) setQty(t.dataset.dec, -1);
    else if (t.dataset.var) { selVar[t.dataset.var] = +t.dataset.i; refreshCard(t.dataset.var); }
    else if (t.dataset.go) { const s = document.getElementById('cat-' + t.dataset.go); if (s) s.scrollIntoView({ behavior: 'smooth' }); }
    else if (t.id === 'cartBtn' || t.id === 'cartBar') openDrawer();
    else if (t.id === 'closeBtn' || t.hasAttribute('data-close')) closeDrawer();
    else if (t.id === 'toCheckout') { step = 'checkout'; renderDrawer(); }
    else if (t.id === 'backBtn') { step = 'cart'; renderDrawer(); }
    else if (t.id === 'sendOrder') submitOrder();
  });
  $('#overlay').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  document.addEventListener('submit', (e) => { e.preventDefault(); submitOrder(); });

  let tt;
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 1600); }
  init();
})();
