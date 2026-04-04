import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  Mesh,
  PlaneGeometry,
  Scene,
} from 'three'

/** Cool ambient — readable base, not flat white. */
const AMBIENT_COLOR = 0xc4d0e8
const AMBIENT_INTENSITY = 0.92

/** Soft moon key — bluish white, medium strength. */
const MOON_COLOR = 0xd8e8ff
const MOON_INTENSITY = 0.58

/** Warm fill — opposite side of moon, lifts shadows without harsh contrast. */
const FILL_COLOR = 0xfff2e6
const FILL_INTENSITY = 0.26

/** Brighter night sky than legacy flat fill; works with subtle fog. */
const BACKGROUND_COLOR = 0x3d4a62

/** Linear fog — low contrast, far range so gameplay stays clear. */
const FOG_COLOR = 0x4a5568
const FOG_NEAR = 72
const FOG_FAR = 220

/**
 * Stylized, readable lighting: strong cool ambient + moon directional + warm fill + light fog.
 * Call once when building the scene. Does not change gameplay bounds.
 */
export function setupReadableSceneLighting(scene: Scene): void {
  scene.background = new Color(BACKGROUND_COLOR)
  scene.fog = new Fog(FOG_COLOR, FOG_NEAR, FOG_FAR)

  const ambient = new AmbientLight(AMBIENT_COLOR, AMBIENT_INTENSITY)
  ambient.name = 'ambientReadable'
  scene.add(ambient)

  const moon = new DirectionalLight(MOON_COLOR, MOON_INTENSITY)
  moon.name = 'moonKey'
  moon.position.set(16, 26, 12)
  moon.castShadow = true
  moon.shadow.mapSize.set(1024, 1024)
  moon.shadow.radius = 2
  moon.shadow.bias = -0.00028
  moon.shadow.normalBias = 0.025
  const cam = moon.shadow.camera
  cam.near = 2
  cam.far = 140
  cam.left = -70
  cam.right = 70
  cam.top = 70
  cam.bottom = -70
  scene.add(moon.target)
  moon.target.position.set(0, 0, 0)
  scene.add(moon)

  const fill = new DirectionalLight(FILL_COLOR, FILL_INTENSITY)
  fill.name = 'fillWarm'
  fill.position.set(-18, 12, -20)
  fill.castShadow = false
  scene.add(fill.target)
  fill.target.position.set(0, 0, 0)
  scene.add(fill)

  enableShadowCastReceiveOnMeshes(scene)
}

function isHorizontalFloorPlane(mesh: Mesh): boolean {
  if (!(mesh.geometry instanceof PlaneGeometry)) return false
  return Math.abs(mesh.rotation.x + Math.PI / 2) < 0.02
}

/**
 * Receive on all; cast only where it matters — horizontal floors add almost no visible shadow
 * but multiply shadow-pass draw cost (many room + corridor planes).
 */
function enableShadowCastReceiveOnMeshes(scene: Scene): void {
  scene.traverse((o) => {
    if (!(o instanceof Mesh)) return
    if (o.userData?.skipShadow === true) return
    o.receiveShadow = true
    o.castShadow = !isHorizontalFloorPlane(o)
  })
}
