import type { PerspectiveCamera } from 'three'
import type { WebGLRenderer } from 'three'

export function getPixelRatio(): number {
  return Math.min(window.devicePixelRatio, 1.5)
}

export function updateViewportSize(
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
  host: HTMLElement,
): void {
  const w = host.clientWidth
  const h = host.clientHeight
  if (w === 0 || h === 0) return

  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(getPixelRatio())
  renderer.setSize(w, h, false)
}

export function subscribeViewportResize(
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
  host: HTMLElement,
): () => void {
  const apply = () => updateViewportSize(camera, renderer, host)

  const ro = new ResizeObserver(apply)
  ro.observe(host)
  window.addEventListener('orientationchange', apply)

  apply()

  return () => {
    ro.disconnect()
    window.removeEventListener('orientationchange', apply)
  }
}
