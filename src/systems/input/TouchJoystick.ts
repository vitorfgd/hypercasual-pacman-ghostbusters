/**
 * Floating virtual joystick: first pointer on the surface sets the center;
 * drag defines direction; release stops. Pointer Events (touch + mouse).
 *
 * Polish: dead zone, smoothstep ramp, exponential smoothing on output for
 * finer aim without losing full speed at max deflection.
 */
export type JoystickVector = {
  x: number
  y: number
  /** True while pointer is down — use for movement (no coasting after release) */
  fingerDown: boolean
  /** True while output is still smoothing toward rest (e.g. character idle blend) */
  active: boolean
}

export type TouchJoystickOptions = {
  /** Max stick deflection in CSS pixels (scales output to ~[-1, 1]) */
  maxRadiusPx?: number
  /** Inner radius where output stays zero (reduces jitter / accidental drift) */
  deadZonePx?: number
  /** Output smoothing ~Hz (higher = snappier, lower = smoother) */
  outputSmoothingHz?: number
}

export class TouchJoystick {
  private readonly host: HTMLElement
  private readonly maxRadiusPx: number
  private readonly deadZonePx: number
  private readonly outputSmoothingHz: number
  private readonly feedback: HTMLDivElement
  private readonly ring: HTMLDivElement
  private readonly knob: HTMLDivElement

  private pointerId: number | null = null
  /** Center relative to host top-left */
  private originX = 0
  private originY = 0

  /** Raw target from pointer (-1..1), before smoothing */
  private rawX = 0
  private rawY = 0
  /** Smoothed output */
  private smoothX = 0
  private smoothY = 0
  private gestureActive = false
  private lastSmoothTime = 0

  constructor(host: HTMLElement, options: TouchJoystickOptions = {}) {
    this.host = host
    this.maxRadiusPx = options.maxRadiusPx ?? 64
    this.deadZonePx = options.deadZonePx ?? 14
    this.outputSmoothingHz = options.outputSmoothingHz ?? 14

    this.feedback = document.createElement('div')
    this.ring = document.createElement('div')
    this.knob = document.createElement('div')
    this.feedback.className = 'vj-feedback'
    this.ring.className = 'vj-ring'
    this.knob.className = 'vj-knob'
    this.feedback.appendChild(this.ring)
    this.feedback.appendChild(this.knob)
    this.host.appendChild(this.feedback)
    this.hideFeedback()

    this.host.addEventListener('pointerdown', this.onDown)
    this.host.addEventListener('pointermove', this.onMove)
    this.host.addEventListener('pointerup', this.onUp)
    this.host.addEventListener('pointercancel', this.onUp)
  }

  /** y is screen-down positive; map to world XZ in PlayerController */
  getVector(): JoystickVector {
    const now = performance.now()
    const dt =
      this.lastSmoothTime > 0
        ? Math.min(0.05, (now - this.lastSmoothTime) / 1000)
        : 0
    this.lastSmoothTime = now

    const tx = this.gestureActive ? this.rawX : 0
    const ty = this.gestureActive ? this.rawY : 0

    if (dt > 0) {
      const k = 1 - Math.exp(-this.outputSmoothingHz * dt)
      this.smoothX += (tx - this.smoothX) * k
      this.smoothY += (ty - this.smoothY) * k
    } else {
      this.smoothX = tx
      this.smoothY = ty
    }

    const active =
      this.gestureActive || Math.hypot(this.smoothX, this.smoothY) > 0.002
    return {
      x: this.smoothX,
      y: this.smoothY,
      fingerDown: this.gestureActive,
      active,
    }
  }

  dispose(): void {
    this.host.removeEventListener('pointerdown', this.onDown)
    this.host.removeEventListener('pointermove', this.onMove)
    this.host.removeEventListener('pointerup', this.onUp)
    this.host.removeEventListener('pointercancel', this.onUp)
    this.feedback.remove()
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return
    if (e.button !== 0 && e.pointerType === 'mouse') return

    this.pointerId = e.pointerId
    this.host.setPointerCapture(e.pointerId)

    const r = this.host.getBoundingClientRect()
    this.originX = e.clientX - r.left
    this.originY = e.clientY - r.top

    this.placeFeedback(this.originX, this.originY)
    this.updateFromClient(e.clientX, e.clientY, r)
    this.gestureActive = true
  }

  private readonly onMove = (e: PointerEvent): void => {
    if (this.pointerId !== e.pointerId) return
    const r = this.host.getBoundingClientRect()
    this.updateFromClient(e.clientX, e.clientY, r)
  }

  private readonly onUp = (e: PointerEvent): void => {
    if (this.pointerId !== e.pointerId) return
    this.endGesture(e.pointerId)
  }

  private endGesture(pointerId: number): void {
    if (this.pointerId === null) return
    try {
      this.host.releasePointerCapture(pointerId)
    } catch {
      /* already released */
    }
    this.pointerId = null
    this.rawX = 0
    this.rawY = 0
    this.gestureActive = false
    this.hideFeedback()
  }

  private updateFromClient(clientX: number, clientY: number, hostRect: DOMRect): void {
    const mx = clientX - hostRect.left
    const my = clientY - hostRect.top
    const dx = mx - this.originX
    const dy = my - this.originY
    const len = Math.hypot(dx, dy)

    const clamped = Math.min(len, this.maxRadiusPx)
    const kx = len > 1e-6 ? (dx / len) * clamped : 0
    const ky = len > 1e-6 ? (dy / len) * clamped : 0

    this.knob.style.left = `${this.originX + kx}px`
    this.knob.style.top = `${this.originY + ky}px`

    if (len < this.deadZonePx) {
      this.rawX = 0
      this.rawY = 0
      return
    }

    const usable = Math.max(1e-6, this.maxRadiusPx - this.deadZonePx)
    const effectiveLen = Math.min(len - this.deadZonePx, usable)
    let t = effectiveLen / usable
    t = t * t * (3 - 2 * t)
    const nx = (dx / len) * t
    const ny = (dy / len) * t
    this.rawX = nx
    this.rawY = ny
  }

  private placeFeedback(cx: number, cy: number): void {
    const half = this.maxRadiusPx
    this.ring.style.left = `${cx}px`
    this.ring.style.top = `${cy}px`
    this.ring.style.width = `${half * 2}px`
    this.ring.style.height = `${half * 2}px`
    this.ring.style.marginLeft = `${-half}px`
    this.ring.style.marginTop = `${-half}px`

    this.knob.style.left = `${cx}px`
    this.knob.style.top = `${cy}px`

    this.feedback.style.display = 'block'
  }

  private hideFeedback(): void {
    this.feedback.style.display = 'none'
  }
}
