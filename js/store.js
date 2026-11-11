// Слой данных: Supabase (если настроен в config.js) или localStorage (демо).
(function () {
  const CFG = window.CH_CONFIG || {};
  const USE_SB = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  const LS_SITE = 'ch_site_v1', LS_ORDERS = 'ch_orders_v1', LS_AUTH = 'ch_admin_v1';
  let sb = null;

  const clone = (o) => JSON.parse(JSON.stringify(o));

  // Дополняет документ недостающими полями из стандартного меню
  function normalize(doc) {
    const d = clone(window.CH_DEFAULT);
    if (!doc || typeof doc !== 'object') return d;
    return {
      settings: Object.assign({}, d.settings, doc.settings || {}),
      categories: Array.isArray(doc.categories) && doc.categories.length ? doc.categories : d.categories,
      promos: Array.isArray(doc.promos) ? doc.promos : d.promos,
      items: Array.isArray(doc.items) ? doc.items : d.items
    };
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Не удалось загрузить ' + src));
      document.head.appendChild(s);
    });
  }

  function lsGet(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  const Store = {
    mode: USE_SB ? 'supabase' : 'demo',

    async init() {
      if (USE_SB && !sb) {
        if (!window.supabase) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
        sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
      }
      return this;
    },

    // ---------- Меню / настройки ----------
    async getSite() {
      if (USE_SB) {
        try {
          const { data, error } = await sb.from('site').select('data').eq('id', 1).maybeSingle();
          if (error) throw error;
          return { doc: normalize(data && data.data), exists: !!data };
        } catch (e) {
          console.warn('Supabase недоступен, показываю стандартное меню', e);
          return { doc: normalize(null), exists: false, error: e };
        }
      }
      const saved = lsGet(LS_SITE, null);
      return { doc: normalize(saved), exists: !!saved };
    },

    async saveSite(doc) {
      if (USE_SB) {
        const { error } = await sb.from('site').upsert({ id: 1, data: doc, updated_at: new Date().toISOString() });
        if (error) throw error;
        return true;
      }
      if (!lsSet(LS_SITE, doc)) throw new Error('Не хватает места в браузере (уменьшите фото)');
      return true;
    },

    resetDemo() { localStorage.removeItem(LS_SITE); },

    // ---------- Заказы ----------
    async createOrder(order) {
      if (USE_SB) {
        const { error } = await sb.from('orders').insert(order);
        if (error) throw error;
        return true;
      }
      const list = lsGet(LS_ORDERS, []);
      list.unshift(Object.assign({ id: Date.now(), created_at: new Date().toISOString() }, order));
      lsSet(LS_ORDERS, list.slice(0, 300));
      return true;
    },

    async listOrders(limit = 200) {
      if (USE_SB) {
        const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(limit);
        if (error) throw error;
        return data || [];
      }
      return lsGet(LS_ORDERS, []);
    },

    async updateOrder(id, patch) {
      if (USE_SB) {
        const { error } = await sb.from('orders').update(patch).eq('id', id);
        if (error) throw error;
        return true;
      }
      const list = lsGet(LS_ORDERS, []).map(o => o.id === id ? Object.assign(o, patch) : o);
      lsSet(LS_ORDERS, list);
      return true;
    },

    async deleteOrder(id) {
      if (USE_SB) {
        const { error } = await sb.from('orders').delete().eq('id', id);
        if (error) throw error;
        return true;
      }
      lsSet(LS_ORDERS, lsGet(LS_ORDERS, []).filter(o => o.id !== id));
      return true;
    },

    onNewOrder(cb) {
      if (USE_SB) {
        sb.channel('orders-feed')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (p) => cb(p.new))
          .subscribe();
      } else {
        window.addEventListener('storage', (e) => { if (e.key === LS_ORDERS) cb(null); });
      }
    },

    // ---------- Фото ----------
    async uploadImage(file) {
      const blob = await resizeImage(file, USE_SB ? 1000 : 600, USE_SB ? 0.85 : 0.75);
      if (USE_SB) {
        const path = 'items/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
        const { error } = await sb.storage.from(CFG.STORAGE_BUCKET || 'menu').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
        return sb.storage.from(CFG.STORAGE_BUCKET || 'menu').getPublicUrl(path).data.publicUrl;
      }
      return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    },

    // ---------- Вход в админку ----------
    async session() {
      if (USE_SB) {
        const { data } = await sb.auth.getSession();
        return data.session ? { email: data.session.user.email } : null;
      }
      const s = lsGet(LS_AUTH, null);
      return s && s.until > Date.now() ? s : null;
    },

    needsEmail() { return USE_SB && !CFG.ADMIN_EMAIL; },

    async login(email, password) {
      if (!password) throw new Error('Введите пароль');
      if (USE_SB) {
        const { data, error } = await sb.auth.signInWithPassword({ email: email || CFG.ADMIN_EMAIL, password });
        if (error) throw new Error(this.needsEmail() ? 'Неверный email или пароль' : 'Неверный пароль');
        return { email: data.user.email };
      }
      if ((await sha256(password)) !== String(CFG.ADMIN_PASSWORD_SHA256 || '').toLowerCase()) throw new Error('Неверный пароль');
      const s = { email: 'demo', until: Date.now() + 30 * 864e5 };
      lsSet(LS_AUTH, s);
      return s;
    },

    async logout() {
      if (USE_SB) await sb.auth.signOut();
      localStorage.removeItem(LS_AUTH);
    }
  };

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function resizeImage(file, max, q) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => b ? res(b) : rej(new Error('Не удалось обработать фото')), 'image/jpeg', q);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => rej(new Error('Это не картинка'));
      img.src = URL.createObjectURL(file);
    });
  }

  // Общие помощники
  window.CH = {
    money: (n) => (Math.round(Number(n) || 0)).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₸',
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    minPrice: (it) => it.variants && it.variants.length ? Math.min(...it.variants.map(v => +v.p || 0)) : (+it.price || 0),
    isOpen(settings, now = new Date()) {
      const toMin = (s) => { const [h, m] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
      const o = toMin(settings.open), c = toMin(settings.close), t = now.getHours() * 60 + now.getMinutes();
      if (o === c) return true;
      return c > o ? (t >= o && t < c) : (t >= o || t < c); // через полночь (11:00–00:00)
    }
  };
  window.Store = Store;
})();
