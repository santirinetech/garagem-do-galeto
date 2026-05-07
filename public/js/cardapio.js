// ── CONFIGURAÇÕES ──
const API_URL = '/api/novo-pedido';
const NUMERO_DONO = "5527988573982";

// ── ESTADO GLOBAL ──
window.carrinho = [];
window.pagSelecionado = 'Pix';
window.tipoEntrega = 'Entrega';
window.regioes = [];
window.freteAtual = 0;
let idCounter = 0;

// ── FUNÇÕES DO CARRINHO ──
window.addItem = function(nome, preco) {
    if (navigator.vibrate) navigator.vibrate(40);
    window.carrinho.push({ id: ++idCounter, nome, preco });
    atualizarBarra();
}

window.remItem = function(id) {
    window.carrinho = window.carrinho.filter(i => i.id !== id);
    atualizarBarra();
    renderResumo();
}

function totalCarrinho() {
    return window.carrinho.reduce((a, i) => a + i.preco, 0);
}

function atualizarBarra() {
    const qtd = window.carrinho.length;
    const tot = totalCarrinho();
    const qtdLabel = document.getElementById('cart-qtd-label');
    const totLabel = document.getElementById('cart-total-label');
    const bar = document.getElementById('cart-bar');

    if (qtdLabel) qtdLabel.textContent = `${qtd} ITEM${qtd !== 1 ? 'S' : ''}`;
    if (totLabel) totLabel.textContent = tot.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (bar) bar.style.display = qtd > 0 ? 'flex' : 'none';
}

// ── FILTROS ──
window.filtrarCat = function(cat, btn) {
    document.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('ativo'));
    if (btn) btn.classList.add('ativo');

    document.querySelectorAll('.produto, .section-title').forEach(el => {
        if (cat === 'todos') {
            el.style.display = 'flex';
        } else {
            el.style.display = (el.dataset.cat === cat) ? 'flex' : 'none';
        }
    });
}

// ── CHECKOUT ──
window.abrirCheckout = function() {
    if (!window.carrinho.length) return;
    document.getElementById('overlay').classList.add('open');
    document.getElementById('form-view').style.display = 'block';
    document.getElementById('success-view').style.display = 'none';
    carregarRegioes();
    renderResumo();
    renderPagDetalhe();
}

window.fecharCheckout = function() {
    document.getElementById('overlay').classList.remove('open');
}

window.fecharOverlay = function(e) {
    if (e.target.id === 'overlay') window.fecharCheckout();
}

async function carregarRegioes() {
    try {
        const resp = await fetch('/api/regioes');
        window.regioes = await resp.json();
        const sel = document.getElementById('sel-regiao');
        if (sel) {
            const valAnterior = sel.value;
            sel.innerHTML = '<option value="" disabled selected>Selecione seu bairro...</option>';
            window.regioes.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = `${r.nome} (${r.taxa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`;
                opt.dataset.taxa = r.taxa;
                sel.appendChild(opt);
            });
            if (valAnterior) sel.value = valAnterior;
        }
    } catch (e) { console.error("Erro regiões", e); }
}

window.atualizarFrete = function() {
    const sel = document.getElementById('sel-regiao');
    const opt = sel.options[sel.selectedIndex];
    window.freteAtual = opt ? parseFloat(opt.dataset.taxa || 0) : 0;
    renderResumo();
}

window.selecionarEntrega = function(btn) {
    document.querySelectorAll('#entrega-chips .pag-chip').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    window.tipoEntrega = btn.dataset.tipo;
    document.getElementById('endereco-container').style.display = window.tipoEntrega === 'Entrega' ? 'block' : 'none';
    if (window.tipoEntrega === 'Retirada') window.freteAtual = 0;
    else window.atualizarFrete();
    renderResumo();
}

window.selecionarPag = function(btn) {
    document.querySelectorAll('.pag-chips .pag-chip').forEach(b => {
        if (b.parentElement.id !== 'entrega-chips') b.classList.remove('selected');
    });
    btn.classList.add('selected');
    window.pagSelecionado = btn.dataset.pag;
    renderPagDetalhe();
}

function renderPagDetalhe() {
    const container = document.getElementById('pag-detalhe-container');
    if (!container) return;
    if (window.pagSelecionado === 'Pix') {
        container.innerHTML = `<div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:10px; margin:10px 0; font-size:0.8rem; border:1px dashed var(--brand-red);">
            Chave PIX (Celular): <strong style="color:white">27988573982</strong><br>
            <small>Anexe o comprovante abaixo</small>
        </div>
        <input type="file" id="inp-comprovante" accept="image/*" class="form-input">`;
    } else if (window.pagSelecionado === 'Dinheiro') {
        container.innerHTML = `<input type="text" id="inp-troco" class="form-input" placeholder="Troco para quanto?">`;
    } else {
        container.innerHTML = '';
    }
}

function renderResumo() {
    const box = document.getElementById('resumo-box');
    if (!box) return;
    
    let html = window.carrinho.map(i => `
        <div class="resumo-row">
            <span>${i.nome}</span>
            <span>${i.preco.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} <button onclick="remItem(${i.id})" style="background:none; border:none; color:#ff4444; margin-left:8px; cursor:pointer">×</button></span>
        </div>
    `).join('');

    const sub = totalCarrinho();
    if (window.tipoEntrega === 'Entrega' && window.freteAtual > 0) {
        html += `<div class="resumo-row" style="opacity:0.6"><span>Taxa de Entrega</span><span>${window.freteAtual.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span></div>`;
    }

    html += `<div class="resumo-row total-row"><span>Total</span><span>${(sub + window.freteAtual).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span></div>`;
    box.innerHTML = html;
}

// ── ENVIO ──
window.enviarPedido = async function() {
    const nome = document.getElementById('inp-nome').value.trim();
    const tel = document.getElementById('inp-tel').value.trim();
    const errBox = document.getElementById('form-erro');
    const btn = document.getElementById('btn-confirmar');

    if (errBox) errBox.style.display = 'none';

    if (!nome || tel.length < 8) {
        if (errBox) { errBox.textContent = "Preencha nome e telefone corretamente."; errBox.style.display = 'block'; }
        return;
    }

    if (window.tipoEntrega === 'Entrega') {
        const sel = document.getElementById('sel-regiao');
        if (!sel.value || !document.getElementById('inp-rua').value) {
            if (errBox) { errBox.textContent = "Informe o endereço completo."; errBox.style.display = 'block'; }
            return;
        }
    }

    if (!document.getElementById('chk-lgpd').checked) {
        if (errBox) { errBox.textContent = "Aceite os termos de privacidade."; errBox.style.display = 'block'; }
        return;
    }

    const payload = new FormData();
    payload.append('nome', nome);
    payload.append('telefone', tel);
    payload.append('pedido', window.carrinho.map(i => i.nome).join(', '));
    payload.append('total', totalCarrinho() + window.freteAtual);
    payload.append('pagamento', window.pagSelecionado);
    payload.append('origem', 'Site');
    
    let endereco = 'Retirada no Local';
    if (window.tipoEntrega === 'Entrega') {
        const sel = document.getElementById('sel-regiao');
        const bairro = sel.options[sel.selectedIndex].text.split(' (')[0];
        endereco = `${document.getElementById('inp-rua').value}, ${bairro} ${document.getElementById('inp-bairro').value}`;
    }
    payload.append('endereco', endereco);

    if (window.pagSelecionado === 'Pix') {
        const comp = document.getElementById('inp-comprovante');
        if (comp && comp.files[0]) payload.append('comprovante', comp.files[0]);
    }

    btn.disabled = true;
    btn.textContent = "ENVIANDO...";

    try {
        const resp = await fetch(API_URL, { method: 'POST', body: payload });
        const resData = await resp.json();

        // WhatsApp
        let msg = `*Novo Pedido - Garagem do Galeto*%0A`;
        msg += `*Cliente:* ${nome}%0A*Itens:* ${window.carrinho.map(i => i.nome).join(', ')}%0A`;
        msg += `*Total:* ${(totalCarrinho() + window.freteAtual).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}%0A`;
        msg += `*Entrega:* ${endereco}`;
        
        window.open(`https://wa.me/${NUMERO_DONO}?text=${msg}`, '_blank');

        window.carrinho = [];
        atualizarBarra();
        document.getElementById('form-view').style.display = 'none';
        document.getElementById('success-view').style.display = 'block';

    } catch (e) {
        console.error(e);
        alert("Erro ao enviar pedido. Tente novamente.");
    } finally {
        btn.disabled = false;
        btn.textContent = "FINALIZAR PEDIDO";
    }
}