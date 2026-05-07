<<<<<<< HEAD
=======
// ── SSE: ATUALIZAÇÃO EM TEMPO REAL ──────────────────────
const eventSource = new EventSource('/api/events');
eventSource.onmessage = (e) => {
    if (e.data === 'update') {
        console.log('⚡ Atualização recebida via SSE');
        carregarTudo();
    }
};

>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
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
const titles = { dashboard:'Dashboard', pedidos:'Pedidos', estoque:'Estoque', historico:'Histórico', clientes:'Clientes (Privacidade)' };
function showView(name, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('view-' + name).classList.add('active');
    if (el) el.classList.add('active');
    document.getElementById('topbar-title').textContent = titles[name] || name;
    carregarTudo();
}

<<<<<<< HEAD
=======
// ── GESTÃO DE REGIÕES ────────────────────────────────
async function carregarRegioesDash() {
    try {
        const resp = await fetch('/api/regioes');
        const regioes = await resp.json();
        const tbody = document.getElementById('tbody-regioes');
        tbody.innerHTML = regioes.map(r => `
            <tr>
                <td><strong>${r.nome}</strong></td>
                <td>${fmtReal(r.taxa)}</td>
                <td>
                    <button class="btn btn-ghost btn-small" style="color:var(--red);" onclick="excluirRegiao(${r.id})">
                        <span class="material-icons-round icon-small">delete</span> Excluir
                    </button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhuma região cadastrada.</td></tr>';
    } catch (e) { console.error(e); }
}

async function novaRegiao() {
    const nome = prompt("Nome da Região/Bairro:");
    if (!nome) return;
    const taxa = prompt("Valor da Taxa de Entrega (Ex: 5.50):");
    if (taxa === null) return;

    try {
        const resp = await fetch('/api/regioes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, taxa: taxa.replace(',', '.') })
        });
        if (resp.ok) {
            showToast("Região cadastrada com sucesso!");
            carregarRegioesDash();
        }
    } catch (e) { console.error(e); }
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

>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
// ── STATUS ──────────────────────────────────────────
const STATUS_OPTS = ['Pendente', 'Visto', 'Preparando', 'Saiu para Entrega', 'Entregue', 'Cancelado'];

function statusSelectHTML(pedidoId, current) {
    const opts = STATUS_OPTS.map(s =>
        `<option value="${s}" ${s === current ? 'selected' : ''}>${s}</option>`
    ).join('');
    return `<select class="status-select" onchange="mudarStatus(${pedidoId}, this.value)">${opts}</select>`;
}

async function mudarStatus(id, status) {
    await fetch(`/pedido/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    showToast(`Pedido #${id} → ${status}`);
    carregarTudo();
}

// ── RENDER HELPERS ──────────────────────────────────
function origemBadge(origem) {
    const cls = origem === 'Site' ? 'o-Site' : 'o-WhatsApp';
    const icon = origem === 'Site' ? 'language' : 'whatsapp';
    return `<span class="origem-pill ${cls}"><span class="material-icons-round icon-small">${icon}</span>${origem}</span>`;
}

function statusBadge(status) {
    const cls = 's-' + status.replace(/ /g, '-');
    const dots = { Pendente:'●', Visto:'👁', Preparando:'◐', 'Saiu para Entrega':'🛵', Entregue:'✔', Cancelado:'✖' };
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
<<<<<<< HEAD
=======
        // Se estivermos no Electron, usamos a impressão térmica silenciosa
        if (window.electronAPI) {
            window.electronAPI.solicitarImpressao({
                id: p.id,
                nome: p.cliente_nome,
                telefone: p.cliente_tel,
                pedido: p.pedido_desc,
                total: p.total,
                pagamento: p.forma_pagamento,
                endereco: p.endereco
            });
            showToast(`Impressão enviada: Pedido #${id}`);
            return;
        }

        // Fallback para navegador comum (abre diálogo de impressão)
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
        const pdesc = p.pedido_desc.replace(/,/g, '<br>• ');
        const num = (p.cliente_tel || '').replace(/\D/g, '');
        const html = `
            <div class="print-title">GARAGEM DO GALETO</div>
            <div style="text-align:center; font-size:12px;">Pedido #<strong>${p.id}</strong></div>
            <div style="text-align:center; font-size:12px; margin-bottom:5px;">${fmtData(p.data_hora)}</div>
            <div class="print-line"></div>
            <div><strong>Cliente:</strong> ${p.cliente_nome}</div>
            <div><strong>Tel:</strong> ${num}</div>
            <div><strong>Canal:</strong> ${p.origem}</div>
<<<<<<< HEAD
=======
            <div style="margin-top:5px;"><strong>Entrega:</strong> ${p.endereco || 'Retirada'}</div>
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
            <div class="print-line"></div>
            <div><strong>ITENS:</strong></div>
            <div style="margin: 5px 0 10px;">• ${pdesc}</div>
            <div class="print-line"></div>
            <div class="print-row" style="font-size:16px;">
                <strong>TOTAL:</strong>
                <strong>${fmtReal(p.total)}</strong>
            </div>
            <div style="margin-top:10px; font-size:14px;"><strong>Pgto:</strong> ${p.forma_pagamento}</div>
<<<<<<< HEAD
            <div class="print-line"></div>
            <div style="text-align:center; font-size:12px; margin-top:10px; font-weight:bold;">Obrigado pela prefeência!</div>
            <div style="text-align:center; font-size:10px; margin-top:5px;">Santirine Tech</div>
        `;
        document.getElementById('print-area').innerHTML = html;
        window.print();
=======
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
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
    });
}

// ── LOADER PRINCIPAL ────────────────────────────────
async function carregarTudo() {
    const view = document.querySelector('.view.active')?.id?.replace('view-', '');
    if (view === 'dashboard' || !view) await carregarDashboard();
    if (view === 'pedidos')    await carregarTodos();
    if (view === 'estoque')    await carregarEstoque();
    if (view === 'historico')  await carregarHistorico();
    if (view === 'clientes')   await carregarClientes();
<<<<<<< HEAD
=======
    if (view === 'config')     await carregarRegioesDash();
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
    
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
        }

        // Tabela de abertos (Pendente, Preparando, Saiu para Entrega)
        const abertos = (pedidos || []).filter(p => p.status !== 'Entregue' && p.status !== 'Cancelado');
        const tbody = document.getElementById('tbody-abertos');

<<<<<<< HEAD
        // Lógica da Campainha Integrada
=======
        // Lógica de Campainha e Impressão Automática
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
        if (abertos.length > 0) {
            const maiorId = Math.max(...abertos.map(p => p.id));
            if (lastHighestId !== 0 && maiorId > lastHighestId) {
                tocarCampainha();
                showToast('🔔 NOVO PEDIDO CHEGOU!');
<<<<<<< HEAD
=======
                
                // Impressão Automática (Somente se estiver no Electron)
                if (window.electronAPI) {
                    const novoPedido = abertos.find(p => p.id === maiorId);
                    window.electronAPI.solicitarImpressao({
                        id: novoPedido.id,
                        nome: novoPedido.cliente_nome,
                        telefone: novoPedido.cliente_tel,
                        pedido: novoPedido.pedido_desc,
                        total: novoPedido.total,
                        pagamento: novoPedido.forma_pagamento,
                        endereco: novoPedido.endereco
                    });
                }
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
            }
            if (maiorId > lastHighestId) lastHighestId = maiorId;
        }

        if (abertos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7">
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
                        <div class="cliente-tel">
                            ${p.cliente_tel || ''}
                            <a href="${urlWpp}" target="_blank" class="btn-zap">WhatsApp</a>
                        </div>
                    </td>
                    <td class="pedido-desc" title="${p.pedido_desc || ''}">${p.pedido_desc || '—'}</td>
                    <td>
                        ${p.forma_pagamento || '—'}
                        ${p.comprovante ? `<br><a href="${p.comprovante}" target="_blank" class="btn-link-small">Ver Comprovante</a>` : ''}
                    </td>
<<<<<<< HEAD
=======
                    <td style="max-width:150px; font-size:0.85rem; color:var(--text-muted);">
                        ${p.endereco || '—'}
                    </td>
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
                    <td><strong>${fmtReal(p.total)}</strong></td>
                    <td>
                        <div class="flex-col-gap">
                            ${statusSelectHTML(p.id, p.status)}
                            ${p.status === 'Pendente' ? `
                                <button class="btn-visto" onclick="mudarStatus(${p.id}, 'Visto')">
                                    <span class="material-icons-round">visibility</span> Visto
                                </button>
                            ` : ''}
                            <button class="btn-imprimir" onclick="imprimirComanda(${p.id})">
                                <span class="material-icons-round icon-small">print</span> Imprimir
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
            tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><span class="material-icons-round">receipt_long</span><p>Sem pedidos hoje ainda.</p></div></td></tr>`;
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
<<<<<<< HEAD
=======
                <td style="font-size:0.85rem;">${p.endereco || '—'}</td>
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
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

// ── ESTOQUE E GESTÃO ─────────────────────────────────
async function carregarEstoque() {
    try {
        const res = await fetch('/api/estoque');
        const itens = await res.json();
        const grid  = document.getElementById('grid-estoque');

        const maxRef = { 'Galetos': 50, 'Salpicão': 30, 'Feijão Tropeiro': 30, 'Refrigerante': 50, 'Suco': 40 };

        if (!itens) return;
        grid.innerHTML = itens.map(it => {
            const max  = maxRef[it.item] || 50;
            const pct  = Math.max(0, Math.min(100, (it.quantidade / max) * 100));
            const low  = it.quantidade <= 5;
            return `
                <div class="estoque-item ${low ? 'estoque-low' : ''}">
                    <div class="estoque-nome">${it.item}</div>
                    
                    <div class="flex-between-spaced">
                        <button onclick="ajustarEstoque(${it.id}, ${it.quantidade - 1})" class="btn-ajuste-minus">-</button>
                        
                        <div class="text-center">
                            <span class="estoque-qtd text-large">${it.quantidade}</span>
                            <span class="estoque-un">un</span>
                        </div>
                        
                        <button onclick="ajustarEstoque(${it.id}, ${it.quantidade + 1})" class="btn-ajuste-plus">+</button>
                    </div>

                    <div class="estoque-bar">
                        <div class="estoque-fill" style="width:${pct}%; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;
        }).join('');
    } catch(e) {}
}

async function ajustarEstoque(id, novaQtd) {
    if (novaQtd < 0) novaQtd = 0;
    await fetch('/api/estoque/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantidade: novaQtd })
    });
    carregarEstoque();
}

// ── CAIXA E FINANCEIRO ───────────────────────────────
async function carregarCaixa() {
    try {
        const [resPed, resDesp] = await Promise.all([
            fetch('/api/resumo'),
            fetch('/api/despesas/hoje')
        ]);
        const resumo = await resPed.json();
        const despesas = await resDesp.json();

        const entradas = resumo ? resumo.faturamento : 0;
        const saidas = despesas.reduce((acc, curr) => acc + curr.valor, 0);
        const saldo = entradas - saidas;

        document.getElementById('caixa-entradas').textContent = fmtReal(entradas);
        document.getElementById('caixa-saidas').textContent = fmtReal(saidas);
        document.getElementById('caixa-saldo').textContent = fmtReal(saldo);
        
        document.getElementById('caixa-saldo').parentElement.className = `kpi ${saldo >= 0 ? 'green' : 'red'}`;

        const tbody = document.getElementById('tbody-despesas');
        if (!despesas.length) {
            tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><span class="material-icons-round">receipt</span><p>Nenhuma despesa ou retirada registrada hoje.</p></div></td></tr>`;
        } else {
            tbody.innerHTML = despesas.map(d => `
                <tr>
                    <td>${fmtHora(d.data_hora)}</td>
                    <td><strong>${d.descricao}</strong></td>
                    <td style="text-align:right; color:var(--red); font-weight:700;">- ${fmtReal(d.valor)}</td>
                </tr>
            `).join('');
        }
    } catch (e) {}
}

async function lancarDespesa() {
    const desc = document.getElementById('inp-despesa-desc').value.trim();
    const valor = parseFloat(document.getElementById('inp-despesa-valor').value);
    
    if (!desc || isNaN(valor) || valor <= 0) {
        showToast('Informe uma descrição válida e um valor maior que ZERO.');
        return;
    }

    try {
        await fetch('/api/despesas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ descricao: desc, valor })
        });
        showToast('Saída registrada com sucesso!');
        document.getElementById('inp-despesa-desc').value = '';
        document.getElementById('inp-despesa-valor').value = '';
        carregarCaixa();
    } catch (e) {}
}

// ── HISTÓRICO ────────────────────────────────────────
async function carregarHistorico() {
    try {
        // Pega data do filtro se existir
        const dateInput = document.getElementById('filtro-data');
        let url = '/api/historico';
        if (dateInput && dateInput.value) {
            url += `?data=${dateInput.value}`;
        }

        const res = await fetch(url);
        const hist = await res.json();
        const tbody = document.getElementById('tbody-hist');

        if (!hist || !hist.length) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="material-icons-round">history</span><p>Nenhum pedido encontrado.</p></div></td></tr>`;
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
<<<<<<< HEAD
=======
                <td>${p.endereco || '—'}</td>
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
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
        const res = await fetch('/api/clientes/' + id, { method: 'DELETE' });
        if (res.ok) {
            showToast('Dados do cliente excluídos permanentemente.');
            carregarClientes();
        }
    } catch(e) {}
}

// ── TOAST ─────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
    clearTimeout(toastTimer);
    document.getElementById('toast-msg').textContent = msg;
    document.getElementById('toast').classList.add('show');
    toastTimer = setTimeout(() => document.getElementById('toast').classList.remove('show'), 3000);
}

// ── INIT ─────────────────────────────────────────────
carregarTudo();
// Polling substitui o IPC para que tudo funcione via Web Puro!
setInterval(carregarTudo, 5000);

// Bind logout
document.querySelector('.sidebar-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
});