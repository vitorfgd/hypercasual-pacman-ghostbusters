import type { Game } from '../../core/Game.ts'

export type MountGameOptions = {
  /** Called when the player chooses Retry on the run-failed screen (dispose + remount from host). */
  onRunFailedRetry?: () => void | Promise<void>
}

export async function mountGame(
  host: HTMLElement,
  options?: MountGameOptions,
): Promise<Game> {
  const gameModPromise = import('../../core/Game.ts')
  const ghostCfgPromise = import('../ghost/ghostConfig.ts')
  const ghostLoadPromise = import('../ghost/ghostGltfAsset.ts')
  const playerLoadPromise = import('../player/playerGltfAsset.ts')

  const [
    { loadWispPickupGltf, WISP_GLTF_URL },
    { loadRelicGltfs, RELIC_GLTF_URLS },
    { loadGridWispGltf, GRID_WISP_GLTF_URL },
    { loadGridTrapGltf, GRID_TRAP_GLTF_URL },
  ] = await Promise.all([
    import('../wisp/wispGltfAsset.ts'),
    import('../relic/relicGltfAsset.ts'),
    import('../grid/gridWispGltfAsset.ts'),
    import('../grid/gridTrapGltfAsset.ts'),
  ])

  const [
    { GHOST_GLTF_URL },
    { loadGhostEnemyGltf },
    { PLAYER_GLTF_URL, loadPlayerCharacterGltf },
    { loadCarryBagGltf, CARRY_BAG_GLTF_URL },
  ] = await Promise.all([
    ghostCfgPromise,
    ghostLoadPromise,
    playerLoadPromise,
    import('../stack/bagGltfAsset.ts'),
  ])

  const gateLoadPromise = import('../doors/gateGltfAsset.ts').then((m) =>
    m.loadGateGltf(),
  )

  /** Pickup + grid prototypes load before `Game` so spawns clone GLBs immediately. */
  const pickupLoadsPromise = Promise.all([
    loadWispPickupGltf(WISP_GLTF_URL),
    loadRelicGltfs(RELIC_GLTF_URLS),
    loadGridWispGltf(GRID_WISP_GLTF_URL),
    loadGridTrapGltf(GRID_TRAP_GLTF_URL),
  ])

  const [ghostLoaded, playerLoaded, bagLoaded, _gateLoaded] = await Promise.all([
    loadGhostEnemyGltf(GHOST_GLTF_URL),
    loadPlayerCharacterGltf(PLAYER_GLTF_URL),
    loadCarryBagGltf(CARRY_BAG_GLTF_URL),
    gateLoadPromise,
    pickupLoadsPromise,
  ])

  if (!ghostLoaded.ok) {
    console.warn(
      '[ghost] Using procedural enemy mesh. GLB not used. Reason:',
      ghostLoaded.error,
      '| Expected file:',
      GHOST_GLTF_URL,
      '(under public/) with at least one animation; clips matched by name: idle, chasing (or chase/run).',
    )
  }
  if (!playerLoaded.ok) {
    console.warn(
      '[player] Using procedural capsule character. GLB not used. Reason:',
      playerLoaded.error,
      '| Expected file:',
      PLAYER_GLTF_URL,
      'with animations: idle, collecting, running.',
    )
  }
  if (!bagLoaded) {
    console.warn(
      '[carryBag] Using procedural sack. Expected GLB at',
      CARRY_BAG_GLTF_URL,
    )
  }

  const { Game } = await gameModPromise
  return new Game(
    host,
    ghostLoaded.ok ? ghostLoaded.template : null,
    playerLoaded.ok ? playerLoaded.template : null,
    options?.onRunFailedRetry,
  )
}
