import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Color,
  Group,
  LatheGeometry,
  LoopRepeat,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three'
import { clone as cloneSkinnedHierarchy } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { GhostGltfTemplate } from './ghostGltfAsset.ts'
import { GHOST_GLB_Y_OFFSET, GHOST_GLB_YAW_OFFSET, GHOST_VISUAL_SCALE } from './ghostConfig.ts'

/**
 * Silhouette from `version3` branch (`createGhostEnemy` / Pac-Man–style dome + skirt).
 * Shared geometries for performance; call `disposeGhostSharedGeometry()` on shutdown.
 */
const GHOST_PROFILE: Vector2[] = (() => {
  const p: Vector2[] = []
  p.push(new Vector2(0.002, 0))
  p.push(new Vector2(0.12, 0.025))
  p.push(new Vector2(0.22, 0.055))
  p.push(new Vector2(0.3, 0.1))
  p.push(new Vector2(0.34, 0.18))
  p.push(new Vector2(0.35, 0.28))
  p.push(new Vector2(0.33, 0.38))
  p.push(new Vector2(0.26, 0.48))
  p.push(new Vector2(0.14, 0.56))
  p.push(new Vector2(0, 0.58))
  return p
})()

const BODY_GEO = new LatheGeometry(GHOST_PROFILE, 26)
BODY_GEO.computeVertexNormals()

const EYE_WHITE_GEO = new SphereGeometry(0.068, 10, 8)
const PUPIL_GEO = new SphereGeometry(0.034, 8, 6)

const markShared = (m: Mesh): void => {
  m.userData.sharedGhostGeometry = true
}

export function disposeGhostSharedGeometry(): void {
  BODY_GEO.dispose()
  EYE_WHITE_GEO.dispose()
  PUPIL_GEO.dispose()
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

function tintableMaterial(
  m: unknown,
): m is MeshStandardMaterial | MeshPhysicalMaterial {
  return m instanceof MeshStandardMaterial || m instanceof MeshPhysicalMaterial
}

/**
 * `SkeletonUtils.clone` reuses materials by reference — every ghost would share one material,
 * so per-spawn tint and power-mode / resetSkin would fight and all ghosts would match.
 */
function cloneMeshMaterialsDeep(model: Group): void {
  model.traverse((o) => {
    if (!(o instanceof Mesh)) return
    const mat = o.material
    o.material = Array.isArray(mat) ? mat.map((m) => m.clone()) : mat.clone()
  })
}

function applyBodyTint(model: Group, bodyColor: number): void {
  const tint = new Color(bodyColor)
  model.traverse((o) => {
    if (o instanceof Mesh) {
      const mat = o.material
      const mats = Array.isArray(mat) ? mat : [mat]
      for (const m of mats) {
        if (tintableMaterial(m)) {
          m.color.multiplyScalar(0.42).add(tint.clone().multiplyScalar(0.58))
          m.emissive.lerp(tint, 0.22)
        }
      }
    }
  })
}

function createGltfGhostVisual(bodyColor: number, template: GhostGltfTemplate): Group {
  const root = new Group()
  const model = cloneSkinnedHierarchy(template.scenePrototype) as Group
  model.name = 'ghostGltfModel'
  model.position.y = GHOST_GLB_Y_OFFSET
  model.rotation.y = GHOST_GLB_YAW_OFFSET
  root.add(model)

  const s = GHOST_VISUAL_SCALE
  model.scale.setScalar(s)

  cloneMeshMaterialsDeep(model)

  model.traverse((o) => {
    if (o instanceof Mesh) {
      o.castShadow = true
      o.receiveShadow = true
      o.userData.isGhostBody = true
    }
  })
  applyBodyTint(model, bodyColor)

  const mixer = new AnimationMixer(model)
  const clips = template.animations
  const idleClip = findClip(clips, ['idle', 'Idle'])
  const chaseClip = findClip(clips, [
    'chasing',
    'chase',
    'Chase',
    'Chasing',
    'run',
    'Run',
  ])

  let idleAction: AnimationAction | null = null
  let chaseAction: AnimationAction | null = null
  const CROSS = 0.32
  let prevChase = false

  if (idleClip) idleAction = mixer.clipAction(idleClip)
  if (chaseClip) chaseAction = mixer.clipAction(chaseClip)

  const sameClip =
    Boolean(idleClip && chaseClip && idleClip === chaseClip) ||
    Boolean(idleAction && chaseAction && idleAction === chaseAction)

  if (idleAction) idleAction.setLoop(LoopRepeat, Infinity)
  if (chaseAction && chaseAction !== idleAction) {
    chaseAction.setLoop(LoopRepeat, Infinity)
  }
  if (idleAction) {
    idleAction.clampWhenFinished = false
    idleAction.enabled = true
    idleAction.paused = false
  }
  if (chaseAction) {
    chaseAction.clampWhenFinished = false
    chaseAction.enabled = true
    chaseAction.paused = false
  }

  if (idleAction && chaseAction && !sameClip) {
    idleAction.reset().setEffectiveWeight(1).play()
    chaseAction.reset().setEffectiveWeight(0).play()
  } else if (idleAction) {
    idleAction.reset().fadeIn(0.12).play()
  } else if (chaseAction) {
    chaseAction.reset().fadeIn(0.12).play()
  } else if (clips[0]) {
    mixer.clipAction(clips[0]).reset().play()
  }

  const setChaseAnim = (chasing: boolean): void => {
    if (!idleAction || !chaseAction || sameClip) return
    if (chasing === prevChase) return
    prevChase = chasing
    if (chasing) {
      idleAction.crossFadeTo(chaseAction, CROSS, false)
    } else {
      chaseAction.crossFadeTo(idleAction, CROSS, false)
    }
  }

  root.userData.updateGhostAnimation = (
    dt: number,
    _timeSec: number,
    _vx: number,
    _vz: number,
    chaseAnim?: boolean,
  ): void => {
    if (sameClip) {
      if (idleAction && !idleAction.isRunning()) idleAction.reset().play()
      mixer.update(dt)
      return
    }
    if (idleAction && chaseAction && !sameClip && chaseAnim !== undefined) {
      setChaseAnim(chaseAnim)
      if (chaseAnim && !chaseAction.isRunning()) {
        chaseAction.reset().play()
      } else if (!chaseAnim && !idleAction.isRunning()) {
        idleAction.reset().play()
      }
    }
    mixer.update(dt)
  }

  root.userData.disposeGhostAnim = (): void => {
    mixer.stopAllAction()
  }

  return root
}

/**
 * Procedural fallback when GLB is unavailable or invalid.
 */
export function createProceduralGhostVisual(bodyColor: number): Group {
  const root = new Group()
  const bobGroup = new Group()
  bobGroup.name = 'ghostBob'
  root.add(bobGroup)

  const baseColor = new Color(bodyColor)
  const bodyMat = new MeshStandardMaterial({
    color: baseColor,
    emissive: baseColor.clone(),
    emissiveIntensity: 0.48,
    roughness: 0.34,
    metalness: 0.08,
  })

  const body = new Mesh(BODY_GEO, bodyMat)
  body.name = 'ghostBody'
  body.userData.isGhostBody = true
  markShared(body)
  body.castShadow = true
  body.receiveShadow = true
  bobGroup.add(body)

  const eyeWhiteMat = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.22,
    roughness: 0.32,
    metalness: 0,
  })
  const pupilMat = new MeshStandardMaterial({
    color: 0x0a0a12,
    roughness: 0.5,
    metalness: 0,
  })

  const eyeWhiteL = new Mesh(EYE_WHITE_GEO, eyeWhiteMat.clone())
  const eyeWhiteR = new Mesh(EYE_WHITE_GEO, eyeWhiteMat.clone())
  const pupilL = new Mesh(PUPIL_GEO, pupilMat.clone())
  const pupilR = new Mesh(PUPIL_GEO, pupilMat.clone())
  markShared(eyeWhiteL)
  markShared(eyeWhiteR)
  markShared(pupilL)
  markShared(pupilR)
  eyeWhiteMat.dispose()
  pupilMat.dispose()

  eyeWhiteL.position.set(-0.12, 0.36, 0.29)
  eyeWhiteR.position.set(0.12, 0.36, 0.29)
  pupilL.position.set(-0.12, 0.36, 0.34)
  pupilR.position.set(0.12, 0.36, 0.34)

  eyeWhiteL.name = 'ghostEyeL'
  eyeWhiteR.name = 'ghostEyeR'
  pupilL.name = 'ghostPupilL'
  pupilR.name = 'ghostPupilR'

  bobGroup.add(eyeWhiteL, eyeWhiteR, pupilL, pupilR)

  const s = GHOST_VISUAL_SCALE
  bobGroup.scale.set(s, s, s)

  const basePupilL = new Vector3(-0.12, 0.36, 0.34)
  const basePupilR = new Vector3(0.12, 0.36, 0.34)
  const baseBobY = bobGroup.position.y
  let animPhase = Math.random() * Math.PI * 2
  const velWorld = new Vector3()
  const qInv = new Quaternion()

  root.userData.updateGhostAnimation = (
    dt: number,
    timeSec: number,
    vx: number,
    vz: number,
  ): void => {
    animPhase += dt * 2.2
    const bob =
      Math.sin(animPhase) * 0.028 + Math.sin(timeSec * 2.8) * 0.01
    bobGroup.position.y = baseBobY + bob

    const wobble = 1 + Math.sin(animPhase * 1.2) * 0.012
    bobGroup.scale.set(s * wobble, s * (1 + Math.sin(animPhase * 1.2) * 0.018), s * wobble)

    const hs = Math.hypot(vx, vz)
    const maxOff = 0.022
    if (hs > 0.06) {
      velWorld.set(vx, 0, vz)
      qInv.copy(root.quaternion).invert()
      velWorld.applyQuaternion(qInv)
      const lateral = velWorld.x / hs
      const forward = velWorld.z / hs
      pupilL.position.x = basePupilL.x + lateral * maxOff
      pupilL.position.z = basePupilL.z + forward * maxOff * 0.4
      pupilL.position.y = basePupilL.y
      pupilR.position.x = basePupilR.x + lateral * maxOff
      pupilR.position.z = basePupilR.z + forward * maxOff * 0.4
      pupilR.position.y = basePupilR.y
    } else {
      pupilL.position.copy(basePupilL)
      pupilR.position.copy(basePupilR)
    }
  }

  root.userData.bobGroup = bobGroup
  return root
}

/**
 * Enemy visual: GLB (animated) when `gltf` is provided, else procedural lathe ghost.
 */
export function createGhostVisual(
  bodyColor: number,
  gltf?: GhostGltfTemplate | null,
): Group {
  if (gltf) {
    return createGltfGhostVisual(bodyColor, gltf)
  }
  return createProceduralGhostVisual(bodyColor)
}
