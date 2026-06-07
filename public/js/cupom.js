const { ipcRenderer } = require('electron');

ipcRenderer.on('render-cupom', (event, dados) => {
    const content = document.getElementById('cupom-content');
    
    // Formatação de data
    const dataObj = dados.data_hora ? new Date(dados.data_hora.replace(' ', 'T') + 'Z') : new Date();
    const dataStr = dataObj.toLocaleDateString('pt-BR');
    const horaStr = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Formatador de moeda
    const fmtReal = (v) => (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Itens (novo formato ou fallback pro formato texto)
    let itensHtml = '';
    if (dados.itens && dados.itens.length > 0) {
        itensHtml = dados.itens.map(i => `
            <div class="item-row">
                <span class="item-qty">${i.quantidade}x</span>
                <span class="item-name">${i.produto_nome || 'Item'}</span>
                <span class="item-price">${fmtReal(i.preco_unitario * i.quantidade)}</span>
            </div>
        `).join('');
    } else {
        // Fallback legado se não tiver array de itens
        const descArr = (dados.pedido || '').split(',');
        itensHtml = descArr.map(i => `
            <div class="item-row">
                <span class="item-name">• ${i.trim()}</span>
            </div>
        `).join('');
    }

    const html = `
        <div class="store-name">GARAGEM DO GALETO</div>
        <div class="text-center info-line">PEDIDO #${dados.id}</div>
        <div class="text-center info-line">${dataStr} às ${horaStr}</div>
        
        <div class="divider"></div>
        
        <div class="info-line"><span class="bold">Cliente:</span> ${dados.nome || 'Não informado'}</div>
        <div class="info-line"><span class="bold">Tel:</span> ${dados.telefone || '—'}</div>
        <div class="info-line"><span class="bold">Entrega:</span> ${dados.endereco || 'Retirada no Local'}</div>
        
        <div class="divider"></div>
        <div class="bold info-line" style="margin-bottom: 5px;">ITENS DO PEDIDO:</div>
        
        ${itensHtml}
        
        <div class="divider"></div>
        
        <div class="info-line item-row">
            <span>Subtotal:</span>
            <span>${fmtReal((dados.total || 0) - (dados.taxa || 0))}</span>
        </div>
        <div class="info-line item-row">
            <span>Taxa de Entrega:</span>
            <span>${fmtReal(dados.taxa || 0)}</span>
        </div>
        
        <div class="divider"></div>
        
        <div class="total-row">
            <span>TOTAL:</span>
            <span>${fmtReal(dados.total || 0)}</span>
        </div>
        
        <div class="info-line text-center" style="margin-top: 8px;">
            <span class="bold">Forma Pgto:</span> ${dados.pagamento || '—'}
        </div>
        
        <div class="divider"></div>
        
        <div class="footer-msg">
            Obrigado pela preferência!<br>
            Acesse: garagemdogaleto.com.br
        </div>
    `;
    
    content.innerHTML = html;
});
