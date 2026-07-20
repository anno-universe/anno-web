export async function runBoundedTasks<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  if (items.length === 0) return;

  let cursor = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  async function worker() {
    while (!signal?.aborted) {
      const index = cursor++;
      if (index >= items.length) return;
      await task(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}
