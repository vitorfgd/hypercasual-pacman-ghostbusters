import { Group, Mesh, type Scene } from 'three'
import { cloneGridTrapMesh } from '../grid/gridTrapGltfAsset.ts'

export type TrapPlacement = {
  x: number
  z: number
  width: number
  depth: number
}

const TRAP_MODEL_Y = 0.14
const TRAP_MODEL_FOOTPRINT_SCALE = 1.12

export type TrapCallbacks = {
  onStepTrap: (x: number, z: number) => void
}

type TrapInst = {
  x: number
  z: number
  minX: number
  maxX: number
  minZ: number
  maxZ: number
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
      const root = this.buildVisual(p)
      this.scene.add(root)
      this.traps.push({
        x: p.x,
        z: p.z,
        minX: p.x - p.width * 0.5,
        maxX: p.x + p.width * 0.5,
        minZ: p.z - p.depth * 0.5,
        maxZ: p.z + p.depth * 0.5,
        wasInside: false,
        root,
      })
    }
  }

  private clearTraps(): void {
    for (const t of this.traps) {
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
    this.traps.length = 0
  }

  private buildVisual(p: TrapPlacement): Group {
    const g = new Group()
    g.position.set(p.x, 0, p.z)

    const trapModel = cloneGridTrapMesh()
    if (trapModel) {
      trapModel.scale.multiplyScalar(
        Math.min(p.width, p.depth) * TRAP_MODEL_FOOTPRINT_SCALE,
      )
      trapModel.position.y = TRAP_MODEL_Y
      g.add(trapModel)
    }

    g.traverse((o) => {
      if (o instanceof Mesh) o.raycast = () => {}
    })
    return g
  }

  private circleIntersectsTrap(
    trap: TrapInst,
    playerX: number,
    playerZ: number,
    playerRadius: number,
  ): boolean {
    const nearestX = Math.max(trap.minX, Math.min(trap.maxX, playerX))
    const nearestZ = Math.max(trap.minZ, Math.min(trap.maxZ, playerZ))
    const dx = playerX - nearestX
    const dz = playerZ - nearestZ
    return dx * dx + dz * dz < playerRadius * playerRadius - 1e-4
  }

  update(
    _timeSec: number,
    playerX: number,
    playerZ: number,
    playerRadius: number,
    cb: TrapCallbacks,
  ): number {
    for (const t of this.traps) {
      const inside = this.circleIntersectsTrap(
        t,
        playerX,
        playerZ,
        playerRadius,
      )
      if (inside && !t.wasInside) {
        cb.onStepTrap(t.x, t.z)
      }
      t.wasInside = inside
    }
    return 1
  }

  dispose(): void {
    this.clearTraps()
  }
}
