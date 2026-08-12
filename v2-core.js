(function () {
  'use strict';

  var toastTimer = 0;

  function q(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

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
    return arNumber(value) + ' ج.م';
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
    if (opts.required) node.required = true;
    if (opts.disabled) node.disabled = true;
    if (opts.ariaLabel) node.setAttribute('aria-label', opts.ariaLabel);
    Object.keys(opts.dataset || {}).forEach(function (key) {
      node.dataset[key] = String(opts.dataset[key]);
    });
    Object.keys(opts.attrs || {}).forEach(function (key) {
      node.setAttribute(key, String(opts.attrs[key]));
    });
    (opts.children || []).forEach(function (child) {
      if (child != null) node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function clear(node) {
    if (node) node.replaceChildren();
    return node;
  }

  function toast(message, type) {
    var node = q('#toast');
    if (!node) return;
    window.clearTimeout(toastTimer);
    node.textContent = cleanText(message, 180);
    node.className = 'toast is-visible' + (type ? ' is-' + type : '');
    toastTimer = window.setTimeout(function () {
      node.className = 'toast';
    }, 3200);
  }

  function announce(message) {
    var node = q('#liveStatus');
    if (!node) return;
    node.textContent = '';
    window.setTimeout(function () {
      node.textContent = cleanText(message, 180);
    }, 20);
  }

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
        type: 'button'
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

  function resultBox(title, text, reasons) {
    var wrap = el('div');
    var box = el('div', { className: 'result-box' });
    box.append(el('strong', { text: title }), el('p', { text: text }));
    wrap.append(box);
    if (reasons && reasons.length) {
      var list = el('ul', { className: 'reason-list' });
      reasons.forEach(function (reason) {
        list.append(el('li', { text: reason }));
      });
      wrap.append(list);
    }
    return wrap;
  }

  function field(config) {
    var wrap = el('div', { className: 'field' + (config.full ? ' full' : '') });
    var id = config.id;
    var label = el('label', { text: config.label, attrs: { for: id } });
    var input;
    if (config.type === 'select') {
      input = el('select', { id: id, name: config.name || id });
      (config.options || []).forEach(function (option) {
        var opt = el('option', { text: option.label, value: option.value });
        input.append(opt);
      });
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
        attrs: config.attrs || {}
      });
    }
    wrap.append(label, input);
    if (config.hint) wrap.append(el('span', { className: 'field-hint', text: config.hint }));
    return { wrap: wrap, input: input };
  }

  function setTenant(name) {
    var safeName = cleanText(name, 60);
    qa('[data-tenant-name]').forEach(function (node) {
      node.textContent = safeName;
    });
    document.title = safeName + ' — ENGAZ V2';
    return safeName;
  }

  function bindGate(defaultName) {
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
      q('#mainContent').focus();
      announce('تم فتح النسخة الذكية باسم ' + name);
    });
    return defaultName;
  }

  function bindDialogClose() {
    var close = q('[data-dialog-close]');
    if (close) close.addEventListener('click', closeDialog);
  }

  function seededScore(text, min, max) {
    var value = cleanText(text, 180);
    var hash = 0;
    for (var i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    var low = Number(min) || 0;
    var high = Number(max) || 100;
    return low + (Math.abs(hash) % (high - low + 1));
  }

  window.EngazV2 = {
    q: q,
    qa: qa,
    el: el,
    clear: clear,
    cleanText: cleanText,
    phoneDigits: phoneDigits,
    validPhone: validPhone,
    arNumber: arNumber,
    money: money,
    toast: toast,
    announce: announce,
    showDialog: showDialog,
    closeDialog: closeDialog,
    resultBox: resultBox,
    field: field,
    setTenant: setTenant,
    bindGate: bindGate,
    bindDialogClose: bindDialogClose,
    seededScore: seededScore
  };
}());
