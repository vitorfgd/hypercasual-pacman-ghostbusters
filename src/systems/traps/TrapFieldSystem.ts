import {
  AdditiveBlending,
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  type Scene,
} from 'three'
import type { RoomBounds } from '../world/mansionRoomData.ts'
import type { RoomSystem } from '../world/RoomSystem.ts'

/** Keep traps out of door thresholds (north/south strips along −Z flow). */
const DOOR_ADJACENT_STRIP = 2.75

export type TrapKind = 'damage' | 'slow'

/** Pale, desaturated — floor mist (read at a glance, still ghostly). */
const TRAP_FLOOR_TINT: Record<TrapKind, number> = {
  damage: 0xd4b0c4,
  slow: 0xa8c4e8,
}

/** Softer core for rising motes (near-white + hint of type). */
const TRAP_MOTE_CORE: Record<TrapKind, number> = {
  damage: 0xf2e4ec,
  slow: 0xe4eef8,
}

const TRAP_MOTE_HALO: Record<TrapKind, number> = {
  damage: 0xe8d0dc,
  slow: 0xd0e4f8,
}

type ParticleMote = {
  group: Group
  phase: number
  baseX: number
  baseZ: number
}

type TrapDef = {
  kind: TrapKind
  x: number
  z: number
  radius: number
  wasInside: boolean
  root: Group
  fillMat: MeshBasicMaterial
  ringMat: MeshBasicMaterial
  coreMat: MeshBasicMaterial
  haloMat: MeshBasicMaterial
  motes: ParticleMote[]
}

const SLOW_MULT = 0.6
const DAMAGE_LOSS_MIN = 0.1
const DAMAGE_LOSS_MAX = 0.2

function computeTrapRadius(b: RoomBounds, random: () => number): number {
  const bw = b.maxX - b.minX
  const bd = b.maxZ - b.minZ
  const span = Math.min(bw, bd)
  const base = span * 0.22
  const jitter = (random() - 0.5) * 0.14
  return Math.max(1.32, Math.min(2.12, base + jitter))
}

export type TrapCallbacks = {
  onDamage: (lossFrac: number) => void
}

/**
 * One floor zone per normal room: ethereal mist ring + slow rising wisp motes.
 */
export class TrapFieldSystem {
  private readonly traps: TrapDef[] = []
  private readonly scene: Scene
  private readonly random: () => number

  constructor(scene: Scene, roomSystem: RoomSystem, random: () => number) {
    this.scene = scene
    this.random = random
    const rooms = roomSystem.getSpawnEligibleRoomIds()
    const kinds: TrapKind[] = ['damage', 'slow']
    const pad = 1.05

    for (const roomId of rooms) {
      const b = roomSystem.getBounds(roomId)
      const radius = computeTrapRadius(b, random)
      const { x, z } = this.pickTrapXZ(b, random, pad, radius)
      const kind = kinds[Math.floor(random() * kinds.length)]!
      this.traps.push(this.buildTrap(kind, x, z, radius, random))
    }
  }

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
    const cx = (b.minX + b.maxX) * 0.5
    const cz = (b.minZ + b.maxZ) * 0.5
    let z = cz
    if (cz - b.minZ < strip) z = b.minZ + strip + trapR
    else if (b.maxZ - cz < strip) z = b.maxZ - strip - trapR
    return { x: cx, z }
  }

  private buildTrap(
    kind: TrapKind,
    x: number,
    z: number,
    radius: number,
    random: () => number,
  ): TrapDef {
    const root = new Group()
    root.position.set(x, 0.011, z)
    const floorTint = TRAP_FLOOR_TINT[kind]

    const ringMat = new MeshBasicMaterial({
      color: floorTint,
      transparent: true,
      opacity: 0.038,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    })
    const ring = new Mesh(
      new RingGeometry(radius * 0.38, radius * 0.995, 56),
      ringMat,
    )
    ring.rotation.x = -Math.PI / 2
    root.add(ring)

    const fillMat = new MeshBasicMaterial({
      color: floorTint,
      transparent: true,
      opacity: 0.018,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    })
    const fill = new Mesh(new CircleGeometry(radius * 0.94, 44), fillMat)
    fill.rotation.x = -Math.PI / 2
    fill.position.y = 0.001
    root.add(fill)

    const coreMat = new MeshBasicMaterial({
      color: TRAP_MOTE_CORE[kind],
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const haloMat = new MeshBasicMaterial({
      color: TRAP_MOTE_HALO[kind],
      transparent: true,
      opacity: 0.065,
      depthWrite: false,
      blending: AdditiveBlending,
    })

    const motes: ParticleMote[] = []
    const n = 5
    const coreR = 0.056
    const haloR = coreR * 2.35

    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + random() * 0.55
      const pr = radius * (0.2 + random() * 0.58)
      const bx = Math.cos(ang) * pr
      const bz = Math.sin(ang) * pr
      const phase = random() * Math.PI * 2

      const g = new Group()
      g.position.set(bx, 0.02, bz)

      const core = new Mesh(new SphereGeometry(coreR, 10, 8), coreMat)
      const halo = new Mesh(new SphereGeometry(haloR, 8, 6), haloMat)
      g.add(core, halo)

      root.add(g)
      motes.push({ group: g, phase, baseX: bx, baseZ: bz })
    }

    this.scene.add(root)
    return {
      kind,
      x,
      z,
      radius,
      wasInside: false,
      root,
      fillMat,
      ringMat,
      coreMat,
      haloMat,
      motes,
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
      const breath = 0.018 + 0.006 * Math.sin(timeSec * 0.55 + t.x * 0.12)
      t.fillMat.opacity = breath
      t.ringMat.opacity = 0.032 + 0.01 * Math.sin(timeSec * 0.48 + t.z * 0.1)

      const corePulse = 0.14 + 0.1 * Math.sin(timeSec * 0.72 + t.x * 0.06)
      const haloPulse = 0.045 + 0.035 * Math.sin(timeSec * 0.58 + t.z * 0.09)
      t.coreMat.opacity = corePulse
      t.haloMat.opacity = haloPulse

      for (const m of t.motes) {
        const ph = m.phase
        const bx = m.baseX
        const bz = m.baseZ
        const driftX =
          Math.sin(timeSec * 0.48 + ph * 1.7) * 0.11 +
          Math.sin(timeSec * 0.31 + ph) * 0.06
        const driftZ =
          Math.cos(timeSec * 0.42 + ph * 1.3) * 0.1 +
          Math.cos(timeSec * 0.27 + ph * 0.8) * 0.05
        const cycle = ((timeSec * 0.22 + ph) % 3.4) / 3.4
        const rise = cycle * 1.25
        m.group.position.set(bx + driftX, 0.014 + rise, bz + driftZ)

        const wisp = 0.82 + 0.28 * Math.sin(cycle * Math.PI)
        const haloW = 1.05 + 0.35 * Math.sin(cycle * Math.PI + 0.4)
        m.group.children[0]!.scale.setScalar(wisp)
        m.group.children[1]!.scale.setScalar(haloW)
      }

      const dx = playerX - t.x
      const dz = playerZ - t.z
      const dist = Math.hypot(dx, dz)
      const inside = dist < t.radius + playerRadius * 0.35

      if (t.kind === 'slow' && inside) {
        slowMul = Math.min(slowMul, SLOW_MULT)
      }

      if (t.kind === 'damage' && inside && !t.wasInside) {
        const frac =
          DAMAGE_LOSS_MIN +
          this.random() * (DAMAGE_LOSS_MAX - DAMAGE_LOSS_MIN)
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
      t.ringMat.dispose()
      t.coreMat.dispose()
      t.haloMat.dispose()
      for (const m of t.motes) {
        const core = m.group.children[0] as Mesh
        const halo = m.group.children[1] as Mesh
        core.geometry.dispose()
        halo.geometry.dispose()
      }
      for (const c of t.root.children) {
        const mesh = c as Mesh
        mesh.geometry?.dispose()
      }
    }
    this.traps.length = 0
  }
}

export { DAMAGE_LOSS_MIN, DAMAGE_LOSS_MAX }
