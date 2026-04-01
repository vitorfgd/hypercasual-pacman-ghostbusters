import {
  AnimationMixer,
  Mesh,
  Sprite,
  SpriteMaterial,
  type Group,
  type Object3D,
  type Scene,
} from 'three'
import type { Vector3 } from 'three'
import type { GameItem } from '../../core/types/GameItem.ts'
import { disposeRelicGltfClone } from '../relic/relicGltfAsset.ts'
import { disposeWispGltfClone } from '../wisp/wispGltfAsset.ts'
import { createPickupMesh } from './ItemVisuals.ts'
import {
  attachPickupIdleMotion,
  updatePickupIdleMotion,
} from './PickupMotion.ts'
import { COLLECT_POP_SEC } from '../../juice/juiceConfig.ts'

type Entry = { mesh: Object3D; item: GameItem }

type CollectAnim = { mesh: Object3D; t: number }

/**
 * Owns world pickups: logical `GameItem` + Three.js mesh.
 */
export class ItemWorld {
  private readonly byId = new Map<string, Entry>()
  private readonly pickupGroup: Group
  private readonly scene: Scene
  private readonly collectAnims: CollectAnim[] = []
  private readonly pendingDisposals: Object3D[] = []
  private readonly pooledWispMeshes: Object3D[] = []
  private readonly pooledRelicMeshes: [Object3D[], Object3D[]] = [[], []]

  constructor(pickupGroup: Group, scene: Scene) {
    this.pickupGroup = pickupGroup
    this.scene = scene
  }

  /**
   * Pre-allocate wisp visuals to avoid first-spawn hitch when leaving the safe area.
   */
  prewarmWispPool(count: number): void {
    const n = Math.max(0, Math.floor(count))
    for (let i = 0; i < n; i++) {
      const warmId = `__warm_wisp_${i}`
      const mesh = createPickupMesh({
        id: warmId,
        kind: 'collectible',
        type: 'wisp',
        value: 0,
        hue: 0.5,
      })
      if (!this.tryPoolMesh(mesh)) {
        this.disposeMesh(mesh)
      }
    }
  }

  spawn(item: GameItem, x: number, z: number): void {
    if (this.byId.has(item.id)) return
    const mesh = this.obtainMesh(item)
    const y = mesh.position.y
    mesh.position.set(x, y, z)
    mesh.visible = true
    attachPickupIdleMotion(mesh, item.type === 'wisp' ? 'wisp' : 'pellet')
    this.pickupGroup.add(mesh)
    this.byId.set(item.id, { mesh, item })
  }

  remove(id: string): void {
    const e = this.byId.get(id)
    if (!e) return
    this.pickupGroup.remove(e.mesh)
    this.disposeMesh(e.mesh)
    this.byId.delete(id)
  }

  applyMagnetPull(
    playerXZ: Vector3,
    collectRadius: number,
    magnetExtra: number,
    pullSpeed: number,
    dt: number,
  ): void {
    const innerR = collectRadius
    const outerR = collectRadius + magnetExtra
    const outerR2 = outerR * outerR
    const innerR2 = innerR * innerR
    for (const [, { mesh }] of this.byId) {
      const dx = playerXZ.x - mesh.position.x
      const dz = playerXZ.z - mesh.position.z
      const d2 = dx * dx + dz * dz
      if (d2 <= innerR2 || d2 > outerR2) continue
      const d = Math.sqrt(d2) || 1e-6
      const nx = dx / d
      const nz = dz / d
      const t = Math.min(1, (Math.sqrt(d2) - innerR) / magnetExtra)
      const step = pullSpeed * dt * (0.35 + 0.65 * t * t)
      mesh.position.x += nx * step
      mesh.position.z += nz * step
    }
  }

  detachPickupForCollect(id: string): void {
    const e = this.byId.get(id)
    if (!e) return
    this.byId.delete(id)
    this.pickupGroup.remove(e.mesh)
    delete e.mesh.userData.pickupIdle
    this.scene.add(e.mesh)
    this.collectAnims.push({ mesh: e.mesh, t: 0 })
  }

  updateCollectEffects(dt: number): void {
    for (let i = this.collectAnims.length - 1; i >= 0; i--) {
      const a = this.collectAnims[i]
      a.t += dt
      const p = Math.min(1, a.t / COLLECT_POP_SEC)
      let s: number
      if (p < 0.45) {
        s = 1 + 0.38 * Math.sin((p / 0.45) * (Math.PI / 2))
      } else {
        s = 1.38 * (1 - (p - 0.45) / 0.55)
      }
      a.mesh.scale.setScalar(Math.max(0.001, s))
      if (p >= 1) {
        if (!this.tryPoolMesh(a.mesh)) {
          this.pendingDisposals.push(a.mesh)
        }
        this.collectAnims.splice(i, 1)
      }
    }
    this.flushPendingDisposals(2)
  }

  getPickupCount(): number {
    return this.byId.size
  }

  /** World wisps only (not carried). */
  countWisps(): number {
    let n = 0
    for (const [, { item }] of this.byId) {
      if (item.type === 'wisp') n += 1
    }
    return n
  }

  hasPickup(id: string): boolean {
    return this.byId.has(id)
  }

  /** Pickup root position in world (pickup group assumed at scene origin). */
  getPickupXZ(id: string): { x: number; z: number } | null {
    const e = this.byId.get(id)
    if (!e) return null
    return { x: e.mesh.position.x, z: e.mesh.position.z }
  }

  entries(): IterableIterator<[string, Entry]> {
    return this.byId.entries()
  }

  updateVisuals(timeSec: number, dt: number): void {
    for (const [, { mesh, item }] of this.byId) {
      const wispMixer = mesh.userData.wispMixer as AnimationMixer | undefined
      if (wispMixer) wispMixer.update(dt)
      const relicMixer = mesh.userData.relicMixer as AnimationMixer | undefined
      if (relicMixer) relicMixer.update(dt)
      updatePickupIdleMotion(mesh, timeSec, dt)
      if (item.type === 'wisp') {
        const body = mesh.userData.wispBody as Mesh | undefined
        const mid = mesh.userData.wispMid as Mesh | undefined
        const halo = mesh.userData.wispHalo as Mesh | undefined
        const h = item.hue * 20
          if (mesh.userData.wispGltf === true) {
            const baseScale = (mesh.userData.wispBaseScale as number | undefined) ?? 1
            const w = baseScale * (0.985 + 0.015 * Math.sin(timeSec * 3.8 + h))
            mesh.scale.setScalar(w)
          }
        if (body) {
          const pulse = 0.95 + 0.05 * Math.sin(timeSec * 3.8 + h)
          body.scale.setScalar(pulse)
        }
        if (mid) {
          const mp = 0.97 + 0.03 * Math.sin(timeSec * 3.2 + h * 0.5)
          mid.scale.setScalar(mp)
          const mm = mid.material
          if (mm && !Array.isArray(mm) && 'emissiveIntensity' in mm) {
            mm.emissiveIntensity = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(timeSec * 4.4))
          }
        }
        if (halo) {
          const hp = 0.92 + 0.08 * Math.sin(timeSec * 2.7 + 0.7)
          halo.scale.setScalar(hp)
          const hm = halo.material
          if (hm && !Array.isArray(hm) && 'emissiveIntensity' in hm) {
            hm.emissiveIntensity = 0.42 + 0.22 * (0.5 + 0.5 * Math.sin(timeSec * 4.9))
          }
        }
      } else if (item.type === 'relic') {
        if (mesh.userData.relicGltf === true) {
          const baseScale = (mesh.userData.relicBaseScale as number | undefined) ?? 1
          const h = item.hue * 30
          const w =
            baseScale * (0.982 + 0.018 * Math.sin(timeSec * 3.6 + h))
          mesh.scale.setScalar(w)
        } else {
          const gem = mesh.userData.relicGem as Mesh | undefined
          const rHalo = mesh.userData.relicHalo as Mesh | undefined
          const h = item.hue * 30
          if (gem) {
            gem.rotation.y += dt * 1.1
            const pulse = 0.94 + 0.06 * Math.sin(timeSec * 4.2 + h)
            gem.scale.setScalar(pulse)
          }
          if (rHalo) {
            const hp = 0.88 + 0.12 * Math.sin(timeSec * 3.1)
            rHalo.scale.setScalar(hp)
            const hm = rHalo.material
            if (hm && !Array.isArray(hm) && 'emissiveIntensity' in hm) {
              hm.emissiveIntensity =
                0.5 + 0.35 * (0.5 + 0.5 * Math.sin(timeSec * 5.2))
            }
          }
        }
      }
    }
  }

  private disposeMesh(root: Object3D): void {
    if (root.userData.wispGltf === true) {
      disposeWispGltfClone(root)
      return
    }
    if (root.userData.relicGltf === true) {
      disposeRelicGltfClone(root)
      return
    }
    root.removeFromParent()
    root.traverse((o) => {
      if (o instanceof Sprite) {
        const m = o.material as SpriteMaterial
        m.map?.dispose()
        m.dispose()
        return
      }
      if (o instanceof Mesh) {
        o.geometry.dispose()
        const m = o.material
        if (Array.isArray(m)) m.forEach((mat) => mat.dispose())
        else m.dispose()
      }
    })
  }

  private obtainMesh(item: GameItem): Object3D {
    if (item.type === 'wisp' && this.pooledWispMeshes.length > 0) {
      const mesh = this.pooledWispMeshes.pop()!
      mesh.position.set(0, mesh.position.y, 0)
      mesh.scale.setScalar(
        (mesh.userData.wispBaseScale as number | undefined) ?? 1,
      )
      return mesh
    }
    if (item.type === 'relic') {
      const v = item.relicVariant
      const pool = this.pooledRelicMeshes[v]
      if (pool.length > 0) {
        const mesh = pool.pop()!
        mesh.position.set(0, mesh.position.y, 0)
        mesh.scale.setScalar(
          (mesh.userData.relicBaseScale as number | undefined) ?? 1,
        )
        mesh.visible = true
        return mesh
      }
    }
    return createPickupMesh(item)
  }

  private tryPoolMesh(root: Object3D): boolean {
    if (root.userData.wispGltf === true || root.userData.wispBody) {
      root.removeFromParent()
      root.visible = false
      const mix = root.userData.wispMixer as AnimationMixer | undefined
      if (mix) mix.stopAllAction()
      delete root.userData.pickupIdle
      this.pooledWispMeshes.push(root)
      return true
    }
    if (root.userData.relicGltf === true) {
      root.removeFromParent()
      root.visible = false
      const mix = root.userData.relicMixer as AnimationMixer | undefined
      if (mix) mix.stopAllAction()
      delete root.userData.pickupIdle
      const v = root.userData.relicVariant as 0 | 1
      this.pooledRelicMeshes[v].push(root)
      return true
    }
    return false
  }

  private flushPendingDisposals(maxPerFrame: number): void {
    if (this.pendingDisposals.length === 0) return
    const n = Math.min(maxPerFrame, this.pendingDisposals.length)
    for (let i = 0; i < n; i++) {
      const mesh = this.pendingDisposals.pop()
      if (mesh) this.disposeMesh(mesh)
    }
  }
}
