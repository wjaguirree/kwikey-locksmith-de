/* Kwikey motion — reveal on scroll + contadores.
   Reglas de seguridad:
   - Solo corre si <html> lleva .kw-motion (lo decide el snippet del <head>).
   - Cualquier excepcion => se quita .kw-motion y todo queda visible.
   - Red de seguridad: un sondeo cada 700 ms muestra lo que este en pantalla
     y siga oculto (nunca destapa lo que esta fuera de vista); se detiene solo.
   - El hero (LCP) nunca se oculta.
   - Lecturas de layout agrupadas antes de las escrituras (sin thrash). */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('kw-motion')) return;
  try {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.remove('kw-motion'); return;
    }
    var vh = window.innerHeight || 800;
    var HERO = '.sp-hero,.city-hero,.category-refined-hero,.article-hero,.kw-hero,header,footer,.sp-cta,.cta-section';
    function inHero(el) { return !!(el.closest && el.closest(HERO)); }

    // ---------- FASE 1: candidatos (sin tocar el DOM) ----------
    var cand = [];                                     // {el, cls}
    var seen = [];
    function add(el, cls) {
      if (seen.indexOf(el) >= 0) return;
      seen.push(el); cand.push({ el: el, cls: cls || '' });
    }
    var imgs = document.querySelectorAll('main img'), i, n = 0;
    var imgList = [];
    for (i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (inHero(im) || im.closest('.kw-reviews')) continue;
      if (/\b(absolute|brand-logo-img|sp-hero__bg|sp-cta__bg|kw-hero-bg-image)\b/.test(im.className)) continue;
      imgList.push(im);
    }
    var CARD = '.sp-fit__card,.sp-process__step,.sp-editorial__block,.faq-item,.service-city-link-dark,' +
      '.city-local-group,.city-trust-item,.kw-svc-group,.stat-card,.kw-path-card,.kw-reviews__card,' +
      '.trust-proof-icon,.sp-stats__trust-item,.kw-area-list,.article-next-step-panel,.section-header,' +
      '.google-map-error-card,.service-state-group';
    var cards = document.querySelectorAll(CARD), cardList = [];
    for (i = 0; i < cards.length; i++) if (!inHero(cards[i])) cardList.push(cards[i]);
    var heads = document.querySelectorAll('main h2,main .section-description,main .kw-card-title'), headList = [];
    for (i = 0; i < heads.length; i++) if (!inHero(heads[i])) headList.push(heads[i]);

    // ---------- FASE 2: lecturas de layout, todas seguidas ----------
    var rects = new Map();
    function measure(el) { var r = el.getBoundingClientRect(); rects.set(el, r); return r; }
    for (i = 0; i < imgList.length; i++) measure(imgList[i]);
    for (i = 0; i < cardList.length; i++) measure(cardList[i]);
    for (i = 0; i < headList.length; i++) measure(headList[i]);
    var rendered = function (r) { return r.width > 0 || r.height > 0; };

    for (i = 0; i < imgList.length; i++) {
      var ri = rects.get(imgList[i]);
      if (ri.width < 120 || ri.height < 80) continue;
      add(imgList[i], (n++ % 2) ? 'kw-r' : 'kw-l');
    }
    // tarjetas: no anidar (si un antecesor ya es candidato, se salta)
    for (i = 0; i < cardList.length; i++) {
      var c = cardList[i];
      if (!rendered(rects.get(c))) continue;
      var anc = c.parentElement, nested = false;
      while (anc && anc !== document.body) { if (seen.indexOf(anc) >= 0) { nested = true; break; } anc = anc.parentElement; }
      if (!nested) add(c, '');
    }
    for (i = 0; i < headList.length; i++) {
      var hd = headList[i];
      if (!rendered(rects.get(hd))) continue;
      var a2 = hd.parentElement, nested2 = false;
      while (a2 && a2 !== document.body) { if (seen.indexOf(a2) >= 0) { nested2 = true; break; } a2 = a2.parentElement; }
      if (!nested2) add(hd, '');
    }

    // ---------- FASE 3: escrituras, todas seguidas ----------
    // kw-init: el estado oculto se aplica SIN transicion (si no, lo ya pintado
    // haria un fundido de salida). Se retira en el siguiente frame.
    var els = [];
    for (i = 0; i < cand.length; i++) {
      var el = cand[i].el, r0 = rects.get(el);
      var inView = r0.top < vh && r0.bottom > 0;
      el.classList.add('kw-m', 'kw-init');
      if (cand[i].cls) el.classList.add(cand[i].cls);
      if (inView) el.classList.add('kw-now', 'kw-in');   // ya en pantalla: sin transicion, sin parpadeo
      els.push(el);
    }
    void document.body.offsetHeight;                     // fija el estado inicial
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      for (var z = 0; z < els.length; z++) els[z].classList.remove('kw-init');
    }); });
    // Al terminar de aparecer, se retiran las clases del sistema: el elemento
    // vuelve a regirse solo por el CSS del tema (hover, sombras, transiciones).
    function settle(el) {
      if (el.__settled) return; el.__settled = true;
      el.classList.remove('kw-m', 'kw-l', 'kw-r', 'kw-in', 'kw-now', 'kw-init');
      el.style.transitionDelay = '';
    }
    function reveal(el) {
      if (el.classList.contains('kw-in')) return;
      el.classList.add('kw-in');
      var delay = parseFloat(el.style.transitionDelay) || 0;
      setTimeout(function () { settle(el); }, 800 + delay);   // 750 ms de transicion + margen
    }
    for (i = 0; i < els.length; i++) if (els[i].classList.contains('kw-now')) settle(els[i]);
    // escalonado entre hermanos animados (solo lectura de classList, sin layout)
    for (i = 0; i < els.length; i++) {
      var p = els[i].parentElement, k = 0;
      if (!p || els[i].classList.contains('kw-in')) continue;
      for (var s = p.firstElementChild; s && s !== els[i]; s = s.nextElementSibling) if (s.classList.contains('kw-m')) k++;
      if (k) els[i].style.transitionDelay = Math.min(k * 90, 450) + 'ms';
    }

    // ---------- Contadores ----------
    var NUMC = '.sp-stats,.stat-card,.kw-reviews__title,.service-count-badge,.kw-svc-index h2,' +
      '.trust-bar,.google-map-error-title,.city-trust-item,.kw-reviews__sub';
    var nums = [];
    var boxes = document.querySelectorAll(NUMC);
    for (i = 0; i < boxes.length; i++) {
      if (!boxes[i].getClientRects().length) continue;          // contenedor oculto: no contar
      var walker = document.createTreeWalker(boxes[i], NodeFilter.SHOW_TEXT, null);
      var texts = [], t;
      while ((t = walker.nextNode())) if (/\d/.test(t.nodeValue)) texts.push(t);
      for (var j = 0; j < texts.length; j++) {
        var node = texts[j], pe = node.parentElement;
        if (!pe || pe.closest('a[href^="tel"]') || pe.classList.contains('kw-num')) continue;
        if (/\(\d{3}\)|\d{3}-\d{4}|\d{5}/.test(node.nodeValue)) continue;          // telefonos, ZIPs
        var re = /(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?/g, m, last = 0, frag = document.createDocumentFragment(), txt = node.nodeValue, any = false;
        while ((m = re.exec(txt))) {
          var whole = m[0], intPart = m[1], dec = m[2] || '';
          var val = parseFloat(intPart.replace(/,/g, '') + dec);
          if (!isFinite(val) || val > 99999 || (val > 1900 && val < 2100 && !dec)) continue;   // anos
          frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
          var sp = document.createElement('span');
          sp.className = 'kw-num'; sp.textContent = whole;
          sp.setAttribute('data-n', String(val));
          sp.setAttribute('data-dec', String(dec ? dec.length - 1 : 0));
          sp.setAttribute('data-comma', intPart.indexOf(',') >= 0 ? '1' : '0');
          frag.appendChild(sp); nums.push(sp);
          last = m.index + whole.length; any = true;
        }
        if (!any) continue;
        frag.appendChild(document.createTextNode(txt.slice(last)));
        pe.replaceChild(frag, node);
      }
    }
    function fmt(v, dec, comma) {
      var s = v.toFixed(dec);
      if (comma) { var parts = s.split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); s = parts.join('.'); }
      return s;
    }
    function count(sp) {
      if (sp.__done) return; sp.__done = true;
      var target = parseFloat(sp.getAttribute('data-n')), dec = +sp.getAttribute('data-dec'), comma = sp.getAttribute('data-comma') === '1';
      var final = sp.textContent, t0 = null, D = 1300, finished = false;
      function finish() { if (finished) return; finished = true; sp.textContent = final; }
      function step(ts) {
        if (finished) return;
        if (!t0) t0 = ts;
        var k = Math.min(1, (ts - t0) / D), e = 1 - Math.pow(1 - k, 3);
        if (k < 1) { sp.textContent = fmt(target * e, dec, comma); requestAnimationFrame(step); } else finish();
      }
      sp.textContent = fmt(0, dec, comma);
      requestAnimationFrame(step);
      setTimeout(finish, D + 100);                 // pestana en segundo plano: rAF no corre, el texto final si
    }

    // ---------- Observadores ----------
    var io = new IntersectionObserver(function (entries) {
      for (var q = 0; q < entries.length; q++) {
        var en = entries[q]; if (!en.isIntersecting) continue;
        reveal(en.target); io.unobserve(en.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    for (i = 0; i < els.length; i++) if (!els[i].classList.contains('kw-in')) io.observe(els[i]);

    var ion = new IntersectionObserver(function (entries) {
      for (var q = 0; q < entries.length; q++) {
        if (!entries[q].isIntersecting) continue;
        count(entries[q].target); ion.unobserve(entries[q].target);
      }
    }, { threshold: 0.1 });
    for (i = 0; i < nums.length; i++) ion.observe(nums[i]);

    // ---------- Red de seguridad (se detiene sola) ----------
    var pending = [], pendNums = nums.slice(), ticks = 0;
    for (i = 0; i < els.length; i++) if (!els[i].classList.contains('kw-in')) pending.push(els[i]);
    var guard = setInterval(function () {
      ticks++;
      var h = window.innerHeight || 800, keep = [], q;
      for (q = 0; q < pending.length; q++) {
        var e1 = pending[q];
        if (e1.__settled || e1.classList.contains('kw-in')) continue;
        var rc = e1.getBoundingClientRect();
        if (rc.bottom > 0 && rc.top < h) reveal(e1); else keep.push(e1);
      }
      pending = keep;
      var keepN = [];
      for (q = 0; q < pendNums.length; q++) {
        var sp2 = pendNums[q]; if (sp2.__done) continue;
        var rn = sp2.getBoundingClientRect();
        if (!(rn.width || rn.height)) continue;                  // oculto: fuera de la lista
        if (rn.bottom > 0 && rn.top < h) count(sp2); else keepN.push(sp2);
      }
      pendNums = keepN;
      if ((!pending.length && !pendNums.length) || ticks > 600) clearInterval(guard);   // tope: 7 min
    }, 700);
  } catch (e) {
    root.classList.remove('kw-motion');
  }
})();
