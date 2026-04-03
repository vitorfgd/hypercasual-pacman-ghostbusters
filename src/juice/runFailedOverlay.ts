/**
 * Full-screen summary when the run ends (all lives lost).
 */

export type RunFailedStats = {
  roomsCleared: number
  wispsCollected: number
  /** Seconds survived this run */
  timeSec: number
  /** Each upgrade pick in order (titles may repeat if stacked). */
  upgrades: readonly { title: string }[]
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m <= 0) return `${r}s`
  return `${m}m ${r.toString().padStart(2, '0')}s`
}

export function showRunFailedOverlay(
  host: HTMLElement,
  stats: RunFailedStats,
  opts: {
    onRetry: () => void
    /** When omitted, no secondary button is shown. */
    onMainMenu?: () => void
  },
): () => void {
  const el = document.createElement('div')
  el.className = 'run-failed-overlay'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'true')
  el.setAttribute('aria-label', 'Run failed')

  const backdrop = document.createElement('div')
  backdrop.className = 'run-failed-overlay__backdrop'

  const panel = document.createElement('div')
  panel.className = 'run-failed-overlay__panel'

  const title = document.createElement('h2')
  title.className = 'run-failed-overlay__title'
  title.textContent = 'Run Failed'

  const statsBlock = document.createElement('div')
  statsBlock.className = 'run-failed-overlay__stats'

  const row = (label: string, value: string): void => {
    const wrap = document.createElement('div')
    wrap.className = 'run-failed-overlay__stat'
    const lb = document.createElement('span')
    lb.className = 'run-failed-overlay__stat-label'
    lb.textContent = label
    const val = document.createElement('span')
    val.className = 'run-failed-overlay__stat-value'
    val.textContent = value
    wrap.append(lb, val)
    statsBlock.appendChild(wrap)
  }

  row('Rooms cleared', String(stats.roomsCleared))
  row('Wisps collected', String(stats.wispsCollected))
  row('Time survived', formatTime(stats.timeSec))

  const upTitle = document.createElement('div')
  upTitle.className = 'run-failed-overlay__upgrades-title'
  upTitle.textContent = 'Upgrades chosen'

  const upList = document.createElement('ul')
  upList.className = 'run-failed-overlay__upgrades'
  if (stats.upgrades.length === 0) {
    const li = document.createElement('li')
    li.className = 'run-failed-overlay__upgrade run-failed-overlay__upgrade--empty'
    li.textContent = 'None this run'
    upList.appendChild(li)
  } else {
    for (const u of stats.upgrades) {
      const li = document.createElement('li')
      li.className = 'run-failed-overlay__upgrade'
      li.textContent = u.title
      upList.appendChild(li)
    }
  }

  const actions = document.createElement('div')
  actions.className = 'run-failed-overlay__actions'

  const retry = document.createElement('button')
  retry.type = 'button'
  retry.className = 'run-failed-overlay__btn run-failed-overlay__btn--primary'
  retry.textContent = 'Retry'

  retry.addEventListener('click', () => {
    opts.onRetry()
  })

  actions.appendChild(retry)

  if (opts.onMainMenu) {
    const menu = document.createElement('button')
    menu.type = 'button'
    menu.className = 'run-failed-overlay__btn run-failed-overlay__btn--secondary'
    menu.textContent = 'Main Menu'
    menu.addEventListener('click', () => {
      opts.onMainMenu?.()
    })
    actions.appendChild(menu)
  }

  panel.append(title, statsBlock, upTitle, upList, actions)
  el.append(backdrop, panel)
  host.appendChild(el)
  requestAnimationFrame(() => {
    el.classList.add('run-failed-overlay--show')
    retry.focus()
  })

  return (): void => {
    el.classList.remove('run-failed-overlay--show')
    setTimeout(() => el.remove(), 320)
  }
}
