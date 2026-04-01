import { PerspectiveCamera } from 'three'

/** Base camera; CameraRig owns follow offset and look-at each frame */
export function createCamera(aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, aspect, 0.1, 200)
  camera.position.set(0, 18, 12)
  camera.lookAt(0, 0, 0)
  return camera
}
