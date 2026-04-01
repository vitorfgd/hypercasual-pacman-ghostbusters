export class PerfMonitor {
  private readonly frameMs: number[] = []
  private readonly drawCalls: number[] = []
  private readonly collectCounts: number[] = []
  private frameStartMs = 0
  private nextLogAtMs = 0

  beginFrame(nowMs: number): void {
    this.frameStartMs = nowMs
  }

  endFrame(drawCallCount: number, collectedThisFrame: number): void {
    const now = performance.now()
    const dt = now - this.frameStartMs
    this.pushBounded(this.frameMs, dt, 240)
    this.pushBounded(this.drawCalls, drawCallCount, 240)
    this.pushBounded(this.collectCounts, collectedThisFrame, 240)
    if (!this.debugEnabled()) return
    if (now < this.nextLogAtMs) return
    this.nextLogAtMs = now + 2000
    const p95 = this.percentile(this.frameMs, 0.95).toFixed(2)
    const p99 = this.percentile(this.frameMs, 0.99).toFixed(2)
    const avgCalls = this.average(this.drawCalls).toFixed(1)
    const burstCollect = Math.max(...this.collectCounts, 0)
    console.info(
      `[perf] p95=${p95}ms p99=${p99}ms drawCalls(avg)=${avgCalls} collectBurst=${burstCollect}`,
    )
  }

  private debugEnabled(): boolean {
    const w = window as Window & { __perfDebug?: boolean }
    return w.__perfDebug === true
  }

  private pushBounded(arr: number[], value: number, max: number): void {
    arr.push(value)
    if (arr.length > max) arr.shift()
  }

  private average(arr: readonly number[]): number {
    if (arr.length === 0) return 0
    let sum = 0
    for (const x of arr) sum += x
    return sum / arr.length
  }

  private percentile(arr: readonly number[], p: number): number {
    if (arr.length === 0) return 0
    const s = [...arr].sort((a, b) => a - b)
    const idx = Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))
    return s[idx]!
  }
}
