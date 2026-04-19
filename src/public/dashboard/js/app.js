// ── NAVEGAÇÃO ──────────────────────────────────────
const titles = { dashboard:'Dashboard', pedidos:'Pedidos', estoque:'Estoque', historico:'Histórico' };
function showView(name, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('view-' + name).classList.add('active');
    if (el) el.classList.add('active');
    document.getElementById('topbar-title').textContent = titles[name] || name;
    carregarTudo();
}

// ── STATUS ──────────────────────────────────────────
const STATUS_OPTS = ['Pendente', 'Em Preparo', 'Pronto', 'Entregue'];

function statusSelectHTML(pedidoId, current) {
    const opts = STATUS_OPTS.map(s =>
        `<option value="${s}" ${s === current ? 'selected' : ''}>${s}</option>`
    ).join('');
    return `<select class="status-select" onchange="mudarStatus(${pedidoId}, this.value)">${opts}</select>`;
}

async function mudarStatus(id, status) {
    try {
        await fetch(`/api/pedidos/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        showToast(`Pedido #${id} → ${status}`);
        carregarTudo();
    } catch(err) {
        console.error(err);
        showToast('Erro ao mudar status =/');
    }
}

// ── RENDER HELPERS ──────────────────────────────────
function origemBadge(origem) {
    const cls = origem === 'Site' ? 'o-Site' : 'o-WhatsApp';
    const icon = origem === 'Site' ? 'language' : 'whatsapp';
    return `<span class="origem-pill ${cls}"><span class="material-icons-round" style="font-size:.8rem">${icon}</span>${origem}</span>`;
}

function statusBadge(status) {
    const cls = 's-' + status.replace(' ', '-');
    const dots = { Pendente:'●', 'Em Preparo':'◐', Pronto:'✔', Entregue:'✔' };
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

// ── CONEXÃO API REST ────────────────────────────────
async function fetchAPI(endpoint) {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('Falha ao buscar ' + endpoint);
    return res.json();
}

// ── LOADER PRINCIPAL ────────────────────────────────
async function carregarTudo() {
    const view = document.querySelector('.view.active')?.id?.replace('view-', '');
    try {
        if (view === 'dashboard' || !view) await carregarDashboard();
        if (view === 'pedidos')    await carregarTodos();
        if (view === 'estoque')    await carregarEstoque();
        if (view === 'historico')  await carregarHistorico();
        
        // Sempre atualiza badge de pendentes
        const resumo = await fetchAPI('/api/resumo');
        if (resumo) document.getElementById('badge-pendentes').textContent = resumo.pendentes || 0;
    } catch(err) {
        console.error("Falha na sincronização", err);
    }
}

// ── DASHBOARD ───────────────────────────────────────
async function carregarDashboard() {
    const [pedidos, resumo] = await Promise.all([
        fetchAPI('/api/pedidos/hoje'),
        fetchAPI('/api/resumo')
    ]);

    // KPIs
    if (resumo) {
        document.getElementById('kpi-fat').textContent  = fmtReal(resumo.faturamento);
        document.getElementById('kpi-fat-sub').textContent = `${resumo.total_pedidos || 0} pedidos hoje`;
        document.getElementById('kpi-pend').textContent = resumo.pendentes || 0;
        document.getElementById('kpi-zap').textContent  = resumo.pedidos_zap || 0;
        document.getElementById('kpi-site').textContent = resumo.pedidos_site || 0;
    }

    // Tabela de abertos (Pendente + Em Preparo)
    const abertos = pedidos.filter(p => p.status !== 'Entregue');
    const tbody = document.getElementById('tbody-abertos');

    if (abertos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7">
            <div class="empty-state">
                <span class="material-icons-round">check_circle</span>
                <p>Nenhum pedido em aberto agora.</p>
            </div>
        </td></tr>`;
    } else {
        tbody.innerHTML = abertos.map(p => `
            <tr>
                <td><strong>#${p.id}</strong></td>
                <td>${origemBadge(p.origem)}</td>
                <td>
                    <div class="cliente-name">${p.cliente_nome || '—'}</div>
                    <div class="cliente-tel">${p.cliente_tel || ''}</div>
                </td>
                <td class="pedido-desc" title="${p.pedido_desc || ''}">${p.pedido_desc || '—'}</td>
                <td>${p.forma_pagamento || '—'}</td>
                <td><strong>${fmtReal(p.total)}</strong></td>
                <td>${statusSelectHTML(p.id, p.status)}</td>
            </tr>
        `).join('');
    }

    document.getElementById('atualizado-em').textContent =
        'Atualizado às ' + new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}

// ── TODOS OS PEDIDOS DE HOJE ─────────────────────────
async function carregarTodos() {
    const pedidos = await fetchAPI('/api/pedidos/hoje');
    const tbody = document.getElementById('tbody-todos');

    if (!pedidos.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><span class="material-icons-round">receipt_long</span><p>Sem pedidos hoje ainda.</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = pedidos.map(p => `
        <tr>
            <td><strong>#${p.id}</strong></td>
            <td>${fmtHora(p.data_hora)}</td>
            <td>${origemBadge(p.origem)}</td>
            <td>
                <div class="cliente-name">${p.cliente_nome || '—'}</div>
                <div class="cliente-tel">${p.cliente_tel || ''}</div>
            </td>
            <td class="pedido-desc" title="${p.pedido_desc || ''}">${p.pedido_desc || '—'}</td>
            <td>${p.forma_pagamento || '—'}</td>
            <td><strong>${fmtReal(p.total)}</strong></td>
            <td>${statusSelectHTML(p.id, p.status)}</td>
        </tr>
    `).join('');
}

// ── ESTOQUE ──────────────────────────────────────────
async function carregarEstoque() {
    const itens = await fetchAPI('/api/estoque');
    const grid  = document.getElementById('grid-estoque');

    // Máximo estimado por item (para a barra de progresso)
    const maxRef = { 'Galetos': 50, 'Salpicão': 30, 'Feijão Tropeiro': 30, 'Refrigerante': 50, 'Suco': 40 };

    grid.innerHTML = itens.map(it => {
        const max  = maxRef[it.item] || 50;
        const pct  = Math.max(0, Math.min(100, (it.quantidade / max) * 100));
        const low  = it.quantidade <= 5;
        return `
            <div class="estoque-item ${low ? 'estoque-low' : ''}">
                <div class="estoque-nome">${it.item}</div>
                <div>
                    <span class="estoque-qtd">${it.quantidade}</span>
                    <span class="estoque-un">un</span>
                </div>
                <div class="estoque-bar">
                    <div class="estoque-fill" style="width:${pct}%"></div>
                </div>
                ${low ? '<div style="font-size:.72rem;color:var(--red);margin-top:6px;font-weight:700">⚠ Estoque baixo</div>' : ''}
            </div>
        `;
    }).join('');
}

// ── HISTÓRICO ────────────────────────────────────────
async function carregarHistorico() {
    const hist  = await fetchAPI('/api/pedidos/historico');
    const tbody = document.getElementById('tbody-hist');

    if (!hist.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="material-icons-round">history</span><p>Nenhum pedido registrado ainda.</p></div></td></tr>`;
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
            <td><strong>${fmtReal(p.total)}</strong></td>
            <td>${statusBadge(p.status)}</td>
        </tr>
    `).join('');
}

// ── TOAST ─────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
    clearTimeout(toastTimer);
    document.getElementById('toast-msg').textContent = msg;
    document.getElementById('toast').classList.add('show');
    toastTimer = setTimeout(() => document.getElementById('toast').classList.remove('show'), 3000);
}

// ── SSE (REAL-TIME UPDATES VIA WEB) ───────────────────
function initSSE() {
    const evtSource = new EventSource('/api/events');
    const onlineDot = document.getElementById('online-dot');
    const onlineLabel = document.getElementById('online-label');

    evtSource.onmessage = (e) => {
        if (e.data === 'update') {
            showToast('🔔 Nova atualização no sistema!');
            carregarTudo();
        }
    };

    evtSource.onopen = () => {
        onlineDot.classList.remove('disconnected');
        onlineLabel.classList.remove('disconnected');
        onlineLabel.textContent = "Ao vivo";
    };

    evtSource.onerror = () => {
        onlineDot.classList.add('disconnected');
        onlineLabel.classList.add('disconnected');
        onlineLabel.textContent = "Offline...";
    };
}

// ── INIT ─────────────────────────────────────────────
carregarTudo();
initSSE();
// Mantemos o poll caso a conexão SSE não funcione e para sincronização eventual
setInterval(carregarTudo, 30_000);
