import type { PerspectiveCamera } from 'three'
import type { Scene } from 'three'
import type { WebGLRenderer } from 'three'
import { Group, Mesh, Vector3 } from 'three'
import { CameraRig } from '../systems/camera/CameraRig.ts'
import { CollectionSystem } from '../systems/collection/CollectionSystem.ts'
import {
  DepositController,
  type DepositPresentationOverload,
} from '../systems/deposit/DepositController.ts'
import { DepositFlightAnimator } from '../systems/deposit/DepositFlightAnimator.ts'
import { DepositZoneFeedback } from '../systems/deposit/DepositZoneFeedback.ts'
import { Economy } from '../systems/economy/Economy.ts'
import {
  evaluateDeposit,
  type DepositEval,
} from '../systems/economy/depositEvaluation.ts'
import {
  KeyboardMoveInput,
  mergeMoveInput,
} from '../systems/input/KeyboardMoveInput.ts'
import { TouchJoystick } from '../systems/input/TouchJoystick.ts'
import { ItemWorld } from '../systems/items/ItemWorld.ts'
import {
  instantiatePrefilledClutter,
  precomputeAllClutterPlacements,
} from '../systems/clutter/clutterPrefill.ts'
import { RoomWispSpawnSystem } from '../systems/wisp/RoomWispSpawnSystem.ts'
import { SpecialRelicSpawnSystem } from '../systems/wisp/SpecialRelicSpawnSystem.ts'
import type { PlayerCharacterVisual } from '../systems/player/PlayerCharacterVisual.ts'
import { PlayerController } from '../systems/player/PlayerController.ts'
import { createSpecialRelicFootArrow } from '../systems/player/SpecialRelicFootArrow.ts'
import { createCamera } from '../systems/scene/createCamera.ts'
import { createRenderer } from '../systems/scene/createRenderer.ts'
import { createScene } from '../systems/scene/SceneSetup.ts'
import type { HubTitleFloorLabelHandle } from '../systems/scene/hubTitleFloorLabel.ts'
import { spawnRoomClearedFloorLabel } from '../systems/scene/roomClearedFloorLabel.ts'
import { subscribeViewportResize } from '../systems/scene/resize.ts'
import { CarryStack } from '../systems/stack/CarryStack.ts'
import { disposeCarryBagClone } from '../systems/stack/bagGltfAsset.ts'
import { StackVisual } from '../systems/stack/StackVisual.ts'
import {
  createClutterItem,
  createRelicItem,
  createWispItem,
} from '../themes/wisp/itemFactory.ts'
import type { GameItem } from './types/GameItem.ts'
import { INITIAL_STACK_CAPACITY } from '../systems/upgrades/upgradeConfig.ts'
import { applyUpgradeForRoomClear } from '../systems/upgrades/roomClearUpgrade.ts'
import {
  GHOST_COLLISION_RADIUS,
  GHOST_HIT_INVULN_SEC,
  GHOST_HIT_LOSS_MAX,
  GHOST_HIT_LOSS_MIN,
  GHOST_HIT_PICKUP_LOCK_SEC,
  GHOST_HIT_VACUUM_DISABLE_SEC,
  DEFAULT_GHOST_SPAWNS,
  ghostRoomVisualMul,
  HAUNTED_PICKUP_GHOST_CHANCE,
  MAX_ACTIVE_GHOSTS,
  pickGhostColorForRoomIndex,
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
import { GhostSystem } from '../systems/ghost/GhostSystem.ts'
import type { AreaId } from '../systems/world/RoomSystem.ts'
import { RoomSystem } from '../systems/world/RoomSystem.ts'
import { getDoorBlockerZ, roomIndexFromId } from '../systems/doors/doorLayout.ts'
import {
  GATE_CINE_APPROACH_GATE_SEC,
  GATE_CINE_GHOST_FADE_SEC,
  GATE_CINE_HOLD_AFTER_OPEN_SEC,
  GATE_CINE_RETURN_TO_PLAYER_SEC,
  GATE_CINE_SLOW_MO_SEC,
  GATE_CINE_SLOW_SIM_SCALE,
  GATE_CINE_ZOOM_OUT_SEC,
  GATE_OPEN_TOTAL_SEC,
} from '../systems/doors/doorUnlockConfig.ts'
import { RoomCleanlinessSystem } from '../systems/world/RoomCleanlinessSystem.ts'
import type { RoomId } from '../systems/world/mansionRoomData.ts'
import { WorldCollision } from '../systems/world/WorldCollision.ts'
import {
  DEPOSIT_ARC_EASE,
  GHOST_HIT_SLOW_MO_SCALE,
  GHOST_HIT_SLOW_MO_SEC,
  loadSavedCameraMode,
  PLAYER_MAX_LIVES,
  saveCameraMode,
  STACK_DROP_RECOVERY_TTL_SEC,
  STACK_DROP_SCATTER_RADIUS,
  type CameraMode,
} from '../juice/juiceConfig.ts'
import {
  showGameOverOverlay,
  spawnLifeLostImpact,
} from '../juice/lifeHudJuice.ts'
import {
  spawnBagDisposeBurst,
  spawnBagLandImpact,
} from '../juice/bagDisposeVfx.ts'
import { PlayerMotionTrail } from '../juice/playerMotionTrail.ts'
import {
  OVERLOAD_BONUS_MULT,
  OVERLOAD_STACK_THRESHOLD,
  PERFECT_OVERLOAD_BONUS_MULT,
} from '../systems/overload/overloadDropConfig.ts'
import { MoneyHud } from '../juice/MoneyHud.ts'
import {
  spawnBagFullBanner,
  spawnFloatingHudText,
  spawnRoomClearedBanner,
} from '../juice/floatingHud.ts'
import { playJuiceSound } from '../juice/juiceSound.ts'
import { spawnGhostHitDroppedItems } from '../juice/ghostHitBagBurst.ts'
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
import { DoorUnlockSystem } from '../systems/doors/DoorUnlockSystem.ts'
import { RoomLockCoverSystem } from '../systems/world/RoomLockCoverSystem.ts'
import {
  computeStackWeight,
  stackWeightDragMultiplier,
  stackWeightSpeedMultiplier,
} from '../systems/stack/stackWeightConfig.ts'
import { TrapFieldSystem } from '../systems/traps/TrapFieldSystem.ts'
import { TrashPortalSystem } from '../systems/trash/TrashPortalSystem.ts'
import {
  TRASH_PORTAL_COMBO_MAX,
  TRASH_PORTAL_COMBO_PER_CHAIN,
} from '../systems/trash/trashPortalConfig.ts'

const DEPOSIT_TOAST_MS = 2800
const BAG_THROW_SEC = 0.78

function roomCleanHudLabel(roomId: RoomId): string {
  if (roomId === 'SAFE_CENTER') return 'Safe'
  const m = /^ROOM_(\d+)$/.exec(roomId)
  return m ? `Room ${m[1]}` : roomId
}

function upgradeLevelUpBanner(kind: 'capacity' | 'speed', newLevel: number): string {
  switch (kind) {
    case 'capacity':
      return `Stack capacity — level ${newLevel}!`
    case 'speed':
      return `Speed — level ${newLevel}!`
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export class Game {
  private readonly roomSystem = new RoomSystem()
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
  private readonly economy: Economy
  private readonly depositFeedback: DepositZoneFeedback
  private readonly playerCharacter: PlayerCharacterVisual
  private readonly doorUnlock: DoorUnlockSystem
  private readonly roomLockCovers: RoomLockCoverSystem
  private readonly roomCleanliness: RoomCleanlinessSystem
  private readonly roomWispSpawns: RoomWispSpawnSystem
  private readonly specialRelicSpawns: SpecialRelicSpawnSystem
  private readonly relicFootArrow: ReturnType<typeof createSpecialRelicFootArrow>
  /** Room-clear progression (formerly hub pad levels). */
  private capacityUpgradeLevel = 0
  private speedUpgradeLevel = 0
  private readonly ghostSystem: GhostSystem
  private readonly ghostGltfTemplate: GhostGltfTemplate | null
  private readonly playerGltfTemplate: PlayerGltfTemplate | null
  private readonly hubTitleFloorLabel: HubTitleFloorLabelHandle
  /** World floor decals for cleared rooms (dispose on `Game.dispose`). */
  private readonly roomClearFloorDisposers: (() => void)[] = []
  private readonly burstGroup: Group
  private readonly burstParticles: GhostHitBurstParticle[] = []
  private readonly burstSpawnScratch = new Vector3()
  private ghostHitInvuln = 0
  /** Brief lock on walking pickups after a hit (burst scatter reads first). */
  private ghostHitPickupLockRemain = 0
  /** Real-time seconds; magnet pull off briefly after a ghost hit. */
  private ghostVacuumDisabledRemain = 0
  private ghostDamageArmed = true
  private hitFlashEl: HTMLElement | null = null
  private hitFlashTimer: ReturnType<typeof setTimeout> | null = null
  private depositToastTimer: ReturnType<typeof setTimeout> | null = null
  private overloadHudTimer: ReturnType<typeof setTimeout> | null = null
  private overloadSession: { active: boolean; perfect: boolean } | null = null
  private raf = 0
  private lastTime = performance.now()
  private elapsedSec = 0
  private hudSpawn: HTMLElement | null = null
  private readonly moneyHud: MoneyHud | null
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
  private readonly hudMoneyEl: HTMLElement | null
  private readonly hudDepositToastEl: HTMLElement | null
  private readonly depositToastAmountEl: HTMLElement | null
  private readonly depositToastHintEl: HTMLElement | null
  private readonly hudOverloadEl: HTMLElement | null
  private readonly hudOverloadAmountEl: HTMLElement | null
  private readonly hudDisposeBagBtn: HTMLButtonElement | null
  private readonly hudCameraHintEl: HTMLElement | null
  private readonly hudLivesWrap: HTMLElement | null
  private lives = PLAYER_MAX_LIVES
  private gameOver = false
  private readonly trapField: TrapFieldSystem
  private readonly trashPortals: TrashPortalSystem
  private readonly playerTrail: PlayerMotionTrail
  private ghostHitSlowMoRemain = 0
  private hudStackHum: HTMLElement | null = null
  private depositShakeTimer: ReturnType<typeof setTimeout> | null = null
  /** Edge-detect carry stack full (max slots) for one-shot HUD celebration. */
  private wasAtMaxCapacity = false
  private bagDisposeInFlight = false
  private bagThrow: {
    bag: Group
    t: number
    dur: number
    start: Vector3
    end: Vector3
    mid: Vector3
    scale0: Vector3
    snapshot: GameItem[]
    overload: { active: boolean; perfect: boolean }
  } | null = null
  /** Hide north welcome banner after first exit from the safe hub room. */
  private hubWelcomeHidden = false
  private wasInSafeRoom = true

  /** Gate-opening cinematic: zoom out → gate lowers → hold → return to follow cam. */
  private gateCinematicRunning = false
  private gateCinematicElapsed = 0
  private gateCinematicDoorIndex = 0
  private readonly gateCineStartPos = new Vector3()
  private readonly gateCinePullBackPos = new Vector3()
  private readonly gateCineGateViewPos = new Vector3()
  private readonly gateCineLookAt = new Vector3()
  private readonly gateCineLookBlend = new Vector3()
  private readonly gateCinePlayerLook = new Vector3()
  private readonly gateCineRigDesired = new Vector3()
  private gateCinematicDoorOpened = false

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
  ) {
    this.playerGltfTemplate = playerGltfTemplate
    this.gameViewport =
      host.querySelector<HTMLElement>('#game-viewport') ?? host
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
    this.burstGroup = new Group()
    this.burstGroup.name = 'ghostHitBurst'
    this.burstGroup.renderOrder = 50
    this.scene.add(this.burstGroup)

    const hudMoney = host.querySelector<HTMLElement>('#hud-money')
    const hudCarry = host.querySelector<HTMLElement>('#hud-carry')
    const hudDepositToast = host.querySelector<HTMLElement>(
      '#hud-deposit-toast',
    )
    const depositAmountEl =
      hudDepositToast?.querySelector<HTMLElement>('.deposit-amount') ?? null
    const depositHintEl =
      hudDepositToast?.querySelector<HTMLElement>('.deposit-hint') ?? null
    const hudOverload = host.querySelector<HTMLElement>('#hud-overload')
    const hudOverloadAmount =
      hudOverload?.querySelector<HTMLElement>('.hud-overload-amount') ?? null
    this.hudSpawn = host.querySelector('#hud-spawn')
    this.hudRoomCleanWrap = host.querySelector('#hud-room-clean')
    this.hudRoomCleanFill = host.querySelector('#hud-room-clean-fill')
    this.hudRoomCleanPct = host.querySelector('#hud-room-clean-pct')
    this.hudRoomCleanTitle = host.querySelector('#hud-room-clean-title')
    this.hudMoneyEl = hudMoney
    this.hudDepositToastEl = hudDepositToast
    this.depositToastAmountEl = depositAmountEl
    this.depositToastHintEl = depositHintEl
    this.hudOverloadEl = hudOverload
    this.hudOverloadAmountEl = hudOverloadAmount
    this.hudDisposeBagBtn = host.querySelector<HTMLButtonElement>(
      '#hud-dispose-bag',
    )
    this.hudCameraHintEl = host.querySelector<HTMLElement>('#hud-camera-hint')
    this.hudLivesWrap = host.querySelector<HTMLElement>('#hud-lives')
    this.hudStackHum = host.querySelector('#hud-stack-hum')

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
    this.player = new PlayerController(playerRoot, this.worldCollision)
    this.playerCharacter = playerCharacter
    const savedCam = loadSavedCameraMode()
    this.cameraRig = new CameraRig(
      this.camera,
      playerRoot,
      () => computeStackWeight(this.stack.count, this.stack.maxCapacity),
      {
        worldCollision: this.worldCollision,
        getFacingYaw: () => this.player.getFacingYaw(),
        initialMode: savedCam ?? 'top_down',
      },
    )
    window.addEventListener('keydown', this.onCameraModeKey)
    this.syncCameraModeHud()
    this.syncLivesHud()

    this.economy = new Economy()
    this.moneyHud = hudMoney
      ? new MoneyHud(hudMoney, () => this.economy.money)
      : null
    this.moneyHud?.sync()

    this.stackVisual = new StackVisual(stackAnchor)
    this.stack = new CarryStack(INITIAL_STACK_CAPACITY, () => {
      this.stackVisual.sync(this.stack.getSnapshot(), this.stack.maxCapacity)
      if (hudCarry) {
        hudCarry.textContent = `${this.stack.count} / ${this.stack.maxCapacity}`
      }
    })
    if (hudCarry) {
      hudCarry.textContent = `0 / ${INITIAL_STACK_CAPACITY}`
    }
    this.stackVisual.sync(this.stack.getSnapshot(), this.stack.maxCapacity)

    this.itemWorld = new ItemWorld(pickupGroup, scene)
    this.itemWorld.prewarmWispPool(8)
    this.itemWorld.prewarmClutterPool(3)

    this.doorUnlock = new DoorUnlockSystem({
      scene: this.scene,
      worldCollision: this.worldCollision,
      onDoorPassageCleared: () => {
        this.syncClutterRoomAccessibilityFromDoors()
      },
    })

    this.roomSystem.configureRoomAccess((roomId) =>
      this.doorUnlock.canAccessRoomForSpawning(roomId),
    )

    this.roomLockCovers = new RoomLockCoverSystem(
      this.scene,
      this.roomSystem,
      this.doorUnlock,
    )

    this.trashPortals = new TrashPortalSystem(this.roomSystem)

    this.trapField = new TrapFieldSystem(this.scene, this.roomSystem, Math.random)
    this.playerTrail = new PlayerMotionTrail(this.scene)

    this.roomWispSpawns = new RoomWispSpawnSystem({
      itemWorld: this.itemWorld,
      roomSystem: this.roomSystem,
      worldCollision: this.worldCollision,
      createWisp: () => this.createRoomWisp(),
      canSpawnInRoom: (id) => this.doorUnlock.canAccessRoomForSpawning(id),
    })
    const clutterPlacements = precomputeAllClutterPlacements(
      this.roomSystem,
      this.worldCollision,
      Math.random,
    )
    instantiatePrefilledClutter(
      clutterPlacements,
      this.itemWorld,
      (variant, value, spawnRoomId, haunted, stableId) =>
        createClutterItem(variant, value, spawnRoomId, haunted, stableId),
      (roomId) => this.roomSystem.isRoomAccessibleForGameplay(roomId),
    )
    this.specialRelicSpawns = new SpecialRelicSpawnSystem({
      itemWorld: this.itemWorld,
      roomSystem: this.roomSystem,
      worldCollision: this.worldCollision,
      createRelic: () => createRelicItem(),
      onSpawn: () => {
        playJuiceSound('relic_spawn')
      },
      canSpawnInRoom: (id) => this.doorUnlock.canAccessRoomForSpawning(id),
    })
    this.relicFootArrow = createSpecialRelicFootArrow()
    this.scene.add(this.relicFootArrow.root)
    this.ghostGltfTemplate = ghostGltfTemplate
    this.ghostSystem = new GhostSystem(
      ghostGroup,
      this.worldCollision,
      DEFAULT_GHOST_SPAWNS,
      ghostGltfTemplate,
    )

    this.roomCleanliness = new RoomCleanlinessSystem({
      onRoomCleared: (roomId, doorIndex) => {
        const idx = roomIndexFromId(roomId)
        if (idx !== null && idx >= 1) {
          const levels = {
            capacityLevel: this.capacityUpgradeLevel,
            speedLevel: this.speedUpgradeLevel,
          }
          const up = applyUpgradeForRoomClear(
            idx,
            this.stack,
            this.player,
            levels,
          )
          this.capacityUpgradeLevel = levels.capacityLevel
          this.speedUpgradeLevel = levels.speedLevel
          const bannerKind =
            up?.kind ?? (idx % 2 === 1 ? 'capacity' : 'speed')
          spawnRoomClearedBanner(this.gameViewport, bannerKind)
          this.roomClearFloorDisposers.push(
            spawnRoomClearedFloorLabel(this.scene, roomId, bannerKind),
          )
          if (up) {
            spawnFloatingHudText(
              this.gameViewport,
              upgradeLevelUpBanner(up.kind, up.newLevel),
              'float-hud--level-up',
              { topPct: 26, leftPct: 50, durationSec: 2.4 },
            )
          }
          if (doorIndex !== null) {
            this.ghostSystem.beginGateClearFadeForRoom(
              idx,
              GATE_CINE_GHOST_FADE_SEC,
            )
            this.beginGateOpeningCinematic(doorIndex)
          } else {
            this.ghostSystem.purgeGhostsForRoom(idx)
          }
        }
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
      economy: this.economy,
      flight: this.depositFlight,
      resolveDepositZone: () => null,
      evaluateOverload: (snapshot) => {
        const largeStack = snapshot.length >= OVERLOAD_STACK_THRESHOLD
        const perfect = snapshot.length >= this.stack.maxCapacity
        return { overload: largeStack, perfect }
      },
      onDepositSessionStart: (meta) => {
        this.overloadSession = { active: meta.overload, perfect: meta.perfect }
      },
      onDepositSessionEnd: () => {
        this.overloadSession = null
      },
      onItemDepositLanded: (item, flightIndex) => {
        this.trashPortals.pulsePortalItemLand(
          this.playerPos.x,
          this.playerPos.z,
        )
        if (this.overloadSession?.active) {
          this.depositFeedback.triggerOverloadItemImpact(
            this.overloadSession.perfect,
          )
          playJuiceSound('overload_impact')
          this.triggerDepositScreenShake(true)
        } else {
          const combo =
            flightIndex > 0
              ? Math.min(
                  TRASH_PORTAL_COMBO_MAX,
                  flightIndex * TRASH_PORTAL_COMBO_PER_CHAIN,
                )
              : 0
          if (combo > 0) {
            this.economy.addMoney(combo)
          }
          this.depositFeedback.triggerItem()
          spawnFloatingHudText(
            this.gameViewport,
            `+$${item.value + combo}`,
            'float-hud--coin',
            { topPct: 58 + Math.random() * 16, leftPct: 40 + Math.random() * 20 },
          )
          playJuiceSound('deposit_item', { pitch: 1 + flightIndex * 0.045 })
          this.triggerDepositScreenShake(false)
        }
      },
      onDepositPresentationComplete: (items, ev, ol) => {
        this.runDepositPresentationUi(items, ev, ol)
      },
    })

    this.hudDisposeBagBtn?.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.tryStartBagDispose()
    })
    this.hudDisposeBagBtn?.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
    })

    /** Precompile materials (scene). */
    this.scene.updateMatrixWorld(true)
    this.renderer.compile(this.scene, this.camera)

    this.player.getPosition(this.playerPos)

    const tick = (now: number) => {
      if (this.gameOver) return
      this.raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - this.lastTime) / 1000)
      this.lastTime = now
      this.elapsedSec += dt
      this.perf.beginFrame(now)

      let move = mergeMoveInput(
        this.joystick.getVector(),
        this.keyboardMove.getVector(),
      )
      if (this.gateCinematicRunning) {
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

      const inTrashPortal = this.trashPortals.isPlayerInTrashPortal(
        this.playerPos.x,
        this.playerPos.z,
      )

      this.doorUnlock.update(dt, this.elapsedSec)
      this.itemWorld.updateClutterGateReveal(this.doorUnlock)
      this.roomLockCovers.update()

      const roomPre = this.roomSystem.getRoomAt(this.playerPos.x, this.playerPos.z)
      this.syncRoomCleanHud(roomPre)
      const trapSlow = this.trapField.update(
        this.elapsedSec,
        this.playerPos.x,
        this.playerPos.z,
        this.player.radius,
        {
          onDamage: (frac) => {
            this.applyTrapDamageLoss(frac)
          },
        },
      )
      const weight = computeStackWeight(
        this.stack.count,
        this.stack.maxCapacity,
      )
      this.player.setMovementSlowMultiplier(
        stackWeightSpeedMultiplier(weight) * trapSlow,
      )
      this.player.setDragWeightMultiplier(stackWeightDragMultiplier(weight))
      this.syncStackJuiceHud(weight)

      let simDt =
        this.ghostHitSlowMoRemain > 0 ? dt * GHOST_HIT_SLOW_MO_SCALE : dt
      this.ghostHitSlowMoRemain = Math.max(0, this.ghostHitSlowMoRemain - dt)
      if (this.gateCinematicSlowMoActive()) {
        simDt *= GATE_CINE_SLOW_SIM_SCALE
      }

      this.player.update(simDt, move)
      this.trashPortals.applySuction(
        this.player.root,
        this.stack.count,
        simDt,
        (x, z, r) => this.worldCollision.resolveCircleXZ(x, z, r),
        this.player.radius,
      )
      this.player.getPosition(this.playerPos)

      this.trashPortals.update(
        dt,
        this.elapsedSec,
        this.playerPos.x,
        this.playerPos.z,
        this.stack.count,
      )

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

      this.ghostSystem.update(
        simDt,
        dt,
        this.playerPos,
        this.stack.hasRelic(),
        this.gateCinematicRunning,
      )

      this.ghostHitInvuln = Math.max(0, this.ghostHitInvuln - dt)
      this.ghostHitPickupLockRemain = Math.max(
        0,
        this.ghostHitPickupLockRemain - dt,
      )
      this.ghostVacuumDisabledRemain = Math.max(
        0,
        this.ghostVacuumDisabledRemain - dt,
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

      const hit = this.ghostSystem.tryHitPlayer(
        this.playerPos,
        this.player.radius,
        this.ghostHitInvuln > 0 ||
          !this.ghostDamageArmed ||
          this.gateCinematicRunning,
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
        this.ghostVacuumDisabledRemain = GHOST_HIT_VACUUM_DISABLE_SEC
        this.ghostHitPickupLockRemain = GHOST_HIT_PICKUP_LOCK_SEC

        const c = this.stack.count
        let toRemove = 0
        if (c > 0) {
          const frac =
            GHOST_HIT_LOSS_MIN +
            Math.random() * (GHOST_HIT_LOSS_MAX - GHOST_HIT_LOSS_MIN)
          const raw = Math.ceil(c * frac)
          toRemove = Math.min(c, Math.max(1, raw))
        }
        const lost =
          toRemove > 0 ? this.stack.popManyFromTop(toRemove) : []
        if (lost.length > 0) {
          spawnGhostHitDroppedItems(
            this.itemWorld,
            this.playerPos.x,
            this.playerPos.z,
            lost,
            STACK_DROP_RECOVERY_TTL_SEC,
          )
          this.stackVisual.triggerGhostHitReaction()
        }
        this.ghostHitSlowMoRemain = GHOST_HIT_SLOW_MO_SEC

        this.burstSpawnScratch.copy(this.playerPos)
        this.burstSpawnScratch.y += 0.38
        this.burstParticles.push(
          ...spawnGhostHitEctoplasmBurst(this.burstGroup, this.burstSpawnScratch),
          ...spawnGhostHitPelletBurst(
            this.burstGroup,
            this.burstSpawnScratch,
            lost,
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
          showGameOverOverlay(this.gameViewport, () => {
            location.reload()
          })
        }
      }
      updateGhostHitBursts(this.burstParticles, dt)

      const collected = this.collection.update(this.player, this.stack, this.itemWorld, dt, {
        pickupBlocked:
          this.ghostHitPickupLockRemain > 0 ||
          this.bagDisposeInFlight ||
          this.gateCinematicRunning,
        magnetBlocked: this.ghostVacuumDisabledRemain > 0,
      })
      for (const { item, pickupX, pickupZ } of collected) {
        if (item.type === 'clutter') {
          this.roomCleanliness.registerClutterCollected(item)
        }
        if (item.type === 'clutter' && item.haunted) {
          this.specialRelicSpawns.trySpawnRelicFromHauntedClutter(
            item.spawnRoomId,
          )
          if (
            this.ghostSystem.getActiveGhostCount() < MAX_ACTIVE_GHOSTS &&
            Math.random() < HAUNTED_PICKUP_GHOST_CHANCE
          ) {
            const spawn = this.resolveGhostSpawnFromHauntedClutter(
              pickupX,
              pickupZ,
              item.spawnRoomId,
            )
            this.ghostSystem.spawnGhost({
              x: spawn.x,
              z: spawn.z,
              roomIndex: spawn.roomIndex,
              color: pickGhostColorForRoomIndex(spawn.roomIndex, Math.random),
            })
          }
          continue
        }
        if (item.type === 'wisp' || item.type === 'clutter') {
          spawnFloatingHudText(this.gameViewport, '+1', 'float-hud--pickup')
        }
        if (
          item.type === 'wisp' ||
          item.type === 'clutter' ||
          item.type === 'relic' ||
          item.type === 'gem'
        ) {
          playJuiceSound('pickup')
        }
      }

      const maxCap = this.stack.maxCapacity
      const atMax = maxCap > 0 && this.stack.count >= maxCap
      if (this.hudDisposeBagBtn) {
        const show = atMax && !this.bagDisposeInFlight
        this.hudDisposeBagBtn.classList.toggle('hud-dispose-bag--visible', show)
        this.hudDisposeBagBtn.disabled = !show
      }
      if (atMax && !this.wasAtMaxCapacity) {
        spawnBagFullBanner(this.gameViewport)
        playJuiceSound('pickup')
      }
      this.wasAtMaxCapacity = atMax

      this.player.getVelocity(this.velScratch)
      this.playerCharacter.update(dt, {
        timeSec: this.elapsedSec,
        speed: this.player.getHorizontalSpeed(),
        velX: this.velScratch.x,
        itemsCarried: this.stack.count,
        maxCarry: this.stack.maxCapacity,
        powerMode: false,
        ghostInvuln: this.ghostHitInvuln > 0,
        recentPickupSec: 0,
      })
      if (this.gateCinematicRunning) {
        this.updateGateOpeningCinematic(dt)
      } else {
        this.cameraRig.update(dt)
      }
      this.moneyHud?.update(dt)
      this.itemWorld.updateCollectEffects(dt)
      this.updateBagThrow(dt)
      this.stackVisual.update(dt)
      this.depositController.update(dt)
      this.depositFeedback.setPlayerInside(inTrashPortal)
      this.depositFeedback.update(dt)
      this.roomWispSpawns.update(dt, this.elapsedSec)
      this.specialRelicSpawns.update(dt)
      this.relicFootArrow.setTarget(
        this.playerPos,
        this.specialRelicSpawns.getActiveRelicXZ(),
      )

      this.renderer.render(scene, this.camera)
      this.perf.endFrame(this.renderer.info.render.calls, collected.length)
    }

    this.raf = requestAnimationFrame(tick)
  }

  private createRoomWisp(): GameItem {
    return createWispItem(
      0.44 + Math.random() * 0.14,
      4 + Math.floor(Math.random() * 12),
    )
  }

  private syncClutterRoomAccessibilityFromDoors(): void {
    this.itemWorld.updateClutterGateReveal(this.doorUnlock)
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

  private gateCinematicSlowMoActive(): boolean {
    if (!this.gateCinematicRunning) return false
    const e = this.gateCinematicElapsed
    const t0 = GATE_CINE_ZOOM_OUT_SEC
    const t1 = t0 + GATE_CINE_SLOW_MO_SEC
    return e >= t0 && e < t1
  }

  private beginGateOpeningCinematic(doorIndex: number): void {
    this.gateCinematicDoorIndex = doorIndex
    this.gateCinematicElapsed = 0
    this.gateCinematicRunning = true
    this.gateCinematicDoorOpened = false
    this.gateCineStartPos.copy(this.camera.position)
    this.player.getPosition(this.playerPos)
    const zDoor = getDoorBlockerZ(doorIndex)
    this.gateCineLookAt.set(0, 1.14, zDoor)

    let hdx = this.camera.position.x - this.playerPos.x
    let hdz = this.camera.position.z - this.playerPos.z
    const hlen = Math.hypot(hdx, hdz) || 1
    hdx /= hlen
    hdz /= hlen
    const pullDist = 4.35
    this.gateCinePullBackPos.set(
      this.camera.position.x + hdx * pullDist,
      this.camera.position.y + 1.05,
      this.camera.position.z + hdz * pullDist,
    )
    this.gateCineGateViewPos.set(0, 10.85, zDoor + 7.85)
  }

  private updateGateOpeningCinematic(dt: number): void {
    if (!this.gateCinematicRunning) return
    this.gateCinematicElapsed += dt
    const e = this.gateCinematicElapsed
    const zDoor = getDoorBlockerZ(this.gateCinematicDoorIndex)
    this.gateCineLookAt.set(0, 1.14, zDoor)

    const tZoom = GATE_CINE_ZOOM_OUT_SEC
    const tSlowEnd = tZoom + GATE_CINE_SLOW_MO_SEC
    const tApproachEnd = tSlowEnd + GATE_CINE_APPROACH_GATE_SEC
    const tGateAnimEnd = tApproachEnd + GATE_OPEN_TOTAL_SEC
    const tHoldEnd = tGateAnimEnd + GATE_CINE_HOLD_AFTER_OPEN_SEC
    const tEnd = tHoldEnd + GATE_CINE_RETURN_TO_PLAYER_SEC

    if (e >= tApproachEnd && !this.gateCinematicDoorOpened) {
      this.gateCinematicDoorOpened = true
      this.doorUnlock.openDoorFully(this.gateCinematicDoorIndex)
    }

    this.player.getPosition(this.playerPos)
    this.gateCinePlayerLook.set(this.playerPos.x, 1.12, this.playerPos.z)
    this.cameraRig.getDesiredCameraPosition(this.gateCineRigDesired)

    if (e < tZoom) {
      const u = easeInOutCubic(Math.min(1, e / tZoom))
      this.camera.position.lerpVectors(
        this.gateCineStartPos,
        this.gateCinePullBackPos,
        u,
      )
      this.gateCineLookBlend.lerpVectors(this.gateCinePlayerLook, this.gateCineLookAt, u)
      this.camera.lookAt(this.gateCineLookBlend)
    } else if (e < tSlowEnd) {
      this.camera.position.copy(this.gateCinePullBackPos)
      this.camera.lookAt(this.gateCineLookAt)
    } else if (e < tApproachEnd) {
      const u = easeInOutCubic(
        Math.min(1, (e - tSlowEnd) / GATE_CINE_APPROACH_GATE_SEC),
      )
      this.camera.position.lerpVectors(
        this.gateCinePullBackPos,
        this.gateCineGateViewPos,
        u,
      )
      this.camera.lookAt(this.gateCineLookAt)
    } else if (e < tHoldEnd) {
      this.camera.position.copy(this.gateCineGateViewPos)
      this.camera.lookAt(this.gateCineLookAt)
    } else if (e < tEnd) {
      const u = easeInOutCubic(
        Math.min(1, (e - tHoldEnd) / GATE_CINE_RETURN_TO_PLAYER_SEC),
      )
      this.camera.position.lerpVectors(
        this.gateCineGateViewPos,
        this.gateCineRigDesired,
        u,
      )
      this.gateCineLookBlend.lerpVectors(this.gateCineLookAt, this.gateCinePlayerLook, u)
      this.camera.lookAt(this.gateCineLookBlend)
    } else {
      this.camera.position.copy(this.gateCineRigDesired)
      this.camera.lookAt(this.gateCinePlayerLook)
      this.cameraRig.resetOtsLookBlend()
      this.gateCinematicRunning = false
      this.gateCinematicElapsed = 0
      this.gateCinematicDoorOpened = false
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
    titleEl.textContent = roomCleanHudLabel(roomId)
    const pct = this.roomCleanliness.getDisplayPercent(roomId)
    const rounded = Math.round(pct)
    pctEl.textContent = `${rounded}%`
    fill.style.transform = `scaleX(${Math.max(0, Math.min(1, pct / 100))})`
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
      const ang = Math.random() * Math.PI * 2
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
    const m: Record<string, number> = {
      ROOM_1: 1,
      ROOM_2: 2,
      ROOM_3: 3,
      ROOM_4: 4,
      ROOM_5: 5,
    }
    return m[roomId] ?? 1
  }

  private scatterDroppedItems(items: readonly GameItem[], radius: number): void {
    const px = this.playerPos.x
    const pz = this.playerPos.z
    for (const it of items) {
      const ang = Math.random() * Math.PI * 2
      const d = Math.random() * radius
      this.itemWorld.spawnRecoverable(
        it,
        px + Math.cos(ang) * d,
        pz + Math.sin(ang) * d,
        STACK_DROP_RECOVERY_TTL_SEC,
      )
    }
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

  private applyTrapDamageLoss(frac: number): void {
    const c = this.stack.count
    if (c <= 0) return
    const toRemove = Math.min(c, Math.ceil(c * frac))
    if (toRemove <= 0) return
    const lost = this.stack.popManyFromTop(toRemove)
    this.scatterDroppedItems(lost, STACK_DROP_SCATTER_RADIUS * 0.85)
    this.burstSpawnScratch.copy(this.playerPos)
    this.burstSpawnScratch.y += 0.35
    this.burstParticles.push(
      ...spawnGhostHitPelletBurst(
        this.burstGroup,
        this.burstSpawnScratch,
        lost,
      ),
    )
    const ang = Math.random() * Math.PI * 2
    this.player.applyGhostKnockback(
      this.playerPos.x - Math.cos(ang) * 0.02,
      this.playerPos.z - Math.sin(ang) * 0.02,
      this.playerPos.x,
      this.playerPos.z,
      0.45,
    )
    playJuiceSound('ghost_hit')
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
    ol: DepositPresentationOverload,
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

    if (ol.overloadActive) {
      this.depositFeedback.triggerOverloadBurst(ol.perfect)
    } else {
      this.depositFeedback.triggerDepositComplete(
        items.length,
        ev.credits + ol.overloadBonus,
      )
    }
    const totalPayout = ev.credits + ol.overloadBonus
    const hudMoney = this.hudMoneyEl
    if (hudMoney) {
      hudMoney.classList.remove('money-bump', 'money-bump-big')
      void hudMoney.offsetWidth
      const heavy =
        !ol.overloadActive && (items.length >= 7 || totalPayout >= 65)
      hudMoney.classList.add(heavy ? 'money-bump-big' : 'money-bump')
    }
    const hudOverload = this.hudOverloadEl
    const hudOverloadAmount = this.hudOverloadAmountEl
    if (hudOverload && hudOverloadAmount && ol.overloadActive) {
      if (this.overloadHudTimer) clearTimeout(this.overloadHudTimer)
      hudOverloadAmount.textContent = `+$${totalPayout}`
      hudOverload.classList.toggle('hud-overload--perfect', ol.perfect)
      hudOverload.classList.remove('hidden')
      hudOverload.classList.add('visible')
      this.overloadHudTimer = setTimeout(() => {
        hudOverload.classList.remove('visible', 'hud-overload--perfect')
        hudOverload.classList.add('hidden')
        this.overloadHudTimer = null
      }, 2400)
    }
    const hudDepositToast = this.hudDepositToastEl
    const depositAmountEl = this.depositToastAmountEl
    const depositHintEl = this.depositToastHintEl
    if (hudDepositToast && depositAmountEl && depositHintEl) {
      const showDepositToast = (): void => {
        if (this.depositToastTimer) clearTimeout(this.depositToastTimer)
        this.fillDepositToastLines(depositAmountEl, depositHintEl, ev, ol)
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

  private computeOverloadBonusForDispose(
    ev: DepositEval,
    active: boolean,
    perfect: boolean,
  ): number {
    if (!active) return 0
    let extra = Math.floor(ev.credits * (OVERLOAD_BONUS_MULT - 1))
    if (perfect) {
      extra = Math.floor(extra * PERFECT_OVERLOAD_BONUS_MULT)
    }
    return Math.max(0, extra)
  }

  private tryStartBagDispose(): void {
    if (this.bagThrow !== null || this.bagDisposeInFlight) return
    const maxCap = this.stack.maxCapacity
    if (this.stack.count < maxCap) return

    this.bagDisposeInFlight = true
    const snapshot = [...this.stack.getSnapshot()]
    const overload = {
      active: snapshot.length >= OVERLOAD_STACK_THRESHOLD,
      perfect: snapshot.length >= maxCap,
    }

    const bag = this.stackVisual.detachBagForThrow(this.scene)
    bag.updateMatrixWorld(true)
    const start = new Vector3()
    bag.getWorldPosition(start)

    const yaw = this.player.root.rotation.y
    const fx = -Math.sin(yaw)
    const fz = -Math.cos(yaw)

    const tossDist = 5.4
    const end = new Vector3(
      start.x + fx * tossDist,
      0.26,
      start.z + fz * tossDist,
    )
    const mid = new Vector3()
      .copy(start)
      .lerp(end, 0.5)
    mid.y += 2.1

    const scale0 = bag.scale.clone().multiplyScalar(1.32)

    this.burstSpawnScratch.copy(start)
    this.burstSpawnScratch.y += 0.2
    this.burstParticles.push(
      ...spawnBagDisposeBurst(this.burstGroup, this.burstSpawnScratch, 22, {
        intense: true,
      }),
    )
    playJuiceSound('deposit_complete', { pitch: 1.15 })
    this.gameViewport.classList.add('game-viewport--glow-ecto')

    this.bagThrow = {
      bag,
      t: 0,
      dur: BAG_THROW_SEC,
      start,
      end,
      mid,
      scale0,
      snapshot,
      overload,
    }
  }

  private updateBagThrow(dt: number): void {
    const bt = this.bagThrow
    if (!bt) return

    bt.t += dt
    const alpha = Math.min(1, bt.t / bt.dur)
    const ease = 1 - Math.pow(1 - alpha, DEPOSIT_ARC_EASE)
    const u = ease
    const omu = 1 - u
    const b = bt.bag
    const x =
      omu * omu * bt.start.x +
      2 * omu * u * bt.mid.x +
      u * u * bt.end.x
    const y =
      omu * omu * bt.start.y +
      2 * omu * u * bt.mid.y +
      u * u * bt.end.y
    const z =
      omu * omu * bt.start.z +
      2 * omu * u * bt.mid.z +
      u * u * bt.end.z
    b.position.set(x, y, z)

    const shrink = Math.max(0.38, Math.pow(1 - ease, 1.45))
    b.scale.set(
      bt.scale0.x * shrink,
      bt.scale0.y * shrink,
      bt.scale0.z * shrink,
    )

    if (alpha >= 1) {
      this.completeBagThrow()
    }
  }

  private completeBagThrow(): void {
    const bt = this.bagThrow
    if (!bt) return

    const snapshot = bt.snapshot
    const ov = bt.overload
    const endPos = bt.bag.position.clone()

    endPos.y += 0.08
    this.burstParticles.push(...spawnBagLandImpact(this.burstGroup, endPos))
    this.burstParticles.push(
      ...spawnBagDisposeBurst(this.burstGroup, endPos, 26, { intense: false }),
    )
    playJuiceSound('deposit_item', { pitch: 0.9 })
    this.triggerDepositScreenShake(
      snapshot.length >= OVERLOAD_STACK_THRESHOLD,
    )

    this.disposeThrownBagMesh(bt.bag)
    this.bagThrow = null

    const ev = evaluateDeposit(snapshot)
    const overloadBonus = this.computeOverloadBonusForDispose(
      ev,
      ov.active,
      ov.perfect,
    )
    this.economy.addMoney(ev.credits + overloadBonus)
    this.runDepositPresentationUi(snapshot, ev, {
      overloadActive: ov.active,
      perfect: ov.perfect,
      overloadBonus,
    })

    this.stack.drain()
    this.trashPortals.pulsePortalItemLand(this.playerPos.x, this.playerPos.z)

    this.bagDisposeInFlight = false
    this.gameViewport.classList.remove('game-viewport--glow-ecto')
  }

  private disposeThrownBagMesh(root: Group): void {
    root.removeFromParent()
    if (root.userData.carryBagGltf === true) {
      disposeCarryBagClone(root)
      return
    }
    root.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose()
        const m = o.material
        if (Array.isArray(m)) m.forEach((x) => x.dispose())
        else m.dispose()
      }
    })
  }

  private fillDepositToastLines(
    amountEl: HTMLElement,
    hintEl: HTMLElement,
    ev: DepositEval,
    overload?: DepositPresentationOverload,
  ): void {
    const total = ev.credits + (overload?.overloadBonus ?? 0)
    const stackJackpot =
      !overload?.overloadActive &&
      ev.itemCount >= 2 &&
      ev.batchMultiplier >= 1.18
    amountEl.classList.remove(
      'deposit-amount--overload',
      'deposit-amount--overload-perfect',
      'deposit-amount--stack-jackpot',
    )
    if (overload?.overloadActive) {
      amountEl.textContent = total > 0 ? `+$${total}` : '$0'
      amountEl.classList.add('deposit-amount--overload')
      if (overload.perfect) amountEl.classList.add('deposit-amount--overload-perfect')
    } else {
      amountEl.textContent = ev.credits > 0 ? `+$${ev.credits}` : '$0'
      if (stackJackpot) amountEl.classList.add('deposit-amount--stack-jackpot')
    }

    const riskLine =
      !overload?.overloadActive && ev.batchMultiplier > 1.02
        ? `Stack bonus ×${ev.batchMultiplier.toFixed(2)} (base $${ev.baseCredits})`
        : ''

    if (overload?.overloadActive) {
      hintEl.style.display = 'block'
      hintEl.textContent = overload.perfect
        ? 'Perfect overload — maximum burst'
        : 'Overload drop — bonus credits'
      return
    }
    if (riskLine) {
      hintEl.style.display = 'block'
      hintEl.textContent = `${riskLine} — bigger stacks pay more`
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

  /** Encumbrance ∈ [0, 1] — `count / maxCapacity` (for HUD / future UI). */
  getStackWeight(): number {
    return computeStackWeight(this.stack.count, this.stack.maxCapacity)
  }

  /** Gate sink progress 0…1 (for future door UI). */
  getDoorOpenProgress(doorIndex: number): number {
    return this.doorUnlock.getDoorOpenProgress(doorIndex)
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    if (this.depositShakeTimer) {
      clearTimeout(this.depositShakeTimer)
      this.depositShakeTimer = null
    }
    if (this.depositToastTimer) clearTimeout(this.depositToastTimer)
    if (this.overloadHudTimer) clearTimeout(this.overloadHudTimer)
    if (this.hitFlashTimer) {
      clearTimeout(this.hitFlashTimer)
      this.hitFlashTimer = null
    }
    this.hitFlashEl?.classList.remove(
      'hud-hit-flash--on',
      'hud-hit-flash--ghost',
    )
    this.gameViewport.classList.remove('game-viewport--ghost-invuln')
    disposeAllGhostHitBursts(this.burstParticles)
    this.burstGroup.removeFromParent()
    this.doorUnlock.dispose()
    this.roomLockCovers.dispose()
    this.trashPortals.dispose()
    for (const d of this.roomClearFloorDisposers) {
      d()
    }
    this.roomClearFloorDisposers.length = 0
    this.hubTitleFloorLabel.dispose()
    this.trapField.dispose()
    this.playerTrail.dispose()
    this.ghostSystem.dispose()
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
