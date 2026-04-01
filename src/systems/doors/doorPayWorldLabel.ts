import {
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'
import { DOOR_UNLOCK_COST } from './doorUnlockConfig.ts'

export type DoorPayWorldLabel = {
  /** Lies flat on the pad (same rotation as the deposit rectangle). */
  mesh: Mesh
  redraw: (paid: number, cost: number) => void
  dispose: () => void
}

/**
 * Full inner-pad quad with dynamic canvas: progress + large floor-readable copy.
 */
export function createDoorPayWorldLabel(
  innerW: number,
  innerD: number,
): DoorPayWorldLabel {
  const aspect = innerW / Math.max(1e-6, innerD)
  /** High resolution so text stays sharp when mapped to world units. */
  const ch = 1200
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
  /** Default `true` for canvas textures — correct orientation on the floor plane. */
  tex.flipY = true

  const draw = (paid: number, cost: number): void => {
    const w = canvas.width
    const h = canvas.height
    const remaining = Math.max(0, cost - paid)
    const t = cost > 0 ? Math.min(1, paid / cost) : 1

    ctx.clearRect(0, 0, w, h)

    ctx.fillStyle = 'rgba(18, 32, 42, 0.92)'
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = 'rgba(110, 200, 220, 0.45)'
    ctx.lineWidth = 3
    ctx.strokeRect(2, 2, w - 4, h - 4)

    const barPad = Math.round(h * 0.08)
    const barH = Math.round(h * 0.12)
    const barY = barPad
    const barX = barPad
    const barW = w - barPad * 2

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(barX, barY, barW, barH)

    const fillW = Math.max(0, barW * t)
    if (fillW > 2) {
      const g = ctx.createLinearGradient(barX, 0, barX + fillW, 0)
      g.addColorStop(0, '#2a9aaa')
      g.addColorStop(1, '#7ef0d8')
      ctx.fillStyle = g
      ctx.fillRect(barX, barY, fillW, barH)
    }

    const numSize = Math.floor(h * 0.5)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const textY = barY + barH + (h - barY - barH) * 0.5

    ctx.fillStyle = remaining > 0 ? '#fff8f0' : '#c8ffdc'
    ctx.font = `900 ${numSize}px system-ui, Segoe UI, sans-serif`
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)'
    ctx.shadowBlur = Math.max(8, numSize * 0.08)
    ctx.fillText(`$${remaining}`, w / 2, textY)
    ctx.shadowBlur = 0

    tex.needsUpdate = true
  }

  draw(0, DOOR_UNLOCK_COST)

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
  mesh.name = 'doorPayLabelPlane'
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.008
  mesh.renderOrder = 2

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
