// ── SSE: ATUALIZAÇÃO EM TEMPO REAL ──────────────────────
const eventSource = new EventSource('/api/events');
eventSource.onmessage = (e) => {
    if (e.data === 'update') {
        console.log('⚡ Atualização recebida via SSE');
        carregarTudo();
        return;
    }
    
    try {
        const evt = JSON.parse(e.data);
        if (evt.type === 'qr') {
            document.getElementById('wpp-qr-container').innerHTML = `<img src="${evt.data}" style="width: 200px; height: 200px; border-radius: 10px;">`;
            document.getElementById('wpp-status-pill').textContent = 'Aguardando Leitura do QR...';
            document.getElementById('wpp-status-pill').style.background = 'var(--amber)';
        } else if (evt.type === 'whatsapp-ready') {
            document.getElementById('wpp-qr-container').innerHTML = `<span class="material-icons-round" style="color: var(--green); font-size: 80px;">check_circle</span>`;
            document.getElementById('wpp-status-pill').textContent = 'Conectado (Online)';
            document.getElementById('wpp-status-pill').style.background = 'var(--green)';
            showToast("WhatsApp Bot Conectado!");
        } else if (evt.type === 'whatsapp-disconnected') {
            document.getElementById('wpp-qr-container').innerHTML = `<span style="color: var(--red); font-size: 0.8rem; text-align: center; padding: 10px;">Desconectado.<br>Aguarde novo QR Code...</span>`;
            document.getElementById('wpp-status-pill').textContent = 'Desconectado';
            document.getElementById('wpp-status-pill').style.background = 'var(--red)';
        }
    } catch(err) {}
};

async function checkWppStatus() {
    try {
        const res = await fetch('/api/whatsapp/status');
        const status = await res.json();
        
        if (status.isReady) {
            document.getElementById('wpp-qr-container').innerHTML = `<span class="material-icons-round" style="color: var(--green); font-size: 80px;">check_circle</span>`;
            document.getElementById('wpp-status-pill').textContent = 'Conectado (Online)';
            document.getElementById('wpp-status-pill').style.background = 'var(--green)';
        } else if (status.qrCodeDataUrl) {
            document.getElementById('wpp-qr-container').innerHTML = `<img src="${status.qrCodeDataUrl}" style="width: 200px; height: 200px; border-radius: 10px;">`;
            document.getElementById('wpp-status-pill').textContent = 'Aguardando Leitura do QR...';
            document.getElementById('wpp-status-pill').style.background = 'var(--amber)';
        } else {
            document.getElementById('wpp-qr-container').innerHTML = `<span style="color: black; font-size: 0.8rem; text-align: center; padding: 10px;">Aguarde, gerando...</span>`;
        }
    } catch(e) {}
}

// Call on startup
setTimeout(checkWppStatus, 2000);


// ── AUTENTICAÇÃO E SESSÃO ─────────────────────────────
async function verificarSessao() {
    try {
        const res = await fetch('/api/check-session');
        const data = await res.json();
        if (!data.logado) {
            window.location.href = 'login.html';
        }
    } catch (e) {
        window.location.href = 'login.html';
    }
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = 'login.html';
    } catch (e) {
        console.error('Erro ao sair:', e);
    }
}

// Chamar verificação imediatamente
verificarSessao();

// ── NAVEGAÇÃO ──────────────────────────────────────
const titles = { dashboard:'Dashboard', pedidos:'Pedidos', produtos:'Produtos', despesas:'Despesas', relatorios:'Relatórios', historico:'Histórico', clientes:'Clientes (Privacidade)', config: 'Configurações' };
function showView(name, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('view-' + name).classList.add('active');
    if (el) el.classList.add('active');
    document.getElementById('topbar-title').textContent = titles[name] || name;
    carregarTudo();
}

// ── GESTÃO DE REGIÕES ────────────────────────────────
async function carregarRegioesDash() {
    try {
        const resp = await fetch('/api/regioes');
        const regioes = await resp.json();
        const tbody = document.getElementById('tbody-regioes');
        tbody.innerHTML = regioes.map(r => `
            <tr>
                <td><strong>${r.nome}</strong></td>
                <td>${fmtReal(r.taxa_entrega ?? r.taxa ?? 0)}</td>
                <td>
                    <button class="btn btn-ghost btn-small" style="color:var(--red);" onclick="excluirRegiao(${r.id})">
                        <span class="material-icons-round icon-small">delete</span> Excluir
                    </button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhuma região cadastrada.</td></tr>';
    } catch (e) { console.error(e); }
}

async function salvarNovaRegiao() {
    const nomeInp = document.getElementById('regiao-nome');
    const taxaInp = document.getElementById('regiao-taxa');
    
    const nome = nomeInp.value.trim();
    const taxa = parseFloat(taxaInp.value);

    if (!nome || isNaN(taxa)) {
        alert("Preencha o nome do bairro e um valor de taxa válido.");
        return;
    }

    try {
        const resp = await fetch('/api/regioes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, taxa })
        });
        if (resp.ok) {
            showToast("Região cadastrada!");
            nomeInp.value = '';
            taxaInp.value = '';
            carregarRegioesDash();
        } else {
            const data = await resp.json();
            alert("Erro: " + (data.erro || "Erro ao salvar"));
        }
    } catch (e) { 
        console.error(e);
        alert("Erro de conexão.");
    }
}

// Mantendo para compatibilidade caso algo chame, mas redirecionando
async function novaRegiao() {
    document.getElementById('regiao-nome')?.focus();
}

async function excluirRegiao(id) {
    if (!confirm("Tem certeza que deseja excluir esta região?")) return;
    try {
        const resp = await fetch('/api/regioes/' + id, { method: 'DELETE' });
        if (resp.ok) {
            showToast("Região removida.");
            carregarRegioesDash();
        }
    } catch (e) { console.error(e); }
}

// ── STATUS ──────────────────────────────────────────
const STATUS_OPTS = ['Pendente', 'Visto', 'Preparando', 'Saiu para Entrega', 'Pronto para Retirada', 'Entregue', 'Retirado', 'Cancelado'];

function statusSelectHTML(pedidoId, current) {
    const opts = STATUS_OPTS.map(s =>
        `<option value="${s}" ${s === current ? 'selected' : ''}>${s}</option>`
    ).join('');
    return `<select class="status-select" onchange="mudarStatus(${pedidoId}, this.value)">${opts}</select>`;
}

async function mudarStatus(id, status) {
    try {
        const resp = await fetch(`/pedido/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        if (resp.ok) {
            showToast(`Pedido #${id} → ${status}`);
            carregarTudo();
        }
    } catch (e) {
        console.error(e);
    }
}

// ── RENDER HELPERS ──────────────────────────────────
function origemBadge(origem) {
    const cls = origem === 'Site' ? 'o-Site' : 'o-WhatsApp';
    const icon = origem === 'Site' ? 'language' : 'whatsapp';
    return `<span class="origem-pill ${cls}"><span class="material-icons-round icon-small">${icon}</span>${origem}</span>`;
}

function statusBadge(status) {
    const cls = 's-' + status.replace(/ /g, '-');
    const dots = { Pendente:'●', Visto:'👁', Preparando:'◐', 'Saiu para Entrega':'🛵', 'Pronto para Retirada':'🛍️', Entregue:'✔', Retirado:'🤝', Cancelado:'✖' };
    return `<span class="status-pill ${cls}">${dots[status] || '●'} ${status}</span>`;
}

function fmtHora(dt) {
    if (!dt) return '—';
    const d = new Date(dt.replace(' ', 'T') + 'Z');
    return d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}
function fmtData(dt) {
    if (!dt) return '—';
    const d = new Date(dt.replace(' ', 'T') + 'Z');
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
function fmtReal(v) {
    return (v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}

// ── AUDIO / CAMPAINHA ───────────────────────────────
let audioCtx;
let lastHighestId = 0;

function initAudio() {
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
}
document.addEventListener('click', initAudio, { once: true });

function tocarCampainha() {
    if(!audioCtx) initAudio();
    if(audioCtx.state === 'suspended') return;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    
    // Ding
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    
    // Dong
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.4);
    gain.gain.setValueAtTime(0, audioCtx.currentTime + 0.4);
    gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
    
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 1);
}

// ── IMPRESSÃO TÉRMICA ───────────────────────────────
function imprimirComanda(id) {
    fetch('/api/pedido/' + id).then(r => r.json()).then(p => {
        // Se estivermos no Electron, usamos a impressão térmica silenciosa
        if (window.electronAPI) {
            window.electronAPI.solicitarImpressao({
                id: p.id,
                nome: p.cliente_nome,
                telefone: p.cliente_tel,
                pedido: p.pedido_descricao || p.pedido_desc,
                total: p.total,
                pagamento: p.forma_pagamento,
                endereco: p.endereco_entrega || p.endereco
            });
            showToast(`Impressão enviada: Pedido #${id}`);
            return;
        }

        // Fallback para navegador comum (abre diálogo de impressão)
        const descRaw = p.pedido_descricao || p.pedido_desc || '';
        const pdesc = descRaw.replace(/,/g, '<br>• ');
        const num = (p.cliente_tel || '').replace(/\D/g, '');
        const endStr = p.endereco_entrega || p.endereco || 'Retirada';
        const html = `
            <div class="print-title">GARAGEM DO GALETO</div>
            <div style="text-align:center; font-size:12px;">Pedido #<strong>${p.id}</strong></div>
            <div style="text-align:center; font-size:12px; margin-bottom:5px;">${fmtData(p.data_hora)}</div>
            <div class="print-line"></div>
            <div><strong>Cliente:</strong> ${p.cliente_nome}</div>
            <div><strong>Tel:</strong> ${num}</div>
            <div><strong>Canal:</strong> ${p.origem}</div>
            <div style="margin-top:5px;"><strong>Entrega:</strong> ${endStr}</div>
            <div class="print-line"></div>
            <div><strong>ITENS:</strong></div>
            <div style="margin: 5px 0 10px;">• ${pdesc}</div>
            <div class="print-line"></div>
            <div class="print-row" style="font-size:16px;">
                <strong>TOTAL:</strong>
                <strong>${fmtReal(p.total)}</strong>
            </div>
            <div style="margin-top:10px; font-size:14px;"><strong>Pgto:</strong> ${p.forma_pagamento}</div>
            <div style="text-align:center; font-size:12px; margin-top:10px; font-weight:bold;">Obrigado pela prefeência!</div>
            <div style="text-align:center; font-size:10px; margin-top:5px;">Santirine Tech</div>
        `;
        const printArea = document.getElementById('print-area');
        if (printArea) {
            printArea.innerHTML = html;
            window.print();
        } else {
            console.error('Erro: print-area não encontrada no HTML');
        }
    });
}

// ── LOADER PRINCIPAL ────────────────────────────────
async function carregarTudo() {
    const view = document.querySelector('.view.active')?.id?.replace('view-', '');
    if (view === 'dashboard' || !view) await carregarDashboard();
    if (view === 'pedidos')    await carregarTodos();
    if (view === 'produtos')   await carregarProdutos();
    if (view === 'despesas')   await carregarDespesas();
    if (view === 'relatorios') { /* Gerado sob demanda */ }
    if (view === 'historico')  await carregarHistorico();
    if (view === 'clientes')   await carregarClientes();
    if (view === 'config')     await carregarRegioesDash();
    
    // Sempre atualiza badge de pendentes
    try {
        const res = await fetch('/api/resumo');
        const resumo = await res.json();
        if (resumo) document.getElementById('badge-pendentes').textContent = resumo.pendentes || 0;
    } catch(e) {}
}

// ── DASHBOARD ───────────────────────────────────────
async function carregarDashboard() {
    try {
        const [resPed, resRes] = await Promise.all([
            fetch('/api/pedidos/hoje'),
            fetch('/api/resumo')
        ]);
        const pedidos = await resPed.json();
        const resumo = await resRes.json();

        // KPIs
        if (resumo) {
            document.getElementById('kpi-fat').textContent  = fmtReal(resumo.faturamento);
            document.getElementById('kpi-fat-sub').textContent = `${resumo.total_pedidos || 0} pedidos hoje`;
            document.getElementById('kpi-pend').textContent = resumo.pendentes || 0;
            document.getElementById('kpi-zap').textContent  = resumo.pedidos_zap || 0;
            document.getElementById('kpi-site').textContent = resumo.pedidos_site || 0;
            if (document.getElementById('kpi-fat-mensal')) document.getElementById('kpi-fat-mensal').textContent = fmtReal(resumo.faturamento_mensal || 0);
        }

        // Tabela de abertos — compatível com status legado (Capitalized) e novo (snake_case)
        const statusFechados = ['Entregue', 'Cancelado', 'entregue', 'cancelado'];
        let abertos = (pedidos || []).filter(p => !statusFechados.includes(p.status));
        
        const fTipo = document.getElementById('filtro-tipo')?.value;
        const fStatus = document.getElementById('filtro-status')?.value;
        
        const enderecoStr = p => (p.endereco_entrega || p.endereco || '').toLowerCase();
        
        if (fTipo === 'Entrega') {
            abertos = abertos.filter(p => enderecoStr(p) && enderecoStr(p) !== 'retirada no local' && enderecoStr(p) !== 'retirada');
        } else if (fTipo === 'Retirada') {
            abertos = abertos.filter(p => !enderecoStr(p) || enderecoStr(p) === 'retirada no local' || enderecoStr(p) === 'retirada');
        }
        
        if (fStatus) {
            abertos = abertos.filter(p => p.status === fStatus);
        }

        const tbody = document.getElementById('tbody-abertos');

        // Lógica de Campainha e Impressão Automática
        if (abertos.length > 0) {
            const maiorId = Math.max(...abertos.map(p => p.id));
            if (lastHighestId !== 0 && maiorId > lastHighestId) {
                tocarCampainha();
                showToast('🔔 NOVO PEDIDO CHEGOU!');
                
                // Impressão Automática (Somente se estiver no Electron)
                if (window.electronAPI) {
                    const novoPedido = abertos.find(p => p.id === maiorId);
                    window.electronAPI.solicitarImpressao({
                        id: novoPedido.id,
                        nome: novoPedido.cliente_nome,
                        telefone: novoPedido.cliente_tel,
                        pedido: novoPedido.pedido_descricao || novoPedido.pedido_desc,
                        total: novoPedido.total,
                        pagamento: novoPedido.forma_pagamento,
                        endereco: novoPedido.endereco_entrega || novoPedido.endereco
                    });
                }
            }
            if (maiorId > lastHighestId) lastHighestId = maiorId;
        }

        if (abertos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8">
                <div class="empty-state">
                    <span class="material-icons-round">check_circle</span>
                    <p>Nenhum pedido em aberto agora.</p>
                </div>
            </td></tr>`;
        } else {
            const agora = new Date();
            tbody.innerHTML = abertos.map(p => {
                const diffMinutos = Math.floor((agora - new Date(p.data_hora.replace(' ', 'T') + 'Z')) / 60000);
                const isAtrasado = (p.status === 'Pendente' || p.status === 'Preparando') && diffMinutos > 45;
                const urlWpp = `https://wa.me/55${(p.cliente_tel||'').replace(/\D/g,'')}?text=Olá ${p.cliente_nome}, aqui é da Garagem do Galeto!`;

                return `
                <tr class="${isAtrasado ? 'tr-atrasado' : ''}">
                    <td>
                        <strong>#${p.id}</strong>
                        ${isAtrasado ? `<br><span class="badge-atrasado">${diffMinutos}m aguardando</span>` : ''}
                    </td>
                    <td>${origemBadge(p.origem)}</td>
                    <td>
                        <div class="cliente-name">${p.cliente_nome || '—'}</div>
                        <div class="cliente-tel" style="display:flex; align-items:center; gap:5px;">
                            ${p.cliente_tel || ''}
                            <a href="${urlWpp}" target="_blank" style="color:var(--green);" title="WhatsApp">
                                <span class="material-icons-round" style="font-size:16px;">whatsapp</span>
                            </a>
                        </div>
                    </td>
                    <td class="pedido-desc" title="${p.pedido_descricao || ''}">${p.pedido_descricao || '—'}</td>
                    <td>
                        ${p.forma_pagamento || '—'}
                        ${p.comprovante_url ? `
                            <br><a href="${p.comprovante_url}" target="_blank" class="btn-comprovante-link">
                                <span class="material-icons-round">image</span> COMPROVANTE
                            </a>
                        ` : ''}
                    </td>
                    <td style="max-width:150px; font-size:0.85rem; color:var(--text-muted);">
                        ${p.endereco_entrega || '—'}
                    </td>
                    <td><strong>${fmtReal(p.total)}</strong></td>
                    <td>
                        ${statusSelectHTML(p.id, p.status)}
                    </td>
                    <td>
                        <div class="flex-col-gap">
                            <button class="btn btn-primary btn-small" onclick="abrirModalDetalhes(${p.id})">
                                <span class="material-icons-round icon-small">info</span>
                            </button>
                            ${p.status === 'Pendente' ? `
                                <button class="btn-visto" onclick="mudarStatus(${p.id}, 'Visto')">
                                    <span class="material-icons-round">visibility</span>
                                </button>
                            ` : ''}
                            <button class="btn-imprimir" onclick="imprimirComanda(${p.id})">
                                <span class="material-icons-round icon-small">print</span>
                            </button>
                        </div>
                    </td>
                </tr>
                `;
            }).join('');
        }

        let updatedTimeText = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit', second:'2-digit'});
        document.getElementById('atualizado-em').textContent = 'Atualizado às ' + updatedTimeText;
    } catch(e) { console.error('Erro dashboard:', e); }
}

// ── TODOS OS PEDIDOS DE HOJE ─────────────────────────
async function carregarTodos() {
    try {
        const res = await fetch('/api/pedidos/hoje');
        const pedidos = await res.json();
        const tbody = document.getElementById('tbody-todos');

        if (!pedidos || !pedidos.length) {
            tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><span class="material-icons-round">receipt_long</span><p>Sem pedidos hoje ainda.</p></div></td></tr>`;
            return;
        }

        tbody.innerHTML = pedidos.map(p => {
            const urlWpp = `https://wa.me/55${(p.cliente_tel||'').replace(/\D/g,'')}?text=Olá ${p.cliente_nome}, aqui é da Garagem do Galeto!`;
            return `
            <tr>
                <td><strong>#${p.id}</strong></td>
                <td>${fmtHora(p.data_hora)}</td>
                <td>${origemBadge(p.origem)}</td>
                <td>
                    <div class="cliente-name">${p.cliente_nome || '—'}</div>
                    <div class="cliente-tel">
                        ${p.cliente_tel || ''}
                        <a href="${urlWpp}" target="_blank" class="btn-zap">WhatsApp</a>
                    </div>
                </td>
                <td class="pedido-desc" title="${p.pedido_desc || ''}">${p.pedido_desc || '—'}</td>
                <td>
                    ${p.forma_pagamento || '—'}
                    ${p.comprovante ? `<br><a href="${p.comprovante}" target="_blank" style="font-size:0.75rem; color:var(--blue); font-weight:700;">Ver Comprovante</a>` : ''}
                </td>
                <td style="font-size:0.85rem;">${p.endereco || '—'}</td>
                <td><strong>${fmtReal(p.total)}</strong></td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        ${statusSelectHTML(p.id, p.status)}
                        ${p.status === 'Pendente' ? `
                            <button class="btn-visto" onclick="mudarStatus(${p.id}, 'Visto')">
                                <span class="material-icons-round">visibility</span> Visto
                            </button>
                        ` : ''}
                        <button class="btn-imprimir" onclick="imprimirComanda(${p.id})">
                            <span class="material-icons-round" style="font-size:14px;">print</span> Imprimir
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    } catch(e) {}
}

// ── PRODUTOS E GESTÃO ─────────────────────────────────
async function carregarProdutos() {
    try {
        const [resProd, resCat] = await Promise.all([
            fetch('/api/produtos'),
            fetch('/api/categorias')
        ]);
        const produtos = await resProd.json();
        const categorias = await resCat.json();
        
        const tbodyProd = document.getElementById('tbody-produtos');
        const tbodyCat = document.getElementById('tbody-categorias');
        const selCat = document.getElementById('prod-categoria');

        if (tbodyProd) {
            tbodyProd.innerHTML = produtos.map(p => `
                <tr style="opacity: ${p.status ? '1' : '0.5'}">
                    <td><strong>${p.nome}</strong> ${!p.status ? '<span style="color:var(--text-muted); font-size:0.75rem;">(Inativo)</span>' : ''}</td>
                    <td>${p.categoria_nome || '—'}</td>
                    <td>${fmtReal(p.preco_unitario)}</td>
                    <td>
                        <div class="flex-col-gap" style="flex-direction: row; align-items: center; justify-content: center;">
                            <button onclick="ajustarEstoque(${p.id}, ${p.quantidade_estoque - 1})" class="btn-ajuste-minus">-</button>
                            <span style="min-width: 30px; text-align: center; font-weight: bold;">${p.quantidade_estoque}</span>
                            <button onclick="ajustarEstoque(${p.id}, ${p.quantidade_estoque + 1})" class="btn-ajuste-plus">+</button>
                        </div>
                    </td>
                    <td>
                        <button class="btn btn-ghost btn-small" onclick="editarProduto(${p.id})"><span class="material-icons-round">edit</span></button>
                        <button class="btn btn-ghost btn-small" style="color: ${p.status ? 'var(--red)' : 'var(--green)'}" onclick="toggleProdutoAtivo(${p.id}, ${p.status})">
                            <span class="material-icons-round">${p.status ? 'block' : 'check_circle'}</span>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
        
        if (tbodyCat) {
            tbodyCat.innerHTML = categorias.map(c => `
                <tr>
                    <td><strong>${c.nome}</strong></td>
                    <td style="text-align: right;">
                        <button class="btn btn-ghost btn-small" style="color:var(--red);" onclick="excluirCategoria(${c.id})"><span class="material-icons-round">delete</span></button>
                    </td>
                </tr>
            `).join('');
        }
        
        if (selCat) {
            selCat.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
        }
        
    } catch(e) { console.error('Erro ao carregar produtos:', e); }
}

async function ajustarEstoque(id, novaQtd) {
    if (novaQtd < 0) novaQtd = 0;
    await fetch('/api/produtos/' + id + '/estoque', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantidade: novaQtd })
    });
    carregarProdutos();
}

let produtosAtuais = []; // Para a edição
async function editarProduto(id) {
    try {
        const p = await fetch('/api/produtos/' + id).then(r => r.json());
        document.getElementById('prod-id').value = p.id;
        document.getElementById('prod-nome').value = p.nome;
        document.getElementById('prod-preco').value = p.preco_unitario;
        document.getElementById('prod-qtd').value = p.quantidade_estoque;
        document.getElementById('prod-categoria').value = p.categoria_id || '';
        const imgUrl = p.imagem_url || '';
        document.getElementById('prod-imagem').value = imgUrl;
        previewProdImg(imgUrl);
        document.getElementById('modal-produto-titulo').textContent = 'Editar Produto';
        document.getElementById('modal-produto').style.display = 'flex';
    } catch(e) {}
}

function previewProdImg(url) {
    const el = document.getElementById('prod-img-preview');
    if (!url || url.trim() === '') {
        el.src = '';
        el.className = '';
        return;
    }
    el.src = url.trim();
}

async function toggleProdutoAtivo(id, statusAtual) {
    const novoStatus = statusAtual ? 0 : 1;
    await fetch('/api/produtos/' + id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus })
    });
    carregarProdutos();
}

function abrirModalProduto() {
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-nome').value = '';
    document.getElementById('prod-preco').value = '';
    document.getElementById('prod-qtd').value = '0';
    document.getElementById('prod-imagem').value = '';
    document.getElementById('prod-img-preview').src = '';
    document.getElementById('prod-img-preview').className = '';
    document.getElementById('modal-produto-titulo').textContent = 'Novo Produto';
    document.getElementById('modal-produto').style.display = 'flex';
}

function fecharModalProduto(e) {
    if (e.target.id === 'modal-produto') document.getElementById('modal-produto').style.display = 'none';
}

async function salvarProduto() {
    const id = document.getElementById('prod-id').value;
    const nome = document.getElementById('prod-nome').value.trim();
    const categoria_id = document.getElementById('prod-categoria').value;
    const preco = parseFloat(document.getElementById('prod-preco').value);
    const quantidade_estoque = parseInt(document.getElementById('prod-qtd').value);
    const imagem_url = document.getElementById('prod-imagem').value.trim() || null;
    
    if (!nome || isNaN(preco)) return alert('Preencha nome e preço válidos.');
    
    const payload = { nome, categoria_id, preco_unitario: preco, quantidade_estoque, imagem_url };
    const url = id ? '/api/produtos/' + id : '/api/produtos';
    const method = id ? 'PUT' : 'POST';
    
    try {
        const r = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const data = await r.json();
        if (!r.ok) return alert(data.erro || 'Erro ao salvar produto');
        document.getElementById('modal-produto').style.display = 'none';
        carregarProdutos();
    } catch (e) { alert('Erro ao salvar produto'); }
}

async function abrirModalCategoria() {
    const nome = prompt('Nome da nova categoria:');
    if (!nome) return;
    try {
        await fetch('/api/categorias', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ nome }) });
        carregarProdutos();
    } catch(e) { alert('Erro ao salvar'); }
}

async function excluirCategoria(id) {
    if (!confirm('Excluir esta categoria? Isso pode afetar os produtos vinculados.')) return;
    try {
        await fetch('/api/categorias/' + id, { method: 'DELETE' });
        carregarProdutos();
    } catch(e) {}
}

async function abrirModalDetalhes(id) {
    try {
        const res = await fetch('/api/pedido/' + id);
        const p = await res.json();
        
        document.getElementById('detalhes-titulo').textContent = `Pedido #${p.id}`;
        
        const c = document.getElementById('detalhes-conteudo');
        const urlWpp = `https://wa.me/55${(p.cliente_tel||'').replace(/\D/g,'')}?text=Olá ${p.cliente_nome}, aqui é da Garagem do Galeto!`;
        
        c.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div><strong>Cliente:</strong> ${p.cliente_nome}</div>
                <div><strong>Telefone:</strong> ${p.cliente_tel} <a href="${urlWpp}" target="_blank" style="color:var(--green);"><span class="material-icons-round icon-small">whatsapp</span></a></div>
                <div><strong>Data:</strong> ${fmtData(p.data_hora)}</div>
                <div><strong>Origem:</strong> ${p.origem}</div>
                <div><strong>Endereço:</strong> ${p.endereco_entrega || 'Retirada no Local'}</div>
                <div><strong>Pagamento:</strong> ${p.forma_pagamento} ${p.comprovante_url ? `<a href="${p.comprovante_url}" target="_blank">[Ver]</a>` : ''}</div>
            </div>
            <div style="background:var(--bg-2); padding:10px; border-radius:5px; margin-top:10px;">
                <strong>Itens do Pedido:</strong>
                ${p.itens && p.itens.length > 0 ? 
                    `<table class="data-table" style="margin-top:10px;">
                        <thead>
                            <tr>
                                <th>Qtd</th>
                                <th>Produto</th>
                                <th>Preço Unit.</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${p.itens.map(i => `
                                <tr>
                                    <td>${i.quantidade}x</td>
                                    <td>${i.produto_nome || 'Produto Removido'}</td>
                                    <td>${fmtReal(i.preco_unitario)}</td>
                                    <td>${fmtReal(i.quantidade * i.preco_unitario)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>` 
                : `<p style="margin-top:5px; font-family: monospace; white-space: pre-wrap;">${p.pedido_descricao ? p.pedido_descricao.replace(/,/g, '\n') : 'Sem descrição'}</p>`}
            </div>
            <div style="text-align: right; font-size: 1.2rem; color: var(--green); margin-top: 15px;">
                <strong>Total: ${fmtReal(p.total)}</strong>
            </div>
        `;
        
        const a = document.getElementById('detalhes-acoes');
        a.innerHTML = `
            ${statusSelectHTML(p.id, p.status)}
            <button class="btn btn-primary" onclick="imprimirComanda(${p.id})">
                <span class="material-icons-round">print</span> Imprimir
            </button>
        `;
        
        document.getElementById('modal-detalhes').style.display = 'flex';
    } catch(e) {}
}

function fecharModalDetalhes(e) {
    if (e.target.id === 'modal-detalhes') document.getElementById('modal-detalhes').style.display = 'none';
}

// ── HISTÓRICO ────────────────────────────────────────
async function carregarHistorico() {
    try {
        const dateInput = document.getElementById('filtro-data');
        let url = '/api/historico';
        if (dateInput && dateInput.value) {
            url += `?data=${dateInput.value}`;
        }

        const res = await fetch(url);
        const hist = await res.json();
        const tbody = document.getElementById('tbody-hist');

        if (!hist || !hist.length) {
            tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><span class="material-icons-round">history</span><p>Nenhum pedido encontrado.</p></div></td></tr>`;
            return;
        }

        tbody.innerHTML = hist.map(p => `
            <tr>
                <td><strong>#${p.id}</strong></td>
                <td>${fmtData(p.data_hora)}</td>
                <td>${origemBadge(p.origem)}</td>
                <td>
                    <div class="cliente-name">${p.cliente_nome || '—'}</div>
                    <div class="cliente-tel">${p.cliente_tel || ''}</div>
                </td>
                <td class="pedido-desc" title="${p.pedido_desc || ''}">${p.pedido_desc || '—'}</td>
                <td>${p.endereco || '—'}</td>
                <td><strong>${fmtReal(p.total)}</strong></td>
                <td>${statusBadge(p.status)}</td>
            </tr>
        `).join('');
    } catch(e) {}
}

// ── CLIENTES (LGPD) ──────────────────────────────────
async function carregarClientes() {
    try {
        const res = await fetch('/api/clientes');
        const clientes = await res.json();
        const tbody = document.getElementById('tbody-clientes');

        if (!clientes || !clientes.length) {
            tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="material-icons-round">people</span><p>Nenhum cliente cadastrado.</p></div></td></tr>`;
            return;
        }

        tbody.innerHTML = clientes.map(c => `
            <tr>
                <td><strong>${c.nome}</strong></td>
                <td>${c.telefone}</td>
                <td>${c.compras_qtd || 0}</td>
                <td>${fmtReal(c.valor_gasto)}</td>
                <td>${fmtData(c.ultimo_pedido)}</td>
                <td>
                    <button class="btn-erro" onclick="excluirCliente(${c.id})" style="padding: 5px 10px; border-radius: 6px; border:none; background:var(--red-lt); color:var(--red); cursor:pointer; font-weight:700;">
                        <span class="material-icons-round" style="font-size:14px">delete</span> Excluir
                    </button>
                </td>
            </tr>
        `).join('');
    } catch(e) {}
}

async function excluirCliente(id) {
    if (!confirm('ATENÇÃO (LGPD): Você tem certeza que deseja excluir todos os dados deste cliente? Esta ação não pode ser desfeita.')) return;
    try {
        await fetch('/api/clientes/' + id, { method: 'DELETE' });
        carregarClientes();
    } catch(e) {}
}

async function carregarConfiguracoes() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        // Configurações globais adicionais, se houver
    } catch(e) {}
}

// Chamar ao iniciar
setTimeout(carregarConfiguracoes, 1000);


// ── TOAST ─────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
    clearTimeout(toastTimer);
    const toast = document.getElementById('toast');
    if (toast) {
        document.getElementById('toast-msg').textContent = msg;
        toast.classList.add('show');
        toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

// ── INIT ─────────────────────────────────────────────
carregarTudo();

// Bind logout
document.querySelector('.sidebar-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
});

// ── PEDIDO MANUAL ─────────────────────────────────────
let itensManual = [];
let allProdutosDisponiveis = [];

async function abrirModalPedidoManual() {
    itensManual = [];
    document.getElementById('manual-itens-lista').innerHTML = '<span style="color:var(--text-muted);">Nenhum produto adicionado.</span>';
    document.getElementById('manual-total').value = '0.00';
    
    try {
        const res = await fetch('/api/produtos');
        allProdutosDisponiveis = await res.json();
        const sel = document.getElementById('manual-produto-select');
        sel.innerHTML = allProdutosDisponiveis
            .filter(p => p.status)
            .map(p => `<option value="${p.id}" data-preco="${p.preco_unitario}">${p.nome} - R$ ${(p.preco_unitario||0).toFixed(2)}</option>`)
            .join('');
    } catch(e) {}
    
    document.getElementById('modal-pedido-manual').style.display = 'flex';
}

function adicionarProdutoManual() {
    const sel = document.getElementById('manual-produto-select');
    const qtdInput = document.getElementById('manual-produto-qtd');
    
    if (sel.selectedIndex === -1) return;
    
    const id = parseInt(sel.value);
    const nome = sel.options[sel.selectedIndex].text.split(' - ')[0];
    const preco = parseFloat(sel.options[sel.selectedIndex].dataset.preco);
    const qtd = parseInt(qtdInput.value) || 1;
    
    for (let i = 0; i < qtd; i++) {
        itensManual.push({ id, nome, preco });
    }
    
    renderItensManual();
}

function removerItemManual(index) {
    itensManual.splice(index, 1);
    renderItensManual();
}

function renderItensManual() {
    const lista = document.getElementById('manual-itens-lista');
    
    if (itensManual.length === 0) {
        lista.innerHTML = '<span style="color:var(--text-muted);">Nenhum produto adicionado.</span>';
        document.getElementById('manual-total').value = '0.00';
        return;
    }
    
    let html = '';
    let total = 0;
    itensManual.forEach((it, index) => {
        html += `<div style="display:flex; justify-content:space-between; margin-bottom:5px; align-items:center;">
            <span>${it.nome}</span>
            <span>R$ ${it.preco.toFixed(2)} <button onclick="removerItemManual(${index})" class="btn-ghost" style="padding:0; color:var(--red);"><span class="material-icons-round" style="font-size:16px;">close</span></button></span>
        </div>`;
        total += it.preco;
    });
    lista.innerHTML = html;
    document.getElementById('manual-total').value = total.toFixed(2);
}

function fecharModalPedidoManual(e) {
    if (e.target.id === 'modal-pedido-manual') {
        document.getElementById('modal-pedido-manual').style.display = 'none';
    }
}

async function salvarPedidoManual() {
    const nome = document.getElementById('manual-nome').value.trim();
    const tel = document.getElementById('manual-tel').value.trim();
    const total = parseFloat(document.getElementById('manual-total').value);
    const pagamento = document.getElementById('manual-pagamento').value;
    const endereco = document.getElementById('manual-endereco').value.trim() || 'Retirada no Local';

    if (!nome || itensManual.length === 0 || isNaN(total)) {
        alert("Preencha o nome do cliente, adicione produtos e verifique o valor total.");
        return;
    }

    // Agrupar itens por produto
    const itensMap = {};
    itensManual.forEach(it => {
        if (!itensMap[it.id]) itensMap[it.id] = { id: it.id, nome: it.nome, preco: it.preco, quantidade: 0 };
        itensMap[it.id].quantidade++;
    });

    const payload = new FormData();
    payload.append('nome', nome);
    payload.append('telefone', tel || '00000000000');
    payload.append('total', total);
    payload.append('pagamento', pagamento);
    payload.append('origem', 'WhatsApp/Balcão');
    payload.append('endereco', endereco);
    payload.append('itens', JSON.stringify(Object.values(itensMap)));

    try {
        const resp = await fetch('/api/novo-pedido', { method: 'POST', body: payload });
        if (resp.ok) {
            showToast("Pedido Manual Lançado!");
            document.getElementById('modal-pedido-manual').style.display = 'none';
            document.getElementById('manual-nome').value = '';
            document.getElementById('manual-tel').value = '';
            document.getElementById('manual-total').value = '';
            document.getElementById('manual-endereco').value = '';
            itensManual = [];
            carregarTudo();
        } else {
            const data = await resp.json();
            alert("Erro ao lançar pedido: " + (data.erro || ''));
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão.");
    }
}

// ── DESPESAS ─────────────────────────────────────────
let catDespesasCache = [];

async function carregarDespesas() {
    try {
        const de = document.getElementById('desp-filtro-de')?.value;
        const ate = document.getElementById('desp-filtro-ate')?.value;
        let url = '/api/despesas';
        if (de && ate) url += `?de=${de}&ate=${ate}`;

        const res = await fetch(url);
        const despesas = await res.json();
        const tbody = document.getElementById('tbody-despesas');

        if (!despesas || !despesas.length) {
            tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="material-icons-round">receipt</span><p>Nenhuma despesa registrada.</p></div></td></tr>`;
            document.getElementById('desp-total').textContent = fmtReal(0);
            return;
        }

        let total = 0;
        tbody.innerHTML = despesas.map(d => {
            total += d.valor || 0;
            return `<tr>
                <td style="white-space:nowrap;">${fmtData(d.data_hora)}</td>
                <td>${d.descricao}</td>
                <td>${d.categoria_nome || '—'}</td>
                <td style="text-align:right; color:var(--red); font-weight:700;">${fmtReal(d.valor)}</td>
                <td>
                    <button class="btn btn-ghost btn-small" onclick="editarDespesa(${d.id})"><span class="material-icons-round">edit</span></button>
                    <button class="btn btn-ghost btn-small" style="color:var(--red);" onclick="excluirDespesa(${d.id})"><span class="material-icons-round">delete</span></button>
                </td>
            </tr>`;
        }).join('');
        document.getElementById('desp-total').textContent = fmtReal(total);
    } catch(e) { console.error('Erro despesas:', e); }
}

async function abrirModalDespesa(dados = null) {
    document.getElementById('desp-id').value = dados?.id || '';
    document.getElementById('desp-descricao').value = dados?.descricao || '';
    document.getElementById('desp-valor').value = dados?.valor || '';
    document.getElementById('modal-despesa-titulo').textContent = dados ? 'Editar Despesa' : 'Nova Despesa';

    // Carregar categorias
    if (!catDespesasCache.length) {
        try {
            const r = await fetch('/api/categoria-despesas');
            catDespesasCache = await r.json();
        } catch(e) {}
    }
    const sel = document.getElementById('desp-categoria');
    sel.innerHTML = '<option value="">Sem categoria</option>' +
        catDespesasCache.map(c => `<option value="${c.id}" ${dados?.categoria_id == c.id ? 'selected' : ''}>${c.nome}</option>`).join('');

    document.getElementById('modal-despesa').style.display = 'flex';
}

async function editarDespesa(id) {
    try {
        const res = await fetch(`/api/despesas?de=2000-01-01&ate=2099-12-31`);
        const lista = await res.json();
        const d = lista.find(x => x.id === id);
        if (d) abrirModalDespesa(d);
    } catch(e) {}
}

async function excluirDespesa(id) {
    if (!confirm('Excluir esta despesa?')) return;
    try {
        await fetch('/api/despesas/' + id, { method: 'DELETE' });
        carregarDespesas();
    } catch(e) {}
}

async function salvarDespesa() {
    const id = document.getElementById('desp-id').value;
    const descricao = document.getElementById('desp-descricao').value.trim();
    const categoria_id = document.getElementById('desp-categoria').value || null;
    const valor = parseFloat(document.getElementById('desp-valor').value);

    if (!descricao || isNaN(valor) || valor <= 0) {
        alert('Preencha descrição e valor válido.');
        return;
    }

    const payload = { descricao, categoria_id, valor };
    const url = id ? '/api/despesas/' + id : '/api/despesas';
    const method = id ? 'PUT' : 'POST';

    try {
        const r = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if (!r.ok) { const d = await r.json(); return alert(d.erro || 'Erro ao salvar'); }
        document.getElementById('modal-despesa').style.display = 'none';
        showToast('Despesa salva!');
        carregarDespesas();
    } catch(e) { alert('Erro de conexão'); }
}

function fecharModalDespesa(e) {
    if (e.target.id === 'modal-despesa') document.getElementById('modal-despesa').style.display = 'none';
}

// ── RELATÓRIOS FINANCEIROS ────────────────────────────
async function carregarRelatorios() {
    const de = document.getElementById('rel-de').value;
    const ate = document.getElementById('rel-ate').value;

    if (!de || !ate) { alert('Selecione o período (de e até).'); return; }

    try {
        const res = await fetch(`/api/relatorios?de=${de}&ate=${ate}`);
        if (!res.ok) { const d = await res.json(); return alert(d.erro || 'Erro'); }
        const r = await res.json();

        document.getElementById('rel-entradas').textContent = fmtReal(r.total_entradas);
        document.getElementById('rel-saidas').textContent   = fmtReal(r.total_saidas);
        document.getElementById('rel-lucro').textContent    = fmtReal(r.lucro_liquido);
        document.getElementById('rel-lucro').style.color    = r.lucro_liquido >= 0 ? 'var(--green)' : 'var(--red)';
        document.getElementById('rel-pedidos-sub').textContent = `${r.pedidos_concluidos} pedidos concluídos`;

        document.getElementById('rel-rank-cat').innerHTML = r.rank_categorias.length
            ? r.rank_categorias.map(c => `<tr><td>${c.categoria}</td><td style="text-align:right; font-weight:700;">${c.total_vendido}</td></tr>`).join('')
            : '<tr><td colspan="2" style="text-align:center; padding:15px; color:var(--text-muted);">Sem dados</td></tr>';

        document.getElementById('rel-rank-prod').innerHTML = r.rank_produtos.length
            ? r.rank_produtos.map(p => `<tr><td>${p.produto}</td><td style="text-align:right;">${p.total_vendido}</td><td style="text-align:right; font-weight:700;">${fmtReal(p.receita)}</td></tr>`).join('')
            : '<tr><td colspan="3" style="text-align:center; padding:15px; color:var(--text-muted);">Sem dados</td></tr>';

        document.getElementById('rel-kpis').style.display = '';
        document.getElementById('rel-rankings').style.display = 'grid';
    } catch(e) { console.error('Erro relatórios:', e); alert('Erro ao gerar relatório.'); }
}