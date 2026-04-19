# 📖 Guia Operacional — Garagem do Galeto

Este guia explica como utilizar o sistema no dia a dia para garantir uma operação eficiente e sem erros.

## 1. Como Abrir a Garagem
O sistema roda em uma VPS (Servidor na Nuvem), o que significa que ele está pronto para receber pedidos **24 horas por dia**.

Para começar a trabalhar:
1.  Acesse o link do **Dashboard** (Gestão).
2.  Verifique o **Estoque** para garantir que as quantidades de Galetos, Salpicaõ e Bebidas estão corretas.
3.  Cclique em **"Atualizar"** para garantir que a conexão está ativa.

---

## 2. Recebendo e Processando Pedidos

O fluxo do pedido é o seguinte:
1.  **O Cliente faz o pedido** no site.
2.  **Você recebe uma notificação no WhatsApp** com o resumo e o número do pedido (ex: Pedido #125).
3.  **No Dashboard**, o novo pedido aparecerá no topo da lista com o status **"Pendente"**.
4.  **Ação Recomendada:** Clique no botão **"Visto"** 👁. Isso avisa ao sistema (e a quem mais estiver operando) que você já iniciou o atendimento.
5.  **Preparo/Entrega:** Mude o status conforme o progresso:
    - **Preparando**: Carne na brasa.
    - **Saiu para Entrega**: Em trânsito com o motoboy.
    - **Entregue**: Pedido concluído.

---

## 3. Gestão de Pagamentos (Pix)
Sempre que um pedido for via Pix:
1.  O cliente é obrigado a anexar o **Comprovante**.
2.  No Dashboard, haverá um link **"Ver Comprovante"**.
3.  🔔 **Atenção**: Sempre confira o valor no seu aplicativo de banco antes de liberar o pedido para entrega.

---

## 4. Controle de Estoque
O sistema dá **baixa automática** nos galetos e guarnições ao receber um novo pedido.
- Se você precisar "travar" a venda de um item que acabou, basta zerar a quantidade na aba **Estoque**.
- Itens com estoque baixo (menos de 5 unidades) ficarão em destaque vermelho.

---

## 5. Fechamento do Dia
Ao final do expediente:
1.  Confira o **Faturamento Hoje** no topo da Dashboard.
2.  Lance as **Despesas** (sangrias, compras extras, pagamentos de motoboy) para ter o saldo limpo.
3.  O sistema guarda o histórico completo na aba **Histórico**, caso precise conferir algum valor depois.

---

## 6. Primeiros Socorros (O sistema parou?)
Como o sistema roda via **PM2** no servidor, ele se reinicia sozinho em caso de erros simples.
Se nada carregar:
1. Verifique se a sua internet está ok.
2. Se o erro persistir, peça para o suporte técnico verificar o status da VPS.

---
Santirine Tech — Excelência em Automação.
