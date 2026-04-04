import { FLOAT_TEXT_SEC } from './juiceConfig.ts'

export type FloatingHudTextOpts = {
  durationSec?: number
  leftPct?: number
  topPct?: number
  risePx?: number
}

/**
 * Warm the browser's first-use DOM/CSS path for HUD toasts before live gameplay starts.
 */
export function primeFloatingHudEffects(viewport: HTMLElement): void {
  const float = document.createElement('div')
  float.className = 'float-hud float-hud--pickup'
  float.textContent = '+1'
  float.style.left = '-9999px'
  float.style.top = '-9999px'

  const roomEntry = document.createElement('div')
  roomEntry.className = 'room-entry-banner room-entry-banner--fast'
  roomEntry.innerHTML =
    '<div class="room-entry-banner__title">Room</div><div class="room-entry-banner__sub">Ready</div>'
  roomEntry.style.left = '-9999px'
  roomEntry.style.top = '-9999px'

  const roomClear = document.createElement('div')
  roomClear.className = 'room-cleared-banner'
  roomClear.innerHTML =
    '<div class="room-cleared-banner__title">Clear</div><div class="room-cleared-banner__sub">Ready</div>'
  roomClear.style.left = '-9999px'
  roomClear.style.top = '-9999px'

  viewport.append(float, roomEntry, roomClear)
  requestAnimationFrame(() => {
    float.classList.add('float-hud--show')
    roomEntry.classList.add('room-entry-banner--show')
    roomClear.classList.add('room-cleared-banner--show')
    requestAnimationFrame(() => {
      float.remove()
      roomEntry.remove()
      roomClear.remove()
    })
  })
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
  if (opts?.risePx !== undefined) {
    el.style.setProperty('--float-rise-px', `${opts.risePx}px`)
  }
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
const ROOM_ENTRY_FAST_SEC = 1.2

export function spawnRoomEntryBanner(
  viewport: HTMLElement,
  titleText: string,
  subtitleText: string,
  opts?: { fast?: boolean; emphasis?: 'normal' | 'endless' | 'boss' },
): void {
  const el = document.createElement('div')
  el.className = 'room-entry-banner'
  if (opts?.fast) el.classList.add('room-entry-banner--fast')
  if (opts?.emphasis === 'endless') el.classList.add('room-entry-banner--endless')
  if (opts?.emphasis === 'boss') el.classList.add('room-entry-banner--boss')
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
  }, (opts?.fast ? ROOM_ENTRY_FAST_SEC : ROOM_ENTRY_SEC) * 1000)
}
