import {
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from 'three'

/** Compact pads for hub corners */
export const UPGRADE_PAD_RADIUS = 0.7
/** Overlap test: player center vs pad center (generous for thumb + character footprint). */
export const UPGRADE_PAD_ZONE_RADIUS = 1.5

const PAD_CYL_HEIGHT = 1

/**
 * Three.js `alphaMap` uses texture **luminance** (RGB), not the canvas alpha channel.
 * White = opaque, black = transparent — RGB must fade, not rgba with fixed white.
 */
function createPadFadeCylinderTexture(): CanvasTexture {
  const h = 256
  const w = 4
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('2D canvas not available')
  }
  // Canvas: y = h is bottom (ground), y = 0 is top — match cylinder side UV v = 0 → 1 bottom → top.
  const g = ctx.createLinearGradient(0, h, 0, 0)
  g.addColorStop(0, 'rgb(255,255,255)')
  g.addColorStop(1, 'rgb(0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = NoColorSpace
  tex.needsUpdate = true
  return tex
}

export type PadLabelPayload = {
  title: string
}

/**
 * Floor pad + world-space label (upgrade name only — cost/level on bottom HUD).
 */
export function createUpgradePad(
  title: string,
  innerColor: number,
  ringColor: number,
): {
  root: Group
  setLabel: (p: PadLabelPayload) => void
  /** 0 = idle, 1 = player in pad zone — boosts emissive / slight lift */
  setOccupancy: (t: number) => void
} {
  const root = new Group()
  root.name = `upgradePad:${title}`

  const innerMat = new MeshStandardMaterial({
    color: innerColor,
    emissive: innerColor,
    emissiveIntensity: 0.055,
    roughness: 0.88,
    metalness: 0.04,
    transparent: true,
    opacity: 0.94,
  })
  const inner = new Mesh(new CircleGeometry(UPGRADE_PAD_RADIUS * 0.78, 40), innerMat)
  inner.rotation.x = -Math.PI / 2
  inner.position.y = 0.018
  inner.receiveShadow = true
  root.add(inner)

  const ringMat = new MeshStandardMaterial({
    color: ringColor,
    emissive: ringColor,
    emissiveIntensity: 0.12,
    roughness: 0.72,
    metalness: 0.1,
    transparent: true,
    opacity: 0.96,
    side: DoubleSide,
  })
  const ring = new Mesh(
    new RingGeometry(UPGRADE_PAD_RADIUS * 0.78, UPGRADE_PAD_RADIUS, 40),
    ringMat,
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.022
  ring.receiveShadow = true
  root.add(ring)

  const fadeTex = createPadFadeCylinderTexture()
  const cylR = UPGRADE_PAD_RADIUS * 1.02
  const aura = new Mesh(
    new CylinderGeometry(cylR, cylR, PAD_CYL_HEIGHT, 28, 8, true),
    new MeshBasicMaterial({
      color: ringColor,
      alphaMap: fadeTex,
      transparent: true,
      opacity: 0.48,
      side: DoubleSide,
      depthWrite: false,
    }),
  )
  aura.position.y = PAD_CYL_HEIGHT * 0.5 + 0.024
  aura.renderOrder = 1
  root.add(aura)

  const canvas = document.createElement('canvas')
  canvas.width = 600
  canvas.height = 124
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('2D canvas not available')
  }

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace

  const accentHex = `#${ringColor.toString(16).padStart(6, '0')}`
  let lastLabelTitle = title

  const draw = (p: PadLabelPayload): void => {
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    const pad = 10
    const r = 12
    ctx.fillStyle = 'rgba(18, 10, 28, 0.9)'
    ctx.beginPath()
    ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, r)
    ctx.fill()

    ctx.strokeStyle = 'rgba(200, 160, 110, 0.38)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.fillStyle = accentHex
    ctx.fillRect(pad + 10, pad + 18, 4, h - pad * 2 - 36)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ede4dc'
    ctx.font = '800 44px system-ui, Segoe UI, sans-serif'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
    ctx.shadowBlur = 6
    ctx.fillText(p.title, w / 2 + 6, h / 2)
    ctx.shadowBlur = 0
  }

  draw({ title })

  const sprite = new Sprite(
    new SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    }),
  )
  sprite.position.y = 2.5
  sprite.scale.set(3.45, 0.72, 1)
  root.add(sprite)

  const baseInnerY = inner.position.y
  const baseRingY = ring.position.y
  const baseInnerEm = innerMat.emissiveIntensity
  const baseRingEm = ringMat.emissiveIntensity

  return {
    root,
    setLabel: (p: PadLabelPayload) => {
      if (p.title === lastLabelTitle) return
      lastLabelTitle = p.title
      draw(p)
      tex.needsUpdate = true
    },
    setOccupancy: (t: number) => {
      const u = Math.max(0, Math.min(1, t))
      innerMat.emissiveIntensity = baseInnerEm + u * 0.22
      ringMat.emissiveIntensity = baseRingEm + u * 0.32
      inner.position.y = baseInnerY + u * 0.028
      ring.position.y = baseRingY + u * 0.03
    },
  }
}
