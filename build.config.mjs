import { build } from "esbuild";

const shared = {
  bundle: true,
  target: "es2020",
  platform: "browser",
  logLevel: "info",
};

await Promise.all([
  build({
    ...shared,
    entryPoints: ["src/api/index.js"],
    outfile: "dist/index.js",
    format: "esm",
    sourcemap: true,
  }),
  build({
    ...shared,
    entryPoints: ["src/api/index.js"],
    outfile: "dist/index.cjs",
    format: "cjs",
    sourcemap: true,
    platform: "neutral",
    mainFields: ["module", "main"],
  }),
  build({
    ...shared,
    entryPoints: { "checkout-3ds.min": "src/api/cdn.js" },
    outdir: "dist",
    format: "iife",
    globalName: "__Stark3DSBundle__",
    minify: true,
    footer: {
      js: "window.Stark3DS=__Stark3DSBundle__.default;delete window.__Stark3DSBundle__;",
    },
  }),
]);
