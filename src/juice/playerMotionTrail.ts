import {
  AdditiveBlending,
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Scene,
} from 'three'
import { Vector3 } from 'three'

const SEG = 7
const PUFF_COUNT = 10

export type PlayerMotionTrailMode =
  | 'heavy'
  | 'sprint'
  | 'power'
  | 'recover'

export type TrailStyleId =
  | 'default'
  | 'spectral'
  | 'rose'
  | 'royal'

type TrailPuff = {
  mesh: Mesh
  life: number
  duration: number
}

type TrailPalette = {
  heavy: number
  sprint: number
  power: number
  recover: number
  puffHeavy: number
  puffSprint: number
  puffPower: number
  puffRecover: number
}

const TRAIL_PALETTES: Record<TrailStyleId, TrailPalette> = {
  default: {
    heavy: 0xffaa66,
    sprint: 0xa8ffe6,
    power: 0x75f1ff,
    recover: 0xff8ca8,
    puffHeavy: 0xffb36c,
    puffSprint: 0xafffe8,
    puffPower: 0x7ce9ff,
    puffRecover: 0xff8aa1,
  },
  spectral: {
    heavy: 0x91ffe2,
    sprint: 0xc8fff0,
    power: 0x77e8ff,
    recover: 0x9ef0d4,
    puffHeavy: 0x8ff7d7,
    puffSprint: 0xd5fff3,
    puffPower: 0x91f0ff,
    puffRecover: 0xaaf2dd,
  },
  rose: {
    heavy: 0xff7ea6,
    sprint: 0xff9cc0,
    power: 0xff5f92,
    recover: 0xffb0cf,
    puffHeavy: 0xff86aa,
    puffSprint: 0xffb5cf,
    puffPower: 0xff6d9a,
    puffRecover: 0xffcadf,
  },
  royal: {
    heavy: 0xf7c65e,
    sprint: 0xcfb0ff,
    power: 0x8ec4ff,
    recover: 0xffd88f,
    puffHeavy: 0xffd173,
    puffSprint: 0xdfc9ff,
    puffPower: 0x9fd2ff,
    puffRecover: 0xffe0a8,
  },
}

/**
 * Cheap floor dots that lag behind the player when the stack is heavy.
 */
export class PlayerMotionTrail {
  private readonly root = new Group()
  private readonly pts: Vector3[] = []
  private readonly meshes: Mesh[] = []
  private readonly puffs: TrailPuff[] = []
  private lastPuffX = NaN
  private lastPuffZ = NaN
  private style: TrailStyleId = 'default'

  constructor(scene: Scene) {
    this.root.name = 'playerMotionTrail'
    scene.add(this.root)
    for (let i = 0; i < SEG + 1; i++) {
      this.pts.push(new Vector3())
    }
    for (let i = 0; i < SEG; i++) {
      const m = new Mesh(
        new CircleGeometry(0.14 - i * 0.012, 12),
        new MeshBasicMaterial({
          color: 0xffaa66,
          transparent: true,
          opacity: 0.14,
          depthWrite: false,
          blending: AdditiveBlending,
          side: DoubleSide,
        }),
      )
      m.rotation.x = -Math.PI / 2
      m.visible = false
      this.root.add(m)
      this.meshes.push(m)
    }
    for (let i = 0; i < PUFF_COUNT; i++) {
      const mesh = new Mesh(
        new CircleGeometry(0.18, 12),
        new MeshBasicMaterial({
          color: 0x8ff7d7,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: AdditiveBlending,
          side: DoubleSide,
        }),
      )
      mesh.rotation.x = -Math.PI / 2
      mesh.visible = false
      this.root.add(mesh)
      this.puffs.push({ mesh, life: 0, duration: 0.24 })
    }
  }

  update(
    x: number,
    z: number,
    y: number,
    intensity: number,
    dt: number,
    opts?: { mode?: PlayerMotionTrailMode; speed?: number },
  ): void {
    const mode = opts?.mode ?? 'heavy'
    const on = intensity > 0.02
    let anyVisible = false
    if (on) {
      this.pts[0]!.set(x, y, z)
      const lag = 10 + intensity * 6
      const k = 1 - Math.exp(-lag * dt)
      for (let i = 1; i < this.pts.length; i++) {
        this.pts[i]!.lerp(this.pts[i - 1]!, k)
      }

      const color = trailColorForMode(this.style, mode)

      for (let i = 0; i < this.meshes.length; i++) {
        const m = this.meshes[i]!
        const p = this.pts[i + 1]!
        m.position.set(p.x, y + 0.01, p.z)
        const mat = m.material as MeshBasicMaterial
        mat.color.setHex(color)
        mat.opacity = 0.04 + intensity * (0.18 - i * 0.014)
        m.scale.setScalar(1 + intensity * 0.45)
        m.visible = true
        anyVisible = true
      }

      const puffStride = mode === 'power' ? 0.6 : mode === 'sprint' ? 0.8 : 1.05
      const moved = Math.hypot(x - this.lastPuffX, z - this.lastPuffZ)
      if (
        Number.isNaN(this.lastPuffX) ||
        (opts?.speed ?? 0) > 2.6 &&
          moved >= puffStride &&
          intensity > 0.08
      ) {
        this.spawnPuff(x, z, y, mode, intensity)
        this.lastPuffX = x
        this.lastPuffZ = z
      }
    } else {
      for (const m of this.meshes) m.visible = false
    }

    for (const puff of this.puffs) {
      if (puff.life <= 0) {
        puff.mesh.visible = false
        continue
      }
      puff.life = Math.max(0, puff.life - dt)
      const t = 1 - puff.life / puff.duration
      const mat = puff.mesh.material as MeshBasicMaterial
      puff.mesh.visible = true
      puff.mesh.scale.setScalar(0.8 + t * 1.2)
      mat.opacity = (1 - t) * 0.18
      anyVisible = true
    }

    this.root.visible = anyVisible
  }

  private spawnPuff(
    x: number,
    z: number,
    y: number,
    mode: PlayerMotionTrailMode,
    intensity: number,
  ): void {
    const puff = this.puffs.find((p) => p.life <= 0) ?? this.puffs[0]!
    puff.duration = mode === 'power' ? 0.34 : 0.26
    puff.life = puff.duration
    puff.mesh.position.set(x, y + 0.015, z)
    puff.mesh.scale.setScalar(0.72 + intensity * 0.55)
    const mat = puff.mesh.material as MeshBasicMaterial
    mat.opacity = 0.16
    const palette = TRAIL_PALETTES[this.style]
    if (mode === 'power') mat.color.setHex(palette.puffPower)
    else if (mode === 'recover') mat.color.setHex(palette.puffRecover)
    else if (mode === 'sprint') mat.color.setHex(palette.puffSprint)
    else mat.color.setHex(palette.puffHeavy)
  }

  setStyle(style: TrailStyleId): void {
    this.style = style
  }

  dispose(): void {
    this.root.removeFromParent()
    for (const m of this.meshes) {
      m.geometry.dispose()
      ;(m.material as MeshBasicMaterial).dispose()
    }
    for (const puff of this.puffs) {
      puff.mesh.geometry.dispose()
      ;(puff.mesh.material as MeshBasicMaterial).dispose()
    }
    this.meshes.length = 0
  }
}

function trailColorForMode(
  style: TrailStyleId,
  mode: PlayerMotionTrailMode,
): number {
  const palette = TRAIL_PALETTES[style]
  if (mode === 'power') return palette.power
  if (mode === 'recover') return palette.recover
  if (mode === 'sprint') return palette.sprint
  return palette.heavy
}
