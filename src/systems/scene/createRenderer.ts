import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'

export function createRenderer(host: HTMLElement): WebGLRenderer {
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })

  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  /** Slightly higher exposure so scene reads bright and gameplay-readable (not murky). */
  renderer.toneMappingExposure = 1.22
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap

  renderer.domElement.style.display = 'block'
  /** Prepend so later HUD siblings paint above the canvas (appendChild hid HTML UI). */
  host.prepend(renderer.domElement)

  return renderer
}
