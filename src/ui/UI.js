// =========================================================================
// UI.js - Menu Handlers, Modals, Fullscreen, and Mobile Virtual Touch Controls
// =========================================================================

export class UIManager {
  constructor(game) {
    this.game = game;
    this.interactPrompt = document.getElementById('interact-prompt');
    this.interactText = document.getElementById('interact-text');
    this.throwHint = document.getElementById('throw-hint');
    this.titleScreen = document.getElementById('title-screen');
    this.pauseMenu = document.getElementById('pause-menu');
    this.chapterModal = document.getElementById('chapter-modal');
    this.settingsModal = document.getElementById('settings-modal');
    this.mobileLayer = document.getElementById('mobile-controls-layer');
    this.touchThrowBtn = document.getElementById('touch-btn-throw');

    // Auto-detect touch capability
    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    this.showTouchControls = this.isTouchDevice;

    this.bindEvents();
    this.initFullscreenHandlers();
    this.initTouchControls();
  }

  initFullscreenHandlers() {
    const handleFsChange = () => this.updateFullscreenIcons();
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);

    document.getElementById('btn-fullscreen')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFullscreen();
    });

    document.getElementById('btn-title-fullscreen')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFullscreen();
    });
  }

  toggleFullscreen() {
    const doc = document;
    const docEl = document.documentElement;
    const isFull = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);

    if (!isFull) {
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(err => console.warn('Fullscreen request denied:', err));
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(err => console.warn('Exit fullscreen error:', err));
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
    }
  }

  updateFullscreenIcons() {
    const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    const expandIcon = document.querySelector('#btn-fullscreen .icon-expand');
    const compressIcon = document.querySelector('#btn-fullscreen .icon-compress');
    if (expandIcon && compressIcon) {
      if (isFull) {
        expandIcon.classList.add('hidden');
        compressIcon.classList.remove('hidden');
      } else {
        expandIcon.classList.remove('hidden');
        compressIcon.classList.add('hidden');
      }
    }
    const titleBtn = document.getElementById('btn-title-fullscreen');
    if (titleBtn) {
      titleBtn.textContent = isFull ? 'EXIT FULLSCREEN' : 'FULLSCREEN MODE';
    }
  }

  initTouchControls() {
    if (!this.mobileLayer) return;

    // Attach touch handlers for all virtual action buttons
    const buttons = this.mobileLayer.querySelectorAll('.touch-btn');
    buttons.forEach((btn) => {
      const action = btn.getAttribute('data-action');
      if (!action) return;

      const onPress = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.game.input.setTouchAction(action, true);
        btn.classList.add('active');
      };

      const onRelease = (e) => {
        e.preventDefault();
        this.game.input.setTouchAction(action, false);
        btn.classList.remove('active');
      };

      btn.addEventListener('touchstart', onPress, { passive: false });
      btn.addEventListener('touchend', onRelease, { passive: false });
      btn.addEventListener('touchcancel', onRelease, { passive: false });

      // Mouse fallbacks for testing touch controls on desktop browser
      btn.addEventListener('mousedown', onPress);
      btn.addEventListener('mouseup', onRelease);
      btn.addEventListener('mouseleave', onRelease);
    });

    // Mobile canvas touch aiming for throwable items
    const canvas = this.game.canvas;
    const handleCanvasAim = (e) => {
      if (e.touches && e.touches.length > 0) {
        // Track the touch for trajectory aiming
        const touch = e.touches[0];
        this.game.input.mouse.x = touch.clientX;
        this.game.input.mouse.y = touch.clientY;
      }
    };

    canvas.addEventListener('touchstart', handleCanvasAim, { passive: true });
    canvas.addEventListener('touchmove', handleCanvasAim, { passive: true });

    // Mobile Pause Button
    document.getElementById('btn-mobile-pause')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.game.togglePause();
    });
  }

  bindEvents() {
    // 1. Title Screen Buttons & Resume Persistence
    const continueBtn = document.getElementById('btn-continue');
    const savedProgress = this.game.levelMgr.getSavedProgress();
    if (continueBtn && savedProgress && savedProgress.act) {
      continueBtn.classList.remove('hidden');
      continueBtn.addEventListener('click', () => {
        this.titleScreen.style.opacity = '0';
        setTimeout(() => this.titleScreen.classList.add('hidden'), 800);
        this.game.start(savedProgress.act, savedProgress.checkpoint || 0);
      });
    }

    document.getElementById('btn-start')?.addEventListener('click', () => {
      this.titleScreen.style.opacity = '0';
      setTimeout(() => this.titleScreen.classList.add('hidden'), 800);
      this.game.start(1, 0);
    });

    document.getElementById('btn-chapter-select')?.addEventListener('click', () => {
      this.chapterModal.classList.remove('hidden');
    });

    document.getElementById('btn-controls')?.addEventListener('click', () => {
      this.settingsModal.classList.remove('hidden');
    });

    // 2. Chapter Select
    document.querySelectorAll('.chapter-item').forEach(item => {
      item.addEventListener('click', () => {
        const chap = parseInt(item.getAttribute('data-chapter'), 10);
        this.chapterModal.classList.add('hidden');
        this.titleScreen.style.opacity = '0';
        setTimeout(() => this.titleScreen.classList.add('hidden'), 800);
        this.game.start(chap);
      });
    });

    document.getElementById('btn-close-chapters')?.addEventListener('click', () => {
      this.chapterModal.classList.add('hidden');
    });

    // 3. Settings Controls
    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      this.settingsModal.classList.add('hidden');
    });

    document.getElementById('slider-volume')?.addEventListener('input', (e) => {
      this.game.audio.setMasterVolume(parseFloat(e.target.value));
    });

    document.getElementById('check-shake')?.addEventListener('change', (e) => {
      this.game.camera.enableShake = e.target.checked;
    });

    document.getElementById('check-grain')?.addEventListener('change', (e) => {
      const grain = document.getElementById('grain-overlay');
      if (grain) grain.style.display = e.target.checked ? 'block' : 'none';
    });

    const touchCheckbox = document.getElementById('check-touch-controls');
    if (touchCheckbox) {
      touchCheckbox.checked = this.showTouchControls;
      touchCheckbox.addEventListener('change', (e) => {
        this.showTouchControls = e.target.checked;
      });
    }

    // 4. Pause Menu
    document.getElementById('btn-resume')?.addEventListener('click', () => {
      this.game.togglePause(false);
    });

    document.getElementById('btn-restart-checkpoint')?.addEventListener('click', () => {
      this.game.togglePause(false);
      this.game.levelMgr.reloadCheckpoint();
    });

    document.getElementById('btn-pause-settings')?.addEventListener('click', () => {
      this.settingsModal.classList.remove('hidden');
    });

    document.getElementById('btn-quit-title')?.addEventListener('click', () => {
      this.game.togglePause(false);
      this.titleScreen.classList.remove('hidden');
      this.titleScreen.style.opacity = '1';
      const saved = this.game.levelMgr.getSavedProgress();
      const cBtn = document.getElementById('btn-continue');
      if (cBtn && saved && saved.act) {
        cBtn.classList.remove('hidden');
      }
    });

    // 5. Victory Restart
    document.getElementById('btn-victory-restart')?.addEventListener('click', () => {
      document.getElementById('victory-screen')?.classList.add('hidden');
      this.game.start(1);
    });
  }

  update(player, levelMgr, camera, input) {
    // 1. Mobile Controls Layer visibility
    if (this.mobileLayer) {
      const isTitleActive = !this.titleScreen.classList.contains('hidden');
      const isPauseActive = !this.pauseMenu.classList.contains('hidden');
      const isVictoryActive = !document.getElementById('victory-screen')?.classList.contains('hidden');

      if (this.showTouchControls && this.game.isRunning && !isTitleActive && !isPauseActive && !isVictoryActive) {
        this.mobileLayer.classList.remove('hidden');
      } else {
        this.mobileLayer.classList.add('hidden');
      }
    }

    // 2. Mobile Throw Button Visibility
    if (this.touchThrowBtn) {
      if (player.heldItem && !player.isDead) {
        this.touchThrowBtn.classList.remove('hidden');
      } else {
        this.touchThrowBtn.classList.add('hidden');
      }
    }

    // 3. In-Game Contextual HUD prompts
    if (!this.interactPrompt) return;

    let promptText = null;
    let targetX = 0, targetY = 0;

    // Check Levers
    for (const lever of levelMgr.levers) {
      if (Math.hypot(lever.x - player.x, lever.y - player.y) < 55) {
        promptText = 'PULL LEVER';
        targetX = lever.x + lever.w * 0.5;
        targetY = lever.y - 15;
        break;
      }
    }

    // Check Pushable Crates
    if (!promptText && !player.isGrabbing) {
      for (const box of this.game.physics.pushables) {
        if (Math.hypot(box.x + box.w * 0.5 - (player.x + player.w * 0.5), box.y + box.h * 0.5 - (player.y + player.h * 0.5)) < 65) {
          promptText = 'PUSH / PULL';
          targetX = box.x + box.w * 0.5;
          targetY = box.y - 15;
          break;
        }
      }
    }

    // Check Throwable Bottles
    if (!promptText && !player.heldItem) {
      for (const b of levelMgr.throwables) {
        const bottleDist = Math.hypot(
          (b.x + b.w * 0.5) - (player.x + player.w * 0.5),
          (b.y + b.h * 0.5) - (player.y + player.h * 0.5)
        );
        if (!b.isHeld && !b.isShattered && bottleDist < 48) {
          promptText = 'PICK UP BOTTLE';
          targetX = b.x + b.w * 0.5;
          targetY = b.y - 15;
          break;
        }
      }
    }

    // Update Interact Prompt visibility & position
    if (promptText && !player.isDead) {
      const screenPos = camera.worldToScreen(targetX, targetY);
      this.interactPrompt.classList.remove('hidden');
      this.interactPrompt.style.left = `${screenPos.x}px`;
      this.interactPrompt.style.top = `${screenPos.y}px`;
      this.interactText.textContent = promptText;
    } else {
      this.interactPrompt.classList.add('hidden');
    }

    // Update Throw Hint visibility
    if (player.heldItem && !player.isDead) {
      this.throwHint.classList.remove('hidden');
    } else {
      this.throwHint.classList.add('hidden');
    }

    // Update Stealth Hiding Indicator
    const stealthEl = document.getElementById('stealth-indicator');
    if (stealthEl) {
      if (player.isHiding && !player.isDead) {
        stealthEl.classList.remove('hidden');
      } else {
        stealthEl.classList.add('hidden');
      }
    }
  }

  // Render Aiming Ballistic Trajectory Arc when holding bottle
  renderAimArc(ctx, player, camera, input) {
    if (!player.heldItem || player.isDead) return;

    const startX = player.x + player.w * 0.5;
    const startY = player.y + player.h * 0.4;
    const mouseWorld = camera.screenToWorld(input.mouse.x, input.mouse.y);

    const dx = mouseWorld.x - startX;
    const dy = mouseWorld.y - startY;
    const dist = Math.hypot(dx, dy) || 1;
    const power = Math.min(520, Math.max(220, dist * 1.5));

    let simX = startX;
    let simY = startY;
    let simVx = (dx / dist) * power;
    let simVy = (dy / dist) * power - 120;
    const simDt = 0.035;

    ctx.save();
    ctx.strokeStyle = 'rgba(229, 169, 59, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(simX, simY);

    for (let i = 0; i < 24; i++) {
      simVy += 850 * simDt;
      simX += simVx * simDt;
      simY += simVy * simDt;
      ctx.lineTo(simX, simY);
    }
    ctx.stroke();

    // Trajectory impact ring
    ctx.fillStyle = 'rgba(229, 169, 59, 0.7)';
    ctx.beginPath();
    ctx.arc(simX, simY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
