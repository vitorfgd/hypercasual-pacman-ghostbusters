import {
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three'

import {
  UPGRADE_PAD_HALF_DEPTH,
  UPGRADE_PAD_HALF_WIDTH,
} from './upgradeConfig.ts'

export type PadLabelPayload = {
  title: string
}

const w = UPGRADE_PAD_HALF_WIDTH * 2
const d = UPGRADE_PAD_HALF_DEPTH * 2
const innerW = w * 0.88
const innerD = d * 0.88

/**
 * Rectangular floor pad (door-style): border + inner fill. No floating sprite.
 */
export function createUpgradePad(
  _title: string,
  innerColor: number,
  ringColor: number,
): {
  root: Group
  setLabel: (p: PadLabelPayload) => void
  setOccupancy: (t: number) => void
} {
  const root = new Group()
  root.name = 'upgradePadRect'

  const innerMat = new MeshStandardMaterial({
    color: innerColor,
    emissive: innerColor,
    emissiveIntensity: 0.055,
    roughness: 0.88,
    metalness: 0.04,
    transparent: true,
    opacity: 0.94,
  })
  const inner = new Mesh(new PlaneGeometry(innerW, innerD), innerMat)
  inner.rotation.x = -Math.PI / 2
  inner.position.y = 0.006
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
  const border = new Mesh(new PlaneGeometry(w, d), ringMat)
  border.rotation.x = -Math.PI / 2
  border.position.y = 0.002
  root.add(border)

  const baseInnerY = inner.position.y
  const baseRingY = border.position.y
  const baseInnerEm = innerMat.emissiveIntensity
  const baseRingEm = ringMat.emissiveIntensity

  return {
    root,
    setLabel: (_p: PadLabelPayload) => {
      /* Floor label in UpgradeZoneSystem shows name + cost. */
    },
    setOccupancy: (t: number): void => {
      const u = Math.max(0, Math.min(1, t))
      innerMat.emissiveIntensity = baseInnerEm + u * 0.22
      ringMat.emissiveIntensity = baseRingEm + u * 0.32
      inner.position.y = baseInnerY + u * 0.028
      border.position.y = baseRingY + u * 0.03
    },
  }
}

export { UPGRADE_PAD_HALF_WIDTH, UPGRADE_PAD_HALF_DEPTH } from './upgradeConfig.ts'
