import {
  AnimationMixer,
  Mesh,
  Sprite,
  SpriteMaterial,
  type Group,
  type Object3D,
  type Scene,
} from 'three'
import type { DoorUnlockSystem } from '../doors/DoorUnlockSystem.ts'
import type { RoomSystem } from '../world/RoomSystem.ts'
import type { RoomId } from '../world/mansionRoomData.ts'
import { computeClutterRevealOpacity } from '../clutter/clutterRevealOpacity.ts'
import type { GameItem } from '../../core/types/GameItem.ts'
import { isWorldPickupInteractable } from './pickupWorldState.ts'
import { disposeClutterGltfClone } from '../clutter/clutterGltfAsset.ts'
import { disposeRelicGltfClone } from '../relic/relicGltfAsset.ts'
import { disposeGridWispClone } from '../grid/gridWispGltfAsset.ts'
import { disposeWispGltfClone } from '../wisp/wispGltfAsset.ts'
import { createPickupMesh } from './ItemVisuals.ts'
import {
  attachPickupIdleMotion,
  updatePickupIdleMotion,
} from './PickupMotion.ts'
import { COLLECT_POP_SEC } from '../../juice/juiceConfig.ts'

type RecoverState = {
  ttlRemain: number
  vx: number
  vy: number
  vz: number
  landed: boolean
}

type Entry = { mesh: Object3D; item: GameItem; recover?: RecoverState }

type CollectAnim = { mesh: Object3D; t: number }

const CLUTTER_FADE_EPS = 1e-3

/**
 * GLTF clutter shares prototype materials; clone once per instance before animating opacity.
 */
function cloneMaterialsForClutterFade(root: Object3D): void {
  root.traverse((o) => {
    if (o instanceof Mesh) {
      const m = o.material
      const mats = Array.isArray(m) ? m : [m]
      const newMats = mats.map((mat) => {
        const c = mat.clone()
        const base =
          'opacity' in c && typeof c.opacity === 'number' ? c.opacity : 1
        c.userData.clutterFadeBase = base
        return c
      })
      o.material = Array.isArray(m) ? newMats : newMats[0]!
    }
    if (o instanceof Sprite) {
      const sm = o.material as SpriteMaterial
      const c = sm.clone()
      const base = typeof sm.opacity === 'number' ? sm.opacity : 1
      c.userData.clutterFadeBase = base
      o.material = c
    }
  })
}

function applyClutterRevealOpacity(root: Object3D, alpha: number): void {
  const prevAlpha = root.userData.clutterRevealAlpha as number | undefined
  if (prevAlpha !== undefined && Math.abs(prevAlpha - alpha) <= 1e-4) {
    return
  }
  root.userData.clutterRevealAlpha = alpha

  if (alpha <= CLUTTER_FADE_EPS) {
    root.visible = false
    return
  }
  root.visible = true
  if (alpha < 1 - CLUTTER_FADE_EPS) {
    if (!root.userData.clutterFadeMaterialsOwned) {
      cloneMaterialsForClutterFade(root)
      root.userData.clutterFadeMaterialsOwned = true
    }
    root.traverse((o) => {
      if (o instanceof Mesh) {
        const m = o.material
        const mats = Array.isArray(m) ? m : [m]
        for (const mat of mats) {
          const base =
            (mat.userData.clutterFadeBase as number | undefined) ?? 1
          mat.transparent = true
          mat.opacity = base * alpha
          if ('depthWrite' in mat) {
            ;(mat as { depthWrite: boolean }).depthWrite = alpha >= 0.995
          }
        }
      }
      if (o instanceof Sprite) {
        const m = o.material as SpriteMaterial
        const base = (m.userData.clutterFadeBase as number | undefined) ?? 1
        m.transparent = true
        m.opacity = base * alpha
      }
    })
    return
  }

  if (!root.userData.clutterFadeMaterialsOwned) return
  root.traverse((o) => {
    if (o instanceof Mesh) {
      const m = o.material
      const mats = Array.isArray(m) ? m : [m]
      for (const mat of mats) {
        const base = (mat.userData.clutterFadeBase as number | undefined) ?? 1
        mat.opacity = base
        mat.transparent = base < 1 - CLUTTER_FADE_EPS
        if ('depthWrite' in mat) {
          ;(mat as { depthWrite: boolean }).depthWrite = true
        }
      }
    }
    if (o instanceof Sprite) {
      const m = o.material as SpriteMaterial
      const base = (m.userData.clutterFadeBase as number | undefined) ?? 1
      m.opacity = base
      m.transparent = base < 1 - CLUTTER_FADE_EPS
    }
  })
}

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
  private readonly pooledClutterMeshes: Object3D[][] = Array.from(
    { length: 7 },
    () => [],
  )
  private readonly gridPickupMeshesByRoom = new Map<RoomId, Set<Object3D>>()
  private readonly gridPickupVisibleByRoom = new Map<RoomId, boolean>()
  private readonly clutterMeshesByRoom = new Map<RoomId, Set<Object3D>>()
  private readonly clutterRevealAlphaByRoom = new Map<RoomId, number>()

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

  spawn(
    item: GameItem,
    x: number,
    z: number,
    opts?: { visible?: boolean },
  ): void {
    if (this.byId.has(item.id)) return
    const mesh = this.obtainMesh(item)
    const y = mesh.position.y
    mesh.position.set(x, y, z)
    const show = opts?.visible !== false
    if (
      (item.type === 'wisp' || item.type === 'power_pellet') &&
      item.spawnRoomId
    ) {
      mesh.userData.gridWispSpawnRoomId = item.spawnRoomId
      this.registerGridPickupMesh(item.spawnRoomId, mesh)
    }
    if (item.type === 'clutter') {
      mesh.userData.clutterSpawnRoomId = item.spawnRoomId
      mesh.userData.clutterWorldInteractable = show
      if (!mesh.userData.clutterFadeMaterialsOwned) {
        cloneMaterialsForClutterFade(mesh)
        mesh.userData.clutterFadeMaterialsOwned = true
      }
      mesh.rotation.y = Math.random() * Math.PI * 2
      const base = (mesh.userData.clutterBaseScale as number | undefined) ?? 1
      const mul = 0.8 + Math.random() * 0.4
      mesh.scale.setScalar(base * mul)
      if (item.spawnRoomId) {
        this.registerClutterMesh(item.spawnRoomId, mesh)
        const alpha = this.clutterRevealAlphaByRoom.get(item.spawnRoomId)
        if (alpha !== undefined) {
          applyClutterRevealOpacity(mesh, alpha)
          mesh.userData.clutterWorldInteractable = alpha >= 1 - CLUTTER_FADE_EPS
        }
      }
    }
    mesh.visible = show
    attachPickupIdleMotion(
      mesh,
      item.type === 'wisp' || item.type === 'power_pellet' ? 'wisp' : 'pellet',
    )
    this.pickupGroup.add(mesh)
    this.byId.set(item.id, { mesh, item })
  }

  /**
   * Dropped items (ghost hit / traps): short TTL, pop + bounce, then behave as normal pickups.
   */
  spawnRecoverable(
    item: GameItem,
    x: number,
    z: number,
    ttlSec: number,
    opts?: { horizontalKick?: number; popVy?: number },
  ): void {
    if (this.byId.has(item.id)) return
    const mesh = this.obtainMesh(item)
    mesh.position.set(x, mesh.position.y, z)
    mesh.userData.recoverGroundY = mesh.position.y
    const ang = Math.random() * Math.PI * 2
    const hk = opts?.horizontalKick ?? 2.2 + Math.random() * 2.8
    const recover: RecoverState = {
      ttlRemain: ttlSec,
      vx: Math.cos(ang) * hk,
      vy: opts?.popVy ?? 4.2 + Math.random() * 2.4,
      vz: Math.sin(ang) * hk,
      landed: false,
    }
    mesh.visible = true
    this.pickupGroup.add(mesh)
    this.byId.set(item.id, { mesh, item, recover })
  }

  remove(id: string): void {
    const e = this.byId.get(id)
    if (!e) return
    this.unregisterRoomTrackedMesh(e.item, e.mesh)
    this.pickupGroup.remove(e.mesh)
    this.disposeMesh(e.mesh)
    this.byId.delete(id)
  }

  /** True if any relic pickup is still on the ground (not carried). */
  hasRelicOnGround(): boolean {
    for (const { item } of this.byId.values()) {
      if (item.type === 'relic') return true
    }
    return false
  }

  detachPickupForCollect(id: string): void {
    const e = this.byId.get(id)
    if (!e) return
    this.unregisterRoomTrackedMesh(e.item, e.mesh)
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

  /** World clutter only (not carried). */
  countClutter(): number {
    let n = 0
    for (const [, { item }] of this.byId) {
      if (item.type === 'clutter') n += 1
    }
    return n
  }

  /**
   * Per-frame: locked rooms stay hidden; during gate sink, clutter fades in (opacity 0→1)
   * without respawning — only visibility, materials, and `clutterWorldInteractable`.
   */
  updateClutterGateReveal(doorUnlock: DoorUnlockSystem): void {
    for (const [roomId, meshes] of this.clutterMeshesByRoom) {
      const alpha = computeClutterRevealOpacity(roomId, doorUnlock)
      const prevAlpha = this.clutterRevealAlphaByRoom.get(roomId)
      if (prevAlpha !== undefined && Math.abs(prevAlpha - alpha) <= 1e-4) {
        continue
      }
      this.clutterRevealAlphaByRoom.set(roomId, alpha)
      const interactable = alpha >= 1 - CLUTTER_FADE_EPS
      for (const mesh of meshes) {
        applyClutterRevealOpacity(mesh, alpha)
        mesh.userData.clutterWorldInteractable = interactable
      }
    }
  }

  /** Locked rooms: hide grid wisps until southern doors grant access (no fade — instant show). */
  updateGridWispRoomVisibility(roomSystem: RoomSystem): void {
    for (const [roomId, meshes] of this.gridPickupMeshesByRoom) {
      const visible = roomSystem.isRoomAccessibleForGameplay(roomId)
      const prevVisible = this.gridPickupVisibleByRoom.get(roomId)
      if (prevVisible === visible) continue
      this.gridPickupVisibleByRoom.set(roomId, visible)
      for (const mesh of meshes) {
        mesh.visible = visible
      }
    }
  }

  /**
   * Temporarily reveals every room-bound grid pickup so the renderer can compile those materials
   * before the player hits the next doorway.
   */
  withAllGridPickupsVisible<T>(work: () => T): T {
    const prev = new Map<Object3D, boolean>()
    for (const meshes of this.gridPickupMeshesByRoom.values()) {
      for (const mesh of meshes) {
        prev.set(mesh, mesh.visible)
        mesh.visible = true
      }
    }
    try {
      return work()
    } finally {
      for (const [mesh, visible] of prev) {
        mesh.visible = visible
      }
    }
  }

  /**
   * Temporary full-room reveal for shader compilation so room entry does not pay a first-visibility hitch.
   */
  withAllRoomContentVisible<T>(work: () => T): T {
    const prevVisible = new Map<Object3D, boolean>()
    const prevClutterAlpha = new Map<Object3D, number>()
    const prevClutterInteractable = new Map<Object3D, boolean>()

    for (const meshes of this.gridPickupMeshesByRoom.values()) {
      for (const mesh of meshes) {
        prevVisible.set(mesh, mesh.visible)
        mesh.visible = true
      }
    }

    for (const meshes of this.clutterMeshesByRoom.values()) {
      for (const mesh of meshes) {
        prevVisible.set(mesh, mesh.visible)
        prevClutterAlpha.set(
          mesh,
          (mesh.userData.clutterRevealAlpha as number | undefined) ?? 1,
        )
        prevClutterInteractable.set(
          mesh,
          mesh.userData.clutterWorldInteractable === true,
        )
        applyClutterRevealOpacity(mesh, 1)
        mesh.userData.clutterWorldInteractable = true
      }
    }

    try {
      return work()
    } finally {
      for (const [mesh, alpha] of prevClutterAlpha) {
        applyClutterRevealOpacity(mesh, alpha)
      }
      for (const [mesh, interactable] of prevClutterInteractable) {
        mesh.userData.clutterWorldInteractable = interactable
      }
      for (const [mesh, visible] of prevVisible) {
        mesh.visible = visible
      }
    }
  }

  async withAllRoomContentVisibleAsync<T>(work: () => Promise<T>): Promise<T> {
    const prevVisible = new Map<Object3D, boolean>()
    const prevClutterAlpha = new Map<Object3D, number>()
    const prevClutterInteractable = new Map<Object3D, boolean>()

    for (const meshes of this.gridPickupMeshesByRoom.values()) {
      for (const mesh of meshes) {
        prevVisible.set(mesh, mesh.visible)
        mesh.visible = true
      }
    }

    for (const meshes of this.clutterMeshesByRoom.values()) {
      for (const mesh of meshes) {
        prevVisible.set(mesh, mesh.visible)
        prevClutterAlpha.set(
          mesh,
          (mesh.userData.clutterRevealAlpha as number | undefined) ?? 1,
        )
        prevClutterInteractable.set(
          mesh,
          mesh.userData.clutterWorldInteractable === true,
        )
        applyClutterRevealOpacity(mesh, 1)
        mesh.userData.clutterWorldInteractable = true
      }
    }

    try {
      return await work()
    } finally {
      for (const [mesh, alpha] of prevClutterAlpha) {
        applyClutterRevealOpacity(mesh, alpha)
      }
      for (const [mesh, interactable] of prevClutterInteractable) {
        mesh.userData.clutterWorldInteractable = interactable
      }
      for (const [mesh, visible] of prevVisible) {
        mesh.visible = visible
      }
    }
  }

  /**
   * Pre-allocate clutter visuals to reduce hitches when many spawns appear at once.
   */
  prewarmClutterPool(perVariant: number): void {
    const n = Math.max(0, Math.floor(perVariant))
    for (let v = 0; v < 7; v++) {
      for (let i = 0; i < n; i++) {
        const warmId = `__warm_clutter_${v}_${i}`
        const mesh = createPickupMesh({
          id: warmId,
          kind: 'collectible',
          type: 'clutter',
          clutterVariant: v as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          spawnRoomId: 'ROOM_1',
          haunted: false,
          value: 0,
        })
        if (!this.tryPoolMesh(mesh)) {
          this.disposeMesh(mesh)
        }
      }
    }
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
    const g = 24
    const expired: string[] = []
    for (const [id, e] of this.byId) {
      const r = e.recover
      if (!r) continue
      r.ttlRemain -= dt
      if (r.ttlRemain <= 0) {
        expired.push(id)
        continue
      }
      r.vy -= g * dt
      e.mesh.position.x += r.vx * dt
      e.mesh.position.z += r.vz * dt
      e.mesh.position.y += r.vy * dt
      const gy = (e.mesh.userData.recoverGroundY as number | undefined) ?? 0
      if (e.mesh.position.y < gy) {
        e.mesh.position.y = gy
        r.vy *= -0.36
        r.vx *= 0.87
        r.vz *= 0.87
        if (!r.landed) {
          r.landed = true
          attachPickupIdleMotion(
            e.mesh,
            e.item.type === 'wisp' ? 'wisp' : 'pellet',
          )
        }
      }
    }
    for (const id of expired) {
      this.remove(id)
    }

    for (const [, { mesh, item, recover }] of this.byId) {
      if (!isWorldPickupInteractable(mesh, item)) continue
      if (recover && !recover.landed) continue
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
      } else if (item.type === 'gem') {
        const gem = mesh.userData.gemBody as Mesh | undefined
        if (gem) {
          gem.rotation.y += dt * 1.15
          const phase =
            item.gemColor === 'red' ? 0.2 : item.gemColor === 'blue' ? 1.1 : 2.4
          const pulse = 0.93 + 0.07 * Math.sin(timeSec * 4.2 + phase)
          gem.scale.setScalar(pulse)
        }
      } else if (item.type === 'power_pellet') {
        const body = mesh.userData.powerPelletCore as Mesh | undefined
        const ring = mesh.userData.powerPelletRing as Mesh | undefined
        const ph = timeSec * 5.2
        if (body) {
          const pulse = 0.94 + 0.06 * Math.sin(ph)
          body.scale.setScalar(pulse)
          const bm = body.material
          if (bm && !Array.isArray(bm) && 'emissiveIntensity' in bm) {
            bm.emissiveIntensity = 1.65 + 0.35 * (0.5 + 0.5 * Math.sin(ph * 1.3))
          }
        }
        if (ring) {
          ring.rotation.z += dt * 2.4
          const rm = ring.material
          if (rm && !Array.isArray(rm) && 'emissiveIntensity' in rm) {
            rm.emissiveIntensity = 1.05 + 0.25 * (0.5 + 0.5 * Math.sin(ph * 0.9))
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
    if (root.userData.gridWispGltf === true) {
      disposeGridWispClone(root)
      return
    }
    if (root.userData.wispGltf === true) {
      disposeWispGltfClone(root)
      return
    }
    if (root.userData.relicGltf === true) {
      disposeRelicGltfClone(root)
      return
    }
    if (root.userData.clutterGltf === true) {
      disposeClutterGltfClone(root)
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
    if (item.type === 'clutter') {
      const v = item.clutterVariant
      const pool = this.pooledClutterMeshes[v]!
      if (pool.length > 0) {
        const mesh = pool.pop()!
        mesh.position.set(0, mesh.position.y, 0)
        const base = (mesh.userData.clutterBaseScale as number | undefined) ?? 1
        mesh.scale.setScalar(base)
        mesh.rotation.y = Math.random() * Math.PI * 2
        mesh.visible = true
        return mesh
      }
    }
    return createPickupMesh(item)
  }

  private tryPoolMesh(root: Object3D): boolean {
    if (
      root.userData.gridWispGltf === true ||
      root.userData.wispGltf === true ||
      root.userData.wispBody
    ) {
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
    if (root.userData.clutterPickup === true) {
      root.removeFromParent()
      root.visible = false
      delete root.userData.pickupIdle
      const v = (root.userData.clutterVariant as 0 | 1 | 2 | 3 | 4 | 5 | 6) ?? 0
      this.pooledClutterMeshes[v]!.push(root)
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

  private registerGridPickupMesh(roomId: RoomId, mesh: Object3D): void {
    let meshes = this.gridPickupMeshesByRoom.get(roomId)
    if (!meshes) {
      meshes = new Set<Object3D>()
      this.gridPickupMeshesByRoom.set(roomId, meshes)
    }
    meshes.add(mesh)
  }

  private registerClutterMesh(roomId: RoomId, mesh: Object3D): void {
    let meshes = this.clutterMeshesByRoom.get(roomId)
    if (!meshes) {
      meshes = new Set<Object3D>()
      this.clutterMeshesByRoom.set(roomId, meshes)
    }
    meshes.add(mesh)
  }

  private unregisterRoomTrackedMesh(item: GameItem, mesh: Object3D): void {
    const roomId = 'spawnRoomId' in item ? item.spawnRoomId : undefined
    if (!roomId) return

    if (item.type === 'wisp' || item.type === 'power_pellet') {
      const gridMeshes = this.gridPickupMeshesByRoom.get(roomId)
      if (gridMeshes) {
        gridMeshes.delete(mesh)
        if (gridMeshes.size === 0) {
          this.gridPickupMeshesByRoom.delete(roomId)
          this.gridPickupVisibleByRoom.delete(roomId)
        }
      }
    }

    if (item.type !== 'clutter') return
    const clutterMeshes = this.clutterMeshesByRoom.get(roomId)
    if (!clutterMeshes) return
    clutterMeshes.delete(mesh)
    if (clutterMeshes.size > 0) return
    this.clutterMeshesByRoom.delete(roomId)
    this.clutterRevealAlphaByRoom.delete(roomId)
  }
}
