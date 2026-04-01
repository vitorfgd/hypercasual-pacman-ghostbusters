/**
 * Barrel: mansion world layout — geometry, room data, and `RoomSystem`.
 * Prefer importing from specific modules when you only need one concern.
 */

export * from './mansionGeometry.ts'
export * from './mansionRoomData.ts'
export { RoomSystem, type AreaId } from './RoomSystem.ts'
