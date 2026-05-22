// ── CONFIG ──
let CONFIG = { whatsapp_dono: '', pix_chave: '' };
let carrinho = [];
let pagSelecionado = 'Pix';
let tipoEntrega = 'Entrega';
let regioes = [];
let freteAtual = 0;

// URL da imagem de fallback quando o produto não tem foto
const FALLBACK_IMG = '/img/produto-placeholder.png';

// Resolve a URL da imagem de acordo com o ambiente (Electron ou browser)
function resolveImgUrl(url) {
    if (!url) return FALLBACK_IMG;
    // Se for uma URL completa (http/https), usar diretamente
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // Se estivermos no Electron, usar o protocolo customizado
    if (window.electronAPI || navigator.userAgent.includes('Electron')) {
        // uploads/arquivo.jpg => app-media://uploads/arquivo.jpg
        const clean = url.replace(/^\//, '');
        return `app-media://${clean}`;
    }
    // Browser normal: usar URL relativa (servida pelo Express)
    return url.startsWith('/') ? url : '/' + url;
}

// ── CARREGAMENTO DINÂMICO DO CARDÁPIO ──
async function carregarCardapio() {
    try {
        // Carregar config dinâmica
        const configRes = await fetch('/api/config');
        CONFIG = await configRes.json();

        const res = await fetch('/api/cardapio-itens');
        const menu = await res.json();
        
        const nav = document.getElementById('cat-nav-container');
        const container = document.getElementById('produtos-container');
        
        if (!menu || menu.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:60px;color:#666;">Nenhum produto disponível no momento.</div>';
            return;
        }

        // ── Navegação de categorias
        let navHtml = `<div class="cat-chip ativo" onclick="filtrarCat('todos', this)">Todos</div>`;
        menu.forEach(cat => {
            navHtml += `<div class="cat-chip" onclick="filtrarCat('cat-${cat.id}', this)">${cat.nome}</div>`;
        });
        nav.innerHTML = navHtml;

        // ── Seccões + Grid de produtos
        let html = '';
        menu.forEach(cat => {
            html += `
            <div class="section-title" data-cat="cat-${cat.id}">
                🍽️ ${(cat.nome_listagem || cat.nome).toUpperCase()}
            </div>
            <div class="produtos-grid" data-cat="cat-${cat.id}">`;

            cat.produtos.forEach(p => {
                const esgotado = (p.quantidade_estoque ?? 0) <= 0;
                const ultimas  = !esgotado && (p.quantidade_estoque ?? 99) <= 5;
                const imgSrc   = resolveImgUrl(p.imagem_url);
                const preco    = (p.preco_unitario || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                html += `
                <div class="produto${esgotado ? ' esgotado' : ''}" data-cat="cat-${cat.id}" data-prod-id="${p.id}">

                    <!-- Imagem ── ocupa 50% do card via aspect-ratio quadrado -->
                    <div class="prod-img-wrap">
                        <img
                            src="${imgSrc}"
                            class="prod-img"
                            alt="${p.nome}"
                            loading="lazy"
                            onerror="this.src='${FALLBACK_IMG}'; this.onerror=null;"
                        >
                        ${esgotado
                            ? `<span class="tag-esgotado">Esgotado</span>`
                            : (ultimas ? `<span class="stock-badge">🔥 Últimas</span>` : '')
                        }
                    </div>

                    <!-- Informações ── -->
                    <div class="prod-body">
                        <div class="prod-nome">${p.nome}</div>
                        ${p.descricao ? `<div class="prod-desc">${p.descricao}</div>` : ''}
                        <div class="prod-footer">
                            <span class="prod-preco">${preco}</span>
                            <button
                                class="btn-add"
                                onclick="addItem(${p.id}, '${p.nome.replace(/'/g, "\\'")}'  , ${p.preco_unitario})"
                                aria-label="Adicionar ${p.nome} ao carrinho"
                            >+</button>
                        </div>
                    </div>

                </div>`;
            });

            html += `</div>`; // fecha .produtos-grid
        });
        
        container.innerHTML = html;

    } catch(e) {
        console.error('Erro ao carregar cardapio', e);
        document.getElementById('produtos-container').innerHTML =
            '<div style="text-align:center;padding:60px;color:#ff3131;">Erro ao carregar cardápio. Tente novamente.</div>';
    }
}

window.addEventListener('DOMContentLoaded', carregarCardapio);

// ── CORE ──
function addItem(id, nome, preco) {
    carrinho.push({ cartId: Date.now() + Math.random(), id, nome, preco, quantidade: 1 });
    atualizarBarra();
}

function remItem(cartId) {
    carrinho = carrinho.filter(i => i.cartId !== cartId);
    atualizarBarra();
    renderResumo();
}

function atualizarBarra() {
    const qtd = carrinho.length;
    const total = carrinho.reduce((a, b) => a + b.preco, 0);
    document.getElementById('cart-qtd-label').textContent = `${qtd} ITENS`;
    document.getElementById('cart-total-label').textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('cart-bar').style.display = qtd > 0 ? 'flex' : 'none';
}

function filtrarCat(cat, btn) {
    document.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    // Controla seccões (section-title) e grids (.produtos-grid)
    document.querySelectorAll('.produto, .section-title, .produtos-grid').forEach(el => {
        if (cat === 'todos') {
            el.style.display = '';
        } else {
            el.style.display = el.dataset.cat === cat ? '' : 'none';
        }
    });
}

// ── CHECKOUT ──
function abrirCheckout() {
    document.getElementById('overlay').classList.add('open');
    carregarRegioes();
    renderResumo();
}
function fecharCheckout() { document.getElementById('overlay').classList.remove('open'); }
function fecharOverlay(e) { if(e.target.id === 'overlay') fecharCheckout(); }

async function carregarRegioes() {
    const resp = await fetch('/api/regioes');
    regioes = await resp.json();
    const sel = document.getElementById('sel-regiao');
    if (sel && sel.options.length <= 1) {
        regioes.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            const taxa = r.taxa_entrega ?? r.taxa ?? 0;
            opt.textContent = `${r.nome} (${taxa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`;
            opt.dataset.taxa = taxa;
            sel.appendChild(opt);
        });
    }
}

function atualizarFrete() {
    const sel = document.getElementById('sel-regiao');
    const opt = sel.options[sel.selectedIndex];
    freteAtual = opt ? parseFloat(opt.dataset.taxa || 0) : 0;
    renderResumo();
}

function selecionarEntrega(btn) {
    document.querySelectorAll('#entrega-chips .pag-chip').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    tipoEntrega = btn.dataset.tipo;
    document.getElementById('endereco-container').style.display = tipoEntrega === 'Entrega' ? 'block' : 'none';
    if(tipoEntrega === 'Retirada') freteAtual = 0;
    renderResumo();
}

function selecionarPag(btn) {
    document.querySelectorAll('.pag-chips .pag-chip').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    pagSelecionado = btn.dataset.pag;
    const det = document.getElementById('pag-detalhe-container');
    if(pagSelecionado === 'Pix') det.innerHTML = `<p style="font-size:0.8rem; color:#aaa; margin:10px 0;">Chave PIX: ${CONFIG.pix_chave}</p><input type="file" id="inp-comprovante" class="form-input">`;
    else if(pagSelecionado === 'Dinheiro') det.innerHTML = '<input type="text" id="inp-troco" class="form-input" placeholder="Troco para quanto?">';
    else det.innerHTML = '';
}

function renderResumo() {
    const box = document.getElementById('resumo-box');
    let html = carrinho.map(i => `<div class="resumo-row"><span>${i.nome}</span><span>${i.preco.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} <button onclick="remItem(${i.cartId})">×</button></span></div>`).join('');
    const totalProdutos = carrinho.reduce((a, b) => a + b.preco, 0);
    if(tipoEntrega === 'Entrega' && freteAtual > 0) html += `<div class="resumo-row" style="opacity:0.6"><span>Taxa de Entrega</span><span>${freteAtual.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span></div>`;
    html += `<div class="resumo-row total-row"><span>Total</span><span>${(totalProdutos + freteAtual).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span></div>`;
    box.innerHTML = html;
}

async function enviarPedido() {
    const nome = document.getElementById('inp-nome').value.trim();
    const tel = document.getElementById('inp-tel').value.trim();
    const btn = document.getElementById('btn-confirmar');

    if(!nome || !tel) { alert("Por favor, preencha nome e WhatsApp."); return; }
    if(tipoEntrega === 'Entrega' && !document.getElementById('sel-regiao').value) { alert("Selecione o bairro para entrega."); return; }
    if(!document.getElementById('chk-lgpd').checked) { alert("Aceite os termos para continuar."); return; }

    btn.disabled = true;
    btn.textContent = "ENVIANDO...";

    const payload = new FormData();
    payload.append('nome', nome);
    payload.append('telefone', tel);
    // Agrupar carrinho para envio
    const itensMap = {};
    carrinho.forEach(it => {
        if (!itensMap[it.id]) itensMap[it.id] = { id: it.id, nome: it.nome, preco: it.preco, quantidade: 0 };
        itensMap[it.id].quantidade++;
    });
    const itensAgrupados = Object.values(itensMap);

    payload.append('pedido', carrinho.map(i => i.nome).join(', '));
    payload.append('itens', JSON.stringify(itensAgrupados));
    payload.append('taxa', freteAtual);
    payload.append('total', carrinho.reduce((a, b) => a + b.preco, 0) + freteAtual);
    payload.append('pagamento', pagSelecionado);
    payload.append('origem', 'Site');
    
    let endereco = 'Retirada no Local';
    if(tipoEntrega === 'Entrega') {
        const sel = document.getElementById('sel-regiao');
        const bairro = sel.options[sel.selectedIndex].text.split(' (')[0];
        const rua = document.getElementById('inp-rua').value.trim();
        const ref = document.getElementById('inp-bairro').value.trim();
        endereco = `${rua}, ${bairro}${ref ? ' (Ref: ' + ref + ')' : ''}`;
    }
    payload.append('endereco', endereco);

    const comp = document.getElementById('inp-comprovante');
    if(comp && comp.files[0]) payload.append('comprovante', comp.files[0]);

    try {
        const resp = await fetch('/api/novo-pedido', { method: 'POST', body: payload });
        const resData = await resp.json();
        
        let zapMsg = `*Novo Pedido - Garagem do Galeto*%0A`;
        zapMsg += `*Cliente:* ${nome}%0A`;
        zapMsg += `*Itens:* ${carrinho.map(i => i.nome).join(', ')}%0A`;
        zapMsg += `*Total:* ${(carrinho.reduce((a, b) => a + b.preco, 0) + freteAtual).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}%0A`;
        zapMsg += `*Pagamento:* ${pagSelecionado}%0A`;
        zapMsg += `*Entrega:* ${endereco}%0A`;
        
        if (resData.comprovante) {
            const linkComp = `${window.location.origin}${resData.comprovante}`;
            zapMsg += `%0A%0A*🔗 LINK DO COMPROVANTE:*%0A${linkComp}`;
        }
        
        window.open(`https://wa.me/${CONFIG.whatsapp_dono}?text=${zapMsg}`, '_blank');
        
        document.getElementById('form-view').style.display = 'none';
        document.getElementById('success-view').style.display = 'flex';
        carrinho = [];
        atualizarBarra();
    } catch (e) {
        alert("Erro ao enviar. Verifique sua conexão.");
        btn.disabled = false;
        btn.textContent = "FINALIZAR PEDIDO";
    }
}
