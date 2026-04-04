import type { PerspectiveCamera } from 'three'
import type { Scene } from 'three'
import type { WebGLRenderer } from 'three'
import { Group, Vector3, WebGLRenderTarget } from 'three'
import { CameraRig } from '../systems/camera/CameraRig.ts'
import { CollectionSystem } from '../systems/collection/CollectionSystem.ts'
import {
  KeyboardMoveInput,
  mergeMoveInput,
} from '../systems/input/KeyboardMoveInput.ts'
import { TouchJoystick } from '../systems/input/TouchJoystick.ts'
import { ItemWorld } from '../systems/items/ItemWorld.ts'
import { SpecialRelicSpawnSystem } from '../systems/wisp/SpecialRelicSpawnSystem.ts'
import type { PlayerCharacterVisual } from '../systems/player/PlayerCharacterVisual.ts'
import {
  formatNavDebugHud,
  SHOW_PLAYER_NAV_DEBUG_HUD,
  type PlayerNavDebugSnapshot,
} from '../systems/player/playerNavDebug.ts'
import { PLAYER_BASE_MAX_SPEED } from '../systems/gameplaySpeed.ts'
import { PlayerController } from '../systems/player/PlayerController.ts'
import { createSpecialRelicFootArrow } from '../systems/player/SpecialRelicFootArrow.ts'
import { createCamera } from '../systems/scene/createCamera.ts'
import { createRenderer } from '../systems/scene/createRenderer.ts'
import { createScene } from '../systems/scene/SceneSetup.ts'
import type { HubTitleFloorLabelHandle } from '../systems/scene/hubTitleFloorLabel.ts'
import { attachGridCellDebugOverlays } from '../systems/scene/gridCellDebugOverlay.ts'
import { spawnRoomClearedFloorLabel } from '../systems/scene/roomClearedFloorLabel.ts'
import { subscribeViewportResize } from '../systems/scene/resize.ts'
import { CarryStack, UNLIMITED_STACK_MAX } from '../systems/stack/CarryStack.ts'
import { StackVisual } from '../systems/stack/StackVisual.ts'
import {
  createPowerPelletItem,
  createRelicItem,
  createWispItem,
} from '../themes/wisp/itemFactory.ts'
import type { GameItem } from './types/GameItem.ts'
import { createRunRandom } from './runRng.ts'
import {
  formatPersonalBestRoom,
  formatPersonalBestTime,
  loadSavedPersonalBest,
  savePersonalBest,
  type PersonalBestSnapshot,
} from './personalBest.ts'
import { speedForLevel } from '../systems/upgrades/upgradeConfig.ts'
import {
  applyRunUpgrade,
  pickRunUpgradeOffers,
  type ApplyRunUpgradeResult,
} from '../systems/upgrades/upgradePool.ts'
import { RunUpgradeState } from '../systems/upgrades/runUpgradeState.ts'
import { mountRoomUpgradePicker } from '../ui/roomUpgradePicker.ts'
import {
  GHOST_COLLISION_RADIUS,
  GHOST_HIT_INVULN_SEC,
  GHOST_HIT_PICKUP_LOCK_SEC,
  ghostRoomVisualMul,
  maxActiveGhostsForRoomProgress,
  partitionGhostSpawnsByRoom,
  pickGhostColorForRoomIndex,
  wispCollectGhostSpawnProbability,
  WISP_GHOST_SPAWN_MIN_PLAYER_DIST,
} from '../systems/ghost/ghostConfig.ts'
import {
  disposeGhostGltfTemplate,
  type GhostGltfTemplate,
} from '../systems/ghost/ghostGltfAsset.ts'
import {
  disposePlayerGltfTemplate,
  type PlayerGltfTemplate,
} from '../systems/player/playerGltfAsset.ts'
import { disposeGhostSharedGeometry } from '../systems/ghost/createGhostVisual.ts'
import { disposeSharedGhostVisionConeGeometry } from '../systems/ghost/GhostSystem.ts'
import { GhostSystem } from '../systems/ghost/GhostSystem.ts'
import type { AreaId } from '../systems/world/RoomSystem.ts'
import { RoomSystem } from '../systems/world/RoomSystem.ts'
import { getDoorBlockerZ, roomIndexFromId } from '../systems/doors/doorLayout.ts'
import {
  ROOM_CLEAR_CINE_POST_SLOW_HOLD_SEC,
  ROOM_CLEAR_CINE_SLOW_MO_SEC,
  ROOM_CLEAR_CINE_SLOW_SIM_SCALE,
  ROOM_CLEAR_CINE_ZOOM_OUT_SEC,
  ROOM_CLEAR_DOOR_CINE_APPROACH_SEC,
  ROOM_CLEAR_DOOR_CINE_HOLD_SEC,
  ROOM_CLEAR_DOOR_CINE_RETURN_SEC,
  ROOM_CLEAR_GHOST_FADE_SEC,
  ROOM_CLEAR_INTRO_GHOST_FADE_SEC,
} from '../systems/doors/doorUnlockConfig.ts'
import { RoomCleanlinessSystem } from '../systems/world/RoomCleanlinessSystem.ts'
import {
  FINAL_NORMAL_ROOM_ID,
  NORMAL_ROOM_COUNT,
  type NormalRoomId,
  type RoomId,
} from '../systems/world/mansionRoomData.ts'
import { WorldCollision } from '../systems/world/WorldCollision.ts'
import {
  CAMERA_OFFSET_BASE,
  GHOST_HIT_SLOW_MO_SCALE,
  GHOST_HIT_SLOW_MO_SEC,
  POWER_MODE_DURATION_MAX_SEC,
  POWER_MODE_DURATION_MIN_SEC,
  PLAYER_MAX_LIVES,
} from '../juice/juiceConfig.ts'
import { spawnLifeLostImpact } from '../juice/lifeHudJuice.ts'
import { showRunFailedOverlay } from '../juice/runFailedOverlay.ts'
import {
  PlayerMotionTrail,
  type PlayerMotionTrailMode,
} from '../juice/playerMotionTrail.ts'
import {
  primeFloatingHudEffects,
  spawnFloatingHudText,
  spawnRoomClearedBanner,
  spawnRoomEntryBanner,
} from '../juice/floatingHud.ts'
import {
  playRoomClearFanfare,
  playWispCollectPop,
} from '../juice/gameplaySfx.ts'
import {
  loadSavedProgressPresentState,
  recordPresentProgress,
  rewardDefById,
  saveProgressPresentState,
  type PresentRewardId,
  type ProgressPresentOutcome,
  type ProgressPresentState,
} from './progressPresents.ts'
import {
  disposeAllGhostHitBursts,
  spawnDirectionalFloorPulse,
  spawnFloorRingBurst,
  spawnGhostHitEctoplasmBurst,
  spawnGhostHitPelletBurst,
  updateGhostHitBursts,
  type GhostHitBurstParticle,
} from '../juice/ghostHitPelletBurst.ts'
import { maybeLogRenderSpikeDiagnostics } from '../systems/debug/renderSpikeDebug.ts'
import { PerfMonitor } from '../systems/debug/PerfMonitor.ts'
import {
  DoorUnlockSystem,
  type DoorPlayerSample,
} from '../systems/doors/DoorUnlockSystem.ts'
import { RoomLockCoverSystem } from '../systems/world/RoomLockCoverSystem.ts'
import {
  computeCarryEncumbranceWeight,
  stackWeightDragMultiplierRelief,
  stackWeightSpeedMultiplierRelief,
} from '../systems/stack/stackWeightConfig.ts'
import { spawnGridWispsForPlans } from '../systems/grid/instantiateGridRoomContent.ts'
import {
  pickRiskyPowerPelletCell,
  spawnPowerPelletsForRun,
} from '../systems/grid/powerPelletSpawn.ts'
import { pickGridGhostSpawnXZ } from '../systems/grid/gridGhostSpawn.ts'
import {
  flattenMazeWallPlacements,
  flattenTrapPlacements,
  planAllRoomGrids,
  planRuntimeRoomGrid,
  type MazeWallPlacement,
  type RoomGridPlan,
} from '../systems/grid/planRoomGrids.ts'
import { ROOM_GRID_COLS, ROOM_GRID_ROWS } from '../systems/grid/gridConfig.ts'
import { cellCenterWorld } from '../systems/grid/roomGridGeometry.ts'
import {
  TrapFieldSystem,
  type TrapPlacement,
} from '../systems/traps/TrapFieldSystem.ts'
import { GridMazeWallSystem } from '../systems/world/GridMazeWallSystem.ts'
import { BossRoomController } from '../systems/boss/BossRoomController.ts'
import {
  BOSS_CINE_RETURN_SEC,
  BOSS_CINE_SLOW_SEC,
  BOSS_CINE_SLOW_SIM_SCALE,
  BOSS_CINE_ZOOM_SEC,
  BOSS_PULSE_KNOCK_STRENGTH,
  BOSS_VICTORY_OUTRO_SEC,
  getBossSpawnXZ,
} from '../systems/boss/bossRoomConfig.ts'

function roomCleanHudLabel(roomId: RoomId): string {
  if (roomId === 'SAFE_CENTER') return 'Safe'
  const m = /^ROOM_(\d+)$/.exec(roomId)
  return m ? `Room ${m[1]}` : roomId
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

type RoomLagAuditWindow = Window & {
  __roomLagAudit?: boolean
  __roomLagAuditMinFrameMs?: number
}

type RoomLagAuditFrame = {
  /** Main-thread CPU from frame start until just before `renderer.render` (excludes GPU). */
  totalMs: number
  /** Time inside `renderer.render` (GPU + driver sync); the audit previously omitted this. */
  renderMs: number
  trapFieldMs: number
  playerMs: number
  doorUnlockMs: number
  itemWorldMs: number
  collectionMs: number
  ghostSystemMs: number
  areaBefore: AreaId | null
  areaAfter: AreaId | null
  roomBefore: RoomId | null
  roomAfter: RoomId | null
  nav: Readonly<PlayerNavDebugSnapshot>
}

type PendingTrailPresentPhase = 'closed' | 'ready' | 'opened'

export class Game {
  /** Mulberry32 stream for gameplay RNG (new seed each session). */
  private readonly runRandom: () => number
  private readonly roomSystem: RoomSystem
  private readonly worldCollision = new WorldCollision()
  private readonly scene: Scene
  private readonly camera: PerspectiveCamera
  private readonly renderer: WebGLRenderer
  private readonly unsubscribeResize: () => void
  private readonly joystick: TouchJoystick
  private readonly keyboardMove: KeyboardMoveInput
  private readonly player: PlayerController
  private readonly cameraRig: CameraRig
  private readonly stack: CarryStack
  private readonly stackVisual: StackVisual
  private readonly itemWorld: ItemWorld
  private readonly collection: CollectionSystem
  private readonly playerCharacter: PlayerCharacterVisual
  private readonly doorUnlock: DoorUnlockSystem
  private readonly roomLockCovers: RoomLockCoverSystem
  private roomCleanliness!: RoomCleanlinessSystem
  private readonly specialRelicSpawns: SpecialRelicSpawnSystem
  private readonly relicFootArrow: ReturnType<typeof createSpecialRelicFootArrow>
  /** Per-run room-clear upgrade pool + stacking state. */
  private readonly runUpgrades = new RunUpgradeState()
  private readonly ghostSystem: GhostSystem
  private readonly ghostGltfTemplate: GhostGltfTemplate | null
  private readonly playerGltfTemplate: PlayerGltfTemplate | null
  private readonly hubTitleFloorLabel: HubTitleFloorLabelHandle
  /** When set, Retry on run-failed avoids full page reload (remount from bootstrap). */
  private readonly onRunFailedRetry?: () => void | Promise<void>
  /** World floor decals for cleared rooms (dispose on `Game.dispose`). */
  private readonly roomClearFloorDisposers: (() => void)[] = []
  private readonly burstGroup: Group
  private readonly burstParticles: GhostHitBurstParticle[] = []
  private readonly burstSpawnScratch = new Vector3()
  private ghostHitInvuln = 0
  /** Brief lock on walking pickups after a hit (burst scatter reads first). */
  private ghostHitPickupLockRemain = 0
  private ghostDamageArmed = true
  /** Pac-Man-style ghost fear + eat window. */
  private powerModeRemain = 0
  private hitFlashEl: HTMLElement | null = null
  private hitFlashTimer: ReturnType<typeof setTimeout> | null = null
  private raf = 0
  private lastTime = performance.now()
  private elapsedSec = 0
  private hudSpawn: HTMLElement | null = null
  private readonly gameViewport: HTMLElement
  private readonly velScratch = new Vector3()
  private readonly camForwardScratch = new Vector3()
  private readonly playerPos = new Vector3()
  private lastGhostInvuln = false
  private readonly perf = new PerfMonitor()
  private readonly hudRoomCleanWrap: HTMLElement | null
  private readonly hudRoomCleanFill: HTMLElement | null
  private readonly hudRoomCleanPct: HTMLElement | null
  private readonly hudRoomCleanTitle: HTMLElement | null
  private readonly hudSafePbSummaryEl: HTMLElement | null
  private readonly hudSafePbActionsEl: HTMLElement | null
  private readonly hudCarryEl: HTMLElement | null
  private readonly hudCameraHintEl: HTMLElement | null
  private readonly hudLivesWrap: HTMLElement | null
  private lives = PLAYER_MAX_LIVES
  private gameOver = false
  private runFailedCleanup: (() => void) | null = null
  private readonly bossRoom: BossRoomController
  private runStatRoomsCleared = 0
  private runStatWispsCollected = 0
  private runStatDeepestRoomReached = 0
  private runStatBossReachedAtSec: number | null = null
  private readonly runStatUpgradesPicked: { id: string; title: string }[] = []
  private personalBest: PersonalBestSnapshot = loadSavedPersonalBest()
  private readonly progressPresentState: ProgressPresentState =
    loadSavedProgressPresentState()
  private roomShieldAvailable = false
  private shieldRefreshRoomId: RoomId | null = null
  private leaderboardOverlayEl: HTMLElement | null = null
  /** Room reached 100% â€” waiting for player to pick an upgrade. */
  private roomUpgradePaused = false
  private roomUpgradePendingReveal: (() => void) | null = null
  private readonly roomUpgradePicker: ReturnType<
    typeof mountRoomUpgradePicker
  > | null
  private readonly trapField: TrapFieldSystem
  private readonly mazeWalls: GridMazeWallSystem
  private readonly roomGridPlans: ReadonlyMap<NormalRoomId, RoomGridPlan>
  private readonly gridWispTotalsPerRoom: ReadonlyMap<RoomId, number>
  private readonly baseTrapPlacements: readonly TrapPlacement[]
  private readonly baseMazeWallPlacements: readonly MazeWallPlacement[]
  private readonly wispsCollectedPerRoom = new Map<RoomId, number>()
  private endlessModeActive = false
  private endlessCurrentRoomNumber = NORMAL_ROOM_COUNT
  private endlessRoomWispTotal = 0
  private endlessRoomWispsCollected = 0
  private endlessRoomCleared = false
  private endlessCurrentWispIds: string[] = []
  private endlessCurrentPowerPelletId: string | null = null
  private readonly playerTrail: PlayerMotionTrail
  private readonly presentTrackEl: HTMLElement
  private readonly presentTrackFillEl: HTMLElement
  private readonly presentTrackLabelEl: HTMLElement
  private readonly presentTrackSubEl: HTMLElement
  private presentTrackTimer: ReturnType<typeof setTimeout> | null = null
  private readonly presentOverlayEl: HTMLElement
  private readonly presentOverlayEyebrowEl: HTMLElement
  private readonly presentOverlayTitleEl: HTMLElement
  private readonly presentOverlaySubEl: HTMLElement
  private readonly presentOverlayRewardEl: HTMLElement
  private readonly presentOverlayActionBtn: HTMLButtonElement
  private presentOverlayPhase: PendingTrailPresentPhase = 'closed'
  private presentOverlayContinue: (() => void) | null = null
  private presentOverlayPendingRewardId: PresentRewardId | null = null
  private presentOverlayPaused = false
  private readonly tutorialOverlayEl: HTMLElement
  private tutorialPaused = true
  private ghostHitSlowMoRemain = 0
  private roomEntrySlowMoRemain = 0
  private trapHitSlowMoRemain = 0
  private powerPickupSlowMoRemain = 0
  private hudStackHum: HTMLElement | null = null
  private depositShakeTimer: ReturnType<typeof setTimeout> | null = null
  private ectoGlowTimer: ReturnType<typeof setTimeout> | null = null
  private roomHudUrgencyTimer: ReturnType<typeof setTimeout> | null = null
  private readonly viewportClassTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >()
  private pickupComboCount = 0
  private pickupComboRemain = 0
  private readonly roomUrgencyShown = new Set<string>()
  private roomEntryTrailRemain = 0
  private powerBurstTrailRemain = 0
  private recoverTrailRemain = 0
  /** Hide north welcome banner after first exit from the safe hub room. */
  private hubWelcomeHidden = false
  private wasInSafeRoom = true
  private gameStartCountdownRemain = 3
  private gameStartCountdownStep = -1
  private readonly gameStartCountdownEl: HTMLElement
  private readonly navDebugHudEl: HTMLElement | null
  private lastNavIdleWarnSec = -999
  private roomLagAuditStaticLogged = false
  private lastLagAuditArea: AreaId | null = null
  private lastLagAuditNavBoundsKey = ''
  private readonly pendingDoorPassageEvents: {
    roomIndex: number
    doorIndex: number
  }[] = []

  /** Room clear: zoom out + slow-mo while ghosts fade; then upgrade picker. */
  private roomClearIntroCinematicRunning = false
  private roomClearIntroCinematicElapsed = 0
  /** After upgrade: short door hero shot + â€œUnlockedâ€ feedback, then return. */
  private roomClearDoorCinematicRunning = false
  private roomClearDoorCinematicElapsed = 0
  private roomClearDoorCinematicDoorIndex = 0
  private roomClearDoorUnlockFeedbackDone = false
  private readonly roomClearCineStartPos = new Vector3()
  private readonly roomClearCinePullBackPos = new Vector3()
  private readonly roomClearCineDoorViewPos = new Vector3()
  private readonly roomClearCineLookAtDoor = new Vector3()
  private readonly roomClearCineLookBlend = new Vector3()

  /** Reused by boss intro camera return (follow rig target + look). */
  private readonly gateCinePlayerLook = new Vector3()
  private readonly gateCineRigDesired = new Vector3()

  /** Final room: short camera beat before `BossRoomController.startFight`. */
  private bossIntroCinematicRunning = false
  private bossIntroCinematicElapsed = 0
  /** Set when intro has been queued so we never double-start. */
  private bossIntroCinematicDone = false
  private readonly bossCineStartPos = new Vector3()
  private readonly bossCinePullPos = new Vector3()
  private readonly bossCineBossLook = new Vector3()
  private readonly bossCineBlendLook = new Vector3()
  /** Seconds until success overlay after boss defeat (ghosts fading). */
  private bossVictoryOutroRemain: number | null = null

  private readonly handlePresentOverlayAction = (): void => {
    if (this.presentOverlayPhase === 'ready') {
      this.openPendingPresentReward()
      return
    }
    if (this.presentOverlayPhase === 'opened') {
      this.finishPresentOverlayFlow()
    }
  }

  private readonly handleTutorialContinue = (): void => {
    this.tutorialPaused = false
    this.tutorialOverlayEl.classList.remove('door-tutorial-overlay--show')
    this.tutorialOverlayEl.setAttribute('aria-hidden', 'true')
  }

  constructor(
    host: HTMLElement,
    ghostGltfTemplate: GhostGltfTemplate | null = null,
    playerGltfTemplate: PlayerGltfTemplate | null = null,
    onRunFailedRetry?: () => void | Promise<void>,
  ) {
    this.onRunFailedRetry = onRunFailedRetry
    const run = createRunRandom()
    this.runRandom = run.random
    this.roomSystem = new RoomSystem(this.runRandom)
    this.playerGltfTemplate = playerGltfTemplate
    this.gameViewport =
      host.querySelector<HTMLElement>('#game-viewport') ?? host
    const roomUpgradeRoot = host.querySelector<HTMLElement>(
      '#room-upgrade-overlay',
    )
    this.roomUpgradePicker = roomUpgradeRoot
      ? mountRoomUpgradePicker(roomUpgradeRoot)
      : null
    const {
      scene,
      playerRoot,
      stackAnchor,
      pickupGroup,
      ghostGroup,
      playerCharacter,
      hubTitleFloorLabel,
    } = createScene(playerGltfTemplate)

    this.hubTitleFloorLabel = hubTitleFloorLabel

    this.scene = scene
    attachGridCellDebugOverlays(scene)
    this.burstGroup = new Group()
    this.burstGroup.name = 'ghostHitBurst'
    this.burstGroup.renderOrder = 50
    this.scene.add(this.burstGroup)

    this.hudCarryEl = host.querySelector<HTMLElement>('#hud-carry')
    this.hudSpawn = host.querySelector('#hud-spawn')
    this.hudRoomCleanWrap = host.querySelector('#hud-room-clean')
    this.hudRoomCleanFill = host.querySelector('#hud-room-clean-fill')
    this.hudRoomCleanPct = host.querySelector('#hud-room-clean-pct')
    this.hudRoomCleanTitle = host.querySelector('#hud-room-clean-title')
    let hudSafePbWrap: HTMLElement | null = null
    let hudSafePbSummaryEl: HTMLElement | null = null
    let hudSafePbActionsEl: HTMLElement | null = null
    if (this.hudRoomCleanWrap) {
      for (const stale of this.hudRoomCleanWrap.querySelectorAll('.hud-room-clean__pb')) {
        stale.remove()
      }
      hudSafePbWrap = document.createElement('div')
      hudSafePbWrap.className = 'hud-room-clean__pb'

      const summaryRow = document.createElement('div')
      summaryRow.className = 'hud-room-clean__pb-row'
      const summaryLabel = document.createElement('span')
      summaryLabel.className = 'hud-room-clean__pb-label'
      summaryLabel.textContent = 'Personal best'
      hudSafePbSummaryEl = document.createElement('span')
      hudSafePbSummaryEl.className = 'hud-room-clean__pb-value'
      summaryRow.append(summaryLabel, hudSafePbSummaryEl)

      hudSafePbActionsEl = document.createElement('div')
      hudSafePbActionsEl.className = 'hud-room-clean__pb-actions'

      const leaderboardBtn = document.createElement('button')
      leaderboardBtn.type = 'button'
      leaderboardBtn.className = 'hud-room-clean__pb-btn hud-room-clean__pb-btn--primary'
      leaderboardBtn.textContent = 'Leaderboards'
      leaderboardBtn.addEventListener('click', () => {
        this.openLeaderboard()
      })

      hudSafePbActionsEl.append(leaderboardBtn)
      hudSafePbWrap.append(summaryRow, hudSafePbActionsEl)
      this.hudRoomCleanWrap.appendChild(hudSafePbWrap)
    }
    this.hudSafePbSummaryEl = hudSafePbSummaryEl
    this.hudSafePbActionsEl = hudSafePbActionsEl
    this.hudCameraHintEl = host.querySelector<HTMLElement>('#hud-camera-hint')
    this.hudCameraHintEl?.remove()
    this.hudLivesWrap = host.querySelector<HTMLElement>('#hud-lives')
    this.hudStackHum = host.querySelector('#hud-stack-hum')
    this.gameStartCountdownEl = document.createElement('div')
    this.gameStartCountdownEl.className = 'game-start-countdown'
    this.gameStartCountdownEl.setAttribute('aria-live', 'polite')
    this.gameStartCountdownEl.setAttribute('aria-atomic', 'true')
    this.gameViewport.appendChild(this.gameStartCountdownEl)
    this.presentTrackEl = document.createElement('div')
    this.presentTrackEl.className = 'present-track'
    this.presentTrackEl.setAttribute('aria-live', 'polite')
    this.presentTrackEl.setAttribute('aria-hidden', 'true')
    const presentTrackPanel = document.createElement('div')
    presentTrackPanel.className = 'present-track__panel'
    const presentTrackMeta = document.createElement('div')
    presentTrackMeta.className = 'present-track__meta'
    this.presentTrackLabelEl = document.createElement('div')
    this.presentTrackLabelEl.className = 'present-track__label'
    this.presentTrackSubEl = document.createElement('div')
    this.presentTrackSubEl.className = 'present-track__sub'
    presentTrackMeta.append(this.presentTrackLabelEl, this.presentTrackSubEl)
    const presentTrackBar = document.createElement('div')
    presentTrackBar.className = 'present-track__bar'
    this.presentTrackFillEl = document.createElement('div')
    this.presentTrackFillEl.className = 'present-track__fill'
    presentTrackBar.appendChild(this.presentTrackFillEl)
    presentTrackPanel.append(presentTrackMeta, presentTrackBar)
    this.presentTrackEl.appendChild(presentTrackPanel)
    this.gameViewport.appendChild(this.presentTrackEl)
    this.presentOverlayEl = document.createElement('div')
    this.presentOverlayEl.className = 'present-overlay hidden'
    this.presentOverlayEl.setAttribute('aria-hidden', 'true')
    const presentOverlayBackdrop = document.createElement('div')
    presentOverlayBackdrop.className = 'present-overlay__backdrop'
    presentOverlayBackdrop.setAttribute('aria-hidden', 'true')
    const presentOverlayPanel = document.createElement('div')
    presentOverlayPanel.className = 'present-overlay__panel'
    this.presentOverlayEyebrowEl = document.createElement('p')
    this.presentOverlayEyebrowEl.className = 'present-overlay__eyebrow'
    this.presentOverlayTitleEl = document.createElement('h2')
    this.presentOverlayTitleEl.className = 'present-overlay__title'
    this.presentOverlaySubEl = document.createElement('p')
    this.presentOverlaySubEl.className = 'present-overlay__sub'
    this.presentOverlayRewardEl = document.createElement('div')
    this.presentOverlayRewardEl.className = 'present-overlay__reward'
    this.presentOverlayActionBtn = document.createElement('button')
    this.presentOverlayActionBtn.type = 'button'
    this.presentOverlayActionBtn.className = 'present-overlay__action'
    this.presentOverlayActionBtn.addEventListener(
      'click',
      this.handlePresentOverlayAction,
    )
    presentOverlayPanel.append(
      this.presentOverlayEyebrowEl,
      this.presentOverlayTitleEl,
      this.presentOverlaySubEl,
      this.presentOverlayRewardEl,
      this.presentOverlayActionBtn,
    )
    this.presentOverlayEl.append(presentOverlayBackdrop, presentOverlayPanel)
    this.gameViewport.appendChild(this.presentOverlayEl)
    this.tutorialOverlayEl = document.createElement('div')
    this.tutorialOverlayEl.className = 'door-tutorial-overlay door-tutorial-overlay--show'
    this.tutorialOverlayEl.setAttribute('aria-hidden', 'false')
    const tutorialBackdrop = document.createElement('div')
    tutorialBackdrop.className = 'door-tutorial-overlay__backdrop'
    tutorialBackdrop.setAttribute('aria-hidden', 'true')
    const tutorialPanel = document.createElement('div')
    tutorialPanel.className = 'door-tutorial-overlay__panel'
    const tutorialEyebrow = document.createElement('p')
    tutorialEyebrow.className = 'door-tutorial-overlay__eyebrow'
    tutorialEyebrow.textContent = 'How to play'
    const tutorialTitle = document.createElement('h2')
    tutorialTitle.className = 'door-tutorial-overlay__title'
    tutorialTitle.textContent = 'Sweep rooms. Stay unseen.'
    const tutorialCopy = document.createElement('div')
    tutorialCopy.className = 'door-tutorial-overlay__copy'
    tutorialCopy.innerHTML =
      '<p>Collect every wisp in a room to clear it and unlock the next gate.</p><p>Ghosts patrol on the same grid you do. Break line of sight with walls and avoid their vision cones.</p><p>Power pickups let you flip the chase for a short time, and present rewards unlock new trails as you push deeper.</p>'
    const tutorialStatus = document.createElement('p')
    tutorialStatus.className = 'door-tutorial-overlay__status'
    tutorialStatus.textContent = 'Tap OK to begin'
    const tutorialContinue = document.createElement('button')
    tutorialContinue.type = 'button'
    tutorialContinue.className = 'door-tutorial-overlay__continue'
    tutorialContinue.textContent = 'OK'
    tutorialContinue.addEventListener('click', this.handleTutorialContinue)
    tutorialPanel.append(
      tutorialEyebrow,
      tutorialTitle,
      tutorialCopy,
      tutorialStatus,
      tutorialContinue,
    )
    this.tutorialOverlayEl.append(tutorialBackdrop, tutorialPanel)
    this.gameViewport.appendChild(this.tutorialOverlayEl)
    this.navDebugHudEl = host.querySelector('#nav-debug-hud')
    if (!SHOW_PLAYER_NAV_DEBUG_HUD && this.navDebugHudEl) {
      this.navDebugHudEl.style.display = 'none'
    }
    this.syncGameStartCountdown()
    this.syncSafeRoomPersonalBestHud()

    this.camera = createCamera(
      host.clientWidth / Math.max(host.clientHeight, 1),
    )
    this.renderer = createRenderer(host)
    this.unsubscribeResize = subscribeViewportResize(
      this.camera,
      this.renderer,
      host,
    )

    /** Joystick on canvas only so HUD buttons receive taps (viewport capture broke upgrades). */
    this.joystick = new TouchJoystick(this.renderer.domElement)
    this.keyboardMove = new KeyboardMoveInput()
    this.player = new PlayerController(
      playerRoot,
      this.worldCollision,
      PLAYER_BASE_MAX_SPEED,
      12,
      (x, z) => this.roomSystem.getRoomAt(x, z),
    )
    this.playerCharacter = playerCharacter

    this.stackVisual = new StackVisual(stackAnchor)
    this.stack = new CarryStack(UNLIMITED_STACK_MAX, () => {
      this.stackVisual.sync(
        this.stack.getSnapshot(),
        this.getRoomCleaningProgressForBag(),
      )
      if (this.hudCarryEl) this.hudCarryEl.textContent = String(this.stack.count)
    })
    if (this.hudCarryEl) this.hudCarryEl.textContent = '0'
    this.stackVisual.sync(this.stack.getSnapshot(), 0)

    this.cameraRig = new CameraRig(
      this.camera,
      playerRoot,
      () => computeCarryEncumbranceWeight(this.stack.count),
      {
        worldCollision: this.worldCollision,
        getFacingYaw: () => this.player.getFacingYaw(),
      },
    )
    void this.syncCameraModeHud
    void this.applyOtsCameraRelativeMove
    this.syncLivesHud()

    this.itemWorld = new ItemWorld(pickupGroup, scene)
    this.itemWorld.prewarmWispPool(8)

    this.doorUnlock = new DoorUnlockSystem({
      scene: this.scene,
      worldCollision: this.worldCollision,
      onDoorPassageCleared: (doorIndex) => {
        const nextRoom = doorIndex + 1
        if (nextRoom >= 1 && nextRoom <= NORMAL_ROOM_COUNT) {
          this.pendingDoorPassageEvents.push({
            roomIndex: nextRoom,
            doorIndex,
          })
        }
      },
      onDoorSlamShut: (doorIndex) => {
        /** Next frame — avoids stacking burst/DOM work on the same frame as door slam + render. */
        requestAnimationFrame(() => this.triggerDoorImpactJuice(doorIndex))
      },
    })

    this.roomSystem.configureRoomAccess((roomId) =>
      this.doorUnlock.canAccessRoomForSpawning(roomId),
    )

    this.roomLockCovers = new RoomLockCoverSystem(this.scene, this.doorUnlock)

    const { plans: roomGridPlans, wispTotals: gridWispTotalsPerRoom } =
      planAllRoomGrids(this.roomSystem, this.runRandom)
    this.roomGridPlans = roomGridPlans
    this.gridWispTotalsPerRoom = gridWispTotalsPerRoom
    this.baseMazeWallPlacements = flattenMazeWallPlacements(roomGridPlans)
    this.baseTrapPlacements = flattenTrapPlacements(roomGridPlans)
    this.mazeWalls = new GridMazeWallSystem(
      this.scene,
      this.baseMazeWallPlacements,
    )
    this.worldCollision.setStructureColliders(this.mazeWalls.getColliders())
    this.trapField = new TrapFieldSystem(
      this.scene,
      this.baseTrapPlacements,
    )
    spawnGridWispsForPlans(
      roomGridPlans,
      this.itemWorld,
      (roomId) => this.roomSystem.isRoomAccessibleForGameplay(roomId),
      (id, hue, value, roomId) => createWispItem(hue, value, id, roomId),
      this.runRandom,
    )
    spawnPowerPelletsForRun(
      roomGridPlans,
      this.itemWorld,
      (roomId) => this.roomSystem.isRoomAccessibleForGameplay(roomId),
      this.runRandom,
    )
    const finalBossPellet = cellCenterWorld(
      this.roomSystem.getBounds(FINAL_NORMAL_ROOM_ID),
      ROOM_GRID_ROWS - 2,
      Math.floor(ROOM_GRID_COLS / 2),
      ROOM_GRID_ROWS,
      ROOM_GRID_COLS,
    )
    this.itemWorld.spawn(
      createPowerPelletItem(`power_pellet_${FINAL_NORMAL_ROOM_ID}`, FINAL_NORMAL_ROOM_ID),
      finalBossPellet.x,
      finalBossPellet.z,
      {
        visible: this.roomSystem.isRoomAccessibleForGameplay(FINAL_NORMAL_ROOM_ID),
      },
    )
    this.playerTrail = new PlayerMotionTrail(this.scene)
    this.applyEquippedTrailStyle()

    this.specialRelicSpawns = new SpecialRelicSpawnSystem({
      itemWorld: this.itemWorld,
      roomSystem: this.roomSystem,
      worldCollision: this.worldCollision,
      createRelic: () => createRelicItem(),
      random: this.runRandom,
      onSpawn: () => {},
      canSpawnInRoom: (id) =>
        this.doorUnlock.canAccessRoomForSpawning(id) &&
        id !== FINAL_NORMAL_ROOM_ID,
    })
    this.relicFootArrow = createSpecialRelicFootArrow()
    this.scene.add(this.relicFootArrow.root)
    this.ghostGltfTemplate = ghostGltfTemplate
    this.ghostSystem = new GhostSystem(
      ghostGroup,
      this.worldCollision,
      partitionGhostSpawnsByRoom(),
      ghostGltfTemplate,
      this.doorUnlock,
    )

    this.bossRoom = new BossRoomController({
      doorUnlock: this.doorUnlock,
      ghostSystem: this.ghostSystem,
      worldCollision: this.worldCollision,
      random: this.runRandom,
      onPulsePlayer: (bx, bz) => {
        this.player.getPosition(this.playerPos)
        this.player.applyGhostKnockback(
          bx,
          bz,
          this.playerPos.x,
          this.playerPos.z,
          BOSS_PULSE_KNOCK_STRENGTH,
        )
        this.triggerDepositScreenShake(false)
      },
      onVictory: () => {
        this.completeBossRunVictory()
      },
    })

    this.roomCleanliness = new RoomCleanlinessSystem({
      wispTotalsByRoom: gridWispTotalsPerRoom,
      onRoomCleared: (roomId, doorIndex) => {
        void playRoomClearFanfare()
        const idx = roomIndexFromId(roomId)
        if (idx === null || idx < 1) return
        this.beginRewardedRoomClear(roomId, doorIndex, idx)
      },
    })

    if (this.hudSpawn) {
      this.hudSpawn.textContent = ''
    }

    this.hitFlashEl = host.querySelector('#hud-hit-flash')
    this.collection = new CollectionSystem()

    this.player.settleToGridCenter((x, z) =>
      this.roomSystem.getNavGridBounds(x, z, this.player.getGridNavContext()),
    )

    this.syncPlayerCharacterVisual(0)
    primeFloatingHudEffects(this.gameViewport)
    this.ghostSystem.prewarmAllFutureGhosts()

    this.player.getPosition(this.playerPos)

    this.initRunUpgrades()

    const tick = (now: number) => {
      if (this.gameOver) return
      this.raf = requestAnimationFrame(tick)
        if (this.roomUpgradePaused || this.presentOverlayPaused) {
          this.lastTime = now
          this.perf.beginFrame(now)
          this.renderer.render(this.scene, this.camera)
          this.perf.endFrame(this.renderer.info.render.calls, 0)
          return
      }
        const dt = Math.min(0.05, (now - this.lastTime) / 1000)
        this.lastTime = now
        this.perf.beginFrame(now)
        if (this.tutorialPaused) {
          this.syncPlayerCharacterVisual(dt)
          this.renderer.render(this.scene, this.camera)
          this.perf.endFrame(this.renderer.info.render.calls, 0)
          return
        }
        if (this.gameStartCountdownRemain > 0) {
          this.updateGameStartCountdown(dt)
          this.ghostSystem.prewarmFutureGhosts(4)
        this.syncPlayerCharacterVisual(dt)
        this.renderer.render(this.scene, this.camera)
        this.perf.endFrame(this.renderer.info.render.calls, 0)
        return
      }
      this.elapsedSec += dt

      let pickupsThisFrame = 0

        let move = mergeMoveInput(
          this.joystick.getVector(),
          this.keyboardMove.getVector(),
        )
        if (this.isInteractionCinematicBlocking()) {
          move = { x: 0, y: 0, fingerDown: false, active: false }
        }

      this.player.getPosition(this.playerPos)
      const auditEnabled = this.isRoomLagAuditEnabled()
      if (auditEnabled) this.logRoomLagStaticSnapshotOnce()
      const frameAuditStartMs = auditEnabled ? performance.now() : 0
      const roomEarly = this.roomSystem.getRoomAt(
        this.playerPos.x,
        this.playerPos.z,
      )
      const areaBeforeFrame = auditEnabled
        ? this.roomSystem.getAreaAt(this.playerPos.x, this.playerPos.z)
        : null
      const roomBeforeFrame = auditEnabled ? roomEarly : null
      this.updateDeepestRoomReached(roomEarly)
      this.updateBossReachStat(roomEarly)
      this.refreshRoomShield(roomEarly)
      const inSafeRoomEarly = roomEarly === 'SAFE_CENTER'
      if (
        !this.hubWelcomeHidden &&
        this.wasInSafeRoom &&
        !inSafeRoomEarly
      ) {
        this.hubTitleFloorLabel.hideWelcomeBanner()
        this.hubWelcomeHidden = true
      }
      this.wasInSafeRoom = inSafeRoomEarly
      this.flushPendingDoorPassageEvents()

      const roomPre = this.roomSystem.getRoomAt(this.playerPos.x, this.playerPos.z)
      if (
        roomPre === FINAL_NORMAL_ROOM_ID &&
        this.bossRoom.isIdle() &&
        !this.bossIntroCinematicRunning &&
        !this.bossIntroCinematicDone
      ) {
        this.bossIntroCinematicDone = true
        this.beginBossIntroCinematic()
      }
      this.bossRoom.update(dt, roomPre)
      this.syncRoomCleanHud(roomPre)
      this.stackVisual.sync(
        this.stack.getSnapshot(),
        this.getRoomCleaningProgressForBag(),
      )
      let trapFieldMs = 0
      let playerMs = 0
      let doorUnlockMs = 0
      let itemWorldMs = 0
      let collectionMs = 0
      let ghostSystemMs = 0
      let sectionStartMs = auditEnabled ? performance.now() : 0
      const trapSlow = this.trapField.update(
        this.elapsedSec,
        this.playerPos.x,
        this.playerPos.z,
        this.player.radius,
        {
          onStepTrap: (x, z) => {
            this.applyTrapLifeLoss(x, z)
          },
        },
      )
      if (auditEnabled) {
        trapFieldMs = performance.now() - sectionStartMs
      }
      const weight = computeCarryEncumbranceWeight(this.stack.count)
      const relief = this.runUpgrades.encumbranceReliefStacks
      this.player.setMovementSlowMultiplier(
        stackWeightSpeedMultiplierRelief(weight, relief) * trapSlow,
      )
      this.player.setDragWeightMultiplier(
        stackWeightDragMultiplierRelief(weight, relief),
      )
      this.syncStackJuiceHud(weight)

      this.pickupComboRemain = Math.max(0, this.pickupComboRemain - dt)
      if (this.pickupComboRemain <= 0) {
        this.pickupComboCount = 0
      }
      this.roomEntryTrailRemain = Math.max(0, this.roomEntryTrailRemain - dt)
      this.powerBurstTrailRemain = Math.max(0, this.powerBurstTrailRemain - dt)
      this.recoverTrailRemain = Math.max(0, this.recoverTrailRemain - dt)

      let simScale = 1
      if (this.ghostHitSlowMoRemain > 0) {
        simScale = Math.min(simScale, GHOST_HIT_SLOW_MO_SCALE)
      }
      this.ghostHitSlowMoRemain = Math.max(0, this.ghostHitSlowMoRemain - dt)
      if (this.roomEntrySlowMoRemain > 0) {
        simScale = Math.min(simScale, 0.78)
      }
      this.roomEntrySlowMoRemain = Math.max(0, this.roomEntrySlowMoRemain - dt)
      if (this.trapHitSlowMoRemain > 0) {
        simScale = Math.min(simScale, 0.68)
      }
      this.trapHitSlowMoRemain = Math.max(0, this.trapHitSlowMoRemain - dt)
      if (this.powerPickupSlowMoRemain > 0) {
        simScale = Math.min(simScale, 0.5)
      }
      this.powerPickupSlowMoRemain = Math.max(0, this.powerPickupSlowMoRemain - dt)
      let simDt = dt * simScale
      if (this.bossIntroSlowMoActive()) {
        simDt *= BOSS_CINE_SLOW_SIM_SCALE
      }
      if (this.roomClearIntroCinematicSlowMoActive()) {
        simDt *= ROOM_CLEAR_CINE_SLOW_SIM_SCALE
      }

      if (auditEnabled) sectionStartMs = performance.now()
      this.player.update(
        simDt,
        move,
        (x, z) =>
          this.roomSystem.getNavGridBounds(x, z, this.player.getGridNavContext()),
        (x, z) => this.roomSystem.getGridBoundsAt(x, z),
      )
      if (auditEnabled) {
        playerMs = performance.now() - sectionStartMs
      }
      if (SHOW_PLAYER_NAV_DEBUG_HUD && this.navDebugHudEl) {
        const snap = this.player.getNavDebugSnapshot()
        this.navDebugHudEl.textContent = formatNavDebugHud(snap)
        if (
          snap.idleBlocked &&
          this.elapsedSec - this.lastNavIdleWarnSec >= 0.85
        ) {
          this.lastNavIdleWarnSec = this.elapsedSec
          console.warn('[player nav] IDLE BLOCKED â€” finger down but no segment', {
            ...snap,
          })
        }
      }
      this.player.getPosition(this.playerPos)
      this.player.getVelocity(this.velScratch)
      const speedNow = this.player.getHorizontalSpeed()
      const yaw = this.player.getFacingYaw()
      const doorPlayer: DoorPlayerSample = {
        x: this.playerPos.x,
        z: this.playerPos.z,
        radius: this.player.radius,
        vz: this.velScratch.z,
        facingX: -Math.sin(yaw),
        facingZ: -Math.cos(yaw),
      }
      if (auditEnabled) sectionStartMs = performance.now()
      this.doorUnlock.update(dt, this.elapsedSec, doorPlayer)
      if (auditEnabled) {
        doorUnlockMs = performance.now() - sectionStartMs
      }
      this.itemWorld.updateClutterGateReveal(this.doorUnlock)
      this.itemWorld.updateGridWispRoomVisibility(this.roomSystem)
      this.roomLockCovers.update()

      if (auditEnabled) sectionStartMs = performance.now()
      this.itemWorld.updateVisuals(this.elapsedSec, dt)
      if (auditEnabled) {
        itemWorldMs = performance.now() - sectionStartMs
      }

      let trailMode: PlayerMotionTrailMode = 'heavy'
      let trailIntensity = weight >= 0.72 ? (weight - 0.72) / (1 - 0.72) : 0
      if (this.roomEntryTrailRemain > 0) {
        trailMode = 'sprint'
        trailIntensity = Math.max(
          trailIntensity,
          0.3 + this.roomEntryTrailRemain * 0.45,
        )
      }
      if (this.recoverTrailRemain > 0) {
        trailMode = 'recover'
        trailIntensity = Math.max(trailIntensity, 0.42 + this.recoverTrailRemain * 0.35)
      }
      if (this.powerModeRemain > 0 || this.powerBurstTrailRemain > 0) {
        trailMode = 'power'
        trailIntensity = Math.max(
          trailIntensity,
          0.4 + Math.min(0.36, this.powerBurstTrailRemain * 0.5),
        )
      }
      this.playerTrail.update(
        this.playerPos.x,
        this.playerPos.z,
        0.02,
        trailIntensity,
        dt,
        { mode: trailMode, speed: speedNow },
      )

      const hadPowerHud = this.powerModeRemain > 0
      this.powerModeRemain = Math.max(0, this.powerModeRemain - simDt)
      if (hadPowerHud && this.powerModeRemain <= 0) {
        this.gameViewport.classList.remove('game-viewport--power-mode')
      }

      if (auditEnabled) sectionStartMs = performance.now()
      const collected = this.collection.update(
        this.player,
        this.stack,
        this.itemWorld,
        dt,
        {
          pickupBlocked:
            this.ghostHitPickupLockRemain > 0 ||
          this.isInteractionCinematicBlocking(),
        },
      )
      if (auditEnabled) {
        collectionMs = performance.now() - sectionStartMs
      }
      for (const { item, pickupX, pickupZ } of collected) {
        let remainingWispsInRoom: number | null = null
        if (item.type === 'power_pellet') {
          this.activatePowerMode(pickupX, pickupZ)
        }
        if (item.type === 'wisp' && item.spawnRoomId) {
          this.runStatWispsCollected += 1
          if (
            this.endlessModeActive &&
            item.spawnRoomId === FINAL_NORMAL_ROOM_ID
          ) {
            this.registerEndlessWispCollected()
          } else {
            this.roomCleanliness.registerGridWispCollected(item.spawnRoomId)
            const prevCollected =
              this.wispsCollectedPerRoom.get(item.spawnRoomId) ?? 0
            const collectedAfter = prevCollected + 1
            this.wispsCollectedPerRoom.set(item.spawnRoomId, collectedAfter)
            const totalWispsInRoom =
              this.gridWispTotalsPerRoom.get(item.spawnRoomId) ?? 0
            remainingWispsInRoom = Math.max(0, totalWispsInRoom - collectedAfter)
            const roomIndex = this.roomChainIndexFromId(item.spawnRoomId)
            const activeGhostCap = maxActiveGhostsForRoomProgress(roomIndex)
            if (!this.bossRoom.isFightActive()) {
              const ghostFromThisRoom =
                roomPre !== null && item.spawnRoomId === roomPre
              if (
                ghostFromThisRoom &&
                totalWispsInRoom > 0 &&
                this.ghostSystem.getActiveGhostCount() < activeGhostCap &&
                this.runRandom() <
                  wispCollectGhostSpawnProbability(
                    collectedAfter,
                    totalWispsInRoom,
                    this.runUpgrades.hauntedChanceBonus,
                    roomIndex,
                  )
              ) {
                const plan = this.roomGridPlans.get(
                  item.spawnRoomId as NormalRoomId,
                )
                let spawn: { x: number; z: number; roomIndex: number } | null =
                  null
                if (plan) {
                  const xz = pickGridGhostSpawnXZ(
                    plan,
                    this.playerPos.x,
                    this.playerPos.z,
                    WISP_GHOST_SPAWN_MIN_PLAYER_DIST,
                    this.runRandom,
                  )
                  if (xz) {
                    const visualMul = ghostRoomVisualMul(roomIndex)
                    const placed = this.worldCollision.resolveCircleXZ(
                      xz.x,
                      xz.z,
                      GHOST_COLLISION_RADIUS * visualMul,
                    )
                    spawn = {
                      x: placed.x,
                      z: placed.z,
                      roomIndex,
                    }
                  }
                }
                if (!spawn) {
                  spawn = this.resolveGhostSpawnFromHauntedClutter(
                    pickupX,
                    pickupZ,
                    item.spawnRoomId,
                  )
                }
                this.ghostSystem.spawnGhost({
                  x: spawn.x,
                  z: spawn.z,
                  roomIndex: spawn.roomIndex,
                  color: pickGhostColorForRoomIndex(
                    spawn.roomIndex,
                    this.runRandom,
                  ),
                })
                this.triggerEnemySpawnJuice(1)
              }
            }
          }
        }
        if (item.type === 'wisp') {
          void playWispCollectPop()
          this.triggerWispPickupJuice(
            pickupX,
            pickupZ,
            item.spawnRoomId ?? null,
            remainingWispsInRoom,
          )
        }
        if (
          item.type === 'wisp' ||
          item.type === 'relic' ||
          item.type === 'gem'
        ) {
        }
      }
      pickupsThisFrame = collected.length

      if (this.powerModeRemain > 0) {
        this.gameViewport.classList.add('game-viewport--power-mode')
      }
      this.cameraRig.setPowerModeActive(this.powerModeRemain > 0)

      if (auditEnabled) sectionStartMs = performance.now()
      this.ghostSystem.update(
        simDt,
        dt,
        this.playerPos,
        this.stack.hasRelic(),
        this.isInteractionCinematicBlocking(),
        this.powerModeRemain > 0,
      )
      if (auditEnabled) {
        ghostSystemMs = performance.now() - sectionStartMs
      }
      const coneAggroTriggers = this.ghostSystem.consumeVisionAggroEvents()
      if (coneAggroTriggers > 0) {
        this.triggerGhostAggroJuice(
          coneAggroTriggers,
          this.ghostSystem.consumeVisionAggroPositions(),
        )
      } else {
        this.ghostSystem.consumeVisionAggroPositions()
      }
      const lostChases = this.ghostSystem.consumeChaseLostPositions()
      if (lostChases.length > 0) {
        this.triggerGhostLostJuice(lostChases)
      }

      this.ghostHitInvuln = Math.max(0, this.ghostHitInvuln - dt)
      this.ghostHitPickupLockRemain = Math.max(
        0,
        this.ghostHitPickupLockRemain - dt,
      )
      if (!this.ghostDamageArmed) {
        if (
          this.ghostSystem.isPlayerClearForGhostDamageRearm(
            this.playerPos,
            this.player.radius,
          )
        ) {
          this.ghostDamageArmed = true
        }
      }
      const invuln = this.ghostHitInvuln > 0
      if (invuln !== this.lastGhostInvuln) {
        this.gameViewport.classList.toggle('game-viewport--ghost-invuln', invuln)
        this.lastGhostInvuln = invuln
      }

      if (
        this.powerModeRemain > 0 &&
        !this.isInteractionCinematicBlocking()
      ) {
        const eat = this.ghostSystem.tryEatGhost(
          this.playerPos,
          this.player.radius,
          true,
        )
        if (eat.kind === 'eat') {
          this.burstSpawnScratch.set(eat.ghostX, 0.42, eat.ghostZ)
          this.burstParticles.push(
            ...spawnGhostHitEctoplasmBurst(
              this.burstGroup,
              this.burstSpawnScratch,
            ),
            ...spawnFloorRingBurst(this.burstGroup, this.burstSpawnScratch, {
              color: 0x76ffd9,
              opacity: 0.26,
              startScale: 0.45,
              endScale: 1.85,
              y: 0.04,
              lifeSec: 0.38,
            }),
          )
          spawnFloatingHudText(
            this.gameViewport,
            '+200',
            'float-hud--combo',
            { topPct: 28, leftPct: 50, durationSec: 0.92, risePx: 26 },
          )
        }
      }

      const hit = this.ghostSystem.tryHitPlayer(
        this.playerPos,
        this.player.radius,
        this.ghostHitInvuln > 0 ||
          !this.ghostDamageArmed ||
          this.isInteractionCinematicBlocking(),
      )
      if (hit.kind === 'hit') {
        this.ghostDamageArmed = false
        this.ghostHitInvuln = GHOST_HIT_INVULN_SEC
        this.player.applyGhostKnockback(
          hit.ghostX,
          hit.ghostZ,
          this.playerPos.x,
          this.playerPos.z,
        )
        this.recoverTrailRemain = 0.68
        this.burstSpawnScratch.copy(this.playerPos)
        this.burstSpawnScratch.y += 0.04
        this.burstParticles.push(
          ...spawnFloorRingBurst(this.burstGroup, this.burstSpawnScratch, {
            color: 0xff90a7,
            opacity: 0.28,
            startScale: 0.36,
            endScale: 1.45,
            y: 0.03,
            lifeSec: 0.22,
          }),
        )
        this.triggerGhostHitFlash(210, true)
        this.triggerDepositScreenShake(false)
        this.pulseViewportClass('game-viewport--pulse-danger', 220)
        this.ghostHitPickupLockRemain = GHOST_HIT_PICKUP_LOCK_SEC

        /** Ghost hits cost a life only â€” stack is preserved (no dropped pickups). */
        this.stackVisual.triggerGhostHitReaction()
        this.ghostHitSlowMoRemain = GHOST_HIT_SLOW_MO_SEC

        this.burstSpawnScratch.copy(this.playerPos)
        this.burstSpawnScratch.y += 0.38
        const lostItems: GameItem[] = []
        this.burstParticles.push(
          ...spawnGhostHitEctoplasmBurst(this.burstGroup, this.burstSpawnScratch),
          ...spawnGhostHitPelletBurst(
            this.burstGroup,
            this.burstSpawnScratch,
            lostItems,
            { intense: true },
          ),
        )
        this.ghostSystem.onGhostHitLandedAt(
          hit.ghostX,
          hit.ghostZ,
          this.playerPos,
        )

        if (!this.consumeRoomShield()) {
          this.lives = Math.max(0, this.lives - 1)
          spawnLifeLostImpact(this.gameViewport)
          this.triggerDepositScreenShake(true)
          this.syncLivesHud()
          if (this.lives <= 0) {
            this.commitRunPersonalBest()
            this.gameOver = true
            this.runFailedCleanup = showRunFailedOverlay(
              this.gameViewport,
              {
                roomsCleared: this.runStatRoomsCleared,
                wispsCollected: this.runStatWispsCollected,
                timeSec: this.elapsedSec,
                upgrades: this.runStatUpgradesPicked.map((u) => ({
                  title: u.title,
                })),
              },
              {
                onRetry: () => {
                  this.runFailedCleanup?.()
                  this.runFailedCleanup = null
                  if (this.onRunFailedRetry) {
                    void Promise.resolve(this.onRunFailedRetry()).catch(() => {
                      location.reload()
                    })
                  } else {
                    location.reload()
                  }
                },
              },
            )
          }
        }
      }
      updateGhostHitBursts(this.burstParticles, dt)

      this.syncPlayerCharacterVisual(dt)
      if (this.roomClearIntroCinematicRunning) {
        this.updateRoomClearIntroCinematic(dt)
      } else if (this.roomClearDoorCinematicRunning) {
        this.updateRoomClearDoorCinematic(dt)
      } else if (this.bossIntroCinematicRunning) {
        this.updateBossIntroCinematic(dt)
      } else {
        this.cameraRig.update(dt)
      }
      this.itemWorld.updateCollectEffects(dt)
      this.stackVisual.update(dt)
      this.specialRelicSpawns.update(dt)
      this.relicFootArrow.setTarget(
        this.playerPos,
        this.specialRelicSpawns.getActiveRelicXZ(),
      )

      if (this.bossVictoryOutroRemain !== null) {
        this.bossVictoryOutroRemain -= dt
        if (this.bossVictoryOutroRemain <= 0) {
          this.bossVictoryOutroRemain = null
          this.beginEndlessModeAfterBossVictory()
        }
      }

      const lagAuditNav = auditEnabled ? this.player.getNavDebugSnapshot() : null
      const lagAuditCpuMs = auditEnabled
        ? performance.now() - frameAuditStartMs
        : 0

      const renderStartMs = performance.now()
      this.renderer.render(scene, this.camera)
      const renderMs = performance.now() - renderStartMs

      maybeLogRenderSpikeDiagnostics(this.renderer, scene, {
        renderMs,
        area: this.roomSystem.getAreaAt(this.playerPos.x, this.playerPos.z),
        room: this.roomSystem.getRoomAt(this.playerPos.x, this.playerPos.z),
      })

      if (auditEnabled && lagAuditNav) {
        this.logRoomLagFrame({
          totalMs: lagAuditCpuMs,
          renderMs,
          trapFieldMs,
          playerMs,
          doorUnlockMs,
          itemWorldMs,
          collectionMs,
          ghostSystemMs,
          areaBefore: areaBeforeFrame,
          areaAfter: this.roomSystem.getAreaAt(this.playerPos.x, this.playerPos.z),
          roomBefore: roomBeforeFrame,
          roomAfter: this.roomSystem.getRoomAt(this.playerPos.x, this.playerPos.z),
          nav: lagAuditNav,
        })
      }
      this.perf.endFrame(this.renderer.info.render.calls, pickupsThisFrame)
    }

    this.raf = requestAnimationFrame(tick)
  }

  private triggerWispPickupJuice(
    pickupX: number,
    pickupZ: number,
    roomId: RoomId | null,
    remainingWispsInRoom: number | null,
  ): void {
    this.pickupComboCount =
      this.pickupComboRemain > 0 ? this.pickupComboCount + 1 : 1
    this.pickupComboRemain = 0.82

    const urgent = remainingWispsInRoom !== null && remainingWispsInRoom <= 3
    this.spawnFloorPulseAt(pickupX, pickupZ, {
      color: urgent ? 0xffc27a : 0x87ffd9,
      opacity: urgent ? 0.24 : 0.18,
      startScale: 0.28,
      endScale: urgent ? 1.2 : 0.92,
      lifeSec: urgent ? 0.28 : 0.22,
    })

    if (this.pickupComboCount <= 1) {
      spawnFloatingHudText(this.gameViewport, '+1', 'float-hud--pickup', {
        durationSec: 0.55,
        risePx: 18,
      })
    } else {
      spawnFloatingHudText(
        this.gameViewport,
        `x${this.pickupComboCount} SWEEP`,
        'float-hud--combo',
        { topPct: 34, leftPct: 50, durationSec: 0.7, risePx: 26 },
      )
    }

    if (roomId && remainingWispsInRoom !== null && remainingWispsInRoom > 0 && remainingWispsInRoom <= 3) {
      const urgencyKey =
        roomId === FINAL_NORMAL_ROOM_ID && this.endlessModeActive
          ? `${roomId}:${this.endlessCurrentRoomNumber}:${remainingWispsInRoom}`
          : `${roomId}:${remainingWispsInRoom}`
      if (!this.roomUrgencyShown.has(urgencyKey)) {
        this.roomUrgencyShown.add(urgencyKey)
        this.pulseRoomCleanHudUrgency()
        spawnFloatingHudText(
          this.gameViewport,
          remainingWispsInRoom === 1 ? 'LAST WISP' : 'FINAL WISPS',
          'float-hud--urgency',
          { topPct: 18, leftPct: 50, durationSec: 0.85, risePx: 22 },
        )
      }
    }
  }

  private activatePowerMode(pickupX?: number, pickupZ?: number): void {
    this.powerModeRemain =
      POWER_MODE_DURATION_MIN_SEC +
      this.runRandom() *
        (POWER_MODE_DURATION_MAX_SEC - POWER_MODE_DURATION_MIN_SEC)
    this.powerPickupSlowMoRemain = 0.12
    this.powerBurstTrailRemain = 0.95
    this.gameViewport.classList.add('game-viewport--power-mode')
    this.pulseViewportClass('game-viewport--power-burst', 420)
    if (pickupX !== undefined && pickupZ !== undefined) {
      this.spawnFloorPulseAt(pickupX, pickupZ, {
        color: 0x7ceeff,
        opacity: 0.26,
        startScale: 0.36,
        endScale: 1.85,
        lifeSec: 0.42,
      })
    }
    spawnFloatingHudText(
      this.gameViewport,
      'POWER MODE!',
      'float-hud--level-up',
      { topPct: 22, leftPct: 50, durationSec: 1.15, risePx: 24 },
    )
  }

  private updateGameStartCountdown(dt: number): void {
    this.gameStartCountdownRemain = Math.max(
      0,
      this.gameStartCountdownRemain - dt,
    )
    this.syncGameStartCountdown()
  }

  private syncGameStartCountdown(): void {
    const el = this.gameStartCountdownEl
    const step =
      this.gameStartCountdownRemain > 0
        ? Math.max(1, Math.ceil(this.gameStartCountdownRemain))
        : 0
    if (step <= 0) {
      el.classList.remove('game-start-countdown--show')
      el.classList.add('game-start-countdown--out')
      el.dataset.label = ''
      el.textContent = ''
      return
    }
    if (step !== this.gameStartCountdownStep) {
      this.gameStartCountdownStep = step
      el.dataset.label = step > 1 ? 'Starting in' : 'Get ready'
      el.setAttribute('aria-label', `${el.dataset.label} ${step}`)
      el.textContent = String(step)
      el.classList.remove('game-start-countdown--tick', 'game-start-countdown--out')
      el.classList.add('game-start-countdown--show')
      void el.offsetWidth
      el.classList.add('game-start-countdown--tick')
    }
  }

  private updateDeepestRoomReached(roomId: RoomId | null): void {
    if (!roomId || roomId === 'SAFE_CENTER' || !roomId.startsWith('ROOM_')) return
    const roomNumber =
      this.endlessModeActive && roomId === FINAL_NORMAL_ROOM_ID
        ? this.endlessCurrentRoomNumber
        : Number(roomId.slice(5))
    if (Number.isFinite(roomNumber)) {
      this.runStatDeepestRoomReached = Math.max(
        this.runStatDeepestRoomReached,
        roomNumber,
      )
    }
  }

  private updateBossReachStat(roomId: RoomId | null): void {
    if (
      roomId === FINAL_NORMAL_ROOM_ID &&
      this.runStatBossReachedAtSec === null
    ) {
      this.runStatBossReachedAtSec = this.elapsedSec
    }
  }

  private refreshRoomShield(roomId: RoomId | null): void {
    if (!this.runUpgrades.roomShieldTaken) return
    if (!roomId || roomId === 'SAFE_CENTER' || !roomId.startsWith('ROOM_')) return
    if (this.shieldRefreshRoomId === roomId) return
    this.shieldRefreshRoomId = roomId
    this.roomShieldAvailable = true
    spawnFloatingHudText(
      this.gameViewport,
      'Shield ready',
      'float-hud--pickup',
      { topPct: 24, leftPct: 50, durationSec: 0.9 },
    )
  }

  private consumeRoomShield(label = 'Shielded!'): boolean {
    if (!this.roomShieldAvailable) return false
    this.roomShieldAvailable = false
    this.triggerEctoGlow(180)
    spawnFloatingHudText(this.gameViewport, label, 'float-hud--level-up', {
      topPct: 26,
      leftPct: 50,
      durationSec: 1.05,
    })
    return true
  }

  private syncSafeRoomPersonalBestHud(): void {
    if (!this.hudSafePbSummaryEl) return
    const roomText = formatPersonalBestRoom(this.personalBest.bestRoomReached)
    const timeText =
      this.personalBest.bestTimeSec > 0
        ? formatPersonalBestTime(this.personalBest.bestTimeSec)
        : null
    this.hudSafePbSummaryEl.textContent =
      roomText === 'None yet'
        ? roomText
        : timeText
          ? `${roomText} • ${timeText}`
          : roomText
    this.hudSafePbActionsEl?.setAttribute(
      'data-boss-ready',
      this.personalBest.bestBossReachTimeSec === null ? 'false' : 'true',
    )
  }

  private commitRunPersonalBest(): void {
    const bestBossReachTimeSec =
      this.runStatBossReachedAtSec === null
        ? this.personalBest.bestBossReachTimeSec
        : this.personalBest.bestBossReachTimeSec === null
          ? this.runStatBossReachedAtSec
          : Math.min(
              this.personalBest.bestBossReachTimeSec,
              this.runStatBossReachedAtSec,
            )
    const bestTimeSec =
      bestBossReachTimeSec === null
        ? this.personalBest.bestTimeSec
        : this.personalBest.bestTimeSec > 0
          ? Math.min(this.personalBest.bestTimeSec, bestBossReachTimeSec)
          : bestBossReachTimeSec
    const next: PersonalBestSnapshot = {
      bestRoomReached: Math.max(
        this.personalBest.bestRoomReached,
        this.runStatDeepestRoomReached,
      ),
      bestTimeSec,
      bestBossReachTimeSec,
    }
    if (
      next.bestRoomReached === this.personalBest.bestRoomReached &&
      next.bestTimeSec === this.personalBest.bestTimeSec &&
      next.bestBossReachTimeSec === this.personalBest.bestBossReachTimeSec
    ) {
      return
    }
    this.personalBest = next
    savePersonalBest(next)
    this.syncSafeRoomPersonalBestHud()
  }

  private openLeaderboard(): void {
    this.closeLeaderboard()
    const overlay = document.createElement('div')
    overlay.className = 'leaderboard-overlay leaderboard-overlay--show'

    const backdrop = document.createElement('div')
    backdrop.className = 'leaderboard-overlay__backdrop'
    backdrop.addEventListener('click', () => this.closeLeaderboard())

    const panel = document.createElement('div')
    panel.className = 'leaderboard-overlay__panel'

    const title = document.createElement('h2')
    title.className = 'leaderboard-overlay__title'
    title.textContent = 'Leaderboards'

    const sub = document.createElement('p')
    sub.className = 'leaderboard-overlay__sub'
    sub.textContent = 'Track your best boss rush and deepest run in one place.'

    const sections = document.createElement('div')
    sections.className = 'leaderboard-overlay__sections'
    sections.append(
      this.createLeaderboardSection(
        'Boss Rush Board',
        'Fastest runs to reach the boss room.',
        'boss',
      ),
      this.createLeaderboardSection(
        'Deep Run Board',
        'Best runs by deepest room reached.',
        'depth',
      ),
    )

    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'leaderboard-overlay__close'
    close.textContent = 'Close'
    close.addEventListener('click', () => this.closeLeaderboard())

    panel.append(title, sub, sections, close)
    overlay.append(backdrop, panel)
    this.gameViewport.appendChild(overlay)
    this.leaderboardOverlayEl = overlay
  }

  private createLeaderboardSection(
    titleText: string,
    subText: string,
    kind: 'boss' | 'depth',
  ): HTMLElement {
    const section = document.createElement('section')
    section.className = 'leaderboard-overlay__section'

    const title = document.createElement('h3')
    title.className = 'leaderboard-overlay__section-title'
    title.textContent = titleText

    const sub = document.createElement('p')
    sub.className = 'leaderboard-overlay__section-sub'
    sub.textContent = subText

    const list = document.createElement('div')
    list.className = 'leaderboard-overlay__list'
    for (const row of this.buildLeaderboardRows(kind)) {
      const item = document.createElement('div')
      item.className = 'leaderboard-overlay__row'
      if (row.highlight) item.classList.add('leaderboard-overlay__row--you')

      const rank = document.createElement('span')
      rank.className = 'leaderboard-overlay__rank'
      rank.textContent = String(row.rank)

      const name = document.createElement('span')
      name.className = 'leaderboard-overlay__name'
      name.textContent = row.name

      const value = document.createElement('span')
      value.className = 'leaderboard-overlay__value'
      value.textContent = row.value

      item.append(rank, name, value)
      list.appendChild(item)
    }

    section.append(title, sub, list)
    return section
  }

  private closeLeaderboard(): void {
    this.leaderboardOverlayEl?.remove()
    this.leaderboardOverlayEl = null
  }

  private buildLeaderboardRows(
    kind: 'boss' | 'depth',
  ): { rank: number; name: string; value: string; highlight?: boolean }[] {
    if (kind === 'boss') {
      const rows = [
        { name: 'Mara', timeSec: 231 },
        { name: 'Noel', timeSec: 244 },
        { name: 'Aya', timeSec: 256 },
        { name: 'Vex', timeSec: 271 },
        { name: 'Ciro', timeSec: 286 },
        { name: 'June', timeSec: 298 },
      ]
      if (this.personalBest.bestBossReachTimeSec !== null) {
        rows.push({
          name: 'You',
          timeSec: this.personalBest.bestBossReachTimeSec,
        })
      }
      rows.sort((a, b) => a.timeSec - b.timeSec)
      return rows.slice(0, 8).map((row, i) => ({
        rank: i + 1,
        name: row.name,
        value: formatPersonalBestTime(row.timeSec),
        highlight: row.name === 'You',
      }))
    }

    const rows = [
      { name: 'Mara', room: 10, timeSec: 634 },
      { name: 'Ciro', room: 9, timeSec: 522 },
      { name: 'Noel', room: 9, timeSec: 491 },
      { name: 'Aya', room: 8, timeSec: 446 },
      { name: 'June', room: 8, timeSec: 418 },
      { name: 'Vex', room: 7, timeSec: 352 },
    ]
    if (this.personalBest.bestRoomReached > 0 || this.personalBest.bestTimeSec > 0) {
      rows.push({
        name: 'You',
        room: this.personalBest.bestRoomReached,
        timeSec: this.personalBest.bestTimeSec,
      })
    }
    rows.sort((a, b) => {
      if (b.room !== a.room) return b.room - a.room
      if (a.timeSec <= 0 && b.timeSec <= 0) return 0
      if (a.timeSec <= 0) return 1
      if (b.timeSec <= 0) return -1
      return a.timeSec - b.timeSec
    })
    return rows.slice(0, 8).map((row, i) => ({
      rank: i + 1,
      name: row.name,
      value: `${formatPersonalBestRoom(row.room)} · ${formatPersonalBestTime(row.timeSec)}`,
      highlight: row.name === 'You',
    }))
  }

  private pulseViewportClass(className: string, durationMs: number): void {
    const prev = this.viewportClassTimers.get(className)
    if (prev) {
      clearTimeout(prev)
      this.viewportClassTimers.delete(className)
    }
    this.gameViewport.classList.remove(className)
    requestAnimationFrame(() => {
      this.gameViewport.classList.add(className)
    })
    const timer = setTimeout(() => {
      this.gameViewport.classList.remove(className)
      this.viewportClassTimers.delete(className)
    }, durationMs)
    this.viewportClassTimers.set(className, timer)
  }

  private pulseRoomCleanHudUrgency(): void {
    if (!this.hudRoomCleanWrap) return
    if (this.roomHudUrgencyTimer) {
      clearTimeout(this.roomHudUrgencyTimer)
      this.roomHudUrgencyTimer = null
    }
    this.hudRoomCleanWrap.classList.remove('hud-room-clean--urgent')
    requestAnimationFrame(() => {
      this.hudRoomCleanWrap?.classList.add('hud-room-clean--urgent')
    })
    this.roomHudUrgencyTimer = setTimeout(() => {
      this.hudRoomCleanWrap?.classList.remove('hud-room-clean--urgent')
      this.roomHudUrgencyTimer = null
    }, 760)
  }

  private spawnFloorPulseAt(
    x: number,
    z: number,
    opts?: {
      color?: number
      opacity?: number
      startScale?: number
      endScale?: number
      lifeSec?: number
    },
  ): void {
    this.burstSpawnScratch.set(x, 0.04, z)
    this.burstParticles.push(
      ...spawnFloorRingBurst(this.burstGroup, this.burstSpawnScratch, {
        color: opts?.color,
        opacity: opts?.opacity,
        startScale: opts?.startScale,
        endScale: opts?.endScale,
        y: 0.04,
        lifeSec: opts?.lifeSec,
      }),
    )
  }

  private triggerRoomEntryJuice(roomIndex: number, doorIndex?: number): void {
    const endless = roomIndex > NORMAL_ROOM_COUNT
    this.roomEntrySlowMoRemain = endless ? 0.09 : 0.12
    this.roomEntryTrailRemain = endless ? 0.5 : 0.72
    const titleText = `Room ${roomIndex}`
    const subtitleText = endless
      ? 'The mansion shifts again'
      : roomIndex === NORMAL_ROOM_COUNT
        ? 'One more room. Stay alive.'
        : roomIndex === 2
          ? 'Stay out of their cone'
          : 'Sweep fast, stay moving'
    const emphasis: 'normal' | 'endless' | 'boss' = endless
      ? 'endless'
      : roomIndex === NORMAL_ROOM_COUNT
        ? 'boss'
        : 'normal'
    /** Defer DOM + extra particles to the next frame so the door-crossing sim frame stays lighter. */
    requestAnimationFrame(() => {
      spawnRoomEntryBanner(this.gameViewport, titleText, subtitleText, {
        fast: true,
        emphasis,
      })
      this.triggerEctoGlow(240)
      this.pulseViewportClass('game-viewport--pulse-room-entry', 280)
      if (doorIndex !== undefined) {
        const zDoor = getDoorBlockerZ(doorIndex)
        this.burstSpawnScratch.set(0, 0.04, zDoor - 0.35)
        this.burstParticles.push(
          ...spawnDirectionalFloorPulse(this.burstGroup, this.burstSpawnScratch, 0, -1, {
            color: endless ? 0x77d8ff : 0x74ffd5,
            opacity: 0.22,
            spacing: 1.05,
            count: 3,
            lifeSec: 0.28,
          }),
        )
      }
    })
  }

  private triggerGhostAggroJuice(
    coneAggroTriggers: number,
    positions: readonly { x: number; z: number }[],
  ): void {
    this.triggerEctoGlow(220)
    this.pulseViewportClass('game-viewport--pulse-danger', 220)
    const label = coneAggroTriggers > 1 ? 'SPOTTED' : 'SEEN'
    spawnFloatingHudText(this.gameViewport, label, 'float-hud--alert', {
      topPct: 22,
      leftPct: 50,
      durationSec: 0.72,
      risePx: 24,
    })
    for (const pos of positions.slice(0, 3)) {
      this.spawnFloorPulseAt(pos.x, pos.z, {
        color: 0x86ffe1,
        opacity: 0.24,
        startScale: 0.34,
        endScale: 1.18,
        lifeSec: 0.26,
      })
    }
  }

  private triggerGhostLostJuice(
    positions: readonly { x: number; z: number }[],
  ): void {
    for (const pos of positions.slice(0, 2)) {
      this.spawnFloorPulseAt(pos.x, pos.z, {
        color: 0xc7f5ff,
        opacity: 0.16,
        startScale: 0.28,
        endScale: 0.92,
        lifeSec: 0.24,
      })
    }
    spawnFloatingHudText(this.gameViewport, '?', 'float-hud--question', {
      topPct: 26,
      leftPct: 50,
      durationSec: 0.5,
      risePx: 16,
    })
  }

  private triggerEnemySpawnJuice(count: number): void {
    const n = Math.max(1, Math.floor(count))
    this.triggerEctoGlow(220)
    spawnFloatingHudText(
      this.gameViewport,
      n > 1 ? `${n} ENEMIES` : 'ENEMY SPAWNED',
      'float-hud--spawn',
      {
        topPct: 18,
        leftPct: 50,
        durationSec: 0.9,
        risePx: 22,
      },
    )
  }

  private triggerDoorImpactJuice(doorIndex: number): void {
    const zDoor = getDoorBlockerZ(doorIndex)
    this.burstSpawnScratch.set(0, 0.04, zDoor - 0.18)
    this.burstParticles.push(
      ...spawnFloorRingBurst(this.burstGroup, this.burstSpawnScratch, {
        color: 0xffe59a,
        opacity: 0.22,
        startScale: 0.42,
        endScale: 1.65,
        y: 0.04,
        lifeSec: 0.26,
      }),
      ...spawnDirectionalFloorPulse(this.burstGroup, this.burstSpawnScratch, 0, -1, {
        color: 0x78ffd9,
        opacity: 0.16,
        spacing: 0.92,
        count: 2,
        lifeSec: 0.2,
      }),
    )
    this.triggerEctoGlow(140)
    this.pulseViewportClass('game-viewport--pulse-door', 220)
  }

  private triggerEctoGlow(durationMs: number): void {
    if (this.ectoGlowTimer) {
      clearTimeout(this.ectoGlowTimer)
      this.ectoGlowTimer = null
    }
    this.gameViewport.classList.add('game-viewport--glow-ecto')
    this.ectoGlowTimer = setTimeout(() => {
      this.gameViewport.classList.remove('game-viewport--glow-ecto')
      this.ectoGlowTimer = null
    }, durationMs)
  }

  private applyEquippedTrailStyle(): void {
    this.playerTrail.setStyle(this.progressPresentState.equippedTrailStyle)
  }

  private saveProgressPresents(): void {
    saveProgressPresentState(this.progressPresentState)
  }

  private updatePresentTrack(
    outcome: ProgressPresentOutcome,
    opts?: { rewardReadyLabel?: boolean },
  ): void {
    if (this.presentTrackTimer) {
      clearTimeout(this.presentTrackTimer)
      this.presentTrackTimer = null
    }
    const rewardReady =
      opts?.rewardReadyLabel || outcome.grantedRewardIds.length > 0
    const fillPct = Math.max(0, Math.min(100, outcome.fillRatio * 100))
    this.presentTrackFillEl.style.transform = `scaleX(${fillPct / 100})`
    if (outcome.allRewardsClaimed) {
      this.presentTrackLabelEl.textContent = 'All present trails claimed'
      this.presentTrackSubEl.textContent = 'Every trail box is already open.'
    } else if (rewardReady) {
      this.presentTrackLabelEl.textContent = 'Present ready'
      this.presentTrackSubEl.textContent = 'A new trail crate is waiting. Open it after the clear.'
    } else {
      const rooms = Math.max(1, outcome.roomsUntilNextPresent)
      this.presentTrackLabelEl.textContent = `Present in ${rooms} room${rooms === 1 ? '' : 's'}`
      this.presentTrackSubEl.textContent =
        outcome.source === 'boss'
          ? 'Boss clear filled the whole reward bar.'
          : `${outcome.progress}/${outcome.threshold} room clears on the bar`
    }
    this.presentTrackEl.classList.remove('hidden')
    this.presentTrackEl.classList.add('present-track--show')
    this.presentTrackEl.setAttribute('aria-hidden', 'false')
    if (rewardReady) {
      this.presentTrackEl.classList.add('present-track--ready')
    } else {
      this.presentTrackEl.classList.remove('present-track--ready')
    }
    this.presentTrackTimer = setTimeout(() => {
      this.presentTrackEl.classList.remove(
        'present-track--show',
        'present-track--ready',
      )
      this.presentTrackEl.classList.add('hidden')
      this.presentTrackEl.setAttribute('aria-hidden', 'true')
      this.presentTrackTimer = null
    }, rewardReady ? 4400 : 2800)
  }

  private stageRoomClearPresentProgress(
    source: 'normal' | 'boss',
    roomNumber?: number,
  ): ProgressPresentOutcome {
    const outcome = recordPresentProgress(
      this.progressPresentState,
      source,
      roomNumber,
    )
    this.saveProgressPresents()
    this.updatePresentTrack(outcome)
    return outcome
  }

  private maybeStartPresentOverlay(continueFn: () => void): boolean {
    const nextRewardId = this.progressPresentState.pendingRewardIds[0]
    if (!nextRewardId) return false
    const reward = rewardDefById(nextRewardId)
    if (!reward) {
      this.progressPresentState.pendingRewardIds.shift()
      this.saveProgressPresents()
      return this.maybeStartPresentOverlay(continueFn)
    }

    this.presentOverlayPaused = true
    this.presentOverlayContinue = continueFn
    this.presentOverlayPendingRewardId = reward.id
    this.presentOverlayPhase = 'ready'
    this.presentOverlayEyebrowEl.textContent = 'Progress reward'
    this.presentOverlayTitleEl.textContent = 'You got a present'
    this.presentOverlaySubEl.textContent =
      'Open it to reveal your next trail. It will equip right away.'
    this.presentOverlayRewardEl.innerHTML =
      '<div class="present-overlay__reward-box"></div><div class="present-overlay__reward-label">Trail crate ready</div>'
    this.presentOverlayActionBtn.textContent = 'Open present'
    this.presentOverlayEl.classList.remove('hidden')
    this.presentOverlayEl.setAttribute('aria-hidden', 'false')
    requestAnimationFrame(() => {
      this.presentOverlayEl.classList.add('present-overlay--show')
    })
    return true
  }

  private openPendingPresentReward(): void {
    const rewardId = this.presentOverlayPendingRewardId
    if (!rewardId) return
    const reward = rewardDefById(rewardId)
    if (!reward) {
      this.finishPresentOverlayFlow()
      return
    }

    this.progressPresentState.pendingRewardIds = this.progressPresentState.pendingRewardIds.filter(
      (id) => id !== rewardId,
    )
    if (!this.progressPresentState.unlockedRewardIds.includes(rewardId)) {
      this.progressPresentState.unlockedRewardIds.push(rewardId)
    }
    this.progressPresentState.equippedTrailStyle = reward.trailStyle
    this.saveProgressPresents()
    this.applyEquippedTrailStyle()

    this.presentOverlayPhase = 'opened'
    this.presentOverlayEyebrowEl.textContent = 'Trail unlocked'
    this.presentOverlayTitleEl.textContent = reward.title
    this.presentOverlaySubEl.textContent = reward.description
    this.presentOverlayRewardEl.innerHTML =
      `<div class="present-overlay__reward-box present-overlay__reward-box--open"></div><div class="present-overlay__reward-label">${reward.title} equipped</div>`
    this.presentOverlayActionBtn.textContent = 'Continue'
    this.triggerEctoGlow(260)
    this.pulseViewportClass('game-viewport--pulse-room-clear', 260)
    spawnFloatingHudText(
      this.gameViewport,
      `${reward.title} UNLOCKED`,
      'float-hud--level-up',
      { topPct: 24, leftPct: 50, durationSec: 1.4, risePx: 20 },
    )
  }

  private finishPresentOverlayFlow(): void {
    this.presentOverlayPhase = 'closed'
    this.presentOverlayPendingRewardId = null
    this.presentOverlayEl.classList.remove('present-overlay--show')
    this.presentOverlayEl.classList.add('hidden')
    this.presentOverlayEl.setAttribute('aria-hidden', 'true')
    this.presentOverlayPaused = false
    const continueFn = this.presentOverlayContinue
    this.presentOverlayContinue = null
    if (this.progressPresentState.pendingRewardIds.length > 0 && continueFn) {
      this.maybeStartPresentOverlay(continueFn)
      return
    }
    continueFn?.()
  }

  private isRoomLagAuditEnabled(): boolean {
    const w = window as RoomLagAuditWindow
    return w.__roomLagAudit === true
  }

  private getRoomLagAuditThresholdMs(): number {
    const w = window as RoomLagAuditWindow
    return Math.max(8, w.__roomLagAuditMinFrameMs ?? 12)
  }

  private logRoomLagStaticSnapshotOnce(): void {
    if (this.roomLagAuditStaticLogged) return
    this.roomLagAuditStaticLogged = true
    const ghostPlans = partitionGhostSpawnsByRoom()
    const describeRoom = (roomIndex: number) => {
      const roomId = `ROOM_${roomIndex}` as NormalRoomId
      const plan = this.roomGridPlans.get(roomId)
      return {
        roomId,
        wisps: plan?.wisps.length ?? 0,
        traps: plan?.traps.length ?? 0,
        walls: plan?.walls.length ?? 0,
        southEdgeWalls:
          plan?.walls.filter((wall) => wall.row >= ROOM_GRID_ROWS - 2).length ?? 0,
        southEdgeTraps:
          plan?.traps.filter((trap) => trap.row >= ROOM_GRID_ROWS - 2).length ?? 0,
        plannedGhosts: ghostPlans[roomIndex - 1]?.length ?? 0,
      }
    }
    console.info('[room lag audit] static room comparison', {
      room1: describeRoom(1),
      room2: describeRoom(2),
    })
  }

  private flushPendingDoorPassageEvents(): void {
    if (this.pendingDoorPassageEvents.length <= 0) return
    while (this.pendingDoorPassageEvents.length > 0) {
      const event = this.pendingDoorPassageEvents.shift()
      if (!event) break
      this.triggerRoomEntryJuice(event.roomIndex, event.doorIndex)
      const spawned = this.ghostSystem.spawnGhostsForRoom(event.roomIndex)
      if (spawned > 0) {
        this.triggerEnemySpawnJuice(spawned)
      }
    }
  }

  private logRoomLagFrame(frame: RoomLagAuditFrame): void {
    const thresholdMs = this.getRoomLagAuditThresholdMs()
    const nav = frame.nav
    const lastAuditArea = this.lastLagAuditArea
    const areaChanged = frame.areaBefore !== frame.areaAfter
    const navKeyChanged = this.lastLagAuditNavBoundsKey !== nav.navBoundsKey
    const transitionIntoTrackedRoom =
      frame.areaBefore === 'CORRIDOR' &&
      (frame.areaAfter === 'ROOM_1' || frame.areaAfter === 'ROOM_2')
    const correctionSpike =
      nav.collisionCorrectionTriggered || nav.collisionCorrectionDist >= 0.08
    const frameSpike =
      frame.totalMs >= thresholdMs || frame.renderMs >= thresholdMs
    const hardTransitionReset = nav.hadResetThisStep && areaChanged
    const shouldLog =
      transitionIntoTrackedRoom ||
      frameSpike ||
      correctionSpike ||
      hardTransitionReset

    this.lastLagAuditArea = frame.areaAfter
    this.lastLagAuditNavBoundsKey = nav.navBoundsKey
    if (!shouldLog) return

    console.info('[room lag audit] frame', {
      cpuBeforeRenderMs: Number(frame.totalMs.toFixed(2)),
      renderMs: Number(frame.renderMs.toFixed(2)),
      trapFieldMs: Number(frame.trapFieldMs.toFixed(2)),
      playerMs: Number(frame.playerMs.toFixed(2)),
      doorUnlockMs: Number(frame.doorUnlockMs.toFixed(2)),
      itemWorldMs: Number(frame.itemWorldMs.toFixed(2)),
      collectionMs: Number(frame.collectionMs.toFixed(2)),
      ghostSystemMs: Number(frame.ghostSystemMs.toFixed(2)),
      areaBefore: frame.areaBefore,
      areaAfter: frame.areaAfter,
      lastAuditArea,
      roomBefore: frame.roomBefore,
      roomAfter: frame.roomAfter,
      areaChanged,
      navKeyChanged,
      transitionIntoTrackedRoom,
      correctionSpike,
      attempted: [nav.attemptedDr, nav.attemptedDc],
      input: [nav.inputDr, nav.inputDc],
      reject: nav.segmentRejectReason,
      correctionDist: Number(nav.collisionCorrectionDist.toFixed(3)),
      navBoundsKind: nav.navBoundsKind,
      rawBoundsKind: nav.rawBoundsKind,
      navBoundsKey: nav.navBoundsKey,
      rawBoundsKey: nav.rawKeyAtPlayer,
      hadResetThisStep: nav.hadResetThisStep,
      idleBlocked: nav.idleBlocked,
      openCardinals: nav.openCardinals,
    })
  }

  private syncPlayerCharacterVisual(dt: number): void {
    this.player.getVelocity(this.velScratch)
    this.playerCharacter.update(dt, {
      timeSec: this.elapsedSec,
      speed: this.player.getHorizontalSpeed(),
      velX: this.velScratch.x,
      itemsCarried: this.stack.count,
      powerMode: this.powerModeRemain > 0,
      ghostInvuln: this.ghostHitInvuln > 0,
      recentPickupSec: 0,
    })
  }

  /**
   * Off-screen + full-frame GPU warm-up. Call from bootstrap while the loading screen is visible.
   * Uses `WebGLRenderer.compileAsync` so shader programs finish before gameplay (tiny RT passes
   * alone miss real framebuffer + shadow-map paths).
   */
  async warmGpuForRoomTransitions(): Promise<void> {
    const compileCamera = this.camera.clone()
    const compilePos = new Vector3()
    const compileLookAt = new Vector3()
    const prewarmTarget = new WebGLRenderTarget(32, 32)
    const previousTarget = this.renderer.getRenderTarget()
    const previousShadowAutoUpdate = this.renderer.shadowMap.autoUpdate

    const compileView = (
      x: number,
      y: number,
      z: number,
      lookX: number,
      lookY: number,
      lookZ: number,
    ): void => {
      compilePos.set(x, y, z)
      compileLookAt.set(lookX, lookY, lookZ)
      compileCamera.position.copy(compilePos)
      compileCamera.lookAt(compileLookAt)
      compileCamera.updateProjectionMatrix()
      compileCamera.updateMatrixWorld(true)
      this.renderer.setRenderTarget(prewarmTarget)
      this.renderer.render(this.scene, compileCamera)
    }

    const applyGameplayTopDown = (cam: PerspectiveCamera, px: number, pz: number): void => {
      const eyeY = 0.02
      cam.position.set(
        px + CAMERA_OFFSET_BASE.x,
        eyeY + CAMERA_OFFSET_BASE.y,
        pz + CAMERA_OFFSET_BASE.z,
      )
      cam.lookAt(px, eyeY, pz)
      cam.updateProjectionMatrix()
      cam.updateMatrixWorld(true)
    }

    const roomIds: RoomId[] = [
      'SAFE_CENTER',
      ...Array.from(
        { length: NORMAL_ROOM_COUNT },
        (_, index) => `ROOM_${index + 1}` as NormalRoomId,
      ),
    ]

    try {
      this.renderer.shadowMap.autoUpdate = true
      await this.roomLockCovers.withAllCoversHiddenAsync(async () => {
        await this.itemWorld.withAllRoomContentVisibleAsync(async () => {
          await this.ghostSystem.withAllGhostsVisibleAsync(async () => {
            this.scene.updateMatrixWorld(true)
            this.camera.updateMatrixWorld(true)
            this.renderer.setRenderTarget(prewarmTarget)
            this.renderer.render(this.scene, this.camera)

            for (const roomId of roomIds) {
              const bounds = this.roomSystem.getBounds(roomId)
              const centerX = (bounds.minX + bounds.maxX) * 0.5
              const centerZ = (bounds.minZ + bounds.maxZ) * 0.5
              const roomDepth = Math.max(1, bounds.maxZ - bounds.minZ)
              compileView(
                centerX,
                11.5,
                centerZ + roomDepth * 0.08,
                centerX,
                0.9,
                centerZ,
              )
            }

            for (let doorIndex = 0; doorIndex < NORMAL_ROOM_COUNT; doorIndex++) {
              const zDoor = getDoorBlockerZ(doorIndex)
              compileView(0, 8.1, zDoor + 6.1, 0, 1, zDoor - 2.1)
              compileView(0, 8.1, zDoor - 6.1, 0, 1, zDoor + 2.1)
            }

            const b1 = this.roomSystem.getBounds('ROOM_1')
            const r1cx = (b1.minX + b1.maxX) * 0.5
            const r1cz = (b1.minZ + b1.maxZ) * 0.5
            const gameplayTopDown = (px: number, pz: number): void => {
              compileView(
                px + CAMERA_OFFSET_BASE.x,
                0.02 + CAMERA_OFFSET_BASE.y,
                pz + CAMERA_OFFSET_BASE.z,
                px,
                0.02,
                pz,
              )
            }
            gameplayTopDown(0, -5.2)
            gameplayTopDown(0, -8.95)
            gameplayTopDown(0, b1.maxZ - 1.1)
            gameplayTopDown(r1cx, r1cz)

            /** Full-size draws + async compile — warms tone mapping, shadows, and shader completion. */
            this.renderer.setRenderTarget(null)
            applyGameplayTopDown(compileCamera, r1cx, r1cz)
            try {
              await this.renderer.compileAsync(this.scene, compileCamera)
            } catch (e) {
              console.warn('[gpu warm] compileAsync failed (continuing with renders)', e)
            }

            const poses: [number, number][] = [
              [0, -5.2],
              [0, -8.95],
              [0, b1.maxZ - 1.1],
              [r1cx, r1cz],
            ]
            for (const [px, pz] of poses) {
              applyGameplayTopDown(compileCamera, px, pz)
              this.renderer.render(this.scene, compileCamera)
              this.renderer.render(this.scene, compileCamera)
            }

            this.cameraRig.update(0)
            this.camera.updateMatrixWorld(true)
            this.renderer.render(this.scene, this.camera)
            this.renderer.render(this.scene, this.camera)
          })
        })
      })
    } finally {
      this.renderer.setRenderTarget(previousTarget)
      this.renderer.shadowMap.autoUpdate = previousShadowAutoUpdate
      prewarmTarget.dispose()
    }

    /**
     * The hidden-cover warm path never draws room blackout shells (large transparent meshes).
     * That blend path + full framebuffer present can stall the first time without this pass.
     */
    this.renderer.setRenderTarget(null)
    this.roomLockCovers.update()
    this.cameraRig.update(0)
    this.syncPlayerCharacterVisual(0)
    this.scene.updateMatrixWorld(true)
    this.camera.updateMatrixWorld(true)
    try {
      await this.renderer.compileAsync(this.scene, this.camera)
    } catch (e) {
      console.warn('[gpu warm] compileAsync (blackout covers on) failed', e)
    }
    this.renderer.render(this.scene, this.camera)
    this.renderer.render(this.scene, this.camera)
  }

  /**
   * Spread full-resolution `render` calls across animation frames while the loading overlay is up,
   * so driver/shader work is less likely to land on the first Corridor→Room1 frame.
   */
  async primePresentPipelinesBeforeGameplay(frameCount: number): Promise<void> {
    const dt = 1 / 60
    const n = Math.max(1, Math.floor(frameCount))
    for (let i = 0; i < n; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      this.roomLockCovers.update()
      this.cameraRig.update(dt)
      this.syncPlayerCharacterVisual(dt)
      this.scene.updateMatrixWorld(true)
      this.renderer.render(this.scene, this.camera)
    }
  }

  private clearEndlessRoomContent(): void {
    for (const id of this.endlessCurrentWispIds) {
      this.itemWorld.remove(id)
    }
    this.endlessCurrentWispIds.length = 0
    if (this.endlessCurrentPowerPelletId) {
      this.itemWorld.remove(this.endlessCurrentPowerPelletId)
      this.endlessCurrentPowerPelletId = null
    }
    this.itemWorld.remove(`power_pellet_${FINAL_NORMAL_ROOM_ID}`)
    this.trapField.setPlacements(this.baseTrapPlacements)
    this.mazeWalls.setPlacements(this.baseMazeWallPlacements)
    this.worldCollision.setStructureColliders(this.mazeWalls.getColliders())
    this.endlessRoomWispTotal = 0
    this.endlessRoomWispsCollected = 0
    this.endlessRoomCleared = false
  }

  private spawnEndlessRoom(roomNumber: number): void {
    const bounds = this.roomSystem.getBounds(FINAL_NORMAL_ROOM_ID)
    const runtimePlan = planRuntimeRoomGrid(
      bounds,
      `endless_${roomNumber}`,
      this.runRandom,
    )
    this.clearEndlessRoomContent()
    if (!runtimePlan) return

    const plan: RoomGridPlan = {
      roomId: FINAL_NORMAL_ROOM_ID,
      ...runtimePlan,
    }
    for (const key of Array.from(this.roomUrgencyShown)) {
      if (key.startsWith(`${FINAL_NORMAL_ROOM_ID}:`)) {
        this.roomUrgencyShown.delete(key)
      }
    }
    this.endlessCurrentRoomNumber = roomNumber
    this.endlessRoomWispTotal = plan.wisps.length
    this.endlessRoomWispsCollected = 0
    this.endlessRoomCleared = false

    for (const wisp of plan.wisps) {
      this.endlessCurrentWispIds.push(wisp.id)
      this.itemWorld.spawn(
        createWispItem(
          0.48 + this.runRandom() * 0.1,
          4 + Math.floor(this.runRandom() * 8),
          wisp.id,
          FINAL_NORMAL_ROOM_ID,
        ),
        wisp.x,
        wisp.z,
        { visible: true },
      )
    }

    const pelletCell = pickRiskyPowerPelletCell(plan, this.runRandom)
    if (pelletCell) {
      const pelletId = `power_pellet_endless_${roomNumber}_${pelletCell.row}_${pelletCell.col}`
      this.endlessCurrentPowerPelletId = pelletId
      this.itemWorld.spawn(
        createPowerPelletItem(pelletId, FINAL_NORMAL_ROOM_ID),
        pelletCell.x,
        pelletCell.z,
        { visible: true },
      )
    }

    this.trapField.setPlacements([
      ...this.baseTrapPlacements,
      ...plan.traps.map((trap) => ({
        x: trap.x,
        z: trap.z,
        width: trap.width,
        depth: trap.depth,
      })),
    ])
    this.mazeWalls.setPlacements([
      ...this.baseMazeWallPlacements,
      ...plan.walls.map((wall) => ({
        x: wall.x,
        z: wall.z,
        width: wall.width,
        depth: wall.depth,
      })),
    ])
    this.worldCollision.setStructureColliders(this.mazeWalls.getColliders())
    this.spawnEndlessGhostWave(plan, roomNumber)
    this.spawnFloorPulseAt(
      (bounds.minX + bounds.maxX) * 0.5,
      (bounds.minZ + bounds.maxZ) * 0.5,
      {
        color: 0x7cdcff,
        opacity: 0.22,
        startScale: 0.8,
        endScale: 2.8,
        lifeSec: 0.46,
      },
    )
    this.triggerRoomEntryJuice(roomNumber)
  }

  private spawnEndlessGhostWave(plan: RoomGridPlan, roomNumber: number): void {
    this.player.getPosition(this.playerPos)
    const blocked = new Set<string>()
    for (const w of plan.wisps) blocked.add(`${w.row},${w.col}`)
    for (const t of plan.traps) blocked.add(`${t.row},${t.col}`)
    for (const wall of plan.walls) blocked.add(`${wall.row},${wall.col}`)

    const candidates: { x: number; z: number; d: number }[] = []
    for (let r = 0; r < ROOM_GRID_ROWS; r++) {
      for (let c = 0; c < ROOM_GRID_COLS; c++) {
        if (blocked.has(`${r},${c}`)) continue
        const { x, z } = cellCenterWorld(
          plan.bounds,
          r,
          c,
          ROOM_GRID_ROWS,
          ROOM_GRID_COLS,
        )
        candidates.push({
          x,
          z,
          d: Math.hypot(x - this.playerPos.x, z - this.playerPos.z),
        })
      }
    }
    candidates.sort((a, b) => b.d - a.d)
    const maxCount = Math.min(
      5,
      2 + Math.floor((roomNumber - NORMAL_ROOM_COUNT - 1) / 2),
    )
    const count = Math.max(2, maxCount + (this.runRandom() < 0.34 ? 1 : 0))
    const roomIndex = Math.min(roomNumber, NORMAL_ROOM_COUNT)
    const activeGhostCap = maxActiveGhostsForRoomProgress(roomNumber)
    let spawned = 0
    for (const candidate of candidates) {
      if (
        spawned >= count ||
        this.ghostSystem.getActiveGhostCount() >= activeGhostCap
      ) {
        break
      }
      if (candidate.d < WISP_GHOST_SPAWN_MIN_PLAYER_DIST && spawned > 0) continue
      const visualMul = ghostRoomVisualMul(roomIndex)
      const placed = this.worldCollision.resolveCircleXZ(
        candidate.x,
        candidate.z,
        GHOST_COLLISION_RADIUS * visualMul,
      )
      this.ghostSystem.spawnGhost({
        x: placed.x,
        z: placed.z,
        roomIndex,
        color: pickGhostColorForRoomIndex(roomIndex, this.runRandom),
      })
      spawned += 1
    }
    if (spawned > 0) {
      this.triggerEnemySpawnJuice(spawned)
    }
  }

  private getEndlessRoomPercent(): number {
    if (this.endlessRoomWispTotal <= 0) return 0
    return Math.max(
      0,
      Math.min(100, (100 * this.endlessRoomWispsCollected) / this.endlessRoomWispTotal),
    )
  }

  private registerEndlessWispCollected(): void {
    if (!this.endlessModeActive || this.endlessRoomCleared) return
    this.endlessRoomWispsCollected = Math.min(
      this.endlessRoomWispTotal,
      this.endlessRoomWispsCollected + 1,
    )
    if (
      this.endlessRoomWispTotal > 0 &&
      this.endlessRoomWispsCollected >= this.endlessRoomWispTotal
    ) {
      this.endlessRoomCleared = true
      this.beginRewardedRoomClear(
        FINAL_NORMAL_ROOM_ID,
        null,
        NORMAL_ROOM_COUNT,
      )
    }
  }

  private syncCameraModeHud(): void {
    const el = this.hudCameraHintEl
    if (!el) return
    const mode = this.cameraRig.getMode()
    el.textContent = mode === 'over_shoulder' ? 'C Â· near' : 'C Â· far'
    el.setAttribute(
      'aria-label',
      mode === 'over_shoulder' ? 'Camera: near view. Press C for far view.' : 'Camera: far view. Press C for near view.',
    )
  }

  /** New session: reset pooled upgrades and re-sync stack speed / ghosts. */
  private initRunUpgrades(): void {
    this.runUpgrades.reset()
    this.runStatRoomsCleared = 0
    this.runStatWispsCollected = 0
    this.runStatDeepestRoomReached = 0
    this.runStatBossReachedAtSec = null
    this.roomShieldAvailable = false
    this.shieldRefreshRoomId = null
    this.wispsCollectedPerRoom.clear()
    this.endlessModeActive = false
    this.endlessCurrentRoomNumber = NORMAL_ROOM_COUNT
    this.endlessRoomWispTotal = 0
    this.endlessRoomWispsCollected = 0
    this.endlessRoomCleared = false
    this.endlessCurrentWispIds.length = 0
    this.endlessCurrentPowerPelletId = null
    this.runStatUpgradesPicked.length = 0
    this.roomUpgradePendingReveal = null
    this.powerModeRemain = 0
    this.gameViewport.classList.remove('game-viewport--power-mode')
    this.cameraRig.setPowerModeActive(false)
    this.presentOverlayContinue = null
    this.presentOverlayPendingRewardId = null
    this.presentOverlayPaused = false
    this.presentOverlayPhase = 'closed'
    this.presentOverlayEl.classList.remove('present-overlay--show')
    this.presentOverlayEl.classList.add('hidden')
    this.presentOverlayEl.setAttribute('aria-hidden', 'true')
    if (this.presentTrackTimer) {
      clearTimeout(this.presentTrackTimer)
      this.presentTrackTimer = null
    }
    this.presentTrackEl.classList.remove('present-track--show', 'present-track--ready')
    this.presentTrackEl.classList.add('hidden')
    this.presentTrackEl.setAttribute('aria-hidden', 'true')
    this.applyEquippedTrailStyle()
    this.syncRunUpgradeModifiers()
  }

  private syncRunUpgradeModifiers(): void {
    this.player.setMaxSpeed(speedForLevel(this.runUpgrades.speedLevel))
    this.ghostSystem.setRuntimeSpeedMultiplier(
      this.runUpgrades.ghostSpeedRuntimeMul,
    )
  }

  private syncLivesHud(): void {
    const wrap = this.hudLivesWrap
    if (!wrap) return
    const hearts = wrap.querySelectorAll<HTMLElement>('.hud-life')
    hearts.forEach((el, i) => {
      el.classList.toggle('hud-life--lost', i >= this.lives)
    })
    wrap.setAttribute(
      'aria-label',
      `Lives: ${this.lives} of ${PLAYER_MAX_LIVES}`,
    )
  }

  private beginRewardedRoomClear(
    roomId: RoomId,
    doorIndex: number | null,
    roomIndex: number,
  ): void {
    if (doorIndex !== null) {
      this.doorUnlock.unlockDoor(doorIndex)
    }

    const offers = pickRunUpgradeOffers(
      this.runRandom,
      this.runUpgrades,
      this.lives,
      this.runStatRoomsCleared,
    )
    this.stageRoomClearPresentProgress('normal', roomIndex)
    const applyChosen = (offer: (typeof offers)[number]): void => {
      this.pulseViewportClass('game-viewport--pulse-room-clear', 260)
      const res = applyRunUpgrade(offer.id, {
        state: this.runUpgrades,
        stack: this.stack,
        player: this.player,
        lives: this.lives,
        random: this.runRandom,
      })
      if (!res) return
      this.runStatUpgradesPicked.push({ id: offer.id, title: offer.title })
      this.lives = res.lives
      this.syncLivesHud()
      this.syncRunUpgradeModifiers()
      this.completeRoomClearAfterChoice(roomId, doorIndex, roomIndex, res)
    }

    const revealUpgrades = (): void => {
      const showUpgrades = (): void => {
        if (this.roomUpgradePicker && offers.length > 0) {
          this.roomUpgradePaused = true
          this.roomUpgradePicker.show(offers, (offer) => {
            if (!this.roomUpgradePaused) return
            this.roomUpgradePicker?.hide()
            this.roomUpgradePaused = false
            applyChosen(offer)
          })
        } else if (offers[0]) {
          applyChosen(offers[0])
        }
      }
      if (this.maybeStartPresentOverlay(showUpgrades)) return
      showUpgrades()
    }

    spawnFloatingHudText(
      this.gameViewport,
      'Room cleared!',
      'float-hud--pickup',
      { topPct: 30, leftPct: 50, durationSec: 1.1, risePx: 22 },
    )
    this.roomUpgradePendingReveal = revealUpgrades
    this.beginRoomClearIntroCinematic(roomIndex)
  }

  private completeRoomClearAfterChoice(
    roomId: RoomId,
    doorIndex: number | null,
    roomIndex: number,
    res: ApplyRunUpgradeResult,
  ): void {
    const endlessFinalRoom =
      this.endlessModeActive && roomId === FINAL_NORMAL_ROOM_ID
    this.runStatRoomsCleared += 1
    this.pulseViewportClass('game-viewport--pulse-room-clear', 320)
    spawnRoomClearedBanner(this.gameViewport, res.bannerSubtitle)
    if (!endlessFinalRoom) {
      this.roomClearFloorDisposers.push(
        spawnRoomClearedFloorLabel(this.scene, roomId, res.bannerSubtitle),
      )
    }
    if (res.floatText) {
      spawnFloatingHudText(
        this.gameViewport,
        res.floatText,
        res.floatClass ?? 'float-hud--level-up',
        { topPct: 26, leftPct: 50, durationSec: 2.35 },
      )
    }

    if (doorIndex !== null) {
      this.beginRoomClearDoorCinematic(doorIndex)
    } else {
      this.ghostSystem.purgeGhostsForRoom(roomIndex)
      if (endlessFinalRoom) {
        this.spawnEndlessRoom(this.endlessCurrentRoomNumber + 1)
      }
    }
  }

  private completeBossRunVictory(): void {
    if (this.gameOver || this.bossVictoryOutroRemain !== null) return
    this.stageRoomClearPresentProgress('boss')
    this.runStatRoomsCleared += 1
    spawnRoomClearedBanner(this.gameViewport, 'Mansion cleared')
    this.ghostSystem.beginGateClearFadeForRoom(
      NORMAL_ROOM_COUNT,
      ROOM_CLEAR_GHOST_FADE_SEC,
    )
    spawnFloatingHudText(
      this.gameViewport,
      'Haunt banished!',
      'float-hud--level-up',
      { topPct: 24, leftPct: 50, durationSec: 1.65 },
    )
    this.bossVictoryOutroRemain = BOSS_VICTORY_OUTRO_SEC
  }

  private beginEndlessModeAfterBossVictory(): void {
    const continueIntoEndless = (): void => {
      this.commitRunPersonalBest()
      if (this.endlessModeActive) return
      this.endlessModeActive = true
      spawnFloatingHudText(
        this.gameViewport,
        'Endless unlocked',
        'float-hud--level-up',
        { topPct: 24, leftPct: 50, durationSec: 1.35 },
      )
      this.spawnEndlessRoom(NORMAL_ROOM_COUNT + 1)
    }
    if (this.maybeStartPresentOverlay(continueIntoEndless)) return
    continueIntoEndless()
  }

  /**
   * Over-shoulder: move relative to where the camera looks (ground plane), not world +X/+Z.
   * Top-down keeps the original screen-aligned axes.
   */
  private applyOtsCameraRelativeMove(move: {
    x: number
    y: number
    fingerDown: boolean
    active: boolean
  }): { x: number; y: number; fingerDown: boolean; active: boolean } {
    if (this.cameraRig.getMode() !== 'over_shoulder') return move
    this.camera.getWorldDirection(this.camForwardScratch)
    this.camForwardScratch.y = 0
    const fl = Math.hypot(this.camForwardScratch.x, this.camForwardScratch.z)
    if (fl > 1e-5) {
      this.camForwardScratch.multiplyScalar(1 / fl)
    } else {
      this.camForwardScratch.set(0, 0, -1)
    }
    const fx = this.camForwardScratch.x
    const fz = this.camForwardScratch.z
    const rx = fz
    const rz = -fx
    const nx = move.x
    const nz = move.y
    return {
      x: nx * rx + (-nz) * fx,
      y: nx * rz + (-nz) * fz,
      fingerDown: move.fingerDown,
      active: move.active,
    }
  }

  /** Boss intro or post-boss outro â€” block movement and pickups. */
  private isInteractionCinematicBlocking(): boolean {
    return (
      this.roomClearIntroCinematicRunning ||
      this.roomClearDoorCinematicRunning ||
      this.bossIntroCinematicRunning ||
      this.bossVictoryOutroRemain !== null ||
      this.presentOverlayPaused
    )
  }

  private bossIntroSlowMoActive(): boolean {
    if (!this.bossIntroCinematicRunning) return false
    const e = this.bossIntroCinematicElapsed
    const t0 = BOSS_CINE_ZOOM_SEC
    const t1 = t0 + BOSS_CINE_SLOW_SEC
    return e >= t0 && e < t1
  }

  private beginBossIntroCinematic(): void {
    this.bossIntroCinematicRunning = true
    this.bossIntroCinematicElapsed = 0
    this.bossCineStartPos.copy(this.camera.position)
    this.player.getPosition(this.playerPos)
    const { x, z } = getBossSpawnXZ()
    this.bossCineBossLook.set(x, 1.28, z)
    this.pulseViewportClass('game-viewport--boss-intro', 620)
    this.spawnFloorPulseAt(x, z, {
      color: 0xffd68f,
      opacity: 0.24,
      startScale: 0.52,
      endScale: 2.2,
      lifeSec: 0.48,
    })
    spawnFloatingHudText(this.gameViewport, 'BOSS ROOM', 'float-hud--alert', {
      topPct: 18,
      leftPct: 50,
      durationSec: 0.8,
      risePx: 20,
    })

    let hdx = this.camera.position.x - this.playerPos.x
    let hdz = this.camera.position.z - this.playerPos.z
    const hlen = Math.hypot(hdx, hdz) || 1
    hdx /= hlen
    hdz /= hlen
    const pullDist = 3.15
    this.bossCinePullPos.set(
      this.camera.position.x + hdx * pullDist,
      this.camera.position.y + 0.72,
      this.camera.position.z + hdz * pullDist,
    )
  }

  private updateBossIntroCinematic(dt: number): void {
    this.bossIntroCinematicElapsed += dt
    const e = this.bossIntroCinematicElapsed
    const tZoom = BOSS_CINE_ZOOM_SEC
    const tSlowEnd = tZoom + BOSS_CINE_SLOW_SEC
    const tEnd = tSlowEnd + BOSS_CINE_RETURN_SEC

    this.player.getPosition(this.playerPos)
    this.gateCinePlayerLook.set(this.playerPos.x, 1.12, this.playerPos.z)
    this.cameraRig.getDesiredCameraPosition(this.gateCineRigDesired)

    if (e < tZoom) {
      const u = easeInOutCubic(Math.min(1, e / tZoom))
      this.camera.position.lerpVectors(this.bossCineStartPos, this.bossCinePullPos, u)
      this.bossCineBlendLook.lerpVectors(
        this.gateCinePlayerLook,
        this.bossCineBossLook,
        u,
      )
      this.camera.lookAt(this.bossCineBlendLook)
    } else if (e < tSlowEnd) {
      this.camera.position.copy(this.bossCinePullPos)
      this.camera.lookAt(this.bossCineBossLook)
    } else if (e < tEnd) {
      const u = easeInOutCubic(Math.min(1, (e - tSlowEnd) / BOSS_CINE_RETURN_SEC))
      this.camera.position.lerpVectors(this.bossCinePullPos, this.gateCineRigDesired, u)
      this.bossCineBlendLook.lerpVectors(this.bossCineBossLook, this.gateCinePlayerLook, u)
      this.camera.lookAt(this.bossCineBlendLook)
    } else {
      this.camera.position.copy(this.gateCineRigDesired)
      this.camera.lookAt(this.gateCinePlayerLook)
      this.cameraRig.resetOtsLookBlend()
      this.bossIntroCinematicRunning = false
      this.bossIntroCinematicElapsed = 0
      this.bossRoom.startFight()
    }
  }

  private roomClearIntroCinematicSlowMoActive(): boolean {
    if (!this.roomClearIntroCinematicRunning) return false
    const e = this.roomClearIntroCinematicElapsed
    const t0 = ROOM_CLEAR_CINE_ZOOM_OUT_SEC
    const t1 = t0 + ROOM_CLEAR_CINE_SLOW_MO_SEC
    return e >= t0 && e < t1
  }

  private beginRoomClearIntroCinematic(roomIndex: number): void {
    this.roomClearIntroCinematicRunning = true
    this.roomClearIntroCinematicElapsed = 0
    this.roomClearCineStartPos.copy(this.camera.position)
    this.player.getPosition(this.playerPos)
    this.pulseViewportClass('game-viewport--pulse-room-clear', 360)
    this.spawnFloorPulseAt(this.playerPos.x, this.playerPos.z, {
      color: 0xffde96,
      opacity: 0.22,
      startScale: 0.45,
      endScale: 2.4,
      lifeSec: 0.44,
    })
    let hdx = this.camera.position.x - this.playerPos.x
    let hdz = this.camera.position.z - this.playerPos.z
    const hlen = Math.hypot(hdx, hdz) || 1
    hdx /= hlen
    hdz /= hlen
    const pullDist = 4.35
    this.roomClearCinePullBackPos.set(
      this.camera.position.x + hdx * pullDist,
      this.camera.position.y + 1.05,
      this.camera.position.z + hdz * pullDist,
    )
    this.ghostSystem.beginGateClearFadeForRoom(
      roomIndex,
      ROOM_CLEAR_INTRO_GHOST_FADE_SEC,
    )
  }

  private updateRoomClearIntroCinematic(dt: number): void {
    if (!this.roomClearIntroCinematicRunning) return
    this.roomClearIntroCinematicElapsed += dt
    const e = this.roomClearIntroCinematicElapsed
    const tZoom = ROOM_CLEAR_CINE_ZOOM_OUT_SEC
    const tSlowEnd = tZoom + ROOM_CLEAR_CINE_SLOW_MO_SEC
    const tEnd = tSlowEnd + ROOM_CLEAR_CINE_POST_SLOW_HOLD_SEC

    this.player.getPosition(this.playerPos)
    this.gateCinePlayerLook.set(this.playerPos.x, 1.12, this.playerPos.z)

    if (e < tZoom) {
      const u = easeInOutCubic(Math.min(1, e / tZoom))
      this.camera.position.lerpVectors(
        this.roomClearCineStartPos,
        this.roomClearCinePullBackPos,
        u,
      )
      this.camera.lookAt(this.gateCinePlayerLook)
    } else if (e < tSlowEnd) {
      this.camera.position.copy(this.roomClearCinePullBackPos)
      this.camera.lookAt(this.gateCinePlayerLook)
    } else if (e < tEnd) {
      this.camera.position.copy(this.roomClearCinePullBackPos)
      this.camera.lookAt(this.gateCinePlayerLook)
    } else {
      this.roomClearIntroCinematicRunning = false
      this.roomClearIntroCinematicElapsed = 0
      this.player.getPosition(this.playerPos)
      this.gateCinePlayerLook.set(this.playerPos.x, 1.12, this.playerPos.z)
      this.cameraRig.getDesiredCameraPosition(this.gateCineRigDesired)
      this.camera.position.copy(this.gateCineRigDesired)
      this.camera.lookAt(this.gateCinePlayerLook)
      this.cameraRig.resetOtsLookBlend()
      const reveal = this.roomUpgradePendingReveal
      this.roomUpgradePendingReveal = null
      reveal?.()
    }
  }

  private beginRoomClearDoorCinematic(doorIndex: number): void {
    this.roomClearDoorCinematicRunning = true
    this.roomClearDoorCinematicElapsed = 0
    this.roomClearDoorCinematicDoorIndex = doorIndex
    this.roomClearDoorUnlockFeedbackDone = false
    this.roomClearCineStartPos.copy(this.camera.position)
    this.player.getPosition(this.playerPos)
    const zDoor = getDoorBlockerZ(doorIndex)
    this.roomClearCineLookAtDoor.set(0, 1.14, zDoor)
    this.roomClearCineDoorViewPos.set(0, 10.85, zDoor + 7.85)
    this.gateCinePlayerLook.set(this.playerPos.x, 1.12, this.playerPos.z)
    this.cameraRig.getDesiredCameraPosition(this.gateCineRigDesired)
  }

  private updateRoomClearDoorCinematic(dt: number): void {
    if (!this.roomClearDoorCinematicRunning) return
    this.roomClearDoorCinematicElapsed += dt
    const e = this.roomClearDoorCinematicElapsed
    const zDoor = getDoorBlockerZ(this.roomClearDoorCinematicDoorIndex)
    this.roomClearCineLookAtDoor.set(0, 1.14, zDoor)

    const tApproach = ROOM_CLEAR_DOOR_CINE_APPROACH_SEC
    const tHoldEnd = tApproach + ROOM_CLEAR_DOOR_CINE_HOLD_SEC
    const tEnd = tHoldEnd + ROOM_CLEAR_DOOR_CINE_RETURN_SEC

    this.player.getPosition(this.playerPos)
    this.gateCinePlayerLook.set(this.playerPos.x, 1.12, this.playerPos.z)
    this.cameraRig.getDesiredCameraPosition(this.gateCineRigDesired)

    if (e < tApproach) {
      const u = easeInOutCubic(Math.min(1, e / tApproach))
      this.camera.position.lerpVectors(
        this.roomClearCineStartPos,
        this.roomClearCineDoorViewPos,
        u,
      )
      this.roomClearCineLookBlend.lerpVectors(
        this.gateCinePlayerLook,
        this.roomClearCineLookAtDoor,
        u,
      )
      this.camera.lookAt(this.roomClearCineLookBlend)
    } else if (e < tHoldEnd) {
      this.camera.position.copy(this.roomClearCineDoorViewPos)
      this.camera.lookAt(this.roomClearCineLookAtDoor)
      if (!this.roomClearDoorUnlockFeedbackDone) {
        this.roomClearDoorUnlockFeedbackDone = true
        this.pulseViewportClass('game-viewport--pulse-door', 220)
        this.burstSpawnScratch.set(0, 0.04, zDoor - 0.2)
        this.burstParticles.push(
          ...spawnDirectionalFloorPulse(this.burstGroup, this.burstSpawnScratch, 0, -1, {
            color: 0xffdc92,
            opacity: 0.16,
            spacing: 0.95,
            count: 3,
            lifeSec: 0.22,
          }),
        )
        spawnFloatingHudText(
          this.gameViewport,
          'Unlocked',
          'float-hud--level-up',
          { topPct: 38, leftPct: 50, durationSec: 1.12, risePx: 20 },
        )
      }
    } else if (e < tEnd) {
      const u = easeInOutCubic(
        Math.min(1, (e - tHoldEnd) / ROOM_CLEAR_DOOR_CINE_RETURN_SEC),
      )
      this.camera.position.lerpVectors(
        this.roomClearCineDoorViewPos,
        this.gateCineRigDesired,
        u,
      )
      this.roomClearCineLookBlend.lerpVectors(
        this.roomClearCineLookAtDoor,
        this.gateCinePlayerLook,
        u,
      )
      this.camera.lookAt(this.roomClearCineLookBlend)
    } else {
      this.camera.position.copy(this.gateCineRigDesired)
      this.camera.lookAt(this.gateCinePlayerLook)
      this.cameraRig.resetOtsLookBlend()
      this.roomClearDoorCinematicRunning = false
      this.roomClearDoorCinematicElapsed = 0
    }
  }

  private syncRoomCleanHud(roomId: RoomId | null): void {
    const wrap = this.hudRoomCleanWrap
    const fill = this.hudRoomCleanFill
    const pctEl = this.hudRoomCleanPct
    const titleEl = this.hudRoomCleanTitle
    if (!wrap || !fill || !pctEl || !titleEl) return

    if (roomId === 'SAFE_CENTER') {
      wrap.classList.remove('hud-room-clean--inactive', 'hud-room-clean--cleared')
      wrap.classList.add('hud-room-clean--safe')
      titleEl.textContent = 'Safe room'
      pctEl.textContent = 'PB'
      fill.style.transform = 'scaleX(0)'
      this.syncSafeRoomPersonalBestHud()
      wrap.querySelector('[role="progressbar"]')?.setAttribute(
        'aria-valuenow',
        '0',
      )
      return
    }

    wrap.classList.remove('hud-room-clean--safe')
    const trackable =
      roomId !== null &&
      roomId.startsWith('ROOM_')

    if (!trackable) {
      wrap.classList.add('hud-room-clean--inactive')
      titleEl.textContent = 'Room'
      pctEl.textContent = 'â€”'
      fill.style.transform = 'scaleX(0)'
      return
    }

    wrap.classList.remove('hud-room-clean--inactive')
    let rounded = 0
    if (roomId === FINAL_NORMAL_ROOM_ID && this.bossRoom.isFightActive()) {
      titleEl.textContent = this.bossRoom.getBossHudLabel()
      const pct = this.bossRoom.getBossHudPercent()
      rounded = Math.round(pct)
      pctEl.textContent = `${rounded}%`
      fill.style.transform = `scaleX(${Math.max(0, Math.min(1, pct / 100))})`
    } else if (roomId === FINAL_NORMAL_ROOM_ID && this.endlessModeActive) {
      titleEl.textContent = `Room ${this.endlessCurrentRoomNumber}`
      const pct = this.getEndlessRoomPercent()
      rounded = Math.round(pct)
      pctEl.textContent = `${rounded}%`
      fill.style.transform = `scaleX(${Math.max(0, Math.min(1, pct / 100))})`
    } else {
      titleEl.textContent = roomCleanHudLabel(roomId)
      const pct = this.roomCleanliness.getDisplayPercent(roomId)
      rounded = Math.round(pct)
      pctEl.textContent = `${rounded}%`
      fill.style.transform = `scaleX(${Math.max(0, Math.min(1, pct / 100))})`
    }
    wrap.querySelector('[role="progressbar"]')?.setAttribute(
      'aria-valuenow',
      String(rounded),
    )
    if (
      (roomId === FINAL_NORMAL_ROOM_ID && this.endlessModeActive
        ? this.endlessRoomCleared
        : this.roomCleanliness.isRoomCleared(roomId))
    ) {
      wrap.classList.add('hud-room-clean--cleared')
    } else {
      wrap.classList.remove('hud-room-clean--cleared')
    }
  }

  /**
   * Push spawn away from the player if needed, then clamp to walkable geometry.
   */
  private resolveGhostSpawnFromHauntedClutter(
    pickupX: number,
    pickupZ: number,
    spawnRoomId: RoomId,
  ): { x: number; z: number; roomIndex: number } {
    this.player.getPosition(this.playerPos)
    const px = this.playerPos.x
    const pz = this.playerPos.z
    const pr = this.player.radius
    const roomIndex = this.roomChainIndexFromId(spawnRoomId)
    const visualMul = ghostRoomVisualMul(roomIndex)
    const rG = GHOST_COLLISION_RADIUS * visualMul
    const minSep = pr + rG + 0.42

    let sx = pickupX
    let sz = pickupZ
    let dx = sx - px
    let dz = sz - pz
    let dist = Math.hypot(dx, dz)
    if (dist < 1e-5) {
      const ang = this.runRandom() * Math.PI * 2
      dx = Math.cos(ang)
      dz = Math.sin(ang)
      dist = 1
    } else {
      dx /= dist
      dz /= dist
    }
    if (dist < minSep) {
      sx = px + dx * minSep
      sz = pz + dz * minSep
    }
    const placed = this.worldCollision.resolveCircleXZ(sx, sz, rG)
    return { x: placed.x, z: placed.z, roomIndex }
  }

  private roomChainIndexFromId(
    roomId: ReturnType<RoomSystem['getRoomAt']>,
  ): number {
    if (!roomId || roomId === 'SAFE_CENTER') return 1
    if (this.endlessModeActive && roomId === FINAL_NORMAL_ROOM_ID) {
      return this.endlessCurrentRoomNumber
    }
    const m = /^ROOM_(\d+)$/.exec(roomId)
    return m ? Number(m[1]) : 1
  }

  /** 0 = default bag size; rises with room clean progress while the room is not cleared. */
  private getRoomCleaningProgressForBag(): number {
    this.player.getPosition(this.playerPos)
    const roomId = this.roomSystem.getRoomAt(this.playerPos.x, this.playerPos.z)
    if (
      roomId === null ||
      roomId === 'SAFE_CENTER' ||
      !roomId.startsWith('ROOM_')
    ) {
      return 0
    }
    if (roomId === FINAL_NORMAL_ROOM_ID && this.bossRoom.isFightActive()) {
      return Math.max(0, Math.min(1, this.bossRoom.getBossHudPercent() / 100))
    }
    if (roomId === FINAL_NORMAL_ROOM_ID && this.endlessModeActive) {
      return Math.max(0, Math.min(1, this.getEndlessRoomPercent() / 100))
    }
    if (this.roomCleanliness.isRoomCleared(roomId)) return 0
    return Math.max(
      0,
      Math.min(1, this.roomCleanliness.getDisplayPercent(roomId) / 100),
    )
  }

  private syncStackJuiceHud(weight: number): void {
    const h = this.hudStackHum
    if (h) {
      const on = weight >= 0.7
      h.classList.toggle('hud-stack-hum--on', on)
      h.style.opacity = on ? String(0.28 + ((weight - 0.7) / 0.3) * 0.55) : '0'
    }
  }

  private triggerDepositScreenShake(overload: boolean): void {
    this.pulseViewportClass(
      overload ? 'game-viewport--shake-hard' : 'game-viewport--shake',
      280,
    )
  }

  /** Spike trap: always âˆ’1 life (no stack loss); mesh has no physics collider â€” overlap only. */
  private applyTrapLifeLoss(trapX: number, trapZ: number): void {
    this.trapHitSlowMoRemain = 0.08
    this.recoverTrailRemain = Math.max(this.recoverTrailRemain, 0.4)
    this.spawnFloorPulseAt(trapX, trapZ, {
      color: 0xff5b6f,
      opacity: 0.3,
      startScale: 0.3,
      endScale: 1.22,
      lifeSec: 0.24,
    })
    if (!this.consumeRoomShield('Shield blocked')) {
      this.lives = Math.max(0, this.lives - 1)
      spawnLifeLostImpact(this.gameViewport)
      this.triggerDepositScreenShake(true)
      this.syncLivesHud()
      if (this.lives <= 0) {
        this.commitRunPersonalBest()
        this.gameOver = true
        this.runFailedCleanup = showRunFailedOverlay(
          this.gameViewport,
          {
            roomsCleared: this.runStatRoomsCleared,
            wispsCollected: this.runStatWispsCollected,
            timeSec: this.elapsedSec,
            upgrades: this.runStatUpgradesPicked.map((u) => ({
              title: u.title,
            })),
          },
          {
            onRetry: () => {
              this.runFailedCleanup?.()
              this.runFailedCleanup = null
              if (this.onRunFailedRetry) {
                void Promise.resolve(this.onRunFailedRetry()).catch(() => {
                  location.reload()
                })
              } else {
                location.reload()
              }
            },
          },
        )
      }
    }

    const ang = this.runRandom() * Math.PI * 2
    this.player.applyGhostKnockback(
      this.playerPos.x - Math.cos(ang) * 0.02,
      this.playerPos.z - Math.sin(ang) * 0.02,
      this.playerPos.x,
      this.playerPos.z,
      0.45,
    )
    this.triggerGhostHitFlash(160, false)
  }

  /** Current room / `CORRIDOR` / null (outside layout), from player XZ. */
  getPlayerArea(): AreaId | null {
    this.player.getPosition(this.playerPos)
    return this.roomSystem.getAreaAt(this.playerPos.x, this.playerPos.z)
  }

  getRoomSystem(): RoomSystem {
    return this.roomSystem
  }

  private triggerGhostHitFlash(durationMs = 88, ghostImpact = false): void {
    const el = this.hitFlashEl
    if (!el) return
    if (this.hitFlashTimer) {
      clearTimeout(this.hitFlashTimer)
      this.hitFlashTimer = null
    }
    el.classList.toggle('hud-hit-flash--ghost', ghostImpact)
    el.classList.add('hud-hit-flash--on')
    this.hitFlashTimer = setTimeout(() => {
      el.classList.remove('hud-hit-flash--on', 'hud-hit-flash--ghost')
      this.hitFlashTimer = null
    }, durationMs)
  }

  /** Encumbrance in [0, 1] and scales with items carried. */
  getStackWeight(): number {
    return computeCarryEncumbranceWeight(this.stack.count)
  }

  /** Double door swing progress 0..1 (for UI / debugging). */
  getDoorOpenProgress(doorIndex: number): number {
    return this.doorUnlock.getDoorOpenProgress(doorIndex)
  }

  dispose(): void {
    this.closeLeaderboard()
    this.runFailedCleanup?.()
    this.runFailedCleanup = null
    cancelAnimationFrame(this.raf)
    if (this.depositShakeTimer) {
      clearTimeout(this.depositShakeTimer)
      this.depositShakeTimer = null
    }
    if (this.ectoGlowTimer) {
      clearTimeout(this.ectoGlowTimer)
      this.ectoGlowTimer = null
    }
      if (this.roomHudUrgencyTimer) {
        clearTimeout(this.roomHudUrgencyTimer)
        this.roomHudUrgencyTimer = null
      }
      if (this.presentTrackTimer) {
        clearTimeout(this.presentTrackTimer)
        this.presentTrackTimer = null
      }
      for (const timer of this.viewportClassTimers.values()) {
        clearTimeout(timer)
      }
    this.viewportClassTimers.clear()
    if (this.hitFlashTimer) {
      clearTimeout(this.hitFlashTimer)
      this.hitFlashTimer = null
    }
    this.hitFlashEl?.classList.remove(
      'hud-hit-flash--on',
      'hud-hit-flash--ghost',
    )
    this.gameViewport.classList.remove(
      'game-viewport--ghost-invuln',
      'game-viewport--power-mode',
      'game-viewport--glow-ecto',
    )
    this.cameraRig.setPowerModeActive(false)
    disposeAllGhostHitBursts(this.burstParticles)
    this.burstGroup.removeFromParent()
    this.doorUnlock.dispose()
    this.roomLockCovers.dispose()
    for (const d of this.roomClearFloorDisposers) {
      d()
    }
    this.roomClearFloorDisposers.length = 0
    this.hubTitleFloorLabel.dispose()
    this.trapField.dispose()
    this.mazeWalls.dispose()
      this.playerTrail.dispose()
      this.ghostSystem.dispose()
      disposeSharedGhostVisionConeGeometry()
    disposeGhostGltfTemplate(this.ghostGltfTemplate)
    this.stackVisual.dispose()
    this.playerCharacter.dispose()
    disposePlayerGltfTemplate(this.playerGltfTemplate)
    disposeGhostSharedGeometry()
      this.keyboardMove.dispose()
      this.joystick.dispose()
      this.tutorialOverlayEl
        .querySelector<HTMLButtonElement>('.door-tutorial-overlay__continue')
        ?.removeEventListener('click', this.handleTutorialContinue)
      this.presentOverlayActionBtn.removeEventListener(
        'click',
        this.handlePresentOverlayAction,
      )
      this.presentTrackEl.remove()
      this.presentOverlayEl.remove()
      this.gameStartCountdownEl.remove()
      this.unsubscribeResize()
      this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
