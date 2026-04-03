/**
 * Full-screen summary when the player clears the final boss encounter.
 */

export type RunSuccessStats = {
  roomsCleared: number
  clutterCollected: number
  money: number
  timeSec: number
  upgrades: readonly { title: string }[]
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m <= 0) return `${r}s`
  return `${m}m ${r.toString().padStart(2, '0')}s`
}

export function showRunSuccessOverlay(
  host: HTMLElement,
  stats: RunSuccessStats,
  opts: {
    onContinue: () => void
  },
): () => void {
  const el = document.createElement('div')
  el.className = 'run-success-overlay'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'true')
  el.setAttribute('aria-label', 'Run complete')

  const backdrop = document.createElement('div')
  backdrop.className = 'run-success-overlay__backdrop'

  const panel = document.createElement('div')
  panel.className = 'run-success-overlay__panel'

  const title = document.createElement('h2')
  title.className = 'run-success-overlay__title'
  title.textContent = 'Run Complete'

  const sub = document.createElement('p')
  sub.className = 'run-success-overlay__sub'
  sub.textContent = 'You survived the final haunt.'

  const statsBlock = document.createElement('div')
  statsBlock.className = 'run-success-overlay__stats'

  const row = (label: string, value: string): void => {
    const wrap = document.createElement('div')
    wrap.className = 'run-success-overlay__stat'
    const lb = document.createElement('span')
    lb.className = 'run-success-overlay__stat-label'
    lb.textContent = label
    const val = document.createElement('span')
    val.className = 'run-success-overlay__stat-value'
    val.textContent = value
    wrap.append(lb, val)
    statsBlock.appendChild(wrap)
  }

  row('Rooms cleared', String(stats.roomsCleared))
  row('Clutter collected', String(stats.clutterCollected))
  row('Money earned', `$${stats.money}`)
  row('Time', formatTime(stats.timeSec))

  const upTitle = document.createElement('div')
  upTitle.className = 'run-success-overlay__upgrades-title'
  upTitle.textContent = 'Upgrades chosen'

  const upList = document.createElement('ul')
  upList.className = 'run-success-overlay__upgrades'
  if (stats.upgrades.length === 0) {
    const li = document.createElement('li')
    li.className =
      'run-success-overlay__upgrade run-success-overlay__upgrade--empty'
    li.textContent = 'None this run'
    upList.appendChild(li)
  } else {
    for (const u of stats.upgrades) {
      const li = document.createElement('li')
      li.className = 'run-success-overlay__upgrade'
      li.textContent = u.title
      upList.appendChild(li)
    }
  }

  const actions = document.createElement('div')
  actions.className = 'run-success-overlay__actions'

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'run-success-overlay__btn run-success-overlay__btn--primary'
  btn.textContent = 'Continue'

  btn.addEventListener('click', () => {
    opts.onContinue()
  })

  actions.appendChild(btn)

  panel.append(title, sub, statsBlock, upTitle, upList, actions)
  el.append(backdrop, panel)
  host.appendChild(el)
  requestAnimationFrame(() => {
    el.classList.add('run-success-overlay--show')
    btn.focus()
  })

  return (): void => {
    el.classList.remove('run-success-overlay--show')
    setTimeout(() => el.remove(), 320)
  }
}
