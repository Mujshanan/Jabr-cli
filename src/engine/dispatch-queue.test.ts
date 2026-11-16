import { describe, expect, it } from "vitest";
import { createDispatchQueue } from "./dispatch-queue";

describe("createDispatchQueue", () => {
  it("runs asynchronous commands in submission order", async () => {
    const enqueue = createDispatchQueue();
    const events: string[] = [];
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });

    const first = enqueue(async () => {
      events.push("first:start");
      markFirstStarted();
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      events.push("first:end");
    });
    const second = enqueue(async () => {
      events.push("second");
    });

    await firstStarted;
    expect(events).toEqual(["first:start"]);

    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(["first:start", "first:end", "second"]);
  });

  it("continues processing after a command rejects", async () => {
    const enqueue = createDispatchQueue();
    const events: string[] = [];

    const failed = enqueue(async () => {
      events.push("failed");
      throw new Error("expected failure");
    });
    const next = enqueue(async () => {
      events.push("next");
    });

    await expect(failed).rejects.toThrow("expected failure");
    await next;
    expect(events).toEqual(["failed", "next"]);
  });
});
