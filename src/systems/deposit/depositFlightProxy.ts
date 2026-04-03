import { Color, Mesh, MeshStandardMaterial, SphereGeometry } from 'three'
import type { Object3D } from 'three'
import type { GameItem } from '../../core/types/GameItem.ts'

function itemColors(item: GameItem): { color: Color; emissive: Color } {
  if (item.type === 'wisp') {
    const c = new Color().setHSL(item.hue, 0.62, 0.55)
    return { color: c, emissive: c.clone().multiplyScalar(0.85) }
  }
  if (item.type === 'power_pellet') {
    const c = new Color(0x66eeff)
    return { color: c, emissive: new Color(0x99ffff) }
  }
  if (item.type === 'relic') {
    const c = new Color().setHSL(item.hue, 0.65, 0.52)
    return { color: c, emissive: new Color().setHSL(item.hue + 0.02, 0.75, 0.48) }
  }
  if (item.type === 'gem') {
    if (item.gemColor === 'red') {
      return {
        color: new Color(0xff5577),
        emissive: new Color(0xff99aa),
      }
    }
    if (item.gemColor === 'blue') {
      return {
        color: new Color(0x5599ff),
        emissive: new Color(0xaaccff),
      }
    }
    return {
      color: new Color(0x66dd88),
      emissive: new Color(0xaaffcc),
    }
  }
  const t = item.clutterVariant
  const palette = [
    new Color(0xc8c0b0),
    new Color(0x8a8478),
    new Color(0x6a6058),
    new Color(0x9a9082),
    new Color(0xb8a898),
    new Color(0x6e665c),
    new Color(0x7d7368),
  ]
  const c = palette[t] ?? palette[2]!
  return { color: c, emissive: c.clone().multiplyScalar(0.4) }
}

/** Small world mesh for deposit arc (no per-item stack meshes anymore). */
export function createDepositFlightProxy(item: GameItem): Mesh {
  const { color, emissive } = itemColors(item)
  const mesh = new Mesh(
    new SphereGeometry(0.13, 10, 8),
    new MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: 0.55,
      roughness: 0.32,
      metalness: 0.08,
    }),
  )
  mesh.name = 'depositFlightProxy'
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.depositFlightProxy = true
  return mesh
}

export function disposeDepositFlightProxy(root: Object3D): void {
  root.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose()
      const m = o.material
      if (Array.isArray(m)) m.forEach((x) => x.dispose())
      else m.dispose()
    }
  })
}
