export const DEFAULT_AUTHENTICATE_TIMEOUT_MS = 120_000;

export const MPI_SCRIPT_ELEMENT_ID = "starkbank-checkout-3ds-script";

export const MPI_SCRIPT_URLS = Object.freeze({
  sandbox: "https://mpisandbox.braspag.com.br/Scripts/BP.Mpi.3ds20.min.js",
  production: "https://mpi.braspag.com.br/Scripts/BP.Mpi.3ds20.min.js",
});

export function getMpiScriptUrl(environment) {
  const url = MPI_SCRIPT_URLS[environment];
  if (!url) {
    throw new Error(`Unknown environment for MPI script URL: ${environment}`);
  }
  return url;
}
