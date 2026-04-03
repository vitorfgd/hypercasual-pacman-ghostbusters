import type { ItemWorld } from '../items/ItemWorld.ts'
import type { NormalRoomId } from '../world/mansionRoomData.ts'
import type { RoomGridPlan } from './planRoomGrids.ts'
/**
 * Spawns all grid wisps for the run. Room accessibility for locked rooms uses the same
 * `visible` flag clutter used (`isRoomAccessible`).
 */
export function spawnGridWispsForPlans(
  plans: ReadonlyMap<NormalRoomId, RoomGridPlan>,
  itemWorld: ItemWorld,
  isRoomAccessible: (roomId: NormalRoomId) => boolean,
  createGridWispItem: (
    id: string,
    hue: number,
    value: number,
    roomId: NormalRoomId,
  ) => import('../../core/types/GameItem.ts').WispItem,
  random: () => number,
): void {
  for (const [roomId, plan] of plans) {
    for (const w of plan.wisps) {
      const hue = 0.48 + random() * 0.1
      const item = createGridWispItem(
        w.id,
        hue,
        4 + Math.floor(random() * 8),
        roomId,
      )
      itemWorld.spawn(item, w.x, w.z, {
        visible: isRoomAccessible(roomId),
      })
    }
  }
}
