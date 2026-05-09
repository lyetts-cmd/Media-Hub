export class Semaphore {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(private readonly limit: number) {}

  acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.running < this.limit) {
        this.running++;
        resolve();
      } else {
        this.queue.push(() => {
          this.running++;
          resolve();
        });
      }
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

export const transcodeSemaphore = new Semaphore(1);
