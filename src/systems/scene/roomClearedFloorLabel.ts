import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Scene,
} from 'three'
import { ROOMS, type RoomId } from '../world/mansionRoomData.ts'

function makeFloorDecal(
  planeW: number,
  planeD: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  materialOpacity: number,
): { mesh: Mesh; dispose: () => void } {
  const cw = Math.max(900, Math.round(planeW * 440))
  const ch = Math.round(cw * (planeD / planeW))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('2D canvas not available')
  }
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  draw(ctx, w, h)

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.flipY = true
  tex.needsUpdate = true

  const geo = new PlaneGeometry(planeW, planeD)
  const mat = new MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: materialOpacity,
    depthWrite: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const mesh = new Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.011
  mesh.renderOrder = 2

  return {
    mesh,
    dispose: (): void => {
      geo.dispose()
      mat.map = null
      tex.dispose()
      mat.dispose()
    },
  }
}

/**
 * Persistent floor text at room center — same technique as the hub welcome decal
 * (`hubTitleFloorLabel.ts`): canvas → horizontal plane, soft opacity.
 */
export function spawnRoomClearedFloorLabel(
  scene: Scene,
  roomId: RoomId,
  subtitle: string,
): () => void {
  if (roomId === 'SAFE_CENTER' || !roomId.startsWith('ROOM_')) {
    return (): void => {}
  }

  const sub = subtitle
  const b = ROOMS[roomId].bounds
  const cx = (b.minX + b.maxX) * 0.5
  const cz = (b.minZ + b.maxZ) * 0.5

  const planeW = 16
  const planeD = 4.8
  const decal = makeFloorDecal(planeW, planeD, (ctx, w, h) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const sizeTop = Math.floor(h * 0.15)
    const sizeSub = Math.floor(h * 0.26)
    const yTop = h * 0.32
    const ySub = h * 0.68
    const drawLine = (text: string, py: number, fontPx: number): void => {
      ctx.font = `900 ${fontPx}px system-ui, Segoe UI, sans-serif`
      ctx.shadowColor = 'rgba(0,0,0,0.58)'
      ctx.shadowBlur = Math.max(12, fontPx * 0.12)
      ctx.shadowOffsetX = 4
      ctx.shadowOffsetY = 5
      ctx.fillStyle = 'rgba(248, 236, 220, 0.9)'
      ctx.fillText(text, w / 2, py)
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      ctx.shadowBlur = 0
    }
    drawLine('ROOM CLEARED', yTop, sizeTop)
    drawLine(sub, ySub, sizeSub)
  }, 0.3)

  const root = new Group()
  root.name = `roomClearedFloor:${roomId}`
  root.position.set(cx, 0, cz)
  root.add(decal.mesh)
  scene.add(root)

  return (): void => {
    root.removeFromParent()
    decal.dispose()
  }
}
