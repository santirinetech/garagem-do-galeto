# 🍗 Garagem do Galeto — Sistema de Gestão e Delivery

Sistema enxuto e escalável projetado para a gestão de uma galeteria, integrando pedidos web, controle de estoque, financeiro e notificações via WhatsApp.

## 🚀 Tecnologias Utilizadas

### Frontend
- **HTML5 & Vanilla CSS**: Interface premium com design moderno, glassmorphism e foco em UX mobile.
- **Vanilla JavaScript**: Lógica de cliente reativa sem dependências pesadas.
- **Google Fonts & Material Icons**: Tipografia refinada (Outfit/Inter) e iconografia consistente.

### Backend
- **Node.js & Express**: API RESTful robusta para processamento de pedidos e gestão.
- **SQLite3**: Banco de dados relacional leve e confiável para persistência local e em nuvem.
- **Multer**: Gestão de uploads de comprovantes de pagamento (PIX).

### Infraestrutura
- **PM2**: Gerenciador de processos para manter o sistema online 24/7 na VPS.
<<<<<<< HEAD
- **WhatsApp Integration**: Fluxo de transição Web para WhatsApp utilizando Deep Links (sem custo de API).
=======
- **WhatsApp Automation**: Integração via Webhooks (n8n/Evolution API) para notificações automáticas de status.
- **Thermal Printing**: Impressão automática de pedidos via Electron.
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)

---

## 🛠 Como Rodar o Projeto

### Pré-requisitos
- Node.js instalado (versão 16+)

### Instalação
1. Clone o repositório ou baixe os arquivos.
2. No diretório raiz, instale as dependências:
   ```bash
   npm install
   ```

### Execução Local (Modo Servidor)
Para testar o fluxo de pedidos e o Dashboard no navegador:
1. Inicie o servidor:
   ```bash
   npm run server
   ```
2. Acesse no navegador:
<<<<<<< HEAD
   - **Cardápio/Pedido**: `http://localhost:3000/cardapio.html`
   - **Dashboard/Gestão**: `http://localhost:3000/index.html`

### Execução Desktop (Modo Electron)
Para usar o sistema como um aplicativo dedicado:
=======
   - **Dashboard/Gestão**: `http://localhost:3000` (Redireciona para o Painel)
   - **Cardápio/Pedido**: `http://localhost:3000/cardapio.html`

### Execução Desktop (Modo Electron)
Para usar o sistema como um aplicativo dedicado com **impressão automática**:
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
```bash
npm start
```

<<<<<<< HEAD
=======
### Gerar Instalador (.exe)
Para criar o arquivo instalador para Windows:
```bash
npm run dist
```
O arquivo será gerado na pasta `/dist`.

>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
---

## 📋 Levantamento de Requisitos

### Requisitos Funcionais (Já Implementados)
- [x] **Cardápio Interativo**: Seleção de produtos com categorias e resumo de sacola.
- [x] **Checkout Ágil**: Captura de dados do cliente e forma de pagamento.
- [x] **Integração WhatsApp**: Envio automático de dados do pedido para o dono.
- [x] **Dashboard em Tempo Real**: Monitoramento de pedidos com polling automático.
- [x] **Gestão de Estoque**: Baixa automática e ajuste manual de itens.
- [x] **Financeiro**: Registro de despesas e cálculo de faturamento diário.
- [x] **Status "Visto"**: Controle de fluxo para evitar perda de pedidos.

### Requisitos de Segurança e LGPD (Em Implementação)
- [ ] **Consentimento LGPD**: Checkbox de aceite para coleta de dados de entrega.
- [ ] **Política de Privacidade**: Página transparente sobre o uso dos dados.
- [ ] **Segurança de Cabeçalhos**: Proteção contra ataques comuns na web.
- [ ] **Gestão de Dados**: Ferramenta para exclusão de dados de clientes no Dashboard.

---

## 🗺 Roadmap de Upgrades (Futuro)

1. **Fase 5 - Identidade Visual**: Implementação da marca final e assets personalizados.
2. **Fase 6 - Autenticação**: Sistema de login seguro para o Dashboard.
3. **Fase 7 - Cloud Storage**: Backup automático do banco de dados na nuvem.
4. **Fase 8 - CRM Marketing**: Automação de mensagens para clientes que não pedem há X dias.

---

## 📂 Estrutura do Projeto
- `/public`: Arquivos estáticos (HTML, CSS, JS do frontend).
- `/src`: Lógica do servidor, banco de dados e integração IPC.
- `loja.db`: Banco de dados SQLite principal.
- `server-standalone.js`: Entrypoint para execução via Web/VPS.

---
Desenvolvido por **Santirine Tech**
