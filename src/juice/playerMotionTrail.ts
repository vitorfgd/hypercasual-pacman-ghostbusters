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

/**
 * Cheap floor dots that lag behind the player when the stack is heavy.
 */
export class PlayerMotionTrail {
  private readonly root = new Group()
  private readonly pts: Vector3[] = []
  private readonly meshes: Mesh[] = []

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
  }

  update(x: number, z: number, y: number, intensity: number, dt: number): void {
    const on = intensity > 0.02
    this.root.visible = on
    if (!on) return
    this.pts[0]!.set(x, y, z)
    const lag = 10 + intensity * 6
    const k = 1 - Math.exp(-lag * dt)
    for (let i = 1; i < this.pts.length; i++) {
      this.pts[i]!.lerp(this.pts[i - 1]!, k)
    }
    for (let i = 0; i < this.meshes.length; i++) {
      const m = this.meshes[i]!
      const p = this.pts[i + 1]!
      m.position.set(p.x, y + 0.01, p.z)
      const mat = m.material as MeshBasicMaterial
      mat.opacity = 0.06 + intensity * (0.14 - i * 0.012)
      m.visible = true
    }
  }

  dispose(): void {
    this.root.removeFromParent()
    for (const m of this.meshes) {
      m.geometry.dispose()
      ;(m.material as MeshBasicMaterial).dispose()
    }
    this.meshes.length = 0
  }
}
