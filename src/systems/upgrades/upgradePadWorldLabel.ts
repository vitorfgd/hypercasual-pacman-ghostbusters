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

/**
 * Door-style floor label: progress bar, upgrade name, huge $ remaining.
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

    ctx.clearRect(0, 0, w, h)

    ctx.fillStyle = 'rgba(18, 32, 42, 0.92)'
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = 'rgba(200, 170, 120, 0.4)'
    ctx.lineWidth = 3
    ctx.strokeRect(2, 2, w - 4, h - 4)

    const barPad = Math.round(h * 0.06)
    const barH = Math.round(h * 0.082)
    const barY = barPad
    const barX = barPad
    const barW = w - barPad * 2

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(barX, barY, barW, barH)

    const fillW = Math.max(0, barW * t)
    if (fillW > 2) {
      const g = ctx.createLinearGradient(barX, 0, barX + fillW, 0)
      g.addColorStop(0, '#8a7a58')
      g.addColorStop(1, '#c9b090')
      ctx.fillStyle = g
      ctx.fillRect(barX, barY, fillW, barH)
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const titleY = barY + barH + Math.floor(h * 0.055)
    const titleSize = Math.floor(h * 0.15)
    ctx.fillStyle = 'rgba(220, 210, 200, 0.95)'
    ctx.font = `800 ${titleSize}px system-ui, Segoe UI, sans-serif`
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 6
    ctx.fillText(upgradeTitle, w / 2, titleY)
    ctx.shadowBlur = 0

    /** Space below title bar so name + price both read huge without overlap. */
    const numY = titleY + h * 0.318
    const numSize = Math.floor(h * 0.44)

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
