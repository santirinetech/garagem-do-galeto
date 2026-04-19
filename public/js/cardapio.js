const API_URL = 'http://localhost:3000/novo-pedido';

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
        renderPagDetalhe();
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
        renderPagDetalhe();
    }

    function renderPagDetalhe() {
        const container = document.getElementById('pag-detalhe-container');
        if (!container) return;
        if (pagSelecionado === 'Pix') {
            container.innerHTML = `
                <div class="pix-box">
                    Nossa chave PIX (Telefone): <br><span class="pix-key">(27) 99999-9999</span>
                </div>
                <label class="form-label pix-label-spaced">Envie o comprovante *</label>
                <input type="file" id="inp-comprovante" accept="image/*" class="form-input pix-input-upload">
            `;
        } else if (pagSelecionado === 'Dinheiro') {
            container.innerHTML = `
                <label class="form-label">Precisa de troco para quanto?</label>
                <input type="text" id="inp-troco" class="form-input" placeholder="Ex: Para 50 reais" autocomplete="off">
            `;
        } else if (pagSelecionado === 'Cartão') {
            container.innerHTML = `
                <label class="form-label">Qual a bandeira do cartão?</label>
                <input type="text" id="inp-bandeira" class="form-input" placeholder="Ex: Visa, Mastercard..." autocomplete="off">
            `;
        }
    }

    function renderResumo() {
        const box = document.getElementById('resumo-box');
        const linhas = carrinho.map(i => `
            <div class="resumo-row">
                <span>${i.nome}</span>
                <span class="resumo-price-container">
                    ${i.preco.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                    <button class="resumo-rem-btn" onclick="remItem(${i.id})" title="Remover">
                        <span class="material-icons-round icon-small">remove_circle_outline</span>
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

    // ── WHATSAPP ──────────────────────────────────────
    const enviarParaWhatsapp = (dados, idPedido) => {
        const numeroDono = "5527988573982"; // Número configurado pelo dono
        let mensagem = `*Novo Pedido - Garagem do Galeto*%0A%0A`;
        
        mensagem += `*Pedido #ID:* ${idPedido}%0A`;
        mensagem += `*Cliente:* ${dados.nome}%0A`;
        mensagem += `*Telefone:* ${dados.telefone}%0A%0A`;
        
        mensagem += `*Itens:*%0A`;
        dados.itens.forEach(item => {
            mensagem += `• ${item.nome} (${item.preco.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})})%0A`;
        });
        
        mensagem += `%0A*Total:* ${dados.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`;
        mensagem += `%0A*Pagamento:* ${dados.pagamento}%0A%0A`;
        
        mensagem += `_Confira os detalhes no painel: Pedido #${idPedido}_`;
        
        const link = `https://wa.me/${numeroDono}?text=${encodeURIComponent(decodeURIComponent(mensagem))}`;
        window.open(link, '_blank');
    }

    // ── ENVIO ─────────────────────────────────────────
    async function enviarPedido() {
        const nome = document.getElementById('inp-nome').value.trim();
        const tel  = document.getElementById('inp-tel').value.trim().replace(/\D/g, '');
        const errBox = document.getElementById('form-erro');

        errBox.style.display = 'none';

        if (!nome) { errBox.textContent = 'Por favor, informe seu nome.'; errBox.style.display = 'block'; return; }
        if (tel.length < 10) { errBox.textContent = 'Informe um WhatsApp válido com DDD.'; errBox.style.display = 'block'; return; }
        if (!document.getElementById('chk-lgpd').checked) { errBox.textContent = 'Você precisa aceitar os termos de privacidade.'; errBox.style.display = 'block'; return; }
        if (!carrinho.length) { errBox.textContent = 'Seu carrinho está vazio.'; errBox.style.display = 'block'; return; }

        let pagamentoStr = pagSelecionado;
        if (pagSelecionado === 'Dinheiro') {
            const troco = document.getElementById('inp-troco')?.value.trim();
            if (troco) pagamentoStr += ` (Troco para: ${troco})`;
        } else if (pagSelecionado === 'Cartão') {
            const ban = document.getElementById('inp-bandeira')?.value.trim();
            if (ban) pagamentoStr += ` (Bandeira: ${ban})`;
        }

        const payload = new FormData();
        payload.append('nome', nome);
        payload.append('telefone', tel);
        payload.append('pedido', carrinho.map(i => i.nome).join(', '));
        payload.append('total', totalCarrinho());
        payload.append('pagamento', pagamentoStr);
        payload.append('origem', 'Site');

        const btn = document.getElementById('btn-confirmar');
        // Validação de Comprovante PIX
        if (pagSelecionado === 'Pix') {
            const comp = document.getElementById('inp-comprovante');
            if (!comp || !comp.files[0]) {
                errBox.textContent = 'Por favor, anexe o comprovante PIX.';
                errBox.style.display = 'block';
                return;
            }
            payload.append('comprovante', comp.files[0]);
        }

        btn.disabled = true;
        btn.innerHTML = `<span class="material-icons-round spin">autorenew</span> Enviando...`;

        try {
            const resp = await fetch('/api/novo-pedido', {
                method: 'POST',
                body: payload, // Sem setar Content-Type para o browser gerar o Boundary
            });

            const dataRes = await resp.json();

            // Dados para o WhatsApp
            const dadosZap = {
                nome,
                telefone: tel,
                total: totalCarrinho(),
                pagamento: pagamentoStr,
                itens: [...carrinho]
            };

            // Redireciona para o WhatsApp
            enviarParaWhatsapp(dadosZap, dataRes.id_pedido);

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