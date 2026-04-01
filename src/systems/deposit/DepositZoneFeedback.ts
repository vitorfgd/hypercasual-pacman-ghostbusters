import type { Group, Mesh } from 'three'
import {
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  Mesh as ThreeMesh,
} from 'three'

const FLASH_SEC = 0.28
const BURST_SEC = 0.36
const BASE_PLANE_EMISSIVE = 0.28
const BASE_RING_EMISSIVE = 0.12

export class DepositZoneFeedback {
  private flashT = 0
  private flashTDur = FLASH_SEC
  private burstT = 0
  private burstTDur = BURST_SEC
  private readonly zonePlane: Mesh
  private readonly zoneRing: Mesh | null
  private readonly underglow: Mesh | null
  private readonly baseScale: number
  private readonly baseUnderglowEmissive: number
  private readonly baseUnderglowOpacity: number
  private readonly burstRing: ThreeMesh
  private burstRingLife = 0
  private burstRingMaxLife = 0.4
  private burstRingStrong = false

  /** Smoothed 0–1 while player stands in deposit circle */
  private presenceSmooth = 0
  private presenceTarget = 0

  constructor(
    zonePlane: Mesh,
    zoneRing: Mesh | null,
    depositRoot: Group,
    underglow: Mesh | null = null,
  ) {
    this.zonePlane = zonePlane
    this.zoneRing = zoneRing
    this.underglow = underglow
    this.baseScale = zonePlane.scale.x
    const ugMat = underglow?.material
    this.baseUnderglowEmissive =
      ugMat instanceof MeshStandardMaterial ? ugMat.emissiveIntensity : 0.22
    this.baseUnderglowOpacity =
      ugMat instanceof MeshStandardMaterial ? ugMat.opacity : 0.58

    const ringMat = new MeshBasicMaterial({
      color: 0xffe8a0,
      transparent: true,
      opacity: 0.55,
      side: DoubleSide,
      depthWrite: false,
    })
    this.burstRing = new ThreeMesh(new RingGeometry(0.55, 0.72, 40), ringMat)
    this.burstRing.rotation.x = -Math.PI / 2
    this.burstRing.position.y = 0.038
    this.burstRing.visible = false
    this.burstRing.scale.setScalar(0.15)
    depositRoot.add(this.burstRing)
  }

  /** Call each frame before `update` — deposit disc overlap (same test as gameplay). */
  setPlayerInside(inside: boolean): void {
    this.presenceTarget = inside ? 1 : 0
  }

  triggerItem(): void {
    this.burstRingStrong = false
    this.flashTDur = FLASH_SEC * 0.85
    this.flashT = this.flashTDur
  }

  trigger(): void {
    this.burstRingStrong = false
    this.flashTDur = FLASH_SEC
    this.flashT = FLASH_SEC
    this.burstTDur = BURST_SEC
    this.burstT = BURST_SEC
  }

  /**
   * Normal deposit complete — scales flash / zone pulse with stack size and payout.
   */
  triggerDepositComplete(itemCount: number, payoutCredits: number): void {
    this.burstRingStrong = false
    const sizeS = Math.min(1, itemCount / 11)
    const valueS = Math.min(1, payoutCredits / 95)
    const punch = 0.28 + sizeS * 0.55 + valueS * 0.45
    this.flashTDur = FLASH_SEC * (0.82 + punch * 0.55)
    this.flashT = this.flashTDur
    this.burstTDur = BURST_SEC * (0.88 + punch * 0.62)
    this.burstT = this.burstTDur
    const planeMat = this.zonePlane.material as MeshStandardMaterial
    planeMat.emissiveIntensity = BASE_PLANE_EMISSIVE + 0.06 + punch * 0.2
  }

  triggerOverloadItemImpact(perfect: boolean): void {
    this.flashTDur = FLASH_SEC * (perfect ? 1.1 : 0.95)
    this.flashT = this.flashTDur
    const planeMat = this.zonePlane.material as MeshStandardMaterial
    planeMat.emissiveIntensity =
      BASE_PLANE_EMISSIVE + (perfect ? 0.35 : 0.2)
  }

  triggerOverloadBurst(perfect: boolean): void {
    this.burstRingStrong = perfect
    this.flashTDur = FLASH_SEC * 1.15
    this.flashT = this.flashTDur
    this.burstTDur = BURST_SEC * (perfect ? 1.35 : 1)
    this.burstT = this.burstTDur
    this.burstRingMaxLife = perfect ? 0.48 : 0.36
    this.burstRingLife = this.burstRingMaxLife
    this.burstRing.visible = true
    this.burstRing.scale.setScalar(0.2)
    const mat = this.burstRing.material as MeshBasicMaterial
    mat.opacity = perfect ? 0.72 : 0.58
  }

  update(dt: number): void {
    const occK = 1 - Math.exp(-7 * dt)
    this.presenceSmooth += (this.presenceTarget - this.presenceSmooth) * occK

    const planeMat = this.zonePlane.material as MeshStandardMaterial
    const occ = this.presenceSmooth

    if (this.burstRingLife > 0) {
      this.burstRingLife -= dt
      const p = Math.max(0, this.burstRingLife / this.burstRingMaxLife)
      const s = 0.2 + (2.15 - 0.2) * (1 - p)
      this.burstRing.scale.setScalar(s)
      const mat = this.burstRing.material as MeshBasicMaterial
      const baseOp = this.burstRingStrong ? 0.72 : 0.58
      mat.opacity = baseOp * p
      if (this.burstRingLife <= 0) {
        this.burstRing.visible = false
        mat.opacity = 0
      }
    }

    if (this.burstT > 0) {
      this.burstT -= dt
      const ref = this.burstTDur || BURST_SEC
      const p = Math.max(0, this.burstT / ref)
      const amp = this.burstRingStrong ? 0.1 : 0.07 + (1 - p) * 0.06
      const pulse = 1 + amp * Math.sin((1 - p) * Math.PI)
      this.zonePlane.scale.setScalar(this.baseScale * pulse)
      if (this.burstT <= 0) {
        this.zonePlane.scale.setScalar(this.baseScale)
      }
    }

    if (this.flashT <= 0) {
      const emBoost = occ * 0.3
      planeMat.emissiveIntensity = BASE_PLANE_EMISSIVE + emBoost
      if (this.zoneRing) {
        const ringMat = this.zoneRing.material as MeshStandardMaterial
        ringMat.emissiveIntensity = BASE_RING_EMISSIVE + emBoost * 0.85
      }
      if (this.underglow) {
        const ug = this.underglow.material as MeshStandardMaterial
        ug.emissiveIntensity = this.baseUnderglowEmissive + occ * 0.24
        ug.opacity = Math.min(0.78, this.baseUnderglowOpacity + occ * 0.14)
      }
      if (this.burstT <= 0 && this.burstRingLife <= 0) {
        this.zonePlane.scale.setScalar(this.baseScale * (1 + 0.065 * occ))
      }
      return
    }

    this.flashT -= dt
    const t = Math.max(0, this.flashT)
    const fd = this.flashTDur || FLASH_SEC
    const p = t / fd
    const strength = p * p

    planeMat.emissiveIntensity = BASE_PLANE_EMISSIVE + 0.85 * strength

    if (this.zoneRing) {
      const ringMat = this.zoneRing.material as MeshStandardMaterial
      ringMat.emissiveIntensity = BASE_RING_EMISSIVE + 0.7 * strength
    }

    if (this.flashT <= 0) {
      this.flashT = 0
      planeMat.emissiveIntensity = BASE_PLANE_EMISSIVE
      if (this.zoneRing) {
        const ringMat = this.zoneRing.material as MeshStandardMaterial
        ringMat.emissiveIntensity = BASE_RING_EMISSIVE
      }
    }
  }
}
