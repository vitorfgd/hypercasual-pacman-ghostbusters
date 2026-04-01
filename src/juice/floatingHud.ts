import { FLOAT_TEXT_SEC } from './juiceConfig.ts'

export type FloatingHudTextOpts = {
  durationSec?: number
  leftPct?: number
  topPct?: number
}

/** Short-lived floating text in the viewport (e.g. +1, +$4). */
export function spawnFloatingHudText(
  viewport: HTMLElement,
  text: string,
  className: string,
  opts?: FloatingHudTextOpts,
): void {
  const dur = opts?.durationSec ?? FLOAT_TEXT_SEC
  const left =
    opts?.leftPct !== undefined
      ? opts.leftPct
      : 42 + Math.random() * 16
  const top =
    opts?.topPct !== undefined
      ? opts.topPct
      : 38 + Math.random() * 10
  const el = document.createElement('div')
  el.className = `float-hud ${className}`
  el.textContent = text
  el.style.left = `${left}%`
  el.style.top = `${top}%`
  viewport.appendChild(el)
  requestAnimationFrame(() => {
    el.classList.add('float-hud--show')
  })
  setTimeout(() => {
    el.classList.add('float-hud--out')
    setTimeout(() => el.remove(), 220)
  }, dur * 1000)
}
