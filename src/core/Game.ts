import type { PerspectiveCamera } from 'three'
import type { Scene } from 'three'
import type { WebGLRenderer } from 'three'
import { Group, Vector3 } from 'three'
import { CameraRig } from '../systems/camera/CameraRig.ts'
import { CollectionSystem } from '../systems/collection/CollectionSystem.ts'
import {
  DepositController,
  type DepositPresentationOverload,
} from '../systems/deposit/DepositController.ts'
import { DepositFlightAnimator } from '../systems/deposit/DepositFlightAnimator.ts'
import { DepositZoneFeedback } from '../systems/deposit/DepositZoneFeedback.ts'
import type { DepositEval } from '../systems/economy/depositEvaluation.ts'
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
import { createRelicItem, createWispItem } from '../themes/wisp/itemFactory.ts'
import type { GameItem } from './types/GameItem.ts'
import { createRunRandom } from './runRng.ts'
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
  MAX_ACTIVE_GHOSTS,
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
  GHOST_HIT_SLOW_MO_SCALE,
  GHOST_HIT_SLOW_MO_SEC,
  POWER_MODE_DURATION_MAX_SEC,
  POWER_MODE_DURATION_MIN_SEC,
  loadSavedCameraMode,
  PLAYER_MAX_LIVES,
  saveCameraMode,
  type CameraMode,
} from '../juice/juiceConfig.ts'
import { spawnLifeLostImpact } from '../juice/lifeHudJuice.ts'
import { showRunFailedOverlay } from '../juice/runFailedOverlay.ts'
import { showRunSuccessOverlay } from '../juice/runSuccessOverlay.ts'
import { PlayerMotionTrail } from '../juice/playerMotionTrail.ts'
import {
  spawnFloatingHudText,
  spawnRoomClearedBanner,
} from '../juice/floatingHud.ts'
import { playJuiceSound } from '../juice/juiceSound.ts'
import {
  disposeAllGhostHitBursts,
  spawnGhostHitEctoplasmBurst,
  spawnGhostHitPelletBurst,
  spawnRelicCollectBurst,
  updateGhostHitBursts,
  type GhostHitBurstParticle,
} from '../juice/ghostHitPelletBurst.ts'
import {
  showRelicBankedCelebration,
  spawnRelicScreenSparkBurst,
} from '../juice/relicHud.ts'
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
import { spawnPowerPelletsForRun } from '../systems/grid/powerPelletSpawn.ts'
import { pickGridGhostSpawnXZ } from '../systems/grid/gridGhostSpawn.ts'
import {
  flattenTrapPlacements,
  planAllRoomGrids,
  type RoomGridPlan,
} from '../systems/grid/planRoomGrids.ts'
import { TrapFieldSystem } from '../systems/traps/TrapFieldSystem.ts'
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

const DEPOSIT_TOAST_MS = 2800

function roomCleanHudLabel(roomId: RoomId): string {
  if (roomId === 'SAFE_CENTER') return 'Safe'
  const m = /^ROOM_(\d+)$/.exec(roomId)
  return m ? `Room ${m[1]}` : roomId
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

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
  private readonly depositController: DepositController
  private readonly depositFlight: DepositFlightAnimator
  private readonly depositFeedback: DepositZoneFeedback
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
  private depositToastTimer: ReturnType<typeof setTimeout> | null = null
  private raf = 0
  private lastTime = performance.now()
  private elapsedSec = 0
  private hudSpawn: HTMLElement | null = null
  private readonly gameViewport: HTMLElement
  private readonly velScratch = new Vector3()
  /** Ground-plane camera forward for OTS movement (XZ only). */
  private readonly camForwardScratch = new Vector3()
  private readonly playerPos = new Vector3()
  private lastGhostInvuln = false
  private readonly perf = new PerfMonitor()
  private readonly hudRoomCleanWrap: HTMLElement | null
  private readonly hudRoomCleanFill: HTMLElement | null
  private readonly hudRoomCleanPct: HTMLElement | null
  private readonly hudRoomCleanTitle: HTMLElement | null
  private readonly hudDepositToastEl: HTMLElement | null
  private readonly depositToastAmountEl: HTMLElement | null
  private readonly depositToastHintEl: HTMLElement | null
  private readonly hudCarryEl: HTMLElement | null
  private readonly hudCameraHintEl: HTMLElement | null
  private readonly hudLivesWrap: HTMLElement | null
  private lives = PLAYER_MAX_LIVES
  private gameOver = false
  private runFailedCleanup: (() => void) | null = null
  private runSuccessCleanup: (() => void) | null = null
  private readonly bossRoom: BossRoomController
  private runStatRoomsCleared = 0
  private runStatWispsCollected = 0
  private readonly runStatUpgradesPicked: { id: string; title: string }[] = []
  /** Room reached 100% — waiting for player to pick an upgrade. */
  private roomUpgradePaused = false
  private roomUpgradePendingReveal: (() => void) | null = null
  private readonly roomUpgradePicker: ReturnType<
    typeof mountRoomUpgradePicker
  > | null
  private readonly trapField: TrapFieldSystem
  private readonly roomGridPlans: ReadonlyMap<NormalRoomId, RoomGridPlan>
  private readonly gridWispTotalsPerRoom: ReadonlyMap<RoomId, number>
  private readonly wispsCollectedPerRoom = new Map<RoomId, number>()
  private readonly playerTrail: PlayerMotionTrail
  private ghostHitSlowMoRemain = 0
  private hudStackHum: HTMLElement | null = null
  private depositShakeTimer: ReturnType<typeof setTimeout> | null = null
  /** Hide north welcome banner after first exit from the safe hub room. */
  private hubWelcomeHidden = false
  private wasInSafeRoom = true
  private readonly navDebugHudEl: HTMLElement | null
  private lastNavIdleWarnSec = -999

  /** Room clear: zoom out + slow-mo while ghosts fade; then upgrade picker. */
  private roomClearIntroCinematicRunning = false
  private roomClearIntroCinematicElapsed = 0
  /** After upgrade: short door hero shot + “Unlocked” feedback, then return. */
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

  private readonly onCameraModeKey = (e: KeyboardEvent): void => {
    if (e.code !== 'KeyC') return
    if (e.repeat) return
    const t = e.target
    if (t instanceof HTMLElement && (t.isContentEditable || t.closest('input, textarea, select'))) {
      return
    }
    e.preventDefault()
    const next: CameraMode =
      this.cameraRig.getMode() === 'top_down' ? 'over_shoulder' : 'top_down'
    this.cameraRig.setMode(next)
    saveCameraMode(next)
    this.syncCameraModeHud()
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
      depositRoot,
      depositZoneMesh,
      depositUnderglowMesh,
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
    const hudDepositToast = host.querySelector<HTMLElement>(
      '#hud-deposit-toast',
    )
    const depositAmountEl =
      hudDepositToast?.querySelector<HTMLElement>('.deposit-amount') ?? null
    const depositHintEl =
      hudDepositToast?.querySelector<HTMLElement>('.deposit-hint') ?? null
    this.hudSpawn = host.querySelector('#hud-spawn')
    this.hudRoomCleanWrap = host.querySelector('#hud-room-clean')
    this.hudRoomCleanFill = host.querySelector('#hud-room-clean-fill')
    this.hudRoomCleanPct = host.querySelector('#hud-room-clean-pct')
    this.hudRoomCleanTitle = host.querySelector('#hud-room-clean-title')
    this.hudDepositToastEl = hudDepositToast
    this.depositToastAmountEl = depositAmountEl
    this.depositToastHintEl = depositHintEl
    this.hudCameraHintEl = host.querySelector<HTMLElement>('#hud-camera-hint')
    this.hudLivesWrap = host.querySelector<HTMLElement>('#hud-lives')
    this.hudStackHum = host.querySelector('#hud-stack-hum')
    this.navDebugHudEl = host.querySelector('#nav-debug-hud')
    if (!SHOW_PLAYER_NAV_DEBUG_HUD && this.navDebugHudEl) {
      this.navDebugHudEl.style.display = 'none'
    }

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

    const savedCam = loadSavedCameraMode()
    this.cameraRig = new CameraRig(
      this.camera,
      playerRoot,
      () => computeCarryEncumbranceWeight(this.stack.count),
      {
        worldCollision: this.worldCollision,
        getFacingYaw: () => this.player.getFacingYaw(),
        initialMode: savedCam ?? 'top_down',
      },
    )
    window.addEventListener('keydown', this.onCameraModeKey)
    this.syncCameraModeHud()
    this.syncLivesHud()

    this.itemWorld = new ItemWorld(pickupGroup, scene)
    this.itemWorld.prewarmWispPool(8)

    this.doorUnlock = new DoorUnlockSystem({
      scene: this.scene,
      worldCollision: this.worldCollision,
      onDoorPassageCleared: (doorIndex) => {
        /** Defer one frame so door colliders + camera settle; ghost spawns use per-frame budget. */
        requestAnimationFrame(() => {
          this.syncRoomPickupAccessibilityFromDoors()
          const nextRoom = doorIndex + 1
          if (nextRoom >= 1 && nextRoom <= NORMAL_ROOM_COUNT) {
            this.ghostSystem.spawnGhostsForRoom(nextRoom)
          }
        })
      },
      onDoorSlamShut: (_doorIndex: number) => {
        this.triggerDepositScreenShake(false)
        playJuiceSound('overload_impact', { pitch: 0.52 })
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
    this.trapField = new TrapFieldSystem(
      this.scene,
      flattenTrapPlacements(roomGridPlans),
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
    this.playerTrail = new PlayerMotionTrail(this.scene)

    this.specialRelicSpawns = new SpecialRelicSpawnSystem({
      itemWorld: this.itemWorld,
      roomSystem: this.roomSystem,
      worldCollision: this.worldCollision,
      createRelic: () => createRelicItem(),
      random: this.runRandom,
      onSpawn: () => {
        playJuiceSound('relic_spawn')
      },
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
        const idx = roomIndexFromId(roomId)
        if (idx === null || idx < 1) return

        if (doorIndex !== null) {
          this.doorUnlock.unlockDoor(doorIndex)
        }

        const offers = pickRunUpgradeOffers(
          this.runRandom,
          this.runUpgrades,
          this.lives,
        )
        const applyChosen = (offer: (typeof offers)[number]): void => {
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
          this.completeRoomClearAfterChoice(roomId, doorIndex, idx, res)
        }

        const revealUpgrades = (): void => {
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

        spawnFloatingHudText(
          this.gameViewport,
          'Room cleared!',
          'float-hud--pickup',
          { topPct: 30, leftPct: 50, durationSec: 1.1 },
        )
        this.roomUpgradePendingReveal = revealUpgrades
        this.beginRoomClearIntroCinematic(idx)
      },
    })

    if (this.hudSpawn) {
      this.hudSpawn.textContent = ''
    }

    this.hitFlashEl = host.querySelector('#hud-hit-flash')
    this.collection = new CollectionSystem()

    this.depositFeedback = new DepositZoneFeedback(
      depositZoneMesh,
      null,
      depositRoot,
      depositUnderglowMesh,
    )

    this.depositFlight = new DepositFlightAnimator()
    this.depositController = new DepositController({
      scene: this.scene,
      player: this.player,
      stack: this.stack,
      stackVisual: this.stackVisual,
      flight: this.depositFlight,
      resolveDepositZone: () => null,
      evaluateOverload: () => ({ overload: false, perfect: false }),
      onItemDepositLanded: (item, flightIndex) => {
        void flightIndex
        this.depositFeedback.triggerItem()
        spawnFloatingHudText(
          this.gameViewport,
          `+${item.value}`,
          'float-hud--pickup',
          {
            topPct: 58 + this.runRandom() * 16,
            leftPct: 40 + this.runRandom() * 20,
          },
        )
        playJuiceSound('deposit_item', { pitch: 1 + flightIndex * 0.045 })
        this.triggerDepositScreenShake(false)
      },
      onDepositPresentationComplete: (items, ev, ol) => {
        this.runDepositPresentationUi(items, ev, ol)
      },
    })

    /** Precompile materials (scene). */
    this.scene.updateMatrixWorld(true)
    this.renderer.compile(this.scene, this.camera)

    this.player.getPosition(this.playerPos)

    this.initRunUpgrades()

    const tick = (now: number) => {
      if (this.gameOver) return
      this.raf = requestAnimationFrame(tick)
      if (this.roomUpgradePaused) {
        this.lastTime = now
        this.perf.beginFrame(now)
        this.renderer.render(this.scene, this.camera)
        this.perf.endFrame(this.renderer.info.render.calls, 0)
        return
      }
      const dt = Math.min(0.05, (now - this.lastTime) / 1000)
      this.lastTime = now
      this.elapsedSec += dt
      this.perf.beginFrame(now)

      let pickupsThisFrame = 0

      let move = mergeMoveInput(
        this.joystick.getVector(),
        this.keyboardMove.getVector(),
      )
      if (this.isInteractionCinematicBlocking()) {
        move = { x: 0, y: 0, fingerDown: false, active: false }
      } else {
        move = this.applyOtsCameraRelativeMove(move)
      }

      this.player.getPosition(this.playerPos)
      const roomEarly = this.roomSystem.getRoomAt(
        this.playerPos.x,
        this.playerPos.z,
      )
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
      const trapSlow = this.trapField.update(
        this.elapsedSec,
        this.playerPos.x,
        this.playerPos.z,
        this.player.radius,
        {
          onStepTrap: () => {
            this.applyTrapLifeLoss()
          },
        },
      )
      const weight = computeCarryEncumbranceWeight(this.stack.count)
      const relief = this.runUpgrades.encumbranceReliefStacks
      this.player.setMovementSlowMultiplier(
        stackWeightSpeedMultiplierRelief(weight, relief) * trapSlow,
      )
      this.player.setDragWeightMultiplier(
        stackWeightDragMultiplierRelief(weight, relief),
      )
      this.syncStackJuiceHud(weight)

      let simDt =
        this.ghostHitSlowMoRemain > 0 ? dt * GHOST_HIT_SLOW_MO_SCALE : dt
      this.ghostHitSlowMoRemain = Math.max(0, this.ghostHitSlowMoRemain - dt)
      if (this.bossIntroSlowMoActive()) {
        simDt *= BOSS_CINE_SLOW_SIM_SCALE
      }
      if (this.roomClearIntroCinematicSlowMoActive()) {
        simDt *= ROOM_CLEAR_CINE_SLOW_SIM_SCALE
      }

      this.player.update(
        simDt,
        move,
        (x, z) =>
          this.roomSystem.getNavGridBounds(x, z, this.player.getGridNavContext()),
        (x, z) => this.roomSystem.getGridBoundsAt(x, z),
      )
      if (SHOW_PLAYER_NAV_DEBUG_HUD && this.navDebugHudEl) {
        const snap = this.player.getNavDebugSnapshot()
        this.navDebugHudEl.textContent = formatNavDebugHud(snap)
        if (
          snap.idleBlocked &&
          this.elapsedSec - this.lastNavIdleWarnSec >= 0.85
        ) {
          this.lastNavIdleWarnSec = this.elapsedSec
          console.warn('[player nav] IDLE BLOCKED — finger down but no segment', {
            ...snap,
          })
        }
      }
      this.player.getPosition(this.playerPos)
      this.player.getVelocity(this.velScratch)
      const yaw = this.player.getFacingYaw()
      const doorPlayer: DoorPlayerSample = {
        x: this.playerPos.x,
        z: this.playerPos.z,
        radius: this.player.radius,
        vz: this.velScratch.z,
        facingX: -Math.sin(yaw),
        facingZ: -Math.cos(yaw),
      }
      this.doorUnlock.update(dt, this.elapsedSec, doorPlayer)
      this.itemWorld.updateClutterGateReveal(this.doorUnlock)
      this.roomLockCovers.update()

      this.itemWorld.updateVisuals(this.elapsedSec, dt)

      const trailIntensity =
        weight >= 0.72 ? (weight - 0.72) / (1 - 0.72) : 0
      this.playerTrail.update(
        this.playerPos.x,
        this.playerPos.z,
        0.02,
        trailIntensity,
        dt,
      )

      const hadPowerHud = this.powerModeRemain > 0
      this.powerModeRemain = Math.max(0, this.powerModeRemain - simDt)
      if (hadPowerHud && this.powerModeRemain <= 0) {
        this.gameViewport.classList.remove('game-viewport--power-mode')
      }

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
      for (const { item, pickupX, pickupZ } of collected) {
        if (item.type === 'power_pellet') {
          this.activatePowerMode()
        }
        if (item.type === 'wisp' && item.spawnRoomId) {
          this.roomCleanliness.registerGridWispCollected(item.spawnRoomId)
          this.runStatWispsCollected += 1
          const prevCollected =
            this.wispsCollectedPerRoom.get(item.spawnRoomId) ?? 0
          const collectedAfter = prevCollected + 1
          this.wispsCollectedPerRoom.set(item.spawnRoomId, collectedAfter)
          const totalWispsInRoom =
            this.gridWispTotalsPerRoom.get(item.spawnRoomId) ?? 0
          if (!this.bossRoom.isFightActive()) {
            const ghostFromThisRoom =
              roomPre !== null && item.spawnRoomId === roomPre
            if (
              ghostFromThisRoom &&
              totalWispsInRoom > 0 &&
              this.ghostSystem.getActiveGhostCount() < MAX_ACTIVE_GHOSTS &&
              this.runRandom() <
                wispCollectGhostSpawnProbability(
                  collectedAfter,
                  totalWispsInRoom,
                  this.runUpgrades.hauntedChanceBonus,
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
                  const roomIndex = this.roomChainIndexFromId(item.spawnRoomId)
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
            }
          }
        }
        if (item.type === 'wisp') {
          spawnFloatingHudText(this.gameViewport, '+1', 'float-hud--pickup')
        }
        if (
          item.type === 'wisp' ||
          item.type === 'relic' ||
          item.type === 'gem'
        ) {
          playJuiceSound('pickup')
        }
      }
      pickupsThisFrame = collected.length

      if (this.powerModeRemain > 0) {
        this.gameViewport.classList.add('game-viewport--power-mode')
      }
      this.cameraRig.setPowerModeActive(this.powerModeRemain > 0)

      this.ghostSystem.update(
        simDt,
        dt,
        this.playerPos,
        this.stack.hasRelic(),
        this.isInteractionCinematicBlocking(),
        this.powerModeRemain > 0,
      )

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
          )
          playJuiceSound('ghost_eat', { pitch: 1.08 })
          spawnFloatingHudText(
            this.gameViewport,
            'Gotcha!',
            'float-hud--pickup',
            { topPct: 28, leftPct: 50, durationSec: 0.85 },
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
        this.triggerGhostHitFlash(210, true)
        this.triggerDepositScreenShake(false)
        this.ghostHitPickupLockRemain = GHOST_HIT_PICKUP_LOCK_SEC

        /** Ghost hits cost a life only — stack is preserved (no dropped pickups). */
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
        playJuiceSound('ghost_hit')
        this.ghostSystem.onGhostHitLandedAt(
          hit.ghostX,
          hit.ghostZ,
          this.playerPos,
        )

        this.lives = Math.max(0, this.lives - 1)
        spawnLifeLostImpact(this.gameViewport)
        this.triggerDepositScreenShake(true)
        this.syncLivesHud()
        if (this.lives <= 0) {
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
      updateGhostHitBursts(this.burstParticles, dt)

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
      this.depositController.update(dt)
      this.depositFeedback.setPlayerInside(false)
      this.depositFeedback.update(dt)
      this.specialRelicSpawns.update(dt)
      this.relicFootArrow.setTarget(
        this.playerPos,
        this.specialRelicSpawns.getActiveRelicXZ(),
      )

      if (this.bossVictoryOutroRemain !== null) {
        this.bossVictoryOutroRemain -= dt
        if (this.bossVictoryOutroRemain <= 0) {
          this.bossVictoryOutroRemain = null
          this.gameOver = true
          this.openBossRunSuccessOverlay()
        }
      }

      this.renderer.render(scene, this.camera)
      this.perf.endFrame(this.renderer.info.render.calls, pickupsThisFrame)
    }

    this.raf = requestAnimationFrame(tick)
  }

  private activatePowerMode(): void {
    this.powerModeRemain =
      POWER_MODE_DURATION_MIN_SEC +
      this.runRandom() *
        (POWER_MODE_DURATION_MAX_SEC - POWER_MODE_DURATION_MIN_SEC)
    this.gameViewport.classList.add('game-viewport--power-mode')
    playJuiceSound('power_pickup')
    spawnFloatingHudText(
      this.gameViewport,
      'POWER MODE!',
      'float-hud--level-up',
      { topPct: 22, leftPct: 50, durationSec: 1.15 },
    )
  }

  private syncRoomPickupAccessibilityFromDoors(): void {
    this.itemWorld.updateClutterGateReveal(this.doorUnlock)
    this.itemWorld.updateGridWispRoomVisibility(this.roomSystem)
  }

  private syncCameraModeHud(): void {
    const el = this.hudCameraHintEl
    if (!el) return
    const mode = this.cameraRig.getMode()
    el.textContent = mode === 'over_shoulder' ? 'C · near' : 'C · far'
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
    this.wispsCollectedPerRoom.clear()
    this.runStatUpgradesPicked.length = 0
    this.roomUpgradePendingReveal = null
    this.powerModeRemain = 0
    this.gameViewport.classList.remove('game-viewport--power-mode')
    this.cameraRig.setPowerModeActive(false)
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

  private completeRoomClearAfterChoice(
    roomId: RoomId,
    doorIndex: number | null,
    roomIndex: number,
    res: ApplyRunUpgradeResult,
  ): void {
    this.runStatRoomsCleared += 1
    spawnRoomClearedBanner(this.gameViewport, res.bannerSubtitle)
    this.roomClearFloorDisposers.push(
      spawnRoomClearedFloorLabel(this.scene, roomId, res.bannerSubtitle),
    )
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
    }
  }

  private completeBossRunVictory(): void {
    if (this.gameOver || this.bossVictoryOutroRemain !== null) return
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

  private openBossRunSuccessOverlay(): void {
    this.runSuccessCleanup = showRunSuccessOverlay(
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
        onContinue: () => {
          this.runSuccessCleanup?.()
          this.runSuccessCleanup = null
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

  /** Boss intro or post-boss outro — block movement and pickups. */
  private isInteractionCinematicBlocking(): boolean {
    return (
      this.roomClearIntroCinematicRunning ||
      this.roomClearDoorCinematicRunning ||
      this.bossIntroCinematicRunning ||
      this.bossVictoryOutroRemain !== null
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
        playJuiceSound('relic_collect', { pitch: 1.12 })
        spawnFloatingHudText(
          this.gameViewport,
          'Unlocked',
          'float-hud--level-up',
          { topPct: 38, leftPct: 50, durationSec: 1.85 },
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

    const trackable =
      roomId !== null &&
      roomId !== 'SAFE_CENTER' &&
      roomId.startsWith('ROOM_')

    if (!trackable) {
      wrap.classList.add('hud-room-clean--inactive')
      titleEl.textContent =
        roomId === 'SAFE_CENTER' ? 'Safe zone' : 'Room'
      pctEl.textContent = '—'
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
    if (this.roomCleanliness.isRoomCleared(roomId)) {
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
    if (this.depositShakeTimer) {
      clearTimeout(this.depositShakeTimer)
      this.depositShakeTimer = null
    }
    this.gameViewport.classList.remove(
      'game-viewport--shake',
      'game-viewport--shake-hard',
    )
    void this.gameViewport.offsetWidth
    this.gameViewport.classList.add(
      overload ? 'game-viewport--shake-hard' : 'game-viewport--shake',
    )
    this.depositShakeTimer = setTimeout(() => {
      this.gameViewport.classList.remove(
        'game-viewport--shake',
        'game-viewport--shake-hard',
      )
      this.depositShakeTimer = null
    }, 280)
  }

  /** Spike trap: always −1 life (no stack loss); mesh has no physics collider — overlap only. */
  private applyTrapLifeLoss(): void {
    this.lives = Math.max(0, this.lives - 1)
    spawnLifeLostImpact(this.gameViewport)
    this.triggerDepositScreenShake(true)
    this.syncLivesHud()
    if (this.lives <= 0) {
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

    const ang = this.runRandom() * Math.PI * 2
    this.player.applyGhostKnockback(
      this.playerPos.x - Math.cos(ang) * 0.02,
      this.playerPos.z - Math.sin(ang) * 0.02,
      this.playerPos.x,
      this.playerPos.z,
      0.45,
    )
    playJuiceSound('ghost_hit')
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

  private runDepositPresentationUi(
    items: GameItem[],
    ev: DepositEval,
    _ol: DepositPresentationOverload,
  ): void {
    const relicItem = items.find((it) => it.type === 'relic')
    if (relicItem) {
      this.player.getPosition(this.playerPos)
      this.burstSpawnScratch.copy(this.playerPos)
      this.burstSpawnScratch.y += 0.42
      this.burstParticles.push(
        ...spawnRelicCollectBurst(this.burstGroup, this.burstSpawnScratch),
      )
      showRelicBankedCelebration(this.gameViewport, relicItem.value)
      spawnRelicScreenSparkBurst(this.gameViewport)
      playJuiceSound('relic_collect')
    }

    this.depositFeedback.triggerDepositComplete(items.length, ev.batchTotal)
    const hudDepositToast = this.hudDepositToastEl
    const depositAmountEl = this.depositToastAmountEl
    const depositHintEl = this.depositToastHintEl
    if (hudDepositToast && depositAmountEl && depositHintEl) {
      const showDepositToast = (): void => {
        if (this.depositToastTimer) clearTimeout(this.depositToastTimer)
        this.fillDepositToastLines(depositAmountEl, depositHintEl, ev)
        hudDepositToast.classList.remove('hidden')
        hudDepositToast.classList.add('visible')
        this.depositToastTimer = setTimeout(() => {
          hudDepositToast.classList.remove('visible')
          hudDepositToast.classList.add('hidden')
          this.depositToastTimer = null
        }, DEPOSIT_TOAST_MS)
      }
      if (relicItem) {
        window.setTimeout(showDepositToast, 920)
      } else {
        showDepositToast()
      }
    }
  }

  private fillDepositToastLines(
    amountEl: HTMLElement,
    hintEl: HTMLElement,
    ev: DepositEval,
  ): void {
    const stackJackpot =
      ev.itemCount >= 2 && ev.batchMultiplier >= 1.18
    amountEl.classList.remove(
      'deposit-amount--overload',
      'deposit-amount--overload-perfect',
      'deposit-amount--stack-jackpot',
    )
    amountEl.textContent = ev.batchTotal > 0 ? `+${ev.batchTotal}` : '0'
    if (stackJackpot) amountEl.classList.add('deposit-amount--stack-jackpot')

    const riskLine =
      ev.batchMultiplier > 1.02
        ? `Stack bonus ×${ev.batchMultiplier.toFixed(2)} (base ${ev.baseSum})`
        : ''

    if (riskLine) {
      hintEl.style.display = 'block'
      hintEl.textContent = `${riskLine} — bigger stacks clear harder`
      return
    }
    hintEl.textContent = ''
    hintEl.style.display = 'none'
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

  /** Encumbrance ∈ [0, 1] — scales with items carried (no hard cap). */
  getStackWeight(): number {
    return computeCarryEncumbranceWeight(this.stack.count)
  }

  /** Double door swing progress 0…1 (for UI / debugging). */
  getDoorOpenProgress(doorIndex: number): number {
    return this.doorUnlock.getDoorOpenProgress(doorIndex)
  }

  dispose(): void {
    this.runFailedCleanup?.()
    this.runFailedCleanup = null
    this.runSuccessCleanup?.()
    this.runSuccessCleanup = null
    cancelAnimationFrame(this.raf)
    if (this.depositShakeTimer) {
      clearTimeout(this.depositShakeTimer)
      this.depositShakeTimer = null
    }
    if (this.depositToastTimer) clearTimeout(this.depositToastTimer)
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
    this.playerTrail.dispose()
    this.ghostSystem.dispose()
    disposeSharedGhostVisionConeGeometry()
    disposeGhostGltfTemplate(this.ghostGltfTemplate)
    this.stackVisual.dispose()
    this.playerCharacter.dispose()
    disposePlayerGltfTemplate(this.playerGltfTemplate)
    disposeGhostSharedGeometry()
    window.removeEventListener('keydown', this.onCameraModeKey)
    this.keyboardMove.dispose()
    this.joystick.dispose()
    this.unsubscribeResize()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
