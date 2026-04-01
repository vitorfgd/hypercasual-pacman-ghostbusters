import type { Group, Object3D } from 'three'
import {
  Color,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
} from 'three'
import type { Vector3 } from 'three'
import type { GameItem } from '../core/types/GameItem.ts'
import { GHOST_HIT_BURST_MAX_PARTICLES } from '../systems/ghost/ghostConfig.ts'

export type GhostHitBurstParticle = {
  mesh: Object3D
  vx: number
  vz: number
  vy: number
  t: number
}

const BURST_LIFE_SEC = 0.55
const GRAVITY = 14

/** Bright emissive flecks — stack meshes are white/subtle and read poorly on the ground. */
function createBurstFleckMesh(item: GameItem): Mesh {
  const r = 0.22 + Math.random() * 0.08
  const geo = new SphereGeometry(r, 12, 10)
  let color = new Color(0xff9a1a)
  let emissive = new Color(0xff6600)
  if (item.type === 'wisp') {
    color = new Color().setHSL(item.hue, 0.75, 0.56)
    emissive = color.clone()
  } else if (item.type === 'relic') {
    color = new Color().setHSL(item.hue, 0.8, 0.55)
    emissive = new Color().setHSL(item.hue + 0.03, 0.9, 0.5)
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

function createRelicGoldFleckMesh(): Mesh {
  const r = 0.15 + Math.random() * 0.11
  const mesh = new Mesh(
    new SphereGeometry(r, 10, 8),
    new MeshStandardMaterial({
      color: new Color(0xffe8a8),
      emissive: new Color(0xffb020),
      emissiveIntensity: 1.7,
      roughness: 0.2,
      metalness: 0.14,
    }),
  )
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.renderOrder = 12
  return mesh
}

/** Gold celebratory burst when the relic is picked up (reuses `updateGhostHitBursts`). */
export function spawnRelicCollectBurst(
  parent: Group,
  origin: Vector3,
): GhostHitBurstParticle[] {
  const n = 16
  const out: GhostHitBurstParticle[] = []
  for (let i = 0; i < n; i++) {
    const mesh = createRelicGoldFleckMesh()
    mesh.position.copy(origin)
    mesh.position.y += 0.45 + Math.random() * 0.35
    const ang = Math.random() * Math.PI * 2
    const sp = 5.2 + Math.random() * 6.5
    parent.add(mesh)
    out.push({
      mesh,
      vx: Math.cos(ang) * sp,
      vz: Math.sin(ang) * sp,
      vy: 4.2 + Math.random() * 3.4,
      t: 0,
    })
  }
  return out
}

export function spawnGhostHitPelletBurst(
  parent: Group,
  origin: Vector3,
  lostItems: readonly GameItem[],
): GhostHitBurstParticle[] {
  const n = Math.min(lostItems.length, GHOST_HIT_BURST_MAX_PARTICLES)
  const out: GhostHitBurstParticle[] = []
  for (let i = 0; i < n; i++) {
    const mesh = createBurstFleckMesh(lostItems[i]!)
    mesh.position.copy(origin)
    mesh.position.y += 0.52 + Math.random() * 0.2
    const ang = Math.random() * Math.PI * 2
    const sp = 4.2 + Math.random() * 5.2
    parent.add(mesh)
    out.push({
      mesh,
      vx: Math.cos(ang) * sp,
      vz: Math.sin(ang) * sp,
      vy: 3.2 + Math.random() * 2.6,
      t: 0,
    })
  }
  return out
}

export function updateGhostHitBursts(particles: GhostHitBurstParticle[], dt: number): void {
  const drag = Math.exp(-1.05 * dt)
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!
    p.t += dt
    p.vx *= drag
    p.vz *= drag
    p.vy -= GRAVITY * dt
    p.mesh.position.x += p.vx * dt
    p.mesh.position.z += p.vz * dt
    p.mesh.position.y += p.vy * dt
    const life = p.t / BURST_LIFE_SEC
    const sc = Math.max(0.02, 1 - life * 0.95)
    p.mesh.scale.setScalar(sc * 1.15)
    if (p.t >= BURST_LIFE_SEC || p.mesh.position.y < -0.25) {
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
