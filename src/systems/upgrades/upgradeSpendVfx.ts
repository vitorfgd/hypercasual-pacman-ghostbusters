import type { PerspectiveCamera } from 'three'
import { Vector3 } from 'three'

/**
 * Lightweight DOM markers that lerp from the money HUD toward a projected pad position.
 * No gameplay state — purely cosmetic.
 */
export function spawnUpgradeSpendCoins(
  viewportEl: HTMLElement,
  camera: PerspectiveCamera,
  cost: number,
  padWorld: Vector3,
): void {
  const hudMoney = viewportEl.querySelector<HTMLElement>('#hud-money')
  if (!hudMoney) return

  const vp = viewportEl.getBoundingClientRect()
  const r = hudMoney.getBoundingClientRect()
  const fromX = r.left + r.width * 0.5 - vp.left
  const fromY = r.top + r.height * 0.5 - vp.top

  const v = padWorld.clone().project(camera)
  const toX = (v.x * 0.5 + 0.5) * vp.width
  const toY = (-v.y * 0.5 + 0.5) * vp.height

  const n = Math.min(8, Math.max(2, Math.ceil(cost / 22)))

  for (let i = 0; i < n; i++) {
    const el = document.createElement('div')
    el.className = 'fly-coin'
    el.setAttribute('aria-hidden', 'true')
    el.style.left = `${fromX}px`
    el.style.top = `${fromY}px`
    viewportEl.appendChild(el)

    const ox = (i - n * 0.5) * 6
    const oy = (i % 3) * 5
    requestAnimationFrame(() => {
      el.style.transform = `translate(calc(${toX - fromX + ox}px), calc(${toY - fromY + oy}px)) scale(0.45)`
      el.style.opacity = '0.15'
    })

    window.setTimeout(() => {
      el.remove()
    }, 520 + i * 45)
  }
}
