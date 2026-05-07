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
- **WhatsApp Automation**: Integração via Webhooks (n8n/Evolution API) para notificações automáticas de status.
- **Thermal Printing**: Impressão automática de pedidos via Electron.

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
   - **Dashboard/Gestão**: `http://localhost:3000` (Redireciona para o Painel)
   - **Cardápio/Pedido**: `http://localhost:3000/cardapio.html`

### Execução Desktop (Modo Electron)
Para usar o sistema como um aplicativo dedicado com **impressão automática**:
```bash
npm start
```

### Gerar Instalador (.exe)
Para criar o arquivo instalador para Windows:
```bash
npm run dist
```
O arquivo será gerado na pasta `/dist`.

---

## 📋 Levantamento de Requisitos

### Requisitos Funcionais (Já Implementados)
- [x] **Cardápio Interativo**: Seleção de produtos com categorias e resumo de sacola.
- [x] **Checkout Ágil**: Captura de dados do cliente e forma de pagamento.
- [x] **Entrega e Retirada**: Seleção de modalidade e campos de endereço.
- [x] **Taxas por Região**: Gerenciamento de taxas de entrega personalizáveis.
- [x] **Integração WhatsApp**: Envio automático de dados do pedido para o dono.
- [x] **Dashboard em Tempo Real**: Monitoramento de pedidos com SSE e Polling.
- [x] **Impressão Térmica**: Suporte a impressão silenciosa via Electron.
- [x] **Gestão de Estoque**: Baixa automática e ajuste manual de itens.
- [x] **Financeiro**: Registro de despesas e cálculo de faturamento diário.
- [x] **Segurança**: Sistema de login para o Dashboard.

### Requisitos de Segurança e LGPD
- [x] **Consentimento LGPD**: Checkbox de aceite para coleta de dados.
- [x] **Política de Privacidade**: Página transparente sobre o uso dos dados.
- [x] **Gestão de Dados**: Ferramenta para exclusão de dados de clientes no Dashboard.

---

## 📂 Estrutura do Projeto
- `/public`: Arquivos estáticos (HTML, CSS, JS do frontend).
- `/src`: Lógica do servidor, banco de dados e integração IPC.
- `loja.db`: Banco de dados SQLite principal.

---
Desenvolvido por **Santirine Tech**
