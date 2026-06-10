---
name: cielo-mpi-3ds
description: Documentação oficial Cielo/Braspag MPI 3DS 2.0 — script de autenticação no browser, classes HTML `bpmpi_*`, função `bpmpi_authenticate()`, callbacks (`onSuccess`/`onFailure`/etc.), ECI e liability shift, URLs sandbox/produção, return codes. Aplica quando o trabalho toca `src/adapters/mpi/`, implementa/debuga 3DS, faz parity check com o as-is em `~/starkbank-checkout/packages/checkout-3ds/src/mpi/`, ou quando o usuário menciona "3DS", "MPI", "Braspag", "Cielo 3DS", "CAVV", "ECI", "liability shift", "bpmpi", ou "script de autenticação".
---

# Cielo/Braspag MPI 3DS 2.0 — referência completa

Esta skill cobre o **script de autenticação 3DS 2.0** que o SDK `@starkbank/checkout-3ds` empacota. Tudo aqui é da documentação oficial Cielo. Quando algo no projeto não bater com isso, **a doc é a fonte de verdade** — não a implementação atual.

---

## 1. O que é e como funciona

A autenticação 3DS 2.0 acontece no **browser do comprador**, antes da autorização. O fluxo:

1. O merchant inclui um `<script>` Braspag na página de checkout.
2. Preenche campos HTML hidden com classes `bpmpi_*` (dados do cartão, pedido, endereço, etc.).
3. Chama `bpmpi_authenticate()` (geralmente no onclick do botão "Pagar").
4. O script faz a comunicação com o emissor/bandeira.
5. Resultado vem por **callbacks** em `bpmpi_config()` — `onSuccess`, `onFailure`, `onUnenrolled`, `onDisabled`, `onError`, `onUnsupportedBrand`.
6. Se autenticado, merchant recebe `CAVV`, `Xid`, `Eci`, `Version`, `ReferenceId` — manda pro backend pra autorizar.

**Pontos críticos:**

- O **ECI** é quem decide se houve autenticação real e quem fica com o risco de chargeback. Eventos são complemento, não fonte de verdade.
- Transação **pode ser autorizada sem autenticar**, mas o risco vira do estabelecimento.

---

## 2. URLs e ambientes

| Ambiente | `Environment` (config) | URL do script |
|---|---|---|
| Sandbox (teste) | `"SDB"` | `https://mpisandbox.braspag.com.br/Scripts/BP.Mpi.3ds20.min.js` |
| Produção | `"PRD"` | `https://mpi.braspag.com.br/Scripts/BP.Mpi.3ds20.min.js` |

> **Importante:** ambos URL **e** flag `Environment` precisam mudar juntos. Trocar só um leva a comportamento inconsistente.

> **Sandbox:** o desafio 3DS só aparece se a página estiver servida por servidor web (Apache, Nginx, Node, etc.) em `localhost` — abrir HTML via `file://` não funciona.

---

## 3. Função de configuração — `bpmpi_config()`

Função global que o script Braspag chama na inicialização. Retorna um objeto com **callbacks** e **configuração**:

```js
function bpmpi_config() {
  return {
    onReady: function () {
      // Script terminou de carregar. Ativa botão de pagar.
      document.getElementById("btnSendOrder").disabled = false;
    },

    onSuccess: function (e) {
      // Cartão elegível + autenticação OK.
      // Liability shift TRANSFERIDO para o emissor.
      var cavv        = e.Cavv;
      var xid         = e.Xid;
      var eci         = e.Eci;
      var version     = e.Version;
      var referenceId = e.ReferenceId;
    },

    onFailure: function (e) {
      // Cartão elegível, mas autenticação falhou.
      // Liability shift PERMANECE com o estabelecimento.
      var xid         = e.Xid;
      var eci         = e.Eci;
      var version     = e.Version;
      var referenceId = e.ReferenceId;
    },

    onUnenrolled: function (e) {
      // Cartão NÃO elegível (portador/emissor fora do programa).
      // Liability shift PERMANECE com o estabelecimento.
      var xid         = e.Xid;
      var eci         = e.Eci;
      var version     = e.Version;
      var referenceId = e.ReferenceId;
    },

    onDisabled: function () {
      // Merchant optou por não autenticar (classe `bpmpi_auth` = false).
      // Liability shift PERMANECE com o estabelecimento.
    },

    onError: function (e) {
      // Erro sistêmico no processo.
      // Liability shift PERMANECE com o estabelecimento.
      var xid           = e.Xid;
      var eci           = e.Eci;
      var returnCode    = e.ReturnCode;
      var returnMessage = e.ReturnMessage;
      var referenceId   = e.ReferenceId;
    },

    onUnsupportedBrand: function (e) {
      // Bandeira não suportada pelo 3DS.
      var returnCode    = e.ReturnCode;
      var returnMessage = e.ReturnMessage;
    },

    Environment: "SDB",   // "SDB" | "PRD"
    Debug: true           // não deixar true em produção
  };
}
```

### Parâmetros de configuração

| Parâmetro | Tipo | Valores | Descrição |
|---|---|---|---|
| `Environment` ★ | string | `"SDB"`, `"PRD"` | Obrigatório. Ambiente Sandbox ou Produção. |
| `Debug` | boolean | `true`, `false` | Logs no console do browser. **Nunca `true` em produção.** |

---

## 4. Trigger da autenticação — `bpmpi_authenticate()`

Função global injetada pelo script Braspag. Chamar quando o usuário clica no botão de pagar:

```js
function sendOrder() {
  bpmpi_authenticate();
}
```

Ela lê os campos `bpmpi_*` do DOM, comunica com Braspag/emissor, e termina invocando o callback correspondente em `bpmpi_config()`.

---

## 5. Eventos / callbacks — semântica e liability

| Evento | Quando dispara | Variáveis no payload | Liability shift |
|---|---|---|---|
| `onReady` | Script carregado e token validado | — | n/a |
| `onSuccess` | Cartão elegível + autenticação OK | `Cavv`, `Xid`, `Eci`, `Version`, `ReferenceId` | **Emissor** |
| `onFailure` | Cartão elegível + autenticação falhou | `Xid`, `Eci`, `Version`, `ReferenceId` | Estabelecimento |
| `onUnenrolled` | Cartão/emissor não participa do programa | `Xid`, `Eci`, `Version`, `ReferenceId` | Estabelecimento |
| `onDisabled` | Merchant desligou autenticação (`bpmpi_auth=false`) | — | Estabelecimento |
| `onError` | Erro sistêmico | `Xid`, `Eci`, `ReturnCode`, `ReturnMessage`, `ReferenceId` | Estabelecimento |
| `onUnsupportedBrand` | Bandeira não suportada pelo 3DS | `ReturnCode`, `ReturnMessage` | Estabelecimento |

**Regra de ouro:** só `onSuccess` transfere risco. Todos os outros mantêm o risco com o lojista (mas a transação ainda pode seguir pra autorização).

---

## 6. Outputs — campos retornados pelos callbacks

| Campo | Descrição | Tipo | Tamanho |
|---|---|---|---|
| `Cavv` | Assinatura da autenticação | string | — |
| `Xid` | ID da requisição de autenticação | string | — |
| `Eci` | Código indicador de resultado (E-commerce Indicator) | string numérica | até 2 dígitos |
| `Version` | Versão do protocolo 3DS usado | numérica | `"2.1.0"` ou `"2.2.0"` |
| `ReferenceId` | ID GUID da requisição | GUID | 36 chars |
| `ReturnCode` | Código de retorno (só em `onError`/`onUnsupportedBrand`) | alfanumérico | até 5 chars |
| `ReturnMessage` | Mensagem (só em `onError`/`onUnsupportedBrand`) | alfanumérico | variável |

### Exemplos reais (da doc oficial)

**`onSuccess`:**
```json
{
  "Cavv": "Y2FyZGluYWxjb21tZXJjZWF1dGg=",
  "Xid": null,
  "Eci": "01",
  "Version": "2.2.0",
  "ReferenceId": "973cf83d-b378-43d5-84b6-ce1531475f2a"
}
```

**`onFailure` (erro genérico):**
```json
{
  "Xid": null,
  "Eci": null,
  "ReturnCode": "231",
  "ReturnMessage": "Unexpected error ocurred",
  "ReferenceId": null
}
```

**`onUnsupportedBrand`:**
```json
{
  "Xid": null,
  "Eci": null,
  "ReturnCode": "MPI600",
  "ReturnMessage": "Brand not supported for authentication",
  "ReferenceId": null
}
```

---

## 7. ECI — quem decide o liability shift

ECI (E-commerce Indicator) é o **único campo** que define se houve autenticação válida pro adquirente. Vem como string de até 2 dígitos.

| ECI normalizado (2 chars) | Significado | Liability |
|---|---|---|
| `01` | Autenticado (Mastercard/outras) | **Emissor** |
| `02` | Autenticado (Visa/outras) | **Emissor** |
| `05` | Autenticado (Visa) | **Emissor** |
| outros | Não autenticado / tentativa | Estabelecimento |

A função pública do SDK `Stark3DS.isLiabilityShiftToIssuer(eci)` retorna `true` para `01 | 02 | 05`. Normaliza com `padStart(2, "0")` (ECI `"5"` vira `"05"`).

> **Importante:** `onSuccess` quase sempre vem com ECI em 01/02/05, mas a regra de decisão definitiva é o ECI, não o evento. Implementações devem consultar `isLiabilityShiftToIssuer`.

---

## 8. Classes HTML — campos `bpmpi_*`

Tudo é injetado no DOM como `<input class="bpmpi_X" value="...">` (ou `<select>`). O script lê esses campos pelo nome da classe. Categorias:

### 8.1 Autenticação e token

| Classe | Valores / Descrição |
|---|---|
| `bpmpi_auth` | `"true"` / `"false"` — liga/desliga autenticação. `false` dispara `onDisabled`. |
| `bpmpi_auth_notifyonly` | `"true"` / `"false"` — modo Data Only (só notificação). |
| `bpmpi_accesstoken` | JWT obtido no passo "criar token de acesso". |

### 8.2 Dados da transação

| Classe | Descrição |
|---|---|
| `bpmpi_ordernumber` | Número do pedido do merchant. |
| `bpmpi_currency` | ISO 4217 numérico — `986` BRL, `840` USD, `032` ARS, etc. |
| `bpmpi_totalamount` | Valor total **em centavos** (string numérica). |
| `bpmpi_installments` | Número de parcelas. |
| `bpmpi_paymentmethod` | `"credit"` ou `"debit"`. |

### 8.3 Cartão

| Classe | Descrição |
|---|---|
| `bpmpi_cardnumber` | PAN. |
| `bpmpi_cardexpirationmonth` | Mês (2 dígitos). |
| `bpmpi_cardexpirationyear` | Ano (4 dígitos). |
| `bpmpi_cardalias` | Apelido do cartão (opcional). |
| `bpmpi_default_card` | `"true"` / `"false"` — cartão default do usuário. |

### 8.4 Recorrência

| Classe | Descrição |
|---|---|
| `bpmpi_recurring_enddate` | `YYYY-MM-DD`. |
| `bpmpi_recurring_frequency` | `1` mensal, `2` bimestral, `3` trimestral, `4` quadrimestral, `6` semestral, `12` anual. |
| `bpmpi_recurring_originalpurchasedate` | `YYYY-MM-DDTHH:mm:ss`. |

### 8.5 Gift card (opcional)

| Classe | Descrição |
|---|---|
| `bpmpi_giftcard_amount` | Valor em centavos. |
| `bpmpi_giftcard_currency` | ISO alfa-3 (`BRL`, etc.). |

### 8.6 Billing address (`bpmpi_billto_*`)

| Classe | Descrição |
|---|---|
| `bpmpi_billto_customerid` | CPF/CNPJ. |
| `bpmpi_merchant_newcustomer` | `"true"` / `"false"`. |
| `bpmpi_billto_name` | Nome. |
| `bpmpi_billto_phonenumber` | DDI+DDD+número, ex: `552122326381`. |
| `bpmpi_billto_email` | Email. |
| `bpmpi_billto_street1` | Logradouro. |
| `bpmpi_billto_street2` | Complemento. |
| `bpmpi_billto_city` | Cidade. |
| `bpmpi_billto_state` | UF (`RJ`, `SP`...). |
| `bpmpi_billto_country` | ISO alpha-2 (`BR`). |
| `bpmpi_billto_zipcode` | CEP sem máscara. |

### 8.7 Shipping address (`bpmpi_shipto_*`)

| Classe | Descrição |
|---|---|
| `bpmpi_shipto_sameasbillto` | `"true"` → demais campos não obrigatórios. |
| `bpmpi_shipto_name` | Destinatário. |
| `bpmpi_shipto_phonenumber` | Telefone. |
| `bpmpi_shipto_email` | Email. |
| `bpmpi_shipto_street1`/`street2`/`city`/`state`/`country`/`zipcode` | Mesmo formato de billing. |
| `bpmpi_shipto_shippingmethod` | Domínio próprio: `lowcost`, etc. (ver manual). |
| `bpmpi_shipto_lastusagedate` | `YYYY-MM-DD`. |

### 8.8 Device (`bpmpi_device_*`)

| Classe | Descrição |
|---|---|
| `bpmpi_device_ipaddress` | IP. |
| `bpmpi_device_1_fingerprint` | Fingerprint coletado (ex: Cardinal). |
| `bpmpi_device_1_provider` | `cardinal`, etc. (domínio no manual). |

> Padrão `_1_`, `_2_`... permite múltiplos providers de fingerprint na mesma chamada.

### 8.9 Carrinho — `bpmpi_cart_N_*` (coleção)

Para cada item (índice 1-based):

| Classe | Descrição |
|---|---|
| `bpmpi_cart_N_name` | Nome do item. |
| `bpmpi_cart_N_description` | Descrição. |
| `bpmpi_cart_N_sku` | SKU. |
| `bpmpi_cart_N_quantity` | Quantidade. |
| `bpmpi_cart_N_unitprice` | Preço unitário **em centavos**. |

### 8.10 Aéreo — `bpmpi_airline_*` (opcional, só pra cias aéreas)

**Trechos** (`bpmpi_airline_travelleg_N_*`):

| Classe | Descrição |
|---|---|
| `..._carrier` | Código IATA da cia (ex: `G3`). |
| `..._departuredate` | `YYYY-MM-DD`. |
| `..._origin` | IATA origem (3 letras). |
| `..._destination` | IATA destino. |

**Passageiros** (`bpmpi_airline_passenger_N_*`):

| Classe | Descrição |
|---|---|
| `..._name` | Nome. |
| `..._ticketprice` | Preço **em centavos**. |

**Complementares:**

| Classe | Descrição |
|---|---|
| `bpmpi_airline_numberofpassengers` | Total. |
| `bpmpi_airline_billto_passportcountry` | ISO alpha-2. |
| `bpmpi_airline_billto_passportnumber` | Número do passaporte. |

### 8.11 Order (`bpmpi_order_*` e afins)

| Classe | Descrição |
|---|---|
| `bpmpi_transaction_mode` | `R` (web), domínio no manual. |
| `bpmpi_merchant_url` | URL da loja. |
| `bpmpi_order_recurrence` | `"true"` / `"false"`. |
| `bpmpi_order_productcode` | Domínio próprio: `PHY` (físico), etc. |
| `bpmpi_order_countlast24hours` | Histórico do comprador (anti-fraude). |
| `bpmpi_order_countlast6months` | Idem. |
| `bpmpi_order_countlast1year` | Idem. |
| `bpmpi_order_cardattemptslast24hours` | Tentativas com cartão nas últimas 24h. |
| `bpmpi_order_marketingoptin` | `"true"` / `"false"`. |
| `bpmpi_order_marketingsource` | Texto livre (`mercadolivre`, etc.). |

### 8.12 User account (`bpmpi_useraccount_*`)

| Classe | Descrição |
|---|---|
| `bpmpi_useraccount_guest` | `"true"` se checkout sem cadastro. |
| `bpmpi_useraccount_createddate` | `YYYY-MM-DD`. |
| `bpmpi_useraccount_changeddate` | `YYYY-MM-DD`. |
| `bpmpi_useraccount_passwordchangeddate` | `YYYY-MM-DD`. |
| `bpmpi_useraccount_authenticationmethod` | Domínio no manual. |
| `bpmpi_useraccount_authenticationprotocol` | Texto (`oauth`, etc.). |
| `bpmpi_useraccount_authenticationtimestamp` | `YYYYMMDDHHmm`. |

### 8.13 Campos merchant-defined (`bpmpi_mdd1` a `bpmpi_mdd5`)

5 slots de texto livre para o merchant guardar metadados próprios.

---

## 9. Return codes conhecidos

| Code | Mensagem | Onde aparece |
|---|---|---|
| `231` | `Unexpected error ocurred` | `onError`/`onFailure` |
| `MPI600` | `Brand not supported for authentication` | `onUnsupportedBrand` |

Lista completa: ver "Tabela Lista de Return Codes" na doc Cielo (não reproduzida aqui).

---

## 10. Exemplo mínimo

HTML enxuto com o mínimo pra disparar 3DS:

```html
<html>
<head>
  <script>
    function sendOrder() { bpmpi_authenticate(); }

    function bpmpi_config() {
      return {
        onReady:           () => document.getElementById("btn").disabled = false,
        onSuccess:         (e) => console.log("AUTH OK", e),
        onFailure:         (e) => console.log("AUTH FAIL", e),
        onUnenrolled:      (e) => console.log("NOT ENROLLED", e),
        onDisabled:        ()  => console.log("DISABLED"),
        onError:           (e) => console.log("ERROR", e),
        onUnsupportedBrand:(e) => console.log("BRAND N/A", e),
        Environment: "SDB",
        Debug: true
      };
    }
  </script>
</head>
<body>
  <input class="bpmpi_auth"                value="true"  type="hidden">
  <input class="bpmpi_accesstoken"         value="<JWT>" type="hidden">
  <input class="bpmpi_ordernumber"         value="123">
  <input class="bpmpi_currency"            value="986">
  <input class="bpmpi_totalamount"         value="1000">
  <input class="bpmpi_installments"        value="1">
  <input class="bpmpi_paymentmethod"       value="credit">
  <input class="bpmpi_cardnumber"          value="4000000000000002">
  <input class="bpmpi_cardexpirationmonth" value="01">
  <input class="bpmpi_cardexpirationyear"  value="2030">

  <button id="btn" onclick="sendOrder()" disabled>Pagar</button>

  <script src="https://mpisandbox.braspag.com.br/Scripts/BP.Mpi.3ds20.min.js"></script>
</body>
</html>
```

---

## 11. Pegadinhas / invariantes que impactam o SDK

Da doc oficial + comportamento conhecido:

1. **Script é single-session.** Carregar o `<script>` Braspag duas vezes na mesma página, ou deixá-lo no DOM após uma `authenticate()`, faz a próxima chamada travar silenciosamente. **Por isso o adapter limpa o `<script>` após cada settle path** — ver invariante MPI no [`CLAUDE.md`](../../CLAUDE.md) do projeto.
2. **`Environment` e URL do script têm que casar.** Sandbox usa `"SDB"` + `mpisandbox.*`. Produção usa `"PRD"` + `mpi.*`. Misturar leva a comportamento inconsistente (geralmente token rejeitado).
3. **Token de acesso (`bpmpi_accesstoken`)** é JWT curto (~minutos). Não cachear no front por sessão inteira — gerar por checkout.
4. **Sandbox exige servidor web.** Abrir HTML por `file://` faz o desafio 3DS não renderizar.
5. **Eventos não são fonte de verdade pro adquirente — ECI é.** `onSuccess` é forte sinal, mas decisão de mandar autorização com liability transfer é via `isLiabilityShiftToIssuer(eci)`.
6. **`Debug: true` nunca em produção.** Vaza dados sensíveis (PAN parcial, fingerprint) no console.
7. **`onUnsupportedBrand` mata o fluxo cedo.** Bandeira fora do programa não passa pra outros callbacks. Backend tem que aceitar ECI vazio nesse caso (se merchant decidir seguir).

---

## 12. Como mapear isso no SDK (v2)

Esta skill descreve a API **externa**. O SDK encapsula tudo isso atrás de `Stark3DS.authenticate(input)`. Mapeamento prático:

| Doc Cielo | Onde mora no SDK |
|---|---|
| URLs sandbox/produção | `src/core/constants.js` → `MPI_SCRIPT_URLS` |
| Injeção do `<script>` | `src/adapters/mpi/script-loader.js` |
| Geração dos campos `bpmpi_*` no DOM | `src/adapters/mpi/dom-builder.js` |
| `bpmpi_config()` + callbacks | `src/adapters/mpi/callbacks.js` |
| Disparo de `bpmpi_authenticate()` | `src/adapters/mpi/browser-adapter.js` |
| Iframe sandbox (isola script Braspag) | `src/adapters/mpi/isolated-frame.js` |
| Mapping ISO 4217 alpha → numeric | `src/utils/currency.js` + `src/utils/iso4217.js` |
| `isLiabilityShiftToIssuer(eci)` | `src/utils/eci.js` |

Antes de tocar qualquer um desses, **reler a seção relevante desta skill** garante paridade com a doc oficial.

---

## 13. Referência cruzada

- **As-is (TS):** `~/starkbank-checkout/packages/checkout-3ds/src/mpi/` — implementação atual, usar como verdade de comportamento até a Fase 5 do rewrite.
- **Doc original Cielo:** https://docs.cielo.com.br/ecommerce-cielo/docs/ (seção "Autenticação 3DS" → "Integração do script de autenticação").
- **Invariante MPI no projeto:** [`CLAUDE.md`](../../CLAUDE.md).
