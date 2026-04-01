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
import {
  previewCarryPayout,
  type DepositEval,
} from '../systems/economy/depositEvaluation.ts'
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
import { subscribeViewportResize } from '../systems/scene/resize.ts'
import { CarryStack } from '../systems/stack/CarryStack.ts'
import { StackVisual } from '../systems/stack/StackVisual.ts'
import { createRelicItem, createWispItem } from '../themes/wisp/itemFactory.ts'
import type { GameItem } from './types/GameItem.ts'
import { UpgradeZoneSystem } from '../systems/upgrades/UpgradeZoneSystem.ts'
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
  PLAYER_PICKUP_ANIM_WINDOW_SEC,
  type PlayerGltfTemplate,
} from '../systems/player/playerGltfAsset.ts'
import { disposeGhostSharedGeometry } from '../systems/ghost/createGhostVisual.ts'
import { GhostSystem } from '../systems/ghost/GhostSystem.ts'
import type { AreaId } from '../systems/world/RoomSystem.ts'
import { RoomSystem } from '../systems/world/RoomSystem.ts'
import { WorldCollision } from '../systems/world/WorldCollision.ts'
import { DEFAULT_DEPOSIT_ZONE_RADIUS } from '../systems/deposit/DepositZone.ts'
import {
  IDLE_HINT_AFTER_SEC,
  IDLE_SPEED_MAX,
} from '../juice/juiceConfig.ts'
import { OVERLOAD_STACK_THRESHOLD } from '../systems/overload/overloadDropConfig.ts'
import { MoneyHud } from '../juice/MoneyHud.ts'
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
  showRelicPickupHint,
  showRelicSpawnedBanner,
  spawnRelicScreenSparkBurst,
} from '../juice/relicHud.ts'
import {
  computeGhostPulsePhase,
  GHOST_PULSE_SPEED_MULTIPLIER,
} from '../systems/ghostPulse/ghostPulseConfig.ts'
import { PerfMonitor } from '../systems/debug/PerfMonitor.ts'

const DEPOSIT_TOAST_MS = 2800

export class Game {
  private readonly roomSystem = new RoomSystem()
  private readonly worldCollision = new WorldCollision()
  private readonly scene: Scene
  private readonly camera: PerspectiveCamera
  private readonly renderer: WebGLRenderer
  private readonly unsubscribeResize: () => void
  private readonly joystick: TouchJoystick
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
  private readonly roomWispSpawns: RoomWispSpawnSystem
  private readonly specialRelicSpawns: SpecialRelicSpawnSystem
  private readonly relicFootArrow: ReturnType<typeof createSpecialRelicFootArrow>
  private readonly ghostSystem: GhostSystem
  private readonly ghostGltfTemplate: GhostGltfTemplate | null
  private readonly playerGltfTemplate: PlayerGltfTemplate | null
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
  /**
   * Ghost pulse cycle time. Paused in deposit / upgrade zones; entering or leaving
   * those zones resets to `safeDur` (empty idle bar, countdown restarts when you exit).
   */
  private ghostPulseClockSec = 0
  private prevPulsePaused: boolean | null = null
  private hudSpawn: HTMLElement | null = null
  private readonly moneyHud: MoneyHud | null
  private readonly gameViewport: HTMLElement
  private readonly velScratch = new Vector3()
  private readonly playerPos = new Vector3()
  private idleSec = 0
  /** GLB “collecting” clip window after any wisp/relic pickup */
  private playerPickupAnimTime = 0
  private objectiveEl: HTMLElement | null = null
  private idleHintEl: HTMLElement | null = null
  private hudCarryValueEl: HTMLElement | null = null
  private readonly hudUpgradeEl: HTMLElement | null
  private readonly hudUpgradeTitleEl: HTMLElement | null
  private readonly hudUpgradeBarEl: HTMLElement | null
  private readonly hudUpgradeBarWrapEl: HTMLElement | null
  private readonly hudUpgradeBtnEl: HTMLButtonElement | null
  private readonly hudUpgradeCardEl: HTMLElement | null
  private lastUpgradeHudKey = ''
  private lastObjectiveText = ''
  private lastPowerTintOn = false
  private lastPowerTimerFill = -1
  private lastPowerTimerLabel = ''
  private lastGhostInvuln = false
  private readonly perf = new PerfMonitor()

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
      depositRingMesh,
      playerCharacter,
      upgradePads,
    } = createScene(playerGltfTemplate)

    this.scene = scene
    this.burstGroup = new Group()
    this.burstGroup.name = 'ghostHitBurst'
    this.burstGroup.renderOrder = 50
    this.scene.add(this.burstGroup)

    const hudMoney = host.querySelector<HTMLElement>('#hud-money')
    const hudCarry = host.querySelector<HTMLElement>('#hud-carry')
    this.hudCarryValueEl = host.querySelector<HTMLElement>('#hud-carry-value')
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
    this.player = new PlayerController(playerRoot, this.worldCollision)
    this.playerCharacter = playerCharacter
    this.cameraRig = new CameraRig(this.camera, playerRoot, () =>
      this.stack.count,
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
      this.refreshCarryValueHud()
    })
    if (hudCarry) {
      hudCarry.textContent = `0 / ${INITIAL_STACK_CAPACITY}`
    }
    this.refreshCarryValueHud()

    this.itemWorld = new ItemWorld(pickupGroup, scene)
    this.itemWorld.prewarmWispPool(8)
    this.roomWispSpawns = new RoomWispSpawnSystem({
      itemWorld: this.itemWorld,
      roomSystem: this.roomSystem,
      worldCollision: this.worldCollision,
      createWisp: () => this.createRoomWisp(),
    })
    this.specialRelicSpawns = new SpecialRelicSpawnSystem({
      itemWorld: this.itemWorld,
      roomSystem: this.roomSystem,
      worldCollision: this.worldCollision,
      createRelic: () => createRelicItem(),
      onSpawn: () => {
        showRelicSpawnedBanner(this.gameViewport)
        playJuiceSound('relic_spawn')
      },
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
      this.hudSpawn.textContent = 'Deposit at the gold circle (center)'
    }

    this.hitFlashEl = host.querySelector('#hud-hit-flash')
    this.powerTintEl = host.querySelector('#hud-power-tint')
    this.powerTimerEl = host.querySelector('#hud-power-timer')
    this.powerTimerFillEl = host.querySelector('#hud-power-timer-fill')
    this.powerTimerTrackEl = host.querySelector('#hud-power-timer-track')
    this.objectiveEl = host.querySelector('#hud-objective')
    this.idleHintEl = host.querySelector('#hud-idle-hint')
    this.hudUpgradeEl = host.querySelector('#hud-upgrade')
    this.hudUpgradeTitleEl = host.querySelector('#hud-upgrade-title')
    this.hudUpgradeBarEl = host.querySelector('#hud-upgrade-bar')
    this.hudUpgradeBarWrapEl = host.querySelector('#hud-upgrade-bar-wrap')
    this.hudUpgradeBtnEl = host.querySelector('#hud-upgrade-btn')
    this.hudUpgradeCardEl = host.querySelector('.hud-upgrade__card')

    this.collection = new CollectionSystem()

    this.depositFeedback = new DepositZoneFeedback(
      depositZoneMesh,
      depositRingMesh,
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
      onItemDepositLanded: (item) => {
        if (this.overloadSession?.active) {
          this.depositFeedback.triggerOverloadItemImpact(
            this.overloadSession.perfect,
          )
          playJuiceSound('overload_impact')
        } else {
          this.depositFeedback.triggerItem()
          spawnFloatingHudText(
            this.gameViewport,
            `+$${item.value}`,
            'float-hud--coin',
          )
          playJuiceSound('deposit_item')
        }
      },
      onDepositPresentationComplete: (items, ev, ol) => {
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
          !ol.overloadActive &&
          items.length >= 6 &&
          totalPayout >= 40
        ) {
          spawnFloatingHudText(
            this.gameViewport,
            `+$${totalPayout} BANKED!`,
            'float-hud--bank-big',
          )
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
            window.setTimeout(showDepositToast, 520)
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
      capacityPad: upgradePads.capacity,
      speedPad: upgradePads.speed,
      pulseFreqPad: upgradePads.pulseFreq,
      pulseDurationPad: upgradePads.pulseDuration,
      onSpendVfx: (_kind, cost, padWorld) => {
        spawnUpgradeSpendCoins(this.hostEl, this.camera, cost, padWorld)
      },
    })

    /** Precompile materials so the first walk out of the hub does not hitch on shader link. */
    this.scene.updateMatrixWorld(true)
    this.renderer.compile(this.scene, this.camera)

    this.hudUpgradeBtnEl?.addEventListener('click', (e) => {
      e.stopPropagation()
      if (this.hudUpgradeBtnEl?.disabled) return
      this.player.getPosition(this.playerPos)
      this.upgradeZones.update(1 / 60)
      if (this.upgradeZones.tryPurchaseActive()) {
        this.moneyHud?.sync()
        this.syncUpgradeHud()
      }
    })

    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - this.lastTime) / 1000)
      this.lastTime = now
      this.elapsedSec += dt
      this.playerPickupAnimTime = Math.max(0, this.playerPickupAnimTime - dt)
      this.perf.beginFrame(now)

      const j = this.joystick.getVector()
      this.player.update(dt, j)
      this.player.getPosition(this.playerPos)

      const dr = DEFAULT_DEPOSIT_ZONE_RADIUS
      const inDepositZone =
        this.playerPos.x * this.playerPos.x + this.playerPos.z * this.playerPos.z <=
        dr * dr

      this.upgradeZones.update(dt)
      this.syncUpgradeHud()

      const intervalSec = this.upgradeZones.getPulseIntervalSec()
      const durationSec = this.upgradeZones.getPulseDurationSec()
      const safeDur = Math.min(durationSec, intervalSec * 0.92)

      const pulsePaused =
        inDepositZone || this.upgradeZones.isPlayerInsideAnyPadZone()
      const wasPaused = this.prevPulsePaused ?? false
      if (wasPaused && !pulsePaused) {
        this.ghostPulseClockSec = safeDur
      } else if (!wasPaused && pulsePaused) {
        this.ghostPulseClockSec = safeDur
      } else if (!pulsePaused) {
        this.ghostPulseClockSec += dt
      }
      this.prevPulsePaused = pulsePaused

      const pulse = computeGhostPulsePhase(
        this.ghostPulseClockSec,
        intervalSec,
        durationSec,
      )
      /** Phase time is frozen in hub; pulse combat/tint/speed stay off there too. */
      const pulseGameplayActive = pulse.active && !pulsePaused

      this.itemWorld.updateVisuals(this.elapsedSec, dt)

      this.player.setPowerSpeedMultiplier(
        pulseGameplayActive ? GHOST_PULSE_SPEED_MULTIPLIER : 1,
      )
      if (this.lastPowerTintOn !== pulseGameplayActive) {
        this.powerTintEl?.classList.toggle('hud-power-tint--on', pulseGameplayActive)
        this.lastPowerTintOn = pulseGameplayActive
      }
      if (this.powerTimerEl && this.powerTimerFillEl) {
        this.powerTimerEl.hidden = false
        let fillPct = 0
        if (pulse.active) {
          this.powerTimerEl.classList.remove('hud-power-timer--idle')
          fillPct =
            safeDur > 1e-6 ? (pulse.remainingSec / safeDur) * 100 : 0
        } else {
          this.powerTimerEl.classList.add('hud-power-timer--idle')
          const idleSpan = Math.max(1e-6, intervalSec - safeDur)
          const cyclePos = intervalSec - pulse.timeUntilNextPulseSec
          const intoIdle = Math.max(0, cyclePos - safeDur)
          fillPct = Math.min(100, (intoIdle / idleSpan) * 100)
        }
        const rounded = Math.round(fillPct)
        if (rounded !== this.lastPowerTimerFill) {
          this.powerTimerFillEl.style.width = `${fillPct}%`
          this.powerTimerTrackEl?.setAttribute('aria-valuenow', String(rounded))
          this.lastPowerTimerFill = rounded
        }
        const label = pulse.active
          ? 'Pulse time remaining'
          : 'Time until next pulse'
        if (label !== this.lastPowerTimerLabel) {
          this.powerTimerTrackEl?.setAttribute('aria-label', label)
          this.lastPowerTimerLabel = label
        }
      }

      if (
        pulse.active &&
        !this.prevGhostPulseActive &&
        !pulsePaused
      ) {
        playJuiceSound('ghost_pulse')
      }
      this.prevGhostPulseActive = pulse.active

      this.ghostSystem.setPowerMode(
        pulseGameplayActive,
        this.ghostPulseClockSec,
      )
      this.ghostSystem.update(dt, this.playerPos, this.stack.hasRelic())

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

      if (this.ghostSystem.tryEatGhost(this.playerPos, this.player.radius)) {
        this.economy.addMoney(GHOST_EAT_MONEY_REWARD)
        spawnFloatingHudText(
          this.gameViewport,
          `+$${GHOST_EAT_MONEY_REWARD}`,
          'float-hud--coin',
        )
        playJuiceSound('ghost_eat')
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
          playJuiceSound('pickup')
        } else if (item.type === 'relic') {
          showRelicPickupHint(this.gameViewport)
          playJuiceSound('pickup')
        }
      }
      if (collected.length > 0) {
        this.playerPickupAnimTime = PLAYER_PICKUP_ANIM_WINDOW_SEC
      }

      this.player.getVelocity(this.velScratch)
      this.playerCharacter.update(dt, {
        timeSec: this.elapsedSec,
        speed: this.player.getHorizontalSpeed(),
        velX: this.velScratch.x,
        itemsCarried: this.stack.count,
        maxCarry: this.stack.maxCapacity,
        powerMode: pulseGameplayActive,
        ghostInvuln: this.ghostHitInvuln > 0,
        recentPickupSec: this.playerPickupAnimTime,
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

      this.updateObjectiveAndIdleHints(dt)

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

  private updateObjectiveAndIdleHints(dt: number): void {
    if (this.objectiveEl) {
      const text =
        this.stack.count === 0
          ? ''
          : 'Deposit at the bright gold circle (center)'
      if (text !== this.lastObjectiveText) {
        this.objectiveEl.textContent = text
        this.lastObjectiveText = text
      }
    }

    const speed = this.player.getHorizontalSpeed()
    if (speed < IDLE_SPEED_MAX) {
      this.idleSec += dt
    } else {
      this.idleSec = 0
    }

    this.player.getPosition(this.playerPos)
    const px = this.playerPos.x
    const pz = this.playerPos.z
    const room = this.roomSystem.getRoomAt(px, pz)
    const inNormalRoom =
      room !== null && room !== 'SAFE_CENTER'

    if (
      this.idleHintEl &&
      this.idleSec > IDLE_HINT_AFTER_SEC &&
      speed < IDLE_SPEED_MAX &&
      !inNormalRoom
    ) {
      this.idleHintEl.classList.remove('hidden')
    } else {
      this.idleHintEl?.classList.add('hidden')
    }
  }

  /** Current room / `CORRIDOR` / null (outside layout), from player XZ. */
  getPlayerArea(): AreaId | null {
    this.player.getPosition(this.playerPos)
    return this.roomSystem.getAreaAt(this.playerPos.x, this.playerPos.z)
  }

  getRoomSystem(): RoomSystem {
    return this.roomSystem
  }

  private syncUpgradeHud(): void {
    const root = this.hudUpgradeEl
    const titleEl = this.hudUpgradeTitleEl
    const barEl = this.hudUpgradeBarEl
    const wrapEl = this.hudUpgradeBarWrapEl
    const btn = this.hudUpgradeBtnEl
    const card = this.hudUpgradeCardEl
    if (!root || !titleEl || !barEl || !btn || !card) return

    const snap = this.upgradeZones.getHudSnapshot()
    if (!snap.visible) {
      if (this.lastUpgradeHudKey !== 'hidden') {
        root.classList.add('hidden')
        root.setAttribute('aria-hidden', 'true')
        this.lastUpgradeHudKey = 'hidden'
      }
      return
    }
    const pct = Math.min(100, Math.round(snap.progress * 100))
    const key = `${snap.title}|${pct}|${snap.maxed ? 1 : 0}|${snap.cost}|${snap.canAfford ? 1 : 0}|${snap.accent}`
    if (key === this.lastUpgradeHudKey) return
    this.lastUpgradeHudKey = key

    root.classList.remove('hidden')
    root.setAttribute('aria-hidden', 'false')
    titleEl.textContent = snap.title
    barEl.style.width = `${pct}%`
    wrapEl?.setAttribute('aria-valuenow', String(pct))
    card.style.setProperty('--upgrade-accent', snap.accent)
    if (snap.maxed) {
      btn.textContent = 'MAXED'
      btn.disabled = true
    } else {
      btn.textContent = `UPGRADE — $${snap.cost}`
      btn.disabled = !snap.canAfford
    }
  }

  private refreshCarryValueHud(): void {
    const el = this.hudCarryValueEl
    if (!el) return
    const snap = this.stack.getSnapshot()
    if (snap.length === 0) {
      el.textContent = '≈ $0'
      el.hidden = true
      return
    }
    el.hidden = false
    el.textContent = `≈ $${previewCarryPayout(snap)}`
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
    this.ghostSystem.dispose()
    disposeGhostGltfTemplate(this.ghostGltfTemplate)
    this.playerCharacter.dispose()
    disposePlayerGltfTemplate(this.playerGltfTemplate)
    disposeGhostSharedGeometry()
    this.joystick.dispose()
    this.unsubscribeResize()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
