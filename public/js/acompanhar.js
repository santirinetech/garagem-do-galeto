const params = new URLSearchParams(window.location.search);
const id = params.get('id');

async function checarStatus() {
    if (!id) {
        document.getElementById('loader').innerHTML = '<p class="error">Pedido não encontrado.</p>';
        return;
    }
    try {
        const res = await fetch('/api/pedido/' + id);
        if (!res.ok) throw new Error('Falha');
        const data = await res.json();
        
        document.getElementById('loader').style.display = 'none';
        document.getElementById('status-container').style.display = 'block';

        const badge = document.getElementById('s-badge');
        const box = document.getElementById('s-box');
        const msg = document.getElementById('s-msg');

        badge.textContent = data.status;
        
        // Lógica de cores baseada no status
        box.className = 'status-box';
        badge.style.background = 'var(--red)';
        
        if (data.status === 'Preparando') {
            box.classList.add('s-EmPreparo');
            badge.style.background = '#2563eb';
            msg.textContent = 'Estamos preparando seu pedido com muito carinho! O cheirinho já está bom.';
        } else if (data.status === 'Saiu para Entrega') {
            box.classList.add('s-Pronto');
            badge.style.background = '#f59e0b';
            msg.textContent = 'O motoboy já saiu para entrega! Fique atento(a) no seu endereço.';
        } else if (data.status === 'Entregue') {
            box.classList.add('s-Entregue');
            badge.style.background = 'var(--ink-3)';
            msg.textContent = 'Pedido finalizado. Muito obrigado pela preferência e bom apetite!';
        } else if (data.status === 'Cancelado') {
            box.classList.add('s-Entregue');
            badge.style.background = 'var(--red)';
            msg.textContent = 'Infelizmente este pedido foi cancelado. Qualquer dúvida, chame no WhatsApp.';
        }

        document.getElementById('p-desc').textContent = data.pedido_desc;
        document.getElementById('p-pag').textContent = 'Pagameto: ' + data.forma_pagamento;
        document.getElementById('p-total').textContent = 'Total: ' + (data.total).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

    } catch(e) {
        document.getElementById('loader').innerHTML = '<p class="error">Erro ao buscar status do pedido.</p>';
    }
}

checarStatus();
// Atualiza a cada 10 segundos
setInterval(checarStatus, 10000);
