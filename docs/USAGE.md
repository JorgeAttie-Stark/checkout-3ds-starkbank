# Guia de uso — Stark 3DS

SDK browser pra autenticação 3DS 2.0 de cartão no checkout.

**Plataforma:** browser (ES2020+). Zero runtime deps.
**Distribuição v1:** CDN. npm vem em minor futura.

---

## 1. Inclusão via CDN

```html
<script src="https://cdn.starkbank.com/checkout-3ds/v1.0.0/checkout-3ds.min.js"></script>
<script>
  // window.Stark3DS já está pronto
</script>
```

A partir deste ponto, `window.Stark3DS` expõe a API pública.

### CSP (Content Security Policy)

O SDK carrega um script externo de runtime 3DS em tempo de execução. Permita:

```
script-src 'self' https://mpisandbox.braspag.com.br https://mpi.braspag.com.br;
frame-src 'self';
```

O SDK isola o runtime 3DS num iframe sandbox na mesma origem (comportamento padrão). `frame-src 'self'` só é necessário se a loja usar CSP.

> Os domínios acima são fixos e pertencem ao gateway 3DS usado pelo SDK. Não dependem do merchant.

---

## 2. Uso mínimo

```js
const output = await Stark3DS.authenticate({
  accessToken: "JWT-DO-BACKEND",              // emitido pelo seu backend Stark
  order: {
    number: "order-001",
    amount: 10000,                            // em centavos
    currency: "BRL",                          // ISO 4217 alpha (BRL, USD, EUR…)
    installments: 1,
    paymentMethod: "credit",                  // "credit" | "debit"
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
```

### Fluxo completo

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

## 3. API pública

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

### Erros

| Classe | Quando |
|---|---|
| `Stark3DS.ValidationError` | Input inválido (cartão sem expirationMonth, currency não suportada, etc.) |
| `Stark3DS.AuthenticateTimeoutError` | 3DS não respondeu dentro do `authenticateTimeoutMs` (default 120s) |
| `Stark3DS.Error` | Erros genéricos do SDK (load de script falhou, adapter erro, etc.) |

Todas herdam de `Stark3DS.Error`. Capture pela base se quiser tratar tudo num catch só.

---

## 4. Runtime isolado (padrão)

Por padrão, o SDK isola o runtime 3DS num `<iframe>` sandbox na mesma origem. **O integrador não precisa configurar nada** — basta chamar `authenticate()`.

Benefícios:
- ✅ Scripts e variáveis globais do gateway 3DS ficam **dentro do iframe**, não na sua página
- ✅ Reduz conflito com outros scripts e superfície de XSS

Se a loja usar CSP, inclua `frame-src 'self'` (ver §1).

### Opt-out (casos raros)

Só desative se tiver motivo (debug, ambiente sem suporte a iframe):

```js
Stark3DS.__configure({ isolateRuntime: false });
```

> `__configure` é API interna (`__` prefixo). Pode mudar entre versões. Uso típico do integrador: **nenhum**.

---

## 5. Comportamento operacional

### Timeout
Default 120s. Customizar:
```js
Stark3DS.__configure({ authenticateTimeoutMs: 60000 }); // 60s
```

### Chamadas concorrentes
**Não permitido em paralelo.** O SDK serializa internamente via fila — múltiplas `authenticate()` em paralelo executam em ordem de chamada. Mas é melhor o consumidor não disparar em paralelo (não há vantagem).

### Single-session
O runtime 3DS interno é **single-session**. O SDK gerencia automaticamente: remove scripts e variáveis globais ao final de cada `authenticate()` (sucesso, falha ou timeout). Você não precisa fazer nada.

---

## 6. Cartões de teste (sandbox)

Apontar `environment: "sandbox"` (default) e usar:

| Número | Cenário |
|---|---|
| `4000000000001091` | Authenticated |
| `4000000000001125` | Failed |
| `4000000000001158` | Unenrolled |
| `4000000000001182` | Error |

Lista completa: solicite ao time Stark.

---

## 7. FAQ

**Posso usar com React/Vue/Angular?**
Sim. O SDK é vanilla JS, funciona em qualquer framework — chame `Stark3DS.authenticate(...)` de um effect/computed/method.

**Posso usar via npm?**
Não na v1. CDN é o canal oficial. npm chega em minor futura (o build já gera ESM + CJS).

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

## 8. Migrando de versão anterior

Se você usa a versão npm legada do SDK:

| Legacy (npm import) | CDN |
|---|---|
| `import { Stark3DS } from "@starkbank/checkout-3ds"` | `<script src="…/checkout-3ds.min.js">` → `window.Stark3DS` |
| `Stark3DS.authenticate(input)` | **idêntico** |
| `isAuthenticated(output)` | `Stark3DS.isAuthenticated(output)` |
| `toChallengeResult(output)` | `Stark3DS.toChallengeResult(output)` |
| `Stark3DSError`, `Stark3DSValidationError`, `Stark3DSAuthenticateTimeoutError` | `Stark3DS.Error`, `Stark3DS.ValidationError`, `Stark3DS.AuthenticateTimeoutError` |

Contrato e formato dos objetos preservados 100%. Só muda o canal (CDN em vez de bundler).
