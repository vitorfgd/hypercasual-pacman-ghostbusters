import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'

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

export type HubTitleFloorLabelHandle = {
  root: Group
  hideWelcomeBanner: () => void
  dispose: () => void
}

/**
 * Hub floor title — centered in the safe room. Canvas → textured plane.
 */
export function createHubTitleFloorLabel(): HubTitleFloorLabelHandle {
  const root = new Group()
  root.name = 'hubTitleFloorLabel'

  const titlePlaneW = 22
  const titlePlaneD = 6
  const title = makeFloorDecal(titlePlaneW, titlePlaneD, (ctx, w, h) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const sizeWelcome = Math.floor(h * 0.16)
    const sizeMain = Math.floor(h * 0.33)
    const yWelcome = h * 0.22
    const yHaunted = h * 0.48
    const yHaul = h * 0.74
    const drawLine = (text: string, py: number, fontPx: number): void => {
      ctx.font = `900 ${fontPx}px system-ui, Segoe UI, sans-serif`
      ctx.shadowColor = 'rgba(0,0,0,0.58)'
      ctx.shadowBlur = Math.max(12, fontPx * 0.12)
      ctx.shadowOffsetX = 4
      ctx.shadowOffsetY = 5
      ctx.fillStyle = 'rgba(248, 236, 220, 0.88)'
      ctx.fillText(text, w / 2, py)
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      ctx.shadowBlur = 0
    }
    drawLine('WELCOME TO', yWelcome, sizeWelcome)
    drawLine('HAUNTED', yHaunted, sizeMain)
    drawLine('HAUL', yHaul, sizeMain)
  }, 0.3)
  title.mesh.name = 'hubTitleFloorLabelTitleMesh'
  title.mesh.position.set(0, title.mesh.position.y, 0)
  root.add(title.mesh)

  return {
    root,
    hideWelcomeBanner: (): void => {
      title.mesh.visible = false
    },
    dispose: (): void => {
      root.removeFromParent()
      title.dispose()
    },
  }
}
