function SharedImageViewer(imgEL, LightBox, Control, Wrapper, opts = {}) {
  const {
    MIN = 1.0001,
    MAX = 10,
    noScroll = null,
    noPointer = null,
    onClose = null,
    persist = null
  } = opts;

  const imgState = {
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

    dimensions: function (imgEL, LightBox) {
      return {
        imgELW: imgEL.offsetWidth * this.scale, imgELH: imgEL.offsetHeight * this.scale,
        LightBoxW: LightBox.offsetWidth, LightBoxH: LightBox.offsetHeight
      };
    },

    SnapBack: function (imgEL, LightBox, resize = false) {
      const { imgELW, imgELH, LightBoxW, LightBoxH } = this.dimensions(imgEL, LightBox);

      if (this.scale <= MIN) {
        this.offsetX = this.offsetY = this.lastX = this.lastY = 0;
        imgEL.style.transition = '';
        imgEL.style.transform = `scale(${this.scale})`;
        return;
      }

      let targetX = this.offsetX;
      let targetY = this.offsetY;

      targetX = (imgELW <= LightBoxW) ? 0 : Math.max(-(imgELW - LightBoxW) / 2, Math.min((imgELW - LightBoxW) / 2, this.offsetX));
      targetY = (imgELH <= LightBoxH) ? 0 : Math.max(-(imgELH - LightBoxH) / 2, Math.min((imgELH - LightBoxH) / 2, this.offsetY));

      const changed = (targetX !== this.offsetX) || (targetY !== this.offsetY);
      this.offsetX = targetX;
      this.offsetY = targetY;

      imgEL.style.transition = resize && changed ? 'none' : !resize ? 'transform .3s cubic-bezier(.3, .6, .6, 1)' : '';
      requestAnimationFrame(() => imgEL.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`);
    },

    clamp: function (imgEL, LightBox) {
      const { imgELW, imgELH, LightBoxW, LightBoxH } = this.dimensions(imgEL, LightBox);

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

      imgEL.style.transition = imgEL.style.transform = imgEL.style.cursor = '';
    },

    close: function () {
      LightBox.style.opacity = '';

      setTimeout(() => {
        LightBox.style.display = 'none';
        Wrapper.style.transform = Wrapper.style.opacity = '';
        imgEL?.remove();
        document.body.classList.remove(noScroll);
        if (typeof onClose === 'function') onClose();
      }, 200);
    }
  };

  imgState.reset();

  imgEL.ondrag = imgEL.ondragend = imgEL.ondragstart = (e) => (e.stopPropagation(), e.preventDefault());

  let Resizer;

  const getDimensions = (imgEL, LightBox, scale = imgState.scale) => ({
    imgELW: imgEL.offsetWidth * scale, imgELH: imgEL.offsetHeight * scale,
    LightBoxW: LightBox.offsetWidth, LightBoxH: LightBox.offsetHeight
  });

  imgEL.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    imgState.GropinTime = setTimeout(() => {
      imgState.Groped = true;
      imgEL.style.transition = 'transform .1s cubic-bezier(.1, .2, .2, 1)';
      imgEL.style.cursor = 'grab';
      imgState.lastX = e.clientX;
      imgState.lastY = e.clientY;
      if (imgState.scale > MIN) Control.classList.add(noPointer);
    }, 100);
  });

  imgEL.addEventListener('mousemove', (e) => {
    if (!imgState.Groped) return;

    e.preventDefault();
    imgEL.onclick = (e) => e.stopPropagation();
    LightBox.onclick = (e) => e.stopPropagation();

    const { imgELW, imgELH, LightBoxW, LightBoxH } = getDimensions(imgEL, LightBox),
    deltaX = e.clientX - imgState.lastX,
    deltaY = e.clientY - imgState.lastY;

    if (imgState.scale <= MIN) {
      imgEL.style.transition = 'transform .15s ease-out';
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
      imgEL.style.transform = `${translate} scale(${MIN})`;

    } else if (imgELW <= LightBoxW && imgELH >= LightBoxH) {
      imgState.offsetY += deltaY;
      const EdgeY = (imgELH - LightBoxH) / 2;
      imgState.offsetY = Math.max(Math.min(imgState.offsetY, EdgeY + imgState.SnapMouse), -EdgeY - imgState.SnapMouse);
      imgEL.style.transform = `translateY(${imgState.offsetY}px) scale(${imgState.scale})`;

    } else if (imgELH <= LightBoxH && imgELW >= LightBoxW) {
      imgState.offsetX += deltaX;
      const EdgeX = (imgELW - LightBoxW) / 2;
      imgState.offsetX = Math.max(Math.min(imgState.offsetX, EdgeX + imgState.SnapMouse), -EdgeX - imgState.SnapMouse);
      imgEL.style.transform = `translateX(${imgState.offsetX}px) scale(${imgState.scale})`;

    } else if (imgELW >= LightBoxW && imgELH >= LightBoxH) {
      imgState.offsetX += deltaX;
      imgState.offsetY += deltaY;

      const EdgeX = (imgELW - LightBoxW) / 2;
      imgState.offsetX = Math.max(Math.min(imgState.offsetX, EdgeX + imgState.SnapMouse), -EdgeX - imgState.SnapMouse);

      const EdgeY = (imgELH - LightBoxH) / 2;
      imgState.offsetY = Math.max(Math.min(imgState.offsetY, EdgeY + imgState.SnapMouse), -EdgeY - imgState.SnapMouse);

      imgEL.style.transform = `translate(${imgState.offsetX}px, ${imgState.offsetY}px) scale(${imgState.scale})`;
    }

    imgState.lastX = e.clientX;
    imgState.lastY = e.clientY;
  });

  const NAME = persist === true ? 'SDImageViewerEvents' : 'SharedImageEvents';
  window[NAME] = window[NAME] || {};

  if (persist !== true) {
    if (window[NAME].MouseUp) document.removeEventListener('mouseup', window[NAME].MouseUp);
    if (window[NAME].MouseLeave) document.removeEventListener('mouseleave', window[NAME].MouseLeave);
    if (window[NAME].Resize) window.removeEventListener('resize', window[NAME].Resize);
  }

  if (persist === true && window[NAME].MouseUp) return;

  window[NAME].MouseUp = (e) => {
    clearTimeout(imgState.GropinTime);
    if (!imgState.Groped && e.button === 0) {
      imgEL.onclick = undefined;
      LightBox.onclick = e => (e.preventDefault(), e.target === imgEL || imgState.close());
      return;
    }

    imgState.SnapBack(imgEL, LightBox);
    imgState.Groped = false;
    imgEL.style.cursor = '';
    Control.classList.remove(noPointer);
    imgState.Axis = null;
  };

  window[NAME].MouseLeave = (e) => {
    if (e.target !== LightBox && imgState.Groped) {
      imgState.SnapBack(imgEL, LightBox);
      imgState.Groped = false;
      imgEL.style.cursor = '';
      Control.classList.remove(noPointer);
      imgState.Axis = null;
    }
  };

  window[NAME].Resize = () => {
    clearTimeout(Resizer);
    Resizer = setTimeout(() => {
      imgState.clamp(imgEL, LightBox);
      imgEL.style.transition = 'none';
      imgEL.getBoundingClientRect();
      imgState.SnapBack(imgEL, LightBox, true);
    }, 0);
  };

  setTimeout(() => {
    document.addEventListener('mouseup', window[NAME].MouseUp);
    document.addEventListener('mouseleave', window[NAME].MouseLeave);
    window.addEventListener('resize', window[NAME].Resize);
  }, 100);

  imgEL.addEventListener('wheel', (e) => {
    e.stopPropagation();
    e.preventDefault();

    imgEL.style.transition = 'transform .3s cubic-bezier(.3, .6, .6, 1)';

    const CTRL = e.ctrlKey || e.metaKey,
          SHIFT = e.shiftKey,

          centerX = LightBox.offsetWidth / 2,
          centerY = LightBox.offsetHeight / 2,
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
          { imgELW, imgELH, LightBoxW, LightBoxH } = getDimensions(imgEL, LightBox);

    if (imgState.scale <= MIN) {
      imgEL.style.transform = `translate(0px, 0px) scale(${MIN})`;

    } else if (imgELW <= LightBoxW && imgELH >= LightBoxH) {
      if (CTRL) {
        imgState.offsetY -= delta * moveStep;
      } else {
        const imgCenterY = imgState.offsetY + centerY;
        imgState.offsetY = e.clientY - ((e.clientY - imgCenterY) / lastScale) * imgState.scale - centerY;
      }

      const EdgeY = (imgELH - LightBoxH) / 2;
      if (imgState.offsetY > EdgeY) imgState.offsetY = EdgeY;
      else if (imgState.offsetY < -EdgeY) imgState.offsetY = -EdgeY;

      imgEL.style.transform = `translateY(${imgState.offsetY}px) scale(${SCALE})`;

    } else if (imgELH <= LightBoxH && imgELW >= LightBoxW) {
      if (SHIFT) {
        imgState.offsetX -= delta * moveStep;
      } else {
        const imgCenterX = imgState.offsetX + centerX;
        imgState.offsetX = e.clientX - ((e.clientX - imgCenterX) / lastScale) * imgState.scale - centerX;
      }

      const EdgeX = (imgELW - LightBoxW) / 2;
      if (imgState.offsetX > EdgeX) imgState.offsetX = EdgeX;
      else if (imgState.offsetX < -EdgeX) imgState.offsetX = -EdgeX;

      imgEL.style.transform = `translateX(${imgState.offsetX}px) scale(${SCALE})`;

    } else if (imgELW >= LightBoxW && imgELH >= LightBoxH) {
      if (CTRL) {
        imgState.offsetY -= delta * moveStep;
      } else if (SHIFT) {
        imgState.offsetX -= delta * moveStep;
      } else if (!SHIFT && !CTRL) {
        const imgCenterX = imgState.offsetX + centerX, imgCenterY = imgState.offsetY + centerY;
        imgState.offsetX = e.clientX - ((e.clientX - imgCenterX) / lastScale) * imgState.scale - centerX;
        imgState.offsetY = e.clientY - ((e.clientY - imgCenterY) / lastScale) * imgState.scale - centerY;
      }

      const EdgeX = (imgELW - LightBoxW) / 2;
      if (imgState.offsetX > EdgeX) imgState.offsetX = EdgeX;
      else if (imgState.offsetX < -EdgeX) imgState.offsetX = -EdgeX;

      const EdgeY = (imgELH - LightBoxH) / 2;
      if (imgState.offsetY > EdgeY) imgState.offsetY = EdgeY;
      else if (imgState.offsetY < -EdgeY) imgState.offsetY = -EdgeY;

      imgEL.style.transform = `translate(${imgState.offsetX}px, ${imgState.offsetY}px) scale(${SCALE})`;
    }
  }, { passive: false });

  let lastDistance = 0, lastScale = 1;
  const touchDistance = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  LightBox.ontouchmove = (e) => e.target !== imgEL && (e.stopPropagation(), e.preventDefault());

  imgEL.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    imgEL.style.transition = 'none';
    if (imgState.scale > MIN) Control.classList.add(noPointer);

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
  });

  imgEL.addEventListener('touchmove', (e) => {
    e.stopPropagation();
    e.preventDefault();
    imgEL.onclick = (e) => e.stopPropagation();

    if (e.targetTouches[1]) {
      const currentDistance = touchDistance(e.targetTouches[0], e.targetTouches[1]);
      const zoom = currentDistance / lastDistance;
      const centerX = LightBox.offsetWidth / 2;
      const centerY = LightBox.offsetHeight / 2;
      const pinchCenterX = (e.targetTouches[0].clientX + e.targetTouches[1].clientX) / 2;
      const pinchCenterY = (e.targetTouches[0].clientY + e.targetTouches[1].clientY) / 2;
      const prevScale = imgState.scale;

      imgState.scale = lastScale * zoom;
      imgState.scale = Math.max(MIN, Math.min(imgState.scale, MAX));

      const { imgELW, imgELH, LightBoxW, LightBoxH } = getDimensions(imgEL, LightBox);

      if (imgState.scale <= MIN) {
        imgState.offsetX = imgState.offsetY = 0;
        imgEL.style.transform = `translate(0px, 0px) scale(${imgState.scale})`;

      } else if (imgELW <= LightBoxW && imgELH >= LightBoxH) {
        const imgCenterY = imgState.offsetY + centerY;
        imgState.offsetY = pinchCenterY - ((pinchCenterY - imgCenterY) / prevScale) * imgState.scale - centerY;

        const EdgeY = (imgELH - LightBoxH) / 2;
        if (imgState.offsetY > EdgeY) imgState.offsetY = EdgeY;
        else if (imgState.offsetY < -EdgeY) imgState.offsetY = -EdgeY;

        imgEL.style.transform = `translateY(${imgState.offsetY}px) scale(${imgState.scale})`;

      } else if (imgELH <= LightBoxH && imgELW >= LightBoxW) {
        const imgCenterX = imgState.offsetX + centerX;
        imgState.offsetX = pinchCenterX - ((pinchCenterX - imgCenterX) / prevScale) * imgState.scale - centerX;

        const EdgeX = (imgELW - LightBoxW) / 2;
        if (imgState.offsetX > EdgeX) imgState.offsetX = EdgeX;
        else if (imgState.offsetX < -EdgeX) imgState.offsetX = -EdgeX;

        imgEL.style.transform = `translateX(${imgState.offsetX}px) scale(${imgState.scale})`;

      } else if (imgELW >= LightBoxW && imgELH >= LightBoxH) {
        const imgCenterX = imgState.offsetX + centerX;
        const imgCenterY = imgState.offsetY + centerY;

        imgState.offsetX = pinchCenterX - ((pinchCenterX - imgCenterX) / prevScale) * imgState.scale - centerX;
        imgState.offsetY = pinchCenterY - ((pinchCenterY - imgCenterY) / prevScale) * imgState.scale - centerY;

        const EdgeX = (imgELW - LightBoxW) / 2;
        const EdgeY = (imgELH - LightBoxH) / 2;

        if (imgState.offsetX > EdgeX) imgState.offsetX = EdgeX;
        else if (imgState.offsetX < -EdgeX) imgState.offsetX = -EdgeX;

        if (imgState.offsetY > EdgeY) imgState.offsetY = EdgeY;
        else if (imgState.offsetY < -EdgeY) imgState.offsetY = -EdgeY;

        imgEL.style.transform = `translate(${imgState.offsetX}px, ${imgState.offsetY}px) scale(${imgState.scale})`;
      }

    } else if (!imgState.TouchGrass.touchScale) {
      imgEL.style.transition = 'transform 60ms ease';

      const currentX = e.targetTouches[0].clientX;
      const currentY = e.targetTouches[0].clientY;
      const deltaX = (currentX - imgState.lastX) * imgState.dragSpeed;
      const deltaY = (currentY - imgState.lastY) * imgState.dragSpeed;

      const { imgELW, imgELH, LightBoxW, LightBoxH } = getDimensions(imgEL, LightBox);

      if (imgState.scale <= MIN) {
        imgState.offsetX = imgState.offsetY = 0;
        imgEL.style.transform = `translate(0px, 0px) scale(${imgState.scale})`;

      } else if (imgELW <= LightBoxW && imgELH >= LightBoxH) {
        imgState.offsetY += deltaY;
        const EdgeY = (imgELH - LightBoxH) / 2;
        imgState.offsetY = Math.max(Math.min(imgState.offsetY, EdgeY + imgState.SnapTouch), -EdgeY - imgState.SnapTouch);
        imgEL.style.transform = `translateY(${imgState.offsetY}px) scale(${imgState.scale})`;

      } else if (imgELH <= LightBoxH && imgELW >= LightBoxW) {
        imgState.offsetX += deltaX;
        const EdgeX = (imgELW - LightBoxW) / 2;
        imgState.offsetX = Math.max(Math.min(imgState.offsetX, EdgeX + imgState.SnapTouch), -EdgeX - imgState.SnapTouch);
        imgEL.style.transform = `translateX(${imgState.offsetX}px) scale(${imgState.scale})`;

      } else if (imgELW >= LightBoxW && imgELH >= LightBoxH) {
        imgState.offsetX += deltaX;
        imgState.offsetY += deltaY;

        const EdgeX = (imgELW - LightBoxW) / 2;
        const EdgeY = (imgELH - LightBoxH) / 2;

        imgState.offsetX = Math.max(Math.min(imgState.offsetX, EdgeX + imgState.SnapTouch), -EdgeX - imgState.SnapTouch);
        imgState.offsetY = Math.max(Math.min(imgState.offsetY, EdgeY + imgState.SnapTouch), -EdgeY - imgState.SnapTouch);
        imgEL.style.transform = `translate(${imgState.offsetX}px, ${imgState.offsetY}px) scale(${imgState.scale})`;
      }

      imgState.lastX = currentX;
      imgState.lastY = currentY;
    }
  });

  imgEL.addEventListener('touchcancel', (e) => {
    e.stopPropagation();
    e.preventDefault();
    Control.classList.remove(noPointer);
    imgEL.onclick = undefined;
    imgState.MultiGrope = false;
    imgState.TouchGrass.touchScale = false;
    imgEL.style.transform = `translate(${imgState.offsetX}px, ${imgState.offsetY}px) scale(${imgState.scale})`;
    imgState.SnapBack(imgEL, LightBox);
    imgState.Axis = null;
  });

  imgEL.addEventListener('touchend', (e) => {
    e.stopPropagation();
    Control.classList.remove(noPointer);
    imgEL.onclick = undefined;
    imgEL.style.transition = 'none';
    imgState.Axis = null;

    if (e.targetTouches.length === 0) {
      if (imgState.MultiGrope) imgState.MultiGrope = false; 
      imgState.TouchGrass.touchScale = false;
      imgState.SnapBack(imgEL, LightBox);
      setTimeout(() => imgState.TouchGrass.touchScale = false, 10);
    }
  });

  return { state: imgState };
}