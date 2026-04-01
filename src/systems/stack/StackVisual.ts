import {
  AnimationMixer,
  Mesh,
  Sprite,
  SpriteMaterial,
  type Object3D,
} from 'three'
import { Vector3 } from 'three'
import type { GameItem } from '../../core/types/GameItem.ts'
import { createStackMesh } from '../items/ItemVisuals.ts'
import { disposeRelicGltfClone } from '../relic/relicGltfAsset.ts'
import { disposeWispGltfClone } from '../wisp/wispGltfAsset.ts'
import {
  STACK_ADD_BOUNCE,
  STACK_BOUNCE_DECAY,
} from '../../juice/juiceConfig.ts'

const STEP_Y = 0.44
const SPAWN_SCALE = 0.14

/**
 * Wisp GLB stores `wispBaseScale`; relic GLB stores `relicBaseScale`.
 * We must read both — using only `wispBaseScale` made relics fall back to 1 (huge).
 */
function stackMeshBaseScale(mesh: Object3D): number {
  const w = mesh.userData.wispBaseScale as number | undefined
  const r = mesh.userData.relicBaseScale as number | undefined
  const s = w ?? r
  return s !== undefined && s > 0 ? s : 1
}

/** Carried stack meshes on the anchor; data-driven, type-agnostic */
export class StackVisual {
  private meshes: Object3D[] = []
  private prevIds: string[] = []
  private readonly anchor: Object3D
  private readonly poolWisp: Object3D[] = []
  private readonly poolRelic: [Object3D[], Object3D[]] = [[], []]
  private static readonly MAX_POOL = 64

  constructor(anchor: Object3D) {
    this.anchor = anchor
  }

  sync(items: readonly GameItem[]): void {
    const ids = items.map((x) => x.id)

    if (
      ids.length === this.prevIds.length &&
      ids.every((id, i) => id === this.prevIds[i])
    ) {
      return
    }

    if (ids.length === 0) {
      this.clearMeshes()
      this.prevIds = []
      return
    }

    const samePrefix =
      ids.length > this.prevIds.length &&
      this.prevIds.length > 0 &&
      this.prevIds.every((id, i) => id === ids[i])

    if (samePrefix && ids.length === this.prevIds.length + 1) {
      const item = items[items.length - 1]
      const mesh = this.obtainMesh(item)
      const baseScale = stackMeshBaseScale(mesh)
      mesh.userData.stackItemId = item.id
      mesh.userData.stackItemType = item.type
      const i = items.length - 1
      mesh.position.y = i * STEP_Y + STACK_ADD_BOUNCE * STEP_Y
      mesh.position.x = 0
      mesh.position.z = 0
      mesh.scale.setScalar(baseScale * SPAWN_SCALE)
      mesh.userData.stackTargetScale = baseScale
      mesh.userData.stackBounce = 1
      this.anchor.add(mesh)
      this.meshes.push(mesh)
      this.prevIds = ids
      return
    }

    this.fullRebuild(items)
    this.prevIds = ids
  }

  /** Smooth scale-in for new items and Y settle after layout changes */
  update(dt: number): void {
    const kScale = 1 - Math.exp(-16 * dt)
    const kY = 1 - Math.exp(-12 * dt)
    const kB = 1 - Math.exp(-STACK_BOUNCE_DECAY * dt)
    this.meshes.forEach((mesh, i) => {
      const wispMixer = mesh.userData.wispMixer as AnimationMixer | undefined
      if (wispMixer) wispMixer.update(dt)
      const relicMixer = mesh.userData.relicMixer as AnimationMixer | undefined
      if (relicMixer) relicMixer.update(dt)
      const bounce = (mesh.userData.stackBounce as number | undefined) ?? 0
      const targetY = i * STEP_Y + bounce * STEP_Y * STACK_ADD_BOUNCE
      mesh.position.y += (targetY - mesh.position.y) * kY
      if (bounce > 0.002) {
        mesh.userData.stackBounce = bounce * (1 - kB)
      } else {
        mesh.userData.stackBounce = 0
      }
      const target =
        (mesh.userData.stackTargetScale as number | undefined) ?? 1
      const s = mesh.scale.x
      const ns = s + (target - s) * kScale
      mesh.scale.setScalar(ns)
    })
  }

  /**
   * After `stack.popFromTop({ silent: true })`, detaches the top mesh for deposit flight.
   * Caller must `stack.notifyChange()` so HUD/sync see the new snapshot.
   */
  extractTopMeshForDeposit(item: GameItem): Object3D {
    if (this.meshes.length === 0) {
      throw new Error('StackVisual.extractTopMeshForDeposit: empty stack')
    }
    const lastId = this.prevIds[this.prevIds.length - 1]
    if (lastId !== item.id) {
      throw new Error('StackVisual.extractTopMeshForDeposit: item/stack mismatch')
    }
    const mesh = this.meshes.pop()!
    this.prevIds.pop()
    this.anchor.updateMatrixWorld(true)
    mesh.updateMatrixWorld(true)
    const w = new Vector3()
    mesh.getWorldPosition(w)
    mesh.userData.depositWorldStart = w.clone()
    mesh.userData.stackItemType = item.type
    this.anchor.remove(mesh)
    return mesh
  }

  recycleDepositedMesh(item: GameItem, mesh: Object3D): void {
    mesh.removeFromParent()
    mesh.visible = false
    delete mesh.userData.stackItemId
    delete mesh.userData.depositWorldStart
    const mix = mesh.userData.wispMixer as AnimationMixer | undefined
    if (mix) mix.stopAllAction()
    const rMix = mesh.userData.relicMixer as AnimationMixer | undefined
    if (rMix) rMix.stopAllAction()
    if (item.type === 'wisp') {
      if (this.poolWisp.length < StackVisual.MAX_POOL) this.poolWisp.push(mesh)
      else this.disposeMesh(mesh)
      return
    }
    const v = item.relicVariant
    if (this.poolRelic[v].length < StackVisual.MAX_POOL) this.poolRelic[v].push(mesh)
    else this.disposeMesh(mesh)
  }

  private fullRebuild(items: readonly GameItem[]): void {
    this.clearMeshes()
    items.forEach((item, i) => {
      const mesh = this.obtainMesh(item)
      const baseScale = stackMeshBaseScale(mesh)
      mesh.userData.stackItemId = item.id
      mesh.userData.stackItemType = item.type
      mesh.userData.stackTargetScale = baseScale
      mesh.userData.stackBounce = 0
      mesh.position.y = i * STEP_Y
      mesh.scale.setScalar(baseScale)
      this.anchor.add(mesh)
      this.meshes.push(mesh)
    })
  }

  private clearMeshes(): void {
    for (const m of this.meshes) {
      this.anchor.remove(m)
      const t = m.userData.stackItemType as GameItem['type'] | undefined
      if (t === 'wisp' && this.poolWisp.length < StackVisual.MAX_POOL) {
        m.visible = false
        this.poolWisp.push(m)
        continue
      }
      if (t === 'relic') {
        const v = (m.userData.relicVariant as 0 | 1 | undefined) ?? 0
        if (this.poolRelic[v].length < StackVisual.MAX_POOL) {
          m.visible = false
          this.poolRelic[v].push(m)
          continue
        }
      }
      this.disposeMesh(m)
    }
    this.meshes = []
  }

  private obtainMesh(item: GameItem): Object3D {
    if (item.type === 'wisp' && this.poolWisp.length > 0) {
      const m = this.poolWisp.pop()!
      m.visible = true
      return m
    }
    if (item.type === 'relic') {
      const v = item.relicVariant
      const pool = this.poolRelic[v]
      if (pool.length > 0) {
        const m = pool.pop()!
        m.visible = true
        return m
      }
    }
    return createStackMesh(item)
  }

  private disposeMesh(m: Object3D): void {
    if (m.userData.wispGltf === true) {
      disposeWispGltfClone(m)
      return
    }
    if (m.userData.relicGltf === true) {
      disposeRelicGltfClone(m)
      return
    }
    m.traverse((o) => {
      if (o instanceof Sprite) {
        const sm = o.material as SpriteMaterial
        sm.map?.dispose()
        sm.dispose()
        return
      }
      if (o instanceof Mesh) {
        o.geometry.dispose()
        const mat = o.material
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat.dispose()
      }
    })
  }
}
