import {
  AdditiveBlending,
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Scene,
} from 'three'
import type { RoomBounds } from '../world/mansionRoomData.ts'
import type { RoomSystem } from '../world/RoomSystem.ts'

/** Keep traps out of door thresholds (north/south strips along −Z flow). */
const DOOR_ADJACENT_STRIP = 2.75

export type TrapKind = 'damage' | 'slow'

type TrapDef = {
  kind: TrapKind
  x: number
  z: number
  radius: number
  wasInside: boolean
  root: Group
  fillMat: MeshBasicMaterial
}

const TRAP_COLORS: Record<TrapKind, number> = {
  damage: 0xff3355,
  slow: 0x3399ff,
}

const SLOW_MULT = 0.6
const DAMAGE_LOSS_MIN = 0.1
const DAMAGE_LOSS_MAX = 0.2
export type TrapCallbacks = {
  onDamage: (lossFrac: number) => void
}

/**
 * Floor-only trap markers (lightweight circles). Logic runs in `update`.
 */
export class TrapFieldSystem {
  private readonly traps: TrapDef[] = []
  private readonly scene: Scene

  constructor(
    scene: Scene,
    roomSystem: RoomSystem,
    random: () => number,
    trapCount = 6,
  ) {
    this.scene = scene
    const rooms = roomSystem.getSpawnEligibleRoomIds()
    const n = Math.min(trapCount, rooms.length * 2)
    const kinds: TrapKind[] = ['damage', 'slow']
    for (let i = 0; i < n; i++) {
      const roomId = rooms[Math.floor(random() * rooms.length)]!
      const b = roomSystem.getBounds(roomId)
      const pad = 1.15
      const radius = 0.85 + random() * 0.55
      const { x, z } = this.pickTrapXZ(b, random, pad, radius)
      const kind = kinds[Math.floor(random() * kinds.length)]!
      this.traps.push(this.buildTrap(kind, x, z, radius))
    }
  }

  /**
   * Random XZ inside room bounds but not in north/south door-adjacent strips
   * (avoids traps sitting on unlock door / corridor thresholds).
   */
  private pickTrapXZ(
    b: RoomBounds,
    random: () => number,
    pad: number,
    trapR: number,
  ): { x: number; z: number } {
    const strip = DOOR_ADJACENT_STRIP + trapR
    const zLo = b.minZ + pad + strip
    const zHi = b.maxZ - pad - strip
    const xLo = b.minX + pad + trapR
    const xHi = b.maxX - pad - trapR
    if (zLo <= zHi && xLo <= xHi) {
      return {
        x: xLo + random() * (xHi - xLo),
        z: zLo + random() * (zHi - zLo),
      }
    }
    /** Room too narrow — bias toward center, still nudge away from doors when possible. */
    const cx = (b.minX + b.maxX) * 0.5
    const cz = (b.minZ + b.maxZ) * 0.5
    let z = cz
    if (cz - b.minZ < strip) z = b.minZ + strip + trapR
    else if (b.maxZ - cz < strip) z = b.maxZ - strip - trapR
    return { x: cx, z }
  }

  private buildTrap(kind: TrapKind, x: number, z: number, radius: number): TrapDef {
    const root = new Group()
    root.position.set(x, 0.018, z)
    const color = TRAP_COLORS[kind]
    const ring = new Mesh(
      new CircleGeometry(radius, 28),
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        side: DoubleSide,
      }),
    )
    ring.rotation.x = -Math.PI / 2
    root.add(ring)
    const fillMat = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    })
    const fill = new Mesh(new CircleGeometry(radius * 0.78, 24), fillMat)
    fill.rotation.x = -Math.PI / 2
    fill.position.y = 0.004
    root.add(fill)
    this.scene.add(root)
    return {
      kind,
      x,
      z,
      radius,
      wasInside: false,
      root,
      fillMat,
    }
  }

  update(
    timeSec: number,
    playerX: number,
    playerZ: number,
    playerRadius: number,
    cb: TrapCallbacks,
  ): number {
    let slowMul = 1
    for (const t of this.traps) {
      const pulse = 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(timeSec * 2.4 + t.x))
      t.fillMat.opacity = 0.14 + 0.2 * pulse

      const dx = playerX - t.x
      const dz = playerZ - t.z
      const dist = Math.hypot(dx, dz)
      const inside = dist < t.radius + playerRadius * 0.35

      if (t.kind === 'slow' && inside) {
        slowMul = Math.min(slowMul, SLOW_MULT)
      }

      if (t.kind === 'damage' && inside && !t.wasInside) {
        const frac =
          DAMAGE_LOSS_MIN + Math.random() * (DAMAGE_LOSS_MAX - DAMAGE_LOSS_MIN)
        cb.onDamage(frac)
      }
      t.wasInside = inside
    }
    return slowMul
  }

  dispose(): void {
    for (const t of this.traps) {
      t.root.removeFromParent()
      t.fillMat.dispose()
      for (const c of t.root.children) {
        const m = c as Mesh
        m.geometry?.dispose()
        if (m.material && !Array.isArray(m.material)) m.material.dispose()
      }
    }
    this.traps.length = 0
  }
}

export { DAMAGE_LOSS_MIN, DAMAGE_LOSS_MAX }
