import { afterEach, describe, expect, it } from "vitest";
import {
  ISOLATION_FRAME_ID,
  createIsolatedRuntime,
} from "../../../src/adapters/mpi/isolated-runtime.js";

afterEach(() => {
  document.getElementById(ISOLATION_FRAME_ID)?.remove();
});

describe("adapters/mpi/isolated-runtime", () => {
  it("cria iframe com id, sandbox e style esperados", () => {
    const runtime = createIsolatedRuntime();

    const iframe = document.getElementById(ISOLATION_FRAME_ID);
    expect(iframe).toBeTruthy();
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.getAttribute("sandbox")).toContain("allow-scripts");
    expect(iframe.getAttribute("sandbox")).toContain("allow-same-origin");
    expect(iframe.getAttribute("aria-hidden")).toBe("true");
    expect(iframe.title).toBe("Stark Bank 3DS");
    expect(iframe.style.position).toBe("fixed");
    expect(iframe.style.border).toBe("0px");
    expect(iframe.style.zIndex).toBe("2147483647");

    runtime.destroy();
  });

  it("expõe document e window do iframe (não do host)", () => {
    const runtime = createIsolatedRuntime();

    expect(runtime.document).toBeDefined();
    expect(runtime.window).toBeDefined();
    expect(runtime.document).not.toBe(document);
    expect(runtime.window).not.toBe(window);

    runtime.destroy();
  });

  it("destroy() remove o iframe do DOM", () => {
    const runtime = createIsolatedRuntime();
    expect(document.getElementById(ISOLATION_FRAME_ID)).toBeTruthy();

    runtime.destroy();

    expect(document.getElementById(ISOLATION_FRAME_ID)).toBeNull();
  });

  it("se já existe iframe com mesmo id, remove antes de criar novo", () => {
    const r1 = createIsolatedRuntime();
    const first = document.getElementById(ISOLATION_FRAME_ID);

    const r2 = createIsolatedRuntime();
    const second = document.getElementById(ISOLATION_FRAME_ID);

    expect(second).not.toBe(first);
    expect(document.querySelectorAll(`#${ISOLATION_FRAME_ID}`)).toHaveLength(1);

    r1.destroy();
    r2.destroy();
  });

  it("document do iframe está inicializado (body acessível)", () => {
    const runtime = createIsolatedRuntime();

    expect(runtime.document.body).toBeTruthy();
    expect(runtime.document.body.tagName).toBe("BODY");

    runtime.destroy();
  });

  it("destroy() é seguro chamar duas vezes (idempotente)", () => {
    const runtime = createIsolatedRuntime();
    runtime.destroy();
    expect(() => runtime.destroy()).not.toThrow();
  });
});
