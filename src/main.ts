import './style.css'
import { startBackgroundMusic, stopBackgroundMusic } from './juice/backgroundMusic.ts'
import { mountGame } from './systems/bootstrap/mountGame.ts'

const host = document.querySelector<HTMLElement>('#game-viewport')
if (!host) {
  throw new Error('#game-viewport missing from index.html')
}

const loading = document.querySelector<HTMLElement>('#game-loading')
loading?.classList.add('game-loading--on')
loading?.setAttribute('aria-hidden', 'false')

let game: Awaited<ReturnType<typeof mountGame>> | undefined

async function mountGameWithRetry(): Promise<void> {
  game?.dispose()
  game = await mountGame(host as HTMLElement, {
    onRunFailedRetry: mountGameWithRetry,
  })
}

try {
  startBackgroundMusic()
  await mountGameWithRetry()
} finally {
  loading?.classList.remove('game-loading--on')
  loading?.setAttribute('aria-hidden', 'true')
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game?.dispose()
    stopBackgroundMusic()
  })
}
