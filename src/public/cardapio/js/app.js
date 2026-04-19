// URL relativa para funcionar independente de hostname no futuro do servidor online
const API_URL = '/api/pedidos';

// ── CARRINHO ──────────────────────────────────────
let carrinho = []; // [{ id, nome, preco }]
let idCounter = 0;
let pagSelecionado = 'Pix';

function addItem(nome, preco) {
    if (navigator.vibrate) navigator.vibrate(40);
    carrinho.push({ id: ++idCounter, nome, preco });
    atualizarBarra();
}

function remItem(id) {
    carrinho = carrinho.filter(i => i.id !== id);
    atualizarBarra();
    renderResumo();
}

function totalCarrinho() {
    return carrinho.reduce((a, i) => a + i.preco, 0);
}

function atualizarBarra() {
    const qtd = carrinho.length;
    const tot = totalCarrinho();
    document.getElementById('cart-qtd-label').textContent  = `${qtd} item${qtd !== 1 ? 's' : ''}`;
    document.getElementById('cart-total-label').textContent = tot.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const bar = document.getElementById('cart-bar');
    bar.style.display = qtd > 0 ? 'flex' : 'none';
}

// ── FILTRO DE CATEGORIAS ─────────────────────────
function filtrarCat(cat, btn) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');

    document.querySelectorAll('.produto, .section-title').forEach(el => {
        if (cat === 'todos') {
            el.style.display = '';
        } else {
            el.style.display = (el.dataset.cat === cat) ? '' : 'none';
        }
    });
}

// ── CHECKOUT ──────────────────────────────────────
function abrirCheckout() {
    if (!carrinho.length) return;
    document.getElementById('overlay').classList.add('open');
    document.getElementById('form-view').style.display = 'block';
    document.getElementById('success-view').style.display = 'none';
    renderResumo();
}

function fecharCheckout() {
    document.getElementById('overlay').classList.remove('open');
}

function fecharOverlay(e) {
    if (e.target === document.getElementById('overlay')) fecharCheckout();
}

function selecionarPag(btn) {
    document.querySelectorAll('.pag-chip').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    pagSelecionado = btn.dataset.pag;
}

function renderResumo() {
    const box = document.getElementById('resumo-box');
    const linhas = carrinho.map(i => `
        <div class="resumo-row">
            <span>${i.nome}</span>
            <span style="display:flex;align-items:center;gap:10px">
                ${i.preco.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                <button class="resumo-rem-btn" onclick="remItem(${i.id})" title="Remover">
                    <span class="material-icons-round" style="font-size:1rem">remove_circle_outline</span>
                </button>
            </span>
        </div>
    `).join('');

    const total = totalCarrinho().toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    box.innerHTML = linhas + `
        <div class="resumo-row total-row">
            <span>Total</span>
            <strong>${total}</strong>
        </div>
    `;
}

// ── ENVIO ─────────────────────────────────────────
async function enviarPedido() {
    const nome = document.getElementById('inp-nome').value.trim();
    const tel  = document.getElementById('inp-tel').value.trim().replace(/\D/g, '');

    if (!nome) { alert('Por favor, informe seu nome.'); return; }
    if (tel.length < 10) { alert('Informe um WhatsApp válido com DDD.'); return; }
    if (!carrinho.length) { alert('Seu carrinho está vazio.'); return; }

    const payload = {
        nome,
        telefone: tel,
        pedido: carrinho.map(i => i.nome).join(', '),
        total: totalCarrinho(),
        pagamento: pagSelecionado,
        origem: 'Site',
    };

    const btn = document.getElementById('btn-confirmar');
    btn.disabled = true;
    btn.innerHTML = `<span class="material-icons-round spin">autorenew</span> Enviando...`;

    try {
        const resp = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!resp.ok) throw new Error('Servidor retornou erro');

        // Sucesso
        carrinho = [];
        atualizarBarra();
        document.getElementById('inp-nome').value = '';
        document.getElementById('inp-tel').value = '';

        document.getElementById('form-view').style.display = 'none';
        document.getElementById('success-view').style.display = 'block';

    } catch (err) {
        console.error(err);
        alert('😓 Não foi possível enviar o pedido.\nVerifique sua conexão ou tente pelo WhatsApp.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-icons-round">check_circle</span> CONFIRMAR PEDIDO`;
    }
}
