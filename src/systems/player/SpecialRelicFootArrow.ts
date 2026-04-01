import {
  ConeGeometry,
  Group as ThreeGroup,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three'

const scratchPos = new Vector3()

/**
 * Scene-rooted marker: horizontal cone toward the relic at the player’s feet.
 */
export function createSpecialRelicFootArrow(): {
  root: ThreeGroup
  setTarget: (
    playerPos: Vector3,
    target: { x: number; z: number } | null,
  ) => void
} {
  const root = new ThreeGroup()
  root.name = 'specialRelicFootArrow'

  const cone = new Mesh(
    new ConeGeometry(0.26, 0.88, 10, 1),
    new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  )
  cone.rotation.x = Math.PI / 2
  cone.position.z = 0.72
  cone.renderOrder = 8
  root.add(cone)

  root.visible = false

  return {
    root,
    setTarget(playerPos, target) {
      if (!target) {
        root.visible = false
        return
      }
      const dx = target.x - playerPos.x
      const dz = target.z - playerPos.z
      const len = Math.hypot(dx, dz)
      if (len < 0.55) {
        root.visible = false
        return
      }
      const dirX = dx / len
      const dirZ = dz / len

      const standoff = 0.44
      scratchPos.set(
        playerPos.x + dirX * standoff,
        playerPos.y + 0.06,
        playerPos.z + dirZ * standoff,
      )
      root.position.copy(scratchPos)

      root.rotation.set(0, Math.atan2(dirX, dirZ), 0)
      root.visible = true
    },
  }
}
