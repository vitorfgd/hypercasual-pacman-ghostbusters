import type { Group, Object3D } from 'three'
import {
  AdditiveBlending,
  Color,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import type { GhostHitBurstParticle } from './ghostHitPelletBurst.ts'

/** Ectoplasm-green burst at bag toss / landing. */
export function spawnBagDisposeBurst(
  parent: Group,
  origin: Vector3,
  count: number,
  opts?: { intense?: boolean; small?: boolean },
): GhostHitBurstParticle[] {
  const cap = opts?.small ? 14 : opts?.intense ? 42 : 28
  const n = Math.min(cap, count)
  const out: GhostHitBurstParticle[] = []
  const col = new Color(0x44ffaa)
  const em = new Color(0xaa66ff)
  for (let i = 0; i < n; i++) {
    const mesh = new Mesh(
      new SphereGeometry(0.08, 6, 5),
      new MeshBasicMaterial({
        color: col.clone().lerp(em, Math.random() * 0.45),
        transparent: true,
        opacity: 0.92,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    )
    mesh.position.copy(origin)
    mesh.position.y += 0.15 + Math.random() * 0.35
    mesh.position.x += (Math.random() - 0.5) * 0.4
    mesh.position.z += (Math.random() - 0.5) * 0.4
    parent.add(mesh)
    const ang = Math.random() * Math.PI * 2
    const sp = opts?.small ? 2 + Math.random() * 3.5 : 4 + Math.random() * 7
    out.push({
      mesh,
      vx: Math.cos(ang) * sp,
      vz: Math.sin(ang) * sp,
      vy: opts?.small ? 1.4 + Math.random() * 2.2 : 3.2 + Math.random() * 4.5,
      t: 0,
    })
  }
  return out
}

/** Tight puff when the tossed bag hits the ground (before mesh removal). */
export function spawnBagLandImpact(
  parent: Group,
  origin: Vector3,
): GhostHitBurstParticle[] {
  return spawnBagDisposeBurst(parent, origin, 12, { small: true })
}

export function disposeBagBurstMesh(root: Object3D): void {
  root.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose()
      const m = o.material
      if (Array.isArray(m)) m.forEach((x) => x.dispose())
      else m.dispose()
    }
  })
  root.removeFromParent()
}
