/**
 * Full-viewport confetti + centered celebration copy (DOM overlay on `#game-viewport`).
 */

const CONFETTI_COUNT = 64
const CONFETTI_DURATION_MS = 3200

const CONFETTI_COLORS = [
  '#ff6b9d',
  '#ffd93d',
  '#6bcb77',
  '#4d96ff',
  '#c084fc',
  '#ff922b',
  '#ffec99',
  '#38bdf8',
]

export function spawnConfettiBurst(viewport: HTMLElement): void {
  const layer = document.createElement('div')
  layer.className = 'juice-confetti-layer'
  layer.setAttribute('aria-hidden', 'true')

  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const p = document.createElement('div')
    p.className = 'juice-confetti-piece'
    const w = 5 + Math.random() * 9
    const h = 7 + Math.random() * 11
    const left = Math.random() * 100
    const delay = Math.random() * 0.55
    const dur = 2.1 + Math.random() * 1.35
    const dx = (Math.random() - 0.5) * 180
    const rot = 360 + Math.random() * 1080
    p.style.width = `${w}px`
    p.style.height = `${h}px`
    p.style.left = `${left}%`
    p.style.top = `${-6 - Math.random() * 14}%`
    p.style.backgroundColor =
      CONFETTI_COLORS[i % CONFETTI_COLORS.length]!
    p.style.animationDuration = `${dur}s`
    p.style.animationDelay = `${delay}s`
    p.style.setProperty('--cf-dx', `${dx}px`)
    p.style.setProperty('--cf-rot', `${rot}deg`)
    layer.appendChild(p)
  }

  viewport.appendChild(layer)
  window.setTimeout(() => layer.remove(), CONFETTI_DURATION_MS)
}

const CELEBRATION_SHOW_MS = 3200

function showCelebrationBlock(
  viewport: HTMLElement,
  title: string,
  subtitle: string,
): void {
  const wrap = document.createElement('div')
  wrap.className = 'float-hud float-hud--celebration-wrap'
  wrap.setAttribute('aria-live', 'polite')

  const t = document.createElement('div')
  t.className = 'float-hud--celebration-title'
  t.textContent = title

  const s = document.createElement('div')
  s.className = 'float-hud--celebration-sub'
  s.textContent = subtitle

  wrap.appendChild(t)
  wrap.appendChild(s)
  wrap.style.left = '50%'
  wrap.style.top = 'clamp(22%, 28vh, 34%)'
  viewport.appendChild(wrap)
  requestAnimationFrame(() => wrap.classList.add('float-hud--show'))
  window.setTimeout(() => {
    wrap.classList.add('float-hud--out')
    window.setTimeout(() => wrap.remove(), 240)
  }, CELEBRATION_SHOW_MS)
}

/** Hub deposit quest (relic + gems) finished. */
export function celebrateHubQuestComplete(viewport: HTMLElement): void {
  spawnConfettiBurst(viewport)
  showCelebrationBlock(
    viewport,
    'Vault quest complete!',
    'You cashed in everything — stunning haul. Next quest unlocks soon!',
  )
}

/** Room objective (wisps / local goal) finished. */
export function celebrateRoomObjectiveComplete(
  viewport: HTMLElement,
  objectiveSummary: string,
): void {
  spawnConfettiBurst(viewport)
  showCelebrationBlock(
    viewport,
    'Room cleared!',
    `${objectiveSummary} — rewards are dropping in!`,
  )
}
