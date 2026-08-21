/* ==========================================================================
   ENGAZ Clinic V2 — shared browser runtime
   A dependency-free UI kit for the demo shell: DOM builders, formatters,
   dialogs, drawers, toasts and inline SVG charts.

   Safety rules this file honours on purpose:
   - no network APIs, no storage APIs, no cookies, no eval
   - every node is built through createElement / createElementNS and
     textContent, so untrusted strings can never become markup
   ========================================================================== */
(function () {
  'use strict';

  /* SVG vocabulary name used by createElementNS. It is an XML namespace
     identifier, not an address the browser ever requests. */
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var toastTimer = 0;
  var drawerRestoreFocus = null;
  var uidSeed = 0;

  /* ----------------------------------------------------------------------
     Selection helpers
     ---------------------------------------------------------------------- */
  function q(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function uid(prefix) {
    uidSeed += 1;
    return (prefix || 'id') + '-' + uidSeed;
  }

  /* ----------------------------------------------------------------------
     Text + number formatting
     ---------------------------------------------------------------------- */
  function cleanText(value, maxLength) {
    return Array.from(String(value == null ? '' : value), function (character) {
      var code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? ' ' : character;
    }).join('')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength || 80);
  }

  function phoneDigits(value) {
    return String(value == null ? '' : value).replace(/\D/g, '').slice(0, 15);
  }

  function validPhone(value) {
    var digits = phoneDigits(value);
    return digits.length >= 10 && digits.length <= 15;
  }

  function arNumber(value) {
    return new Intl.NumberFormat('ar-EG').format(Number(value) || 0);
  }

  function money(value) {
    return arNumber(Math.round(Number(value) || 0)) + ' ج.م';
  }

  function pct(value) {
    return arNumber(Math.round(Number(value) || 0)) + '٪';
  }

  function initials(name) {
    var parts = cleanText(name, 60).split(' ').filter(Boolean);
    if (!parts.length) return '؟';
    if (parts.length === 1) return parts[0].slice(0, 2);
    return parts[0].charAt(0) + parts[1].charAt(0);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function debounce(handler, wait) {
    var timer = 0;
    return function () {
      var args = arguments;
      var self = this;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { handler.apply(self, args); }, wait || 180);
    };
  }

  /* Deterministic pseudo-score so demo data stays stable between renders. */
  function seededScore(text, min, max) {
    var value = cleanText(text, 180);
    var hash = 0;
    for (var i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    var low = Number(min) || 0;
    var high = Number(max) || 100;
    return low + (Math.abs(hash) % (high - low + 1));
  }

  function sortBy(list, key, direction) {
    var factor = direction === 'desc' ? -1 : 1;
    return list.slice().sort(function (a, b) {
      var left = typeof key === 'function' ? key(a) : a[key];
      var right = typeof key === 'function' ? key(b) : b[key];
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor;
      return String(left).localeCompare(String(right), 'ar') * factor;
    });
  }

  /* ----------------------------------------------------------------------
     Element builders
     ---------------------------------------------------------------------- */
  function appendChildren(node, children) {
    (children || []).forEach(function (child) {
      if (child == null || child === false) return;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
  }

  function el(tag, options) {
    var node = document.createElement(tag);
    var opts = options || {};
    if (opts.className) node.className = opts.className;
    if (opts.text != null) node.textContent = String(opts.text);
    if (opts.id) node.id = opts.id;
    if (opts.type) node.type = opts.type;
    if (opts.value != null) node.value = String(opts.value);
    if (opts.name) node.name = opts.name;
    if (opts.placeholder) node.placeholder = opts.placeholder;
    if (opts.maxLength) node.maxLength = opts.maxLength;
    if (opts.min != null) node.min = String(opts.min);
    if (opts.max != null) node.max = String(opts.max);
    if (opts.step != null) node.step = String(opts.step);
    if (opts.checked) node.checked = true;
    if (opts.required) node.required = true;
    if (opts.disabled) node.disabled = true;
    if (opts.title) node.title = String(opts.title);
    if (opts.ariaLabel) node.setAttribute('aria-label', opts.ariaLabel);
    Object.keys(opts.dataset || {}).forEach(function (key) {
      node.dataset[key] = String(opts.dataset[key]);
    });
    Object.keys(opts.attrs || {}).forEach(function (key) {
      node.setAttribute(key, String(opts.attrs[key]));
    });
    Object.keys(opts.style || {}).forEach(function (key) {
      node.style.setProperty(key, String(opts.style[key]));
    });
    Object.keys(opts.on || {}).forEach(function (name) {
      node.addEventListener(name, opts.on[name]);
    });
    appendChildren(node, opts.children);
    return node;
  }

  function svgEl(tag, attrs, children) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, String(attrs[key]));
    });
    (children || []).forEach(function (child) {
      if (child != null) node.append(child);
    });
    return node;
  }

  function clear(node) {
    if (node) node.replaceChildren();
    return node;
  }

  function frag(children) {
    var box = document.createDocumentFragment();
    appendChildren(box, children);
    return box;
  }

  /* ----------------------------------------------------------------------
     Icons — small stroked glyphs drawn from path data
     ---------------------------------------------------------------------- */
  var ICONS = {
    home: ['M3 10.5 12 3l9 7.5', 'M5.5 9.5V21h13V9.5'],
    calendar: ['M3.5 6.5h17v14h-17z', 'M3.5 10.5h17', 'M8 3.5v4', 'M16 3.5v4'],
    users: ['M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M2.5 20.5c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5', 'M17 5.2a3.4 3.4 0 0 1 0 6.6', 'M18.5 15.4c2 .7 3 2.4 3 5.1'],
    wallet: ['M3.5 7.5h17v13h-17z', 'M3.5 7.5c0-1.7 1-2.8 2.8-3l11-1.6', 'M16.5 14h2'],
    box: ['M3.5 7.6 12 3.5l8.5 4.1v8.8L12 20.5l-8.5-4.1z', 'M3.5 7.6 12 11.8l8.5-4.2', 'M12 11.8v8.7'],
    spark: ['M12 3.5 13.8 9l5.7 1.6-4.4 3.9 1 5.8L12 17.6 7.9 20.3l1-5.8-4.4-3.9L10.2 9z'],
    chart: ['M4 20h16', 'M7 20V11', 'M12 20V5', 'M17 20v-6'],
    search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'M16.2 16.2 21 21'],
    alert: ['M12 4 2.8 20h18.4z', 'M12 10v4.5', 'M12 17.3v.2'],
    check: ['M4.5 12.8 9.5 18 20 6.6'],
    clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5.4l3.4 2'],
    bell: ['M6.2 9.6a5.8 5.8 0 0 1 11.6 0c0 4.2 1.7 5.9 1.7 5.9H4.5s1.7-1.7 1.7-5.9Z', 'M10 19a2.2 2.2 0 0 0 4 0'],
    info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 11v5.4', 'M12 7.6v.2'],
    sun: ['M12 16.6a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2Z', 'M12 2v2.2', 'M12 19.8V22', 'M2 12h2.2', 'M19.8 12H22', 'M5 5l1.6 1.6', 'M17.4 17.4 19 19', 'M19 5l-1.6 1.6', 'M6.6 17.4 5 19'],
    moon: ['M20 13.6A8.4 8.4 0 1 1 10.4 4a6.9 6.9 0 0 0 9.6 9.6Z'],
    menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
    print: ['M7 9V3.5h10V9', 'M7 18H4.5V9h15v9H17', 'M7 14h10v6.5H7z'],
    plus: ['M12 5v14', 'M5 12h14'],
    arrowUp: ['M12 19V5', 'M6 11l6-6 6 6'],
    arrowDown: ['M12 5v14', 'M6 13l6 6 6-6'],
    refresh: ['M20 12a8 8 0 1 1-2.6-5.9', 'M20 4v5h-5']
  };

  function icon(name, size) {
    var paths = ICONS[name] || ICONS.info;
    return svgEl('svg', {
      viewBox: '0 0 24 24',
      width: size || 16,
      height: size || 16,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.9,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false'
    }, paths.map(function (d) { return svgEl('path', { d: d }); }));
  }

  /* ----------------------------------------------------------------------
     Feedback: toast + screen-reader announcements
     ---------------------------------------------------------------------- */
  function toast(message, type) {
    var node = q('#toast');
    if (!node) return;
    window.clearTimeout(toastTimer);
    node.textContent = cleanText(message, 180);
    node.className = 'toast is-visible' + (type ? ' is-' + type : '');
    toastTimer = window.setTimeout(function () {
      node.className = 'toast';
    }, 3600);
  }

  function announce(message) {
    var node = q('#liveStatus');
    if (!node) return;
    node.textContent = '';
    window.setTimeout(function () {
      node.textContent = cleanText(message, 180);
    }, 20);
  }

  /* ----------------------------------------------------------------------
     Dialog
     ---------------------------------------------------------------------- */
  function closeDialog() {
    var dialog = q('#demoDialog');
    if (dialog && dialog.open) dialog.close();
  }

  function showDialog(config) {
    var dialog = q('#demoDialog');
    if (!dialog) return;
    var kicker = q('[data-dialog-kicker]', dialog);
    var title = q('[data-dialog-title]', dialog);
    var body = q('[data-dialog-body]', dialog);
    var actions = q('[data-dialog-actions]', dialog);
    kicker.textContent = cleanText(config.kicker || 'ENGAZ SMART', 50);
    title.textContent = cleanText(config.title || '', 100);
    clear(body);
    clear(actions);
    if (config.content) body.append(config.content);
    (config.actions || []).forEach(function (action) {
      var button = el('button', {
        className: 'btn ' + (action.className || ''),
        text: action.label,
        type: 'button',
        disabled: action.disabled
      });
      button.addEventListener('click', function () {
        if (action.onClick) action.onClick();
        if (action.close !== false) closeDialog();
      });
      actions.append(button);
    });
    if (!config.actions || !config.actions.length) {
      var done = el('button', { className: 'btn btn-primary', text: 'تم', type: 'button' });
      done.addEventListener('click', closeDialog);
      actions.append(done);
    }
    if (!dialog.open) dialog.showModal();
  }

  function bindDialogClose() {
    var close = q('[data-dialog-close]');
    if (close) close.addEventListener('click', closeDialog);
  }

  /* ----------------------------------------------------------------------
     Drawer — side panel for record details
     ---------------------------------------------------------------------- */
  function closeDrawer() {
    var drawer = q('#demoDrawer');
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    if (drawerRestoreFocus && document.contains(drawerRestoreFocus)) drawerRestoreFocus.focus();
    drawerRestoreFocus = null;
  }

  function openDrawer(config) {
    var drawer = q('#demoDrawer');
    if (!drawer) return;
    drawerRestoreFocus = document.activeElement;
    q('[data-drawer-kicker]', drawer).textContent = cleanText(config.kicker || 'RECORD', 50);
    q('[data-drawer-title]', drawer).textContent = cleanText(config.title || '', 90);
    var body = clear(q('[data-drawer-body]', drawer));
    var foot = clear(q('[data-drawer-foot]', drawer));
    (config.sections || []).forEach(function (section) { if (section) body.append(section); });
    (config.actions || []).forEach(function (action) {
      var button = el('button', {
        className: 'btn ' + (action.className || ''),
        text: action.label,
        type: 'button',
        disabled: action.disabled
      });
      button.addEventListener('click', function () {
        if (action.onClick) action.onClick();
        if (action.close !== false) closeDrawer();
      });
      foot.append(button);
    });
    foot.hidden = !foot.childElementCount;
    drawer.hidden = false;
    var close = q('[data-drawer-close]', drawer);
    if (close) close.focus();
  }

  function bindDrawer() {
    var drawer = q('#demoDrawer');
    if (!drawer) return;
    qa('[data-drawer-close], .drawer-scrim', drawer).forEach(function (node) {
      node.addEventListener('click', closeDrawer);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeDrawer();
    });
  }

  /* ----------------------------------------------------------------------
     Content blocks
     ---------------------------------------------------------------------- */
  function resultBox(title, text, reasons) {
    var wrap = el('div');
    var box = el('div', { className: 'result-box' });
    box.append(el('strong', { text: title }), el('p', { text: text }));
    wrap.append(box);
    if (reasons && reasons.length) {
      var list = el('ul', { className: 'reason-list' });
      reasons.forEach(function (reason) { list.append(el('li', { text: reason })); });
      wrap.append(list);
    }
    return wrap;
  }

  function kvList(pairs) {
    var list = el('div', { className: 'kv-list' });
    (pairs || []).forEach(function (pair) {
      if (!pair) return;
      list.append(el('div', {
        className: 'kv',
        children: [el('span', { text: pair[0] }), el('b', { text: pair[1] })]
      }));
    });
    return list;
  }

  function panel(title, subtitle, bodyChildren, headExtra) {
    var head = el('div', {
      className: 'panel-head',
      children: [el('div', {
        children: [
          el('h3', { className: 'panel-title', text: title }),
          subtitle ? el('span', { className: 'panel-subtitle', text: subtitle }) : null
        ]
      })]
    });
    if (headExtra) head.append(headExtra);
    return el('article', {
      className: 'panel',
      children: [head, el('div', { className: 'panel-body', children: bodyChildren })]
    });
  }

  function field(config) {
    var wrap = el('div', { className: 'field' + (config.full ? ' full' : '') });
    var id = config.id || uid('field');
    var label = el('label', { text: config.label, attrs: { for: id } });
    var input;
    if (config.type === 'select') {
      input = el('select', { id: id, name: config.name || id });
      (config.options || []).forEach(function (option) {
        input.append(el('option', { text: option.label, value: option.value }));
      });
      if (config.value != null) input.value = String(config.value);
    } else if (config.type === 'textarea') {
      input = el('textarea', {
        id: id,
        name: config.name || id,
        placeholder: config.placeholder || '',
        maxLength: config.maxLength || 240,
        required: config.required
      });
    } else {
      input = el('input', {
        id: id,
        type: config.type || 'text',
        name: config.name || id,
        placeholder: config.placeholder || '',
        maxLength: config.maxLength || 80,
        required: config.required,
        value: config.value,
        min: config.min,
        max: config.max,
        step: config.step,
        attrs: config.attrs || {}
      });
    }
    wrap.append(label, input);
    if (config.hint) wrap.append(el('span', { className: 'field-hint', text: config.hint }));
    return { wrap: wrap, input: input, id: id };
  }

  function slider(config) {
    var id = config.id || uid('slider');
    var readout = el('b', { text: config.format ? config.format(config.value) : String(config.value) });
    var input = el('input', {
      id: id,
      type: 'range',
      min: config.min,
      max: config.max,
      step: config.step || 1,
      value: config.value
    });
    input.addEventListener('input', function () {
      readout.textContent = config.format ? config.format(Number(input.value)) : input.value;
      if (config.onInput) config.onInput(Number(input.value));
    });
    var wrap = el('div', {
      className: 'slider-row',
      children: [
        el('div', {
          className: 'slider-head',
          children: [el('label', { text: config.label, attrs: { for: id } }), readout]
        }),
        input,
        config.note ? el('span', { className: 'slider-note', text: config.note }) : null
      ]
    });
    return { wrap: wrap, input: input };
  }

  /* ----------------------------------------------------------------------
     Charts — inline SVG, no libraries
     ---------------------------------------------------------------------- */
  function chartFrame(svg) {
    return el('div', { className: 'chart-frame', children: [svg] });
  }

  function niceMax(value) {
    var target = Math.max(1, value);
    var magnitude = Math.pow(10, Math.floor(Math.log10(target)));
    return Math.ceil(target / magnitude) * magnitude;
  }

  function pointsFor(values, max, width, height, padStart, padEnd, padY) {
    var span = Math.max(1, values.length - 1);
    return values.map(function (value, index) {
      return {
        x: padStart + (index / span) * (width - padStart - padEnd),
        y: height - padY - (clamp(value, 0, max) / max) * (height - padY * 2)
      };
    });
  }

  function smoothPath(points) {
    if (!points.length) return '';
    var d = 'M' + points[0].x.toFixed(1) + ' ' + points[0].y.toFixed(1);
    for (var i = 1; i < points.length; i += 1) {
      var prev = points[i - 1];
      var current = points[i];
      var midX = (prev.x + current.x) / 2;
      d += ' C' + midX.toFixed(1) + ' ' + prev.y.toFixed(1) +
        ' ' + midX.toFixed(1) + ' ' + current.y.toFixed(1) +
        ' ' + current.x.toFixed(1) + ' ' + current.y.toFixed(1);
    }
    return d;
  }

  /* The document is right-to-left, so a time series has to read right-to-left
     too. SVG coordinates are always left-to-right, so the data is mirrored. */
  function mirror(list) {
    return (list || []).slice().reverse();
  }

  function mirrorSeries(series) {
    return (series || []).map(function (item) {
      return { name: item.name, color: item.color, area: item.area, values: mirror(item.values) };
    });
  }

  /* config: { labels, series:[{name,color,values,area}], height, max } */
  function lineChart(config) {
    var width = 640;
    var height = config.height || 220;
    var padStart = 26;
    /* The value axis is drawn on the right, the reading-start side in RTL, so
       that edge needs a gutter wide enough to keep labels off the last point. */
    var padEnd = 46;
    var padY = 22;
    var labels = mirror(config.labels);
    var series = mirrorSeries(config.series);
    var peak = 0;
    series.forEach(function (item) {
      item.values.forEach(function (value) { peak = Math.max(peak, Number(value) || 0); });
    });
    var max = config.max || niceMax(peak * 1.15);
    var kids = [];

    for (var line = 0; line <= 4; line += 1) {
      var y = padY + (line / 4) * (height - padY * 2);
      kids.push(svgEl('line', { x1: padStart, x2: width - padEnd, y1: y, y2: y, class: 'chart-grid-line' }));
      kids.push(svgEl('text', {
        x: width - padEnd + 8,
        y: y + 3,
        class: 'chart-axis-text',
        'text-anchor': 'start'
      }, [document.createTextNode(arNumber(Math.round(max - (line / 4) * max)))]));
    }

    series.forEach(function (item, seriesIndex) {
      var points = pointsFor(item.values, max, width, height, padStart, padEnd, padY);
      if (item.area !== false) {
        var areaId = 'grad-' + seriesIndex + '-' + uidSeed;
        var defs = svgEl('defs', {}, [
          svgEl('linearGradient', { id: areaId, x1: 0, y1: 0, x2: 0, y2: 1 }, [
            svgEl('stop', { offset: '0%', 'stop-color': item.color, 'stop-opacity': .28 }),
            svgEl('stop', { offset: '100%', 'stop-color': item.color, 'stop-opacity': 0 })
          ])
        ]);
        kids.push(defs);
        kids.push(svgEl('path', {
          d: smoothPath(points) + ' L' + points[points.length - 1].x.toFixed(1) + ' ' + (height - padY) +
            ' L' + points[0].x.toFixed(1) + ' ' + (height - padY) + ' Z',
          fill: 'url(#' + areaId + ')'
        }));
      }
      kids.push(svgEl('path', { d: smoothPath(points), stroke: item.color, class: 'chart-line' }));
      points.forEach(function (point) {
        kids.push(svgEl('circle', { cx: point.x, cy: point.y, r: 3.4, fill: item.color, class: 'chart-dot' }));
      });
    });

    labels.forEach(function (label, index) {
      var span = Math.max(1, labels.length - 1);
      var x = padStart + (index / span) * (width - padStart - padEnd);
      kids.push(svgEl('text', {
        x: x,
        y: height - 4,
        class: 'chart-axis-text',
        'text-anchor': 'middle'
      }, [document.createTextNode(label)]));
    });

    var svg = svgEl('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      role: 'img',
      'aria-label': config.ariaLabel || 'رسم بياني خطي'
    }, kids);
    return chartFrame(svg);
  }

  /* config: { labels, series:[{name,color,values}], height } grouped columns */
  function barChart(config) {
    var width = 640;
    var height = config.height || 210;
    var padX = 30;
    var padY = 20;
    var labels = mirror(config.labels);
    var series = mirrorSeries(config.series);
    var peak = 0;
    series.forEach(function (item) {
      item.values.forEach(function (value) { peak = Math.max(peak, Number(value) || 0); });
    });
    var max = niceMax(peak * 1.12);
    var kids = [];
    var groupWidth = (width - padX * 2) / Math.max(1, labels.length);
    var barWidth = Math.min(26, (groupWidth - 12) / Math.max(1, series.length));

    for (var line = 0; line <= 3; line += 1) {
      var y = padY + (line / 3) * (height - padY * 2);
      kids.push(svgEl('line', { x1: padX, x2: width - padX, y1: y, y2: y, class: 'chart-grid-line' }));
    }

    labels.forEach(function (label, index) {
      var groupStart = padX + index * groupWidth + (groupWidth - barWidth * series.length) / 2;
      series.forEach(function (item, seriesIndex) {
        var value = Number(item.values[index]) || 0;
        var barHeight = (clamp(value, 0, max) / max) * (height - padY * 2);
        kids.push(svgEl('rect', {
          x: groupStart + seriesIndex * barWidth,
          y: height - padY - barHeight,
          width: Math.max(4, barWidth - 3),
          height: Math.max(1, barHeight),
          rx: 4,
          fill: item.color,
          class: 'chart-bar'
        }, [svgEl('title', {}, [document.createTextNode(item.name + ': ' + arNumber(value))])]));
      });
      kids.push(svgEl('text', {
        x: padX + index * groupWidth + groupWidth / 2,
        y: height - 4,
        class: 'chart-axis-text',
        'text-anchor': 'middle'
      }, [document.createTextNode(label)]));
    });

    return chartFrame(svgEl('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      role: 'img',
      'aria-label': config.ariaLabel || 'رسم بياني أعمدة'
    }, kids));
  }

  /* segments: [{ label, value, color }] */
  function donutChart(segments, centerLabel, centerValue) {
    var size = 148;
    var radius = 60;
    var circumference = 2 * Math.PI * radius;
    var total = (segments || []).reduce(function (sum, item) { return sum + (Number(item.value) || 0); }, 0) || 1;
    var offset = 0;
    var rings = (segments || []).map(function (item) {
      var portion = (Number(item.value) || 0) / total;
      var ring = svgEl('circle', {
        cx: size / 2,
        cy: size / 2,
        r: radius,
        fill: 'none',
        stroke: item.color,
        'stroke-width': 17,
        'stroke-dasharray': (portion * circumference).toFixed(2) + ' ' + circumference,
        'stroke-dashoffset': (-offset * circumference).toFixed(2)
      }, [svgEl('title', {}, [document.createTextNode(item.label + ': ' + arNumber(item.value))])]);
      offset += portion;
      return ring;
    });

    var svg = svgEl('svg', { viewBox: '0 0 ' + size + ' ' + size, role: 'img', 'aria-label': centerLabel || 'رسم دائري' }, [
      svgEl('circle', { cx: size / 2, cy: size / 2, r: radius, fill: 'none', stroke: 'var(--line)', 'stroke-width': 17 })
    ].concat(rings));

    var wrap = el('div', { className: 'donut-wrap' });
    var chart = el('div', { className: 'donut', children: [svg] });
    if (centerValue != null) {
      chart.style.setProperty('position', 'relative');
      chart.append(el('div', {
        className: 'gauge-label',
        children: [
          el('b', { text: String(centerValue), style: { 'font-size': '20px' } }),
          el('span', { text: centerLabel || '' })
        ]
      }));
    }
    var legend = el('div', { className: 'donut-legend' });
    (segments || []).forEach(function (item) {
      legend.append(el('div', {
        children: [
          el('span', { className: 'legend-swatch', style: { background: item.color } }),
          el('span', { text: item.label }),
          el('b', { text: item.display != null ? item.display : arNumber(item.value) })
        ]
      }));
    });
    wrap.append(chart, legend);
    return wrap;
  }

  /* value 0..100 */
  function gauge(value, caption) {
    var size = 150;
    var radius = 62;
    var circumference = 2 * Math.PI * radius;
    var portion = clamp(value, 0, 100) / 100;
    var svg = svgEl('svg', { viewBox: '0 0 ' + size + ' ' + size, 'aria-hidden': 'true' }, [
      svgEl('circle', { cx: size / 2, cy: size / 2, r: radius, class: 'gauge-track' }),
      svgEl('circle', {
        cx: size / 2,
        cy: size / 2,
        r: radius,
        class: 'gauge-value',
        'stroke-dasharray': circumference.toFixed(1),
        'stroke-dashoffset': (circumference * (1 - portion)).toFixed(1),
        stroke: portion >= .8 ? 'var(--good)' : portion >= .6 ? 'var(--accent)' : 'var(--warn)'
      })
    ]);
    return el('div', {
      className: 'gauge',
      children: [svg, el('div', {
        className: 'gauge-label',
        children: [
          el('b', { text: arNumber(Math.round(clamp(value, 0, 100))) + '٪' }),
          el('span', { text: caption || '' })
        ]
      })]
    });
  }

  function sparkline(values, color) {
    var width = 74;
    var height = 30;
    var max = Math.max.apply(null, values.concat([1]));
    var min = Math.min.apply(null, values);
    var span = Math.max(1, values.length - 1);
    var range = Math.max(1, max - min);
    var points = values.map(function (value, index) {
      return { x: (index / span) * width, y: height - ((value - min) / range) * (height - 4) - 2 };
    });
    var last = points[points.length - 1];
    return el('div', {
      className: 'kpi-spark',
      children: [svgEl('svg', { viewBox: '0 0 ' + width + ' ' + height, 'aria-hidden': 'true' }, [
        svgEl('path', { d: smoothPath(points), fill: 'none', stroke: color || 'var(--accent)', 'stroke-width': 2, 'stroke-linecap': 'round' }),
        svgEl('circle', { cx: last.x, cy: last.y, r: 2.6, fill: color || 'var(--accent)' })
      ])]
    });
  }

  function legend(items) {
    return el('div', {
      className: 'legend',
      children: (items || []).map(function (item) {
        return el('span', {
          className: 'legend-item',
          children: [
            el('span', { className: 'legend-swatch', style: { background: item.color } }),
            el('span', { text: item.label })
          ]
        });
      })
    });
  }

  /* ----------------------------------------------------------------------
     Shell behaviour: tenant, gate, theme, navigation, tabs
     ---------------------------------------------------------------------- */
  function setTenant(name) {
    var safeName = cleanText(name, 60);
    qa('[data-tenant-name]').forEach(function (node) { node.textContent = safeName; });
    document.title = safeName + ' — ENGAZ Clinic V2';
    return safeName;
  }

  function bindGate(defaultName, onOpen) {
    var gate = q('#launchGate');
    var form = q('#launchForm');
    var input = q('#businessName');
    if (!gate || !form || !input) return defaultName;
    input.value = defaultName;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var name = cleanText(input.value, 60) || defaultName;
      setTenant(name);
      gate.hidden = true;
      var main = q('#mainContent');
      if (main) main.focus();
      announce('تم فتح النسخة الذكية باسم ' + name);
      if (onOpen) onOpen(name);
    });
    return defaultName;
  }

  function prefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function currentTheme() {
    var explicit = document.documentElement.getAttribute('data-theme');
    if (explicit) return explicit;
    return prefersDark() ? 'dark' : 'light';
  }

  function bindTheme() {
    var button = q('[data-theme-toggle]');
    if (!button) return;
    button.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      button.setAttribute('aria-label', next === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن');
      announce(next === 'dark' ? 'تم تفعيل الوضع الداكن' : 'تم تفعيل الوضع الفاتح');
    });
  }

  /* Single-page view switcher driven by [data-view] buttons and .view panes. */
  function bindNav(onChange) {
    var sidebar = q('#sidebar');
    var backdrop = q('#sidebarBackdrop');
    var toggle = q('[data-nav-toggle]');

    function closeMobileNav() {
      if (!sidebar) return;
      sidebar.classList.remove('is-open');
      if (backdrop) backdrop.hidden = true;
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }

    if (toggle && sidebar) {
      toggle.addEventListener('click', function () {
        var open = !sidebar.classList.contains('is-open');
        sidebar.classList.toggle('is-open', open);
        if (backdrop) backdrop.hidden = !open;
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    if (backdrop) backdrop.addEventListener('click', closeMobileNav);

    function activate(name) {
      var found = false;
      qa('.view').forEach(function (view) {
        var match = view.dataset.viewPane === name;
        view.hidden = !match;
        if (match) found = true;
      });
      if (!found) return;
      qa('.side-nav [data-view]').forEach(function (button) {
        if (button.dataset.view === name) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
      closeMobileNav();
      var main = q('#mainContent');
      if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (onChange) onChange(name);
    }

    qa('[data-view]').forEach(function (button) {
      button.addEventListener('click', function () { activate(button.dataset.view); });
    });

    return activate;
  }

  /* items: [{ id, label, render() }] — renders into `host`. */
  function tabs(host, items, onSelect) {
    var bar = el('div', { className: 'tabs', attrs: { role: 'tablist' } });
    var pane = el('div', { className: 'tabpanel', attrs: { role: 'tabpanel' } });

    function select(id) {
      qa('button', bar).forEach(function (button) {
        button.setAttribute('aria-selected', button.dataset.tab === id ? 'true' : 'false');
      });
      var item = items.find(function (entry) { return entry.id === id; });
      clear(pane);
      if (item && item.render) pane.append(item.render());
      if (onSelect) onSelect(id);
    }

    items.forEach(function (item) {
      var button = el('button', {
        type: 'button',
        text: item.label,
        dataset: { tab: item.id },
        attrs: { role: 'tab', 'aria-selected': 'false' }
      });
      button.addEventListener('click', function () { select(item.id); });
      bar.append(button);
    });

    clear(host);
    host.append(bar, pane);
    if (items.length) select(items[0].id);
    return { select: select, bar: bar, pane: pane };
  }

  /* Wires sortable table headers. `state` is mutated with { key, direction }. */
  function bindSort(table, state, onSort) {
    qa('th.sortable', table).forEach(function (th) {
      th.append(el('span', { className: 'sort-mark', text: '↕' }));
      th.setAttribute('tabindex', '0');
      function apply() {
        var key = th.dataset.sortKey;
        if (state.key === key) state.direction = state.direction === 'asc' ? 'desc' : 'asc';
        else { state.key = key; state.direction = 'asc'; }
        qa('th.sortable', table).forEach(function (other) {
          other.removeAttribute('aria-sort');
          q('.sort-mark', other).textContent = '↕';
        });
        th.setAttribute('aria-sort', state.direction === 'asc' ? 'ascending' : 'descending');
        q('.sort-mark', th).textContent = state.direction === 'asc' ? '↑' : '↓';
        if (onSort) onSort();
      }
      th.addEventListener('click', apply);
      th.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); apply(); }
      });
    });
  }

  window.EngazV2 = {
    q: q,
    qa: qa,
    el: el,
    svgEl: svgEl,
    clear: clear,
    frag: frag,
    uid: uid,
    icon: icon,
    cleanText: cleanText,
    phoneDigits: phoneDigits,
    validPhone: validPhone,
    arNumber: arNumber,
    money: money,
    pct: pct,
    initials: initials,
    clamp: clamp,
    debounce: debounce,
    seededScore: seededScore,
    sortBy: sortBy,
    toast: toast,
    announce: announce,
    showDialog: showDialog,
    closeDialog: closeDialog,
    bindDialogClose: bindDialogClose,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    bindDrawer: bindDrawer,
    resultBox: resultBox,
    kvList: kvList,
    panel: panel,
    field: field,
    slider: slider,
    lineChart: lineChart,
    barChart: barChart,
    donutChart: donutChart,
    gauge: gauge,
    sparkline: sparkline,
    legend: legend,
    setTenant: setTenant,
    bindGate: bindGate,
    bindTheme: bindTheme,
    bindNav: bindNav,
    tabs: tabs,
    bindSort: bindSort
  };
}());
