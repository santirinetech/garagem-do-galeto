const API_URL = 'http://localhost:3000/novo-pedido';

    // ── CARRINHO ──────────────────────────────────────
    let carrinho = []; // [{ id, nome, preco }]
    let idCounter = 0;
    let pagSelecionado = 'Pix';
<<<<<<< HEAD
=======
    let tipoEntrega = 'Entrega';
    let regioes = [];
    let freteAtual = 0;
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)

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
<<<<<<< HEAD
=======
        carregarRegioes();
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
        renderResumo();
        renderPagDetalhe();
    }

<<<<<<< HEAD
=======
    async function carregarRegioes() {
        try {
            const resp = await fetch('/api/regioes');
            regioes = await resp.json();
            const sel = document.getElementById('sel-regiao');
            if (sel) {
                const valAnterior = sel.value;
                sel.innerHTML = '<option value="" disabled selected>Selecione sua região...</option>';
                regioes.forEach(r => {
                    const opt = document.createElement('option');
                    opt.value = r.id;
                    opt.textContent = `${r.nome} (${r.taxa.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})})`;
                    opt.dataset.taxa = r.taxa;
                    sel.appendChild(opt);
                });
                if (valAnterior) sel.value = valAnterior;
            }
        } catch (e) { console.error("Erro ao carregar regiões", e); }
    }

    function atualizarFrete() {
        const sel = document.getElementById('sel-regiao');
        const opt = sel.options[sel.selectedIndex];
        freteAtual = opt ? parseFloat(opt.dataset.taxa || 0) : 0;
        renderResumo();
    }

>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
    function fecharCheckout() {
        document.getElementById('overlay').classList.remove('open');
    }

    function fecharOverlay(e) {
        if (e.target === document.getElementById('overlay')) fecharCheckout();
    }

    function selecionarPag(btn) {
<<<<<<< HEAD
        document.querySelectorAll('.pag-chip').forEach(b => b.classList.remove('selected'));
=======
        document.querySelectorAll('.pag-chip').forEach(b => {
            if (b.parentElement.id !== 'entrega-chips') b.classList.remove('selected');
        });
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
        btn.classList.add('selected');
        pagSelecionado = btn.dataset.pag;
        renderPagDetalhe();
    }

<<<<<<< HEAD
=======
    function selecionarEntrega(btn) {
        document.querySelectorAll('#entrega-chips .pag-chip').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        tipoEntrega = btn.dataset.tipo;
        document.getElementById('endereco-container').style.display = tipoEntrega === 'Entrega' ? 'block' : 'none';
        if (tipoEntrega === 'Retirada') {
            freteAtual = 0;
        } else {
            atualizarFrete();
        }
        renderResumo();
    }

>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
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

<<<<<<< HEAD
        const total = totalCarrinho().toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
        box.innerHTML = linhas + `
            <div class="resumo-row total-row">
                <span>Total</span>
                <strong>${total}</strong>
=======
        const totalProdutos = totalCarrinho();
        const totalFinal = totalProdutos + freteAtual;

        let resumoHtml = linhas;
        
        if (tipoEntrega === 'Entrega' && freteAtual > 0) {
            resumoHtml += `
                <div class="resumo-row" style="color: var(--text-muted); font-size: 0.9rem;">
                    <span>Taxa de Entrega</span>
                    <span>${freteAtual.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
                </div>
            `;
        }

        box.innerHTML = resumoHtml + `
            <div class="resumo-row total-row">
                <span>Total</span>
                <strong>${totalFinal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong>
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
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
        
<<<<<<< HEAD
        mensagem += `%0A*Total:* ${dados.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`;
        mensagem += `%0A*Pagamento:* ${dados.pagamento}%0A%0A`;
        
        mensagem += `_Confira os detalhes no painel: Pedido #${idPedido}_`;
=======
        mensagem += `%0A*Subtotal:* ${dados.subtotal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`;
        if (dados.frete > 0) mensagem += `%0A*Frete:* ${dados.frete.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`;
        mensagem += `%0A*Total:* ${dados.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`;
        mensagem += `%0A*Pagamento:* ${dados.pagamento}%0A`;
        mensagem += `%0A*Entrega:* ${dados.entrega}%0A`;
        if (dados.endereco) mensagem += `*Endereço:* ${dados.endereco}%0A`;
        
        mensagem += `%0A_Confira os detalhes no painel: Pedido #${idPedido}_`;
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
        
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
<<<<<<< HEAD
        if (!document.getElementById('chk-lgpd').checked) { errBox.textContent = 'Você precisa aceitar os termos de privacidade.'; errBox.style.display = 'block'; return; }
        if (!carrinho.length) { errBox.textContent = 'Seu carrinho está vazio.'; errBox.style.display = 'block'; return; }

=======
        
        let enderecoCompleto = 'Retirada no Local';
        if (tipoEntrega === 'Entrega') {
            const sel = document.getElementById('sel-regiao');
            const regiaoNome = sel.options[sel.selectedIndex]?.text.split(' (')[0];
            if (!sel.value) {
                errBox.textContent = 'Por favor, selecione sua região.';
                errBox.style.display = 'block';
                return;
            }
            const rua = document.getElementById('inp-rua').value.trim();
            const ponto = document.getElementById('inp-bairro').value.trim();
            if (!rua) {
                errBox.textContent = 'Por favor, informe seu endereço.';
                errBox.style.display = 'block';
                return;
            }
            enderecoCompleto = `${rua} - ${regiaoNome}${ponto ? ' (Ref: ' + ponto + ')' : ''}`;
        }

        if (!document.getElementById('chk-lgpd').checked) { errBox.textContent = 'Você precisa aceitar os termos de privacidade.'; errBox.style.display = 'block'; return; }
        if (!carrinho.length) { errBox.textContent = 'Seu carrinho está vazio.'; errBox.style.display = 'block'; return; }

        const totalFinal = totalCarrinho() + freteAtual;
        
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
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
<<<<<<< HEAD
        payload.append('total', totalCarrinho());
        payload.append('pagamento', pagamentoStr);
        payload.append('origem', 'Site');
=======
        payload.append('total', totalFinal);
        payload.append('pagamento', pagamentoStr);
        payload.append('origem', 'Site');
        payload.append('endereco', enderecoCompleto);
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)

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
<<<<<<< HEAD
                total: totalCarrinho(),
                pagamento: pagamentoStr,
=======
                subtotal: totalCarrinho(),
                frete: freteAtual,
                total: totalCarrinho() + freteAtual,
                pagamento: pagamentoStr,
                entrega: tipoEntrega,
                endereco: tipoEntrega === 'Entrega' ? enderecoCompleto : null,
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
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