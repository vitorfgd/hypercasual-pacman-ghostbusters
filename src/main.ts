import './style.css'
import { mountGame } from './systems/bootstrap/mountGame.ts'

const host = document.querySelector<HTMLElement>('#game-viewport')
if (!host) {
  throw new Error('#game-viewport missing from index.html')
}

const game = await mountGame(host)

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose())
}
