import { describe, expect, it } from "vitest";
import { runBoundedTasks } from "./concurrency";

describe("runBoundedTasks", () => {
  it("never exceeds the configured concurrency", async () => {
    let active = 0;
    let peak = 0;
    const completed: number[] = [];

    await runBoundedTasks([1, 2, 3, 4, 5, 6], 3, async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      completed.push(item);
      active -= 1;
    });

    expect(peak).toBe(3);
    expect(completed.sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("does not start more tasks after cancellation", async () => {
    const controller = new AbortController();
    const started: number[] = [];

    await runBoundedTasks(
      [1, 2, 3, 4, 5],
      2,
      async (item) => {
        started.push(item);
        controller.abort();
      },
      controller.signal
    );

    expect(started).toEqual([1]);
  });
});
