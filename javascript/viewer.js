class SDImageScriptsViewer {
  constructor(img, lightBox, controls, opts = {}) {
    this.img = img;
    this.lightBox = lightBox;
    this.controls = controls;
    this.opts = opts;

    img.ondrag = img.ondragend = img.ondragstart = (e) => (e.stopPropagation(), e.preventDefault());

    this.resizer = null;
    this.lastDistance = 0;
    this.lastScale = 1;
    this.MAX = 10;
    this.MIN = 1.0001;
    this._unfitTimer = null;
    this._wheely = null;

    const {
      persist = null,
      dragStart = null,
      dragEnd = null,
      exitStart = null,
      exitEnd = null,
      initDelay = null,
      eventDelay = null
    } = opts;

    this.persist = persist;
    this.dragStart = dragStart;
    this.dragEnd = dragEnd;
    this.exitStart = exitStart;
    this.exitEnd = exitEnd;
    this.initDelay = initDelay ?? 150;
    this.eventDelay = eventDelay ?? 400;

    this.state = {
      GropinTime: null, Groped: false, MultiGrope: false, Axis: null,
      baseLine: 1, scale: 1.0001,
      offsetX: 0, offsetY: 0, lastX: 0, lastY: 0, lastLen: 1, LastTouch: 0, LastZoom: 0, MoveMomentum: 0,
      SnapMouse: 30, SnapTouch: 10, dragSpeed: 1.5,

      TouchGrass: {
        touchScale: false,
        scale: 1.0001, last1X: 0, last1Y: 0, last2X: 0, last2Y: 0,
        delta1X: 0, delta1Y: 0, delta2X: 0, delta2Y: 0
      }
    };

    this.initialize();
  }

  initialize() {
    this.zoomControllers();
    this.reset();

    setTimeout(() => {
      this.state.scale = this.imgSize();
      this.zoomControls();

      const perNum = this.controls.querySelector('.sd-image-scripts-zoom-controller-percentage-number');
      if (perNum && this.zoomNumList && typeof this._zoomList === 'function') this._zoomList(perNum, this.zoomNumList);
    }, this.initDelay);

    this.windowEvents();

    setTimeout(() => {
      this.addEvents();
    }, this.eventDelay);
  }

  imgSize() {
    if (!this.img.naturalWidth || !this.img.naturalHeight) {
      this.state.baseLine = this.MIN;
      return this.MIN;
    }

    const s = Math.min(
      this.lightBox.offsetWidth / this.img.naturalWidth,
      this.lightBox.offsetHeight / this.img.naturalHeight
    );
    this.state.baseLine = s >= 1 ? this.MIN : this.MIN / s;
    return this.MIN;
  }

  percentage() {
    return (this.state.scale / this.state.baseLine) * 100;
  }

  dimensions(scale = this.state.scale) {
    return {
      imgW: this.img.offsetWidth * scale,
      imgH: this.img.offsetHeight * scale,
      lightBoxW: this.lightBox.offsetWidth,
      lightBoxH: this.lightBox.offsetHeight
    };
  }

  fitting() {
    if (!this.img.naturalWidth || !this.img.naturalHeight) return { fitW: 100, fitH: 100 };
    const fitW = (this.lightBox.offsetWidth / this.img.naturalWidth) * 100;
    const fitH = (this.lightBox.offsetHeight / this.img.naturalHeight) * 100;
    return { fitW, fitH };
  }

  increase(n) {
    if (n === 100) {
      const { fitW, fitH } = this.fitting(), f = Math.min(fitW, fitH);
      if (f > 100) return f;
    }

    return n < 100 && n % 10 !== 0 ? Math.ceil(n / 10) * 10 : n < 200 ? n + 10 : n < 400 ? n + 25 : n + 50;
  }

  decrease(n) {
    const { fitW, fitH } = this.fitting(), f = Math.min(fitW, fitH);
    return f > 100 && Math.abs(n - f) < 1 ? 100 : n <= 100 && n % 10 !== 0 ? Math.floor((n - 0.1) / 10) * 10 : n <= 200 ? n - 10 : n <= 400 ? n - 25 : n - 50;
  }

  zooming(v) {
    this.img.style.transition = 'transform .35s cubic-bezier(.3,.6,.6,1)';

    const a = (this.MIN / this.state.baseLine) * 100,
    b = (this.MAX / this.state.baseLine) * 100,
    c = Math.max(a, Math.min(v, b));

    if (this.zoomSlider && +this.zoomSlider.value !== c) this.zoomSlider.value = c;
    this.zoomPercentage(c);

    const d = this.state.scale;
    this.state.scale = (c / 100) * this.state.baseLine;

    const { imgW: e, imgH: f, lightBoxW: g, lightBoxH: h } = this.dimensions(),
    [i, j] = [this.lightBox.offsetWidth / 2, this.lightBox.offsetHeight / 2];

    if (this.state.scale <= this.MIN) {
      this.state.offsetX = this.state.offsetY = 0;
      this.img.style.transform = `translate(0,0) scale(${this.MIN})`;
      return;
    }

    const { fitW: k, fitH: l } = this.fitting(), m = Math.min(k, l),

    n = (o, p, q, r) => {
      const s = o + p;
      const t = p - ((p - s) / d) * this.state.scale - p;
      const u = (q - r) / 2;
      return Math.max(-u, Math.min(t, u));
    },

    w = (x, y, z, A) => {
      const B = this.state[A];
      const C = c <= m + 0.5;
      if (x <= y) this.state[A] = 0;
      else if (C && Math.abs(B) < 1) this.state[A] = 0;
      else this.state[A] = n(B, z, x, y);
      return `translate${A === 'offsetX' ? 'X' : 'Y'}(${this.state[A]}px)`;
    },

    D = w(e, g, i, 'offsetX'),
    E = w(f, h, j, 'offsetY');

    this.img.style.transform = `${D} ${E} scale(${this.state.scale})`;
  }

  zoomControls() {
    const a = this.percentage();
    this.zoomPercentage(a);
    this.MAX = (800 / 100) * this.state.baseLine;

    Object.assign(this.zoomSlider, {
      min: Math.round((this.MIN / this.state.baseLine) * 100),
      max: 800,
      value: Math.round(a),
      oninput: (b) => {
        clearTimeout(this._unfitTimer);
        this._unfitTimer = setTimeout(() => this.unfitImg(), 10);
        this.zooming(+b.target.value);
      },
      onmousedown: () => this.closeZoomList(),
      onwheel: (e) => {
        e.preventDefault();
        e.stopPropagation();

        clearTimeout(this._unfitTimer);
        this._unfitTimer = setTimeout(() => this.unfitImg(), 10);
        const min = +this.zoomSlider.min,
        max = +this.zoomSlider.max,
        cur = +this.zoomSlider.value,
        delta = -e.deltaY * 0.10,
        next = Math.max(min, Math.min(max, cur + delta));
        this.zooming(next);
      }
    });

    const c = (d) => {
      let e, f, g = false;

      return {
        start: (h) => {
          if (g) return;
          g = true;
          if (h) h.preventDefault();

          const i = () => {
            const j = +this.zoomSlider.value;
            const k = d === this.increase.bind(this) ? d(j) : d(j);
            if (k !== j) {
              this.zoomSlider.value = k;
              this.zooming(k);
            }
          };

          i();
          f = setTimeout(() => e = setInterval(i, 50), 500);
        },

        stop: () => {
          g = false;
          clearTimeout(f);
          clearInterval(e);
        }
      };
    };

    const l = {
      max: c(this.increase.bind(this)),
      min: c(this.decrease.bind(this))
    };

    [this.zoomMax, this.zoomMin].forEach((m, n) => {
      const o = n ? l.min : l.max;
      const p = m.cloneNode(true);
      m.replaceWith(p);
      if (n) this.zoomMin = p; else this.zoomMax = p;

      ['mousedown', 'touchstart'].forEach(q => {
        p.addEventListener(q, (r) => {
          r.preventDefault();
          this.closeZoomList();
          this.unfitImg();
          o.start(r);
        });
      });

      ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(q => {
        p.addEventListener(q, () => o.stop());
      });

      p.addEventListener('dblclick', (r) => {
        r.preventDefault();
        o.stop();
      });
    });
  }

  displayZoomList() {
    clearTimeout(this._zoomListTimer);
    this.zoomNumList.classList.add('open');
    this.zoomNumList.style.pointerEvents = 'none';
    this._zoomListTimer = setTimeout(() => {
      this.zoomNumList.style.height = `${this.zoomNumList.scrollHeight - 18}px`;
      this._zoomListTimer = setTimeout(() => this.zoomNumList.style.pointerEvents = 'auto', 200);
    }, 100);
  }

  closeZoomList() {
    clearTimeout(this._zoomListTimer);
    this.zoomNumList.classList.remove('open');
    this.zoomNumList.style.height = this.zoomNumList.style.pointerEvents = '';
  }

  zoomListOpen() {
    return this.zoomNumList?.classList.contains('open');
  }

  fitImg = () => {
    this.closeZoomList();
    this.zoomFit?.classList.add('fitting');
    const { fitW, fitH } = this.fitting(),
    fit = Math.min(fitW, fitH);
    this.state.offsetX = this.state.offsetY = 0;
    this.state.scale = this.state.baseLine * (fit / 100);
    this.img.style.transition = 'transform .4s cubic-bezier(.4, .8, .8, 1)';
    this.img.style.transform = `translate(0px, 0px) scale(${this.state.scale})`;
    this.zoomPercentage(this.percentage());
    if (this.zoomSlider) this.zoomSlider.value = fit;
  };

  unfitImg() {
    this.zoomFit?.classList.remove('fitting');
  }

  fittedImg() {
    return this.zoomFit?.classList.contains('fitting');
  }

  translate(k, f) {
    if (typeof SDHubGetTranslation === 'function') {
      const t = SDHubGetTranslation(k);
      return (t && t !== k) ? t : f;
    }
    return f;
  }

  zoomTitles() {
    const t = {
      hide: this.translate('hid_cont', 'Hide controllers'),
      fit: this.translate('fit_img', 'Fit image to screen'),
      perwrap: this.translate('zlist', 'Zoom percentage list'),
      min: this.translate('zout', 'Zoom out'),
      slider: this.translate('zlev', 'Zoom level'),
      max: this.translate('zin', 'Zoom in')
    };

    this.hideBtn && (this.hideBtn.title = t.hide);
    this.zoomFit && (this.zoomFit.title = t.fit);
    this.perwrap && (this.perwrap.title = t.perwrap);
    this.zoomMin && (this.zoomMin.title = t.min);
    this.zoomSlider && (this.zoomSlider.title = t.slider);
    this.zoomMax && (this.zoomMax.title = t.max);
  }

  zoomControllers() {
    this._zoomList = (n, l) => {
      l.innerHTML = '';

      const cp = Math.round(this.percentage());
      const pl = [];

      if (cp < 100) {
        const s = (cp % 10 === 0) ? cp : Math.ceil(cp / 10) * 10;
        for (let v = s; v <= 100; v += 10) pl.push(v);
      } else {
        pl.push(100);
      }
      for (let v = 200; v <= 800; v += 100) pl.push(v);

      pl.forEach(v => {
        const li = document.createElement('li');
        li.textContent = `${v}%`;
        li.dataset.value = v;
        li.onclick = (e) => {
          e.stopPropagation();
          this.closeZoomList();
          this.unfitImg();
          this.zooming(v);
          n.textContent = `${v}%`;
        };
        l.appendChild(li);
      });
    };

    let cd = false;
    const c = 'sd-image-scripts-zoom-controller',
    svg = `
    <svg width="26px" height="26px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 17C13.866 17 17 13.866 17 10C17 6.13401 13.866 3 10 3C6.13401 3 3 6.13401 3 10C3 13.866 6.13401 17 10 17Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M20.9992 21L14.9492 14.95" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    zoomOut = `${svg}<path d="M6 10H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    zoomIn  = `${svg}<path d="M6 10H14M10 6V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    zoomFit = `<svg width="24px" height="24px" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
              <path d="M 25.546 16.875 C 25.159 16.875 24.843 17.191 24.843 17.578 L 24.843 21.095 L 21.327 21.095 C 20.939 21.095 20.625 21.41 20.625 21.799 C 20.625 22.187 20.939 22.501 21.327 22.501 L 25.546 22.501
              C 25.934 22.501 26.248 22.187 26.248 21.799 L 26.248 17.578 C 26.248 17.191 25.934 16.875 25.546 16.875 Z M 25.546 7.499 L 21.327 7.499 C 20.939 7.499 20.625 7.815 20.625 8.202 C 20.625 8.59 20.939 8.904
              21.327 8.904 L 24.843 8.904 L 24.843 12.421 C 24.843 12.809 25.159 13.124 25.546 13.124 C 25.934 13.124 26.248 12.809 26.248 12.421 L 26.248 8.202 C 26.248 7.815 25.934 7.499 25.546 7.499 Z M 8.672 7.499
              L 4.454 7.499 C 4.067 7.499 3.751 7.815 3.751 8.202 L 3.751 12.421 C 3.751 12.809 4.067 13.124 4.454 13.124 C 4.842 13.124 5.156 12.809 5.156 12.421 L 5.156 8.904 L 8.672 8.904 C 9.06 8.904 9.375 8.59 9.375
              8.202 C 9.375 7.815 9.06 7.499 8.672 7.499 Z M 8.672 21.095 L 5.156 21.095 L 5.156 17.578 C 5.156 17.191 4.842 16.875 4.454 16.875 C 4.067 16.875 3.751 17.191 3.751 17.578 L 3.751 21.799 C 3.751 22.187 4.067
              22.501 4.454 22.501 L 8.672 22.501 C 9.06 22.501 9.375 22.187 9.375 21.799 C 9.375 21.41 9.06 21.095 8.672 21.095 Z" fill="currentColor" stroke="none" stroke-width="1"/>
              <rect x="0.965" y="5.258" width="28.071" height="19.484" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
              <ellipse cx="15" cy="15" rx="6" ry="6" fill="currentColor" stroke="currentColor"/>
              </svg>`,
    dropArrow = `<svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="arcs"><path d="M9 18l6-6-6-6"/></svg>`,
    hideSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewBox="0 0 512 512"><polygon fill="currentColor" points="95.936,214.656 256,378.016 416.064,214.656 366.096,165.856 256,278.208 145.904,165.856"/></svg>`,

    hideControllers = () => {
      if (cd) return;
      this.closeZoomList();
      cd = true;
      const h = box.classList.toggle(`${c}-hidden`);
      if (h) {
        box.style.overflow = 'hidden';
        this.hideBtn.title = this.translate('dis_cont', 'Display controllers');
      }
      setTimeout(() => {
        if (!h) {
          box.style.overflow = '';
          this.hideBtn.title = this.translate('hid_cont', 'Hide controllers');
        }
        cd = false;
      }, 600);
    },

    perClick = () => {
      this.zoomNumList.classList.contains('open') ? this.closeZoomList() : this.displayZoomList();
    },

    q = (e, n) => e.querySelector(`.${c}-${n}`),
    m = (t, n, h) => Object.assign(document.createElement(t), { className: `${c}-${n}`, innerHTML: h || '' }),

    el = {
      hide: m('div', 'hide-button', hideSvg),
      fit: m('div', 'fit', zoomFit),
      per: m('div', 'percentage'),
      perwrap: m('div', 'percentage-wrapper'),
      num: m('div', 'percentage-number'),
      arrow: m('div', 'percentage-arrow', dropArrow),
      list: m('ul', 'percentage-list'),
      min: m('div', 'min', zoomOut),
      max: m('div', 'max', zoomIn),
      slider: Object.assign(m('input', 'slider'), { type: 'range' })
    };

    let box = q(this.controls, 'box'), wrapper = box && q(box, 'wrapper');

    if (!box || !wrapper) {
      box = m('div', 'box');
      wrapper = m('div', 'wrapper');

      el.perwrap.append(el.num, el.arrow);
      el.per.append(el.list, el.perwrap);

      wrapper.append(el.fit, el.per, el.min, el.slider, el.max);
      box.append(el.hide, wrapper);
      this.controls.appendChild(box);
    }

    this.hideBtn = q(box, 'hide-button');
    this.zoomFit = q(wrapper, 'fit');
    this.per = q(wrapper, 'percentage');
    this.perwrap   = q(wrapper, 'percentage-wrapper');
    this.zoomMin = q(wrapper, 'min');
    this.zoomSlider = q(wrapper, 'slider');
    this.zoomMax = q(wrapper, 'max');
    const perNum = q(wrapper, 'percentage-number'),
    perList = q(wrapper, 'percentage-list');

    this.hideBtn.onclick = hideControllers;
    this.zoomFit.onclick = this.fitImg;
    this.per.onclick = perClick;
    this.zoomPercentage = n => perNum.textContent = `${Math.round(n)}%`;

    this._zoomList(perNum, perList);
    this.zoomNumList = perList;
    this.zoomTitles();
  }

  snapBack(resize = false) {
    const { imgW, imgH, lightBoxW, lightBoxH } = this.dimensions();

    if (this.state.scale <= this.MIN) {
      this.state.offsetX = this.state.offsetY = this.state.lastX = this.state.lastY = 0;
      this.img.style.transition = '';
      this.img.style.transform = `scale(${this.state.scale})`;
      return;
    }

    let X = (imgW <= lightBoxW) ? 0 : Math.max(-(imgW - lightBoxW) / 2, Math.min((imgW - lightBoxW) / 2, this.state.offsetX));
    let Y = (imgH <= lightBoxH) ? 0 : Math.max(-(imgH - lightBoxH) / 2, Math.min((imgH - lightBoxH) / 2, this.state.offsetY));

    const changed = (X !== this.state.offsetX) || (Y !== this.state.offsetY);
    this.state.offsetX = X;
    this.state.offsetY = Y;

    this.img.style.transition = resize && changed ? 'none' : !resize ? 'transform .3s cubic-bezier(.3, .6, .6, 1)' : '';
    requestAnimationFrame(() => this.img.style.transform = `translate(${this.state.offsetX}px, ${this.state.offsetY}px) scale(${this.state.scale})`);
  }

  clamp() {
    const { imgW, imgH, lightBoxW, lightBoxH } = this.dimensions();
    const maxX = (imgW - lightBoxW) / 2, maxY = (imgH - lightBoxH) / 2;
    this.state.offsetX = Math.max(-maxX, Math.min(maxX, this.state.offsetX));
    this.state.offsetY = Math.max(-maxY, Math.min(maxY, this.state.offsetY));
  }

  reset() {
    this.state.baseLine = 1;
    this.state.scale = this.imgSize();
    this.state.offsetX = this.state.offsetY = this.state.lastX = this.state.lastY = 0;
    this.state.GropinTime = this.state.Axis = null;
    this.state.Groped = this.state.MultiGrope = false;

    Object.assign(this.state.TouchGrass, {
      touchScale: false,
      last1X: 0,
      last1Y: 0,
      last2X: 0,
      last2Y: 0,
      delta1X: 0,
      delta1Y: 0,
      delta2X: 0,
      delta2Y: 0,
      scale: 1.0001
    });

    if (this.zoomSlider) this.zoomSlider.value = this.state.baseLine * 100;
    if (this.percentage) this.percentage.textContent = `${Math.round(this.state.baseLine * 100)}%`;
    this.zoomControls();
    this.closeZoomList();
    this.unfitImg();
  }

  close() {
    this.closeZoomList();
    this.unfitImg();
    this.exitStart?.();
    this.cleanup();

    setTimeout(() => {
      this.lightBox.style.display = '';
      this.img?.remove();
      this.exitEnd?.();
    }, 200);
  }

  cleanup() {
    const E = [
      ['mousedown', this.mouseDown],
      ['mousemove', this.mouseMove],
      ['wheel', this.wheel, { passive: false }],
      ['touchstart', this.touchStart],
      ['touchmove', this.touchMove],
      ['touchcancel', this.touchCancel],
      ['touchend', this.touchEnd],
    ];

    E.forEach(([ev, fn, att]) => this.img?.removeEventListener(ev, fn, att || false));

    if (this.persist !== true) {
      const NAME = 'SharedImageEvents';
      if (window[NAME]) {
        window[NAME].MouseUp && document.removeEventListener('mouseup', window[NAME].MouseUp);
        window[NAME].MouseLeave && document.removeEventListener('mouseleave', window[NAME].MouseLeave);
        window[NAME].Resize && window.removeEventListener('resize', window[NAME].Resize);
        delete window[NAME];
      }
    }

    this.lightBox.touchMove = null;

    clearTimeout(this.state.GropinTime);
    clearTimeout(this.resizer);

    this.reset();

    if (this.zoomSlider) this.zoomSlider.oninput = null;
    if (this.zoomMin) this.zoomMin.replaceWith(this.zoomMin.cloneNode(true));
    if (this.zoomMax) this.zoomMax.replaceWith(this.zoomMax.cloneNode(true));
    this.zoomSlider = this.zoomMin = this.zoomMax = null;
  }

  windowEvents() {
    const NAME = this.persist === true ? 'SDImageViewerEvents' : 'SharedImageEvents';
    window[NAME] = window[NAME] || {};

    if (this.persist !== true) {
      this.lightBox.onclick = null;
      window[NAME].MouseUp && document.removeEventListener('mouseup', window[NAME].MouseUp);
      window[NAME].MouseLeave && document.removeEventListener('mouseleave', window[NAME].MouseLeave);
      window[NAME].Resize && window.removeEventListener('resize', window[NAME].Resize);
    }

    if (this.persist === true && window[NAME].MouseUp) return;

    window[NAME].MouseUp = (e) => {
      clearTimeout(this.state.GropinTime);

      if (!this.state.Groped && e.button === 0) {
        if (e.target === this.lightBox) {
          this.lightBox.onclick = (ev) => {
            if (ev.target === this.lightBox) {
              ev.preventDefault();
              if (this.persist !== true) {
                this.close();
              } else {
                this.lightBox._click?.(ev);
              }
            }
          };
        } else {
          this.lightBox.onclick = this.persist !== true ? null : this.lightBox._click;
        }
        return;
      }

      this.snapBack();
      this.state.Groped = false;
      this.img.style.cursor = '';
      this.dragEnd?.();
      this.state.Axis = null;
    };

    window[NAME].MouseLeave = (e) => {
      if (e.target !== this.lightBox && this.state.Groped) {
        this.snapBack();
        this.state.Groped = false;
        this.img.style.cursor = '';
        this.dragEnd?.();
        this.state.Axis = null;
      }
    };

    window[NAME].Resize = () => {
      clearTimeout(this.resizer);
      this.resizer = setTimeout(() => {
        this.clamp();
        this.img.style.transition = 'none';
        this.img.getBoundingClientRect();
        this.snapBack(true);
        this.zoomControls();
      }, 0);
    };

    setTimeout(() => {
      document.addEventListener('mouseleave', window[NAME].MouseLeave);
      window.addEventListener('resize', window[NAME].Resize);
    }, this.initDelay);

    setTimeout(() => {
      document.addEventListener('mouseup', window[NAME].MouseUp);
    }, this.eventDelay);
  }

  mouseDown = (e) => {
    this.closeZoomList();
    if (e.button !== 0) return;
    e.preventDefault();

    this.state.GropinTime = setTimeout(() => {
      this.state.Groped = true;
      this.img.style.transition = 'transform 60ms cubic-bezier(0, 0, .1, 1)';
      this.img.style.cursor = 'grab';
      this.state.lastX = e.clientX;
      this.state.lastY = e.clientY;
      if (this.state.scale > this.MIN) this.dragStart?.();
    }, 100);
  }

  mouseMove = (e) => {
    if (!this.state.Groped) return;

    e.preventDefault();
    this.img.onclick = (e) => e.stopPropagation();
    this.lightBox.onclick = (e) => e.stopPropagation();

    const { imgW, imgH, lightBoxW, lightBoxH } = this.dimensions();
    const deltaX = e.clientX - this.state.lastX;
    const deltaY = e.clientY - this.state.lastY;

    if (this.state.scale <= this.MIN) {
      this.img.style.transition = 'transform .15s cubic-bezier(.3, .3, .1, 1)';
      const moveX = e.clientX - this.state.lastX;
      const moveY = e.clientY - this.state.lastY;
      const snap = 50;

      if (!this.state.Axis) this.state.Axis = Math.abs(moveX) > Math.abs(moveY) ? 'x' : 'y';

      const X = this.state.Axis === 'x';
      const offset = X ? 'offsetX' : 'offsetY';
      const delta = X ? moveX : moveY;

      this.state[offset] += delta;
      this.state[offset] = Math.max(Math.min(this.state[offset], snap), -snap);

      const translate = X ? `translate(${this.state.offsetX}px, 0px)` : `translate(0px, ${this.state.offsetY}px)`;
      this.img.style.transform = `${translate} scale(${this.MIN})`;

    } else if (imgW <= lightBoxW && imgH >= lightBoxH) {
      this.state.offsetY += deltaY;
      const EdgeY = (imgH - lightBoxH) / 2;
      this.state.offsetY = Math.max(Math.min(this.state.offsetY, EdgeY + this.state.SnapMouse), -EdgeY - this.state.SnapMouse);
      this.img.style.transform = `translateY(${this.state.offsetY}px) scale(${this.state.scale})`;

    } else if (imgH <= lightBoxH && imgW >= lightBoxW) {
      this.state.offsetX += deltaX;
      const EdgeX = (imgW - lightBoxW) / 2;
      this.state.offsetX = Math.max(Math.min(this.state.offsetX, EdgeX + this.state.SnapMouse), -EdgeX - this.state.SnapMouse);
      this.img.style.transform = `translateX(${this.state.offsetX}px) scale(${this.state.scale})`;

    } else if (imgW >= lightBoxW && imgH >= lightBoxH) {
      this.state.offsetX += deltaX;
      this.state.offsetY += deltaY;

      const EdgeX = (imgW - lightBoxW) / 2;
      this.state.offsetX = Math.max(Math.min(this.state.offsetX, EdgeX + this.state.SnapMouse), -EdgeX - this.state.SnapMouse);

      const EdgeY = (imgH - lightBoxH) / 2;
      this.state.offsetY = Math.max(Math.min(this.state.offsetY, EdgeY + this.state.SnapMouse), -EdgeY - this.state.SnapMouse);

      this.img.style.transform = `translate(${this.state.offsetX}px, ${this.state.offsetY}px) scale(${this.state.scale})`;
    }

    this.state.lastX = e.clientX;
    this.state.lastY = e.clientY;
  }

  wheel = (e) => {
    e.stopPropagation();
    e.preventDefault();

    clearTimeout(this._wheely);
    this._wheely = setTimeout(() => {
      if (this.zoomListOpen()) this.closeZoomList();

      clearTimeout(this._unfitTimer);
      this._unfitTimer = setTimeout(() => this.unfitImg(), 10);
    }, 50);

    this.img.style.transition = 'transform .35s cubic-bezier(.3, .6, .6, 1)';

    const CTRL = e.ctrlKey || e.metaKey;
    const SHIFT = e.shiftKey;
    const centerX = this.lightBox.offsetWidth / 2;
    const centerY = this.lightBox.offsetHeight / 2;
    const delta = Math.max(-1, Math.min(1, e.wheelDelta || -e.detail));
    const step = 1.125;
    const moveStep = 30 * this.state.scale;
    const lastScale = this.state.scale;

    if (!CTRL && !SHIFT) {
      if (delta > 0) {
        this.state.scale *= step;
      } else if (delta < 0) {
        this.state.scale /= step;
      }

      this.state.scale = Math.max(this.MIN, Math.min(this.state.scale, this.MAX));
      this.zoomPercentage(this.percentage());

      if (this.zoomSlider) {
        this.zoomSlider.value = Math.round(this.percentage());
      }
    }

    const SCALE = (CTRL || SHIFT) ? lastScale : this.state.scale;
    const { imgW, imgH, lightBoxW, lightBoxH } = this.dimensions();

    if (this.state.scale <= this.MIN) {
      this.img.style.transform = `translate(0px, 0px) scale(${this.MIN})`;
      this.state.offsetX = 0;
      this.state.offsetY = 0;

    } else if (imgW <= lightBoxW && imgH >= lightBoxH) {
      if (CTRL) {
        this.state.offsetY -= delta * moveStep;
      } else {
        const imgCenterY = this.state.offsetY + centerY;
        this.state.offsetY = e.clientY - ((e.clientY - imgCenterY) / lastScale) * this.state.scale - centerY;
      }

      const EdgeY = (imgH - lightBoxH) / 2;
      this.state.offsetY = Math.max(-EdgeY, Math.min(this.state.offsetY, EdgeY));

      this.img.style.transform = `translateY(${this.state.offsetY}px) scale(${SCALE})`;

    } else if (imgW <= lightBoxW && imgH <= lightBoxH) {
      this.img.style.transform = `scale(${SCALE})`;

    } else if (imgH <= lightBoxH && imgW >= lightBoxW) {
      if (SHIFT) {
        this.state.offsetX -= delta * moveStep;
      } else {
        const imgCenterX = this.state.offsetX + centerX;
        this.state.offsetX = e.clientX - ((e.clientX - imgCenterX) / lastScale) * this.state.scale - centerX;
      }

      const EdgeX = (imgW - lightBoxW) / 2;
      this.state.offsetX = Math.max(-EdgeX, Math.min(this.state.offsetX, EdgeX));

      this.img.style.transform = `translateX(${this.state.offsetX}px) scale(${SCALE})`;

    } else if (imgW >= lightBoxW && imgH >= lightBoxH) {
      if (CTRL) {
        this.state.offsetY -= delta * moveStep;
      } else if (SHIFT) {
        this.state.offsetX -= delta * moveStep;
      } else {
        const imgCenterX = this.state.offsetX + centerX;
        const imgCenterY = this.state.offsetY + centerY;
        this.state.offsetX = e.clientX - ((e.clientX - imgCenterX) / lastScale) * this.state.scale - centerX;
        this.state.offsetY = e.clientY - ((e.clientY - imgCenterY) / lastScale) * this.state.scale - centerY;
      }

      const EdgeX = (imgW - lightBoxW) / 2;
      const EdgeY = (imgH - lightBoxH) / 2;
      this.state.offsetX = Math.max(-EdgeX, Math.min(this.state.offsetX, EdgeX));
      this.state.offsetY = Math.max(-EdgeY, Math.min(this.state.offsetY, EdgeY));

      this.img.style.transform = `translate(${this.state.offsetX}px, ${this.state.offsetY}px) scale(${SCALE})`;
    }
  }

  touchDistance(t1, t2) {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  }

  touchStart = (e) => {
    e.stopPropagation();
    this.closeZoomList();
    this.img.style.transition = 'none';
    if (this.state.scale > this.MIN) this.dragStart?.();

    if (e.targetTouches[1]) {
      this.state.MultiGrope = true;
      this.state.TouchGrass.touchScale = true;
      this.lastDistance = this.touchDistance(e.targetTouches[0], e.targetTouches[1]);
      this.lastScale = this.state.scale;

    } else {
      this.state.MultiGrope = false;
      if (!this.state.TouchGrass.touchScale) {
        this.state.lastX = e.targetTouches[0].clientX;
        this.state.lastY = e.targetTouches[0].clientY;
      }
    }
  }

  touchMove = (e) => {
    e.stopPropagation();
    e.preventDefault();
    this.img.onclick = (e) => e.stopPropagation();

    if (e.targetTouches[1]) {
      const currentDistance = this.touchDistance(e.targetTouches[0], e.targetTouches[1]);
      const zoom = currentDistance / this.lastDistance;
      const centerX = this.lightBox.offsetWidth / 2;
      const centerY = this.lightBox.offsetHeight / 2;
      const pinchCenterX = (e.targetTouches[0].clientX + e.targetTouches[1].clientX) / 2;
      const pinchCenterY = (e.targetTouches[0].clientY + e.targetTouches[1].clientY) / 2;
      const prevScale = this.state.scale;

      this.state.scale = this.lastScale * zoom;
      this.state.scale = Math.max(this.MIN, Math.min(this.state.scale, this.MAX));

      const { imgW, imgH, lightBoxW, lightBoxH } = this.dimensions();

      if (this.state.scale <= this.MIN) {
        this.state.offsetX = this.state.offsetY = 0;
        this.img.style.transform = `translate(0px, 0px) scale(${this.state.scale})`;

      } else if (imgW <= lightBoxW && imgH >= lightBoxH) {
        const imgCenterY = this.state.offsetY + centerY;
        this.state.offsetY = pinchCenterY - ((pinchCenterY - imgCenterY) / prevScale) * this.state.scale - centerY;

        const EdgeY = (imgH - lightBoxH) / 2;
        if (this.state.offsetY > EdgeY) this.state.offsetY = EdgeY;
        else if (this.state.offsetY < -EdgeY) this.state.offsetY = -EdgeY;

        this.img.style.transform = `translateY(${this.state.offsetY}px) scale(${this.state.scale})`;

      } else if (imgH <= lightBoxH && imgW >= lightBoxW) {
        const imgCenterX = this.state.offsetX + centerX;
        this.state.offsetX = pinchCenterX - ((pinchCenterX - imgCenterX) / prevScale) * this.state.scale - centerX;

        const EdgeX = (imgW - lightBoxW) / 2;
        if (this.state.offsetX > EdgeX) this.state.offsetX = EdgeX;
        else if (this.state.offsetX < -EdgeX) this.state.offsetX = -EdgeX;

        this.img.style.transform = `translateX(${this.state.offsetX}px) scale(${this.state.scale})`;

      } else if (imgW >= lightBoxW && imgH >= lightBoxH) {
        const imgCenterX = this.state.offsetX + centerX;
        const imgCenterY = this.state.offsetY + centerY;

        this.state.offsetX = pinchCenterX - ((pinchCenterX - imgCenterX) / prevScale) * this.state.scale - centerX;
        this.state.offsetY = pinchCenterY - ((pinchCenterY - imgCenterY) / prevScale) * this.state.scale - centerY;

        const EdgeX = (imgW - lightBoxW) / 2;
        const EdgeY = (imgH - lightBoxH) / 2;

        if (this.state.offsetX > EdgeX) this.state.offsetX = EdgeX;
        else if (this.state.offsetX < -EdgeX) this.state.offsetX = -EdgeX;

        if (this.state.offsetY > EdgeY) this.state.offsetY = EdgeY;
        else if (this.state.offsetY < -EdgeY) this.state.offsetY = -EdgeY;

        this.img.style.transform = `translate(${this.state.offsetX}px, ${this.state.offsetY}px) scale(${this.state.scale})`;
      }

    } else if (!this.state.TouchGrass.touchScale) {
      this.img.style.transition = 'transform 60ms ease';

      const currentX = e.targetTouches[0].clientX;
      const currentY = e.targetTouches[0].clientY;
      const deltaX = (currentX - this.state.lastX) * this.state.dragSpeed;
      const deltaY = (currentY - this.state.lastY) * this.state.dragSpeed;

      const { imgW, imgH, lightBoxW, lightBoxH } = this.dimensions();

      if (this.state.scale <= this.MIN) {
        this.state.offsetX = this.state.offsetY = 0;
        this.img.style.transform = `translate(0px, 0px) scale(${this.state.scale})`;

      } else if (imgW <= lightBoxW && imgH >= lightBoxH) {
        this.state.offsetY += deltaY;
        const EdgeY = (imgH - lightBoxH) / 2;
        this.state.offsetY = Math.max(Math.min(this.state.offsetY, EdgeY + this.state.SnapTouch), -EdgeY - this.state.SnapTouch);
        this.img.style.transform = `translateY(${this.state.offsetY}px) scale(${this.state.scale})`;

      } else if (imgH <= lightBoxH && imgW >= lightBoxW) {
        this.state.offsetX += deltaX;
        const EdgeX = (imgW - lightBoxW) / 2;
        this.state.offsetX = Math.max(Math.min(this.state.offsetX, EdgeX + this.state.SnapTouch), -EdgeX - this.state.SnapTouch);
        this.img.style.transform = `translateX(${this.state.offsetX}px) scale(${this.state.scale})`;

      } else if (imgW >= lightBoxW && imgH >= lightBoxH) {
        this.state.offsetX += deltaX;
        this.state.offsetY += deltaY;

        const EdgeX = (imgW - lightBoxW) / 2;
        const EdgeY = (imgH - lightBoxH) / 2;

        this.state.offsetX = Math.max(Math.min(this.state.offsetX, EdgeX + this.state.SnapTouch), -EdgeX - this.state.SnapTouch);
        this.state.offsetY = Math.max(Math.min(this.state.offsetY, EdgeY + this.state.SnapTouch), -EdgeY - this.state.SnapTouch);
        this.img.style.transform = `translate(${this.state.offsetX}px, ${this.state.offsetY}px) scale(${this.state.scale})`;
      }

      this.state.lastX = currentX;
      this.state.lastY = currentY;
    }
  }

  touchCancel = (e) => {
    e.stopPropagation();
    e.preventDefault();
    this.dragEnd?.();
    this.img.onclick = undefined;
    this.state.MultiGrope = false;
    this.state.TouchGrass.touchScale = false;
    this.img.style.transform = `translate(${this.state.offsetX}px, ${this.state.offsetY}px) scale(${this.state.scale})`;
    this.snapBack();
    this.state.Axis = null;
  }

  touchEnd = (e) => {
    e.stopPropagation();
    this.dragEnd?.();
    this.img.onclick = undefined;
    this.img.style.transition = 'none';
    this.state.Axis = null;

    if (e.targetTouches.length === 0) {
      if (this.state.MultiGrope) this.state.MultiGrope = false;
      this.state.TouchGrass.touchScale = false;
      this.snapBack();
      setTimeout(() => this.state.TouchGrass.touchScale = false, 10);
    }
  }

  addEvents() {
    this.lightBox.touchMove = (e) => {
      this.closeZoomList();
      if (e.target !== this.img) { e.stopPropagation(); e.preventDefault(); }
    };

    const E = [
      ['mousedown', this.mouseDown],
      ['mousemove', this.mouseMove],
      ['wheel', this.wheel, { passive: false }],
      ['touchstart', this.touchStart],
      ['touchmove', this.touchMove],
      ['touchcancel', this.touchCancel],
      ['touchend', this.touchEnd],
    ];

    E.forEach(([ev, fn, att]) => this.img.addEventListener(ev, fn, att || false));
  }
}