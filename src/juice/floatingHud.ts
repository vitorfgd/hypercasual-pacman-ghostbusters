import { FLOAT_TEXT_SEC } from './juiceConfig.ts'

export type FloatingHudTextOpts = {
  durationSec?: number
  leftPct?: number
  topPct?: number
}

/** Short-lived floating text in the viewport (e.g. +1, pickup toasts). */
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

const ROOM_ENTRY_SEC = 1.85

export function spawnRoomEntryBanner(
  viewport: HTMLElement,
  titleText: string,
  subtitleText: string,
): void {
  const el = document.createElement('div')
  el.className = 'room-entry-banner'
  el.setAttribute('aria-live', 'polite')

  const title = document.createElement('div')
  title.className = 'room-entry-banner__title'
  title.textContent = titleText

  const sub = document.createElement('div')
  sub.className = 'room-entry-banner__sub'
  sub.textContent = subtitleText

  el.append(title, sub)
  viewport.appendChild(el)
  requestAnimationFrame(() => {
    el.classList.add('room-entry-banner--show')
  })
  setTimeout(() => {
    el.classList.add('room-entry-banner--out')
    setTimeout(() => el.remove(), 280)
  }, ROOM_ENTRY_SEC * 1000)
}
