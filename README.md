<div align="center">

# `@starkbank/checkout-3ds`

**Stark Bank browser SDK — 3DS card authentication at checkout.**
JavaScript puro · zero runtime deps · drop-in via CDN.

[![runtime](https://img.shields.io/badge/runtime-browser-blue.svg)]()
[![deps](https://img.shields.io/badge/deps-0-success.svg)]()
[![license](https://img.shields.io/badge/license-Proprietary-lightgrey.svg)](./LICENSE)

</div>

---

SDK de autenticação 3DS 2.0 no checkout. Recebe os dados do cartão e do pedido, autentica o portador e devolve um `challenge` pronto pro backend Stark finalizar a cobrança.

```
input do merchant → 3DS authenticate → challenge pronto pro backend Stark
```

**Plataforma:** browser (ES2020+). **Distribuição:** CDN. **Deps em runtime:** zero.

---

## Sumário

1. [Em 5 minutos](#em-5-minutos)
2. [Instalação via CDN](#instalação-via-cdn)
3. [Content Security Policy](#content-security-policy)
4. [API pública](#api-pública)
5. [Runtime isolado (padrão)](#runtime-isolado-padrão)
6. [Comportamento operacional](#comportamento-operacional)
7. [Cartões de teste (sandbox)](#cartões-de-teste-sandbox)
8. [FAQ](#faq)
9. [Migrando de versão anterior](#migrando-de-versão-anterior)
10. [Scripts de desenvolvimento](#scripts-de-desenvolvimento)

---

## Em 5 minutos

```html
<script src="https://cdn.starkbank.com/checkout-3ds/v1/checkout-3ds.min.js"></script>
<script>
  const output = await Stark3DS.authenticate({
    accessToken: "JWT-DO-BACKEND",
    order: {
      number: "order-001",
      amount: 10000,                // em centavos
      currency: "BRL",              // ISO 4217 alpha
      installments: 1,
      paymentMethod: "credit",      // "credit" | "debit"
    },
    card: {
      number: "4111111111111111",
      expirationMonth: "12",
      expirationYear: "2030",
    },
  });

  if (Stark3DS.isAuthenticated(output)) {
    const challenge = Stark3DS.toChallengeResult(output);
    // POST challenge pro seu backend pra finalizar a compra
  }
</script>
```

É só isso. Detalhes nas próximas seções.

### Fluxo end-to-end

```
Merchant frontend                      Stark backend                3DS gateway
─────────────────                      ─────────────                ───────────
                  ① POST /merchant-purchase
                 ─────────────────────────►
                  ② JWT 3DS (accessToken)
                 ◄─────────────────────────
                  ③ Stark3DS.authenticate({ accessToken, order, card })
                                              ──── 3DS authenticate ──►
                                              ◄──── challenge ─────────
                  ④ challenge devolvido
                  ⑤ POST /finalize-purchase + challenge
                 ─────────────────────────►
```

---

## Instalação via CDN

```html
<script src="https://cdn.starkbank.com/checkout-3ds/v1/checkout-3ds.min.js"></script>
<script>
  // window.Stark3DS já está pronto
</script>
```

A partir deste ponto, `window.Stark3DS` expõe a API pública. **CDN é o canal oficial** — npm chega numa release futura (o build já gera ESM + CJS internamente).

---

## Content Security Policy

Se a sua aplicação usa CSP restritiva, solicite ao time Stark as origens necessárias pro gateway 3DS externo (`script-src` + `frame-src`). Sem CSP no site, nenhuma configuração é necessária.

---

## API pública

| Função | Descrição |
|---|---|
| `Stark3DS.authenticate(input)` | Faz a autenticação 3DS. Retorna `Promise<AuthenticateOutput>`. |
| `Stark3DS.isAuthenticated(output)` | `true` se 3DS autenticou e há `challenge` pronto. |
| `Stark3DS.toChallengeResult(output)` | Extrai o `challenge`. Lança se não autenticou. |
| `Stark3DS.isLiabilityShiftToIssuer(eci)` | `true` se o ECI (`01`/`02`/`05`) gera liability shift pro issuer. |

### Forma de `AuthenticateOutput`

```ts
{
  authentication: {
    status: "authenticated" | "failed" | "unenrolled" | "disabled"
            | "unsupported_brand" | "error",
    cavv?: string,
    eci?: string,
    xid?: string | null,
    version?: string,
    referenceId?: string,
    returnCode?: string,
    returnMessage?: string,
  },
  // presente apenas quando status === "authenticated":
  challenge?: {
    cavv: string,
    eci: string,
    version: string,
    xid: string | null,
    referenceId: string,
  }
}
```

### Classes de erro

| Classe | Quando |
|---|---|
| `Stark3DS.ValidationError` | Input inválido (cartão sem `expirationMonth`, currency não suportada, etc.) |
| `Stark3DS.AuthenticateTimeoutError` | 3DS não respondeu dentro do `authenticateTimeoutMs` (default 120s) |
| `Stark3DS.Error` | Erros genéricos do SDK (load de script falhou, adapter erro, etc.) |

Todas herdam de `Stark3DS.Error`. Capture pela base se quiser tratar tudo num catch só.

---

## Runtime isolado (padrão)

Por padrão, o SDK isola o runtime 3DS num `<iframe>` sandbox na mesma origem. **O integrador não precisa configurar nada** — basta chamar `authenticate()`.

Benefícios:

- ✅ Scripts e variáveis globais do gateway 3DS ficam **dentro do iframe**, não na sua página
- ✅ Reduz conflito com outros scripts e superfície de XSS

Se a loja usar CSP, ver [Content Security Policy](#content-security-policy).

### Opt-out (casos raros)

Só desative se tiver motivo (debug, ambiente sem suporte a iframe):

```js
Stark3DS.__configure({ isolateRuntime: false });
```

> `__configure` é API interna (`__` prefixo). Pode mudar entre versões. Uso típico do integrador: **nenhum**.

---

## Comportamento operacional

### Timeout

Default 120s. Customizar:

```js
Stark3DS.__configure({ authenticateTimeoutMs: 60000 }); // 60s
```

Quando estoura, o SDK rejeita com `Stark3DS.AuthenticateTimeoutError` e faz cleanup automático.

### Chamadas concorrentes

**Não permitido em paralelo.** O SDK serializa internamente via fila — múltiplas `authenticate()` em paralelo executam em ordem de chamada. Mas é melhor o consumidor não disparar em paralelo (não há vantagem).

### Single-session

O runtime 3DS interno é **single-session**. O SDK gerencia automaticamente: remove scripts e variáveis globais ao final de cada `authenticate()` (sucesso, falha ou timeout). Você não precisa fazer nada.

---

## Cartões de teste (sandbox)

Apontar `environment: "sandbox"` (default) e usar:

| Número | Cenário |
|---|---|
| `4000000000001091` | Authenticated |
| `4000000000001125` | Failed |
| `4000000000001158` | Unenrolled |
| `4000000000001182` | Error |

Lista completa: solicite ao time Stark.

---

## FAQ

**Posso usar com React/Vue/Angular?**
Sim. O SDK é vanilla JS, funciona em qualquer framework — chame `Stark3DS.authenticate(...)` de um effect/computed/method.

**Posso usar via npm?**
Não na release atual. CDN é o canal oficial. npm chega em release futura (o build já gera ESM + CJS).

**O SDK envia dados pro backend Stark?**
Não. O SDK fala apenas com o gateway 3DS via script externo. Você (merchant) recebe o `challenge` e envia pro seu backend Stark.

**Posso debugar?**

```js
Stark3DS.__configure({ debug: true });
```

Ativa modo debug no runtime 3DS.

**Como reportar bug?**
[Stark Bank — issues internas]

---

## Migrando de versão anterior

Se você usa a versão npm legada do SDK:

| Legacy (npm import) | CDN |
|---|---|
| `import { Stark3DS } from "@starkbank/checkout-3ds"` | `<script src="…/checkout-3ds.min.js">` → `window.Stark3DS` |
| `Stark3DS.authenticate(input)` | **idêntico** |
| `isAuthenticated(output)` | `Stark3DS.isAuthenticated(output)` |
| `toChallengeResult(output)` | `Stark3DS.toChallengeResult(output)` |
| `Stark3DSError`, `Stark3DSValidationError`, `Stark3DSAuthenticateTimeoutError` | `Stark3DS.Error`, `Stark3DS.ValidationError`, `Stark3DS.AuthenticateTimeoutError` |

Contrato e formato dos objetos preservados 100%. Só muda o canal (CDN em vez de bundler).

---

## Scripts de desenvolvimento

```bash
npm run build              # ESM + CJS + IIFE em dist/
npm test                   # vitest (unit)
npm run test:smoke         # smoke do bundle CDN
npm run generate:iso4217   # regenera src/utils/iso4217.js
```

---

## Referências

| Documento | Conteúdo |
|---|---|
| [`CHANGELOG.md`](./CHANGELOG.md) | Histórico de releases |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Gitflow, convenção de PR, setup |
| [`LICENSE`](./LICENSE) | Termos de uso |

---

<sub>© Stark Bank — proprietary.</sub>
