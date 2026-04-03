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

const BAG_FULL_BANNER_SEC = 2.55

/** Max-capacity warning: large two-line banner (stronger than generic float text). */
export function spawnBagFullBanner(viewport: HTMLElement): void {
  const el = document.createElement('div')
  el.className = 'float-hud float-hud--bag-full'
  el.style.left = '50%'
  el.style.top = '16%'

  const title = document.createElement('div')
  title.className = 'float-hud__bag-full-title'
  title.textContent = 'BAG FULL'

  const sub = document.createElement('div')
  sub.className = 'float-hud__bag-full-sub'
  sub.textContent = 'TOSS IT!'

  el.append(title, sub)
  viewport.appendChild(el)
  requestAnimationFrame(() => {
    el.classList.add('float-hud--show')
  })
  setTimeout(() => {
    el.classList.add('float-hud--out')
    setTimeout(() => el.remove(), 280)
  }, BAG_FULL_BANNER_SEC * 1000)
}

const ROOM_CLEARED_SEC = 3.15

/**
 * Full-viewport center: room clear + line matching the stat that leveled up.
 */
export function spawnRoomClearedBanner(
  viewport: HTMLElement,
  subtitle: string,
): void {
  const sub = subtitle
  const el = document.createElement('div')
  el.className = 'room-cleared-banner'
  el.setAttribute('aria-live', 'polite')

  const title = document.createElement('div')
  title.className = 'room-cleared-banner__title'
  title.textContent = 'ROOM CLEARED'

  const line = document.createElement('div')
  line.className = 'room-cleared-banner__sub'
  line.textContent = sub

  el.append(title, line)
  viewport.appendChild(el)
  requestAnimationFrame(() => {
    el.classList.add('room-cleared-banner--show')
  })
  setTimeout(() => {
    el.classList.add('room-cleared-banner--out')
    setTimeout(() => el.remove(), 380)
  }, ROOM_CLEARED_SEC * 1000)
}
