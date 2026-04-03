import { CircleGeometry, Group, Mesh, MeshStandardMaterial, Object3D, Scene } from 'three'
import type { Mesh as MeshType } from 'three'
import type { PlayerGltfTemplate } from '../player/playerGltfAsset.ts'
import { PlayerCharacterVisual } from '../player/PlayerCharacterVisual.ts'
import { createMansionGround } from './mansionEnvironment.ts'
import {
  createHubTitleFloorLabel,
  type HubTitleFloorLabelHandle,
} from './hubTitleFloorLabel.ts'
import { setupReadableSceneLighting } from './sceneLighting.ts'

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
  /**
   * Off-screen root for `DepositZoneFeedback` burst ring + invisible dummy zone
   * meshes (hub deposit visuals removed).
   */
  depositRoot: Group
  depositZoneMesh: MeshType
  depositUnderglowMesh: MeshType
  /** Character (GLB or procedural + stack anchor) */
  playerCharacter: PlayerCharacterVisual
  hubTitleFloorLabel: HubTitleFloorLabelHandle
}

export function createScene(
  playerGltfTemplate: PlayerGltfTemplate | null = null,
  /** Mixed into procedural floor decor — new value each run. */
  runSeed = 0,
): SceneContents {
  const scene = new Scene()
  const ground = createMansionGround(runSeed)
  scene.add(ground)

  const playerRoot = new Group()
  const character = new PlayerCharacterVisual(playerGltfTemplate)
  playerRoot.add(character.root)

  /** Start in hub safe room. */
  playerRoot.position.set(0.35, 0, 0.55)
  scene.add(playerRoot)

  const pickupGroup = new Group()
  scene.add(pickupGroup)

  const ghostGroup = new Group()
  ghostGroup.name = 'ghosts'
  scene.add(ghostGroup)

  const depositRoot = new Group()
  depositRoot.name = 'depositFxOffscreen'
  /** Invisible stand-ins for `DepositZoneFeedback`; root not in scene — no hub deposit visuals. */
  const depR = 0.02
  const depositUnderglow = new Mesh(
    new CircleGeometry(depR * 2, 10),
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
  depositUnderglow.visible = false
  depositUnderglow.rotation.x = -Math.PI / 2
  depositUnderglow.position.y = 0.018
  depositRoot.add(depositUnderglow)

  const depositZoneMesh = new Mesh(
    new CircleGeometry(depR, 10),
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
  depositZoneMesh.visible = false
  depositZoneMesh.rotation.x = -Math.PI / 2
  depositZoneMesh.position.y = 0.022
  depositRoot.add(depositZoneMesh)

  const hubTitleFloorLabel = createHubTitleFloorLabel()
  scene.add(hubTitleFloorLabel.root)

  setupReadableSceneLighting(scene)

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
    playerCharacter: character,
    hubTitleFloorLabel,
  }
}
