import type { Group, PerspectiveCamera } from 'three'
import { Vector3 } from 'three'
import {
  CAMERA_EXTRA_ZOOM_HEAVY,
  CAMERA_HEAVY_STACK_FILL,
  CAMERA_OFFSET_BASE,
  CAMERA_OTS_COLLISION,
  CAMERA_OTS_DISTANCE,
  CAMERA_OTS_EYE_HEIGHT,
  CAMERA_OTS_HEIGHT,
  CAMERA_OTS_LOOK_AHEAD,
  CAMERA_OTS_LOOK_HEIGHT,
  CAMERA_OTS_PROBE_RADIUS,
  CAMERA_OTS_SHOULDER_OFFSET,
  CAMERA_OTS_SMOOTH_LOOK,
  CAMERA_OTS_SMOOTH_POS,
  CAMERA_SMOOTH,
  CAMERA_STACK_ZOOM_MAX,
  CAMERA_STACK_ZOOM_Y,
  CAMERA_STACK_ZOOM_Z,
  type CameraMode,
} from '../../juice/juiceConfig.ts'
import type { WorldCollision } from '../world/WorldCollision.ts'
import { pullCameraTowardEyeIfBlocked } from './cameraCollision.ts'

const playerPos = new Vector3()
const desired = new Vector3()
const offsetWithZoom = new Vector3()
const eyeScratch = new Vector3()
const lookIdeal = new Vector3()
const collisionOut = new Vector3()

function stackZoomMul(fill: number): number {
  let zoom = fill * CAMERA_STACK_ZOOM_MAX
  if (fill >= CAMERA_HEAVY_STACK_FILL) {
    zoom += CAMERA_EXTRA_ZOOM_HEAVY * (fill - CAMERA_HEAVY_STACK_FILL)
  }
  zoom = Math.min(CAMERA_STACK_ZOOM_MAX + CAMERA_EXTRA_ZOOM_HEAVY * 0.5, zoom)
  return zoom
}

export type CameraRigOptions = {
  worldCollision: WorldCollision
  getFacingYaw: () => number
  initialMode?: CameraMode
}

/** Smooth follow: top-down stack zoom, or over-the-shoulder with lag + optional wall pull. */
export class CameraRig {
  private readonly camera: PerspectiveCamera
  private readonly target: Group
  private readonly smooth: number
  private readonly getStackFillRatio: () => number
  private readonly worldCollision: WorldCollision
  private readonly getFacingYaw: () => number
  private mode: CameraMode
  private readonly otsLookSmoothed = new Vector3()
  private otsLookInitialized = false

  constructor(
    camera: PerspectiveCamera,
    target: Group,
    getStackFillRatio: () => number,
    options: CameraRigOptions,
    smooth = CAMERA_SMOOTH,
  ) {
    this.camera = camera
    this.target = target
    this.getStackFillRatio = getStackFillRatio
    this.worldCollision = options.worldCollision
    this.getFacingYaw = options.getFacingYaw
    this.mode = options.initialMode ?? 'top_down'
    this.smooth = smooth
  }

  getMode(): CameraMode {
    return this.mode
  }

  setMode(mode: CameraMode): void {
    if (this.mode === mode) return
    this.mode = mode
    this.otsLookInitialized = false
  }

  /** After an external camera override (e.g. gate cinematic), resync OTS look smoothing. */
  resetOtsLookBlend(): void {
    this.otsLookInitialized = false
  }

  /** Instant follow target (same as `update` goal, without per-frame smoothing) — for cinematics. */
  getDesiredCameraPosition(out: Vector3): void {
    if (this.mode === 'top_down') {
      this.getDesiredTopDown(out)
    } else {
      this.computeOtsDesiredWorld(out, true)
    }
  }

  private getDesiredTopDown(out: Vector3): void {
    this.target.getWorldPosition(playerPos)
    const fill = Math.max(0, Math.min(1, this.getStackFillRatio()))
    const zoom = stackZoomMul(fill)
    offsetWithZoom.set(
      CAMERA_OFFSET_BASE.x,
      CAMERA_OFFSET_BASE.y + zoom * CAMERA_STACK_ZOOM_Y,
      CAMERA_OFFSET_BASE.z + zoom * CAMERA_STACK_ZOOM_Z,
    )
    out.copy(playerPos).add(offsetWithZoom)
  }

  /**
   * @param applyCollision — when false, raw ideal OTS position (for internal comparison only).
   */
  private computeOtsDesiredWorld(out: Vector3, applyCollision: boolean): void {
    this.target.getWorldPosition(playerPos)
    const fill = Math.max(0, Math.min(1, this.getStackFillRatio()))
    const zoom = stackZoomMul(fill)
    const dist = CAMERA_OTS_DISTANCE + zoom * 0.11
    const yaw = this.getFacingYaw()
    const sn = Math.sin(yaw)
    const cs = Math.cos(yaw)
    const bx = sn * dist
    const bz = cs * dist
    const rx = cs * CAMERA_OTS_SHOULDER_OFFSET
    const rz = -sn * CAMERA_OTS_SHOULDER_OFFSET
    out.set(
      playerPos.x + bx + rx,
      playerPos.y + CAMERA_OTS_HEIGHT,
      playerPos.z + bz + rz,
    )
    if (!applyCollision || !CAMERA_OTS_COLLISION) return
    eyeScratch.set(
      playerPos.x,
      playerPos.y + CAMERA_OTS_EYE_HEIGHT,
      playerPos.z,
    )
    pullCameraTowardEyeIfBlocked(
      this.worldCollision,
      eyeScratch,
      out,
      CAMERA_OTS_PROBE_RADIUS,
      collisionOut,
    )
    out.copy(collisionOut)
  }

  update(dt: number): void {
    if (this.mode === 'top_down') {
      this.getDesiredTopDown(desired)
      const k = 1 - Math.exp(-this.smooth * dt)
      this.camera.position.lerp(desired, k)
      this.target.getWorldPosition(playerPos)
      this.camera.lookAt(playerPos)
      return
    }

    this.computeOtsDesiredWorld(desired, true)
    const kPos = 1 - Math.exp(-CAMERA_OTS_SMOOTH_POS * dt)
    this.camera.position.lerp(desired, kPos)

    this.target.getWorldPosition(playerPos)
    const yaw = this.getFacingYaw()
    const sn = Math.sin(yaw)
    const cs = Math.cos(yaw)
    const fx = -sn
    const fz = -cs
    lookIdeal.set(
      playerPos.x + fx * CAMERA_OTS_LOOK_AHEAD,
      playerPos.y + CAMERA_OTS_LOOK_HEIGHT,
      playerPos.z + fz * CAMERA_OTS_LOOK_AHEAD,
    )
    if (!this.otsLookInitialized) {
      this.otsLookSmoothed.copy(lookIdeal)
      this.otsLookInitialized = true
    } else {
      const kL = 1 - Math.exp(-CAMERA_OTS_SMOOTH_LOOK * dt)
      this.otsLookSmoothed.lerp(lookIdeal, kL)
    }
    this.camera.lookAt(this.otsLookSmoothed)
  }
}
