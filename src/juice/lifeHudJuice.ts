/**
 * Grand feedback when a life is lost or the run ends.
 */

/** Full-viewport life loss: −1 heart, dramatic scale + chromatic feel via CSS. */
export function spawnLifeLostImpact(host: HTMLElement): void {
  const wrap = document.createElement('div')
  wrap.className = 'life-lost-impact'
  wrap.setAttribute('aria-hidden', 'true')

  const heart = document.createElement('div')
  heart.className = 'life-lost-impact__heart'
  heart.textContent = '♥'

  const minus = document.createElement('div')
  minus.className = 'life-lost-impact__minus'
  minus.textContent = '−1'

  wrap.append(heart, minus)
  host.appendChild(wrap)
  requestAnimationFrame(() => {
    wrap.classList.add('life-lost-impact--show')
  })
  setTimeout(() => {
    wrap.classList.add('life-lost-impact--out')
    setTimeout(() => wrap.remove(), 480)
  }, 1480)
}

export function showGameOverOverlay(
  host: HTMLElement,
  onRetry: () => void,
): () => void {
  const el = document.createElement('div')
  el.className = 'game-over-overlay'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'true')
  el.setAttribute('aria-label', 'Game over')

  const backdrop = document.createElement('div')
  backdrop.className = 'game-over-overlay__backdrop'

  const panel = document.createElement('div')
  panel.className = 'game-over-overlay__panel'

  const skull = document.createElement('div')
  skull.className = 'game-over-overlay__glyph'
  skull.textContent = '☠'
  skull.setAttribute('aria-hidden', 'true')

  const title = document.createElement('h2')
  title.className = 'game-over-overlay__title'
  title.textContent = 'GAME OVER'

  const sub = document.createElement('p')
  sub.className = 'game-over-overlay__sub'
  sub.textContent = 'The ghosts took everything — even your last breath.'

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'game-over-overlay__retry'
  btn.textContent = 'TRY AGAIN'

  const cleanup = (): void => {
    el.remove()
  }

  btn.addEventListener('click', () => {
    cleanup()
    onRetry()
  })

  panel.append(skull, title, sub, btn)
  el.append(backdrop, panel)
  host.appendChild(el)
  requestAnimationFrame(() => {
    el.classList.add('game-over-overlay--show')
  })

  return cleanup
}
