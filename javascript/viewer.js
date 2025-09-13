function SharedImageViewer(img, lightBox, opts = {}) {
  img.ondrag = img.ondragend = img.ondragstart = (e) => (e.stopPropagation(), e.preventDefault());

  let Resizer, lastDistance = 0, lastScale = 1;

  const {
    persist = null,
    dragStart = null,
    dragEnd = null,
    exitStart = null,
    exitEnd = null
  } = opts,

  MIN = 1.0001,
  MAX = 10,

  imgState = {
    scale: 1.0001, offsetX: 0, offsetY: 0, lastX: 0, lastY: 0, lastLen: 1, LastTouch: 0, LastZoom: 0,
    MoveMomentum: 0, SnapMouse: 30, SnapTouch: 10, dragSpeed: 1.5,

    GropinTime: null,
    Groped: false,
    Axis: null,

    TouchGrass: {
      touchScale: false, last1X: 0, last1Y: 0, last2X: 0, last2Y: 0, 
      delta1X: 0, delta1Y: 0, delta2X: 0, delta2Y: 0, scale: 1.0001
    },

    MultiGrope: false,

    dimensions: function (img, lightBox) {
      return {
        imgELW: img.offsetWidth * this.scale, imgELH: img.offsetHeight * this.scale,
        LightBoxW: lightBox.offsetWidth, LightBoxH: lightBox.offsetHeight
      };
    },

    SnapBack: function (img, lightBox, resize = false) {
      const { imgELW, imgELH, LightBoxW, LightBoxH } = this.dimensions(img, lightBox);

      if (this.scale <= MIN) {
        this.offsetX = this.offsetY = this.lastX = this.lastY = 0;
        img.style.transition = '';
        img.style.transform = `scale(${this.scale})`;
        return;
      }

      let targetX = this.offsetX;
      let targetY = this.offsetY;

      targetX = (imgELW <= LightBoxW) ? 0 : Math.max(-(imgELW - LightBoxW) / 2, Math.min((imgELW - LightBoxW) / 2, this.offsetX));
      targetY = (imgELH <= LightBoxH) ? 0 : Math.max(-(imgELH - LightBoxH) / 2, Math.min((imgELH - LightBoxH) / 2, this.offsetY));

      const changed = (targetX !== this.offsetX) || (targetY !== this.offsetY);
      this.offsetX = targetX;
      this.offsetY = targetY;

      img.style.transition = resize && changed ? 'none' : !resize ? 'transform .3s cubic-bezier(.3, .6, .6, 1)' : '';
      requestAnimationFrame(() => img.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`);
    },

    clamp: function (img, lightBox) {
      const { imgELW, imgELH, LightBoxW, LightBoxH } = this.dimensions(img, lightBox);

      const maxX = (imgELW - LightBoxW) / 2;
      const maxY = (imgELH - LightBoxH) / 2;

      this.offsetX = Math.max(-maxX, Math.min(maxX, this.offsetX));
      this.offsetY = Math.max(-maxY, Math.min(maxY, this.offsetY));
    },

    reset: function() {
      this.scale = 1.0001; 
      this.offsetX = this.offsetY = this.lastX = this.lastY = 0;
      this.GropinTime = null;
      this.Groped = false;
      this.MultiGrope = false;

      Object.assign(this.TouchGrass, {
        touchScale: false, last1X: 0, last1Y: 0, last2X: 0, last2Y: 0, 
        delta1X: 0, delta1Y: 0, delta2X: 0, delta2Y: 0, scale: 1.0001
      });

      //img.style.transition = img.style.transform = img.style.cursor = '';
    },

    close: function () {
      exitStart?.();

      setTimeout(() => {
        lightBox.style.display = '';
        img?.remove();
        exitEnd?.();
      }, 200);
    }
  };

  imgState.reset();

  const getDimensions = (img, lightBox, scale = imgState.scale) => ({
    imgELW: img.offsetWidth * scale, imgELH: img.offsetHeight * scale,
    LightBoxW: lightBox.offsetWidth, LightBoxH: lightBox.offsetHeight
  }),

  windowEvents = (persist) => {
    const NAME = persist === true ? 'SDImageViewerEvents' : 'SharedImageEvents';
    window[NAME] = window[NAME] || {};

    if (persist !== true) {
      lightBox.onclick = null;
      window[NAME].MouseUp && document.removeEventListener('mouseup', window[NAME].MouseUp);
      window[NAME].MouseLeave && document.removeEventListener('mouseleave', window[NAME].MouseLeave);
      window[NAME].Resize && window.removeEventListener('resize', window[NAME].Resize);
    }

    if (persist === true && window[NAME].MouseUp) return;

    window[NAME].MouseUp = (e) => {
      clearTimeout(imgState.GropinTime);
      if (!imgState.Groped && e.button === 0) {
        img.onclick = undefined;
        lightBox.onclick = persist !== true
          ? (e) => (e.preventDefault(), e.target === img || imgState.close())
          : lightBox._click;
        return;
      }

      imgState.SnapBack(img, lightBox);
      imgState.Groped = false;
      img.style.cursor = '';
      dragEnd?.();
      imgState.Axis = null;
    };

    window[NAME].MouseLeave = (e) => {
      if (e.target !== lightBox && imgState.Groped) {
        imgState.SnapBack(img, lightBox);
        imgState.Groped = false;
        img.style.cursor = '';
        dragEnd?.();
        imgState.Axis = null;
      }
    };

    window[NAME].Resize = () => {
      clearTimeout(Resizer);
      Resizer = setTimeout(() => {
        imgState.clamp(img, lightBox);
        img.style.transition = 'none';
        img.getBoundingClientRect();
        imgState.SnapBack(img, lightBox, true);
      }, 0);
    };

    setTimeout(() => {
      document.addEventListener('mouseleave', window[NAME].MouseLeave);
      window.addEventListener('resize', window[NAME].Resize);
    }, 100);

    setTimeout(() => {
      document.addEventListener('mouseup', window[NAME].MouseUp);
    }, 400);
  },

  MouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    imgState.GropinTime = setTimeout(() => {
      imgState.Groped = true;
      img.style.transition = 'transform 100ms cubic-bezier(.16, .16, .16, 1)';
      img.style.cursor = 'grab';
      imgState.lastX = e.clientX;
      imgState.lastY = e.clientY;
      if (imgState.scale > MIN) dragStart?.();
    }, 100);
  },

  MouseMove = (e) => {
    if (!imgState.Groped) return;

    e.preventDefault();
    img.onclick = (e) => e.stopPropagation();
    lightBox.onclick = (e) => e.stopPropagation();

    const { imgELW, imgELH, LightBoxW, LightBoxH } = getDimensions(img, lightBox),
    deltaX = e.clientX - imgState.lastX,
    deltaY = e.clientY - imgState.lastY;

    if (imgState.scale <= MIN) {
      img.style.transition = 'transform .15s ease-out';
      const moveX = e.clientX - imgState.lastX,
      moveY = e.clientY - imgState.lastY,
      snap = 50;

      if (!imgState.Axis) imgState.Axis = Math.abs(moveX) > Math.abs(moveY) ? 'x' : 'y';

      const X = imgState.Axis === 'x',
      offset = X ? 'offsetX' : 'offsetY',
      delta = X ? moveX : moveY;

      imgState[offset] += delta;
      imgState[offset] = Math.max(Math.min(imgState[offset], snap), -snap);

      const translate = X ? `translate(${imgState.offsetX}px, 0px)` : `translate(0px, ${imgState.offsetY}px)`;
      img.style.transform = `${translate} scale(${MIN})`;

    } else if (imgELW <= LightBoxW && imgELH >= LightBoxH) {
      imgState.offsetY += deltaY;
      const EdgeY = (imgELH - LightBoxH) / 2;
      imgState.offsetY = Math.max(Math.min(imgState.offsetY, EdgeY + imgState.SnapMouse), -EdgeY - imgState.SnapMouse);
      img.style.transform = `translateY(${imgState.offsetY}px) scale(${imgState.scale})`;

    } else if (imgELH <= LightBoxH && imgELW >= LightBoxW) {
      imgState.offsetX += deltaX;
      const EdgeX = (imgELW - LightBoxW) / 2;
      imgState.offsetX = Math.max(Math.min(imgState.offsetX, EdgeX + imgState.SnapMouse), -EdgeX - imgState.SnapMouse);
      img.style.transform = `translateX(${imgState.offsetX}px) scale(${imgState.scale})`;

    } else if (imgELW >= LightBoxW && imgELH >= LightBoxH) {
      imgState.offsetX += deltaX;
      imgState.offsetY += deltaY;

      const EdgeX = (imgELW - LightBoxW) / 2;
      imgState.offsetX = Math.max(Math.min(imgState.offsetX, EdgeX + imgState.SnapMouse), -EdgeX - imgState.SnapMouse);

      const EdgeY = (imgELH - LightBoxH) / 2;
      imgState.offsetY = Math.max(Math.min(imgState.offsetY, EdgeY + imgState.SnapMouse), -EdgeY - imgState.SnapMouse);

      img.style.transform = `translate(${imgState.offsetX}px, ${imgState.offsetY}px) scale(${imgState.scale})`;
    }

    imgState.lastX = e.clientX;
    imgState.lastY = e.clientY;
  },

  Wheel = (e) => {
    e.stopPropagation();
    e.preventDefault();

    img.style.transition = 'transform .3s cubic-bezier(.3, .6, .6, 1)';

    const CTRL = e.ctrlKey || e.metaKey,
      SHIFT = e.shiftKey,
      centerX = lightBox.offsetWidth / 2,
      centerY = lightBox.offsetHeight / 2,
      delta = Math.max(-1, Math.min(1, e.wheelDelta || -e.detail)),
      zoomStep = 0.15,
      zoom = MIN + delta * zoomStep,
      moveStep = 30 * imgState.scale,
      lastScale = imgState.scale;

    if (!CTRL && !SHIFT) {
      imgState.scale *= zoom;
      imgState.scale = Math.max(MIN, Math.min(imgState.scale, MAX));
    }

    const SCALE = (CTRL || SHIFT) ? lastScale : imgState.scale,
      { imgELW, imgELH, LightBoxW, LightBoxH } = getDimensions(img, lightBox);

    if (imgState.scale <= MIN) {
      img.style.transform = `translate(0px, 0px) scale(${MIN})`;

    } else if (imgELW <= LightBoxW && imgELH >= LightBoxH) {
      if (CTRL) {
        imgState.offsetY -= delta * moveStep;
      } else {
        const imgCenterY = imgState.offsetY + centerY;
        imgState.offsetY = e.clientY - ((e.clientY - imgCenterY) / lastScale) * imgState.scale - centerY;
      }

      const EdgeY = (imgELH - LightBoxH) / 2;
      imgState.offsetY = Math.max(-EdgeY, Math.min(imgState.offsetY, EdgeY));

      img.style.transform = `translateY(${imgState.offsetY}px) scale(${SCALE})`;

    } else if (imgELH <= LightBoxH && imgELW >= LightBoxW) {
      if (SHIFT) {
        imgState.offsetX -= delta * moveStep;
      } else {
        const imgCenterX = imgState.offsetX + centerX;
        imgState.offsetX = e.clientX - ((e.clientX - imgCenterX) / lastScale) * imgState.scale - centerX;
      }

      const EdgeX = (imgELW - LightBoxW) / 2;
      imgState.offsetX = Math.max(-EdgeX, Math.min(imgState.offsetX, EdgeX));

      img.style.transform = `translateX(${imgState.offsetX}px) scale(${SCALE})`;

    } else if (imgELW >= LightBoxW && imgELH >= LightBoxH) {
      if (CTRL) {
        imgState.offsetY -= delta * moveStep;
      } else if (SHIFT) {
        imgState.offsetX -= delta * moveStep;
      } else {
        const imgCenterX = imgState.offsetX + centerX, imgCenterY = imgState.offsetY + centerY;
        imgState.offsetX = e.clientX - ((e.clientX - imgCenterX) / lastScale) * imgState.scale - centerX;
        imgState.offsetY = e.clientY - ((e.clientY - imgCenterY) / lastScale) * imgState.scale - centerY;
      }

      const EdgeX = (imgELW - LightBoxW) / 2, EdgeY = (imgELH - LightBoxH) / 2;
      imgState.offsetX = Math.max(-EdgeX, Math.min(imgState.offsetX, EdgeX));
      imgState.offsetY = Math.max(-EdgeY, Math.min(imgState.offsetY, EdgeY));

      img.style.transform = `translate(${imgState.offsetX}px, ${imgState.offsetY}px) scale(${SCALE})`;
    }
  },

  touchDistance = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),

  TouchStart = (e) => {
    e.stopPropagation();
    img.style.transition = 'none';
    if (imgState.scale > MIN) dragStart?.();

    if (e.targetTouches[1]) {
      imgState.MultiGrope = true;
      imgState.TouchGrass.touchScale = true;
      lastDistance = touchDistance(e.targetTouches[0], e.targetTouches[1]);
      lastScale = imgState.scale;

    } else {
      imgState.MultiGrope = false;
      if (!imgState.TouchGrass.touchScale) {
        imgState.lastX = e.targetTouches[0].clientX;
        imgState.lastY = e.targetTouches[0].clientY;
      }
    }
  },

  TouchMove = (e) => {
    e.stopPropagation();
    e.preventDefault();
    img.onclick = (e) => e.stopPropagation();

    if (e.targetTouches[1]) {
      const currentDistance = touchDistance(e.targetTouches[0], e.targetTouches[1]),
        zoom = currentDistance / lastDistance,
        centerX = lightBox.offsetWidth / 2,
        centerY = lightBox.offsetHeight / 2,
        pinchCenterX = (e.targetTouches[0].clientX + e.targetTouches[1].clientX) / 2,
        pinchCenterY = (e.targetTouches[0].clientY + e.targetTouches[1].clientY) / 2,
        prevScale = imgState.scale;

      imgState.scale = lastScale * zoom;
      imgState.scale = Math.max(MIN, Math.min(imgState.scale, MAX));

      const { imgELW, imgELH, LightBoxW, LightBoxH } = getDimensions(img, lightBox);

      if (imgState.scale <= MIN) {
        imgState.offsetX = imgState.offsetY = 0;
        img.style.transform = `translate(0px, 0px) scale(${imgState.scale})`;

      } else if (imgELW <= LightBoxW && imgELH >= LightBoxH) {
        const imgCenterY = imgState.offsetY + centerY;
        imgState.offsetY = pinchCenterY - ((pinchCenterY - imgCenterY) / prevScale) * imgState.scale - centerY;

        const EdgeY = (imgELH - LightBoxH) / 2;
        if (imgState.offsetY > EdgeY) imgState.offsetY = EdgeY;
        else if (imgState.offsetY < -EdgeY) imgState.offsetY = -EdgeY;

        img.style.transform = `translateY(${imgState.offsetY}px) scale(${imgState.scale})`;

      } else if (imgELH <= LightBoxH && imgELW >= LightBoxW) {
        const imgCenterX = imgState.offsetX + centerX;
        imgState.offsetX = pinchCenterX - ((pinchCenterX - imgCenterX) / prevScale) * imgState.scale - centerX;

        const EdgeX = (imgELW - LightBoxW) / 2;
        if (imgState.offsetX > EdgeX) imgState.offsetX = EdgeX;
        else if (imgState.offsetX < -EdgeX) imgState.offsetX = -EdgeX;

        img.style.transform = `translateX(${imgState.offsetX}px) scale(${imgState.scale})`;

      } else if (imgELW >= LightBoxW && imgELH >= LightBoxH) {
        const imgCenterX = imgState.offsetX + centerX, imgCenterY = imgState.offsetY + centerY;

        imgState.offsetX = pinchCenterX - ((pinchCenterX - imgCenterX) / prevScale) * imgState.scale - centerX;
        imgState.offsetY = pinchCenterY - ((pinchCenterY - imgCenterY) / prevScale) * imgState.scale - centerY;

        const EdgeX = (imgELW - LightBoxW) / 2, EdgeY = (imgELH - LightBoxH) / 2;

        if (imgState.offsetX > EdgeX) imgState.offsetX = EdgeX;
        else if (imgState.offsetX < -EdgeX) imgState.offsetX = -EdgeX;

        if (imgState.offsetY > EdgeY) imgState.offsetY = EdgeY;
        else if (imgState.offsetY < -EdgeY) imgState.offsetY = -EdgeY;

        img.style.transform = `translate(${imgState.offsetX}px, ${imgState.offsetY}px) scale(${imgState.scale})`;
      }

    } else if (!imgState.TouchGrass.touchScale) {
      img.style.transition = 'transform 60ms ease';

      const currentX = e.targetTouches[0].clientX,
        currentY = e.targetTouches[0].clientY,
        deltaX = (currentX - imgState.lastX) * imgState.dragSpeed,
        deltaY = (currentY - imgState.lastY) * imgState.dragSpeed,

      { imgELW, imgELH, LightBoxW, LightBoxH } = getDimensions(img, lightBox);

      if (imgState.scale <= MIN) {
        imgState.offsetX = imgState.offsetY = 0;
        img.style.transform = `translate(0px, 0px) scale(${imgState.scale})`;

      } else if (imgELW <= LightBoxW && imgELH >= LightBoxH) {
        imgState.offsetY += deltaY;
        const EdgeY = (imgELH - LightBoxH) / 2;
        imgState.offsetY = Math.max(Math.min(imgState.offsetY, EdgeY + imgState.SnapTouch), -EdgeY - imgState.SnapTouch);
        img.style.transform = `translateY(${imgState.offsetY}px) scale(${imgState.scale})`;

      } else if (imgELH <= LightBoxH && imgELW >= LightBoxW) {
        imgState.offsetX += deltaX;
        const EdgeX = (imgELW - LightBoxW) / 2;
        imgState.offsetX = Math.max(Math.min(imgState.offsetX, EdgeX + imgState.SnapTouch), -EdgeX - imgState.SnapTouch);
        img.style.transform = `translateX(${imgState.offsetX}px) scale(${imgState.scale})`;

      } else if (imgELW >= LightBoxW && imgELH >= LightBoxH) {
        imgState.offsetX += deltaX;
        imgState.offsetY += deltaY;

        const EdgeX = (imgELW - LightBoxW) / 2, EdgeY = (imgELH - LightBoxH) / 2;

        imgState.offsetX = Math.max(Math.min(imgState.offsetX, EdgeX + imgState.SnapTouch), -EdgeX - imgState.SnapTouch);
        imgState.offsetY = Math.max(Math.min(imgState.offsetY, EdgeY + imgState.SnapTouch), -EdgeY - imgState.SnapTouch);
        img.style.transform = `translate(${imgState.offsetX}px, ${imgState.offsetY}px) scale(${imgState.scale})`;
      }

      imgState.lastX = currentX;
      imgState.lastY = currentY;
    }
  },

  TouchCancel = (e) => {
    e.stopPropagation();
    e.preventDefault();
    dragEnd?.();
    img.onclick = undefined;
    imgState.MultiGrope = false;
    imgState.TouchGrass.touchScale = false;
    img.style.transform = `translate(${imgState.offsetX}px, ${imgState.offsetY}px) scale(${imgState.scale})`;
    imgState.SnapBack(img, lightBox);
    imgState.Axis = null;
  },

  TouchEnd = (e) => {
    e.stopPropagation();
    dragEnd?.();
    img.onclick = undefined;
    img.style.transition = 'none';
    imgState.Axis = null;

    if (e.targetTouches.length === 0) {
      if (imgState.MultiGrope) imgState.MultiGrope = false; 
      imgState.TouchGrass.touchScale = false;
      imgState.SnapBack(img, lightBox);
      setTimeout(() => imgState.TouchGrass.touchScale = false, 10);
    }
  };

  lightBox.ontouchmove = (e) => e.target !== img && (e.stopPropagation(), e.preventDefault());

  windowEvents(persist);

  setTimeout(() => {[
    ['mousedown', MouseDown],
    ['mousemove', MouseMove],
    ['wheel', Wheel, { passive: false }],
    ['touchstart', TouchStart],
    ['touchmove', TouchMove],
    ['touchcancel', TouchCancel],
    ['touchend', TouchEnd],
  ].forEach(([ev, fn, att]) => img.addEventListener(ev, fn, att || false));
  }, 400);

  return { state: imgState };
}