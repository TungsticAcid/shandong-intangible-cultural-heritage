/* ==========================================================================
   齐鲁非遗图志 · 视图与内容渲染
   ========================================================================== */
(function (window, document) {
  'use strict';

  var D = window.SD_ICH;
  var G = window.SD_GEO;
  var Views = {};

  var CAT_ICON = {
    '民间文学': 'i-book', '传统音乐': 'i-music', '传统舞蹈': 'i-dance',
    '传统戏剧': 'i-opera', '曲艺': 'i-quyi', '传统体育、游艺与杂技': 'i-sports',
    '传统美术': 'i-art', '传统技艺': 'i-craft', '传统医药': 'i-medicine', '民俗': 'i-custom'
  };

  var P_BY_ID = {}, P_INDEX = {}, CITY_BY = {}, COUNTY_BY = {}, CAT_BY = {};
  (function init() {
    var i;
    for (i = 0; i < D.projects.length; i++) {
      P_BY_ID[D.projects[i].id] = D.projects[i];
      P_INDEX[D.projects[i].id] = i;
    }
    for (i = 0; i < D.cities.length; i++) CITY_BY[D.cities[i].c] = D.cities[i];
    for (i = 0; i < D.counties.length; i++) COUNTY_BY[D.counties[i].c] = D.counties[i];
    for (i = 0; i < D.cats.length; i++) CAT_BY[D.cats[i].k] = D.cats[i];
  })();

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function catColor(k) { return (CAT_BY[k] && CAT_BY[k].col) || '#8B5E3C'; }
  function catIcon(k) { return CAT_ICON[k] || 'i-book'; }
  function catEn(k) { return (CAT_BY[k] && CAT_BY[k].en) || ''; }
  function cityName(code) { return (CITY_BY[code] && CITY_BY[code].n) || ''; }
  function countyName(code) { return (COUNTY_BY[code] && COUNTY_BY[code].n) || ''; }
  function countyCity(code) { return (COUNTY_BY[code] && COUNTY_BY[code].t) || ''; }
  function project(id) { return P_BY_ID[id]; }
  function hl(s, q) {
    s = esc(s);
    if (!q) return s;
    var toks = String(q).split(/\s+/), i, re;
    for (i = 0; i < toks.length; i++) {
      if (!toks[i]) continue;
      re = new RegExp('(' + escRe(toks[i]) + ')', 'gi');
      s = s.replace(re, '<mark>$1</mark>');
    }
    return s;
  }
  function locLabel(p, max) {
    var names = [], i;
    if (p.cs && p.cs.length) {
      for (i = 0; i < p.cs.length; i++) names.push(countyName(p.cs[i]));
      if (max && names.length > max) return names.slice(0, max).join('、') + ' 等 ' + names.length + ' 地';
      return names.join('、');
    }
    if (p.ts && p.ts.length) {
      for (i = 0; i < p.ts.length; i++) names.push(cityName(p.ts[i]));
      return names.join('、') + (names.length === 1 ? '（市本级）' : '');
    }
    return '省直 / 跨区域';
  }
  function firstCity(p) {
    if (p.ts && p.ts.length) return p.ts[0];
    if (p.cs && p.cs.length) return countyCity(p.cs[0]);
    return '';
  }
  function firstCounty(p) {
    return (p.cs && p.cs.length) ? p.cs[0] : '';
  }
  function batchLine(p) {
    var a = [];
    if (p.nb && p.nb.length) a.push('国家级 ' + p.nb.join('、'));
    if (p.pb && p.pb.length) a.push('省级 ' + p.pb.join('、'));
    if (p.cb && p.cb.length) a.push('市级 ' + p.cb.join('、'));
    if (p.xb && p.xb.length) a.push('县级 ' + p.xb.join('、'));
    return a.join(' · ');
  }
  var LEVEL_NAMES = { n: '国家级', p: '省级', c: '市级', x: '县级' };
  function levelName(lv) { return LEVEL_NAMES[lv] || '未定级'; }
  function levelBadge(p) {
    var lv = p.level || (p.nb && p.nb.length ? 'n' : 'p');
    var cls = lv === 'n' ? 'nat' : (lv === 'p' ? 'prov' : (lv === 'c' ? 'city' : 'county'));
    return '<span class="badge ' + cls + '">' + levelName(lv) + '</span>';
  }
  function levelBadges(p) {
    var out = [], i, lv, bs;
    if (!p.levels || !p.levels.length) return levelBadge(p);
    for (i = 0; i < p.levels.length; i++) {
      lv = p.levels[i];
      bs = lv === 'c' ? p.cb : (lv === 'x' ? p.xb : null);
      out.push('<span class="badge ' + (lv === 'n' ? 'nat' : (lv === 'p' ? 'prov' : (lv === 'c' ? 'city' : 'county'))) + '">' + levelName(lv) + (bs && bs.length ? ' ' + bs[0] : '') + '</span>');
    }
    return out.join('');
  }
  function levelStats(items) {
    var st = { n: 0, p: 0, c: 0, x: 0 }, i, p;
    for (i = 0; i < items.length; i++) {
      p = D.projects[items[i]];
      if (p && st[p.level] != null) st[p.level]++;
    }
    return st;
  }
  function descOf(p, county) {
    var i, n;
    if (!p.n || !p.n.length) return '';
    if (county) {
      for (i = 0; i < p.n.length; i++) {
        n = p.n[i];
        if (n.c === county && n.k && D.descs[n.k]) return D.descs[n.k];
      }
    }
    for (i = 0; i < p.n.length; i++) {
      n = p.n[i];
      if (n.k && D.descs[n.k]) return D.descs[n.k];
    }
    return '';
  }
  function descByKey(k) { return (k && D.descs[k]) || ''; }
  function paragraphs(text) {
    if (!text) return [];
    return String(text).split(/\n+/).filter(function (x) { return x.replace(/\s/g, ''); });
  }

  /* ---------------- 数据索引供 app 使用 ---------------- */
  Views.data = {
    projects: D.projects, cities: D.cities, counties: D.counties,
    projectById: project, cityBy: CITY_BY, countyBy: COUNTY_BY, catBy: CAT_BY,
    catColor: catColor, catIcon: catIcon, cityName: cityName, countyName: countyName,
    countyCity: countyCity, locLabel: locLabel, batchLine: batchLine, descOf: descOf,
    esc: esc, hl: hl, num: num, levelBadge: levelBadge, levelBadges: levelBadges,
    levelName: levelName, levelStats: levelStats, paragraphs: paragraphs
  };

  /* ---------------- 首页 ---------------- */
  function heroMapSvg() {
    var out = [], i, c, st, hot;
    out.push('<svg viewBox="0 0 ' + G.vb[0] + ' ' + G.vb[1] + '" preserveAspectRatio="xMidYMid meet" class="hero-svg" aria-hidden="true">');
    out.push('<g class="hero-cities">');
    for (i = 0; i < G.cities.length; i++) {
      c = G.cities[i];
      st = null;
      for (var j = 0; j < D.cities.length; j++) if (D.cities[j].c === c.c) st = D.cities[j];
      hot = st && st.items.length >= 90 ? ' hot' : (st && st.items.length >= 65 ? ' warm' : '');
      out.push('<a href="#/map/' + c.c + '" aria-label="' + esc(c.n) + '"><path class="hero-city' + hot + '" d="' + c.d + '"></path></a>');
    }
    out.push('</g>');
    out.push('<g class="hero-dots">');
    for (i = 0; i < G.cities.length; i++) {
      c = G.cities[i];
      out.push('<a href="#/map/' + c.c + '" aria-label="进入' + esc(c.n) + '地图"><circle class="hero-dot" cx="' + c.l[0] + '" cy="' + c.l[1] + '" r="6"></circle></a>');
    }
    out.push('</g>');
    var anchors = ['370100', '370200', '370600', '370700', '371700', '370800'];
    out.push('<g class="hero-labels">');
    for (i = 0; i < G.cities.length; i++) {
      c = G.cities[i];
      if (anchors.indexOf(c.c) < 0) continue;
      var dx = c.c === '370200' ? 12 : (c.c === '370600' ? 8 : 0);
      var dy = c.c === '370100' ? -10 : (c.c === '371700' ? 18 : 14);
      out.push('<text x="' + (c.l[0] + dx) + '" y="' + (c.l[1] + dy) + '" text-anchor="middle">' + esc(c.n) + '</text>');
    }
    out.push('</g>');
    out.push('</svg>');
    return out.join('');
  }

  Views.home = function () {
    var c = D.meta.counts;
    var stats = [
      { n: c.cities, unit: '市', label: '十六市' },
      { n: c.counties, unit: '县区', label: '县（市、区）' },
      { n: c.nationalRecords, unit: '条', label: '国家级项目记录' },
      { n: c.provincialRecords, unit: '条', label: '省级名录记录' }
    ];
    var i, s, strip = [], cats = D.cats;
    for (i = 0; i < cats.length; i++) {
      strip.push('<span class="strip-item"><svg class="ic"><use href="#' + catIcon(cats[i].k) + '"/></svg>' + esc(cats[i].k) + '<em>' + esc(cats[i].en) + '</em></span>');
    }
    var statsHtml = '';
    for (i = 0; i < stats.length; i++) {
      s = stats[i];
      statsHtml += '<div class="hero-stat"><b data-count="' + s.n + '">' + num(s.n) + '<i>' + s.unit + '</i></b><span>' + s.label + '</span></div>';
    }
    var featured = featuredProjects();
    var featHtml = '';
    for (i = 0; i < featured.length; i++) {
      featHtml += projectCard(featured[i], '', true);
    }
    return '' +
      '<div class="home">' +
        '<section class="home-hero">' +
          '<div class="hero-ink"></div><div class="hero-ink2"></div>' +
          '<div class="hero-watermark" aria-hidden="true">齊</div>' +
          '<div class="hero-copy">' +
            '<div class="hero-kicker"><span class="stamp">山河<br>为卷</span><p>SHANDONG · INTANGIBLE CULTURAL HERITAGE</p></div>' +
            '<h1 class="hero-title"><span class="row">齐鲁</span><span class="row"><span class="accent">非遗</span><span class="small-char">图志</span></span></h1>' +
            '<p class="hero-lead">从泰山之巅到黄海之滨，把散落在 <b>16 市、136 个县（市、区）</b>的非遗，放回它们生长的土地。点击地图，读一项技艺，也读一方水土。</p>' +
            '<div class="hero-cta"><a class="btn btn-primary" href="#/map">展开地图<svg class="ic"><use href="#i-arrow"/></svg></a><a class="btn btn-ghost" href="#/index">检索名录</a></div>' +
            '<div class="hero-stats">' + statsHtml + '</div>' +
            '<div class="hero-note">另收录市级 ' + num(c.cityRecords) + ' 条、县级 ' + num(c.countyRecords) + ' 条公开名录记录</div>' +
          '</div>' +
          '<div class="hero-visual">' +
            '<div class="hero-frame">' +
              '<div class="hero-map-wrap">' + heroMapSvg() + '</div>' +
              '<svg class="hero-compass" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="36" fill="none" stroke="rgba(33,29,24,.25)"/><path d="M50 16l5 30-5-6-5 6z" fill="#a5342a"/><path d="M50 84l-5-30 5 6 5-6z" fill="rgba(33,29,24,.45)"/><text x="50" y="12" text-anchor="middle" font-size="8" fill="rgba(33,29,24,.6)">N</text></svg>' +
              '<div class="hero-frame-cap">十六市 · 一百三十六县区</div>' +
              '<div class="hero-stamp-bottom">齐鲁<br>非遗</div>' +
            '</div>' +
            '<div class="hero-vertical">山河为卷 · 非遗为脉</div>' +
          '</div>' +
        '</section>' +
        '<div class="home-strip"><div class="home-strip-inner">' + strip.join('') + strip.join('') + '</div></div>' +
        '<section class="home-sections">' +
          '<div class="section-head"><div><div class="eyebrow"><span class="num">01</span> THREE WAYS IN</div><h2>三种读法，走进齐鲁非遗</h2><p>地图看分布，名录看项目，门类看谱系。数据覆盖国家级、省级、市级、县级公开名录，逐条回溯官方来源。</p></div><a href="#/about">了解数据与方法</a></div>' +
          '<div class="home-gate">' +
            '<a class="gate-card" href="#/map"><span class="g-num">壹</span><span class="g-ic"><svg class="ic"><use href="#i-map"/></svg></span><h3>在地图上寻访</h3><p>缩放、平移山东全图，点击任一县（市、区），查看落在这一方水土上的非遗项目。</p><span class="g-go">进入地图<svg class="ic"><use href="#i-arrow"/></svg></span></a>' +
            '<a class="gate-card" href="#/index"><span class="g-num">贰</span><span class="g-ic"><svg class="ic"><use href="#i-list"/></svg></span><h3>沿名录去检索</h3><p>按名称、门类、城市、级别、批次筛选 ' + num(c.projects) + ' 条四级名录条目，查看保护单位与官方档案。</p><span class="g-go">打开名录<svg class="ic"><use href="#i-arrow"/></svg></span></a>' +
            '<a class="gate-card" href="#/cats"><span class="g-num">叁</span><span class="g-ic"><svg class="ic"><use href="#i-grid"/></svg></span><h3>按门类看谱系</h3><p>民间文学、传统音乐、传统美术……十个门类的分布与代表项目，一眼看清齐鲁非遗的结构。</p><span class="g-go">浏览门类<svg class="ic"><use href="#i-arrow"/></svg></span></a>' +
          '</div>' +
        '</section>' +
        '<section class="home-sections" style="padding-top:0">' +
          '<div class="section-head"><div><div class="eyebrow"><span class="num">02</span> SELECTED PROJECTS</div><h2>从名录里挑几件</h2><p>每件作品都注明所在县区、批次与保护单位；点击可读项目档案。</p></div><a href="#/index">查看全部 ' + num(c.projects) + ' 条</a></div>' +
          '<div class="pgrid pgrid-3">' + featHtml + '</div>' +
        '</section>' +
        '<section class="home-sections" style="padding-top:0">' +
          '<div class="source-strip">' +
            '<div class="source-strip-main"><div class="eyebrow"><span class="num">03</span> OPEN SOURCES</div><h2>数据来源</h2></div>' +
            '<div class="source-strip-links"><a class="source-pill" href="https://www.ihchina.cn/" target="_blank" rel="noopener">中国非物质文化遗产网<svg class="ic"><use href="#i-external"/></svg></a><a class="source-pill" href="' + D.meta.datasetUrl + '" target="_blank" rel="noopener">山东公共数据开放网<svg class="ic"><use href="#i-external"/></svg></a><a class="source-pill" href="http://bzdt.ch.mnr.gov.cn/" target="_blank" rel="noopener">标准地图服务<svg class="ic"><use href="#i-external"/></svg></a></div>' +
          '</div>' +
        '</section>' +
        '<div class="home-foot"><span>齐鲁非遗图志 · 山河为卷，非遗为脉</span><span>仅作文化传播展示</span></div>' +
      '</div>';
  };

  function featuredProjects() {
    var cats = ['民间文学', '传统美术', '传统技艺', '传统戏剧', '传统音乐', '民俗'];
    var out = [], i, j, p, found;
    for (i = 0; i < cats.length; i++) {
      found = null;
      for (j = 0; j < D.projects.length; j++) {
        p = D.projects[j];
        if (p.cat === cats[i] && p.level === 'n' && descOf(p)) { found = p; break; }
      }
      if (!found) {
        for (j = 0; j < D.projects.length; j++) {
          p = D.projects[j];
          if (p.cat === cats[i] && descOf(p)) { found = p; break; }
        }
      }
      if (found) out.push(found);
    }
    return out;
  }

  /* ---------------- 项目卡片 / 行 ---------------- */
  function projectCard(p, q, featured) {
    var desc = descOf(p, firstCounty(p));
    var snippet = desc ? desc.replace(/\s+/g, ' ').slice(0, 76) : '';
    if (!snippet) snippet = (p.pb && p.pb.length ? '省级' + p.pb[0] : '') + (p.u && p.u[0] ? ' · 保护单位：' + p.u[0][0] : '');
    return '<div class="pcard" role="button" tabindex="0" data-id="' + p.id + '" style="--accent:' + catColor(p.cat) + '">' +
      '<div class="pcard-top"><span class="pcard-cat"><i class="cat-dot" style="background:' + catColor(p.cat) + '"></i>' + esc(p.cat) + '</span>' + levelBadge(p) + '</div>' +
      '<h3>' + hl(p.name, q) + '</h3>' +
      '<div class="pcard-loc">' + esc(locLabel(p, 2)) + '</div>' +
      '<div class="pcard-desc">' + esc(snippet) + '</div>' +
      '<div class="pcard-foot"><span class="pcard-batches">' + esc(batchLine(p)) + '</span><span class="pcard-arrow"><svg class="ic"><use href="#i-arrow"/></svg></span></div>' +
      '</div>';
  }

  function itemRow(p, idx, q) {
    var unit = (p.u && p.u[0]) ? p.u[0][0] : '';
    return '<button class="item-row" type="button" data-id="' + p.id + '">' +
      '<span class="ir-idx">' + (idx < 9 ? '0' : '') + (idx + 1) + '</span>' +
      '<span class="ir-main"><span class="ir-name"><b>' + hl(p.name, q) + '</b>' + levelBadge(p) + '</span>' +
      '<span class="ir-meta"><i class="cat-dot" style="background:' + catColor(p.cat) + '"></i>' + esc(p.cat) + '<span class="dotsep"></span>' + esc(batchLine(p)) + (unit ? '<span class="dotsep"></span>' + esc(unit.length > 18 ? unit.slice(0, 18) + '…' : unit) : '') + '</span></span>' +
      '<span class="ir-arrow"><svg class="ic"><use href="#i-arrow"/></svg></span></button>';
  }

  /* ---------------- 地图页骨架 ---------------- */
  Views.mapPage = function () {
    return '' +
      '<div class="map-page" id="map-page">' +
        '<aside class="map-side" id="map-side" aria-label="市域索引">' +
          '<div class="side-top"><div><div class="side-title">市域索引</div><div class="side-sub">16 CITIES · 136 COUNTIES</div></div><button class="side-close" id="side-close" type="button" aria-label="关闭索引"><svg class="ic"><use href="#i-close"/></svg></button></div>' +
          '<div class="map-search" id="map-search-wrap"><svg class="ic"><use href="#i-search"/></svg><input id="map-q" type="search" placeholder="搜索市、县区名称" autocomplete="off"><button class="clear-s" id="map-q-clear" type="button" aria-label="清空"><svg class="ic"><use href="#i-close"/></svg></button></div>' +
          '<div class="side-scroll" id="map-side-body"></div>' +
          '<div class="side-legend-mini">着色：县区条目数量。点击县区查看详情；点击城市名称进入市域视图。</div>' +
        '</aside>' +
        '<div class="map-main" id="map-main">' +
          '<div class="map-toolbar" aria-label="地图工具">' +
            '<button class="map-tool" id="tool-in" type="button" title="放大" aria-label="放大"><svg class="ic"><use href="#i-plus"/></svg></button>' +
            '<button class="map-tool" id="tool-out" type="button" title="缩小" aria-label="缩小"><svg class="ic"><use href="#i-minus"/></svg></button>' +
            '<button class="map-tool" id="tool-reset" type="button" title="复位" aria-label="复位到全省"><svg class="ic"><use href="#i-reset"/></svg></button>' +
            '<button class="map-tool is-on" id="tool-mode" type="button" title="切换着色" aria-label="切换着色方式"><svg class="ic"><use href="#i-layers"/></svg></button>' +
            '<button class="map-tool is-on" id="tool-labels" type="button" title="显示/隐藏标签" aria-label="显示或隐藏标签"><svg class="ic"><use href="#i-locate"/></svg></button>' +
          '</div>' +
          '<div class="map-breadcrumb" id="map-breadcrumb"></div>' +
          '<div class="map-stage-title" aria-hidden="true">山东 · 十六市 · 一百三十六县区</div>' +
          '<div class="map-legend" id="map-legend"></div>' +
          '<div class="map-hint"><svg class="ic"><use href="#i-map"/></svg>滚轮缩放 · 拖拽平移 · 点击县区</div>' +
          '<div class="map-zoomval" id="map-zoomval">× 1.0</div>' +
          '<button class="map-mobile-btn" id="btn-side" type="button"><svg class="ic"><use href="#i-list"/></svg>市域索引</button>' +
          '<div class="map-city-strip" id="map-city-strip" aria-label="城市快捷索引"></div>' +
        '</div>' +
        '<aside class="detail-panel" id="detail-panel" aria-label="非遗项目详情">' +
          '<div class="dp-head"><div class="dp-kicker" id="dp-kicker">SHANDONG</div><h2 class="dp-title" id="dp-title">选择一个县区</h2><div class="dp-sub" id="dp-sub">点击地图或左侧索引开始</div><button class="dp-close" id="dp-close" type="button" aria-label="关闭详情"><svg class="ic"><use href="#i-close"/></svg></button></div>' +
          '<div class="dp-body" id="dp-body"></div>' +
        '</aside>' +
      '</div>';
  };

  /* 移动端城市快捷条 */
  Views.cityStrip = function (cityCode) {
    var out = ['<button class="mcs-chip' + (!cityCode ? ' is-active' : '') + '" type="button" data-city=""><b>全省</b><span>' + num(D.projects.length) + '</span></button>'], i, c;
    for (i = 0; i < D.cities.length; i++) {
      c = D.cities[i];
      out.push('<button class="mcs-chip' + (cityCode === c.c ? ' is-active' : '') + '" type="button" data-city="' + c.c + '"><b>' + esc(c.s) + '</b><span>' + c.items.length + '</span></button>');
    }
    return out.join('');
  };

  /* 左侧城市列表 */
  Views.cityList = function (q) {
    var out = [], i, c, max = 1, filtered = 0;
    q = (q || '').trim();
    for (i = 0; i < D.cities.length; i++) if (D.cities[i].items.length > max) max = D.cities[i].items.length;
    out.push('<div class="side-caption"><span>全省 · 16 市</span><span>' + num(D.projects.length) + ' 条</span></div>');
    out.push('<button class="city-row" type="button" data-city="" data-reset="1"><span class="city-idx">00</span><span class="city-name">山东全省</span><span class="city-count">' + num(D.projects.length) + '</span></button>');
    for (i = 0; i < D.cities.length; i++) {
      c = D.cities[i];
      if (q && c.n.indexOf(q) < 0) {
        var hitCounty = false;
        for (var j = 0; j < c.counties.length; j++) if (countyName(c.counties[j]).indexOf(q) >= 0) hitCounty = true;
        if (!hitCounty) continue;
      }
      filtered++;
      out.push('<button class="city-row" type="button" data-city="' + c.c + '"><span class="city-idx">' + (i + 1 < 10 ? '0' : '') + (i + 1) + '</span><span class="city-name">' + esc(c.n) + '</span><span class="city-count">' + c.items.length + '</span><span class="city-bar"><i style="width:' + Math.max(6, Math.round(c.items.length / max * 100)) + '%"></i></span></button>');
    }
    if (filtered === 0) out.push('<div class="side-empty">没有匹配的市域。<br>试试“济南”“潍坊”“曲阜”。</div>');
    return out.join('');
  };

  /* 左侧城市展开 */
  Views.citySide = function (city) {
    var out = [], i, code, cnt;
    out.push('<button class="side-back" type="button" data-back="1"><svg class="ic"><use href="#i-back"/></svg>返回全省</button>');
    out.push('<div class="side-city-head"><h3>' + esc(city.n) + '</h3><p>' + city.items.length + ' 条 · ' + city.counties.length + ' 个县（市、区）</p></div>');
    out.push('<div class="county-chips">');
    for (i = 0; i < city.counties.length; i++) {
      code = city.counties[i];
      cnt = (COUNTY_BY[code] && COUNTY_BY[code].items.length) || 0;
      out.push('<button class="county-chip" type="button" data-county="' + code + '"><b>' + esc(countyName(code)) + '</b><span>' + cnt + '</span></button>');
    }
    out.push('</div>');
    out.push('<div class="side-legend-mini">点击县区查看该地项目；点击“返回全省”回到十六市索引。</div>');
    return out.join('');
  };

  /* 地图侧栏搜索 */
  Views.mapSearchResults = function (q) {
    q = (q || '').trim();
    if (!q) return Views.cityList('');
    var out = [], i, c, ct, hits = 0;
    out.push('<div class="side-caption"><span>搜索结果</span><span>“' + esc(q) + '”</span></div>');
    for (i = 0; i < D.cities.length; i++) {
      c = D.cities[i];
      if (c.n.indexOf(q) >= 0) {
        hits++;
        out.push('<button class="city-row" type="button" data-city="' + c.c + '"><span class="city-idx">市</span><span class="city-name">' + esc(c.n) + '</span><span class="city-count">' + c.items.length + '</span></button>');
      }
    }
    for (i = 0; i < D.counties.length; i++) {
      ct = D.counties[i];
      if (ct.n.indexOf(q) >= 0) {
        hits++;
        out.push('<button class="city-row" type="button" data-county="' + ct.c + '"><span class="city-idx">区</span><span class="city-name">' + esc(ct.n) + '<em style="font-style:normal;color:var(--ink-4);font-size:10px;margin-left:6px">' + esc(cityName(ct.t)) + '</em></span><span class="city-count">' + ct.items.length + '</span></button>');
      }
      if (hits >= 18) break;
    }
    if (!hits) out.push('<div class="side-empty">没有匹配的市或县区。<br>试试“济南”“曲阜”“寒亭”。</div>');
    return out.join('');
  };

  /* 详情：县区 */
  Views.countyPanel = function (code) {
    var c = COUNTY_BY[code];
    if (!c) return '';
    var city = CITY_BY[c.t];
    var items = c.items.slice().sort(sortProject);
    var st = levelStats(items), i, p;
    var catsMap = {};
    for (i = 0; i < items.length; i++) {
      p = D.projects[items[i]];
      if (!p) continue;
      catsMap[p.cat] = (catsMap[p.cat] || 0) + 1;
    }
    var cats = [];
    for (var k in catsMap) cats.push([k, catsMap[k]]);
    cats.sort(function (a, b) { return b[1] - a[1]; });
    var maxc = cats.length ? cats[0][1] : 1;
    var bars = '', rows = '';
    for (i = 0; i < cats.length; i++) {
      bars += '<div class="catbar"><span class="cb-name">' + esc(cats[i][0]) + '</span><span class="cb-track"><i style="width:' + Math.max(8, Math.round(cats[i][1] / maxc * 100)) + '%;background:' + catColor(cats[i][0]) + '"></i></span><span class="cb-num">' + cats[i][1] + '</span></div>';
    }
    for (i = 0; i < items.length; i++) rows += itemRow(D.projects[items[i]], i, '');
    var levelNote = (city ? '<span>' + esc(city.cn) + '</span> ' : '') +
      '<span>县级名录：' + (c.xc ? '已接入公开数据' : '暂未接入公开数据') + '</span>';
    return '' +
      '<div class="dp-head"><div class="dp-kicker">' + esc(city ? city.n : '') + ' · COUNTY</div>' +
      '<h2 class="dp-title">' + esc(c.n) + '</h2>' +
      '<div class="dp-sub">' + items.length + ' 条四级名录条目 · 国家级 ' + st.n + ' · 省级 ' + st.p + (st.c ? ' · 市级 ' + st.c : '') + (st.x ? ' · 县级 ' + st.x : '') + '</div>' +
      '<button class="dp-close" type="button" data-dp-close="1" aria-label="关闭详情"><svg class="ic"><use href="#i-close"/></svg></button></div>' +
      '<div class="dp-body">' +
      '<div class="dp-stats dp-stats-5"><div class="dp-stat"><b>' + items.length + '</b><span>条目</span></div><div class="dp-stat"><b>' + st.n + '</b><span>国家级</span></div><div class="dp-stat"><b>' + st.p + '</b><span>省级</span></div><div class="dp-stat"><b>' + st.c + '</b><span>市级</span></div><div class="dp-stat"><b>' + st.x + '</b><span>县级</span></div></div>' +
      '<div class="dp-level-note">' + levelNote + '</div>' +
      (bars ? '<div class="dp-section"><div class="dp-section-head"><h4>门类分布</h4><span>' + cats.length + ' 个门类</span></div>' + bars + '</div>' : '') +
      '<div class="dp-section"><div class="dp-section-head"><h4>代表性项目</h4><span>按级别与批次排序</span></div><div class="item-list">' + rows + '</div></div>' +
      (city ? '<a class="dp-official" href="' + esc(city.link) + '" target="_blank" rel="noopener">前往' + esc(city.n) + '政府门户<svg class="ic"><use href="#i-external"/></svg></a>' : '') +
      '<div class="dp-note">项目归属依据保护单位所在地与申报地区整理；同一项目可能跨多个县区。名录认定以官方公布为准。</div>' +
      '</div>';
  };

  /* 详情：市域 */
  Views.cityPanel = function (code) {
    var city = CITY_BY[code];
    if (!city) return '';
    var items = city.items.slice().sort(sortProject);
    var st = levelStats(items), i, p;
    var catsMap = {};
    for (i = 0; i < items.length; i++) {
      p = D.projects[items[i]];
      if (!p) continue;
      catsMap[p.cat] = (catsMap[p.cat] || 0) + 1;
    }
    var cats = [];
    for (var k in catsMap) cats.push([k, catsMap[k]]);
    cats.sort(function (a, b) { return b[1] - a[1]; });
    var maxc = cats.length ? cats[0][1] : 1;
    var bars = '', tiles = '', cityRows = '';
    for (i = 0; i < cats.length; i++) bars += '<div class="catbar"><span class="cb-name">' + esc(cats[i][0]) + '</span><span class="cb-track"><i style="width:' + Math.max(8, Math.round(cats[i][1] / maxc * 100)) + '%;background:' + catColor(cats[i][0]) + '"></i></span><span class="cb-num">' + cats[i][1] + '</span></div>';
    for (i = 0; i < city.counties.length; i++) {
      var cc = city.counties[i];
      var cn = (COUNTY_BY[cc] && COUNTY_BY[cc].items.length) || 0;
      tiles += '<button class="county-tile" type="button" data-county="' + cc + '"><b>' + esc(countyName(cc)) + '</b><span>' + cn + '</span></button>';
    }
    var cityOnly = city.cityItems.slice().sort(sortProject);
    for (i = 0; i < Math.min(cityOnly.length, 10); i++) cityRows += itemRow(D.projects[cityOnly[i]], i, '');
    return '' +
      '<div class="dp-head"><div class="dp-kicker">SHANDONG · CITY</div>' +
      '<h2 class="dp-title">' + esc(city.n) + '</h2>' +
      '<div class="dp-sub">' + city.counties.length + ' 个县（市、区） · ' + items.length + ' 条 · 市级 ' + st.c + ' · 县级 ' + st.x + '</div>' +
      '<button class="dp-close" type="button" data-dp-close="1" aria-label="关闭详情"><svg class="ic"><use href="#i-close"/></svg></button></div>' +
      '<div class="dp-body">' +
      '<div class="dp-intro">' + esc(city.intro) + '</div>' +
      '<div class="dp-stats dp-stats-5"><div class="dp-stat"><b>' + items.length + '</b><span>条目</span></div><div class="dp-stat"><b>' + st.n + '</b><span>国家级</span></div><div class="dp-stat"><b>' + st.p + '</b><span>省级</span></div><div class="dp-stat"><b>' + st.c + '</b><span>市级</span></div><div class="dp-stat"><b>' + st.x + '</b><span>县级</span></div></div>' +
      '<div class="dp-level-note"><span>' + esc(city.cn) + '</span></div>' +
      (bars ? '<div class="dp-section"><div class="dp-section-head"><h4>门类分布</h4><span>' + cats.length + ' 个门类</span></div>' + bars + '</div>' : '') +
      '<div class="dp-section"><div class="dp-section-head"><h4>县区索引</h4><span>点击下钻</span></div><div class="county-grid">' + tiles + '</div></div>' +
      (cityRows ? '<div class="dp-section"><div class="dp-section-head"><h4>市本级申报</h4><span>市级保护单位</span></div><div class="item-list">' + cityRows + '</div></div>' : '') +
      '<a class="dp-official" href="#/index" data-city-index="' + city.c + '">查看' + esc(city.n) + '全部项目<svg class="ic"><use href="#i-arrow"/></svg></a>' +
      '<a class="dp-official" href="' + esc(city.link) + '" target="_blank" rel="noopener">前往' + esc(city.n) + '政府门户<svg class="ic"><use href="#i-external"/></svg></a>' +
      '<div class="dp-note">市域视图聚合本市各县区项目与市本级申报项目；县区页仅显示可归入该县区的项目。</div>' +
      '</div>';
  };

  function sortProject(a, b) {
    var pa = D.projects[a], pb = D.projects[b];
    if (!pa || !pb) return 0;
    var oa = LEVEL_ORDER[pa.level] == null ? 9 : LEVEL_ORDER[pa.level];
    var ob = LEVEL_ORDER[pb.level] == null ? 9 : LEVEL_ORDER[pb.level];
    if (oa !== ob) return oa - ob;
    if (pa.nb.length && pb.nb.length && pa.nb[0] !== pb.nb[0]) {
      return batchOrder(pa.nb[0]) - batchOrder(pb.nb[0]);
    }
    if (pa.pb.length && pb.pb.length && pa.pb[0] !== pb.pb[0]) {
      return batchOrder(pa.pb[0]) - batchOrder(pb.pb[0]);
    }
    return pa.name.localeCompare(pb.name, 'zh');
  }
  var LEVEL_ORDER = { n: 0, p: 1, c: 2, x: 3 };
  function batchOrder(b) {
    var m = { '第一批': 1, '第二批': 2, '第三批': 3, '第四批': 4, '第五批': 5, '第六批': 6, '第七批': 7, '第八批': 8, '第九批': 9, '第十批': 10 };
    return m[b] || 99;
  }

  /* ---------------- 地图图例 ---------------- */
  Views.legend = function (mode) {
    var footer = '<div class="legend-src"><span>边界示意 · 非标准地图</span><a href="#/about">数据说明</a></div>';
    if (mode === 'category') {
      var out = ['<h4>按主门类着色</h4><div class="legend-cats">'], i;
      for (i = 0; i < D.cats.length; i++) {
        out.push('<span class="legend-cat"><i style="background:' + D.cats[i].col + '"></i>' + esc(D.cats[i].k) + '</span>');
      }
      out.push('</div>' + footer);
      return out.join('');
    }
    var bins = D.meta.bins, colors = ['#f0e4cf', '#e7cfb3', '#d5ab8f', '#be8170', '#a15542'];
    var labels = [];
    labels.push('1–' + bins[0]);
    for (var j = 1; j < bins.length; j++) labels.push((bins[j - 1] + 1) + '–' + bins[j]);
    labels.push((bins[bins.length - 1] + 1) + '+');
    var s = '<h4>县区条目数量</h4><div class="legend-scale">';
    for (i = 0; i < colors.length; i++) s += '<i style="background:' + colors[i] + '"></i>';
    s += '</div><div class="legend-labels">';
    for (i = 0; i < labels.length; i++) s += '<span>' + labels[i] + '</span>';
    s += '</div>' + footer;
    return s;
  };

  /* ---------------- 面包屑 ---------------- */
  Views.breadcrumb = function (city, county) {
    var out = ['<a href="#/map">山东</a>'];
    if (!city) {
      out.push('<svg class="ic"><use href="#i-chev"/></svg><span class="cur">全省</span>');
      return out.join('');
    }
    out.push('<svg class="ic"><use href="#i-chev"/></svg>');
    if (county) out.push('<a href="#/map/' + city.c + '">' + esc(city.n) + '</a>');
    else out.push('<span class="cur">' + esc(city.n) + '</span>');
    if (county) {
      out.push('<svg class="ic"><use href="#i-chev"/></svg>');
      out.push('<span class="cur">' + esc(county.n) + '</span>');
    }
    return out.join('');
  };

  /* ---------------- 名录页 ---------------- */
  Views.indexPage = function (st) {
    var catChips = ['<button class="chip is-active" type="button" data-cat="">全部门类</button>'], i;
    for (i = 0; i < D.cats.length; i++) {
      catChips.push('<button class="chip" type="button" data-cat="' + esc(D.cats[i].k) + '"><i style="background:' + D.cats[i].col + '"></i>' + esc(D.cats[i].k) + '</button>');
    }
    var cityOpts = ['<option value="">全部城市</option>'];
    for (i = 0; i < D.cities.length; i++) cityOpts.push('<option value="' + D.cities[i].c + '">' + esc(D.cities[i].n) + '</option>');
    var batchOpts = ['<option value="">全部批次</option>'];
    var batches = ['第一批', '第二批', '第三批', '第四批', '第五批', '第六批', '第七批', '第八批', '第九批', '第十批'];
    for (i = 0; i < batches.length; i++) batchOpts.push('<option value="' + batches[i] + '">' + batches[i] + '</option>');
    return '' +
      '<div class="page index-page">' +
        '<div class="page-head"><div><div class="eyebrow"><span class="num">INDEX</span> HERITAGE INVENTORY</div><h1>名录检索</h1><p class="lead">把 ' + num(D.meta.counts.projects) + ' 条四级名录条目摊开来看：可按名称、门类、城市、级别与批次筛选。每个条目都标注保护单位与官方来源。</p></div><div class="head-stat"><b>' + num(D.meta.counts.projects) + '</b><span>UNIQUE ENTRIES</span></div></div>' +
        '<div class="filterbar"><div class="filter-inner">' +
          '<div class="filter-row"><div class="search-big" id="idx-search-wrap"><svg class="ic"><use href="#i-search"/></svg><input id="idx-q" type="search" placeholder="搜索项目、技艺、城市……" autocomplete="off"><button class="clear-s" id="idx-clear" type="button" aria-label="清空搜索"><svg class="ic"><use href="#i-close"/></svg></button></div>' +
          '<div class="seg seg-level" id="idx-level"><button type="button" class="is-active" data-level="">全部</button><button type="button" data-level="n">国家级</button><button type="button" data-level="p">省级</button><button type="button" data-level="c">市级</button><button type="button" data-level="x">县级</button></div>' +
          '<div class="select-wrap"><select id="idx-city" aria-label="按城市筛选">' + cityOpts.join('') + '</select></div>' +
          '<div class="select-wrap"><select id="idx-batch" aria-label="按批次筛选">' + batchOpts.join('') + '</select></div></div>' +
          '<div class="chips" id="idx-cats">' + catChips.join('') + '</div>' +
        '</div></div>' +
        '<div class="result-meta"><div>共 <b id="idx-count">0</b> 条项目条目 <span id="idx-filter-note"></span></div><div class="result-actions"><button class="link-btn" type="button" id="idx-reset">重置筛选</button></div></div>' +
        '<div class="pgrid pgrid-3" id="index-results"></div>' +
        '<div class="load-more" id="idx-more-wrap" style="display:none"><button class="btn btn-ghost" type="button" id="idx-more">加载更多</button></div>' +
      '</div>';
  };

  Views.renderCards = function (list, q) {
    var out = [], i;
    for (i = 0; i < list.length; i++) out.push(projectCard(list[i], q));
    return out.join('');
  };

  /* ---------------- 门类页 ---------------- */
  Views.catsPage = function () {
    var i, k, count, nat, p, j, tops;
    var totals = {}, nats = {}, total = 0;
    for (i = 0; i < D.cats.length; i++) { totals[D.cats[i].k] = 0; nats[D.cats[i].k] = 0; }
    for (i = 0; i < D.projects.length; i++) {
      p = D.projects[i];
      totals[p.cat] = (totals[p.cat] || 0) + 1;
      if (p.level === 'n') nats[p.cat] = (nats[p.cat] || 0) + 1;
      total++;
    }
    // donut
    var r = 70, cx = 100, cy = 100, C = 2 * Math.PI * r, off = 0, segs = [], legend = [], cards = [];
    for (i = 0; i < D.cats.length; i++) {
      k = D.cats[i].k; count = totals[k] || 0;
      var len = count / total * C;
      segs.push('<circle class="donut-seg" data-cat="' + esc(k) + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + D.cats[i].col + '" stroke-width="24" stroke-dasharray="' + Math.max(0, len - 2.5) + ' ' + (C - Math.max(0, len - 2.5)) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"><title>' + esc(k) + ' ' + count + '</title></circle>');
      legend.push('<button type="button" data-cat-jump="' + esc(k) + '"><i style="background:' + D.cats[i].col + '"></i>' + esc(k) + '<b>' + count + '</b></button>');
      off += len;
    }
    for (i = 0; i < D.cats.length; i++) {
      k = D.cats[i].k; count = totals[k] || 0;
      tops = [];
      for (j = 0; j < D.projects.length && tops.length < 3; j++) {
        p = D.projects[j];
        if (p.cat === k) tops.push(p);
      }
      cards.push('<div class="cat-card" role="button" tabindex="0" data-cat-jump="' + esc(k) + '" style="--cat:' + D.cats[i].col + '">' +
        '<div class="cat-card-top"><span class="cat-icon"><svg class="ic"><use href="#' + catIcon(k) + '"/></svg></span><span class="cat-num">' + count + '<small>国家级 ' + (nats[k] || 0) + '</small></span></div>' +
        '<h3>' + esc(k) + '</h3><div class="en">' + esc(D.cats[i].en) + '</div><p>' + esc(D.cats[i].d) + '</p>' +
        '<div class="cat-top">' + tops.map(function (x) { return '<span>' + esc(x.name) + '</span>'; }).join('') + '</div>' +
        '<span class="cat-go"><svg class="ic"><use href="#i-arrow"/></svg></span></div>');
    }
    return '' +
      '<div class="page cats-page">' +
        '<div class="page-head"><div><div class="eyebrow"><span class="num">CATEGORIES</span> TEN DOMAINS</div><h1>门类图谱</h1><p class="lead">依照非物质文化遗产的十个主要门类，看看齐鲁大地的非遗如何分布。点击任一门类，进入对应名录。</p></div><div class="head-stat"><b>10</b><span>CATEGORIES</span></div></div>' +
        '<div class="cats-layout">' +
          '<div class="cat-chart-card"><h3>项目结构</h3><p>按门类统计 · 去重条目 ' + num(total) + ' 条</p><div class="donut-wrap"><svg viewBox="0 0 200 200" aria-label="门类占比环形图">' + segs.join('') + '</svg><div class="donut-center"><b>' + num(total) + '</b><span>ENTRIES</span></div></div><div class="chart-legend">' + legend.join('') + '</div></div>' +
          '<div class="cat-grid">' + cards.join('') + '</div>' +
        '</div>' +
      '</div>';
  };

  /* ---------------- 项目详情 ---------------- */
  Views.itemModal = function (p, countyCode) {
    if (!p) return '';
    var county = countyCode || firstCounty(p);
    var desc = descOf(p, county);
    var paras = paragraphs(desc);
    var descHtml = '';
    if (paras.length) {
      descHtml = paras.map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('');
    } else {
      descHtml = '<div class="no-desc">该项目在公开名录中暂无完整简介。以下为名录信息与保护单位，可前往官方来源继续查阅。</div>';
    }
    var units = [], i, u;
    if (p.u) for (i = 0; i < p.u.length; i++) {
      u = p.u[i];
      if (!u[0]) continue;
      var extra = '';
      if (u[1]) {
        var cn = countyName(u[1]);
        if (cn && u[0].indexOf(cn) < 0) extra = '（' + esc(cn) + '）';
      } else if (u[2]) {
        var tn = cityName(u[2]);
        if (tn && u[0].indexOf(tn) < 0) extra = '（' + esc(tn) + '）';
      }
      units.push('<li>' + esc(u[0]) + extra + '</li>');
    }
    var declared = [], seen = {};
    if (p.n) for (i = 0; i < p.n.length; i++) {
      var d = (p.n[i].d || '').replace(/^山东省/, '');
      if (d && !seen[d]) { seen[d] = 1; declared.push(d); }
    }
    if (p.r) for (i = 0; i < p.r.length; i++) {
      var rd = (p.r[i].d || '').replace(/^山东省/, '');
      if (rd && !seen[rd]) { seen[rd] = 1; declared.push(rd); }
    }
    var sources = [], srcSeen = {};
    function addSrc(label, url) {
      if (!url || srcSeen[url]) return;
      srcSeen[url] = 1;
      sources.push({ label: label, url: url });
    }
    if (p.n) for (i = 0; i < p.n.length; i++) addSrc('中国非物质文化遗产网 · 项目档案', p.n[i].s);
    if (p.x) for (i = 0; i < p.x.length; i++) addSrc(p.x[i][0], p.x[i][1]);
    if (p.pb && p.pb.length) {
      var pb = p.pb;
      if (pb.indexOf('第二批') >= 0) addSrc('山东省人民政府 · 第二批省级名录', 'http://gb.shandong.gov.cn/art/2009/11/5/art_100623_23148.html');
      if (pb.indexOf('第三批') >= 0) addSrc('山东省人民政府 · 第三批省级名录', 'http://www.shandong.gov.cn/art/2013/5/29/art_100619_31622.html');
      if (pb.indexOf('第六批') >= 0) addSrc('山东省人民政府 · 第六批省级名录', 'http://whhly.shandong.gov.cn/module/download/downfile.jsp?classid=0&filename=bb5685be93954357919ddf28f6db3638.pdf');
      addSrc('山东公共数据开放网 · 省级非遗项目信息', D.meta.datasetUrl);
    }
    var srcHtml = '';
    for (i = 0; i < sources.length; i++) {
      srcHtml += '<a class="src-btn" href="' + esc(sources[i].url) + '" target="_blank" rel="noopener"><span>' + esc(sources[i].label) + '</span><svg class="ic"><use href="#i-external"/></svg></a>';
    }
    var related = [];
    var pool = (county && COUNTY_BY[county]) ? COUNTY_BY[county].items : [];
    for (i = 0; i < pool.length && related.length < 6; i++) {
      var rp = D.projects[pool[i]];
      if (rp && rp.id !== p.id) related.push(rp);
    }
    var relHtml = related.map(function (x) { return '<button type="button" data-id="' + x.id + '">' + esc(x.name) + '</button>'; }).join('');
    var badges = levelBadges(p);
    var levelRecords = '';
    if (p.r && p.r.length) {
      for (i = 0; i < p.r.length; i++) {
        var rr = p.r[i];
        levelRecords += '<div class="lr-row"><span class="badge ' + (rr.lv === 'c' ? 'city' : 'county') + '">' + levelName(rr.lv) + '</span><span class="lr-main">' + esc(rr.b || '批次未注明') + '</span><span class="lr-loc">' + esc(rr.d || '') + '</span>' + (rr.s ? '<a class="lr-src" href="' + esc(rr.s) + '" target="_blank" rel="noopener">来源</a>' : '') + '</div>';
      }
    }
    var loc = county ? (countyCity(county) ? cityName(countyCity(county)) + ' · ' + countyName(county) : countyName(county)) : locLabel(p);
    var levelText = (p.levels || [p.level]).map(levelName).join(' / ');
    return '' +
      '<div class="modal" id="item-modal" role="dialog" aria-modal="true" aria-label="' + esc(p.name) + '">' +
        '<div class="modal-card" tabindex="-1">' +
          '<div class="modal-head">' +
            '<div class="modal-kicker"><i class="cat-dot" style="background:' + catColor(p.cat) + '"></i>' + esc(p.cat) + ' · ' + esc(catEn(p.cat)) + '</div>' +
            '<h2 class="modal-title">' + esc(p.name) + '</h2>' +
            '<div class="modal-badges">' + badges + '</div>' +
            '<button class="modal-share" type="button" id="modal-share" title="复制链接" aria-label="复制链接"><svg class="ic"><use href="#i-share"/></svg></button>' +
            '<button class="modal-close" type="button" id="modal-close" aria-label="关闭"><svg class="ic"><use href="#i-close"/></svg></button>' +
          '</div>' +
          '<div class="modal-body">' +
            '<div class="modal-main"><div class="desc' + (paras.length && desc.length > 420 ? ' is-clamped' : '') + '" id="item-desc">' + descHtml + '</div>' +
              (paras.length && desc.length > 420 ? '<button class="desc-toggle" type="button" id="desc-toggle">展开全文<svg class="ic"><use href="#i-chev"/></svg></button>' : '') +
              '<div class="modal-side" style="border:0;padding:0;margin-top:26px"><h4>相关项目</h4><div class="related">' + (relHtml || '<span class="muted small">暂无</span>') + '</div></div>' +
            '</div>' +
            '<div class="modal-side">' +
              '<h4>项目信息</h4><dl class="meta-list">' +
                '<div><dt>类别</dt><dd>' + esc(p.cat) + '</dd></div>' +
                '<div><dt>级别</dt><dd>' + esc(levelText) + '</dd></div>' +
                '<div><dt>批次</dt><dd>' + esc(batchLine(p) || '—') + '</dd></div>' +
                '<div><dt>公布年份</dt><dd>' + (p.y || '—') + '</dd></div>' +
                '<div><dt>分布</dt><dd>' + esc(loc) + '</dd></div>' +
                (declared.length ? '<div><dt>申报地区</dt><dd>' + esc(declared.join('；')) + '</dd></div>' : '') +
              '</dl>' +
              (levelRecords ? '<h4>四级名录记录</h4><div class="level-records">' + levelRecords + '</div>' : '') +
              (units.length ? '<h4>保护单位</h4><ul class="units">' + units.join('') + '</ul>' : '') +
              '<h4>官方来源</h4><div class="source-btns">' + (srcHtml || '<span class="muted small">暂无</span>') + '</div>' +
              '<h4>数据说明</h4><div class="dp-note" style="margin-top:0">项目名称、批次与保护单位来自公开名录；简介来自中国非物质文化遗产网项目档案。归属地依据保护单位与申报地区整理，仅作展示。</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  };

  /* ---------------- 搜索弹层 ---------------- */
  Views.searchModal = function () {
    return '' +
      '<div class="modal search-modal" id="search-modal" role="dialog" aria-modal="true" aria-label="搜索非遗项目">' +
        '<div class="modal-card">' +
          '<div class="modal-head"><div class="search-field"><svg class="ic"><use href="#i-search"/></svg><input id="global-search-input" type="search" placeholder="搜索项目、技艺、城市……" autocomplete="off" aria-label="搜索非遗项目"><button class="search-clear" type="button" id="search-clear" aria-label="清空"><svg class="ic"><use href="#i-close"/></svg></button></div><button class="search-cancel" type="button" id="search-cancel">取消</button></div>' +
          '<div class="search-results" id="search-results"><div class="search-empty">输入关键词，检索 ' + num(D.meta.counts.projects) + ' 条项目条目</div></div>' +
          '<div class="search-tip"><span>回车进入名录检索</span><span>Esc 关闭</span></div>' +
        '</div>' +
      '</div>';
  };

  /* ---------------- 关于页 ---------------- */
  Views.aboutPage = function () {
    var c = D.meta.counts;
    var links = D.links.map(function (x) {
      return '<a class="source-card" href="' + esc(x.u) + '" target="_blank" rel="noopener"><span class="sc-top"><b>' + esc(x.t) + '</b><span class="sc-tag">' + esc(x.tag) + '</span></span><span>' + esc(x.d) + '</span><span class="sc-url">' + esc(x.u) + '<svg class="ic"><use href="#i-external"/></svg></span></a>';
    }).join('');
    return '' +
      '<div class="page about-page">' +
        '<div class="about-hero"><div><div class="eyebrow"><span class="num">ABOUT</span> THE ATLAS</div><h1 class="about-title">关于这本图志</h1><p class="lead" style="font-size:13px;color:var(--ink-3);max-width:560px;line-height:1.9;margin-top:14px">一部可以在指尖展开的山东非遗地图。它不替代任何官方名录，只希望把已经公开的非遗信息，放回地理与生活的语境里，让人更容易走近。</p><div class="about-quote" style="margin-top:26px">“见人、见物、见生活。”<small>非物质文化遗产保护的当代共识</small></div></div>' +
        '<div class="about-stats"><div class="about-stat"><b>' + num(c.projects) + '</b><span>去重条目</span></div><div class="about-stat"><b>' + c.counties + '</b><span>县（市、区）</span></div><div class="about-stat"><b>' + num(c.nationalRecords) + '</b><span>国家级记录</span></div><div class="about-stat"><b>' + num(c.provincialRecords) + '</b><span>省级名录记录</span></div></div><div class="about-level-note">市级 ' + num(c.cityRecords) + ' 条 · 县级 ' + num(c.countyRecords) + ' 条；市级覆盖 ' + c.cityCoverage + '/16 市，县级覆盖 ' + c.countyCoverage + '/136 县区</div></div>' +

        '<section class="about-section"><div class="sec-label"><div class="num">01</div><h2>缘起</h2><p>Why this atlas</p></div><div class="about-content"><h3>把名录放回地图</h3><p>非遗不只在名单里，更在具体的山川、街巷与手艺人的日常中。山东有 16 个设区的市、136 个县级行政区；同一项技艺，可能沿运河传播，也可能只在一个乡镇扎根。把项目放回县区，是为了让“去哪里看什么”变得直观。</p><h3>这本图志做什么</h3><p>以一张可缩放、可点击的山东地图为主入口：点击任一县（市、区），查看落在该地的国家级、省级、市级、县级非遗代表性项目；也可以按门类、批次、城市、级别检索，或从十个门类进入。每个项目尽量给出批次、保护单位与官方来源。</p><p class="note">本作品为 2026 山东省首届大学生 AI 大模型创新传播大赛参赛作品，非官方发布平台。</p></div></section>' +

        '<section class="about-section"><div class="sec-label"><div class="num">02</div><h2>数据</h2><p>Sources</p></div><div class="about-content"><h3>四条数据线</h3><p><strong>国家级名录：</strong>来自中国非物质文化遗产网（ihchina.cn）国家级非物质文化遗产代表性项目名录，逐条抓取山东相关记录 <strong>' + num(c.nationalRecords) + '</strong> 条（含扩展项目），并保留项目简介与官方详情链接。</p><p><strong>省级名录：</strong>来自山东公共数据开放网“山东省省级非物质文化遗产代表性项目信息”开放数据集（来源：山东省文化和旅游厅），<strong>' + num(c.provincialRecords) + '</strong> 条保护单位记录，按项目名称去重后得到 <strong>' + num(c.provincialProjects) + '</strong> 条项目条目；与市级、县级记录合并去重后，本页共收录 <strong>' + num(c.projects) + '</strong> 条四级名录条目。部分批次公布文件（第二、三、六批等）用于核对批次与申报地区。</p><p><strong>市级名录：</strong>来自各市文化和旅游局、市人民政府及山东公共数据开放网公开的市级非遗名录。16 市均已接入，共 <strong>' + num(c.cityRecords) + '</strong> 条记录；其中济南、青岛、淄博、东营、烟台、济宁、泰安、威海、日照、滨州、菏泽为累计名录，临沂（第七批）、德州（第九批）、枣庄（第七批）、潍坊（第七批）、聊城（第七批）为官方最新批次。</p><p><strong>县级名录：</strong>来自县（市、区）政府、文化和旅游局及山东公共数据开放网公开的县级名录。目前 <strong>' + c.countyCoverage + '</strong> 个县区接入，共 <strong>' + num(c.countyRecords) + '</strong> 条记录；其余县区暂未找到可核验的县级公开名录，页面保留其国家级、省级、市级项目并标注“县级名录暂未接入”。</p><p><strong>行政边界：</strong>来自阿里云 DataV.GeoAtlas（基于高德开放平台行政区划边界），经投影与简化后用于展示；不是官方标准地图。</p><div class="source-grid">' + links + '</div></div></section>' +

        '<section class="about-section"><div class="sec-label"><div class="num">03</div><h2>方法</h2><p>Method</p></div><div class="about-content"><h3>从记录到地图</h3><div class="method"><div class="method-step"><em>STEP 01</em><b>取名录</b><span>抓取国家、省、市、县四级公开名录，保留名称、门类、批次、保护单位等原始字段。</span></div><div class="method-step"><em>STEP 02</em><b>定归属</b><span>以“申报地区”与“保护单位”中的行政区名称为依据，按现行 136 个县级区划归并；旧县名做别名映射。</span></div><div class="method-step"><em>STEP 03</em><b>上地图</b><span>按县区聚合项目，计算数量与主门类；地图着色、检索与详情均由同一份数据驱动。</span></div></div><h3>归属规则与边界</h3><p>一个项目可能由多个保护单位共同保护，因此会出现在多个县区；同一项目在不同县区的保护单位可能不同。仅能定位到市的，归入“市本级”；保护单位为省直机构、省级协会或无法定位的，归入“省直 / 跨区域”，不在地图上强行落点。</p><p>“保护单位所在地”不等于项目的全部流布区域。本页的县区归属用于文化展示与检索，不作为非遗项目的行政区划认定。</p></div></section>' +

        '<section class="about-section"><div class="sec-label"><div class="num">04</div><h2>地图</h2><p>Cartography</p></div><div class="about-content"><h3>边界与投影</h3><p>地图采用 Web Mercator 预投影，路径在构建阶段完成简化，交互时只做 SVG 变换，因此在手机上也能较流畅地缩放与平移。县区边界、市界与海岸线均来自同一套矢量数据，未作人工改写。</p><div class="disclaimer"><b>地图使用提示：</b>本页行政边界为示意性矢量，不作为国界、行政区划或权属依据；标准地图请以自然资源部标准地图服务（<a class="inline" href="http://bzdt.ch.mnr.gov.cn/" target="_blank" rel="noopener">bzdt.ch.mnr.gov.cn</a>）发布为准。若用于正式出版、展览或政务场景，请另行取得审图号并核对边界。</div><h3>着色</h3><p>默认按县区收录的项目数量着色，颜色越深表示数量越多；切换“门类”模式后，按该县区项目最多的门类着色。颜色只表达数据分布，不表达价值判断。</p></div></section>' +

        '<section class="about-section"><div class="sec-label"><div class="num">05</div><h2>AI</h2><p>Disclosure</p></div><div class="about-content"><div class="ai-box"><h4>AI 大模型应用说明</h4><p>本 H5 在以下环节使用了 AI 大模型辅助：数据字段梳理与清洗脚本编写、页面信息架构与交互流程设计、部分界面文案的润色、以及前端代码的生成与调试。所有名录事实（项目名称、门类、批次、保护单位、申报地区、简介）均来自上述官方公开来源，未使用 AI 虚构或补写项目事实。</p><p>AI 生成内容均经人工复核：对归属不明的记录采取“宁缺勿错”的处理，归入市本级或省直，不强行落到县区；对无法确认的简介不生成替代文本。若发现错漏，欢迎指正。</p></div></div></section>' +

        '<section class="about-section"><div class="sec-label"><div class="num">06</div><h2>使用</h2><p>How to use</p></div><div class="about-content"><h3>地图操作</h3><table class="kbd-table"><tr><td>缩放</td><td>鼠标滚轮 / 双指捏合 / 工具栏 <kbd>+</kbd> <kbd>−</kbd>；双击地图放大</td></tr><tr><td>平移</td><td>按住拖动 / 单指拖动；键盘方向键微调</td></tr><tr><td>查看县区</td><td>点击地图上的县区，或左侧“市域索引”中的县区</td></tr><tr><td>返回</td><td>详情面板关闭按钮；浏览器后退；<kbd>Esc</kbd> 关闭弹层</td></tr><tr><td>着色切换</td><td>工具栏第二组“图层”按钮，在数量与门类之间切换</td></tr></table><h3>兼容性</h3><p>面向现代浏览器设计：Chrome / Edge / Firefox / Safari 及主流手机浏览器。页面不依赖外部字体、图片或接口，可离线打开；建议使用 360 极速、Chrome 或 Safari 获得最佳效果。</p><h3>无障碍</h3><p>地图与列表均提供文本替代；弹层可用 <kbd>Esc</kbd> 关闭；对“减少动态效果”的系统偏好做了动画降级。键盘用户可通过左侧索引与名录完成主要操作。</p></div></section>' +

        '<div class="about-foot"><span>齐鲁非遗图志 · 山河为卷，非遗为脉</span></div>' +
      '</div>';
  };

  /* ---------------- 首页统计动画 ---------------- */
  Views.countUp = function (root) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var els = root.querySelectorAll('[data-count]'), i;
    for (i = 0; i < els.length; i++) {
      (function (el) {
        var target = parseInt(el.getAttribute('data-count'), 10) || 0;
        var start = nowMs(), dur = 1100;
        function tick() {
          var p = Math.min(1, (nowMs() - start) / dur);
          var v = Math.round(target * (1 - Math.pow(1 - p, 3)));
          el.firstChild.nodeValue = num(v);
          if (p < 1) window.requestAnimationFrame(tick);
        }
        tick();
      })(els[i]);
    }
    function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  };

  Views.heroSvgFor = function (code) { return heroMapSvg(); };

  // Expose the data helpers directly on Views as well (app.js uses V.cityBy etc.).
  (function () {
    for (var key in Views.data) {
      if (Object.prototype.hasOwnProperty.call(Views.data, key) && Views[key] === undefined) {
        Views[key] = Views.data[key];
      }
    }
  })();

  window.Views = Views;
})(window, document);




