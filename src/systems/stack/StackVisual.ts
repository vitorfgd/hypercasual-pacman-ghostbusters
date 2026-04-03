import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Scene,
  Vector3,
  type Object3D,
} from 'three'
import type { GameItem } from '../../core/types/GameItem.ts'
import {
  createDepositFlightProxy,
  disposeDepositFlightProxy,
} from '../deposit/depositFlightProxy.ts'
import {
  cloneCarryBagMesh,
  disposeCarryBagClone,
  isCarryBagReady,
} from './bagGltfAsset.ts'
import { STACK_BOUNCE_DECAY } from '../../juice/juiceConfig.ts'

const SCALE_SMOOTH = 11
/** Empty → full multipliers (wider spread so fill growth reads clearly on the back). */
const BAG_Y_MIN = 0.78
const BAG_Y_MAX = 1.62
const BAG_XZ_MIN = 0.82
const BAG_XZ_MAX = 1.34
const BOUNCE_SCALE_AMP = 0.125
const HIT_REACT_DECAY = 13.5

/**
 * Single carry bag on `stackAnchor` (player back). `CarryStack` data unchanged;
 * deposit flights use lightweight proxy spheres instead of stacked item meshes.
 */
export class StackVisual {
  private readonly anchor: Object3D
  /** Null while the bag mesh is flying in an auto-clear arc. */
  private bag: Group | null = null
  private fitScale = 1
  private prevIds: string[] = []
  private bounce = 0
  /** Ghost hit: brief squash / bulge, decays smoothly (0…1). */
  private hitReact = 0
  private targetFill = 0
  private displayFill = 0
  private readonly curMul = new Vector3(1, 1, 1)
  private readonly tgtMul = new Vector3(1, 1, 1)
  private readonly worldPos = new Vector3()

  constructor(anchor: Object3D) {
    this.anchor = anchor
    this.mountFreshBag()
  }

  /** Detach current bag to the scene for a forward toss; anchor has no bag until empty `sync`. */
  detachBagForThrow(scene: Scene): Group {
    const b = this.bag
    if (!b) {
      throw new Error('StackVisual.detachBagForThrow: no bag')
    }
    scene.attach(b)
    this.bag = null
    return b
  }

  /** Call when a ghost hit rips items from the bag (after stack data updates). */
  triggerGhostHitReaction(): void {
    this.hitReact = 1
  }

  sync(items: readonly GameItem[], maxCapacity: number): void {
    if (this.bag === null && items.length > 0) {
      return
    }
    if (this.bag === null && items.length === 0) {
      this.mountFreshBag()
    }

    const ids = items.map((x) => x.id)
    if (
      ids.length === this.prevIds.length &&
      ids.every((id, i) => id === this.prevIds[i])
    ) {
      return
    }

    const incremental =
      ids.length === this.prevIds.length + 1 &&
      this.prevIds.length > 0 &&
      this.prevIds.every((id, i) => id === ids[i])
    if (incremental) {
      this.bounce = 1
    }

    this.prevIds = ids
    const max = Math.max(1, maxCapacity)
    const fillVol = items.length / max
    const clutterN = items.filter((x) => x.type === 'clutter').length
    const clutterBoost = Math.min(0.38, clutterN * 0.034)
    this.targetFill = Math.max(0, Math.min(1, fillVol + clutterBoost))
    this.recomputeTargetScales(this.targetFill)
  }

  update(dt: number): void {
    if (!this.bag) return

    const k = 1 - Math.exp(-SCALE_SMOOTH * dt)
    this.displayFill += (this.targetFill - this.displayFill) * k

    this.recomputeTargetScales(this.displayFill)
    if (this.bounce > 0.002) {
      this.bounce *= Math.exp(-STACK_BOUNCE_DECAY * dt)
    } else {
      this.bounce = 0
    }

    if (this.hitReact > 0.002) {
      this.hitReact *= Math.exp(-HIT_REACT_DECAY * dt)
    } else {
      this.hitReact = 0
    }

    const bounceMul = 1 + BOUNCE_SCALE_AMP * this.bounce
    this.curMul.x += (this.tgtMul.x * bounceMul - this.curMul.x) * k
    this.curMul.y += (this.tgtMul.y * bounceMul - this.curMul.y) * k
    this.curMul.z += (this.tgtMul.z * bounceMul - this.curMul.z) * k

    this.applyBagScale()
  }

  extractTopMeshForDeposit(item: GameItem): Object3D {
    const mesh = createDepositFlightProxy(item)
    if (this.bag) {
      this.bag.getWorldPosition(this.worldPos)
      this.worldPos.y += 0.42
    } else {
      this.anchor.getWorldPosition(this.worldPos)
      this.worldPos.y += 0.42
    }
    mesh.userData.depositWorldStart = this.worldPos.clone()
    return mesh
  }

  recycleDepositedMesh(_item: GameItem, mesh: Object3D): void {
    mesh.removeFromParent()
    disposeDepositFlightProxy(mesh)
  }

  private mountFreshBag(): void {
    if (isCarryBagReady()) {
      this.bag = cloneCarryBagMesh()
      this.bag.rotation.y = Math.PI
    } else {
      this.bag = this.createProceduralBag()
    }
    this.fitScale = Math.max(
      this.bag.scale.x,
      this.bag.scale.y,
      this.bag.scale.z,
      1e-4,
    )
    this.anchor.add(this.bag)
    this.recomputeTargetScales(0)
    this.curMul.copy(this.tgtMul)
    this.applyBagScale()
  }

  private recomputeTargetScales(fill: number): void {
    const t = fill
    const yR = BAG_Y_MIN + (BAG_Y_MAX - BAG_Y_MIN) * t
    const xzR = BAG_XZ_MIN + (BAG_XZ_MAX - BAG_XZ_MIN) * t
    const f = this.fitScale
    this.tgtMul.set(f * xzR, f * yR, f * xzR)
  }

  private applyBagScale(): void {
    if (!this.bag) return
    const h = this.hitReact
    const ySquash = 1 - 0.34 * h
    const xzBulge = 1 + 0.26 * h
    this.bag.scale.set(
      this.curMul.x * xzBulge,
      this.curMul.y * ySquash,
      this.curMul.z * xzBulge,
    )
  }

  private createProceduralBag(): Group {
    const root = new Group()
    root.name = 'carryBagProcedural'
    const mat = new MeshStandardMaterial({
      color: 0x7d6e58,
      roughness: 0.9,
      metalness: 0.05,
    })
    const body = new Mesh(new BoxGeometry(0.5, 0.55, 0.26), mat)
    body.position.y = 0.28
    body.castShadow = true
    body.receiveShadow = true
    root.add(body)
    const flap = new Mesh(new BoxGeometry(0.42, 0.12, 0.22), mat)
    flap.position.set(0, 0.52, 0.05)
    flap.rotation.x = -0.35
    flap.castShadow = true
    root.add(flap)
    root.userData.bagBaseScale = 1
    root.userData.carryBagProcedural = true
    return root
  }

  dispose(): void {
    if (!this.bag) return
    this.anchor.remove(this.bag)
    if (this.bag.userData.carryBagGltf === true) {
      disposeCarryBagClone(this.bag)
      return
    }
    this.bag.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose()
        const m = o.material
        if (Array.isArray(m)) m.forEach((x) => x.dispose())
        else m.dispose()
      }
    })
  }
}
