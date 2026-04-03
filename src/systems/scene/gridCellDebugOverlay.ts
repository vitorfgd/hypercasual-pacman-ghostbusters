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
import {
  CORRIDOR_BOUNDS,
  ROOM_LIST,
  type RoomBounds,
} from '../world/mansionRoomData.ts'
import { GRID_ROOM_INSET, ROOM_GRID_COLS, ROOM_GRID_ROWS } from '../grid/gridConfig.ts'

/** Subtle floor grid only: no labels, no indices, just faint squares. */
export const GRID_CELL_DEBUG_OVERLAY = true

const ROWS = ROOM_GRID_ROWS
const COLS = ROOM_GRID_COLS

function makeOverlayForBounds(
  bounds: RoomBounds,
): { mesh: Mesh; dispose: () => void } {
  const spanX = bounds.maxX - bounds.minX - 2 * GRID_ROOM_INSET
  const spanZ = bounds.maxZ - bounds.minZ - 2 * GRID_ROOM_INSET
  const cx = bounds.minX + GRID_ROOM_INSET + spanX * 0.5
  const cz = bounds.minZ + GRID_ROOM_INSET + spanZ * 0.5

  const cellPx = 40
  const cw = cellPx * COLS
  const ch = cellPx * ROWS
  const cellW = cw / COLS
  const cellH = ch / ROWS

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('2D canvas not available')
  }

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      ctx.fillStyle =
        (row + col) % 2 === 0
          ? 'rgba(235, 242, 255, 0.028)'
          : 'rgba(160, 185, 225, 0.02)'
      ctx.fillRect(col * cellW, row * cellH, cellW, cellH)
    }
  }

  ctx.strokeStyle = 'rgba(215, 230, 255, 0.14)'
  ctx.lineWidth = 1
  for (let c = 0; c <= COLS; c++) {
    const x = (c / COLS) * cw
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, ch)
    ctx.stroke()
  }
  for (let r = 0; r <= ROWS; r++) {
    const y = (r / ROWS) * ch
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(cw, y)
    ctx.stroke()
  }

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.flipY = true
  tex.needsUpdate = true

  const geo = new PlaneGeometry(spanX, spanZ)
  const mat = new MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const mesh = new Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(cx, 0.014, cz)
  mesh.renderOrder = 4

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

/** Adds one subtle floor-grid plane per room + corridor. */
export function attachGridCellDebugOverlays(scene: Scene): () => void {
  if (!GRID_CELL_DEBUG_OVERLAY) return () => {}

  const root = new Group()
  root.name = 'gridCellDebugOverlays'
  const disposers: (() => void)[] = []

  for (const r of ROOM_LIST) {
    const { mesh, dispose } = makeOverlayForBounds(r.bounds)
    mesh.name = `gridCellDebug:${r.id}`
    root.add(mesh)
    disposers.push(dispose)
  }

  for (let i = 0; i < CORRIDOR_BOUNDS.length; i++) {
    const b = CORRIDOR_BOUNDS[i]!
    const { mesh, dispose } = makeOverlayForBounds(b)
    mesh.name = `gridCellDebug:corridor_${i}`
    root.add(mesh)
    disposers.push(dispose)
  }

  scene.add(root)
  return (): void => {
    root.removeFromParent()
    for (const d of disposers) d()
  }
}
