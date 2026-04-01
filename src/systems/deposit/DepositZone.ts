import type { Group } from 'three'

/** Scene hook for deposit area; overlap uses world position of root + radius */
export type DepositZone = {
  root: Group
  radius: number
}

/** Must match overlap test in DepositSystem and ring scale in SceneSetup */
export const DEFAULT_DEPOSIT_ZONE_RADIUS = 1.28
