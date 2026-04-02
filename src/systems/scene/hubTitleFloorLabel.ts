import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'
import { DEFAULT_DEPOSIT_ZONE_RADIUS } from '../deposit/DepositZone.ts'

const GAP = 0.55

function makeFloorDecal(
  planeW: number,
  planeD: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  materialOpacity: number,
): { mesh: Mesh; dispose: () => void } {
  const cw = Math.max(800, Math.round(planeW * 420))
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

export type HubTitleFloorLabelHandle = {
  root: Group
  /** Hides only the “WELCOME TO / HAUNTED HAUL” banner; south instructions stay. */
  hideWelcomeBanner: () => void
  dispose: () => void
}

/**
 * Hub floor copy: title north of the deposit (-Z), how-to south (+Z). Canvas → textured planes.
 */
export function createHubTitleFloorLabel(): HubTitleFloorLabelHandle {
  const root = new Group()
  root.name = 'hubTitleFloorLabel'

  const r = DEFAULT_DEPOSIT_ZONE_RADIUS

  /** Wide banner; shallow in Z. Mesh +Z edge sits just north of the gold circle. */
  const titlePlaneW = 15.5
  const titlePlaneD = 3.35
  const title = makeFloorDecal(titlePlaneW, titlePlaneD, (ctx, w, h) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const size1 = Math.floor(h * 0.24)
    const size2 = Math.floor(h * 0.3)
    const y1 = h * 0.1
    const y2 = h * 0.4
    const drawLine = (text: string, py: number, fontPx: number): void => {
      ctx.font = `900 ${fontPx}px system-ui, Segoe UI, sans-serif`
      ctx.shadowColor = 'rgba(0,0,0,0.55)'
      ctx.shadowBlur = Math.max(10, fontPx * 0.1)
      ctx.shadowOffsetX = 3
      ctx.shadowOffsetY = 4
      ctx.fillStyle = 'rgba(248, 236, 220, 0.82)'
      ctx.fillText(text, w / 2, py)
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      ctx.shadowBlur = 0
    }
    drawLine('WELCOME TO', y1, size1)
    drawLine('HAUNTED HAUL', y2, size2)
  }, 0.7)
  title.mesh.name = 'hubTitleFloorLabelTitleMesh'
  root.add(title.mesh)

  /** North of deposit: plane’s south (+world Z) edge clears the circle. */
  const titleZ = -(r + GAP + titlePlaneD / 2)
  title.mesh.position.set(0, title.mesh.position.y, titleZ)

  const howLines = [
    'Drag to move',
    'Collect wisps and relics',
    'Cash in on the gold circle',
    'Complete quests',
    'Open new rooms and challenges',
  ]
  const howPlaneW = 12
  const howPlaneD = 5.6
  const how = makeFloorDecal(howPlaneW, howPlaneD, (ctx, w, h) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const howSize = Math.max(44, Math.min(Math.floor(h * 0.072), Math.floor(w * 0.048)))
    ctx.font = `600 ${howSize}px system-ui, Segoe UI, sans-serif`
    ctx.fillStyle = 'rgba(210, 198, 186, 0.62)'
    const howLineGap = howSize * 1.22
    const y0 = h * 0.38
    howLines.forEach((t, i) => {
      ctx.fillText(t, w / 2, y0 + i * howLineGap)
    })
  }, 0.62)
  how.mesh.name = 'hubTitleFloorLabelHowMesh'
  root.add(how.mesh)

  /** South of deposit: plane’s north (-world Z) edge clears the circle. */
  const howZ = r + GAP + howPlaneD / 2
  how.mesh.position.set(0, how.mesh.position.y, howZ)

  return {
    root,
    hideWelcomeBanner: (): void => {
      title.mesh.visible = false
    },
    dispose: (): void => {
      root.removeFromParent()
      title.dispose()
      how.dispose()
    },
  }
}
