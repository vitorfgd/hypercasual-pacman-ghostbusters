import type { Group, Scene } from 'three'

/** Shared refs for systems; extend as the game grows */
export type GameContext = {
  scene: Scene
  playerRoot: Group
}
