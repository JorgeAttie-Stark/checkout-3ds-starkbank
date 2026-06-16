export const ISOLATION_FRAME_ID = "starkbank-checkout-3ds-isolation-frame";

const FRAME_STYLE = [
  "position:fixed",
  "inset:0",
  "width:100%",
  "height:100%",
  "border:0",
  "z-index:2147483647",
  "background:transparent",
  "color-scheme:light",
].join(";");

const FRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-modals";

/**
 * @returns {{ document: Document, window: Window, destroy: () => void }}
 */
export function createIsolatedRuntime() {
  if (typeof document === "undefined") {
    throw new Error("3DS authentication requires a browser environment");
  }

  document.getElementById(ISOLATION_FRAME_ID)?.remove();

  const iframe = document.createElement("iframe");
  iframe.id = ISOLATION_FRAME_ID;
  iframe.title = "Stark Bank 3DS";
  iframe.setAttribute("sandbox", FRAME_SANDBOX);
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = FRAME_STYLE;

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error("Failed to initialize Stark 3DS isolation frame");
  }

  doc.open();
  doc.write(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"></head><body></body></html>',
  );
  doc.close();

  return {
    document: doc,
    window: win,
    destroy: () => {
      iframe.remove();
    },
  };
}
