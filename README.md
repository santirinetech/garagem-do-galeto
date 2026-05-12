# 🍗 Galeto Master (SaaS) — Plataforma Completa de Gestão & Delivery

Bem-vindo ao repositório oficial do **Galeto Master**, um sistema de ponta a ponta projetado com foco em **Alta Performance, Escalabilidade e Automação**. Este projeto evoluiu de um simples protótipo local para uma solução comercial robusta (Software as a Service) ideal para galeterias, restaurantes e *dark kitchens*.

---

## 🌟 Vantagens Comerciais (O Valor do Produto)
- **Operação Híbrida:** Integração nativa de 3 frentes de vendas em um único painel (Pedidos via Site, Pedidos Manuais e **Atendimento 100% Autônomo via Robô de WhatsApp**).
- **Sem Custos de Hospedagem (Desktop Mode):** Empacotado em um executável autossuficiente (`.exe`), o Lojista roda a infraestrutura (Servidor Node, Banco de Dados Relacional) no próprio PC, sem depender de nuvem cara.
- **Blindagem Financeira (Pix Seguro):** O sistema automatizado *exige* a recepção da foto/arquivo do comprovante PIX via WhatsApp ou Site antes de liberar o envio do pedido para a cozinha.
- **Design "UAU" (Premium UX):** O cardápio digital possui design em *Glassmorphism*, paleta noturna (Dark Mode) moderna e interações suaves (Vanilla CSS/JS) que elevam a percepção de marca do restaurante.

---

## 🛠 Arquitetura e o que foi Implementado
O sistema está **100% refatorado e normalizado**, pronto para rodar em produção.

1. **Banco de Dados Relacional (3NF) - SQLite Dinâmico:**
   - Criação inteligente de tabelas (`clientes`, `produtos`, `pedido_itens`, `pedidos`, `estoque`).
   - Persistência segura em ambiente produtivo (`%APPDATA%/GaletoMaster`), evitando perdas de dados nas atualizações do sistema.
   - *Seeding* automático de produtos caso a loja instale o software pela primeira vez.

2. **Robô de WhatsApp Integrado (`whatsapp-web.js`):**
   - Escaneamento de QR Code nativo na dashboard.
   - Navegação em árvore de decisão (Menu > Carrinho > Entrega/Retirada > Pagamento > Troco/Comprovante).
   - Cálculo automático de frete por bairro injetado diretamente no fluxo da conversa.

3. **Backend & Segurança (Node.js/Express):**
   - Sistema seguro de Uploads (`Multer`) isolado em pastas do Windows para permissão de leitura/gravação.
   - Limite de taxa (Rate Limiter) de acesso às rotas da API para evitar abusos no servidor Web.
   - Comunicação em tempo real com a Dashboard usando **SSE (Server-Sent Events)** para piscar novos pedidos na tela.

---

## 📦 Como Baixar e Instalar (Guia do Usuário Final)
A entrega para o cliente final foi reduzida a zero atritos. Sem necessidade de terminais, NPM ou configurações de firewall:

1. **Baixar o Sistema:** Receba o instalador `GaletoMaster-Setup-1.0.0.exe`.
2. **Dois Cliques:** Execute o instalador e avance.
3. **Pronto para Uso:** Um atalho será criado na Área de Trabalho.
   - Ao clicar no atalho, o sistema em segundo plano "acorda" o servidor e abre a página de Login e o Dashboard.
   - **Primeiro Passo da Loja:** Na aba "Robô", escaneie o QR Code com o WhatsApp Business da Loja.
   - A operação já pode começar. O banco de dados e as fotos de comprovantes ficam salvas no PC, não necessitando de internet rápida.

---

## 🔮 Updates Futuros (Roadmap de Escalabilidade SaaS)
O sistema tem uma fundação madura pronta para os próximos passos da empresa:

- [ ] **Migração Total para Nuvem (Multi-Tenant AWS):** Permitir que vários restaurantes paguem assinatura mensal usando a mesma infraestrutura web.
- [ ] **Módulo de Fidelidade com IA:** O bot do WhatsApp analisará o histórico do cliente no banco de dados e enviará cupons personalizados nos dias em que as vendas são fracas.
- [ ] **Integração Externa (iFood API):** Receber pedidos do iFood diretamente na mesma Dashboard, acabando com a "guerra de tablets" no balcão.
- [ ] **Relatórios Fiscais Avançados:** Gráficos interativos (Chart.js) exportáveis em PDF detalhando horário de pico de pedidos.

---
**Santirine Tech — Engenharia de Software focada no Resultado.**
