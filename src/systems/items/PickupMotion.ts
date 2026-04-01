import type { Object3D } from 'three'

const PICKUP_ANIM_KEY = 'pickupIdle' as const

export type PickupIdleState = {
  baseY: number
  phase: number
  bobAmp: number
  bobHz: number
  spinRadPerSec: number
}

/** Visual-only idle motion — only adjusts Y + spin so magnet pull on XZ still works. */
export type PickupMotionProfile = 'wisp' | 'pellet'

export function attachPickupIdleMotion(
  mesh: Object3D,
  profile: PickupMotionProfile = 'pellet',
): void {
  const isWisp = profile === 'wisp'
  const st: PickupIdleState = {
    baseY: mesh.position.y,
    phase: Math.random() * Math.PI * 2,
    bobAmp: isWisp
      ? 0.042 + Math.random() * 0.028
      : 0.018 + Math.random() * 0.012,
    bobHz: isWisp
      ? 0.52 + Math.random() * 0.24
      : 0.42 + Math.random() * 0.18,
    spinRadPerSec: isWisp
      ? 0.2 + Math.random() * 0.18
      : 0.12 + Math.random() * 0.1,
  }
  mesh.userData[PICKUP_ANIM_KEY] = st
}

export function updatePickupIdleMotion(
  mesh: Object3D,
  timeSec: number,
  dt: number,
): void {
  const st = mesh.userData[PICKUP_ANIM_KEY] as PickupIdleState | undefined
  if (!st) return
  const s = Math.sin(timeSec * (Math.PI * 2) * st.bobHz + st.phase)
  const up = (s * 0.5 + 0.5) * st.bobAmp
  mesh.position.y = st.baseY + up
  mesh.rotation.y += dt * st.spinRadPerSec
}
