// =========================================================================
// Input.js - Robust Multi-Device Input System with Gamepad & Buffering
// =========================================================================

export class Input {
  constructor() {
    this.keys = new Map();
    this.prevKeys = new Map();
    this.mouse = { x: 0, y: 0, isDown: false, justPressed: false, justReleased: false };

    // Jump buffer timer
    this.jumpBufferTimer = 0;
    this.JUMP_BUFFER_DURATION = 0.14; // 140ms buffer window

    // Action mappings
    this.actions = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      jumpJustPressed: false,
      jumpJustReleased: false,
      crouch: false,
      sprint: false,
      interact: false,
      interactJustPressed: false,
      lighter: false,
      lighterJustPressed: false,
      throw: false,
      pause: false,
      pauseJustPressed: false
    };

    this.gamepadIndex = null;

    // Mobile touch controls state
    this.touchState = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      jumpJustReleased: false,
      crouch: false,
      sprint: false,
      interact: false,
      interactJustPressed: false,
      lighterJustPressed: false,
      throw: false
    };

    this.lastInputWasTouch = false;

    this.initListeners();
  }

  setTouchAction(action, isDown) {
    this.lastInputWasTouch = true;
    if (action === 'left') this.touchState.left = isDown;
    if (action === 'right') this.touchState.right = isDown;
    if (action === 'up') this.touchState.up = isDown;
    if (action === 'down') this.touchState.down = isDown;
    if (action === 'crouch') this.touchState.crouch = isDown;
    if (action === 'sprint') this.touchState.sprint = isDown;
    if (action === 'interact') {
      if (isDown && !this.touchState.interact) {
        this.touchState.interactJustPressed = true;
      }
      this.touchState.interact = isDown;
    }
    if (action === 'jump') {
      if (isDown && !this.touchState.jump) {
        this.jumpBufferTimer = this.JUMP_BUFFER_DURATION;
      }
      if (!isDown && this.touchState.jump) {
        this.touchState.jumpJustReleased = true;
      }
      this.touchState.jump = isDown;
    }
    if (action === 'lighter' && isDown) {
      this.touchState.lighterJustPressed = true;
    }
    if (action === 'throw' && isDown) {
      this.touchState.throw = true;
    }
  }

  initListeners() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      // Prevent default browser scrolling on arrow keys & space
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      this.keys.set(e.code, true);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.set(e.code, false);
    });

    window.addEventListener('mousemove', (e) => {
      this.lastInputWasTouch = false;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
      this.lastInputWasTouch = false;
      if (e.button === 0) {
        this.mouse.isDown = true;
        this.mouse.justPressed = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouse.isDown = false;
        this.mouse.justReleased = true;
      }
    });

    window.addEventListener('gamepadconnected', (e) => {
      console.log('Gamepad connected:', e.gamepad.id);
      this.gamepadIndex = e.gamepad.index;
    });

    window.addEventListener('gamepaddisconnected', () => {
      console.log('Gamepad disconnected');
      this.gamepadIndex = null;
    });
  }

  isKeyDown(code) {
    return !!this.keys.get(code);
  }

  isKeyJustPressed(code) {
    return !!this.keys.get(code) && !this.prevKeys.get(code);
  }

  isKeyJustReleased(code) {
    return !this.keys.get(code) && !!this.prevKeys.get(code);
  }

  update(dt) {
    // Poll Gamepad if present
    let gpLeft = false, gpRight = false, gpUp = false, gpDown = false;
    let gpJump = false, gpCrouch = false, gpSprint = false;
    let gpInteract = false, gpLighter = false, gpPause = false;

    if (this.gamepadIndex !== null && navigator.getGamepads) {
      const gp = navigator.getGamepads()[this.gamepadIndex];
      if (gp) {
        const deadzone = 0.25;
        const stickX = gp.axes[0];
        const stickY = gp.axes[1];

        if (stickX < -deadzone || gp.buttons[14]?.pressed) gpLeft = true;
        if (stickX > deadzone || gp.buttons[15]?.pressed) gpRight = true;
        if (stickY < -deadzone || gp.buttons[12]?.pressed) gpUp = true;
        if (stickY > deadzone || gp.buttons[13]?.pressed) gpDown = true;

        gpJump = !!gp.buttons[0]?.pressed; // A / Cross
        gpCrouch = !!gp.buttons[1]?.pressed || stickY > 0.6; // B / Circle
        gpInteract = !!gp.buttons[2]?.pressed || !!gp.buttons[7]?.pressed; // X / Square / RT
        gpSprint = !!gp.buttons[4]?.pressed || !!gp.buttons[10]?.pressed; // LB / L3
        gpLighter = !!gp.buttons[5]?.pressed || !!gp.buttons[6]?.pressed; // RB / LT
        gpPause = !!gp.buttons[9]?.pressed; // Start
      }
    }

    // Keyboard, Gamepad & Touch mappings
    const kLeft = this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft') || gpLeft || this.touchState.left;
    const kRight = this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight') || gpRight || this.touchState.right;
    const kUp = this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp') || gpUp || this.touchState.up;
    const kDown = this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown') || gpDown || this.touchState.down;

    const prevJump = this.actions.jump;
    const rawJump = this.isKeyDown('Space') || this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp') || gpJump || this.touchState.jump;
    const rawJumpPressed = (!prevJump && rawJump) || this.isKeyJustPressed('Space') || this.isKeyJustPressed('KeyW') || this.isKeyJustPressed('ArrowUp');
    const rawJumpReleased = (prevJump && !rawJump) || this.touchState.jumpJustReleased || this.isKeyJustReleased('Space') || this.isKeyJustReleased('KeyW') || this.isKeyJustReleased('ArrowUp');

    const kCrouch = this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown') || this.isKeyDown('KeyC') || gpCrouch || this.touchState.crouch;
    const kSprint = this.isKeyDown('ShiftLeft') || this.isKeyDown('ShiftRight') || gpSprint || this.touchState.sprint;

    const kInteract = this.isKeyDown('KeyE') || this.isKeyDown('ControlLeft') || gpInteract || this.touchState.interact;
    const kInteractPressed = this.isKeyJustPressed('KeyE') || this.isKeyJustPressed('ControlLeft') || this.touchState.interactJustPressed;

    const kLighterPressed = this.isKeyJustPressed('KeyF') || this.isKeyJustPressed('KeyL') || this.isKeyJustPressed('KeyQ') || this.touchState.lighterJustPressed;
    const kPausePressed = this.isKeyJustPressed('Escape') || this.isKeyJustPressed('KeyP') || gpPause;

    // Jump Buffering: store intent for a fraction of a second
    if (rawJumpPressed) {
      this.jumpBufferTimer = this.JUMP_BUFFER_DURATION;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    this.actions.left = kLeft;
    this.actions.right = kRight;
    this.actions.up = kUp;
    this.actions.down = kDown;
    this.actions.jump = rawJump;
    this.actions.jumpJustPressed = rawJumpPressed || (this.jumpBufferTimer > 0);
    this.actions.jumpJustReleased = rawJumpReleased;
    this.actions.crouch = kCrouch;
    this.actions.sprint = kSprint;
    this.actions.interact = kInteract;
    this.actions.interactJustPressed = kInteractPressed;
    this.actions.lighterJustPressed = kLighterPressed || (gpLighter && !this.actions.lighter);
    this.actions.lighter = kLighterPressed || gpLighter || this.touchState.lighterJustPressed;
    this.actions.throw = this.mouse.justPressed || this.touchState.throw;
    this.actions.pauseJustPressed = kPausePressed;

    // Clear one-shot touch flags
    this.touchState.jumpJustReleased = false;
    this.touchState.interactJustPressed = false;
    this.touchState.lighterJustPressed = false;
    this.touchState.throw = false;

    // Copy current state to prevKeys
    this.prevKeys = new Map(this.keys);
    this.mouse.justPressed = false;
    this.mouse.justReleased = false;
  }

  consumeJumpBuffer() {
    this.jumpBufferTimer = 0;
    this.actions.jumpJustPressed = false;
  }
}
