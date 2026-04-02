import './style.css'
import { startBackgroundMusic } from './juice/backgroundMusic.ts'
import { mountGame } from './systems/bootstrap/mountGame.ts'

const host = document.querySelector<HTMLElement>('#game-viewport')
if (!host) {
  throw new Error('#game-viewport missing from index.html')
}

startBackgroundMusic()
const game = await mountGame(host)

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose())
}
