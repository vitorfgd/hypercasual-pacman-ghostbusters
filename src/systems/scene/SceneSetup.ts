import {
  CircleGeometry,
  Color,
  Fog,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Scene,
  AmbientLight,
  HemisphereLight,
  DirectionalLight,
} from 'three'
import type { Mesh as MeshType } from 'three'
import { DEFAULT_DEPOSIT_ZONE_RADIUS } from '../deposit/DepositZone.ts'
import type { PlayerGltfTemplate } from '../player/playerGltfAsset.ts'
import { PlayerCharacterVisual } from '../player/PlayerCharacterVisual.ts'
import { createUpgradePad } from '../upgrades/UpgradePadVisual.ts'
import type { PadLabelPayload } from '../upgrades/UpgradePadVisual.ts'
import { UPGRADE_PAD_HUB_OFFSET } from '../upgrades/upgradeConfig.ts'
import { createMansionGround } from './mansionEnvironment.ts'

export type SceneContents = {
  scene: Scene
  /** Mansion floor group (hall + four wings) */
  ground: Group
  /** Root for movement + rotation; character is a child */
  playerRoot: Group
  /** Stack anchor lives on the procedural character (back) */
  stackAnchor: Object3D
  /** World-space group for pickup meshes */
  pickupGroup: Group
  /** Ghost enemies (pressure / chase) */
  ghostGroup: Group
  /** Deposit zone root (visual + logical center) */
  depositRoot: Group
  depositZoneMesh: MeshType
  /** Wide underglow under deposit disc — reacts with zone feedback */
  depositUnderglowMesh: MeshType
  /** Optional rim (unused — single disc deposit for one clear zone read) */
  depositRingMesh: MeshType | null
  /** Character (GLB or procedural + stack anchor) */
  playerCharacter: PlayerCharacterVisual
  /** Hub-corner upgrade pads */
  upgradeAreaRoot: Group
  /** World upgrade pads */
  upgradePads: {
    capacity: {
      root: Group
      setLabel: (p: PadLabelPayload) => void
      setOccupancy: (t: number) => void
    }
    speed: {
      root: Group
      setLabel: (p: PadLabelPayload) => void
      setOccupancy: (t: number) => void
    }
    pulseFreq: {
      root: Group
      setLabel: (p: PadLabelPayload) => void
      setOccupancy: (t: number) => void
    }
    pulseDuration: {
      root: Group
      setLabel: (p: PadLabelPayload) => void
      setOccupancy: (t: number) => void
    }
  }
}

export function createScene(
  playerGltfTemplate: PlayerGltfTemplate | null = null,
): SceneContents {
  const scene = new Scene()
  /** Match floor family so door gaps never read as a different hue. */
  scene.background = new Color(0x2a2e44)
  scene.fog = new Fog(0x323a50, 58, 118)

  /** Base fill so floors/walls never fall to black. */
  scene.add(new AmbientLight(0x96a6bc, 0.46))

  scene.add(
    new HemisphereLight(0xaab8d0, 0x40485c, 0.58),
  )

  /** Primary moon key — cool, soft, readable shadows. */
  const moon = new DirectionalLight(0xd8e8f5, 1.05)
  moon.position.set(-8, 24, 12)
  moon.castShadow = true
  moon.shadow.mapSize.setScalar(1024)
  moon.shadow.camera.near = 0.5
  moon.shadow.camera.far = 72
  moon.shadow.camera.left = -36
  moon.shadow.camera.right = 36
  moon.shadow.camera.top = 36
  moon.shadow.camera.bottom = -36
  scene.add(moon)

  /** Rim / bounce — lifts north-facing reads on portrait top-down. */
  const fill = new DirectionalLight(0x788ca0, 0.4)
  fill.position.set(14, 16, -16)
  scene.add(fill)

  /** Soft top-down fill: evens door gaps & wall bases without harsh pools. */
  const top = new DirectionalLight(0xb4c4d4, 0.28)
  top.position.set(0, 28, 2)
  scene.add(top)

  const ground = createMansionGround()
  scene.add(ground)

  const playerRoot = new Group()
  const character = new PlayerCharacterVisual(playerGltfTemplate)
  playerRoot.add(character.root)

  /** Start inside hub deposit / safe circle (radius from `DEFAULT_DEPOSIT_ZONE_RADIUS`). */
  playerRoot.position.set(0.35, 0, 0.55)
  scene.add(playerRoot)

  const pickupGroup = new Group()
  scene.add(pickupGroup)

  const ghostGroup = new Group()
  ghostGroup.name = 'ghosts'
  scene.add(ghostGroup)

  const depositRoot = new Group()
  depositRoot.position.set(0, 0, 0)
  scene.add(depositRoot)

  const depR = DEFAULT_DEPOSIT_ZONE_RADIUS

  const depositUnderglow = new Mesh(
    new CircleGeometry(depR * 2.35, 56),
    new MeshStandardMaterial({
      color: 0x1a1422,
      emissive: 0x3d2848,
      emissiveIntensity: 0.22,
      roughness: 0.9,
      metalness: 0,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    }),
  )
  depositUnderglow.name = 'depositUnderglow'
  depositUnderglow.rotation.x = -Math.PI / 2
  depositUnderglow.position.y = 0.018
  depositUnderglow.receiveShadow = true
  depositRoot.add(depositUnderglow)

  const depositZoneMesh = new Mesh(
    new CircleGeometry(depR, 56),
    new MeshStandardMaterial({
      color: 0x2a2230,
      emissive: 0x4a3058,
      emissiveIntensity: 0.2,
      roughness: 0.78,
      metalness: 0.08,
      transparent: true,
      opacity: 0.94,
    }),
  )
  depositZoneMesh.name = 'depositZone'
  depositZoneMesh.rotation.x = -Math.PI / 2
  depositZoneMesh.position.y = 0.022
  depositZoneMesh.receiveShadow = true
  depositRoot.add(depositZoneMesh)

  const depositRingMesh: MeshType | null = null

  /** Four pads around hub center (between deposit and room walls). */
  const upgradeAreaRoot = new Group()
  upgradeAreaRoot.name = 'upgradeArea'
  const hc = UPGRADE_PAD_HUB_OFFSET

  const capacityPad = createUpgradePad('CAPACITY', 0x3a2c42, 0x8b7358)
  capacityPad.root.position.set(-hc, 0.02, hc)
  upgradeAreaRoot.add(capacityPad.root)

  const speedPad = createUpgradePad('SPEED', 0x342838, 0x9a8060)
  speedPad.root.position.set(hc, 0.02, hc)
  upgradeAreaRoot.add(speedPad.root)

  const pulseFreqPad = createUpgradePad('PULSE RATE', 0x382a44, 0x7a6488)
  pulseFreqPad.root.position.set(-hc, 0.02, -hc)
  upgradeAreaRoot.add(pulseFreqPad.root)

  const pulseDurationPad = createUpgradePad('PULSE TIME', 0x362632, 0xa07058)
  pulseDurationPad.root.position.set(hc, 0.02, -hc)
  upgradeAreaRoot.add(pulseDurationPad.root)

  scene.add(upgradeAreaRoot)

  return {
    scene,
    ground,
    playerRoot,
    stackAnchor: character.stackAnchor,
    pickupGroup,
    ghostGroup,
    depositRoot,
    depositZoneMesh,
    depositUnderglowMesh: depositUnderglow,
    depositRingMesh,
    playerCharacter: character,
    upgradeAreaRoot,
    upgradePads: {
      capacity: capacityPad,
      speed: speedPad,
      pulseFreq: pulseFreqPad,
      pulseDuration: pulseDurationPad,
    },
  }
}
