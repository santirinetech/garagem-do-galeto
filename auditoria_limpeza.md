# 🧹 Auditoria de Limpeza — Garagem do Galeto

## 1. BANCO DE DADOS — Script de Limpeza

### Dry-run (ver o que será apagado — seguro)
```powershell
npm run db:clean
```

### Execução real (apaga dados de teste)
```powershell
npm run db:clean:run
```

> **O script faz backup automático** antes de apagar qualquer coisa.
> Formato: `loja_backup_2026-05-18T...db` na mesma pasta.

### Estado atual do banco (conforme dry-run)

| Tabela              | Registros | Ação       |
|---------------------|-----------|------------|
| `itens_pedido`      | 0         | 🗑 Limpar  |
| `enderecos`         | 0         | 🗑 Limpar  |
| `pedidos`           | **17**    | 🗑 Limpar  |
| `despesas`          | 0         | 🗑 Limpar  |
| `clientes`          | **6**     | 🗑 Limpar  |
| `usuarios`          | 1         | 🔒 Manter  |
| `regioes`           | 1         | 🔒 Manter  |
| `categoria_produtos`| 3         | 🔒 Manter  |
| `produtos`          | 5         | 🔒 Manter  |
| `categoria_despesas`| 6         | 🔒 Manter  |

O `VACUUM` é executado automaticamente ao final para compactar o arquivo `.db`.

---

## 2. CÓDIGO — Problemas Identificados

### 2a. Dados hardcoded no front-end

> **Risco:** Se o número de telefone ou chave PIX mudar, requer alteração no código.

**Localização:** `public/js/cardapio.js`

| Linha | Problema | Solução |
|-------|----------|---------|
| L2 | `const NUMERO_DONO = "5527988573982"` | Mover para tabela `configuracoes` no banco |
| L191 | `Chave PIX: 27988573982` (hardcoded no HTML) | Idem — buscar via `/api/config` |

**Como corrigir:**
1. Criar tabela `configuracoes (chave TEXT, valor TEXT)` no banco
2. Popular: `INSERT INTO configuracoes VALUES ('whatsapp', '5527988573982'), ('pix_chave', '27988573982')`
3. Criar endpoint `GET /api/config` no server.js
4. Substituir a constante no cardapio.js por uma chamada fetch na inicialização

---

### 2b. Diretório abandonado (dead code de arquivos)

**Encontrado:** `src/public/` — versão antiga do painel/catálogo, **não é servida** pelo servidor atual.

```
src/public/
├── cardapio/js/app.js     ← versão legada, com console.error
└── dashboard/
    ├── index.html         (6.6 KB)
    └── js/app.js          ← versão legada, com console.error
```

**Ação recomendada:**
```powershell
# Verificar se algo importa esses arquivos antes de remover
# (nenhuma referência encontrada no server.js atual)

Remove-Item -Recurse -Force "src\public"
git add -A; git commit -m "chore: remove src/public legacy abandoned files"
```

---

### 2c. `console.log` — auditoria

Todos os logs encontrados em `src/` são **válidos para produção ou depuração esperada:**

| Arquivo | Linha | Log | Manter? |
|---------|-------|-----|---------|
| `whatsapp-bot.js` | 90 | QR Code recebido | ✅ Necessário |
| `whatsapp-bot.js` | 97 | Robô conectado | ✅ Necessário |
| `whatsapp-bot.js` | 104 | Desconectado | ✅ Necessário |
| `whatsapp-bot.js` | 74 | `console.error` | ✅ Manter |
| `server.js` | 232 | `console.error` pedido | ✅ Manter |
| `server.js` | 668 | Servidor rodando | ✅ Necessário |
| `main.js` | 77 | Falha na impressão | ✅ Manter |

> **Conclusão:** Não há console.log de debug para remover no código ativo.

---

### 2d. Dados de configuração no whatsapp-bot.js

Verificar se há telefones hardcoded no bot:
```powershell
Select-String -Path "src\whatsapp-bot.js" -Pattern "5527|whatsapp|numero|phone"
```

---

## 3. DEPENDÊNCIAS — Análise

### Todas as dependências estão sendo usadas:

| Pacote | Usado em | Necessário? |
|--------|----------|-------------|
| `bcryptjs` | `src/database.js` (seed admin) + `src/server.js` (login) | ✅ |
| `body-parser` | `src/server.js` + `src/main/server.js` | ✅ |
| `cors` | `src/server.js` + `src/main/server.js` | ✅ |
| `express` | Ambos servers | ✅ |
| `express-rate-limit` | `src/server.js` | ✅ |
| `express-session` | `src/server.js` | ✅ |
| `helmet` | `src/server.js` | ✅ |
| `multer` | `src/server.js` (upload comprovante) | ✅ |
| `qrcode` | `src/whatsapp-bot.js` | ✅ |
| `sqlite3` | `src/database.js` | ✅ |
| `whatsapp-web.js` | `src/whatsapp-bot.js` | ✅ |

### Rodar análise formal de dependências

```powershell
npm run lint:deps
```

> Equivale a: `npx depcheck --ignores=electron,electron-builder,nodemon`

### Possível candidato a remover

**`body-parser`** — desde Express 4.16+, `express.json()` e `express.urlencoded()` são built-in.
Verificar se pode substituir:
```powershell
Select-String -Path "src\server.js" -Pattern "bodyParser"
```
Se usar apenas `bodyParser.json()` e `bodyParser.urlencoded()`, pode substituir por:
```js
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
// e remover: npm uninstall body-parser
```

---

## 4. CHECKLIST DE EXECUÇÃO

```
[ ] 1. npm run db:clean              ← verificar dry-run
[ ] 2. npm run db:clean:run          ← executar limpeza real
[ ] 3. Remove-Item -Recurse src\public  ← remover arquivos legados
[ ] 4. Mover NUMERO_DONO e PIX para o banco de dados
[ ] 5. npm run lint:deps             ← verificar dependências (requer Node)
[ ] 6. Testar body-parser → express.json() (opcional)
[ ] 7. git add -A; git commit -m "chore: cleanup, remove legacy code, clean db"
```

---

## 5. COMANDOS RÁPIDOS PARA O VS CODE

**Buscar hardcoded no projeto inteiro:**
- `Ctrl+Shift+F` → buscar: `5527` ou `27988` → verifique cardapio.js
- `Ctrl+Shift+F` → buscar: `console.log` → nenhum crítico encontrado
- `Ctrl+Shift+F` → buscar: `TODO|FIXME|HACK|XXX` → possíveis dívidas técnicas
