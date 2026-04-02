/** Hub BGM: served from `public/bgm-out-of-flux-together.mp3`. */
const BGM_URL = '/bgm-out-of-flux-together.mp3'
const BGM_VOLUME = 0.5

/**
 * Starts looping background music. Browsers often block autoplay until a user gesture;
 * we retry on first pointer or key press.
 */
export function startBackgroundMusic(): void {
  const audio = new Audio(BGM_URL)
  audio.loop = true
  audio.volume = BGM_VOLUME

  const tryPlay = (): void => {
    void audio.play().catch(() => {})
  }

  tryPlay()

  const unlock = (): void => {
    tryPlay()
    document.removeEventListener('pointerdown', unlock)
    document.removeEventListener('keydown', unlock)
  }
  document.addEventListener('pointerdown', unlock)
  document.addEventListener('keydown', unlock)
}
