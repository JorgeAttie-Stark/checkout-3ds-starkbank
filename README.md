<div align="center">

# `@starkbank/checkout-3ds`

**Stark Bank browser SDK — 3DS card authentication at checkout.**
JavaScript puro · zero runtime deps · drop-in via CDN ou npm.

[![status](https://img.shields.io/badge/status-alpha%20rewrite-orange.svg)]()
[![runtime](https://img.shields.io/badge/runtime-browser-blue.svg)]()
[![deps](https://img.shields.io/badge/deps-0-success.svg)]()
[![license](https://img.shields.io/badge/license-UNLICENSED-lightgrey.svg)]()

</div>

---

> **Este repo é o rewrite v2** do SDK que vive em `starkbank-checkout/packages/checkout-3ds`.
> Mesma API pública, JS puro, arquitetura por responsabilidade.
> Plano completo: [`PLANO-REFATORACAO.md`](./PLANO-REFATORACAO.md) (base) + [`PLANO-ARQUITETURA-V2.md`](./PLANO-ARQUITETURA-V2.md) (esta árvore).

> **Escopo v1:** **CDN-only.** O build gera ESM + CJS para não fechar a porta do npm — publicação npm fica para uma minor seguinte. Nada no código ou no `package.json` deve ser feito de forma que **impeça** o uso npm depois.

---

## Por que existe

O SDK envolve o **Braspag MPI 3DS 2.0** (Cielo/Braspag) e entrega ao merchant um único caminho feliz:

```
input do merchant → 3DS authenticate → challenge pronto pro backend Stark
```

A v2 troca **TypeScript + 30+ arquivos espalhados** por **JavaScript puro com vocabulário por responsabilidade**:

| Pergunta                         | Pasta             |
| -------------------------------- | ----------------- |
| O que o integrador importa?      | `api/`            |
| Qual caso de uso?                | `services/`       |
| O input é válido?                | `validation/`     |
| Como resolvemos ambiente?        | `config/`         |
| Com quem falamos por fora?       | `adapters/mpi/`   |
| Helpers puros / infra genérica?  | `utils/`          |
| Fundação compartilhada           | `core/`           |
| Doubles de teste                 | `testing/`        |

---

## Instalação

> **v1 = CDN-only.** Distribuição via npm é suportada pelo build (ESM + CJS gerados) mas **não é o canal oficial ainda** — virá em uma minor futura.

### Via CDN (oficial v1)

```html
<script src="https://cdn.jsdelivr.net/npm/@starkbank/checkout-3ds/dist/checkout-3ds.min.js"></script>
<script>
  // window.Stark3DS já está pronto
</script>
```

### Via npm (futuro — não publicado na v1)

O build já gera `dist/index.js` (ESM) e `dist/index.cjs` (CJS) e o `package.json` declara `exports`, então quando habilitarmos basta um `npm publish`. Até lá, **use CDN**.

```js
// Quando publicado:
import { Stark3DS, isAuthenticated } from "@starkbank/checkout-3ds";
```

---

## Uso

```js
const output = await Stark3DS.authenticate({
  environment: "sandbox",                 // "sandbox" | "production"
  accessToken: "merchant-3ds-token",
  order: {
    number: "ORDER-123",
    amount: 12990,                        // em centavos
    currency: "BRL",
    installments: 1,
  },
  card: {
    number: "5555666677778884",
    expirationMonth: "12",
    expirationYear: "2030",
    holderName: "JORGE ATTIE",
  },
  // address, shipping, cart, device — ver tipos públicos
});

if (Stark3DS.isAuthenticated(output)) {
  // output.challenge → mandar pro backend Stark
  await fetch("/api/charges", {
    method: "POST",
    body: JSON.stringify(output.challenge),
  });
} else {
  // output.authentication.status: "failed" | "unenrolled" | "error" | ...
}
```

> **Garantia da v2:** API pública 100% idêntica ao as-is. Cutover é troca de versão; código merchant não muda.

---

## Estrutura

```
checkout-3ds-js/
├── src/
│   ├── api/                       ← contrato público (zero lógica)
│   │   ├── index.js               ← npm: named exports
│   │   ├── cdn.js                 ← IIFE → window.Stark3DS
│   │   └── helpers.js             ← isAuthenticated, toChallengeResult
│   │
│   ├── services/
│   │   └── authenticate.js        ← orquestração do fluxo (era stark3ds.ts)
│   │
│   ├── validation/
│   │   └── input.js               ← validateInput + validateConfig
│   │
│   ├── config/
│   │   └── environment.js         ← resolve sandbox | production
│   │
│   ├── adapters/
│   │   └── mpi/                   ← integração externa Braspag
│   │       ├── browser-adapter.js     ← BrowserMpiAdapter + cleanup invariant
│   │       ├── script-loader.js       ← inject, retry, clearScriptLoadState
│   │       ├── dom-builder.js         ← campos hidden bpmpi_*
│   │       ├── isolated-frame.js      ← iframe sandbox
│   │       └── callbacks.js           ← MPI callbacks → result + challenge
│   │
│   ├── utils/
│   │   ├── auth-queue.js          ← serializa authenticate (MPI single-session)
│   │   ├── timeout.js             ← withTimeout ~120s
│   │   ├── currency.js            ← ISO alpha → numeric
│   │   ├── iso4217.js             ← gerado, não editar à mão
│   │   └── eci.js                 ← isLiabilityShiftToIssuer (puro)
│   │
│   ├── core/
│   │   ├── errors.js              ← Stark3DSError + subclasses
│   │   └── constants.js           ← MPI URLs, script element id, defaults
│   │
│   └── testing/
│       └── fake-mpi-adapter.js    ← double p/ testes (não publicar)
│
├── tests/                         ← espelha src/
├── scripts/
│   └── generate-iso4217.mjs       ← saída: src/utils/iso4217.js
├── build.config.mjs               ← esbuild API (ESM + CJS + IIFE)
├── vitest.config.js
├── vitest.smoke.config.js
├── package.json
├── README.md
├── CLAUDE.md                      ← invariantes MPI p/ Claude Code
└── PLANO-ARQUITETURA-V2.md        ← este plano
```

**Meta:** ~16 arquivos de produção, 1.200–1.300 LOC. Não esperar redução de 50% — o as-is não tem gordura óbvia, só ergonomia ruim.

---

## Contrato público (preservar 100%)

| Export                                         | Origem interna                  |
| ---------------------------------------------- | ------------------------------- |
| `Stark3DS.authenticate`                        | `services/authenticate.js`      |
| `Stark3DS.isLiabilityShiftToIssuer`            | `utils/eci.js`                  |
| `isAuthenticated`, `toChallengeResult`         | `api/helpers.js`                |
| `Stark3DSError`                                | `core/errors.js`                |
| `Stark3DSValidationError`                      | `core/errors.js`                |
| `Stark3DSAuthenticateTimeoutError`             | `core/errors.js`                |

**CDN (`api/cdn.js`):** mesmo set acima, com aliases `Error`, `ValidationError`, `AuthenticateTimeoutError`.

**Não expor:** `__configure`, `__setAdapterFactory`, `__resetAdapterFactory`, nada de `adapters/mpi/`.

---

## Invariante crítico (não negociável)

> O script Braspag MPI é **single-session**. Se ficar pendurado no DOM após uma `authenticate()` (sucesso, falha ou timeout), a próxima chamada **trava silenciosamente**.

**Onde mora:** `src/adapters/mpi/script-loader.js` (`clearScriptLoadState`) + `src/adapters/mpi/browser-adapter.js` (`cleanup()`).
**Como garantir:** todo settle path passa por `cleanup()`. Teste canary obrigatório em `tests/adapters/mpi/browser-adapter.test.js` — disparar `authenticate()` duas vezes seguidas.

Esse é o bug que motivou metade da complexidade do as-is. Não regredir.

---

## Pipeline de runtime

```
api/index.js  →  services/authenticate.js
  │
  ├─ validation/input.js
  ├─ config/environment.js
  ├─ utils/auth-queue.js               (enqueueAuthenticate)
  ├─ utils/timeout.js                  (withAuthenticateTimeout ~120s)
  ├─ adapters/mpi/browser-adapter.js
  │     ├─ adapters/mpi/isolated-frame.js
  │     ├─ adapters/mpi/dom-builder.js
  │     ├─ adapters/mpi/script-loader.js   (+ core/constants.js URLs)
  │     └─ adapters/mpi/callbacks.js
  └─ adapters/mpi/callbacks.js         (buildChallengeResult se authenticated)
```

---

## Fases do rewrite

| Fase | Escopo                                   | Esforço   | Risco |
| ---- | ---------------------------------------- | --------- | ----- |
| 0    | Bootstrap (árvore + stubs + build verde) | 1–2 dias  | Baixo |
| 1    | Camadas finas (validation/config/utils)  | 1–2 dias  | Baixo |
| 2    | Service + fake adapter                   | 1 dia     | Baixo |
| 3    | Adapter MPI (1:1 com as-is)              | 3–5 dias  | **Alto** |
| 4    | Consolidação (merge dom-builder/callbacks)| 1 dia    | Médio |
| 5    | Homolog E2E + cutover                    | 2–3 dias  | Médio |

**Total:** ~2–3 semanas.

---

## Scripts npm

```bash
npm run build              # ESM + CJS + IIFE (dist/)
npm run test               # vitest — unit tests (exclui smoke)
npm run test:smoke         # smoke do bundle IIFE
npm run test:watch         # vitest watch
npm run generate:iso4217   # regenera src/utils/iso4217.js
```

---

## Build

| Target  | Entry                | Saída                          |
| ------- | -------------------- | ------------------------------ |
| ESM     | `src/api/index.js`   | `dist/index.js`                |
| CJS     | `src/api/index.js`   | `dist/index.cjs`               |
| CDN IIFE| `src/api/cdn.js`     | `dist/checkout-3ds.min.js`     |

Sem `dist/index.d.ts` — projeto é JS puro. Tipos consumidos via JSDoc no editor.

---

## Governança

- **Gitflow:** `main` ← `release/*` / `hotfix/*`; `develop` ← `feature/*`. Detalhes em [CONTRIBUTING.md](./CONTRIBUTING.md).
- **1 fase ou 1 subpasta `adapters/mpi/*` por PR.**
- Nunca refatorar `services/authenticate.js` + `adapters/mpi/*` na mesma PR.
- PRs MPI **devem** ter checklist explícito do canary cleanup.
- `main` sempre deployável.

---

## Referências

| Documento                                                      | Conteúdo                        |
| -------------------------------------------------------------- | ------------------------------- |
| [`PLANO-REFATORACAO.md`](./PLANO-REFATORACAO.md)               | Plano base, invariantes, homolog|
| [`PLANO-ARQUITETURA-V2.md`](./PLANO-ARQUITETURA-V2.md)         | Esta árvore + mapa de portabilidade|
| [`CLAUDE.md`](./CLAUDE.md)                                     | Invariantes para Claude Code    |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md)                         | Gitflow, convenção de PR, setup |
| `../starkbank-checkout/packages/checkout-3ds/src/`             | As-is — fonte de verdade do comportamento |

---

<sub>© Stark Bank — uso interno.</sub>
