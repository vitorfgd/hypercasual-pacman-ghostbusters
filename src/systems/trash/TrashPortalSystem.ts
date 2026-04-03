import type { Group } from 'three'
import { Vector3 } from 'three'
import type { RoomSystem } from '../world/RoomSystem.ts'
import { getTrashPortalXZ } from './trashPortalLayout.ts'
import { TRASH_PORTAL_SUCTION_MAX_SPEED, TRASH_PORTAL_ZONE_RADIUS } from './trashPortalConfig.ts'

/**
 * Room trash-portal positions (logical zones only — no world meshes).
 * Used for suction toward portal centers and legacy overlap tests.
 */
export class TrashPortalSystem {
  private readonly roomSystem: RoomSystem
  private readonly zoneScratch = {
    center: new Vector3(),
    radius: TRASH_PORTAL_ZONE_RADIUS,
  }
  /** Run upgrades (portal-tug); clamped for stability. */
  private suctionStrengthMul = 1

  constructor(roomSystem: RoomSystem) {
    this.roomSystem = roomSystem
  }

  setSuctionStrengthMultiplier(m: number): void {
    this.suctionStrengthMul = Math.max(0.65, Math.min(1.55, m))
  }

  /**
   * Deposit overlap for `DepositController` — null when not in any portal disc.
   */
  getDepositZoneForPlayer(
    px: number,
    pz: number,
  ): { center: Vector3; radius: number } | null {
    const room = this.roomSystem.getRoomAt(px, pz)
    if (!room) return null
    const xz = getTrashPortalXZ(room)
    const dx = px - xz.x
    const dz = pz - xz.z
    const r = TRASH_PORTAL_ZONE_RADIUS
    if (dx * dx + dz * dz > r * r) return null
    this.zoneScratch.center.set(xz.x, 0, xz.z)
    this.zoneScratch.radius = r
    return this.zoneScratch
  }

  isPlayerInTrashPortal(px: number, pz: number): boolean {
    return this.getDepositZoneForPlayer(px, pz) !== null
  }

  /**
   * Strong pull toward portal when carrying items (after `PlayerController.update`).
   */
  applySuction(
    playerRoot: Group,
    stackCount: number,
    dt: number,
    resolveWalls: (x: number, z: number, radius: number) => { x: number; z: number },
    playerRadius: number,
  ): void {
    if (stackCount <= 0) return
    const p = playerRoot.position
    const zone = this.getDepositZoneForPlayer(p.x, p.z)
    if (!zone) return
    const dx = zone.center.x - p.x
    const dz = zone.center.z - p.z
    const d = Math.hypot(dx, dz)
    if (d < 0.06) return
    const t = Math.max(0, 1 - d / zone.radius)
    const speed =
      TRASH_PORTAL_SUCTION_MAX_SPEED * this.suctionStrengthMul * t * t
    const k = (speed * dt) / d
    p.x += dx * k
    p.z += dz * k
    const r = resolveWalls(p.x, p.z, playerRadius)
    p.x = r.x
    p.z = r.z
  }

  update(_dt: number, _timeSec: number, _px: number, _pz: number, _stackCount: number): void {}

  /** Legacy hook — portals have no visuals. */
  pulsePortalItemLand(_px: number, _pz: number): void {}

  dispose(): void {}
}
