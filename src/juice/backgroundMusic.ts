import { publicAsset } from '../core/publicAsset.ts'

/** Track: Adrián Berenguer — Premiere (Creative Cut — Minimal). File in `public/`. */
const MUSIC_URL = publicAsset('premiere-minimal.mp3')

let audio: HTMLAudioElement | null = null
let pendingResume: (() => void) | null = null

function detachResume(): void {
  if (!pendingResume) return
  window.removeEventListener('pointerdown', pendingResume)
  window.removeEventListener('keydown', pendingResume)
  pendingResume = null
}

function tryPlay(): void {
  if (!audio) return
  void audio.play().catch(() => {
    detachResume()
    pendingResume = () => {
      detachResume()
      void audio?.play().catch(() => {})
    }
    window.addEventListener('pointerdown', pendingResume)
    window.addEventListener('keydown', pendingResume)
  })
}

/**
 * Starts looping background music. Safe to call once; repeats are no-ops.
 * Browsers may block autoplay until the user interacts — we retry on first pointer/key.
 */
export function startBackgroundMusic(): void {
  if (audio) {
    tryPlay()
    return
  }
  audio = new Audio(MUSIC_URL)
  audio.loop = true
  audio.preload = 'auto'
  audio.volume = 0.22
  tryPlay()
}

export function stopBackgroundMusic(): void {
  detachResume()
  if (!audio) return
  audio.pause()
  audio.currentTime = 0
  audio = null
}
