/* ==========================================================================
   齐鲁非遗图志 · 应用控制
   ========================================================================== */
(function (window, document) {
  'use strict';

  var D = window.SD_ICH, G = window.SD_GEO, V = window.Views;
  var App = {};
  var state = {
    view: '',
    map: null,
    mapMode: 'density',
    labelsOn: true,
    city: null,
    county: null,
    sideQuery: '',
    index: { q: '', level: '', cat: '', city: '', batch: '', shown: 48, list: [] },
    searchQ: '',
    searchResults: [],
    searchCur: -1,
    itemTrigger: null,
    itemId: null,
    introDone: false
  };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var toastTimer = null;
  var idxTimer = null;

  function closest(el, sel) {
    while (el && el !== document) {
      if (el.matches && el.matches(sel)) return el;
      if (el.msMatchesSelector && el.msMatchesSelector(sel)) return el;
      el = el.parentNode;
    }
    return null;
  }
  function on(el, ev, fn) { if (el && el.addEventListener) el.addEventListener(ev, fn, false); }
  function debounce(fn, ms) {
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(idxTimer);
      idxTimer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }
  function scrollTop() { window.scrollTo(0, 0); }
  function setView(html) {
    var view = $('#view');
    view.innerHTML = html;
    view.classList.remove('view-enter');
    void view.offsetWidth;
    view.classList.add('view-enter');
    scrollTop();
  }
  function toast(msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-show'); }, 2200);
  }
  function copyText(text) {
    var done = function () { toast('链接已复制，可分享给同学'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'readonly');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动选择地址栏链接'); }
    document.body.removeChild(ta);
  }
  function lockBody(v) {
    document.body.classList[v ? 'add' : 'remove']('is-locked');
  }
  function setTitle(t) { document.title = t; }

  /* ---------------- 路由 ---------------- */
  function parseHash() {
    var raw = window.location.hash || '';
    if (raw.indexOf('#/') === 0) raw = raw.slice(2);
    else if (raw.indexOf('#') === 0) raw = raw.slice(1);
    raw = raw.split('?')[0];
    var parts = raw.split('/').filter(function (x) { return x !== ''; });
    var view = parts[0] || 'home';
    if (view === 'map') return { view: 'map', city: parts[1] || '', county: parts[2] || '' };
    if (view === 'index' || view === 'cats' || view === 'about') return { view: view };
    return { view: 'home' };
  }
  function navActive(view) {
    $$('[data-nav]').forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-nav') === view);
    });
  }
  function route() {
    if ($('#item-modal')) closeItem(false);
    if ($('#search-modal')) closeSearch();
    var r = parseHash();
    var prev = state.view;
    var isMap = r.view === 'map';
    if (prev === 'map' && !isMap) {
      if (state.map && state.map.destroy) state.map.destroy();
      state.map = null;
      state.city = null;
      state.county = null;
    }
    state.view = r.view;
    navActive(r.view);
    if (r.view === 'home') {
      setView(V.home());
      setTitle('齐鲁非遗图志 · 山河为卷，非遗为脉');
      V.countUp($('#view'));
    } else if (r.view === 'map') {
      if (state.map && $('#map-main')) applyMapRoute(r);
      else renderMapPage(r);
    } else if (r.view === 'index') {
      renderIndexPage();
      setTitle('名录检索 · 齐鲁非遗图志');
    } else if (r.view === 'cats') {
      setView(V.catsPage());
      setTitle('门类图谱 · 齐鲁非遗图志');
    } else {
      setView(V.aboutPage());
      setTitle('关于这本图志 · 齐鲁非遗图志');
    }
  }

  /* ---------------- 地图 ---------------- */
  function renderMapPage(r) {
    setView(V.mapPage());
    var mapRoot = $('#map-main');
    if (!mapRoot) return;
    state.mapMode = 'density';
    state.labelsOn = true;
    state.city = null;
    state.county = null;
    state.sideQuery = '';
    state.map = new window.SDMap({
      root: mapRoot, ich: D, geo: G,
      on: {
        selectCounty: function (code) { selectCounty(code, true, true); },
        selectCity: function (code) { selectCity(code, true, true); },
        hover: function () {},
        zoom: function (k) {
          var el = $('#map-zoomval');
          if (el) el.textContent = '× ' + (k < 10 ? k.toFixed(1) : Math.round(k));
        },
        legend: function (mode) {
          var el = $('#map-legend');
          if (el) el.innerHTML = V.legend(mode);
        }
      }
    });
    var legend = $('#map-legend');
    if (legend) legend.innerHTML = V.legend('density');
    renderSide();
    renderCityStrip();
    renderBreadcrumb();
    applyMapRoute(r);
    closeSide();
    setTitle('非遗地图 · 齐鲁非遗图志');
  }

  function applyMapRoute(r) {
    var city = (r.city && V.cityBy[r.city]) ? r.city : '';
    var county = (r.county && V.countyBy[r.county]) ? r.county : '';
    if (county) city = V.countyBy[county].t;
    if (county) {
      if (state.county === county && state.city === city) return;
      selectCounty(county, false, true);
    } else if (city) {
      if (state.city === city && !state.county) return;
      selectCity(city, false, true);
    } else {
      if (!state.city && !state.county) return;
      clearSelection(false, true);
    }
  }

  function selectCounty(code, push, focus) {
    var meta = V.countyBy[code];
    if (!meta || !state.map) return;
    state.city = meta.t;
    state.county = code;
    var off = mapOffset();
    state.map.setViewOffset(off[0], off[1]);
    state.map.setSelection(meta.t, code, focus !== false);
    closeSide();
    renderSide();
    renderBreadcrumb();
    renderDetail();
    if (push) {
      var h = '#/map/' + meta.t + '/' + code;
      if (window.location.hash !== h) window.location.hash = h;
    }
    var c = V.cityBy[meta.t];
    setTitle(meta.n + (c ? ' · ' + c.n : '') + ' · 齐鲁非遗图志');
  }

  function selectCity(code, push, focus) {
    var meta = V.cityBy[code];
    if (!meta || !state.map) return;
    state.city = code;
    state.county = null;
    var off = mapOffset();
    state.map.setViewOffset(off[0], off[1]);
    state.map.setSelection(code, null, focus !== false);
    closeSide();
    renderSide();
    renderBreadcrumb();
    renderDetail();
    if (push) {
      var h = '#/map/' + code;
      if (window.location.hash !== h) window.location.hash = h;
    }
    setTitle(meta.n + '非遗 · 齐鲁非遗图志');
  }

  function clearSelection(push, focus) {
    state.city = null;
    state.county = null;
    if (state.map) {
      state.map.setViewOffset(0, 0);
      state.map.setSelection(null, null, focus !== false);
    }
    closeSide();
    renderSide();
    renderBreadcrumb();
    renderDetail();
    if (push) {
      if (window.location.hash !== '#/map') window.location.hash = '#/map';
    }
    setTitle('非遗地图 · 齐鲁非遗图志');
  }

  function goBackMap() {
    if (!state.map) return;
    if (state.county) selectCity(state.city, true, true);
    else if (state.city) clearSelection(true, true);
  }

  function mapOffset() {
    if (window.innerWidth > 960) {
      var pw = Math.min(410, window.innerWidth * 0.38);
      return [pw / 2, 0];
    }
    return [0, 205];
  }

  function renderSide() {
    var body = $('#map-side-body');
    if (!body) return;
    var html;
    if (state.sideQuery) html = V.mapSearchResults(state.sideQuery);
    else if (state.city) html = V.citySide(V.cityBy[state.city]);
    else html = V.cityList('');
    body.innerHTML = html;
    if (state.city && !state.sideQuery) {
      var act = body.querySelector('[data-city="' + state.city + '"]');
      if (act) act.classList.add('is-active');
    }
    body.scrollTop = 0;
    renderCityStrip();
  }

  function renderBreadcrumb() {
    var el = $('#map-breadcrumb');
    if (!el) return;
    el.innerHTML = V.breadcrumb(state.city ? V.cityBy[state.city] : null, state.county ? V.countyBy[state.county] : null);
    var q = $('#map-q');
    if (q) q.value = state.sideQuery;
    var wrap = $('#map-search-wrap');
    if (wrap) wrap.classList.toggle('has-value', !!state.sideQuery);
  }

  function renderCityStrip() {
    var el = $('#map-city-strip');
    if (el) el.innerHTML = V.cityStrip(state.city);
  }

  function renderDetail() {
    var panel = $('#detail-panel');
    if (!panel) return;
    var main = $('#map-main');
    if (main) main.classList.toggle('has-selection', !!(state.city || state.county));
    if (state.county) {
      panel.innerHTML = V.countyPanel(state.county);
      panel.classList.add('is-open');
    } else if (state.city) {
      panel.innerHTML = V.cityPanel(state.city);
      panel.classList.add('is-open');
    } else {
      panel.classList.remove('is-open');
    }
  }

  function openSide() {
    var panel = $('#detail-panel');
    if (panel) panel.classList.remove('is-open');
    var side = $('#map-side');
    if (side) side.classList.add('is-open');
  }
  function closeSide() {
    var side = $('#map-side');
    if (side) side.classList.remove('is-open');
  }
  function toggleMode() {
    state.mapMode = state.mapMode === 'density' ? 'category' : 'density';
    if (state.map) state.map.setMode(state.mapMode);
    var btn = $('#tool-mode');
    if (btn) btn.classList.toggle('is-on', true);
    toast(state.mapMode === 'density' ? '着色：县区项目数量' : '着色：项目主门类');
  }
  function toggleLabels() {
    state.labelsOn = !state.labelsOn;
    if (state.map) state.map.setLabels(state.labelsOn);
    var btn = $('#tool-labels');
    if (btn) btn.classList.toggle('is-on', state.labelsOn);
  }

  /* ---------------- 名录 ---------------- */
  function searchText(p) {
    if (p._s) return p._s;
    var a = [p.name, p.cat];
    var i;
    if (p.n) for (i = 0; i < p.n.length; i++) a.push(p.n[i].d || '', p.n[i].u || '');
    if (p.u) for (i = 0; i < p.u.length; i++) a.push(p.u[i][0] || '');
    if (p.cs) for (i = 0; i < p.cs.length; i++) a.push(V.countyName(p.cs[i]), V.cityName(V.countyCity(p.cs[i])));
    if (p.ts) for (i = 0; i < p.ts.length; i++) a.push(V.cityName(p.ts[i]));
    if (p.pb) a = a.concat(p.pb);
    if (p.nb) a = a.concat(p.nb);
    if (p.cb) a = a.concat(p.cb);
    if (p.xb) a = a.concat(p.xb);
    if (p.r) for (i = 0; i < p.r.length; i++) a.push(p.r[i].d || '', p.r[i].u || '');
    p._s = a.join(' ').toLowerCase();
    return p._s;
  }

  function filterProjects() {
    var st = state.index;
    var q = (st.q || '').trim().toLowerCase();
    var tokens = q ? q.split(/\s+/) : [];
    var out = [], i, p, ok, j;
    for (i = 0; i < D.projects.length; i++) {
      p = D.projects[i];
      if (st.level && p.level !== st.level) continue;
      if (st.cat && p.cat !== st.cat) continue;
      if (st.city && p.ts.indexOf(st.city) < 0) continue;
      if (st.batch && (p.nb || []).indexOf(st.batch) < 0 && (p.pb || []).indexOf(st.batch) < 0 && (p.cb || []).indexOf(st.batch) < 0 && (p.xb || []).indexOf(st.batch) < 0) continue;
      if (tokens.length) {
        var s = searchText(p);
        ok = true;
        for (j = 0; j < tokens.length; j++) if (s.indexOf(tokens[j]) < 0) { ok = false; break; }
        if (!ok) continue;
      }
      out.push(p);
    }
    return out;
  }

  function renderIndexPage() {
    setView(V.indexPage(state.index));
    restoreIndexUI();
    applyIndex(true);
  }

  function restoreIndexUI() {
    var st = state.index;
    var q = $('#idx-q');
    if (q) q.value = st.q;
    var wrap = $('#idx-search-wrap');
    if (wrap) wrap.classList.toggle('has-value', !!st.q);
    $$('#idx-level button').forEach(function (b) {
      b.classList.toggle('is-active', (b.getAttribute('data-level') || '') === st.level);
    });
    $$('#idx-cats .chip').forEach(function (b) {
      b.classList.toggle('is-active', (b.getAttribute('data-cat') || '') === st.cat);
    });
    var city = $('#idx-city'); if (city) city.value = st.city;
    var batch = $('#idx-batch'); if (batch) batch.value = st.batch;
  }

  function applyIndex(reset) {
    if (reset) state.index.shown = 48;
    var list = filterProjects();
    state.index.list = list;
    var shown = Math.min(state.index.shown, list.length);
    var slice = list.slice(0, shown);
    var box = $('#index-results');
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="big">没有找到匹配的项目</div><p>试试更短的关键词，或点击“重置筛选”。</p><button class="btn btn-ghost btn-sm" type="button" id="idx-empty-reset" style="margin-top:18px">重置筛选</button></div>';
    } else {
      box.innerHTML = V.renderCards(slice, state.index.q);
    }
    var cnt = $('#idx-count'); if (cnt) cnt.textContent = list.length;
    var note = $('#idx-filter-note');
    if (note) {
      var lc = { n: 0, p: 0, c: 0, x: 0 };
      for (var i = 0; i < list.length; i++) { if (lc[list[i].level] != null) lc[list[i].level]++; }
      note.textContent = list.length ? '· 国家 ' + lc.n + ' / 省 ' + lc.p + ' / 市 ' + lc.c + ' / 县 ' + lc.x : '';
    }
    var more = $('#idx-more-wrap');
    if (more) more.style.display = shown < list.length ? 'flex' : 'none';
    var moreBtn = $('#idx-more');
    if (moreBtn) moreBtn.textContent = '加载更多（还有 ' + (list.length - shown) + ' 个）';
  }

  function setIndexFilter(k, v) {
    state.index[k] = v;
    state.index.shown = 48;
    restoreIndexUI();
    applyIndex(true);
  }

  function gotoIndex(opts) {
    opts = opts || {};
    state.index = {
      q: opts.q || '', level: opts.level || '', cat: opts.cat || '',
      city: opts.city || '', batch: opts.batch || '', shown: 48, list: []
    };
    if (window.location.hash === '#/index') renderIndexPage();
    else window.location.hash = '#/index';
  }

  /* ---------------- 搜索弹层 ---------------- */
  function openSearch() {
    if ($('#item-modal')) closeItem(false);
    if ($('#search-modal')) return;
    var root = $('#modal-root');
    root.innerHTML = V.searchModal();
    var modal = $('#search-modal');
    window.requestAnimationFrame(function () { modal.classList.add('is-open'); });
    lockBody(true);
    state.searchQ = '';
    state.searchCur = -1;
    state.searchResults = [];
    var input = $('#global-search-input');
    if (input) setTimeout(function () { input.focus(); }, 30);
  }
  function closeSearch() {
    var modal = $('#search-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    setTimeout(function () {
      if (!modal.classList.contains('is-open')) {
        if ($('#search-modal') === modal) $('#modal-root').innerHTML = '';
        if (!$('#item-modal')) lockBody(false);
      }
    }, 240);
  }
  function renderSearch(q) {
    var box = $('#search-results');
    if (!box) return;
    q = (q || '').trim();
    state.searchQ = q;
    state.searchCur = -1;
    if (!q) {
      box.innerHTML = '<div class="search-empty">输入项目名称、技艺、城市或保护单位，检索 ' + V.num(D.meta.counts.projects) + ' 个项目</div>';
      state.searchResults = [];
      return;
    }
    var tokens = q.toLowerCase().split(/\s+/);
    var out = [], i, p, ok, j;
    for (i = 0; i < D.projects.length && out.length < 12; i++) {
      p = D.projects[i];
      var s = searchText(p);
      ok = true;
      for (j = 0; j < tokens.length; j++) if (s.indexOf(tokens[j]) < 0) { ok = false; break; }
      if (ok) out.push(p);
    }
    state.searchResults = out;
    if (!out.length) {
      box.innerHTML = '<div class="search-empty">没有找到“' + V.esc(q) + '”。<br>试试“风筝”“吕剧”“曲阜”。</div>';
      return;
    }
    var html = [];
    for (i = 0; i < out.length; i++) {
      p = out[i];
      html.push('<button class="search-result' + (i === 0 ? ' is-cur' : '') + '" type="button" data-id="' + p.id + '">' +
        '<span class="sr-dot" style="background:' + V.catColor(p.cat) + '"></span>' +
        '<span class="sr-main"><span class="sr-name">' + V.hl(p.name, q) + '</span>' +
        '<span class="sr-meta">' + V.esc(p.cat) + '<span class="dotsep"></span>' + (p.level === 'n' ? '国家级' : '省级') + '<span class="dotsep"></span>' + V.esc(V.locLabel(p, 2)) + '</span></span>' +
        '<span class="sr-go"><svg class="ic"><use href="#i-arrow"/></svg></span></button>');
    }
    box.innerHTML = html.join('');
    state.searchCur = 0;
  }
  function moveSearchCur(delta) {
    var rows = $$('#search-results .search-result');
    if (!rows.length) return;
    state.searchCur = (state.searchCur + delta + rows.length) % rows.length;
    rows.forEach(function (r, i) { r.classList.toggle('is-cur', i === state.searchCur); });
    if (rows[state.searchCur].scrollIntoView) rows[state.searchCur].scrollIntoView({ block: 'nearest' });
  }

  /* ---------------- 项目弹层 ---------------- */
  function openItem(id, trigger) {
    var p = V.projectById(id);
    if (!p) return;
    var county = state.county && p.cs && p.cs.indexOf(state.county) >= 0 ? state.county : (p.cs && p.cs[0] ? p.cs[0] : '');
    if ($('#search-modal')) closeSearch();
    var root = $('#modal-root');
    root.innerHTML = V.itemModal(p, county);
    var modal = $('#item-modal');
    window.requestAnimationFrame(function () { modal.classList.add('is-open'); });
    lockBody(true);
    state.itemTrigger = trigger || null;
    state.itemId = p.id;
    var card = modal.querySelector('.modal-card');
    if (card) setTimeout(function () { card.focus(); }, 40);
  }
  function closeItem(restoreFocus) {
    var modal = $('#item-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    var trig = state.itemTrigger;
    setTimeout(function () {
      if (!modal.classList.contains('is-open')) {
        if ($('#item-modal') === modal) $('#modal-root').innerHTML = '';
        if (!$('#search-modal')) lockBody(false);
      }
    }, 240);
    state.itemTrigger = null;
    state.itemId = null;
    if (restoreFocus !== false && trig && trig.focus) {
      try { trig.focus(); } catch (e) {}
    }
  }

  /* ---------------- 开场 ---------------- */
  function hideIntro() {
    var el = $('#intro');
    if (!el || state.introDone) return;
    state.introDone = true;
    try { window.sessionStorage.setItem('sd_atlas_intro', '1'); } catch (e) {}
    el.classList.add('is-done');
    setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 1100);
  }
  function setupIntro() {
    var el = $('#intro');
    if (!el) return;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var seen = false;
    try { seen = window.sessionStorage.getItem('sd_atlas_intro') === '1'; } catch (e) {}
    if (seen || reduced) { hideIntro(); return; }
    var r = parseHash();
    var delay = r.view === 'home' ? 1650 : 520;
    setTimeout(hideIntro, delay);
    on(el, 'click', hideIntro);
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
    window.addEventListener('hashchange', route);
    window.addEventListener('scroll', function () {
      var tb = $('#topbar');
      if (tb) tb.classList.toggle('is-scrolled', (window.pageYOffset || document.documentElement.scrollTop || 0) > 8);
    });
    window.addEventListener('resize', function () {
      if (state.sideQuery) return;
    });

    document.addEventListener('click', function (e) {
      var t = e.target;
      var el;
      if ((el = closest(t, '[data-dp-close]'))) { goBackMap(); return; }
      if ((el = closest(t, '#dp-close'))) { goBackMap(); return; }
      if ((el = closest(t, '[data-id]'))) {
        if ($('#search-modal') && closest(t, '#search-results')) { closeSearch(); }
        openItem(el.getAttribute('data-id'), el);
        return;
      }
      if ((el = closest(t, '[data-county]'))) {
        if (!state.map) return;
        selectCounty(el.getAttribute('data-county'), true, true);
        return;
      }
      if ((el = closest(t, '[data-city]'))) {
        if (!state.map) return;
        var code = el.getAttribute('data-city');
        if (!code) clearSelection(true, true);
        else selectCity(code, true, true);
        return;
      }
      if ((el = closest(t, '[data-back]'))) { clearSelection(true, true); return; }
      if ((el = closest(t, '[data-city-index]'))) {
        e.preventDefault();
        gotoIndex({ city: el.getAttribute('data-city-index') });
        return;
      }
      if ((el = closest(t, '[data-cat-jump]'))) {
        gotoIndex({ cat: el.getAttribute('data-cat-jump') });
        return;
      }
      if ((el = closest(t, '#tool-in'))) { if (state.map) state.map.zoomBy(1.4); return; }
      if ((el = closest(t, '#tool-out'))) { if (state.map) state.map.zoomBy(1 / 1.4); return; }
      if ((el = closest(t, '#tool-reset'))) { if (state.map) { clearSelection(true, true); } return; }
      if ((el = closest(t, '#tool-mode'))) { toggleMode(); return; }
      if ((el = closest(t, '#tool-labels'))) { toggleLabels(); return; }
      if ((el = closest(t, '#btn-search'))) { openSearch(); return; }
      if ((el = closest(t, '#btn-side'))) { openSide(); return; }
      if ((el = closest(t, '#side-close'))) { closeSide(); return; }
      if ((el = closest(t, '#map-q-clear'))) {
        state.sideQuery = '';
        renderSide();
        renderBreadcrumb();
        return;
      }
      if ((el = closest(t, '#idx-clear'))) {
        setIndexFilter('q', '');
        var iq = $('#idx-q'); if (iq) { iq.value = ''; iq.focus(); }
        return;
      }
      if ((el = closest(t, '#search-clear'))) {
        var si = $('#global-search-input'); if (si) { si.value = ''; si.focus(); }
        renderSearch('');
        return;
      }
      if ((el = closest(t, '#search-cancel'))) { closeSearch(); return; }
      if ((el = closest(t, '#idx-reset'))) { resetIndex(); return; }
      if ((el = closest(t, '#idx-empty-reset'))) { resetIndex(); return; }
      if ((el = closest(t, '#idx-level button'))) {
        setIndexFilter('level', el.getAttribute('data-level') || '');
        return;
      }
      if ((el = closest(t, '#idx-cats .chip'))) {
        setIndexFilter('cat', el.getAttribute('data-cat') || '');
        return;
      }
      if ((el = closest(t, '#idx-more'))) {
        state.index.shown += 48;
        applyIndex(false);
        return;
      }
      if ((el = closest(t, '#modal-close'))) { closeItem(true); return; }
      if ((el = closest(t, '#modal-share'))) {
        var p = currentModalProject();
        if (p) {
          var u = window.location.href.split('#')[0] + '#/map/' + (p.ts[0] || '') + (p.cs && p.cs[0] ? '/' + p.cs[0] : '');
          copyText(p.name + ' · 齐鲁非遗图志 ' + u);
        }
        return;
      }
      if ((el = closest(t, '#desc-toggle'))) {
        var desc = $('#item-desc');
        if (desc) {
          var clamped = desc.classList.toggle('is-clamped');
          el.innerHTML = clamped ? '展开全文<svg class="ic"><use href="#i-chev"/></svg>' : '收起全文<svg class="ic"><use href="#i-chev"/></svg>';
        }
        return;
      }
      if ((el = closest(t, '#item-modal'))) {
        if (e.target === el) closeItem(true);
        return;
      }
      if ((el = closest(t, '#search-modal'))) {
        if (e.target === el) closeSearch();
        return;
      }
    });

    document.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'map-q') {
        state.sideQuery = t.value.trim();
        renderSide();
        var wrap = $('#map-search-wrap');
        if (wrap) wrap.classList.toggle('has-value', !!state.sideQuery);
      } else if (t.id === 'idx-q') {
        state.index.q = t.value;
        state.index.shown = 48;
        var wrap2 = $('#idx-search-wrap');
        if (wrap2) wrap2.classList.toggle('has-value', !!t.value);
        debounce(function () { applyIndex(true); }, 120)();
      } else if (t.id === 'global-search-input') {
        renderSearch(t.value);
      }
    });

    document.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'idx-city') setIndexFilter('city', t.value);
      else if (t.id === 'idx-batch') setIndexFilter('batch', t.value);
    });

    document.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'Enter' || k === ' ') {
        var cardEl = closest(e.target, '[data-id][role="button"], [data-cat-jump][role="button"]');
        if (cardEl) { e.preventDefault(); cardEl.click(); return; }
      }
      if ((e.ctrlKey || e.metaKey) && (k === 'k' || k === 'K')) {
        e.preventDefault();
        openSearch();
        return;
      }
      if (k === 'Escape') {
        if ($('#item-modal')) { closeItem(true); return; }
        if ($('#search-modal')) { closeSearch(); return; }
        if ($('#map-side') && $('#map-side').classList.contains('is-open')) { closeSide(); return; }
        if (state.map && (state.county || state.city)) { goBackMap(); return; }
      }
      if ($('#search-modal')) {
        var input = $('#global-search-input');
        if (document.activeElement === input) {
          if (k === 'ArrowDown') { e.preventDefault(); moveSearchCur(1); }
          else if (k === 'ArrowUp') { e.preventDefault(); moveSearchCur(-1); }
          else if (k === 'Enter') {
            e.preventDefault();
            if (state.searchResults.length && state.searchCur >= 0) {
              var p = state.searchResults[state.searchCur];
              closeSearch();
              openItem(p.id, null);
            } else {
              var q = input.value.trim();
              closeSearch();
              gotoIndex({ q: q });
            }
          }
        }
      }
      if ($('#item-modal')) {
        if (k === 'ArrowLeft' || k === 'ArrowRight') {
          // allow reading, no-op
        }
      }
    });
  }

  function resetIndex() {
    state.index = { q: '', level: '', cat: '', city: '', batch: '', shown: 48, list: [] };
    restoreIndexUI();
    applyIndex(true);
  }
  function currentModalProject() {
    if (!state.itemId) return null;
    return V.projectById(state.itemId);
  }

  /* ---------------- 启动 ---------------- */
  function fatal(msg) {
    var v = $('#view');
    if (v) v.innerHTML = '<div class="page"><div class="empty-state" style="padding-top:120px"><div class="big">页面载入遇到问题</div><p>' + msg + '</p></div></div>';
  }
  function init() {
    if (!D || !G) { fatal('数据文件未能载入，请确认 js/data.geo.js 与 js/data.ich.js 完整。'); return; }
    try {
      bind();
      route();
      setupIntro();
    } catch (e) {
      if (window.console && console.error) console.error(e);
      fatal('请使用较新的 Chrome、Edge、Firefox 或 Safari 浏览器重试。');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.SDApp = { state: state, route: route, openItem: openItem, gotoIndex: gotoIndex, toast: toast };
})(window, document);
