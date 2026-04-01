import type { JoystickVector } from './TouchJoystick.ts'

/** Physical keys — layout-independent (QWERTY / AZERTY friendly for WASD positions). */
const MOVE_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
])

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const t = target.tagName
  return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT'
}

/**
 * WASD + arrow keys, same axis convention as {@link TouchJoystick} (y screen-down → world +Z).
 */
export class KeyboardMoveInput {
  private readonly keys = new Set<string>()

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  getVector(): JoystickVector {
    let x = 0
    let y = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1
    const mag = Math.hypot(x, y)
    if (mag > 1e-6) {
      x /= mag
      y /= mag
    }
    const fingerDown = mag > 1e-6
    return { x, y, fingerDown, active: fingerDown }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.keys.clear()
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (isTypingTarget(e.target)) return
    if (!MOVE_CODES.has(e.code)) return
    e.preventDefault()
    this.keys.add(e.code)
  }

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (!MOVE_CODES.has(e.code)) return
    this.keys.delete(e.code)
  }

  private readonly onBlur = (): void => {
    this.keys.clear()
  }
}

/** Prefer keyboard when any movement key is held; otherwise touch / mouse joystick. */
export function mergeMoveInput(
  touch: JoystickVector,
  keys: JoystickVector,
): JoystickVector {
  return keys.fingerDown ? keys : touch
}
