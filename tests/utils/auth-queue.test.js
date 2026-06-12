import { beforeEach, describe, expect, it } from "vitest";
import {
  enqueueAuthenticate,
  resetAuthenticateQueueForTests,
} from "../../src/utils/auth-queue.js";

describe("enqueueAuthenticate", () => {
  beforeEach(() => {
    resetAuthenticateQueueForTests();
  });

  it("runs a single task and returns its value", async () => {
    await expect(enqueueAuthenticate(() => Promise.resolve("ok"))).resolves.toBe(
      "ok",
    );
  });

  it("runs tasks in FIFO order", async () => {
    const log = [];
    const task = (id) => () =>
      Promise.resolve().then(() => {
        log.push(id);
      });

    await Promise.all([
      enqueueAuthenticate(task(1)),
      enqueueAuthenticate(task(2)),
      enqueueAuthenticate(task(3)),
    ]);

    expect(log).toEqual([1, 2, 3]);
  });

  it("keeps running next tasks after one rejects", async () => {
    const log = [];

    const first = enqueueAuthenticate(() => Promise.reject(new Error("boom")));
    const second = enqueueAuthenticate(() =>
      Promise.resolve().then(() => {
        log.push("second");
        return "ok";
      }),
    );

    await expect(first).rejects.toThrow("boom");
    await expect(second).resolves.toBe("ok");
    expect(log).toEqual(["second"]);
  });

  it("does not start next task until current settles", async () => {
    let firstResolve;
    let secondStarted = false;

    const first = enqueueAuthenticate(
      () => new Promise((resolve) => { firstResolve = resolve; }),
    );
    const second = enqueueAuthenticate(() => {
      secondStarted = true;
      return Promise.resolve();
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(secondStarted).toBe(false);

    firstResolve();
    await first;
    await second;
    expect(secondStarted).toBe(true);
  });

  it("resetAuthenticateQueueForTests clears pending state", async () => {
    enqueueAuthenticate(() => new Promise(() => {}));
    resetAuthenticateQueueForTests();

    const log = [];
    await enqueueAuthenticate(() => {
      log.push("ran");
      return Promise.resolve();
    });
    expect(log).toEqual(["ran"]);
  });
});
