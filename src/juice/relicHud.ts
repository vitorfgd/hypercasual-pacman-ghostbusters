import { spawnFloatingHudText } from './floatingHud.ts'

/** Banner when a new relic lands in a room. */
export function showRelicSpawnedBanner(viewport: HTMLElement): void {
  spawnFloatingHudText(
    viewport,
    'Rare relic appeared — follow the arrow!',
    'float-hud--relic-spawn',
    { durationSec: 2.85, leftPct: 50, topPct: 18 },
  )
}

const RELIC_BANKED_SEC = 3.4

/**
 * Large centered celebration after the relic is **deposited** (vault / collect zone).
 */
export function showRelicBankedCelebration(
  viewport: HTMLElement,
  value: number,
): void {
  const wrap = document.createElement('div')
  wrap.className = 'float-hud float-hud--relic-banked-wrap'
  wrap.setAttribute('aria-live', 'polite')

  const title = document.createElement('div')
  title.className = 'float-hud--relic-banked-title'
  title.textContent = 'RELIC SECURED!'

  const sub = document.createElement('div')
  sub.className = 'float-hud--relic-banked-sub'
  sub.textContent = `+$${value} credited · Safe in the vault`

  wrap.appendChild(title)
  wrap.appendChild(sub)
  wrap.style.left = '50%'
  wrap.style.top = 'clamp(26%, 30vh, 36%)'
  viewport.appendChild(wrap)
  requestAnimationFrame(() => wrap.classList.add('float-hud--show'))
  window.setTimeout(() => {
    wrap.classList.add('float-hud--out')
    window.setTimeout(() => wrap.remove(), 220)
  }, RELIC_BANKED_SEC * 1000)
}

/** Short hint when the relic is picked up (carry to deposit). */
export function showRelicPickupHint(viewport: HTMLElement): void {
  spawnFloatingHudText(
    viewport,
    'Relic acquired — deposit at the gold circle',
    'float-hud--relic-pickup-hint',
    { durationSec: 2.2, leftPct: 50, topPct: 34 },
  )
}

/** Brief gold sparkles at screen center (DOM). */
export function spawnRelicScreenSparkBurst(viewport: HTMLElement): void {
  const n = 16
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div')
    d.className = 'relic-spark'
    d.setAttribute('aria-hidden', 'true')
    d.style.left = `${48 + (Math.random() - 0.5) * 10}%`
    d.style.top = `${34 + (Math.random() - 0.5) * 8}%`
    const dx = (Math.random() - 0.5) * 120
    const dy = -40 - Math.random() * 90
    d.style.setProperty('--sx', `${dx}px`)
    d.style.setProperty('--sy', `${dy}px`)
    viewport.appendChild(d)
    requestAnimationFrame(() => d.classList.add('relic-spark--burst'))
    window.setTimeout(() => d.remove(), 720)
  }
}
