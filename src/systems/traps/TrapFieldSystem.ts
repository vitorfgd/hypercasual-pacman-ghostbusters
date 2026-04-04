import { CylinderGeometry, Group, Mesh, MeshBasicMaterial, type Scene } from 'three'
import {
  cloneGridTrapMesh,
  disposeGridTrapClone,
} from '../grid/gridTrapGltfAsset.ts'

export type TrapPlacement = { x: number; z: number }

/** Logical XZ radius for overlap vs player circle (matches scaled GLB footprint). */
const TRAP_HIT_RADIUS = 0.58 * 1.15
/** Raise trap mesh above floor snap so spikes read clearly. */
const TRAP_Y_OFFSET = 0.16 * 1.15

export type TrapCallbacks = {
  onStepTrap: () => void
}

type TrapInst = {
  x: number
  z: number
  radius: number
  wasInside: boolean
  root: Group
}

/**
 * Grid spike traps — one hazard per placement; GLB clone or procedural fallback.
 */
export class TrapFieldSystem {
  private readonly traps: TrapInst[] = []
  private readonly scene: Scene

  constructor(scene: Scene, placements: readonly TrapPlacement[]) {
    this.scene = scene
    this.setPlacements(placements)
  }

  setPlacements(placements: readonly TrapPlacement[]): void {
    this.clearTraps()
    for (const p of placements) {
      const root = this.buildVisual(p.x, p.z)
      this.scene.add(root)
      this.traps.push({
        x: p.x,
        z: p.z,
        radius: TRAP_HIT_RADIUS,
        wasInside: false,
        root,
      })
    }
  }

  private clearTraps(): void {
    for (const t of this.traps) {
      if (t.root.userData.gridTrapGltf === true) {
        disposeGridTrapClone(t.root)
      } else {
        t.root.removeFromParent()
        t.root.traverse((o) => {
          if (o instanceof Mesh) {
            o.geometry.dispose()
            const m = o.material
            if (Array.isArray(m)) m.forEach((x) => x.dispose())
            else m.dispose()
          }
        })
      }
    }
    this.traps.length = 0
  }

  private buildVisual(x: number, z: number): Group {
    const glb = cloneGridTrapMesh()
    if (glb) {
      glb.position.set(x, TRAP_Y_OFFSET, z)
      return glb
    }
    const g = new Group()
    g.position.set(x, TRAP_Y_OFFSET, z)
    const m = new Mesh(
      new CylinderGeometry(0.62 * 1.15, 0.7 * 1.15, 0.34 * 1.15, 10),
      new MeshBasicMaterial({ color: 0x884466 }),
    )
    m.position.y = 0.17 * 1.15
    m.raycast = () => {}
    g.add(m)
    g.traverse((o) => {
      if (o instanceof Mesh) o.raycast = () => {}
    })
    return g
  }

  update(
    _timeSec: number,
    playerX: number,
    playerZ: number,
    playerRadius: number,
    cb: TrapCallbacks,
  ): number {
    for (const t of this.traps) {
      const dx = playerX - t.x
      const dz = playerZ - t.z
      const dist = Math.hypot(dx, dz)
      const inside = dist < t.radius + playerRadius - 1e-4
      if (inside && !t.wasInside) {
        cb.onStepTrap()
      }
      t.wasInside = inside
    }
    return 1
  }

  dispose(): void {
    this.clearTraps()
  }
}
