import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  CapsuleGeometry,
  Color,
  Group,
  LoopRepeat,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  SkinnedMesh,
  SphereGeometry,
} from 'three'
import { clone as cloneSkinnedHierarchy } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { PlayerGltfTemplate } from './playerGltfAsset.ts'

/** World units / sec — matches previous procedural “moving” threshold */
const MOVE_SPEED_THRESH = 0.35
const GLB_CROSSFADE_SEC = 0.26
/** Model scale — GLB rigs are often authored huge; keep small vs level geometry */
const PLAYER_GLB_SCALE = 0.2
/**
 * Rig forward often opposes game forward (−Z velocity); π flips so walk matches move direction.
 */
const PLAYER_GLB_YAW_OFFSET = Math.PI
/** Vertical offset so feet sit on floor (depends on bind pose) */
const PLAYER_GLB_Y_OFFSET = 0
/**
 * Stack anchor behind the character. In Three.js, local forward is −Z, so “behind” is +Z.
 * (Negative Z was in front of the rig — pile read as floating ahead.)
 */
const STACK_ANCHOR_LOCAL = { x: 0, y: 1.35, z: 3.65 }

export type PlayerCharacterAnimState = {
  /** Seconds, for idle sine */
  timeSec: number
  /** Horizontal speed (world XZ) */
  speed: number
  /** Velocity X (world) for lateral lean */
  velX: number
  itemsCarried: number
  maxCarry: number
  /** Ghost pulse (auto timed) — strong shirt / skin glow */
  powerMode?: boolean
  /** Ghost hit i-frames — blink read */
  ghostInvuln?: boolean
  /** Seconds of “collecting” clip after a pickup (GLB only) */
  recentPickupSec?: number
}

function findClip(
  clips: readonly AnimationClip[],
  keywords: string[],
): AnimationClip | null {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  for (const kw of keywords) {
    const k = norm(kw)
    for (const c of clips) {
      const n = norm(c.name)
      if (n === k || n.includes(k)) return c
    }
  }
  return null
}

/** Prefer exact name match so “running” doesn’t accidentally match a longer idle clip name. */
function findClipPreferExact(
  clips: readonly AnimationClip[],
  exactFirst: readonly string[],
  fallbackKeywords: readonly string[],
): AnimationClip | null {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  for (const ex of exactFirst) {
    const k = norm(ex)
    for (const c of clips) {
      if (norm(c.name) === k) return c
    }
  }
  return findClip(clips, [...fallbackKeywords])
}

type TintMat = MeshStandardMaterial | MeshPhysicalMaterial

function isTintMat(m: unknown): m is TintMat {
  return m instanceof MeshStandardMaterial || m instanceof MeshPhysicalMaterial
}

type GltfAnimBundle = {
  mixer: AnimationMixer
  idle: AnimationAction | null
  running: AnimationAction | null
  collecting: AnimationAction | null
  current: AnimationAction | null
  tintMats: { mat: TintMat; color: Color; emissive: Color; emissiveIntensity: number }[]
}

/**
 * Player character: GLB with idle / collecting / running when a template is provided;
 * collecting plays only outside power-up; in power-up, idle vs running follows movement.
 * otherwise procedural capsule + sphere (legacy).
 */
export class PlayerCharacterVisual {
  readonly root: Group
  readonly stackAnchor: Object3D

  private readonly mode: 'gltf' | 'procedural'
  private readonly bobGroup: Group
  private readonly leanGroup: Group
  private readonly baseBobY: number
  private readonly shirtMat: MeshStandardMaterial | null
  private readonly shirtColorSnap: Color | null
  private readonly skinMat: MeshStandardMaterial | null
  private readonly skinColorSnap: Color | null
  private gltfAnim: GltfAnimBundle | null = null

  constructor(gltfTemplate?: PlayerGltfTemplate | null) {
    this.root = new Group()
    this.root.name = 'playerCharacter'

    this.stackAnchor = new Object3D()
    this.stackAnchor.name = 'stackAnchor'

    if (gltfTemplate) {
      this.mode = 'gltf'
      this.shirtMat = null
      this.shirtColorSnap = null
      this.skinMat = null
      this.skinColorSnap = null
      this.bobGroup = new Group()
      this.bobGroup.name = 'bob'
      this.root.add(this.bobGroup)
      this.leanGroup = new Group()
      this.leanGroup.name = 'lean'
      this.bobGroup.add(this.leanGroup)

      const model = cloneSkinnedHierarchy(gltfTemplate.scenePrototype) as Group
      model.name = 'playerGltfModel'
      model.position.y = PLAYER_GLB_Y_OFFSET
      model.rotation.y = PLAYER_GLB_YAW_OFFSET
      model.scale.setScalar(PLAYER_GLB_SCALE)
      model.updateMatrixWorld(true)
      this.leanGroup.add(model)

      model.traverse((o) => {
        if (o instanceof Mesh || o instanceof SkinnedMesh) {
          o.castShadow = true
          o.receiveShadow = true
        }
      })

      const tintMats: GltfAnimBundle['tintMats'] = []
      model.traverse((o) => {
        if (o instanceof Mesh || o instanceof SkinnedMesh) {
          const mat = o.material
          const mats = Array.isArray(mat) ? mat : [mat]
          for (const m of mats) {
            if (isTintMat(m)) {
              tintMats.push({
                mat: m,
                color: m.color.clone(),
                emissive: m.emissive.clone(),
                emissiveIntensity: m.emissiveIntensity,
              })
            }
          }
        }
      })

      const clips = gltfTemplate.animations
      const idleClip = findClipPreferExact(
        clips,
        ['idle'],
        ['idle', 'Idle'],
      )
      const runClip = findClipPreferExact(
        clips,
        ['running', 'run'],
        ['running', 'run', 'Run', 'walk', 'Walk'],
      )
      const collectClip = findClipPreferExact(
        clips,
        ['collecting', 'collect'],
        ['collecting', 'collect', 'Collecting'],
      )

      const mixer = new AnimationMixer(model)
      const idle = idleClip ? mixer.clipAction(idleClip) : null
      const running = runClip ? mixer.clipAction(runClip) : null
      const collecting = collectClip ? mixer.clipAction(collectClip) : null

      for (const a of [idle, running, collecting]) {
        if (a) {
          a.setLoop(LoopRepeat, Infinity)
          a.clampWhenFinished = false
        }
      }

      let start: AnimationAction | null = idle ?? running ?? collecting
      if (start) {
        start.reset().setEffectiveWeight(1).fadeIn(0.12).play()
      }

      this.gltfAnim = {
        mixer,
        idle,
        running,
        collecting,
        current: start,
        tintMats,
      }

      const s = PLAYER_GLB_SCALE
      this.stackAnchor.position.set(
        STACK_ANCHOR_LOCAL.x * s,
        STACK_ANCHOR_LOCAL.y * s,
        STACK_ANCHOR_LOCAL.z * s,
      )
      this.leanGroup.add(this.stackAnchor)
      this.baseBobY = this.bobGroup.position.y
    } else {
      this.mode = 'procedural'
      this.bobGroup = new Group()
      this.bobGroup.name = 'bob'
      this.root.add(this.bobGroup)

      this.leanGroup = new Group()
      this.leanGroup.name = 'lean'
      this.bobGroup.add(this.leanGroup)

      const skin = new MeshStandardMaterial({
        color: new Color(0xff8a5c),
        emissive: new Color(0x000000),
        emissiveIntensity: 0,
        roughness: 0.4,
        metalness: 0.08,
      })
      this.skinMat = skin
      this.skinColorSnap = skin.color.clone()
      const shirt = new MeshStandardMaterial({
        color: new Color(0x4cb0e0),
        emissive: new Color(0x1a4060),
        emissiveIntensity: 0.12,
        roughness: 0.5,
        metalness: 0.05,
      })
      this.shirtMat = shirt
      this.shirtColorSnap = shirt.color.clone()
      const dark = new MeshStandardMaterial({
        color: new Color(0x3a3c48),
        roughness: 0.68,
        metalness: 0.08,
      })

      const torso = new Mesh(
        new CapsuleGeometry(0.34, 0.52, 6, 12),
        shirt,
      )
      torso.position.y = 0.62
      torso.castShadow = true
      torso.receiveShadow = true
      this.leanGroup.add(torso)

      const head = new Mesh(new SphereGeometry(0.36, 14, 12), skin)
      head.position.y = 1.18
      head.castShadow = true
      head.receiveShadow = true
      this.leanGroup.add(head)

      const footGeo = new SphereGeometry(0.16, 10, 8)
      const footL = new Mesh(footGeo, dark)
      footL.position.set(-0.22, 0.14, 0.08)
      footL.scale.set(1, 0.55, 1.25)
      footL.castShadow = true
      const footR = new Mesh(footGeo, dark)
      footR.position.set(0.22, 0.14, 0.08)
      footR.scale.set(1, 0.55, 1.25)
      footR.castShadow = true
      this.leanGroup.add(footL, footR)

      this.stackAnchor.position.set(
        STACK_ANCHOR_LOCAL.x,
        STACK_ANCHOR_LOCAL.y,
        STACK_ANCHOR_LOCAL.z,
      )
      this.leanGroup.add(this.stackAnchor)

      this.baseBobY = this.bobGroup.position.y
    }
  }

  dispose(): void {
    if (this.gltfAnim) {
      this.gltfAnim.mixer.stopAllAction()
      this.root.traverse((o) => {
        if (o instanceof Mesh || o instanceof SkinnedMesh) {
          o.geometry?.dispose()
          const mat = o.material
          const mats = Array.isArray(mat) ? mat : [mat]
          for (const m of mats) {
            m.dispose()
          }
        }
      })
      this.gltfAnim = null
    } else if (this.shirtMat && this.skinMat) {
      this.root.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry?.dispose()
          const mat = o.material
          const mats = Array.isArray(mat) ? mat : [mat]
          for (const m of mats) {
            m.dispose()
          }
        }
      })
    }
  }

  update(dt: number, state: PlayerCharacterAnimState): void {
    if (this.mode === 'gltf') {
      this.updateGltf(dt, state)
    } else {
      this.updateProcedural(dt, state)
    }
  }

  private pickGltfTarget(
    state: PlayerCharacterAnimState,
  ): AnimationAction | null {
    const g = this.gltfAnim
    if (!g) return null
    const pickupT = state.recentPickupSec ?? 0
    const moving = state.speed > MOVE_SPEED_THRESH
    const power = state.powerMode === true

    /** Power-up: idle when still, running when moving — never the collecting clip. */
    if (!power && pickupT > 0 && g.collecting) return g.collecting
    if (moving && g.running) return g.running
    if (g.idle) return g.idle
    if (g.running) return g.running
    return g.collecting
  }

  private updateGltf(dt: number, state: PlayerCharacterAnimState): void {
    const g = this.gltfAnim
    if (!g) return

    const target = this.pickGltfTarget(state)
    if (target && target !== g.current) {
      const prev = g.current
      if (prev) {
        prev.fadeOut(GLB_CROSSFADE_SEC)
      }
      target.reset().fadeIn(GLB_CROSSFADE_SEC).play()
      g.current = target
    }
    g.mixer.update(dt)

    const power = state.powerMode === true
    const invuln = state.ghostInvuln === true

    for (const snap of g.tintMats) {
      const { mat } = snap
      if (invuln) {
        const blink = 0.5 + 0.5 * Math.sin(state.timeSec * 14)
        const on = blink > 0.52
        mat.color.copy(snap.color).lerp(new Color(0xffffff), on ? 0.28 : 0.04)
        mat.emissive.copy(snap.emissive).lerp(new Color(0xccddee), on ? 0.45 : 0.08)
        mat.emissiveIntensity = snap.emissiveIntensity + (on ? 0.35 : 0.06)
      } else if (power) {
        mat.color.copy(snap.color).lerp(new Color(0xffd080), 0.45)
        mat.emissive.copy(snap.emissive).lerp(new Color(0xc9a020), 0.55)
        mat.emissiveIntensity = snap.emissiveIntensity + 0.4
      } else {
        mat.color.copy(snap.color)
        mat.emissive.copy(snap.emissive)
        mat.emissiveIntensity = snap.emissiveIntensity
      }
    }

    const { timeSec, speed, velX, itemsCarried, maxCarry } = state
    const moving = speed > MOVE_SPEED_THRESH
    const carryT = maxCarry > 0 ? itemsCarried / maxCarry : 0

    let bob =
      Math.sin(timeSec * 2.2) * 0.012 +
      (moving ? Math.sin(timeSec * 10.5) * 0.008 : 0)
    if (moving) bob += Math.sin(timeSec * 7) * 0.005

    this.bobGroup.position.y = this.baseBobY + bob

    const leanBack = carryT * -0.1
    const tiltFwd = moving ? 0.04 : 0
    this.leanGroup.rotation.x = leanBack + tiltFwd

    const maxS = 12
    const steer = Math.max(-1, Math.min(1, velX / maxS))
    const sway = moving ? Math.sin(timeSec * 11) * 0.018 : 0
    this.leanGroup.rotation.z = sway + steer * -0.08
  }

  private updateProcedural(dt: number, state: PlayerCharacterAnimState): void {
    void dt
    if (!this.shirtMat || !this.shirtColorSnap || !this.skinMat || !this.skinColorSnap) {
      return
    }
    const { timeSec, speed, velX, itemsCarried, maxCarry } = state
    const power = state.powerMode === true
    const invuln = state.ghostInvuln === true

    const shirtMat = this.shirtMat
    const shirtColorSnap = this.shirtColorSnap
    const skinMat = this.skinMat
    const skinColorSnap = this.skinColorSnap

    if (invuln) {
      const blink = 0.5 + 0.5 * Math.sin(timeSec * 14)
      const on = blink > 0.52
      shirtMat.color
        .copy(shirtColorSnap)
        .lerp(new Color(0xffffff), on ? 0.38 : 0.06)
      shirtMat.emissive.setHex(on ? 0xccddee : 0x223344)
      shirtMat.emissiveIntensity = on ? 0.42 : 0.08
      skinMat.color.copy(skinColorSnap)
      skinMat.emissive.setHex(0x000000)
      skinMat.emissiveIntensity = 0
    } else if (power) {
      shirtMat.color.copy(shirtColorSnap).lerp(new Color(0xffd080), 0.58)
      shirtMat.emissive.setHex(0xc9a020)
      shirtMat.emissiveIntensity = 0.62
      skinMat.color.copy(skinColorSnap).lerp(new Color(0xffe8c8), 0.4)
      skinMat.emissive.setHex(0x8a6010)
      skinMat.emissiveIntensity = 0.26
    } else {
      shirtMat.color.copy(shirtColorSnap)
      shirtMat.emissive.setHex(0x1a4060)
      shirtMat.emissiveIntensity = 0.12
      skinMat.color.copy(skinColorSnap)
      skinMat.emissive.setHex(0x000000)
      skinMat.emissiveIntensity = 0
    }
    const moving = speed > MOVE_SPEED_THRESH
    const carryT = maxCarry > 0 ? itemsCarried / maxCarry : 0

    let bob =
      Math.sin(timeSec * 2.2) * 0.018 +
      (moving ? Math.sin(timeSec * 10.5) * 0.012 : 0)

    if (moving) {
      bob += Math.sin(timeSec * 7) * 0.008
    }

    this.bobGroup.position.y = this.baseBobY + bob

    const leanBack = carryT * -0.14
    const tiltFwd = moving ? 0.07 : 0
    this.leanGroup.rotation.x = leanBack + tiltFwd

    const maxS = 12
    const steer = Math.max(-1, Math.min(1, velX / maxS))
    const sway = moving ? Math.sin(timeSec * 11) * 0.028 : 0
    this.leanGroup.rotation.z = sway + steer * -0.11
  }
}
