import {
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'

export type UpgradePadWorldLabel = {
  mesh: Mesh
  redraw: (paid: number, cost: number, maxed: boolean) => void
  dispose: () => void
}

/** Fill overlay alpha for the progress layer (entire pad). */
const FILL_ALPHA = 0.4

/**
 * Door-style floor label: full-pad progress fill (bottom → up), upgrade name, huge $ remaining.
 */
export function createUpgradePadWorldLabel(
  innerW: number,
  innerD: number,
  upgradeTitle: string,
): UpgradePadWorldLabel {
  const aspect = innerW / Math.max(1e-6, innerD)
  const ch = 1400
  const cw = Math.round(ch * aspect)

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('2D canvas not available')
  }

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.flipY = true

  const draw = (paid: number, cost: number, maxed: boolean): void => {
    const w = canvas.width
    const h = canvas.height
    const remaining = maxed ? 0 : Math.max(0, cost - paid)
    const t = maxed || cost <= 0 ? 1 : Math.min(1, paid / cost)
    const fillH = h * t

    ctx.clearRect(0, 0, w, h)

    ctx.fillStyle = 'rgba(14, 24, 34, 0.94)'
    ctx.fillRect(0, 0, w, h)

    if (fillH > 1) {
      if (maxed) {
        const g = ctx.createLinearGradient(0, h - fillH, 0, h)
        g.addColorStop(0, `rgba(90, 160, 120, ${FILL_ALPHA})`)
        g.addColorStop(1, `rgba(130, 210, 170, ${FILL_ALPHA})`)
        ctx.fillStyle = g
      } else {
        const g = ctx.createLinearGradient(0, h - fillH, 0, h)
        g.addColorStop(0, `rgba(120, 100, 72, ${FILL_ALPHA})`)
        g.addColorStop(1, `rgba(200, 176, 140, ${FILL_ALPHA})`)
        ctx.fillStyle = g
      }
      ctx.fillRect(0, h - fillH, w, fillH)
    }

    ctx.strokeStyle = 'rgba(200, 170, 120, 0.45)'
    ctx.lineWidth = 3
    ctx.strokeRect(2, 2, w - 4, h - 4)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const titleY = h * 0.2
    const titleSize = Math.floor(h * 0.14)
    ctx.fillStyle = 'rgba(235, 225, 215, 0.98)'
    ctx.font = `800 ${titleSize}px system-ui, Segoe UI, sans-serif`
    ctx.shadowColor = 'rgba(0,0,0,0.65)'
    ctx.shadowBlur = 8
    ctx.fillText(upgradeTitle, w / 2, titleY)
    ctx.shadowBlur = 0

    const numY = h * 0.62
    const numSize = Math.floor(h * 0.38)

    if (maxed) {
      ctx.fillStyle = '#b8f0c8'
      ctx.font = `900 ${numSize}px system-ui, Segoe UI, sans-serif`
      ctx.shadowColor = 'rgba(0,0,0,0.55)'
      ctx.shadowBlur = 8
      ctx.fillText('MAX', w / 2, numY)
      ctx.shadowBlur = 0
    } else {
      ctx.fillStyle = '#fff8f0'
      ctx.font = `900 ${numSize}px system-ui, Segoe UI, sans-serif`
      ctx.shadowColor = 'rgba(0,0,0,0.65)'
      ctx.shadowBlur = Math.max(6, numSize * 0.08)
      ctx.fillText(`$${remaining}`, w / 2, numY)
      ctx.shadowBlur = 0
    }

    tex.needsUpdate = true
  }

  draw(0, 1, false)

  const geo = new PlaneGeometry(innerW, innerD)
  const mat = new MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const mesh = new Mesh(geo, mat)
  mesh.name = 'upgradePadFloorLabel'
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.012
  mesh.renderOrder = 3

  return {
    mesh,
    redraw: draw,
    dispose: (): void => {
      mesh.removeFromParent()
      geo.dispose()
      mat.map = null
      tex.dispose()
      mat.dispose()
    },
  }
}
