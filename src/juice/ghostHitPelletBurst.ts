import type { Group, Object3D } from 'three'
import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
} from 'three'
import type { Vector3 } from 'three'
import type { GameItem } from '../core/types/GameItem.ts'
import {
  GHOST_HIT_BURST_MAX_PARTICLES,
  GHOST_HIT_BURST_MAX_PARTICLES_INTENSE,
} from '../systems/ghost/ghostConfig.ts'

export type GhostHitBurstParticle = {
  mesh: Object3D
  vx: number
  vz: number
  vy: number
  t: number
  lifeSec?: number
  growth?: number
  drag?: number
  fade?: boolean
  spin?: number
  gravityMul?: number
}

const BURST_LIFE_SEC = 0.55
const GRAVITY = 14
const FLOOR_RING_LIFE_SEC = 0.42

/** Bright emissive flecks — stack meshes are white/subtle and read poorly on the ground. */
function createBurstFleckMesh(item: GameItem): Mesh {
  const r = 0.22 + Math.random() * 0.08
  const geo = new SphereGeometry(r, 12, 10)
  let color = new Color(0xff9a1a)
  let emissive = new Color(0xff6600)
  if (item.type === 'wisp') {
    color = new Color().setHSL(item.hue, 0.75, 0.56)
    emissive = color.clone()
  } else if (item.type === 'power_pellet') {
    color = new Color(0x66eeff)
    emissive = new Color(0x44ccff)
  } else if (item.type === 'gem') {
    if (item.gemColor === 'red') {
      color = new Color(0xff4466)
      emissive = new Color(0xff8899)
    } else if (item.gemColor === 'blue') {
      color = new Color(0x4499ff)
      emissive = new Color(0x99ccff)
    } else {
      color = new Color(0x55dd88)
      emissive = new Color(0xaaffcc)
    }
  } else if (item.type === 'relic') {
    color = new Color().setHSL(item.hue, 0.8, 0.55)
    emissive = new Color().setHSL(item.hue + 0.03, 0.9, 0.5)
  } else if (item.type === 'clutter') {
    const palette: Color[] = [
      new Color(0xc8c0b0),
      new Color(0x8a8478),
      new Color(0x6a6058),
      new Color(0x9a9082),
      new Color(0xb8a898),
      new Color(0x6e665c),
      new Color(0x7d7368),
    ]
    color = palette[item.clutterVariant] ?? palette[2]!
    emissive = color.clone().multiplyScalar(0.35)
  }
  const mat = new MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 1.5,
    roughness: 0.28,
    metalness: 0.06,
  })
  const mesh = new Mesh(geo, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.renderOrder = 10
  return mesh
}

/** Green ectoplasm flecks at the hit point (paired with stack pellet burst). */
export function spawnGhostHitEctoplasmBurst(
  parent: Group,
  origin: Vector3,
): GhostHitBurstParticle[] {
  const n = 18
  const out: GhostHitBurstParticle[] = []
  for (let i = 0; i < n; i++) {
    const mesh = new Mesh(
      new SphereGeometry(0.14 + Math.random() * 0.1, 8, 6),
      new MeshStandardMaterial({
        color: new Color(0x66ffcc),
        emissive: new Color(0x22cc88),
        emissiveIntensity: 2.1,
        roughness: 0.35,
        metalness: 0.05,
        transparent: true,
        opacity: 0.92,
      }),
    )
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.renderOrder = 11
    mesh.position.copy(origin)
    mesh.position.y += 0.35 + Math.random() * 0.55
    const ang = Math.random() * Math.PI * 2
    const sp = 4.2 + Math.random() * 7.8
    parent.add(mesh)
    out.push({
      mesh,
      vx: Math.cos(ang) * sp,
      vz: Math.sin(ang) * sp,
      vy: 3.8 + Math.random() * 5.2,
      t: 0,
    })
  }
  return out
}

export function spawnGhostHitPelletBurst(
  parent: Group,
  origin: Vector3,
  lostItems: readonly GameItem[],
  opts?: { intense?: boolean },
): GhostHitBurstParticle[] {
  const cap = opts?.intense
    ? GHOST_HIT_BURST_MAX_PARTICLES_INTENSE
    : GHOST_HIT_BURST_MAX_PARTICLES
  const n = Math.min(lostItems.length, cap)
  const out: GhostHitBurstParticle[] = []
  const intense = opts?.intense === true
  for (let i = 0; i < n; i++) {
    const mesh = createBurstFleckMesh(lostItems[i]!)
    mesh.position.copy(origin)
    mesh.position.y += 0.52 + Math.random() * (intense ? 0.28 : 0.2)
    const ang = Math.random() * Math.PI * 2
    const sp = intense
      ? 5.6 + Math.random() * 7.2
      : 4.2 + Math.random() * 5.2
    parent.add(mesh)
    out.push({
      mesh,
      vx: Math.cos(ang) * sp,
      vz: Math.sin(ang) * sp,
      vy: intense
        ? 4.4 + Math.random() * 4.2
        : 3.2 + Math.random() * 2.6,
      t: 0,
    })
  }
  return out
}

export type FloorRingOpts = {
  color?: number
  opacity?: number
  startScale?: number
  endScale?: number
  y?: number
  lifeSec?: number
}

export function spawnFloorRingBurst(
  parent: Group,
  origin: Vector3,
  opts?: FloorRingOpts,
): GhostHitBurstParticle[] {
  const startScale = opts?.startScale ?? 0.42
  const endScale = opts?.endScale ?? 2
  const lifeSec = opts?.lifeSec ?? FLOOR_RING_LIFE_SEC
  const mesh = new Mesh(
    new CircleGeometry(0.5, 24),
    new MeshBasicMaterial({
      color: new Color(opts?.color ?? 0x7af0c8),
      transparent: true,
      opacity: opts?.opacity ?? 0.3,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.copy(origin)
  mesh.position.y += opts?.y ?? 0.035
  mesh.scale.setScalar(startScale)
  mesh.renderOrder = 12
  parent.add(mesh)
  return [
    {
      mesh,
      vx: 0,
      vz: 0,
      vy: 0,
      t: 0,
      lifeSec,
      growth: (endScale - startScale) / Math.max(0.01, lifeSec),
      drag: 1,
      fade: true,
      spin: 0.8 - Math.random() * 1.6,
      gravityMul: 0,
    },
  ]
}

export function spawnDirectionalFloorPulse(
  parent: Group,
  origin: Vector3,
  dirX: number,
  dirZ: number,
  opts?: Omit<FloorRingOpts, 'startScale' | 'endScale'> & {
    spacing?: number
    count?: number
  },
): GhostHitBurstParticle[] {
  const spacing = opts?.spacing ?? 1.25
  const count = Math.max(1, Math.floor(opts?.count ?? 3))
  const len = Math.hypot(dirX, dirZ) || 1
  const nx = dirX / len
  const nz = dirZ / len
  const out: GhostHitBurstParticle[] = []
  for (let i = 0; i < count; i++) {
    const p = origin.clone()
    p.x += nx * spacing * i
    p.z += nz * spacing * i
    out.push(
      ...spawnFloorRingBurst(parent, p, {
        ...opts,
        startScale: 0.28 + i * 0.06,
        endScale: 1.1 + i * 0.34,
        opacity: Math.max(0.08, (opts?.opacity ?? 0.22) - i * 0.04),
        lifeSec: (opts?.lifeSec ?? 0.34) + i * 0.03,
      }),
    )
  }
  return out
}

export function updateGhostHitBursts(particles: GhostHitBurstParticle[], dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!
    const lifeSec = p.lifeSec ?? BURST_LIFE_SEC
    const dragRate = p.drag ?? 1.05
    const drag = Math.exp(-dragRate * dt)
    p.t += dt
    p.vx *= drag
    p.vz *= drag
    p.vy -= GRAVITY * (p.gravityMul ?? 1) * dt
    p.mesh.position.x += p.vx * dt
    p.mesh.position.z += p.vz * dt
    p.mesh.position.y += p.vy * dt
    if (p.growth) {
      const nextScale = Math.max(0.02, p.mesh.scale.x + p.growth * dt)
      p.mesh.scale.setScalar(nextScale)
    } else {
      const life = p.t / lifeSec
      const sc = Math.max(0.02, 1 - life * 0.95)
      p.mesh.scale.setScalar(sc * 1.15)
    }
    if (p.spin && p.mesh instanceof Mesh) {
      p.mesh.rotation.z += p.spin * dt
    }
    if (p.fade && p.mesh instanceof Mesh && p.mesh.material instanceof MeshBasicMaterial) {
      const life = p.t / lifeSec
      p.mesh.material.opacity = Math.max(0, p.mesh.material.opacity * (1 - life * 0.2))
    }
    if (p.t >= lifeSec || p.mesh.position.y < -0.25) {
      disposeBurstMesh(p.mesh)
      particles.splice(i, 1)
    }
  }
}

function disposeBurstMesh(root: Object3D): void {
  root.traverse((o) => {
    if (o instanceof Sprite) {
      const sm = o.material as SpriteMaterial
      sm.map?.dispose()
      sm.dispose()
      return
    }
    if (o instanceof Mesh) {
      o.geometry.dispose()
      const m = o.material
      if (Array.isArray(m)) m.forEach((x) => x.dispose())
      else m.dispose()
    }
  })
  root.removeFromParent()
}

export function disposeAllGhostHitBursts(particles: GhostHitBurstParticle[]): void {
  for (const p of particles) {
    disposeBurstMesh(p.mesh)
  }
  particles.length = 0
}
