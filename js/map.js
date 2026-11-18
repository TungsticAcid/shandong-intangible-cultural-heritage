/* ==========================================================================
   齐鲁非遗图志 · 地图引擎
   纯 SVG + 原生 JS，无第三方依赖；支持滚轮缩放、拖拽平移、双指缩放、
   点击下钻、标签避让与密度/门类两种着色。
   ========================================================================== */
(function (window, document) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function now() { return (window.performance && window.performance.now) ? window.performance.now() : Date.now(); }

  var DENSITY = ['#f0e4cf', '#e7cfb3', '#d5ab8f', '#be8170', '#a15542'];

  function SDMap(opts) {
    this.root = opts.root;
    this.ich = opts.ich;
    this.geo = opts.geo;
    this.on = opts.on || {};
    this.vbW = this.geo.vb[0];
    this.vbH = this.geo.vb[1];
    this.k = 1; this.tx = 0; this.ty = 0;
    this.viewOffsetX = 0; this.viewOffsetY = 0;
    this.mode = 'density';
    this.city = null; this.county = null;
    this.labelsOn = true;
    this.scale = 1; this.ox = 0; this.oy = 0;
    this.drag = null; this.moved = false; this.anim = null;
    this.suppressClick = false;
    this.dead = false;
    this._raf = null; this._labelRaf = null;
    this._countyStats = {};
    this._cityStats = {};
    this.prepare();
    this.build();
    this.bind();
    this.resize(true);
    this.paint();
    this.placeLabels();
  }

  SDMap.prototype.prepare = function () {
    var i, j, c, p, st, cat;
    this.projects = this.ich.projects;
    this.countyByCode = {};
    this.cityByCode = {};
    this.countyItems = {};
    this.cityCounties = {};
    for (i = 0; i < this.ich.counties.length; i++) {
      c = this.ich.counties[i];
      this.countyByCode[c.c] = c;
      this.countyItems[c.c] = c.items;
    }
    for (i = 0; i < this.ich.cities.length; i++) {
      c = this.ich.cities[i];
      this.cityByCode[c.c] = c;
      this.cityCounties[c.c] = c.counties;
    }
    for (i = 0; i < this.geo.counties.length; i++) {
      c = this.geo.counties[i];
      st = { count: 0, nat: 0, prov: 0, cats: {}, dominant: '', domCount: 0, area: c.a, label: c.l, bbox: c.b };
      var items = this.countyItems[c.c] || [];
      st.count = items.length;
      for (j = 0; j < items.length; j++) {
        p = this.projects[items[j]];
        if (!p) continue;
        cat = p.cat || '其他';
        st.cats[cat] = (st.cats[cat] || 0) + 1;
        if (p.level === 'n') st.nat++; else st.prov++;
      }
      for (cat in st.cats) {
        if (st.cats[cat] > st.domCount) { st.domCount = st.cats[cat]; st.dominant = cat; }
      }
      this._countyStats[c.c] = st;
    }
    for (i = 0; i < this.geo.cities.length; i++) {
      c = this.geo.cities[i];
      st = { count: 0, nat: 0, prov: 0, cats: {}, dominant: '', domCount: 0, area: c.a, label: c.l, bbox: c.b };
      var list = (this.cityByCode[c.c] || {}).items || [];
      st.count = list.length;
      for (j = 0; j < list.length; j++) {
        p = this.projects[list[j]];
        if (!p) continue;
        cat = p.cat || '其他';
        st.cats[cat] = (st.cats[cat] || 0) + 1;
        if (p.level === 'n') st.nat++; else st.prov++;
      }
      for (cat in st.cats) {
        if (st.cats[cat] > st.domCount) { st.domCount = st.cats[cat]; st.dominant = cat; }
      }
      this._cityStats[c.c] = st;
    }
    this.catColor = {};
    for (i = 0; i < this.ich.cats.length; i++) this.catColor[this.ich.cats[i].k] = this.ich.cats[i].col;
    this.bins = this.ich.meta.bins || [3, 6, 9, 14];
  };

  SDMap.prototype.build = function () {
    var self = this;
    this.stage = document.createElement('div');
    this.stage.className = 'map-stage';
    this.root.appendChild(this.stage);

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('id', 'map-svg');
    svg.setAttribute('viewBox', '0 0 ' + this.vbW + ' ' + this.vbH);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'application');
    svg.setAttribute('aria-label', '山东省非遗地图，可缩放、拖拽，点击县区查看非遗项目');
    this.svg = svg;
    this.stage.appendChild(svg);

    var rootG = document.createElementNS(NS, 'g');
    rootG.setAttribute('id', 'map-root');
    svg.appendChild(rootG);
    this.rootG = rootG;

    var i, p, city, county, g;

    g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'map-svg-shadow');
    rootG.appendChild(g);
    this.silhouette = g;
    for (i = 0; i < this.geo.cities.length; i++) {
      city = this.geo.cities[i];
      p = document.createElementNS(NS, 'path');
      p.setAttribute('d', city.d);
      p.setAttribute('fill', '#e9dcc2');
      p.setAttribute('stroke', '#e9dcc2');
      p.setAttribute('stroke-width', '2');
      p.setAttribute('stroke-linejoin', 'round');
      p.setAttribute('aria-hidden', 'true');
      g.appendChild(p);
    }

    g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'county-layer');
    rootG.appendChild(g);
    this.countyLayer = g;
    this.countyPaths = {};
    for (i = 0; i < this.geo.counties.length; i++) {
      county = this.geo.counties[i];
      p = document.createElementNS(NS, 'path');
      p.setAttribute('d', county.d);
      p.setAttribute('class', 'county');
      p.setAttribute('data-code', county.c);
      p.setAttribute('data-name', county.n);
      p.setAttribute('vector-effect', 'non-scaling-stroke');
      p.setAttribute('aria-label', county.n + '，' + (this._countyStats[county.c] ? this._countyStats[county.c].count : 0) + '个项目');
      p.setAttribute('role', 'button');
      p.setAttribute('tabindex', '-1');
      g.appendChild(p);
      this.countyPaths[county.c] = p;
    }

    g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'border-layer');
    rootG.appendChild(g);
    this.borderLayer = g;
    this.borderPaths = {};
    for (i = 0; i < this.geo.cities.length; i++) {
      city = this.geo.cities[i];
      p = document.createElementNS(NS, 'path');
      p.setAttribute('d', city.d);
      p.setAttribute('class', 'city-border');
      p.setAttribute('data-code', city.c);
      g.appendChild(p);
      this.borderPaths[city.c] = p;
    }

    // HTML label layer
    var labels = document.createElement('div');
    labels.className = 'map-labels';
    labels.setAttribute('aria-hidden', 'true');
    this.root.appendChild(labels);
    this.labelsEl = labels;
    this.cityLabels = {};
    this.countyLabels = {};
    this._labelEls = [];
    var mk = function (cls, code, name, count, kind) {
      var el = document.createElement('button');
      el.type = 'button';
      el.tabIndex = -1;
      el.className = 'mlabel ' + cls;
      el.setAttribute('data-code', code);
      el.setAttribute('data-kind', kind);
      el.innerHTML = name + (count ? '<span class="cnt">' + count + '</span>' : '');
      el.style.display = 'none';
      labels.appendChild(el);
      self._labelEls.push(el);
      return el;
    };
    for (i = 0; i < this.geo.cities.length; i++) {
      city = this.geo.cities[i];
      var cs = this._cityStats[city.c];
      this.cityLabels[city.c] = mk('city', city.c, city.n, cs ? cs.count : 0, 'city');
    }
    for (i = 0; i < this.geo.counties.length; i++) {
      county = this.geo.counties[i];
      var st = this._countyStats[county.c];
      this.countyLabels[county.c] = mk('county', county.c, county.n, st ? st.count : 0, 'county');
    }

    var tip = document.createElement('div');
    tip.className = 'map-tip';
    tip.style.display = 'none';
    this.root.appendChild(tip);
    this.tip = tip;
  };

  SDMap.prototype.bind = function () {
    var self = this, svg = this.svg;

    // wheel zoom
    var wheel = function (e) {
      e.preventDefault();
      var p = self.screenToVb(e.clientX, e.clientY);
      var delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;
      if (e.deltaMode === 2) delta *= 300;
      var factor = Math.pow(1.0016, -delta);
      factor = clamp(factor, 0.55, 1.8);
      self.zoomAt(p, factor, false);
    };
    if (svg.addEventListener) svg.addEventListener('wheel', wheel, { passive: false });

    // mouse drag
    var onMouseDown = function (e) {
      if (e.button !== 0) return;
      self.startDrag(e.clientX, e.clientY);
      e.preventDefault();
    };
    svg.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', function (e) {
      if (self.dead || !self.drag) return;
      self.moveDrag(e.clientX, e.clientY);
    });
    document.addEventListener('mouseup', function () {
      if (self.dead) return;
      if (self.drag) self.endDrag();
    });

    // touch
    var touchStart = function (e) {
      if (e.touches.length === 1) {
        self.startDrag(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        self.drag = null;
        self.suppressClick = true;
        self.pinch = {
          d: self.touchDist(e.touches),
          cx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          cy: (e.touches[0].clientY + e.touches[1].clientY) / 2,
          k: self.k, tx: self.tx, ty: self.ty
        };
      }
    };
    var touchMove = function (e) {
      if (e.touches.length === 2 && self.pinch) {
        e.preventDefault();
        var d = self.touchDist(e.touches);
        var ratio = d / self.pinch.d;
        var k2 = clamp(self.pinch.k * ratio, 1, 16);
        var f = k2 / self.pinch.k;
        var cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        var p = self.screenToVb(cx, cy, self.pinch.k, self.pinch.tx, self.pinch.ty);
        self.k = k2;
        self.tx = p.x - (p.x - self.pinch.tx) * f;
        self.ty = p.y - (p.y - self.pinch.ty) * f;
        self.clamp();
        self.apply();
      } else if (e.touches.length === 1 && self.drag) {
        e.preventDefault();
        self.moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    var touchEnd = function (e) {
      if (e.touches.length === 0) {
        self.pinch = null;
        if (self.drag) self.endDrag();
      } else if (e.touches.length === 1) {
        self.pinch = null;
        self.startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    svg.addEventListener('touchstart', touchStart, { passive: false });
    svg.addEventListener('touchmove', touchMove, { passive: false });
    svg.addEventListener('touchend', touchEnd);
    svg.addEventListener('touchcancel', touchEnd);

    // click/hover
    svg.addEventListener('click', function (e) {
      if (self.suppressClick) { self.suppressClick = false; return; }
      var t = e.target;
      while (t && t !== svg && !(t.getAttribute && t.getAttribute('data-code'))) t = t.parentNode;
      if (!t || t === svg) return;
      var code = t.getAttribute('data-code');
      if (t.classList && t.classList.contains('county')) {
        if (self.on.selectCounty) self.on.selectCounty(code);
      }
    });

    svg.addEventListener('mousemove', function (e) {
      if (self.drag) return;
      var t = e.target;
      if (!t || !t.classList || !t.classList.contains('county')) return;
      var code = t.getAttribute('data-code');
      self.showTip(code, e.clientX, e.clientY);
    });
    svg.addEventListener('mouseover', function (e) {
      var t = e.target;
      if (!t || !t.classList || !t.classList.contains('county')) return;
      var code = t.getAttribute('data-code');
      self.hoverCounty(code);
    });
    svg.addEventListener('mouseout', function (e) {
      var t = e.target;
      if (!t || !t.classList || !t.classList.contains('county')) return;
      self.hoverCounty(null);
    });
    svg.addEventListener('mouseleave', function () { self.hoverCounty(null); self.hideTip(); });

    // labels
    this.labelsEl.addEventListener('click', function (e) {
      var t = e.target;
      while (t && t !== self.labelsEl && !t.getAttribute('data-code')) t = t.parentNode;
      if (!t || t === self.labelsEl) return;
      var kind = t.getAttribute('data-kind');
      var code = t.getAttribute('data-code');
      if (kind === 'city') { if (self.on.selectCity) self.on.selectCity(code); }
      else { if (self.on.selectCounty) self.on.selectCounty(code); }
    });
    this.labelsEl.addEventListener('mouseover', function (e) {
      var t = e.target;
      while (t && t !== self.labelsEl && !t.getAttribute('data-code')) t = t.parentNode;
      if (!t || t === self.labelsEl) return;
      if (t.getAttribute('data-kind') === 'county') self.hoverCounty(t.getAttribute('data-code'));
    });
    this.labelsEl.addEventListener('mouseout', function () { self.hoverCounty(null); });

    // double click to zoom
    svg.addEventListener('dblclick', function (e) {
      e.preventDefault();
      var p = self.screenToVb(e.clientX, e.clientY);
      self.zoomAt(p, 1.8, true);
    });

    // keyboard
    svg.setAttribute('tabindex', '0');
    svg.addEventListener('keydown', function (e) {
      var step = 80 / self.k;
      if (e.key === '+' || e.key === '=') { self.zoomBy(1.3); e.preventDefault(); }
      else if (e.key === '-' || e.key === '_') { self.zoomBy(1 / 1.3); e.preventDefault(); }
      else if (e.key === '0') { self.reset(); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { self.panBy(step, 0); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { self.panBy(-step, 0); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { self.panBy(0, step); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { self.panBy(0, -step); e.preventDefault(); }
    });

    window.addEventListener('resize', function () { if (!self.dead) self.resize(); });
    if (window.ResizeObserver) {
      try { new ResizeObserver(function () { if (!self.dead) self.resize(); }).observe(this.root); } catch (err) {}
    }
  };

  SDMap.prototype.touchDist = function (t) {
    var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy) || 1;
  };

  SDMap.prototype.startDrag = function (x, y) {
    this.cancelAnim();
    this.drag = { x: x, y: y, tx: this.tx, ty: this.ty, k: this.k, moved: false };
    this.moved = false;
    this.svg.classList.add('is-dragging');
    this.hideTip();
  };
  SDMap.prototype.moveDrag = function (x, y) {
    if (!this.drag) return;
    var dx = x - this.drag.x, dy = y - this.drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) { this.drag.moved = true; this.moved = true; }
    this.tx = this.drag.tx + dx / (this.scale * this.k);
    this.ty = this.drag.ty + dy / (this.scale * this.k);
    this.clamp();
    this.apply();
  };
  SDMap.prototype.endDrag = function () {
    if (this.drag && this.drag.moved) this.suppressClick = true;
    this.drag = null;
    this.svg.classList.remove('is-dragging');
    if (!this.moved) this.hideTip();
  };

  SDMap.prototype.resize = function (initial) {
    var rect = this.root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var w = rect.width, h = rect.height;
    var s = Math.min(w / this.vbW, h / this.vbH);
    this.scale = s;
    this.ox = (w - this.vbW * s) / 2;
    this.oy = (h - this.vbH * s) / 2;
    this._w = w; this._h = h;
    if (initial) this.clamp();
    this.apply();
    this.placeLabels();
  };

  SDMap.prototype.screenToVb = function (cx, cy, k, tx, ty) {
    var rect = this.root.getBoundingClientRect();
    k = (k === undefined) ? this.k : k;
    tx = (tx === undefined) ? this.tx : tx;
    ty = (ty === undefined) ? this.ty : ty;
    var x = ((cx - rect.left - this.ox) / this.scale - tx) / k;
    var y = ((cy - rect.top - this.oy) / this.scale - ty) / k;
    return { x: x, y: y };
  };

  SDMap.prototype.apply = function () {
    this.rootG.setAttribute('transform', 'translate(' + this.tx.toFixed(2) + ',' + this.ty.toFixed(2) + ') scale(' + this.k.toFixed(4) + ')');
    var self = this;
    if (this._labelRaf) return;
    this._labelRaf = window.requestAnimationFrame(function () {
      self._labelRaf = null;
      self.placeLabels();
      if (self.on.zoom) self.on.zoom(self.k);
    });
  };

  SDMap.prototype.clamp = function () {
    this.k = clamp(this.k, 1, 16);
    var offX = this.viewOffsetX || 0, offY = this.viewOffsetY || 0;
    var visW = this.vbW - 2 * offX / this.scale;
    var visH = this.vbH - 2 * offY / this.scale;
    if (!(visW > 200)) visW = this.vbW;
    if (!(visH > 200)) visH = this.vbH;
    var mapW = this.vbW * this.k, mapH = this.vbH * this.k;
    if (mapW <= visW + 1) this.tx = (visW - mapW) / 2;
    else this.tx = clamp(this.tx, visW - mapW - 26, 26);
    if (mapH <= visH + 1) this.ty = (visH - mapH) / 2;
    else this.ty = clamp(this.ty, visH - mapH - 26, 26);
  };

  SDMap.prototype.zoomAt = function (p, factor, animate) {
    var k2 = clamp(this.k * factor, 1, 16);
    var f = k2 / this.k;
    var tx2 = p.x - (p.x - this.tx) * f;
    var ty2 = p.y - (p.y - this.ty) * f;
    if (animate) this.animateTo(k2, tx2, ty2, 320);
    else {
      this.cancelAnim();
      this.k = k2; this.tx = tx2; this.ty = ty2;
      this.clamp(); this.apply();
    }
  };
  SDMap.prototype.zoomBy = function (factor) {
    this.zoomAt({ x: this.vbW / 2, y: this.vbH / 2 }, factor, true);
  };
  SDMap.prototype.panBy = function (dx, dy) {
    this.cancelAnim();
    this.tx += dx; this.ty += dy;
    this.clamp(); this.apply();
  };

  SDMap.prototype.cancelAnim = function () {
    if (this.anim) {
      window.cancelAnimationFrame(this.anim.raf);
      this.anim = null;
    }
  };
  SDMap.prototype.animateTo = function (k, tx, ty, dur) {
    this.cancelAnim();
    var self = this;
    var s = { k: this.k, tx: this.tx, ty: this.ty };
    var t0 = now();
    dur = dur || 480;
    var frame = function () {
      var p = clamp((now() - t0) / dur, 0, 1);
      var e = ease(p);
      self.k = s.k + (k - s.k) * e;
      self.tx = s.tx + (tx - s.tx) * e;
      self.ty = s.ty + (ty - s.ty) * e;
      self.clamp();
      self.apply();
      if (p < 1) self.anim = { raf: window.requestAnimationFrame(frame) };
      else self.anim = null;
    };
    this.anim = { raf: window.requestAnimationFrame(frame) };
  };

  SDMap.prototype.focusBBox = function (bbox, pad, maxK, dur) {
    if (!bbox) return;
    var bw = Math.max(bbox[2] - bbox[0], 1);
    var bh = Math.max(bbox[3] - bbox[1], 1);
    var offX = this.viewOffsetX || 0, offY = this.viewOffsetY || 0;
    var visW = this.vbW - 2 * offX / this.scale;
    var visH = this.vbH - 2 * offY / this.scale;
    if (visW < 200) visW = this.vbW;
    if (visH < 200) visH = this.vbH;
    var k = Math.min((visW - pad * 2) / bw, (visH - pad * 2) / bh);
    k = clamp(k, 1, maxK || 12);
    var cx = (bbox[0] + bbox[2]) / 2, cy = (bbox[1] + bbox[3]) / 2;
    var tx = this.vbW / 2 - offX / this.scale - cx * k;
    var ty = this.vbH / 2 - offY / this.scale - cy * k;
    this.animateTo(k, tx, ty, dur || 620);
  };

  SDMap.prototype.setViewOffset = function (x, y) {
    this.viewOffsetX = x || 0;
    this.viewOffsetY = y || 0;
  };

  SDMap.prototype.focusCity = function (code) {
    var g = null, i;
    for (i = 0; i < this.geo.cities.length; i++) if (this.geo.cities[i].c === code) g = this.geo.cities[i];
    if (!g) return;
    this.focusBBox(g.b, 54, 7.2, 640);
  };
  SDMap.prototype.focusCounty = function (code) {
    var g = null, i;
    for (i = 0; i < this.geo.counties.length; i++) if (this.geo.counties[i].c === code) g = this.geo.counties[i];
    if (!g) return;
    this.focusBBox(g.b, 24, 9.5, 640);
  };

  SDMap.prototype.reset = function () {
    this.animateTo(1, 0, 0, 560);
  };

  SDMap.prototype.setSelection = function (city, county, focus) {
    this.city = city || null;
    this.county = county || null;
    var i, code, p, st;
    for (code in this.countyPaths) {
      p = this.countyPaths[code];
      p.classList.remove('is-selected', 'is-dim');
      if (county) {
        if (code === county) p.classList.add('is-selected');
        else p.classList.add('is-dim');
      } else if (city) {
        if (this.countyByCode[code] && this.countyByCode[code].t === city) {
          // keep normal
        } else p.classList.add('is-dim');
      }
    }
    for (code in this.borderPaths) {
      this.borderPaths[code].classList.toggle('is-selected', !!city && !county && code === city);
    }
    for (code in this.cityLabels) {
      this.cityLabels[code].classList.toggle('is-active', !!city && code === city);
    }
    for (code in this.countyLabels) {
      this.countyLabels[code].classList.toggle('is-active', !!county && code === county);
    }
    if (focus) {
      if (county) this.focusCounty(county);
      else if (city) this.focusCity(city);
      else this.reset();
    } else {
      this.placeLabels();
    }
  };

  SDMap.prototype.hoverCounty = function (code) {
    var i;
    for (i in this.countyPaths) this.countyPaths[i].classList.remove('is-hover');
    if (code && this.countyPaths[code]) this.countyPaths[code].classList.add('is-hover');
    if (this.on.hover) this.on.hover(code);
    if (!code) this.hideTip();
  };

  SDMap.prototype.showTip = function (code, cx, cy) {
    var st = this._countyStats[code];
    if (!st) return;
    var meta = this.countyByCode[code];
    var city = meta ? (this.cityByCode[meta.t] || {}).n : '';
    this.tip.innerHTML = '<b>' + (meta ? meta.n : '') + '</b><span>' + city + '</span><em>' + st.count + ' 项非遗</em>';
    this.tip.style.display = 'block';
    var rect = this.root.getBoundingClientRect();
    var x = cx - rect.left + 14, y = cy - rect.top + 16;
    var tw = this.tip.offsetWidth || 150, th = this.tip.offsetHeight || 60;
    if (x + tw > rect.width - 8) x = cx - rect.left - tw - 14;
    if (y + th > rect.height - 8) y = cy - rect.top - th - 12;
    this.tip.style.left = x + 'px';
    this.tip.style.top = y + 'px';
  };
  SDMap.prototype.hideTip = function () { if (this.tip) this.tip.style.display = 'none'; };

  SDMap.prototype.paint = function () {
    var code, p, st, i, idx, fill, op;
    for (code in this.countyPaths) {
      p = this.countyPaths[code];
      st = this._countyStats[code];
      if (!st || !st.count) {
        p.setAttribute('fill', '#ece0c8');
        p.setAttribute('fill-opacity', '1');
        continue;
      }
      if (this.mode === 'category') {
        fill = this.catColor[st.dominant] || '#b9a98c';
        op = 0.55 + Math.min(st.count / 14, 1) * 0.42;
        p.setAttribute('fill', fill);
        p.setAttribute('fill-opacity', op.toFixed(2));
      } else {
        idx = 0;
        for (i = 0; i < this.bins.length; i++) if (st.count > this.bins[i]) idx++;
        fill = DENSITY[idx] || DENSITY[DENSITY.length - 1];
        p.setAttribute('fill', fill);
        p.setAttribute('fill-opacity', '1');
      }
    }
    if (this.on.legend) this.on.legend(this.mode);
  };

  SDMap.prototype.setMode = function (mode) {
    this.mode = mode;
    this.paint();
  };

  SDMap.prototype.setLabels = function (on) {
    this.labelsOn = !!on;
    this.placeLabels();
  };

  SDMap.prototype.placeLabels = function () {
    if (!this.labelsEl || !this._w) return;
    var i, el, code, st, pt, x, y, visCity, visCounty, list, placed;
    var showCity = this.labelsOn && !this.city && this.k < 1.75 && (this._w >= 640 || this.k > 1.3);
    var showCounty = this.labelsOn && (this.city || this.k >= 2.25);
    var w = this._w, h = this._h;
    var self = this;

    for (code in this.cityLabels) this.cityLabels[code].style.display = 'none';
    for (code in this.countyLabels) this.countyLabels[code].style.display = 'none';

    var candidates = [];
    if (showCity) {
      for (i = 0; i < this.geo.cities.length; i++) {
        var c = this.geo.cities[i];
        candidates.push({ el: this.cityLabels[c.c], p: c.l, area: this._cityStats[c.c] ? this._cityStats[c.c].area : 0, kind: 'city' });
      }
    }
    if (showCounty) {
      for (i = 0; i < this.geo.counties.length; i++) {
        var ct = this.geo.counties[i];
        if (this.city && ct.t !== this.city) continue;
        candidates.push({ el: this.countyLabels[ct.c], p: ct.l, area: this._countyStats[ct.c] ? this._countyStats[ct.c].area : 0, kind: 'county' });
      }
    }
    candidates.sort(function (a, b) { return b.area - a.area; });
    placed = [];
    for (i = 0; i < candidates.length; i++) {
      var it = candidates[i];
      pt = this.screenOf(it.p[0], it.p[1]);
      x = pt.x; y = pt.y;
      if (x < 8 || y < 8 || x > w - 8 || y > h - 8) { it.el.style.display = 'none'; continue; }
      var tw = it.kind === 'city' ? (it.el.textContent.length * 13 + 16) : (it.el.textContent.length * 11 + 12);
      var th = it.kind === 'city' ? 20 : 18;
      var r = { x: x - tw / 2, y: y - th / 2, w: tw, h: th };
      var ok = true;
      for (var j = 0; j < placed.length; j++) {
        var q = placed[j];
        if (r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y) { ok = false; break; }
      }
      if (!ok) { it.el.style.display = 'none'; continue; }
      placed.push(r);
      it.el.style.display = 'block';
      it.el.style.left = x + 'px';
      it.el.style.top = y + 'px';
    }
  };

  SDMap.prototype.screenOf = function (x, y) {
    return { x: this.ox + (x * this.k + this.tx) * this.scale, y: this.oy + (y * this.k + this.ty) * this.scale };
  };

  SDMap.prototype.destroy = function () {
    this.dead = true;
    this.cancelAnim();
    if (this.root) this.root.innerHTML = '';
  };

  window.SDMap = SDMap;
})(window, document);
