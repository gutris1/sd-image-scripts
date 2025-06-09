function SharedImageViewer(imgEL, LightBox, Control, Wrapper, options = {}) {
  const { MIN = 1.0001, MAX = 10, noScroll = null, noPointer = null } = options;

  const imgState = {
    scale: 1.0001, offsetX: 0, offsetY: 0, lastX: 0, lastY: 0, lastLen: 1, LastTouch: 0, LastZoom: 0,
    ZoomMomentum: 0, MoveMomentum: 0, SnapMouse: 20, SnapTouch: 10, dragSpeed: 1.5,

    TouchGrass: {
      touchScale: false, last1X: 0, last1Y: 0, last2X: 0, last2Y: 0, 
      delta1X: 0, delta1Y: 0, delta2X: 0, delta2Y: 0, scale: 1.0001
    },

    SnapBack: function (imgEL, LightBox, resize = false) {
      const imgELW = imgEL.offsetWidth * this.scale;
      const imgELH = imgEL.offsetHeight * this.scale;
      const LightBoxW = LightBox.offsetWidth;
      const LightBoxH = LightBox.offsetHeight;

      if (this.scale <= MIN) {
        this.offsetX = this.offsetY = this.lastX = this.lastY = 0;
        imgEL.style.transition = '';
        imgEL.style.transform = `scale(${this.scale})`;
        return;
      }

      let targetX = this.offsetX;
      let targetY = this.offsetY;

      if (imgELW <= LightBoxW) {
        targetX = 0;
      } else {
        const maxX = (imgELW - LightBoxW) / 2;
        targetX = Math.max(-maxX, Math.min(maxX, this.offsetX));
      }

      if (imgELH <= LightBoxH) {
        targetY = 0;
      } else {
        const maxY = (imgELH - LightBoxH) / 2;
        targetY = Math.max(-maxY, Math.min(maxY, this.offsetY));
      }

      const changed = (targetX !== this.offsetX) || (targetY !== this.offsetY);
      this.offsetX = targetX;
      this.offsetY = targetY;

      if (resize && changed) {
        imgEL.style.transition = 'none';
      } else if (!resize) {
        imgEL.style.transition = 'transform .3s ease-out';
      } else {
        imgEL.style.transition = '';
      }

      imgEL.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`;
    },

    clamp: function (imgEL, LightBox) {
      const imgELW = imgEL.offsetWidth * this.scale;
      const imgELH = imgEL.offsetHeight * this.scale;
      const LightBoxW = LightBox.offsetWidth;
      const LightBoxH = LightBox.offsetHeight;

      const maxX = (imgELW - LightBoxW) / 2;
      const maxY = (imgELH - LightBoxH) / 2;

      this.offsetX = Math.max(-maxX, Math.min(maxX, this.offsetX));
      this.offsetY = Math.max(-maxY, Math.min(maxY, this.offsetY));
    },

    reset: function() {
      this.scale = 1.0001; 
      this.offsetX = this.offsetY = this.lastX = this.lastY = 0;

      Object.assign(this.TouchGrass, {
        touchScale: false, last1X: 0, last1Y: 0, last2X: 0, last2Y: 0, 
        delta1X: 0, delta1Y: 0, delta2X: 0, delta2Y: 0, scale: 1.0001
      });

      imgEL.style.transition = imgEL.style.transform = '';
    },

    close: function () {
      LightBox.style.opacity = '';

      setTimeout(() => {
        LightBox.style.display = 'none';
        Wrapper.style.transform = Wrapper.style.opacity = '';
        imgEL?.remove();
        document.body.classList.remove(noScroll);
      }, 200);
    }
  };

  imgState.reset();

  imgEL.ondrag = imgEL.ondragend = imgEL.ondragstart = (e) => (e.stopPropagation(), e.preventDefault());

  let GropinTime = null;
  let Groped = false;
  let Resizer;

  imgEL.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    GropinTime = setTimeout(() => {
      Groped = true;
      imgEL.style.transition = 'transform 0s';
      imgEL.style.cursor = 'grab';
      imgState.lastX = e.clientX;
      imgState.lastY = e.clientY;
      Control.classList.add(noPointer);
    }, 100);
  });

  imgEL.addEventListener('mousemove', (e) => {
    if (!Groped) return;

    e.preventDefault();
    imgEL.onclick = (e) => e.stopPropagation();
    LightBox.onclick = (e) => e.stopPropagation();

    const imgELW = imgEL.offsetWidth * imgState.scale;
    const imgELH = imgEL.offsetHeight * imgState.scale;
    const LightBoxW = LightBox.offsetWidth;
    const LightBoxH = LightBox.offsetHeight;

    const deltaX = e.clientX - imgState.lastX;
    const deltaY = e.clientY - imgState.lastY;

    imgEL.style.transition = 'transform 60ms ease';

    if (imgState.scale <= MIN) {
      imgEL.style.transform = `translate(0px, 0px) scale(${MIN})`;

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

  window.SharedImageEvents = window.SharedImageEvents || {};
  if (window.SharedImageEvents.MouseUp) document.removeEventListener('mouseup', window.SharedImageEvents.MouseUp);
  if (window.SharedImageEvents.MouseLeave) document.removeEventListener('mouseleave', window.SharedImageEvents.MouseLeave);
  if (window.SharedImageEvents.Resize) window.removeEventListener('resize', window.SharedImageEvents.Resize);

  window.SharedImageEvents.MouseUp = (e) => {
    clearTimeout(GropinTime);
    if (!Groped && e.button === 0) {
      imgEL.onclick = undefined;
      LightBox.onclick = e => (e.preventDefault(), e.target === imgEL || imgState.close());
      return;
    }

    imgState.SnapBack(imgEL, LightBox);
    Groped = false;
    imgEL.style.cursor = 'auto';
    setTimeout(() => imgEL.style.transition = 'transform 0s', 100);
    Control.classList.remove(noPointer);
  };

  window.SharedImageEvents.MouseLeave = (e) => {
    if (e.target !== LightBox && Groped) {
      imgState.SnapBack(imgEL, LightBox);
      Groped = false;
      imgEL.style.cursor = 'auto';
      Control.classList.remove(noPointer);
    }
  };

  window.SharedImageEvents.Resize = () => {
    clearTimeout(Resizer);
    Resizer = setTimeout(() => {
      imgState.clamp(imgEL, LightBox);
      imgEL.style.transition = 'none';
      imgEL.getBoundingClientRect();
      imgState.SnapBack(imgEL, LightBox, true);
    }, 0);
  };

  setTimeout(() => {
    document.addEventListener('mouseup', window.SharedImageEvents.MouseUp);
    document.addEventListener('mouseleave', window.SharedImageEvents.MouseLeave);
    window.addEventListener('resize', window.SharedImageEvents.Resize);
  }, 100);

  imgEL.addEventListener('wheel', (e) => {
    e.stopPropagation();
    e.preventDefault();

    const CTRL = e.ctrlKey || e.metaKey;
    const SHIFT = e.shiftKey;

    const currentTime = Date.now();
    const timeDelta = currentTime - imgState.LastZoom;
    imgState.LastZoom = currentTime;

    const centerX = LightBox.offsetWidth / 2;
    const centerY = LightBox.offsetHeight / 2;
    const delta = Math.max(-1, Math.min(1, e.wheelDelta || -e.detail));
    const zoomStep = 0.15;
    const zoom = MIN + delta * zoomStep;
    const moveStep = 30 * imgState.scale;
    const lastScale = imgState.scale;

    if (!CTRL && !SHIFT) {
      imgState.scale *= zoom;
      imgState.scale = Math.max(MIN, Math.min(imgState.scale, MAX));
    }

    imgState.ZoomMomentum = delta / (timeDelta * 0.5 || 1);
    imgState.ZoomMomentum = Math.min(Math.max(imgState.ZoomMomentum, -1.5), 1.5);

    imgState.MoveMomentum = delta / (timeDelta * 0.1 || MIN);
    imgState.MoveMomentum = Math.min(Math.max(imgState.MoveMomentum, -2), 2);

    imgEL.style.transition = 'transform .3s ease-out';
    const SCALE = (CTRL || SHIFT) ? lastScale : imgState.scale;

    const imgELW = imgEL.offsetWidth * imgState.scale;
    const imgELH = imgEL.offsetHeight * imgState.scale;
    const LightBoxW = LightBox.offsetWidth;
    const LightBoxH = LightBox.offsetHeight;

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
        const imgCenterX = imgState.offsetX + centerX;
        const imgCenterY = imgState.offsetY + centerY;
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

    imgState.ZoomMomentum *= 0.5;
    imgState.MoveMomentum *= 0.1;
  }, { passive: false });

  let MultiGrope = false;
  let lastDistance = 0;
  let lastScale = 1;

  const touchDistance = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  LightBox.ontouchmove = (e) => e.target !== imgEL && (e.stopPropagation(), e.preventDefault());

  imgEL.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    imgEL.style.transition = 'none';
    Control.classList.add(noPointer);

    if (e.targetTouches[1]) {
      MultiGrope = true;
      imgState.TouchGrass.touchScale = true;
      lastDistance = touchDistance(e.targetTouches[0], e.targetTouches[1]);
      lastScale = imgState.scale;

    } else {
      MultiGrope = false;
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

      const imgELW = imgEL.offsetWidth * imgState.scale;
      const imgELH = imgEL.offsetHeight * imgState.scale;
      const LightBoxW = LightBox.offsetWidth;
      const LightBoxH = LightBox.offsetHeight;

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

      const imgELW = imgEL.offsetWidth * imgState.scale;
      const imgELH = imgEL.offsetHeight * imgState.scale;
      const LightBoxW = LightBox.offsetWidth;
      const LightBoxH = LightBox.offsetHeight;

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
    MultiGrope = false;
    imgState.TouchGrass.touchScale = false;
    imgEL.style.transform = `translate(${imgState.offsetX}px, ${imgState.offsetY}px) scale(${imgState.scale})`;
    imgState.SnapBack(imgEL, LightBox);
  });

  imgEL.addEventListener('touchend', (e) => {
    e.stopPropagation();
    Control.classList.remove(noPointer);
    imgEL.onclick = undefined;
    imgEL.style.transition = 'none';

    if (e.targetTouches.length === 0) {
      if (MultiGrope) MultiGrope = false; 
      imgState.TouchGrass.touchScale = false;
      imgState.SnapBack(imgEL, LightBox);
      setTimeout(() => imgState.TouchGrass.touchScale = false, 10);
    }
  });

  return { state: imgState };
}