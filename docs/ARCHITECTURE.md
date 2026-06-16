# Arquitetura — `@starkbank/checkout-3ds`

Guia interno pra desenvolvedores. Cobre estrutura, responsabilidades, pipeline de runtime, invariantes não-negociáveis e como estender o projeto sem quebrar paridade.

> **Cliente / integrador:** ver [`../README.md`](../README.md).
> **Invariante crítico do gateway 3DS:** ver [`../CLAUDE.md`](../CLAUDE.md).

---

## Em 30 segundos

- **JavaScript puro** (ES2020+), **zero deps em runtime**, **roda no browser**.
- 3 saídas de build: ESM, CJS, IIFE (CDN).
- Núcleo: 1 caso de uso (`authenticate`) que orquestra validação → fila → timeout → adapter → mapeamento de resultado.
- 1 adapter externo único: gateway 3DS (carregado via `<script>` em runtime).
- Vocabulário por **responsabilidade**, não por tipo de objeto (sem `controllers/`, `models/`, `repositories/`).

---

## Árvore de pastas

```
starkbank-3ds-checkout/
├── src/
│   ├── api/                 ← contrato público (zero lógica)
│   │   ├── index.js             entry ESM/CJS: named exports
│   │   ├── cdn.js               entry IIFE: window.Stark3DS
│   │   └── helpers.js           isAuthenticated, toChallengeResult
│   │
│   ├── services/            ← casos de uso (orquestração, sem DOM externo)
│   │   ├── authenticate.js      caso de uso principal
│   │   ├── config-store.js      __configure + singleton
│   │   ├── adapter-factory.js   factory injetável (DI pra testes)
│   │   └── challenge-result.js  buildChallengeResult (puro)
│   │
│   ├── adapters/
│   │   └── mpi/             ← integração externa com gateway 3DS
│   │       ├── browser-adapter.js   orquestra DOM + script + callbacks + cleanup
│   │       ├── script-loader.js     load + retry + clearScriptLoadState
│   │       ├── class-mapper.js      buildMpiContainer + removeMpiContainer
│   │       ├── mpi-fields.js        mapa de campos do gateway
│   │       ├── result-mapper.js     payload do gateway → AuthenticateResult
│   │       └── isolated-runtime.js  iframe sandbox dedicado
│   │
│   ├── validation/
│   │   └── input.js             validateAuthenticateInput + validateConfig
│   │
│   ├── config/
│   │   └── environment.js       resolveEnvironment, withResolvedEnvironment
│   │
│   ├── utils/               ← helpers puros, DOM-agnostic
│   │   ├── auth-queue.js        enqueueAuthenticate (serializa)
│   │   ├── timeout.js           withAuthenticateTimeout (utilitário)
│   │   ├── currency.js          ISO 4217 alpha → numeric
│   │   ├── iso4217.js           mapa gerado, não editar à mão
│   │   └── eci.js               isLiabilityShiftToIssuer
│   │
│   └── core/                ← fundação compartilhada
│       ├── errors.js            classes Stark3DSError + filhas
│       └── constants.js         URLs do gateway, IDs DOM, defaults
│
├── tests/                   ← espelha src/ + _helpers/
│   ├── _helpers/                doubles de teste (fora do bundle)
│   ├── adapters/mpi/
│   ├── api/
│   ├── config/
│   ├── services/
│   ├── utils/
│   ├── validation/
│   └── cdn.smoke.test.js        smoke do bundle IIFE
│
├── scripts/
│   └── generate-iso4217.mjs     gerador manual de src/utils/iso4217.js
│
├── docs/                    ← documentação interna (esta pasta)
│   ├── ARCHITECTURE.md
│   └── README.md                índice
│
├── build.config.mjs             esbuild (ESM + CJS + IIFE)
├── vitest.config.js             vitest unit
├── vitest.smoke.config.js       vitest smoke do bundle
├── package.json
├── README.md                ← cliente-facing
├── CHANGELOG.md
├── CONTRIBUTING.md
├── CLAUDE.md                ← invariantes pra Claude Code
└── LICENSE
```

---

## Pipeline de runtime

O que acontece quando o integrador chama `Stark3DS.authenticate(input)`:

```
Stark3DS.authenticate(input)                                                   ── api/cdn.js OU api/index.js
  │
  ▼
services/authenticate.js
  │
  ├─→ validation/input.js          valida input + config (lança ValidationError)
  ├─→ config/environment.js        resolve environment (sandbox | production)
  ├─→ services/config-store.js     lê config singleton (__configure)
  ├─→ utils/auth-queue.js          serializa: FIFO single-flight
  │     │
  │     ▼  dentro da fila:
  │     services/adapter-factory.js   pega factory (default ou injetada)
  │     │
  │     ▼
  │     new adapters/mpi/browser-adapter.js
  │       │
  │       ├─→ adapters/mpi/isolated-runtime.js     cria iframe sandbox (default)
  │       ├─→ adapters/mpi/class-mapper.js         buildMpiContainer (DOM hidden)
  │       │     └─→ adapters/mpi/mpi-fields.js     mapa de campos
  │       │           └─→ utils/currency.js        ISO → numeric
  │       ├─→ adapters/mpi/script-loader.js        injeta <script> com retry
  │       │     └─→ core/constants.js              URL do gateway
  │       ├─→ setTimeout(authenticateTimeoutMs)    timeout interno
  │       │
  │       ▼  callback do gateway dispara:
  │       adapters/mpi/result-mapper.js            payload → AuthenticateResult
  │       │
  │       ▼  cleanup (idempotente):
  │       ├─ clearTimeout
  │       ├─ class-mapper.removeMpiContainer
  │       ├─ script-loader.clearScriptLoadState
  │       └─ isolated-runtime.destroy
  │
  ▼
services/challenge-result.js     buildChallengeResult (se authenticated)
  │
  ▼
AuthenticateOutput devolvido ao integrador
```

**Erros tipados** sobem direto sem envelopamento:
- `Stark3DSValidationError` ← validation
- `Stark3DSAuthenticateTimeoutError` ← timeout interno do adapter
- `Stark3DSError` ← genéricos

---

## Arquivos por camada

### `src/api/` — contrato público

**Regra:** zero lógica, só re-exports e shape do objeto público. Quem mexe aqui está mudando contrato — pensa duas vezes.

| Arquivo | Responsabilidade | DOM/IO? |
|---|---|---|
| `index.js` | Entry point pra ESM e CJS. Named exports: `Stark3DS`, `isAuthenticated`, `toChallengeResult`, `isLiabilityShiftToIssuer`, classes de erro. | Não |
| `cdn.js` | Entry point pro IIFE bundle. Monta `window.Stark3DS` com aliases (`Error`, `ValidationError`, `AuthenticateTimeoutError`) e os helpers no mesmo namespace. | Não |
| `helpers.js` | `isAuthenticated(output)` e `toChallengeResult(output)`. Função puras sobre o objeto de output. | Não |

### `src/services/` — casos de uso (orquestração)

**Regra:** orquestra, não executa. Toca outras camadas via import; **não** toca DOM externo, **não** carrega scripts, **não** importa nada de `adapters/mpi/` diretamente fora de `adapter-factory`.

| Arquivo | Responsabilidade | DOM/IO? |
|---|---|---|
| `authenticate.js` | Caso de uso principal. Valida → resolve env → enfileira → instancia adapter via factory → mapeia output. | Não (delega) |
| `config-store.js` | `__configure(config)` (singleton interno) + `getEffectiveConfig()` + `__resetConfigForTests`. Valida via `validateConfig`. | Não |
| `adapter-factory.js` | `getAdapterFactory() / __setAdapterFactory / __resetAdapterFactory`. Permite injetar fake em testes. Default = `(config) => new BrowserMpiAdapter(config)`. | Não |
| `challenge-result.js` | `buildChallengeResult(authentication, orderNumber)` — função pura que monta o objeto `challenge` quando `authenticated`. | Não |

### `src/adapters/mpi/` — integração externa (única camada com DOM do gateway)

**Regra:** única camada autorizada a tocar DOM do gateway, `<script>` externo, callbacks globais, iframe sandbox. **Todo settle path passa por `cleanup()`** (sucesso, falha, timeout). Veja [`CLAUDE.md`](../CLAUDE.md) pro checklist canary.

| Arquivo | Responsabilidade | DOM/IO? |
|---|---|---|
| `browser-adapter.js` | Classe `BrowserMpiAdapter`. Orquestra container + script + callbacks + cleanup + timeout interno. **Hotspot do invariante.** | **Sim** |
| `script-loader.js` | `loadThreeDsScript` (load + retry) + `clearScriptLoadState` (remove `<script>` + apaga globais). Estado module-level. | **Sim** |
| `class-mapper.js` | `buildMpiContainer(input, doc)` — cria `<div>` hidden com inputs do cartão/pedido. `removeMpiContainer`. Não anexa. | **Sim** (constrói nó) |
| `mpi-fields.js` | `buildFullMpiFieldMap(input)` — mapa de campos derivado do input. Função pura sobre objeto. | Não |
| `result-mapper.js` | `mapSuccess`, `mapFailure`, `mapDisabled` — payload do gateway → `AuthenticateResult`. Função pura. | Não |
| `isolated-runtime.js` | `createIsolatedRuntime()` → `{ document, window, destroy }`. Cria iframe sandbox dedicado. | **Sim** |

### `src/validation/` — guard de input

| Arquivo | Responsabilidade | DOM/IO? |
|---|---|---|
| `input.js` | `validateAuthenticateInput(input)` + `validateConfig(config)`. Lançam `Stark3DSValidationError` com mensagem específica. Mensagens fazem parte do contrato. | Não |

### `src/config/` — resolução de ambiente

| Arquivo | Responsabilidade | DOM/IO? |
|---|---|---|
| `environment.js` | `resolveEnvironment(config, inputEnv)` — prioridade: input > config > `"sandbox"`. `withResolvedEnvironment` retorna config com env resolvido. | Não |

### `src/utils/` — helpers puros

**Regra:** DOM-agnostic. Pode usar `setTimeout`/`clearTimeout`/`Promise` mas **não** toca `document` nem `window`.

| Arquivo | Responsabilidade | DOM/IO? |
|---|---|---|
| `auth-queue.js` | `enqueueAuthenticate(fn)` — fila FIFO single-flight com `Promise` encadeada. `resetAuthenticateQueueForTests`. | Não |
| `timeout.js` | `withAuthenticateTimeout(promise, ms)` — race com timer, rejeita com `Stark3DSAuthenticateTimeoutError`. Utilitário genérico (hoje o adapter tem timeout próprio; este fica como fundação reutilizável). | Não |
| `currency.js` | `normalizeCurrencyCode`, `isSupportedCurrency`, `toIso4217Numeric`. ISO 4217 alpha → numeric. | Não |
| `iso4217.js` | **GERADO.** Mapa `{ "BRL": "986", ... }` exportado como `ISO4217_ALPHA_TO_NUMERIC`. Regenerar via `npm run generate:iso4217`. | Não |
| `eci.js` | `isLiabilityShiftToIssuer(eci)` — `true` se ECI ∈ `{01, 02, 05}`. Função pura. | Não |

### `src/core/` — fundação compartilhada

| Arquivo | Responsabilidade | DOM/IO? |
|---|---|---|
| `errors.js` | `Stark3DSError` + `Stark3DSValidationError` + `Stark3DSAuthenticateTimeoutError`. Hierarquia única. | Não |
| `constants.js` | `MPI_SCRIPT_ELEMENT_ID`, `MPI_SCRIPT_URLS` (sandbox/production), `getMpiScriptUrl`, `DEFAULT_AUTHENTICATE_TIMEOUT_MS`. | Não |

---

## Grafo de dependências (alto nível)

```
              api/  ──────────────► services/  ──────────────►  adapters/mpi/
                │                       │                            │
                │                       ▼                            ▼
                │                   validation/                    core/
                │                       │                            ▲
                │                       └──────► utils/  ────────────┘
                │                                 ▲
                │                                 │
                └─────────────────► core/ ────────┘
                                      │
                                      └─► constants, errors
```

**Direção válida:**

- `api/` depende de tudo.
- `services/` depende de `validation/`, `config/`, `utils/`, `core/`, `adapters/mpi/` (via factory).
- `adapters/mpi/` depende de `utils/` e `core/`. **Não importa de `services/`**.
- `utils/` depende só de `core/`. Sem DOM, sem rede.
- `core/` é folha. Não depende de ninguém.

**Quem viola, quebra a arquitetura.** Não tem regra automática que pega — leitura manual em PR review.

---

## Invariantes não-negociáveis

### 1. Cleanup do gateway 3DS

> O script do gateway 3DS é **single-session**. Se ficar pendurado após `authenticate()`, a próxima trava.

- **Onde mora:** `adapters/mpi/script-loader.js` (`clearScriptLoadState`) + `adapters/mpi/browser-adapter.js` (`cleanup`).
- **Regra:** todo settle path (sucesso, falha, timeout, builder throw, `createIsolatedRuntime` throw, load erro) **deve** passar por `cleanup()`. Idempotente via flag `settled`.
- **Teste canary obrigatório:** `tests/adapters/mpi/browser-adapter.test.js` — 2 `authenticate()` sequenciais devem completar. **Nunca remover esse teste.**

### 2. Contrato público preservado

> `Stark3DS.authenticate`, `isAuthenticated`, `toChallengeResult`, `isLiabilityShiftToIssuer` e classes de erro **não mudam de assinatura** sem mudança de major.

Mensagens de erro entram no contrato — merchants podem ter teste em cima.

### 3. APIs internas (`__configure`, `__setAdapterFactory`, `__resetAdapterFactory`) **não vão pro tarball**

São usadas em testes e homolog. Nunca expor publicamente em `api/index.js` ou `api/cdn.js` sem o prefixo `__`.

### 4. Direção de dependência

- `adapters/mpi/` **não** importa de `services/`.
- `utils/` **não** importa de `adapters/mpi/`.
- `core/` é folha.

---

## Como adicionar coisa nova (decision tree)

```
Vai adicionar lógica nova. Onde mora?

├─ Toca DOM externo, carrega <script>, mexe em globais do gateway?
│    └─► src/adapters/mpi/      (nova subpasta se for outro provider — improvável)
│
├─ É caso de uso de alto nível (orquestra outras camadas)?
│    └─► src/services/
│
├─ Valida input do integrador?
│    └─► src/validation/input.js
│
├─ Resolve ambiente / config?
│    └─► src/config/
│
├─ Helper puro (sem DOM externo, sem rede)?
│    ├─ Específico do domínio 3DS?     → src/utils/
│    └─ Fundação (erro, constante)?    → src/core/
│
└─ Mudança no contrato público?
     └─► src/api/   (cuidado — versionar como major se quebrar)
```

**Antes de criar pasta nova:** confirma se não cabe em existente. Pastas extras fragmentam o vocabulário.

---

## Build

`build.config.mjs` chama o esbuild com 3 saídas:

| Target | Entry | Saída | Formato |
|---|---|---|---|
| ESM | `src/api/index.js` | `dist/index.js` + sourcemap | ESM |
| CJS | `src/api/index.js` | `dist/index.cjs` + sourcemap | CJS |
| IIFE (CDN) | `src/api/cdn.js` | `dist/checkout-3ds.min.js` | IIFE minificado, footer monta `window.Stark3DS` |

Bundle CDN atual: ~11.3kb minificado, **zero dependências externas**.

**`prebuild`** limpa `dist/`. **`prepublishOnly`** roda build + test + smoke antes de qualquer `npm publish`.

---

## Testes

```
tests/
├── _helpers/                    ← doubles (fora do bundle)
│   └── fake-mpi-adapter.js          createFakeMpiAdapter(behavior)
│
├── adapters/mpi/                ← espelha src/adapters/mpi/
│   ├── browser-adapter.test.js      ← CANARY MORA AQUI
│   ├── script-loader.test.js
│   ├── class-mapper.test.js
│   ├── mpi-fields.test.js
│   ├── result-mapper.test.js
│   └── isolated-runtime.test.js
│
├── api/index.test.js            ← contrato público
├── config/environment.test.js
├── services/                    ← espelha src/services/
│   ├── authenticate.test.js
│   ├── config-store.test.js
│   └── adapter-factory.test.js
├── utils/
│   ├── auth-queue.test.js
│   └── timeout.test.js
├── validation/input.test.js
└── cdn.smoke.test.js            ← carrega dist/checkout-3ds.min.js e valida API exposta
```

**Comandos:**

```bash
npm test                # vitest (unit) — exclui smoke
npm run test:smoke      # vitest smoke contra dist/
npm run test:watch      # watch mode
```

Configs:

- `vitest.config.js` — `environment: "jsdom"`, exclui smoke
- `vitest.smoke.config.js` — só smoke

### Padrões de teste

- **Fakes em `tests/_helpers/`, nunca em `src/`** — não vazam pro bundle.
- **Cleanup obrigatório no `afterEach`** quando o teste polui `document` / `window` / módulo singleton (`scriptLoader.resetScriptLoaderForTests`).
- **Fake timers** (`vi.useFakeTimers`) pra testar timeout / retry sem espera real.
- **Canary do `browser-adapter.test.js` nunca é skipado.**

---

## Geração de assets

### `scripts/generate-iso4217.mjs`

Baixa CSV oficial de [datasets/currency-codes](https://github.com/datasets/currency-codes), gera `src/utils/iso4217.js` com o mapa `{ "BRL": "986", ... }`.

**Quando rodar:** ISO 4217 publica atualização (raro, ~1× por ano). O arquivo gerado é commitado — cliente recebe o mapa pronto no bundle.

```bash
npm run generate:iso4217
```

Não roda automaticamente em build/test/publish.

---

## Governança de PR

- **PR tem escopo único e revisável.**
- **1 subpasta `adapters/mpi/*` por PR** quando o trabalho mexer nessa camada.
- **Nunca misturar `services/authenticate.js` + `adapters/mpi/*` na mesma PR.**
- PRs que tocam `adapters/mpi/*`: incluir checklist canary cleanup no corpo (ver [`CLAUDE.md`](../CLAUDE.md)).

Detalhes completos em [`../CONTRIBUTING.md`](../CONTRIBUTING.md).

---

## O que **NÃO** fazer

- ❌ Adicionar dep npm em runtime. Zero deps é regra dura.
- ❌ Importar de `adapters/mpi/` direto em `services/authenticate.js`. Sempre via `adapter-factory`.
- ❌ Criar `controllers/`, `models/`, `repositories/`. SDK browser não tem esse modelo.
- ❌ Editar `src/utils/iso4217.js` à mão. Regenerar.
- ❌ Tocar DOM do gateway fora de `adapters/mpi/`.
- ❌ Remover ou skipar canary cleanup.
- ❌ Trocar mensagens de erro sem versionar major.
- ❌ Expor `__configure`, `__setAdapterFactory`, `__resetAdapterFactory` em `api/`.
