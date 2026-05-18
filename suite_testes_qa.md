# 🧪 Suíte de Testes Manuais — Garagem do Galeto
**Versão:** Pós-limpeza / Pré-deploy  
**Ambiente:** Electron local (`npm start`) + N8N em rede  
**Banco:** `loja.db` (SQLite3)  
**Data de criação:** 2026-05-18

---

## PRÉ-CONDIÇÕES (executar antes de qualquer teste)

```powershell
# 1. Limpar banco de dados de teste
npm run db:clean:run

# 2. Confirmar estado limpo
node -e "
const db = new (require('sqlite3').Database)('loja.db');
db.each('SELECT name, (SELECT COUNT(*) FROM ' || name || ') as n FROM sqlite_master WHERE type=\"table\"', (e,r) => console.log(r));
"

# 3. Iniciar o sistema
npm start
```

**Estado esperado antes de começar:**

| Tabela | Registros esperados |
|---|---|
| `pedidos` | 0 |
| `clientes` | 0 |
| `itens_pedido` | 0 |
| `despesas` | 0 |
| `produtos` | ≥ 1 (ativos) |
| `regioes` | ≥ 1 |
| `usuarios` | 1 (admin) |

---

## BLOCO 1 — FLUXO DE PEDIDO MANUAL (BALCÃO)

### TC-01 — Lançar pedido manual com dados completos do cliente

**Prioridade:** 🔴 Crítico  
**Endpoint chamado:** `POST /api/novo-pedido`

| Campo | Valor de teste |
|---|---|
| Nome | `Teste QA Silva` |
| Telefone | `27999990001` |
| Produto | Selecionar 1 item do dropdown |
| Tipo | Retirada |
| Pagamento | Cartão |

**Passo a passo:**
1. Acessar o Painel Administrativo (`http://localhost:3000`)
2. Clicar em **"Lançar Pedido Manual"** (botão no topo do dashboard)
3. Preencher: Nome = `Teste QA Silva`, Telefone = `27999990001`
4. Selecionar pelo menos 1 produto no dropdown
5. Selecionar **Retirada** como tipo de entrega
6. Selecionar **Cartão** como pagamento
7. Clicar em **"Salvar"** / **"Lançar"**

**Resultado Esperado:**
- [ ] Modal fecha sem erro
- [ ] Card do pedido aparece imediatamente na tabela do dashboard com status `Pendente`
- [ ] Toast "Pedido Manual Lançado!" aparece no canto inferior direito
- [ ] Badge de pendentes no menu lateral incrementa +1

**Verificação no banco (abrir DevTools → Console ou rodar no terminal):**
```sql
-- Verificar se cliente foi criado (UPSERT)
SELECT id, nome, telefone, compras_qtd, valor_gasto FROM clientes WHERE telefone = '27999990001';
-- Esperado: 1 linha com compras_qtd = 1

-- Verificar pedido
SELECT id, cliente_id, status, total, forma_pagamento, origem FROM pedidos ORDER BY id DESC LIMIT 1;
-- Esperado: status = 'pendente', origem = 'WhatsApp/Balcão'

-- Verificar itens do pedido
SELECT ip.*, p.nome FROM itens_pedido ip JOIN produtos p ON ip.produto_id = p.id ORDER BY ip.id DESC LIMIT 5;
-- Esperado: 1 item com produto_id e preco_unitario corretos

-- Verificar que estoque foi decrementado
SELECT id, nome, quantidade_estoque FROM produtos ORDER BY id;
```

**O que monitorar em caso de falha:**
- Console do Electron: `Erro ao registrar pedido:` (server.js linha 232)
- Verificar se `itens` foi enviado como JSON válido no payload do fetch
- Checar se `telefone` não é vazio (campo obrigatório para UPSERT em `clientes`)

---

### TC-02 — Lançar pedido manual sem telefone (validação de campo obrigatório)

**Prioridade:** 🟡 Média

**Passo a passo:**
1. Abrir modal de pedido manual
2. Preencher Nome mas **deixar Telefone vazio**
3. Clicar em "Salvar"

**Resultado Esperado:**
- [ ] Alerta: `"Preencha o nome do cliente, adicione produtos e verifique o valor total."`
- [ ] Nenhum pedido criado no banco
- [ ] Modal permanece aberto

**Verificação:**
```sql
SELECT COUNT(*) FROM pedidos; -- Deve permanecer 0
```

---

### TC-03 — Impressão térmica via Electron

**Prioridade:** 🔴 Crítico  
**Pré-condição:** Pedido TC-01 já criado

**Passo a passo:**
1. Na tabela de pedidos, localizar o pedido de `Teste QA Silva`
2. Clicar no botão **Imprimir** (ícone de impressora)
3. Observar o comportamento

**Resultado Esperado (Electron com impressora configurada):**
- [ ] Sem erros no console
- [ ] Diálogo de impressão abre OU impressora térmica aciona silenciosamente
- [ ] Interface **não trava** durante o processo

**Resultado Esperado (browser sem impressora):**
- [ ] Toast `"Impressão enviada: Pedido #X"` (se `window.electronAPI` estiver disponível)
- [ ] OU janela de impressão do navegador abre com layout de cupom

**O que monitorar em caso de falha:**
```
// Console do processo principal do Electron:
Falha na impressão: [reason]   ← main.js linha 77

// Verificar se o payload tem os campos corretos:
p.pedido_descricao || p.pedido_desc  ← server.js retorna pedido_descricao
p.endereco_entrega || p.endereco
```

---

## BLOCO 2 — FLUXO DE LOGÍSTICA E CHECKOUT (CATÁLOGO)

### TC-04 — Entrega com região e taxa aplicada corretamente

**Prioridade:** 🔴 Crítico  
**URL:** `http://localhost:3000/cardapio.html`

**Pré-condição:**
```sql
-- Confirmar que existe ao menos 1 região cadastrada com taxa > 0
SELECT id, nome, taxa_entrega FROM regioes;
-- Ex: { id: 1, nome: "Centro", taxa_entrega: 5.00 }
```

**Passo a passo:**
1. Acessar o cardápio como cliente
2. Adicionar 1 ou mais produtos ao carrinho
3. Clicar em **"Ver Sacola"**
4. Selecionar tipo **"Entrega"**
5. Selecionar a região "Centro" (ou a disponível) no dropdown
6. Observar o resumo do pedido

**Resultado Esperado:**
- [ ] Linha "Taxa de Entrega: R$ 5,00" aparece no resumo
- [ ] Total = soma dos produtos + R$ 5,00
- [ ] Campo de rua/número e referência ficam visíveis
- [ ] Ao selecionar "Retirada", a taxa desaparece e o total ajusta

**Verificação numérica:**
```
Produto A: R$ 30,00
Taxa Centro: R$ 5,00
TOTAL ESPERADO: R$ 35,00
```

**O que monitorar em caso de falha:**
```js
// cardapio.js — verificar se taxa_entrega (não taxa) está sendo lido:
opt.dataset.taxa = r.taxa_entrega ?? r.taxa ?? 0;
// Se retornar 0, o campo no banco pode ser nulo
```
```sql
SELECT taxa_entrega FROM regioes WHERE id = 1;
-- Se NULL: UPDATE regioes SET taxa_entrega = 5.00 WHERE id = 1;
```

---

### TC-05 — Pagamento em Dinheiro com troco

**Prioridade:** 🟡 Média

**Passo a passo:**
1. Com produtos no carrinho, abrir a sacola
2. Selecionar pagamento **"Dinheiro"**
3. Observar se o campo "Troco para quanto?" aparece
4. Preencher o campo com `50`
5. Finalizar pedido

**Resultado Esperado:**
- [ ] Campo de troco aparece imediatamente ao selecionar Dinheiro
- [ ] Pedido criado com `forma_pagamento = 'Dinheiro'`
- [ ] Valor do troco é incluído na mensagem do WhatsApp

**Verificação:**
```sql
SELECT forma_pagamento, pedido_descricao FROM pedidos ORDER BY id DESC LIMIT 1;
```

---

### TC-06 — Pagamento PIX com upload de comprovante

**Prioridade:** 🔴 Crítico

**Passo a passo:**
1. Selecionar pagamento **"Pix"**
2. Verificar se a chave PIX é exibida na tela
3. Fazer upload de uma imagem qualquer como comprovante
4. Finalizar pedido

**Resultado Esperado:**
- [ ] Campo de upload de arquivo aparece
- [ ] Após finalizar, arquivo salvo em `public/uploads/`
- [ ] `comprovante_url` no banco aponta para `/uploads/[arquivo]`
- [ ] Mensagem WhatsApp inclui o link do comprovante

**Verificação:**
```sql
SELECT id, comprovante_url, forma_pagamento FROM pedidos ORDER BY id DESC LIMIT 1;
-- Esperado: comprovante_url = '/uploads/comprovante-xxxx.jpg'
```
```powershell
# Verificar se o arquivo existe fisicamente:
Get-ChildItem "public\uploads\" | Sort-Object LastWriteTime -Descending | Select-Object -First 3
```

**O que monitorar em caso de falha:**
- Verificar permissão de escrita em `public/uploads/`
- `req.file` pode ser `null` se multer não processou → checar `Content-Type: multipart/form-data`
- Endpoint usa `upload.single('comprovante')` (server.js linha 164)

---

## BLOCO 3 — INTEGRAÇÃO N8N E COMPORTAMENTO OFFLINE

### TC-07 — Pedido com N8N online (webhook disparado)

**Prioridade:** 🟡 Média  
**Pré-condição:** N8N rodando e webhook configurado

**Passo a passo:**
1. Criar qualquer pedido (via catálogo ou balcão)
2. Monitorar o terminal do Electron

**Resultado Esperado:**
- [ ] Pedido salvo no banco independentemente do N8N
- [ ] Log do N8N mostra recebimento do payload com `{ id, nome, telefone, total, status: 'Pendente' }`

**Verificação do payload enviado:**
```json
{
  "id": 1,
  "nome": "Teste QA Silva",
  "telefone": "27999990001",
  "pedido": "1x Galeto",
  "total": 35.00,
  "pagamento": "Cartão",
  "origem": "WhatsApp/Balcão",
  "status": "Pendente",
  "endereco": "Retirada no Local"
}
```

---

### TC-08 — Comportamento com N8N offline (resiliência crítica)

**Prioridade:** 🔴 Crítico  
**Este é o teste mais importante de estabilidade**

**Passo a passo:**
1. **Desligar** a conexão de internet (ou desligar o N8N)
2. Criar um pedido pelo catálogo
3. Mudar o status de um pedido no dashboard para "Preparando"
4. Observar o comportamento da interface

**Resultado Esperado:**
- [ ] Pedido é **salvo no banco** normalmente — banco é local, não depende de rede
- [ ] **Nenhum erro visível** para o usuário
- [ ] Interface não trava nem congela
- [ ] Toast/notificação de sucesso aparece normalmente

**O que confirma o comportamento correto no código:**
```js
// server.js linha 218-222 — webhook é fire-and-forget com .catch vazio:
fetch(N8N_URL, { ... }).catch(() => {});  // ← erro silenciado intencionalmente

// server.js linha 272-277 — webhook de status também é fire-and-forget:
fetch(N8N_URL, { ... }).catch(e => {});  // ← correto, não bloqueia
```

**⚠️ Ponto de atenção — O que NÃO deve acontecer:**
- [ ] Timeout do fetch não deve bloquear o `res.json()` para o cliente
- [ ] O SSE (`emitUpdate()`) deve continuar funcionando offline

**Verificação no banco após o teste offline:**
```sql
-- Confirmar que pedido foi salvo mesmo sem N8N:
SELECT id, status, total FROM pedidos ORDER BY id DESC LIMIT 1;
-- Deve existir com status 'pendente'
```

---

### TC-09 — Notificação WhatsApp ao mudar status

**Prioridade:** 🟡 Média  
**Pré-condição:** TC-01 executado, bot WhatsApp conectado

**Passo a passo:**
1. No dashboard, localizar o pedido de `Teste QA Silva`
2. Mudar o status para **"Preparando"**
3. Aguardar 5-10 segundos

**Resultado Esperado:**
- [ ] Status atualizado na tabela imediatamente
- [ ] Cliente recebe WhatsApp: *"Seu pedido #X já está sendo preparado com muito carinho..."*

**Mensagens esperadas por status (server.js linhas 257–267):**

| Status | Mensagem disparada |
|---|---|
| Preparando | *"...sendo preparado com muito carinho..."* |
| Saiu para Entrega | *"...acabou de sair para entrega..."* |
| Pronto para Retirada | *"...já está PRONTO para retirada!"* |
| Entregue / Retirado | *"Bom apetite e muito obrigado..."* |

**O que monitorar em caso de falha:**
```
// Console do Electron:
Erro ao enviar mensagem pelo robô: [erro]  ← whatsapp-bot.js linha 74

// Verificar se o bot está conectado:
✅ Robô do WhatsApp conectado e pronto!  ← whatsapp-bot.js linha 97
```

---

## BLOCO 4 — RELATÓRIO FINANCEIRO

### TC-10 — Cálculo de Lucro Líquido (validação matemática)

**Prioridade:** 🔴 Crítico  
**Endpoint:** `GET /api/relatorios?de=YYYY-MM-DD&ate=YYYY-MM-DD`

**Pré-condição — Popular dados de teste:**
```sql
-- Inserir 2 pedidos concluídos (status Entregue) com totais conhecidos
-- Já feito pelos testes TC-01 e TC-04, mudar status para "Entregue"

-- Inserir 1 despesa manual para validar o cálculo
INSERT INTO despesas (descricao, valor, categoria_id) VALUES ('Compra de gás (teste QA)', 50.00, 1);
```

**Passo a passo:**
1. No painel, ir para **Relatórios**
2. Selecionar período de hoje (ex: `2026-05-18` a `2026-05-18`)
3. Clicar em **"Gerar"**

**Dados de exemplo para validação:**

| Item | Valor |
|---|---|
| Pedido #1 (Entregue) | R$ 35,00 |
| Pedido #2 (Entregue) | R$ 42,00 |
| **Total Entradas** | **R$ 77,00** |
| Despesa: Compra de gás | R$ 50,00 |
| **Total Saídas** | **R$ 50,00** |
| **Lucro Líquido** | **R$ 27,00** |

**Resultado Esperado:**
- [ ] KPI "Total de Entradas" = R$ 77,00
- [ ] KPI "Total de Saídas" = R$ 50,00
- [ ] KPI "Lucro Líquido" = R$ 27,00 (cor verde se positivo)
- [ ] "2 pedidos concluídos" exibido no subtítulo

**Verificação SQL direta (fonte da verdade):**
```sql
-- Simular exatamente o que o /api/relatorios calcula:

-- Total entradas (apenas Entregue/Retirado):
SELECT SUM(total) AS entradas FROM pedidos
WHERE status IN ('Entregue','Retirado','entregue','retirado')
AND date(data_hora,'localtime') BETWEEN '2026-05-18' AND '2026-05-18';

-- Total saídas:
SELECT SUM(valor) AS saidas FROM despesas
WHERE date(data_hora,'localtime') BETWEEN '2026-05-18' AND '2026-05-18';

-- Lucro (deve ser: entradas - saidas):
-- Se entradas = 77 e saidas = 50, lucro = 27
```

**⚠️ Atenção importante:**
> Pedidos com status `pendente`, `Preparando` ou `Visto` **NÃO** contam nas entradas.
> Apenas `Entregue` e `Retirado` (e suas variantes em minúsculo) são contabilizados.
> Se o Lucro aparecer errado, verificar o campo `status` exato no banco.

---

### TC-11 — Ranking de produtos mais vendidos

**Prioridade:** 🟡 Média  
**Pré-condição:** Pelo menos 2 pedidos com `itens_pedido` preenchidos e status `Entregue`

**Resultado Esperado:**
- [ ] Tabela "Produtos Mais Vendidos" aparece com produtos ordenados por quantidade
- [ ] Colunas: Nome | Qtd Vendida | Receita

**Verificação SQL:**
```sql
-- O que o relatório deve mostrar:
SELECT pr.nome AS produto, 
       SUM(ip.quantidade) AS total_vendido, 
       SUM(ip.quantidade * ip.preco_unitario) AS receita
FROM itens_pedido ip
JOIN produtos pr ON ip.produto_id = pr.id
JOIN pedidos p ON ip.pedido_id = p.id
WHERE p.status IN ('Entregue','Retirado')
GROUP BY pr.id 
ORDER BY total_vendido DESC 
LIMIT 10;
```

**O que monitorar em caso de falha:**
- Se a tabela aparecer vazia: verificar se os pedidos têm `itens_pedido` associados (TC-01 deve ter gerado via dropdown)
- Pedidos criados via WhatsApp/catálogo antigo podem usar apenas `pedido_descricao` (campo texto), sem `itens_pedido` → não aparecem no ranking

---

## LOG DE EXECUÇÃO DOS TESTES

> Copie esta tabela e preencha durante a execução.

| Código | Descrição | ✅/❌ | Observação |
|--------|-----------|-------|------------|
| TC-01 | Pedido manual completo | | |
| TC-02 | Validação sem telefone | | |
| TC-03 | Impressão térmica | | |
| TC-04 | Taxa de entrega por região | | |
| TC-05 | Pagamento dinheiro + troco | | |
| TC-06 | PIX + upload comprovante | | |
| TC-07 | Webhook N8N online | | |
| TC-08 | Resiliência com N8N offline | | |
| TC-09 | Notificação WhatsApp por status | | |
| TC-10 | Lucro Líquido (validação matemática) | | |
| TC-11 | Ranking produtos mais vendidos | | |

---

## QUERIES DE DIAGNÓSTICO RÁPIDO

```sql
-- Estado geral do banco após os testes:
SELECT 'pedidos' as tabela, COUNT(*) as total FROM pedidos
UNION ALL SELECT 'clientes', COUNT(*) FROM clientes
UNION ALL SELECT 'itens_pedido', COUNT(*) FROM itens_pedido
UNION ALL SELECT 'despesas', COUNT(*) FROM despesas;

-- Último pedido com todos os campos relevantes:
SELECT p.id, c.nome, c.telefone, p.status, p.total, 
       p.forma_pagamento, p.origem, p.comprovante_url,
       p.pedido_descricao, p.endereco_entrega
FROM pedidos p 
LEFT JOIN clientes c ON p.cliente_id = c.id 
ORDER BY p.id DESC LIMIT 1;

-- Verificar integridade: pedidos sem cliente associado (não deve existir):
SELECT p.id FROM pedidos p WHERE p.cliente_id IS NULL;
```
