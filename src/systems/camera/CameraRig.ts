import type { Group, PerspectiveCamera } from 'three'
import { Vector3 } from 'three'
import {
  CAMERA_OFFSET_BASE,
  CAMERA_EXTRA_ZOOM_HEAVY,
  CAMERA_HEAVY_STACK_FILL,
  CAMERA_SMOOTH,
  CAMERA_STACK_ZOOM_MAX,
  CAMERA_STACK_ZOOM_Y,
  CAMERA_STACK_ZOOM_Z,
} from '../../juice/juiceConfig.ts'

const playerPos = new Vector3()
const desired = new Vector3()
const offsetWithZoom = new Vector3()

/** Smooth follow + subtle pull-back when stack grows */
export class CameraRig {
  private readonly camera: PerspectiveCamera
  private readonly target: Group
  private readonly smooth: number
  /** Returns stack fill 0…1 (count / maxCapacity). */
  private readonly getStackFillRatio: () => number

  constructor(
    camera: PerspectiveCamera,
    target: Group,
    getStackFillRatio: () => number,
    smooth = CAMERA_SMOOTH,
  ) {
    this.camera = camera
    this.target = target
    this.getStackFillRatio = getStackFillRatio
    this.smooth = smooth
  }

  update(dt: number): void {
    this.target.getWorldPosition(playerPos)
    const fill = Math.max(0, Math.min(1, this.getStackFillRatio()))
    let zoom = fill * CAMERA_STACK_ZOOM_MAX
    if (fill >= CAMERA_HEAVY_STACK_FILL) {
      zoom += CAMERA_EXTRA_ZOOM_HEAVY * (fill - CAMERA_HEAVY_STACK_FILL)
    }
    zoom = Math.min(CAMERA_STACK_ZOOM_MAX + CAMERA_EXTRA_ZOOM_HEAVY * 0.5, zoom)
    offsetWithZoom.set(
      CAMERA_OFFSET_BASE.x,
      CAMERA_OFFSET_BASE.y + zoom * CAMERA_STACK_ZOOM_Y,
      CAMERA_OFFSET_BASE.z + zoom * CAMERA_STACK_ZOOM_Z,
    )
    desired.copy(playerPos).add(offsetWithZoom)
    const k = 1 - Math.exp(-this.smooth * dt)
    this.camera.position.lerp(desired, k)
    this.camera.lookAt(playerPos)
  }
}
