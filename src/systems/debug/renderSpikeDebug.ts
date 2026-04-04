import type { Object3D, Scene, WebGLRenderer } from 'three'

/**
 * Opt-in render diagnostics when tracking down GPU hitches (e.g. first Corridor→Room1 frame).
 *
 * In the browser console:
 *   window.__renderSpikeDebug = true
 * Optional: window.__renderSpikeDebugMinMs = 30   // only log when render() exceeds this many ms
 *
 * Each slow frame logs: Three.js draw stats, scene mesh/light counts, canvas size, GL hints.
 * Combine with Chrome Performance → Record, or about:gpu (Chrome) for driver info.
 */

export type RenderSpikeDebugWindow = Window & {
  __renderSpikeDebug?: boolean
  __renderSpikeDebugMinMs?: number
}

export function getRenderSpikeDebugMinMs(): number {
  if (typeof window === 'undefined') return Infinity
  const w = window as RenderSpikeDebugWindow
  return Math.max(1, w.__renderSpikeDebugMinMs ?? 16)
}

export function isRenderSpikeDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return (window as RenderSpikeDebugWindow).__renderSpikeDebug === true
}

export type RenderSpikeContext = {
  renderMs: number
  area: string | null
  room: string | null
}

/**
 * Call once per frame after `renderer.render` when timing is known.
 */
export function maybeLogRenderSpikeDiagnostics(
  renderer: WebGLRenderer,
  scene: Scene,
  ctx: RenderSpikeContext,
): void {
  if (!isRenderSpikeDebugEnabled()) return
  if (ctx.renderMs < getRenderSpikeDebugMinMs()) return

  /** Runtime `Info.render` has `drawCalls` / `frameCalls`; older typings may omit them. */
  const r = renderer.info.render as {
    calls: number
    drawCalls?: number
    frameCalls?: number
    triangles: number
    lines: number
    points: number
  }
  let meshes = 0
  let skinned = 0
  let lights = 0
  let shadowLights = 0
  let maxShadowMap = 0
  scene.traverse((o: Object3D) => {
    const obj = o as Object3D & { isSkinnedMesh?: boolean; isMesh?: boolean }
    if (obj.isSkinnedMesh) {
      skinned++
      meshes++
    } else if (obj.isMesh) {
      meshes++
    }
    if ('isLight' in o && (o as { isLight?: boolean }).isLight) {
      lights++
      if (o.castShadow) {
        shadowLights++
        const sh = (o as { shadow?: { mapSize?: { x: number; y: number } } }).shadow
        const ms = sh?.mapSize
        if (ms) maxShadowMap = Math.max(maxShadowMap, ms.x, ms.y)
      }
    }
  })

  const gl = renderer.getContext() as WebGL2RenderingContext
  let unmaskedVendor: string | null = null
  let unmaskedRenderer: string | null = null
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (ext) {
      unmaskedVendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)
      unmaskedRenderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
    }
  } catch {
    /* blocked or unavailable */
  }

  const parallelShader =
    gl.getExtension('KHR_parallel_shader_compile') !== null
  const loseCtx = gl.getExtension('WEBGL_lose_context') !== null

  const err = gl.getError()
  const dom = renderer.domElement

  console.warn('[render spike debug] slow frame', {
    renderMs: Number(ctx.renderMs.toFixed(2)),
    area: ctx.area,
    room: ctx.room,
    three: {
      drawCalls: r.drawCalls ?? r.calls,
      triangles: r.triangles,
      lines: r.lines,
      points: r.points,
      frameCalls: r.frameCalls,
    },
    memory: { ...renderer.info.memory },
    scene: {
      meshes,
      skinnedMeshes: skinned,
      lights,
      shadowCastingLights: shadowLights,
      maxShadowMapSize: maxShadowMap || null,
    },
    canvas: {
      pixelRatio: renderer.getPixelRatio(),
      width: dom.width,
      height: dom.height,
      clientWidth: dom.clientWidth,
      clientHeight: dom.clientHeight,
    },
    renderer: {
      toneMapping: renderer.toneMapping,
      outputColorSpace: String(renderer.outputColorSpace),
      shadows: renderer.shadowMap.enabled,
      shadowType: renderer.shadowMap.type,
      antialias: gl.getContextAttributes()?.antialias ?? null,
    },
    gl: {
      vendor: unmaskedVendor,
      renderer: unmaskedRenderer,
      parallelShaderCompile: parallelShader,
      loseContextExtension: loseCtx,
      errorAfterRender: err,
    },
    hints: [
      'If drawCalls/triangles jump only on this frame, something new entered the frustum or became visible.',
      'If renderMs is huge but three drawCalls is modest, suspect shader compile (first use) or driver stall — try Performance panel → Main + GPU, or disable shadows (PCFSoft) temporarily.',
      'Skinned meshes: first frame after visible can compile skinning variants.',
    ],
  })
}
