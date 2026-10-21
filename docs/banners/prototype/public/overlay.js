// Общий слой текста и логотипа. Один и тот же код работает в превью на сайте
// и в headless Chromium при рендере, поэтому итоговый файл совпадает с превью 1 в 1.
(function (root) {
  'use strict';

  // Та же матрица, что у CSS hue-rotate(). Её же передаём в ffmpeg colorchannelmixer.
  function hueMatrix(deg) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [
      0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
      0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
      0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072
    ];
  }

  function shiftColor(hex, deg) {
    const n = parseInt(hex.slice(1), 16);
    const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const m = hueMatrix(deg);
    const out = [0, 1, 2].map(i => Math.max(0, Math.min(255, Math.round(
      m[i * 3] * rgb[0] + m[i * 3 + 1] * rgb[1] + m[i * 3 + 2] * rgb[2]))));
    return 'rgb(' + out.join(',') + ')';
  }

  function build(stage, tpl) {
    stage.classList.add('bn-stage');
    stage.style.width = tpl.width + 'px';
    stage.style.height = tpl.height + 'px';
    const layer = document.createElement('div');
    layer.className = 'bn-layer';
    for (const f of tpl.fields) {
      const zone = document.createElement('div');
      zone.className = 'bn-zone bn-' + f.type;
      zone.dataset.key = f.key;
      Object.assign(zone.style, { left: f.x + '%', top: f.y + '%', width: f.w + '%', height: f.h + '%' });
      if (f.type === 'image') {
        const img = document.createElement('img');
        img.alt = '';
        img.hidden = true;
        zone.appendChild(img);
      } else {
        const t = document.createElement('div');
        t.className = 'bn-text';
        t.style.fontFamily = '"' + f.font + '", sans-serif';
        t.style.fontWeight = f.weight;
        if (f.case === 'upper') t.style.textTransform = 'uppercase';
        zone.appendChild(t);
      }
      layer.appendChild(zone);
    }
    stage.appendChild(layer);
    return layer;
  }

  // Уменьшаем шрифт, пока текст не влезет в зону. Длинные слова тоже не должны вылезать.
  function fit(zone, f, W) {
    const t = zone.firstChild;
    let size = f.size * W / 100;
    const min = (f.minSize || f.size / 2) * W / 100;
    t.style.overflowWrap = 'normal';
    t.style.fontSize = size + 'px';
    const over = () => t.offsetHeight > zone.clientHeight + 0.5 || t.scrollWidth > t.clientWidth + 0.5;
    while (over() && size > min) {
      size = Math.max(min, size - 1);
      t.style.fontSize = size + 'px';
    }
    if (over()) t.style.overflowWrap = 'anywhere';
  }

  function update(stage, tpl, data) {
    const hue = Number(data.hue) || 0;
    const accent = shiftColor(tpl.accent, hue);
    const waits = [];
    for (const f of tpl.fields) {
      const zone = stage.querySelector('.bn-zone[data-key="' + f.key + '"]');
      if (!zone) continue;
      if (f.type === 'image') {
        const img = zone.firstChild;
        const src = data[f.key] || '';
        if (!src) { img.hidden = true; img.removeAttribute('src'); continue; }
        if (img.getAttribute('src') !== src) {
          img.src = src;
          waits.push(img.decode().catch(() => {}));
        }
        img.hidden = false;
      } else {
        const t = zone.firstChild;
        const value = String(data[f.key] ?? f.default ?? '').slice(0, f.maxLength || 200);
        t.textContent = value;
        t.style.color = f.color || '#ffffff';
        t.style.textShadow = f.glow === false
          ? '0 0.04em 0.12em rgba(0,0,0,.35)'
          : '0 0 0.35em ' + accent + ', 0 0.04em 0.1em rgba(0,0,0,.55)';
        fit(zone, f, tpl.width);
      }
    }
    return Promise.all(waits);
  }

  root.BannerOverlay = { build, update, hueMatrix, shiftColor };
})(typeof window !== 'undefined' ? window : globalThis);
