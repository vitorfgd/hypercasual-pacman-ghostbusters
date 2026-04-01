import { Mesh, MeshStandardMaterial, SphereGeometry } from 'three'

/** Small gold pellet — same idea as wisp deposit flight, cheaper than GLB. */
export function createDoorPaymentCoinMesh(): Mesh {
  const geo = new SphereGeometry(0.11, 10, 8)
  const mat = new MeshStandardMaterial({
    color: 0xc9a030,
    emissive: 0x886010,
    emissiveIntensity: 0.55,
    roughness: 0.35,
    metalness: 0.45,
  })
  const m = new Mesh(geo, mat)
  m.name = 'doorPayCoin'
  m.userData.doorPayCoin = true
  return m
}

export function disposeDoorPaymentCoinMesh(mesh: Mesh): void {
  mesh.geometry.dispose()
  const mat = mesh.material
  if (mat instanceof MeshStandardMaterial) mat.dispose()
}
