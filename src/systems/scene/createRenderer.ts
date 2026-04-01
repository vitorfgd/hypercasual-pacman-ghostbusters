import {
  ACESFilmicToneMapping,
  PCFShadowMap,
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
  renderer.toneMappingExposure = 1.12
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap

  renderer.domElement.style.display = 'block'
  /** Prepend so later HUD siblings paint above the canvas (appendChild hid HTML UI). */
  host.prepend(renderer.domElement)

  return renderer
}
