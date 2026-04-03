import { Group, Object3D, Scene } from 'three'
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
  /** Character (GLB or procedural + stack anchor) */
  playerCharacter: PlayerCharacterVisual
  hubTitleFloorLabel: HubTitleFloorLabelHandle
}

export function createScene(
  playerGltfTemplate: PlayerGltfTemplate | null = null,
): SceneContents {
  const scene = new Scene()
  const ground = createMansionGround()
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
    playerCharacter: character,
    hubTitleFloorLabel,
  }
}
