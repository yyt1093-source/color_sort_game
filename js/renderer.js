/**
 * HTML5 Canvas & Dynamic Glass Renderer for Color Sort Mini App
 */
(function (exports) {
  let boardContainer = null;
  let particleCanvas = null;
  let particleCtx = null;
  let activeParticles = [];
  let animFrameId = null;
  const UNIT_HEIGHT = 19;

  function initRenderer(containerEl, canvasEl) {
    boardContainer = containerEl;
    particleCanvas = canvasEl;
    if (particleCanvas) {
      particleCtx = particleCanvas.getContext('2d');
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      startParticleLoop();
    }
  }

  function resizeCanvas() {
    if (particleCanvas) {
      particleCanvas.width = window.innerWidth;
      particleCanvas.height = window.innerHeight;
    }
  }

  function updateBottleLiquid(bottleEl, layers, idx, engine) {
    const liquidContainer = bottleEl.querySelector('.liquid-container');
    if (!liquidContainer) return;
    liquidContainer.innerHTML = '';
    const colors = engine.colors;

    const segments = [];
    for (let i = 0; i < layers.length; i++) {
      const colorIdx = layers[i];
      const isKnown = (engine.revealed && engine.revealed[idx] && engine.revealed[idx][i] !== undefined)
        ? engine.revealed[idx][i]
        : (i === layers.length - 1);

      const prevSegment = segments[segments.length - 1];
      if (prevSegment && prevSegment.isKnown === isKnown && (!isKnown || prevSegment.colorIdx === colorIdx)) {
        prevSegment.unitsCount += 1;
      } else {
        segments.push({
          isKnown,
          colorIdx,
          unitsCount: 1
        });
      }
    }

    segments.forEach((seg, segIdx) => {
      const isTopSegment = (segIdx === segments.length - 1);
      const segEl = document.createElement('div');
      const segHeight = seg.unitsCount * UNIT_HEIGHT;

      if (seg.isKnown) {
        let colorData = (typeof seg.colorIdx === 'number' || typeof seg.colorIdx === 'string') 
                        ? colors[seg.colorIdx] 
                        : seg.colorIdx;
        if (!colorData) colorData = { hex: '#999', glow: 'rgba(150,150,150,0.5)' };

        segEl.className = 'liquid-layer liquid-revealed-layer';
        segEl.style.height = `${segHeight}px`;
        segEl.style.backgroundColor = colorData.hex;
        segEl.dataset.colorIndex = seg.colorIdx;
        segEl.dataset.units = seg.unitsCount;

        if (!isTopSegment) {
          segEl.style.borderTop = '1px solid rgba(0, 0, 0, 0.16)';
        }

        if (isTopSegment) {
          const wave = document.createElement('div');
          wave.className = 'liquid-wave';
          segEl.appendChild(wave);
        }
      } else {
        segEl.className = 'liquid-layer liquid-hidden-layer';
        segEl.style.height = `${segHeight}px`;
        segEl.dataset.units = seg.unitsCount;

        for (let u = 0; u < seg.unitsCount; u++) {
          const mark = document.createElement('span');
          mark.className = 'mystery-mark';
          mark.textContent = '?';
          segEl.appendChild(mark);
        }
      }

      liquidContainer.appendChild(segEl);
    });
  }

  function renderBoard(engine) {
    if (!boardContainer) return;

    const bottles = engine.bottles;
    const selectedIdx = engine.selectedBottleIndex;
    const hint = engine.hintHighlight;
    const colors = engine.colors;

    const existingBottles = boardContainer.querySelectorAll('.glass-bottle');

    // In-place update if bottle elements already exist: zero reflow, zero movement of other bottles!
    if (existingBottles.length === bottles.length) {
      existingBottles.forEach((bottleEl, idx) => {
        const layers = bottles[idx];
        const isVanished = !!(layers && layers.vanished);

        bottleEl.classList.toggle('selected', selectedIdx === idx);

        bottleEl.classList.remove('hint-from', 'hint-to');
        if (hint && (hint.from === idx || hint.to === idx)) {
          bottleEl.classList.add(hint.from === idx ? 'hint-from' : 'hint-to');
        }

        if (isVanished) {
          bottleEl.classList.add('bottle-vanished');
          bottleEl.style.visibility = 'hidden';
          bottleEl.style.pointerEvents = 'none';
          bottleEl.style.opacity = '0';
        } else {
          bottleEl.classList.remove('bottle-vanished');
          bottleEl.style.visibility = 'visible';
          bottleEl.style.pointerEvents = 'auto';
          bottleEl.style.opacity = '1';
        }

        const currentLayerSig = layers.join(',') + '_' + (engine.revealed && engine.revealed[idx] ? engine.revealed[idx].join(',') : '');
        if (bottleEl.dataset.layerSig !== currentLayerSig) {
          bottleEl.dataset.layerSig = currentLayerSig;
          updateBottleLiquid(bottleEl, layers, idx, engine);
        }
      });
      return;
    }

    // Full build (only upon new level loading or count change)
    boardContainer.innerHTML = '';
    boardContainer.className = 'game-board';
    if (bottles.length <= 6) boardContainer.classList.add('board-small');
    else if (bottles.length <= 10) boardContainer.classList.add('board-medium');
    else if (bottles.length <= 14) boardContainer.classList.add('board-large');
    else boardContainer.classList.add('board-xlarge');

    bottles.forEach((layers, idx) => {
      const bottleEl = document.createElement('div');
      bottleEl.className = 'glass-bottle';
      bottleEl.dataset.index = idx;

      if (selectedIdx === idx) bottleEl.classList.add('selected');
      if (hint && (hint.from === idx || hint.to === idx)) {
        bottleEl.classList.add(hint.from === idx ? 'hint-from' : 'hint-to');
      }

      if (layers && layers.vanished) {
        bottleEl.classList.add('bottle-vanished');
        bottleEl.style.visibility = 'hidden';
        bottleEl.style.pointerEvents = 'none';
        bottleEl.style.opacity = '0';
      }

      const rimEl = document.createElement('div');
      rimEl.className = 'bottle-rim';
      bottleEl.appendChild(rimEl);

      const liquidContainer = document.createElement('div');
      liquidContainer.className = 'liquid-container';
      bottleEl.appendChild(liquidContainer);

      const currentLayerSig = layers.join(',') + '_' + (engine.revealed && engine.revealed[idx] ? engine.revealed[idx].join(',') : '');
      bottleEl.dataset.layerSig = currentLayerSig;
      updateBottleLiquid(bottleEl, layers, idx, engine);

      bottleEl.addEventListener('click', () => {
        engine.selectBottle(idx);
      });

      boardContainer.appendChild(bottleEl);
    });
  }

  function spawnPourSplash(x, y, colorHex, count = 2) {
    if (!particleCtx || !particleCanvas) return;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      const speed = 1.0 + Math.random() * 2.2;
      activeParticles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        size: 2 + Math.random() * 2.5,
        color: colorHex,
        alpha: 0.9,
        life: 1,
        decay: 0.04 + Math.random() * 0.03,
        type: 'circle'
      });
    }
  }

  function animatePour(fromIdx, toIdx, amount, colorIdx, onComplete) {
    if (!boardContainer) return onComplete();

    const bottleEls = boardContainer.querySelectorAll('.glass-bottle');
    const fromEl = bottleEls[fromIdx];
    const toEl = bottleEls[toIdx];

    if (!fromEl || !toEl) return onComplete();

    // Remove selection float animation and class cleanly
    fromEl.classList.remove('selected');
    fromEl.style.animation = 'none';

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    // Determine pouring direction
    const isToRight = toRect.left >= fromRect.left;

    // Get color details
    const engine = window.GameEngine.Engine || window.GameEngine;
    const colors = (engine && engine.colors) ? engine.colors : [];
    const colorData = (typeof colorIdx === 'number' || typeof colorIdx === 'string') 
                      ? colors[colorIdx] 
                      : colorIdx;
    const colorHex = (colorData && colorData.hex) ? colorData.hex : '#3B82F6';
    const colorGlow = (colorData && colorData.glow) ? colorData.glow : 'rgba(59, 130, 246, 0.5)';

    // Target bottle mouth center in viewport
    const toMouthX = toRect.left + toRect.width / 2;
    const toMouthY = toRect.top + 4;

    // Set transform origin on fromEl near its neck/mouth rim
    const originX = isToRight ? Math.round(fromRect.width * 0.38) : Math.round(fromRect.width * 0.62);
    const originY = 8;
    fromEl.style.transformOrigin = `${originX}px ${originY}px`;

    // fromEl pivot in initial viewport coordinates
    const origPivotX = fromRect.left + originX;
    const origPivotY = fromRect.top + originY;

    // Target hovering pivot: slightly above target bottle mouth
    const destPivotX = isToRight ? (toMouthX - 11) : (toMouthX + 11);
    const destPivotY = toMouthY - 20;

    const deltaX = destPivotX - origPivotX;
    const deltaY = destPivotY - origPivotY;
    const tiltAngle = isToRight ? 78 : -78;

    // Elevate source bottle above everything on board
    fromEl.style.zIndex = '1000';

    // ---------------------------------------------------------
    // Phase 1: Smooth Flight to Target + Scale down to 0.88
    // (баночка подлетает и становится немножко меньше)
    // ---------------------------------------------------------
    fromEl.style.transition = 'transform 0.46s cubic-bezier(0.22, 1, 0.36, 1.15), box-shadow 0.35s ease';
    fromEl.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${tiltAngle}deg) scale(0.88)`;
    fromEl.style.boxShadow = `0 18px 36px rgba(0, 0, 0, 0.48), 0 0 22px ${colorGlow}`;

    setTimeout(() => {
      // ---------------------------------------------------------
      // Phase 2: Smooth Continuous Pouring Liquid Stream & Fluid Rise
      // ---------------------------------------------------------
      const initialTargetLayers = (engine && engine.bottles && engine.bottles[toIdx]) ? engine.bottles[toIdx].length : 0;
      const innerBottomY = toRect.bottom - 7;
      const toNeckY = toRect.top + 10;
      const toMouthX = toRect.left + toRect.width / 2;

      // Function to calculate stream landing surface Y inside recipient jar:
      // Empty jar (0 layers) -> stream plunges all the way to the bottom!
      // L layers -> surface is innerBottomY - L * UNIT_HEIGHT
      const getLandingY = (layersCount) => Math.max(toNeckY + 5, innerBottomY - (layersCount * UNIT_HEIGHT));

      const totalPouredUnits = Math.max(1, amount || 1);
      const totalPouredHeight = totalPouredUnits * UNIT_HEIGHT;

      let currentLandingY = getLandingY(initialTargetLayers);
      const finalLandingY = getLandingY(initialTargetLayers + totalPouredUnits);

      // Pour spout location on tilted pouring jar
      const spoutX = isToRight ? (destPivotX + 7) : (destPivotX - 7);
      const spoutY = destPivotY + 9;

      // Continuous pour duration (smooth, elegant, uninterrupted)
      const totalPourDuration = 680 + (totalPouredUnits - 1) * 160;

      // Web Audio gurgling water sound synthesized for full pour duration
      const SE = window.SoundEngine && window.SoundEngine.SoundEngine ? window.SoundEngine.SoundEngine : window.SoundEngine;
      const initialFillRatio = initialTargetLayers / 4;
      if (SE && SE.playWaterPour) {
        SE.playWaterPour((totalPourDuration / 1000) + 0.12, initialFillRatio);
      } else if (SE && SE.playPour) {
        SE.playPour((totalPourDuration / 1000) + 0.12, initialFillRatio);
      }

      const TG = window.TelegramApp && window.TelegramApp.TelegramApp ? window.TelegramApp.TelegramApp : window.TelegramApp;
      if (TG && TG.haptic) TG.haptic('medium');

      // Create realistic SVG curved stream
      const svgNS = 'http://www.w3.org/2000/svg';
      const svgEl = document.createElementNS(svgNS, 'svg');
      svgEl.setAttribute('class', 'pour-stream-svg');
      svgEl.style.position = 'fixed';
      svgEl.style.top = '0';
      svgEl.style.left = '0';
      svgEl.style.width = '100vw';
      svgEl.style.height = '100vh';
      svgEl.style.pointerEvents = 'none';
      svgEl.style.zIndex = '999';
      svgEl.style.opacity = '0';
      svgEl.style.transition = 'opacity 0.15s ease-out';

      const defs = document.createElementNS(svgNS, 'defs');
      const gradId = 'streamGrad_' + Date.now();
      const grad = document.createElementNS(svgNS, 'linearGradient');
      grad.setAttribute('id', gradId);
      grad.setAttribute('x1', '0%');
      grad.setAttribute('y1', '0%');
      grad.setAttribute('x2', '100%');
      grad.setAttribute('y2', '0%');

      const s1 = document.createElementNS(svgNS, 'stop');
      s1.setAttribute('offset', '0%');
      s1.setAttribute('stop-color', colorHex);
      s1.setAttribute('stop-opacity', '0.92');

      const s2 = document.createElementNS(svgNS, 'stop');
      s2.setAttribute('offset', '40%');
      s2.setAttribute('stop-color', '#ffffff');
      s2.setAttribute('stop-opacity', '0.85');

      const s3 = document.createElementNS(svgNS, 'stop');
      s3.setAttribute('offset', '70%');
      s3.setAttribute('stop-color', colorHex);
      s3.setAttribute('stop-opacity', '1');

      const s4 = document.createElementNS(svgNS, 'stop');
      s4.setAttribute('offset', '100%');
      s4.setAttribute('stop-color', colorHex);
      s4.setAttribute('stop-opacity', '0.92');

      grad.appendChild(s1);
      grad.appendChild(s2);
      grad.appendChild(s3);
      grad.appendChild(s4);
      defs.appendChild(grad);
      svgEl.appendChild(defs);

      // Generator for SVG stream path: curves from spout into bottle mouth,
      // then plunges vertically inside the jar to the liquid landing surface!
      const getStreamPathD = (yLanding) => {
        const cp1X = spoutX + (isToRight ? 12 : -12);
        const cp1Y = spoutY + 22;
        const cp2X = toMouthX + (isToRight ? -2 : 2);
        const cp2Y = toNeckY - 6;
        return `M ${spoutX} ${spoutY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${toMouthX} ${toNeckY} L ${toMouthX} ${yLanding}`;
      };

      const initialD = getStreamPathD(currentLandingY);

      // Outer liquid soft glow
      const glowPath = document.createElementNS(svgNS, 'path');
      glowPath.setAttribute('d', initialD);
      glowPath.setAttribute('fill', 'none');
      glowPath.setAttribute('stroke', colorHex);
      glowPath.setAttribute('stroke-width', '14');
      glowPath.setAttribute('stroke-linecap', 'round');
      glowPath.setAttribute('opacity', '0.35');
      glowPath.style.filter = 'blur(3px)';
      svgEl.appendChild(glowPath);

      // Main vibrant stream path
      const streamPath = document.createElementNS(svgNS, 'path');
      streamPath.setAttribute('d', initialD);
      streamPath.setAttribute('fill', 'none');
      streamPath.setAttribute('stroke', `url(#${gradId})`);
      streamPath.setAttribute('stroke-width', '6.5');
      streamPath.setAttribute('stroke-linecap', 'round');
      svgEl.appendChild(streamPath);

      // Center specular fluid reflection highlight
      const corePath = document.createElementNS(svgNS, 'path');
      corePath.setAttribute('d', initialD);
      corePath.setAttribute('fill', 'none');
      corePath.setAttribute('stroke', 'rgba(255, 255, 255, 0.7)');
      corePath.setAttribute('stroke-width', '2');
      corePath.setAttribute('stroke-linecap', 'round');
      svgEl.appendChild(corePath);

      document.body.appendChild(svgEl);
      requestAnimationFrame(() => {
        svgEl.style.opacity = '1';
      });

      // Surface ripple ring at exact fluid impact point
      const rippleEl = document.createElement('div');
      rippleEl.className = 'pour-landing-ripple';
      rippleEl.style.left = `${toMouthX}px`;
      rippleEl.style.top = `${currentLandingY}px`;
      rippleEl.style.width = '18px';
      rippleEl.style.height = '6px';
      rippleEl.style.border = `2px solid ${colorHex}`;
      rippleEl.style.boxShadow = `0 0 10px ${colorHex}`;
      document.body.appendChild(rippleEl);

      // Dynamic stream animation loop: tracks rising fluid surface in real-time smoothly
      let isStreamActive = true;
      const updateStream = () => {
        if (!isStreamActive) return;
        currentLandingY += (finalLandingY - currentLandingY) * 0.08;
        const dPath = getStreamPathD(currentLandingY);
        glowPath.setAttribute('d', dPath);
        streamPath.setAttribute('d', dPath);
        corePath.setAttribute('d', dPath);

        rippleEl.style.top = `${currentLandingY}px`;
        rippleEl.style.left = `${toMouthX}px`;

        requestAnimationFrame(updateStream);
      };
      requestAnimationFrame(updateStream);

      // 1. Source bottle draining: smoothly shrink top liquid segment
      const fromContainer = fromEl.querySelector('.liquid-container');
      const fromSegments = fromContainer ? Array.from(fromContainer.querySelectorAll('.liquid-layer')) : [];
      const topFromSegment = fromSegments[fromSegments.length - 1];
      if (topFromSegment) {
        const curH = topFromSegment.offsetHeight || (parseFloat(topFromSegment.style.height) || UNIT_HEIGHT);
        const newH = Math.max(0, curH - totalPouredHeight);
        topFromSegment.style.transition = `height ${totalPourDuration}ms cubic-bezier(0.22, 0.8, 0.36, 1), opacity ${totalPourDuration}ms ease`;
        topFromSegment.style.height = `${newH}px`;
        if (newH === 0) {
          topFromSegment.style.opacity = '0';
        }
      }

      // 2. Destination bottle filling: ONE continuous rising fluid element without division lines
      const toContainer = toEl.querySelector('.liquid-container');
      let incomingLiquid = null;
      if (toContainer) {
        incomingLiquid = document.createElement('div');
        incomingLiquid.className = 'liquid-layer temp-incoming-liquid';
        incomingLiquid.style.backgroundColor = colorHex;
        incomingLiquid.style.height = '0px';
        incomingLiquid.style.opacity = '1';
        incomingLiquid.style.transition = `height ${totalPourDuration}ms cubic-bezier(0.22, 0.8, 0.36, 1)`;
        toContainer.appendChild(incomingLiquid);

        requestAnimationFrame(() => {
          incomingLiquid.style.height = `${totalPouredHeight}px`;
        });
      }

      // Splash droplets interval during pour at the exact landing surface
      const splashInterval = setInterval(() => {
        spawnPourSplash(toMouthX, currentLandingY, colorHex, 2);
      }, 65);

      // When pour finishes
      setTimeout(() => {
        clearInterval(splashInterval);
        isStreamActive = false;

        if (SE && SE.stopWaterPour) SE.stopWaterPour();

        // Fade out stream & ripple
        svgEl.style.opacity = '0';
        if (rippleEl) rippleEl.style.opacity = '0';
        setTimeout(() => {
          if (svgEl.parentNode) svgEl.parentNode.removeChild(svgEl);
          if (rippleEl && rippleEl.parentNode) rippleEl.parentNode.removeChild(rippleEl);
        }, 180);

        // ---------------------------------------------------------
        // Phase 3: Return Flight & Scale back up to 1.0
        // (баночка выпрямляется, восстанавливает размер и возвращается)
        // ---------------------------------------------------------
        fromEl.style.transition = 'transform 0.42s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.42s ease';
        fromEl.style.transform = 'translate(0, 0) rotate(0deg) scale(1)';
        fromEl.style.boxShadow = '';

        setTimeout(() => {
          // Reset all temporary inline properties on source bottle
          fromEl.style.transition = '';
          fromEl.style.transform = '';
          fromEl.style.transformOrigin = '';
          fromEl.style.zIndex = '';
          fromEl.style.boxShadow = '';
          fromEl.style.animation = '';

          onComplete();
        }, 440);

      }, totalPourDuration + 40);

    }, 460);
  }

  function animateJarVanish(bottleIdx, onComplete) {
    if (!boardContainer) return onComplete();

    const bottleEls = boardContainer.querySelectorAll('.glass-bottle');
    const bottleEl = bottleEls[bottleIdx];
    if (!bottleEl) return onComplete();

    const rect = bottleEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    bottleEl.classList.add('vanish-animation');

    // Find the liquid color to match sparkles
    const layers = bottleEl.querySelectorAll('.liquid-layer');
    let bottleColor = '#FFFFFF';
    if (layers.length > 0) {
      bottleColor = layers[layers.length - 1].style.backgroundColor;
      layers.forEach(l => {
        l.className = 'liquid-layer liquid-top-layer';
        l.style.backgroundColor = bottleColor;
        l.style.boxShadow = `0 0 16px ${bottleColor}, inset 0 0 10px #ffffff`;
        const m = l.querySelector('.mystery-mark');
        if (m) m.remove();
      });
    }

    // Spawn primary bursts of colored sparkle particles
    spawnSparkles(centerX, centerY, 30, [bottleColor]);
    
    // Spawn secondary burst of white/gold sparkles
    setTimeout(() => {
      spawnSparkles(centerX, centerY, 20, ['#FFFFFF', '#FFD700']);
    }, 150);

    setTimeout(() => {
      bottleEl.classList.remove('vanish-animation');
      bottleEl.classList.add('bottle-vanished');
      bottleEl.style.visibility = 'hidden';
      bottleEl.style.pointerEvents = 'none';
      bottleEl.style.opacity = '0';
      onComplete();
    }, 700);
  }

  function spawnSparkles(x, y, count = 30, customColors = null) {
    const palette = customColors || ['#FFD700', '#FF69B4', '#00FFFF', '#00FF7F', '#FF4500', '#FFFFFF'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      activeParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 3 + Math.random() * 5,
        color: palette[Math.floor(Math.random() * palette.length)],
        alpha: 1,
        life: 1,
        decay: 0.02 + Math.random() * 0.03,
        type: Math.random() > 0.5 ? 'circle' : 'star'
      });
    }
  }

  function startParticleLoop() {
    function loop() {
      if (particleCtx && particleCanvas) {
        particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

        for (let i = activeParticles.length - 1; i >= 0; i--) {
          const p = activeParticles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.15; // Gravity
          p.alpha -= p.decay;

          if (p.alpha <= 0) {
            activeParticles.splice(i, 1);
            continue;
          }

          particleCtx.save();
          particleCtx.globalAlpha = p.alpha;
          particleCtx.fillStyle = p.color;
          particleCtx.shadowBlur = 8;
          particleCtx.shadowColor = p.color;

          if (p.type === 'star') {
            // Draw a 4-point star
            particleCtx.beginPath();
            const rot = Math.PI / 2 * 3;
            let cx = p.x;
            let cy = p.y;
            let step = Math.PI / 4;
            let outerRadius = p.size;
            let innerRadius = p.size / 2;

            for (let j = 0; j < 4; j++) {
              particleCtx.lineTo(cx + Math.cos(rot + j * 2 * step) * outerRadius, cy + Math.sin(rot + j * 2 * step) * outerRadius);
              particleCtx.lineTo(cx + Math.cos(rot + (j * 2 + 1) * step) * innerRadius, cy + Math.sin(rot + (j * 2 + 1) * step) * innerRadius);
            }
            particleCtx.closePath();
            particleCtx.fill();
          } else {
            particleCtx.beginPath();
            particleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            particleCtx.fill();
          }
          particleCtx.restore();
        }
      }
      animFrameId = requestAnimationFrame(loop);
    }
    loop();
  }

  function triggerWinConfetti() {
    const bursts = [
      { x: 0.25, y: 0.35, d: 0 },
      { x: 0.75, y: 0.3, d: 150 },
      { x: 0.5, y: 0.25, d: 350 },
      { x: 0.2, y: 0.45, d: 550 },
      { x: 0.8, y: 0.4, d: 750 },
      { x: 0.35, y: 0.2, d: 950 },
      { x: 0.65, y: 0.22, d: 1150 },
      { x: 0.5, y: 0.35, d: 1350 }
    ];

    bursts.forEach(b => {
      setTimeout(() => {
        spawnSparkles(
          b.x * window.innerWidth,
          b.y * window.innerHeight,
          55,
          ['#FFD700', '#FF69B4', '#00FFFF', '#00FF7F', '#FF3366', '#FFB703', '#FFFFFF']
        );
      }, b.d);
    });
  }

  function highlightBottleReveal(bottleIdx) {
    const bottleEl = document.querySelector(`.glass-bottle[data-index="${bottleIdx}"]`);
    if (!bottleEl) return;

    bottleEl.classList.add('bottle-revealed-effect');
    const rect = bottleEl.getBoundingClientRect();
    spawnSparkles(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      40,
      ['#a855f7', '#38bdf8', '#818cf8', '#ffffff', '#e879f9']
    );

    setTimeout(() => {
      bottleEl.classList.remove('bottle-revealed-effect');
    }, 1500);
  }

  const rendererAPI = {
    initRenderer,
    renderBoard,
    animatePour,
    animateJarVanish,
    spawnSparkles,
    triggerWinConfetti,
    highlightBottleReveal
  };
  Object.assign(exports, rendererAPI);
  exports.GameRenderer = rendererAPI;
})(typeof exports !== 'undefined' ? exports : (window.GameRenderer = {}));
