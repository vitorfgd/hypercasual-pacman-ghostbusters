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
import { Economy } from '../systems/economy/Economy.ts'
import type { DepositEval } from '../systems/economy/depositEvaluation.ts'
import {
  KeyboardMoveInput,
  mergeMoveInput,
} from '../systems/input/KeyboardMoveInput.ts'
import { TouchJoystick } from '../systems/input/TouchJoystick.ts'
import { ItemWorld } from '../systems/items/ItemWorld.ts'
import { RoomWispSpawnSystem } from '../systems/wisp/RoomWispSpawnSystem.ts'
import { SpecialRelicSpawnSystem } from '../systems/wisp/SpecialRelicSpawnSystem.ts'
import type { PlayerCharacterVisual } from '../systems/player/PlayerCharacterVisual.ts'
import { PlayerController } from '../systems/player/PlayerController.ts'
import { createSpecialRelicFootArrow } from '../systems/player/SpecialRelicFootArrow.ts'
import { createCamera } from '../systems/scene/createCamera.ts'
import { createRenderer } from '../systems/scene/createRenderer.ts'
import { createScene } from '../systems/scene/SceneSetup.ts'
import type { HubTitleFloorLabelHandle } from '../systems/scene/hubTitleFloorLabel.ts'
import { subscribeViewportResize } from '../systems/scene/resize.ts'
import { CarryStack } from '../systems/stack/CarryStack.ts'
import { StackVisual } from '../systems/stack/StackVisual.ts'
import {
  createGemItem,
  createRelicItem,
  createWispItem,
} from '../themes/wisp/itemFactory.ts'
import type { GameItem } from './types/GameItem.ts'
import {
  UpgradeZoneSystem,
  type UpgradeSpendKind,
} from '../systems/upgrades/UpgradeZoneSystem.ts'
import { INITIAL_STACK_CAPACITY } from '../systems/upgrades/upgradeConfig.ts'
import { spawnUpgradeSpendCoins } from '../systems/upgrades/upgradeSpendVfx.ts'
import {
  GHOST_EAT_MONEY_REWARD,
  GHOST_HIT_INVULN_SEC,
  GHOST_HIT_LOSS_MAX,
  GHOST_HIT_LOSS_MIN,
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
import { gemColorForGhostBodyHex } from '../systems/ghost/ghostGemColor.ts'
import { GhostSystem } from '../systems/ghost/GhostSystem.ts'
import {
  QuestSystem,
  type QuestHudState,
} from '../systems/quests/QuestSystem.ts'
import type { AreaId } from '../systems/world/RoomSystem.ts'
import type { RoomId } from '../systems/world/mansionRoomData.ts'
import { RoomSystem } from '../systems/world/RoomSystem.ts'
import { WorldCollision } from '../systems/world/WorldCollision.ts'
import { DEFAULT_DEPOSIT_ZONE_RADIUS } from '../systems/deposit/DepositZone.ts'
import {
  GHOST_HIT_SLOW_MO_SCALE,
  GHOST_HIT_SLOW_MO_SEC,
  STACK_DROP_RECOVERY_TTL_SEC,
  STACK_DROP_SCATTER_RADIUS,
} from '../juice/juiceConfig.ts'
import { PlayerMotionTrail } from '../juice/playerMotionTrail.ts'
import { OVERLOAD_STACK_THRESHOLD } from '../systems/overload/overloadDropConfig.ts'
import { MoneyHud } from '../juice/MoneyHud.ts'
import {
  celebrateHubQuestComplete,
  celebrateRoomObjectiveComplete,
} from '../juice/confettiHud.ts'
import { spawnFloatingHudText } from '../juice/floatingHud.ts'
import { playJuiceSound } from '../juice/juiceSound.ts'
import {
  disposeAllGhostHitBursts,
  spawnGhostHitPelletBurst,
  spawnRelicCollectBurst,
  updateGhostHitBursts,
  type GhostHitBurstParticle,
} from '../juice/ghostHitPelletBurst.ts'
import {
  showRelicBankedCelebration,
  spawnRelicScreenSparkBurst,
} from '../juice/relicHud.ts'
import { GHOST_PULSE_SPEED_MULTIPLIER } from '../systems/ghostPulse/ghostPulseConfig.ts'
import { PerfMonitor } from '../systems/debug/PerfMonitor.ts'
import { DoorUnlockSystem } from '../systems/doors/DoorUnlockSystem.ts'
import { stackWeightSpeedMultiplier } from '../systems/stack/stackWeightConfig.ts'
import { TrapFieldSystem } from '../systems/traps/TrapFieldSystem.ts'
import { RoomObjectiveRuntime } from '../systems/world/roomObjectives/RoomObjectiveRuntime.ts'

const DEPOSIT_TOAST_MS = 2800

function upgradeLevelUpBanner(kind: UpgradeSpendKind, newLevel: number): string {
  switch (kind) {
    case 'capacity':
      return `Stack capacity — level ${newLevel}!`
    case 'speed':
      return `Speed — level ${newLevel}!`
    case 'pulseFreq':
      return `Hunt charge fill — level ${newLevel}!`
    case 'pulseDuration':
      return `Hunt charge drain — level ${newLevel}!`
  }
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
  private readonly upgradeZones: UpgradeZoneSystem
  private readonly doorUnlock: DoorUnlockSystem
  private readonly questSystem: QuestSystem
  private readonly roomWispSpawns: RoomWispSpawnSystem
  private readonly specialRelicSpawns: SpecialRelicSpawnSystem
  private readonly relicFootArrow: ReturnType<typeof createSpecialRelicFootArrow>
  private readonly ghostSystem: GhostSystem
  private readonly ghostGltfTemplate: GhostGltfTemplate | null
  private readonly playerGltfTemplate: PlayerGltfTemplate | null
  private readonly hubTitleFloorLabel: HubTitleFloorLabelHandle
  /** Tracks pulse edge for one-shot SFX */
  private prevGhostPulseActive = false
  private powerTintEl: HTMLElement | null = null
  private powerTimerEl: HTMLElement | null = null
  private powerTimerFillEl: HTMLElement | null = null
  private powerTimerTrackEl: HTMLElement | null = null
  private readonly burstGroup: Group
  private readonly burstParticles: GhostHitBurstParticle[] = []
  private readonly burstSpawnScratch = new Vector3()
  private ghostHitInvuln = 0
  private ghostDamageArmed = true
  private hitFlashEl: HTMLElement | null = null
  private hitFlashTimer: ReturnType<typeof setTimeout> | null = null
  private readonly hostEl: HTMLElement
  private depositToastTimer: ReturnType<typeof setTimeout> | null = null
  private overloadHudTimer: ReturnType<typeof setTimeout> | null = null
  private overloadSession: { active: boolean; perfect: boolean } | null = null
  private raf = 0
  private lastTime = performance.now()
  private elapsedSec = 0
  /** 0–1 ghost pulse charge; fills outside safe room, drains while holding pulse. */
  private pulseCharge = 0
  private pulseHeld = false
  private hudSpawn: HTMLElement | null = null
  private readonly moneyHud: MoneyHud | null
  private readonly gameViewport: HTMLElement
  private readonly velScratch = new Vector3()
  private readonly playerPos = new Vector3()
  private questHudRoot: HTMLElement | null = null
  private lastPowerTintOn = false
  private lastPulseBtnActive = false
  private lastPulseBtnEmpty = false
  private lastPowerTimerFill = -1
  private lastPowerTimerLabel = ''
  private readonly pulseBtnEl: HTMLButtonElement | null
  private lastGhostInvuln = false
  private readonly perf = new PerfMonitor()
  private readonly trapField: TrapFieldSystem
  private readonly roomObjectives: RoomObjectiveRuntime
  private readonly playerTrail: PlayerMotionTrail
  private ghostHitSlowMoRemain = 0
  private hudRoomObjective: HTMLElement | null = null
  private hudStackVignette: HTMLElement | null = null
  private hudStackHum: HTMLElement | null = null
  private depositShakeTimer: ReturnType<typeof setTimeout> | null = null
  /** Edge-detect carry stack full (max slots) for one-shot HUD celebration. */
  private wasAtMaxCapacity = false
  /** Hide north “welcome” banner after first exit from the gold deposit zone. */
  private hubWelcomeHidden = false
  private wasInDepositZone = false

  constructor(
    host: HTMLElement,
    ghostGltfTemplate: GhostGltfTemplate | null = null,
    playerGltfTemplate: PlayerGltfTemplate | null = null,
  ) {
    this.hostEl = host
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
      upgradePads,
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
    const depositAmountEl = hudDepositToast?.querySelector<HTMLElement>(
      '.deposit-amount',
    )
    const depositHintEl = hudDepositToast?.querySelector<HTMLElement>(
      '.deposit-hint',
    )
    this.hudSpawn = host.querySelector('#hud-spawn')
    this.hudRoomObjective = host.querySelector('#hud-room-objective')
    this.hudStackVignette = host.querySelector('#hud-stack-vignette')
    this.hudStackHum = host.querySelector('#hud-stack-hum')
    const hudOverload = host.querySelector<HTMLElement>('#hud-overload')
    const hudOverloadAmount = hudOverload?.querySelector<HTMLElement>(
      '.hud-overload-amount',
    )

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
    this.cameraRig = new CameraRig(this.camera, playerRoot, () =>
      this.stack.maxCapacity > 0
        ? this.stack.count / this.stack.maxCapacity
        : 0,
    )

    this.economy = new Economy()
    this.moneyHud = hudMoney
      ? new MoneyHud(hudMoney, () => this.economy.money)
      : null
    this.moneyHud?.sync()

    this.stackVisual = new StackVisual(stackAnchor)
    this.stack = new CarryStack(INITIAL_STACK_CAPACITY, () => {
      this.stackVisual.sync(this.stack.getSnapshot())
      if (hudCarry) {
        hudCarry.textContent = `${this.stack.count} / ${this.stack.maxCapacity}`
      }
    })
    if (hudCarry) {
      hudCarry.textContent = `0 / ${INITIAL_STACK_CAPACITY}`
    }

    this.itemWorld = new ItemWorld(pickupGroup, scene)
    this.itemWorld.prewarmWispPool(8)

    this.doorUnlock = new DoorUnlockSystem({
      scene: this.scene,
      player: this.player,
      economy: this.economy,
      worldCollision: this.worldCollision,
      camera: this.camera,
      hostEl: this.hostEl,
    })

    this.trapField = new TrapFieldSystem(this.scene, this.roomSystem, Math.random, 6)
    this.roomObjectives = new RoomObjectiveRuntime(this.roomSystem)
    this.playerTrail = new PlayerMotionTrail(this.scene)

    this.roomWispSpawns = new RoomWispSpawnSystem({
      itemWorld: this.itemWorld,
      roomSystem: this.roomSystem,
      worldCollision: this.worldCollision,
      createWisp: () => this.createRoomWisp(),
      canSpawnInRoom: (id) => this.doorUnlock.canAccessRoomForSpawning(id),
    })
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
      undefined,
      ghostGltfTemplate,
    )
    if (this.hudSpawn) {
      this.hudSpawn.textContent = ''
    }

    this.hitFlashEl = host.querySelector('#hud-hit-flash')
    this.powerTintEl = host.querySelector('#hud-power-tint')
    this.powerTimerEl = host.querySelector('#hud-power-timer')
    this.powerTimerFillEl = host.querySelector('#hud-power-timer-fill')
    this.powerTimerTrackEl = host.querySelector('#hud-power-timer-track')
    this.questHudRoot = host.querySelector('#hud-quest')
    this.questSystem = new QuestSystem({
      initialDelaySec: 2.8,
      betweenQuestsDelaySec: 2.2,
      onHud: (s) => this.syncQuestHud(s),
      onQuestComplete: () => {
        celebrateHubQuestComplete(this.gameViewport)
      },
      /** Cyan/blue gems drop in ROOM_3; require door index 2 open (hub→…→ROOM_3). */
      isBlueGemRequired: () => this.doorUnlock.isDoorUnlocked(2),
    })
    this.questSystem.bootstrapFirstQuest(0)
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
        if (this.overloadSession?.active) {
          this.depositFeedback.triggerOverloadItemImpact(
            this.overloadSession.perfect,
          )
          playJuiceSound('overload_impact')
          this.triggerDepositScreenShake(true)
        } else {
          this.depositFeedback.triggerItem()
          spawnFloatingHudText(
            this.gameViewport,
            `+$${item.value}`,
            'float-hud--coin',
            { topPct: 58 + Math.random() * 16, leftPct: 40 + Math.random() * 20 },
          )
          playJuiceSound('deposit_item', { pitch: 1 + flightIndex * 0.045 })
          this.triggerDepositScreenShake(false)
        }
      },
      onDepositPresentationComplete: (items, ev, ol) => {
        this.questSystem.onDepositItems(items, this.elapsedSec)
        const relicItem = items.find((it) => it.type === 'relic')
        if (relicItem) {
          this.player.getPosition(this.playerPos)
          this.burstSpawnScratch.copy(this.playerPos)
          this.burstSpawnScratch.y += 0.42
          this.burstParticles.push(
            ...spawnRelicCollectBurst(
              this.burstGroup,
              this.burstSpawnScratch,
            ),
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
        if (hudMoney) {
          hudMoney.classList.remove('money-bump', 'money-bump-big')
          void hudMoney.offsetWidth
          const heavy =
            !ol.overloadActive &&
            (items.length >= 7 || totalPayout >= 65)
          hudMoney.classList.add(heavy ? 'money-bump-big' : 'money-bump')
        }
        if (
          hudOverload &&
          hudOverloadAmount &&
          ol.overloadActive
        ) {
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
        if (hudDepositToast && depositAmountEl && depositHintEl) {
          const showDepositToast = (): void => {
            if (this.depositToastTimer) clearTimeout(this.depositToastTimer)
            this.fillDepositToastLines(
              depositAmountEl,
              depositHintEl,
              ev,
              ol,
            )
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
      },
    })

    this.upgradeZones = new UpgradeZoneSystem({
      economy: this.economy,
      player: this.player,
      stack: this.stack,
      scene: this.scene,
      camera: this.camera,
      hostEl: this.hostEl,
      capacityPad: upgradePads.capacity,
      speedPad: upgradePads.speed,
      pulseFreqPad: upgradePads.pulseFreq,
      pulseDurationPad: upgradePads.pulseDuration,
      isDoorUnlocked: (doorIndex) =>
        this.doorUnlock.isDoorUnlocked(doorIndex),
      onSpendVfx: (_kind, cost, padWorld) => {
        spawnUpgradeSpendCoins(this.hostEl, this.camera, cost, padWorld)
      },
      onUpgradeLevelUp: (kind, newLevel) => {
        spawnFloatingHudText(
          this.gameViewport,
          upgradeLevelUpBanner(kind, newLevel),
          'float-hud--level-up',
          { topPct: 26, leftPct: 50, durationSec: 2.4 },
        )
      },
    })

    this.pulseBtnEl = host.querySelector<HTMLButtonElement>('#hud-pulse-btn')
    const setPulseHeld = (v: boolean): void => {
      this.pulseHeld = v
    }
    this.pulseBtnEl?.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      setPulseHeld(true)
    })
    this.pulseBtnEl?.addEventListener('pointerup', (e) => {
      e.stopPropagation()
      setPulseHeld(false)
    })
    this.pulseBtnEl?.addEventListener('pointerleave', () => {
      setPulseHeld(false)
    })
    this.pulseBtnEl?.addEventListener('pointercancel', () => {
      setPulseHeld(false)
    })

    /** Precompile materials (door shaders + scene). */
    this.scene.updateMatrixWorld(true)
    this.renderer.compile(this.scene, this.camera)

    this.player.getPosition(this.playerPos)

    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - this.lastTime) / 1000)
      this.lastTime = now
      this.elapsedSec += dt
      this.perf.beginFrame(now)

      const move = mergeMoveInput(
        this.joystick.getVector(),
        this.keyboardMove.getVector(),
      )

      this.player.getPosition(this.playerPos)
      const dr = DEFAULT_DEPOSIT_ZONE_RADIUS
      const inDepositZone =
        this.playerPos.x * this.playerPos.x + this.playerPos.z * this.playerPos.z <=
        dr * dr

      if (
        !this.hubWelcomeHidden &&
        this.wasInDepositZone &&
        !inDepositZone
      ) {
        this.hubTitleFloorLabel.hideWelcomeBanner()
        this.hubWelcomeHidden = true
      }
      this.wasInDepositZone = inDepositZone

      this.upgradeZones.update(dt)
      this.doorUnlock.update(dt, this.elapsedSec)
      this.questSystem.update(this.elapsedSec)

      const roomPre = this.roomSystem.getRoomAt(this.playerPos.x, this.playerPos.z)
      const inSafeRoom = roomPre === 'SAFE_CENTER'
      const pulsePaused =
        inDepositZone ||
        this.upgradeZones.isPlayerInsideAnyPadZone() ||
        this.doorUnlock.isPlayerInsideDoorZone()

      const fillPerSec = this.upgradeZones.getChargeFillPerSec()
      const drainPerSec = this.upgradeZones.getChargeDrainPerSec()

      if (!inSafeRoom && !pulsePaused) {
        this.pulseCharge = Math.min(1, this.pulseCharge + fillPerSec * dt)
      }
      if (this.pulseHeld && this.pulseCharge > 0) {
        this.pulseCharge = Math.max(0, this.pulseCharge - drainPerSec * dt)
      }

      const pulseGameplayActive =
        this.pulseHeld && this.pulseCharge > 0

      this.player.setPowerSpeedMultiplier(
        pulseGameplayActive ? GHOST_PULSE_SPEED_MULTIPLIER : 1,
      )

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
      const fillRatio =
        this.stack.maxCapacity > 0
          ? this.stack.count / this.stack.maxCapacity
          : 0
      this.player.setMovementSlowMultiplier(
        stackWeightSpeedMultiplier(fillRatio) * trapSlow,
      )
      this.syncStackJuiceHud(fillRatio)

      const simDt =
        this.ghostHitSlowMoRemain > 0 ? dt * GHOST_HIT_SLOW_MO_SCALE : dt
      this.ghostHitSlowMoRemain = Math.max(0, this.ghostHitSlowMoRemain - dt)

      this.player.update(simDt, move)
      this.player.getPosition(this.playerPos)

      const room = this.roomSystem.getRoomAt(this.playerPos.x, this.playerPos.z)

      this.itemWorld.updateVisuals(this.elapsedSec, dt)

      const trailIntensity =
        fillRatio >= 0.72 ? (fillRatio - 0.72) / (1 - 0.72) : 0
      this.playerTrail.update(
        this.playerPos.x,
        this.playerPos.z,
        0.02,
        trailIntensity,
        dt,
      )

      this.roomObjectives.update(dt, this.playerPos.x, this.playerPos.z, room, (rid, line) =>
        this.completeRoomObjective(rid, line),
      )
      const objHud = this.roomObjectives.getHud()
      if (this.hudRoomObjective) {
        this.hudRoomObjective.textContent = objHud.line
        this.hudRoomObjective.classList.toggle('hidden', !objHud.visible)
        this.hudRoomObjective.classList.toggle(
          'hud-room-objective--active',
          objHud.visible,
        )
      }
      if (this.lastPowerTintOn !== pulseGameplayActive) {
        this.powerTintEl?.classList.toggle('hud-power-tint--on', pulseGameplayActive)
        this.lastPowerTintOn = pulseGameplayActive
      }
      const pulseBtnEmpty =
        this.pulseCharge < 0.02 && !pulseGameplayActive
      if (this.pulseBtnEl) {
        if (this.lastPulseBtnActive !== pulseGameplayActive) {
          this.pulseBtnEl.classList.toggle(
            'hud-pulse-btn--active',
            pulseGameplayActive,
          )
          this.lastPulseBtnActive = pulseGameplayActive
        }
        if (this.lastPulseBtnEmpty !== pulseBtnEmpty) {
          this.pulseBtnEl.classList.toggle('hud-pulse-btn--empty', pulseBtnEmpty)
          this.lastPulseBtnEmpty = pulseBtnEmpty
        }
      }
      if (this.powerTimerEl && this.powerTimerFillEl) {
        this.powerTimerEl.hidden = false
        this.powerTimerEl.classList.toggle(
          'hud-power-timer--idle',
          !pulseGameplayActive,
        )
        const fillPct = Math.min(100, this.pulseCharge * 100)
        const rounded = Math.round(fillPct)
        if (rounded !== this.lastPowerTimerFill) {
          this.powerTimerFillEl.style.width = `${fillPct}%`
          this.powerTimerTrackEl?.setAttribute('aria-valuenow', String(rounded))
          this.lastPowerTimerFill = rounded
        }
        const label = 'Hunt charge — hold the Hunt button to chase ghosts'
        if (label !== this.lastPowerTimerLabel) {
          this.powerTimerTrackEl?.setAttribute('aria-label', label)
          this.lastPowerTimerLabel = label
        }
      }

      if (pulseGameplayActive && !this.prevGhostPulseActive) {
        playJuiceSound('ghost_pulse')
      }
      this.prevGhostPulseActive = pulseGameplayActive

      this.ghostSystem.setPowerMode(
        pulseGameplayActive,
        this.elapsedSec,
      )
      this.ghostSystem.update(simDt, this.playerPos, this.stack.hasRelic())

      this.ghostHitInvuln = Math.max(0, this.ghostHitInvuln - dt)
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

      const eat = this.ghostSystem.tryEatGhost(this.playerPos, this.player.radius)
      if (eat.kind === 'eaten') {
        this.economy.addMoney(GHOST_EAT_MONEY_REWARD)
        spawnFloatingHudText(
          this.gameViewport,
          `+$${GHOST_EAT_MONEY_REWARD}`,
          'float-hud--coin',
        )
        playJuiceSound('ghost_eat')
        const gemColor = gemColorForGhostBodyHex(eat.bodyColor)
        this.itemWorld.spawn(createGemItem(gemColor), eat.x, eat.z)
      }
      const hit = this.ghostSystem.tryHitPlayer(
        this.playerPos,
        this.player.radius,
        this.ghostHitInvuln > 0 || !this.ghostDamageArmed,
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
        this.triggerGhostHitFlash()

        const c = this.stack.count
        let toRemove = 0
        if (c > 0) {
          const frac =
            GHOST_HIT_LOSS_MIN +
            Math.random() * (GHOST_HIT_LOSS_MAX - GHOST_HIT_LOSS_MIN)
          toRemove = Math.min(c, Math.ceil(c * frac))
        }
        const lost =
          toRemove > 0 ? this.stack.popManyFromTop(toRemove) : []
        if (lost.length > 0) {
          this.scatterDroppedItems(lost, STACK_DROP_SCATTER_RADIUS)
        }
        this.ghostHitSlowMoRemain = GHOST_HIT_SLOW_MO_SEC

        this.burstSpawnScratch.copy(this.playerPos)
        this.burstSpawnScratch.y += 0.38
        this.burstParticles.push(
          ...spawnGhostHitPelletBurst(
            this.burstGroup,
            this.burstSpawnScratch,
            lost,
          ),
        )
        playJuiceSound('ghost_hit')
        this.ghostSystem.onGhostHitLandedAt(
          hit.ghostX,
          hit.ghostZ,
          this.playerPos,
        )
      }
      updateGhostHitBursts(this.burstParticles, dt)

      const collected = this.collection.update(this.player, this.stack, this.itemWorld, dt, {
        pickupBlocked: this.ghostHitInvuln > 0,
      })
      for (const { item } of collected) {
        if (item.type === 'wisp') {
          spawnFloatingHudText(this.gameViewport, '+1', 'float-hud--pickup')
          this.roomObjectives.onWispCollected(
            this.playerPos.x,
            this.playerPos.z,
            (rid, line) => this.completeRoomObjective(rid, line),
          )
        }
        if (
          item.type === 'wisp' ||
          item.type === 'relic' ||
          item.type === 'gem'
        ) {
          playJuiceSound('pickup')
        }
      }

      const maxCap = this.stack.maxCapacity
      const atMax = maxCap > 0 && this.stack.count >= maxCap
      if (atMax && !this.wasAtMaxCapacity) {
        spawnFloatingHudText(
          this.gameViewport,
          'STACK FULL!',
          'float-hud--stack-full',
          { durationSec: 1.35, leftPct: 50, topPct: 24 },
        )
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
        powerMode: pulseGameplayActive,
        ghostInvuln: this.ghostHitInvuln > 0,
        recentPickupSec: 0,
      })
      this.cameraRig.update(dt)
      this.moneyHud?.update(dt)
      this.itemWorld.updateCollectEffects(dt)
      this.stackVisual.update(dt)
      this.depositController.update(dt)
      this.depositFeedback.setPlayerInside(inDepositZone)
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

  private syncQuestHud(s: QuestHudState): void {
    const root = this.questHudRoot
    if (!root) return
    root.hidden = !s.visible
    const a = root.querySelector('#hud-quest-relic')
    const b = root.querySelector('#hud-quest-red')
    const c = root.querySelector('#hud-quest-blue')
    if (a) a.textContent = `Relic: ${s.relic.have} / ${s.relic.need}`
    if (b) b.textContent = `Red gems: ${s.redGems.have} / ${s.redGems.need}`
    if (c) {
      if (s.blueGems.need === 0) {
        c.classList.add('hud-quest__line--hidden')
        c.textContent = ''
      } else {
        c.classList.remove('hud-quest__line--hidden')
        c.textContent = `Blue gems: ${s.blueGems.have} / ${s.blueGems.need}`
      }
    }
  }

  private completeRoomObjective(roomId: RoomId, line: string): void {
    celebrateRoomObjectiveComplete(this.gameViewport, line)
    playJuiceSound('pickup')
    this.roomObjectives.spawnRewardBurst(roomId, this.itemWorld, Math.random)
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

  private syncStackJuiceHud(fillRatio: number): void {
    const v = this.hudStackVignette
    if (v) {
      const t = fillRatio >= 0.5 ? (fillRatio - 0.5) / 0.5 : 0
      v.style.opacity = String(t * 0.85)
    }
    const h = this.hudStackHum
    if (h) {
      const on = fillRatio >= 0.7
      h.classList.toggle('hud-stack-hum--on', on)
      h.style.opacity = on ? String(0.28 + ((fillRatio - 0.7) / 0.3) * 0.55) : '0'
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

  private triggerGhostHitFlash(): void {
    const el = this.hitFlashEl
    if (!el) return
    if (this.hitFlashTimer) {
      clearTimeout(this.hitFlashTimer)
      this.hitFlashTimer = null
    }
    el.classList.add('hud-hit-flash--on')
    this.hitFlashTimer = setTimeout(() => {
      el.classList.remove('hud-hit-flash--on')
      this.hitFlashTimer = null
    }, 88)
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
    this.hitFlashEl?.classList.remove('hud-hit-flash--on')
    this.gameViewport.classList.remove('game-viewport--ghost-invuln')
    disposeAllGhostHitBursts(this.burstParticles)
    this.burstGroup.removeFromParent()
    this.doorUnlock.dispose()
    this.hubTitleFloorLabel.dispose()
    this.trapField.dispose()
    this.playerTrail.dispose()
    this.upgradeZones.dispose()
    this.ghostSystem.dispose()
    disposeGhostGltfTemplate(this.ghostGltfTemplate)
    this.playerCharacter.dispose()
    disposePlayerGltfTemplate(this.playerGltfTemplate)
    disposeGhostSharedGeometry()
    this.keyboardMove.dispose()
    this.joystick.dispose()
    this.unsubscribeResize()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
