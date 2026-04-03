import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Scene,
} from 'three'
import type { AabbXZ } from './collisionXZ.ts'
import type { MazeWallPlacement } from '../grid/planRoomGrids.ts'

const WALL_HEIGHT = 1.18
const WALL_Y = WALL_HEIGHT * 0.5

type MazeWallInst = {
  root: Group
  collider: AabbXZ
}

export class GridMazeWallSystem {
  private readonly walls: MazeWallInst[] = []

  constructor(scene: Scene, placements: readonly MazeWallPlacement[]) {
    for (const p of placements) {
      const root = new Group()
      root.position.set(p.x, WALL_Y, p.z)

      const body = new Mesh(
        new BoxGeometry(p.width, WALL_HEIGHT, p.depth),
        new MeshStandardMaterial({
          color: 0x181822,
          roughness: 0.94,
          metalness: 0.04,
        }),
      )
      body.castShadow = false
      body.receiveShadow = true
      root.add(body)

      const cap = new Mesh(
        new BoxGeometry(p.width * 1.02, 0.08, p.depth * 1.02),
        new MeshStandardMaterial({
          color: 0x262838,
          roughness: 0.8,
          metalness: 0.02,
        }),
      )
      cap.position.y = WALL_HEIGHT * 0.5 + 0.02
      cap.castShadow = false
      cap.receiveShadow = true
      root.add(cap)

      scene.add(root)
      this.walls.push({
        root,
        collider: {
          minX: p.x - p.width * 0.5,
          maxX: p.x + p.width * 0.5,
          minZ: p.z - p.depth * 0.5,
          maxZ: p.z + p.depth * 0.5,
        },
      })
    }
  }

  getColliders(): AabbXZ[] {
    return this.walls.map((w) => w.collider)
  }

  dispose(): void {
    for (const wall of this.walls) {
      wall.root.removeFromParent()
      wall.root.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose()
          const mat = o.material
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else mat.dispose()
        }
      })
    }
    this.walls.length = 0
  }
}
