const { ipcMain } = require('electron');
const { db, query, queryOne } = require('./database');

function setupIpc(mainWindow) {
    // Pedidos de hoje
    ipcMain.handle('get-pedidos-hoje', () =>
        query("SELECT * FROM pedidos WHERE date(data_hora) = date('now','localtime') ORDER BY id DESC")
    );

    // Resumo financeiro do dia
    ipcMain.handle('get-resumo', () =>
        queryOne(`
            SELECT
                count(*)                                              AS total_pedidos,
                COALESCE(sum(total), 0)                              AS faturamento,
                sum(CASE WHEN origem  = 'Site'      THEN 1 ELSE 0 END) AS pedidos_site,
                sum(CASE WHEN origem  = 'WhatsApp'  THEN 1 ELSE 0 END) AS pedidos_zap,
                sum(CASE WHEN status  = 'Pendente'  THEN 1 ELSE 0 END) AS pendentes,
                sum(CASE WHEN status  = 'Em Preparo'THEN 1 ELSE 0 END) AS em_preparo,
                sum(CASE WHEN status  = 'Pronto'    THEN 1 ELSE 0 END) AS prontos,
                sum(CASE WHEN status  = 'Entregue'  THEN 1 ELSE 0 END) AS entregues
            FROM pedidos
            WHERE date(data_hora) = date('now','localtime')
        `)
    );

    // Estoque
    ipcMain.handle('get-estoque', () => query("SELECT * FROM estoque ORDER BY item"));

    // Atualizar status via IPC (pelo dashboard)
    ipcMain.handle('atualizar-status', (_, { id, status }) =>
        new Promise((resolve, reject) => {
            db.run("UPDATE pedidos SET status = ? WHERE id = ?", [status, id], (err) => {
                if (err) reject(err);
                else { if (mainWindow) mainWindow.webContents.send('atualizar-dashboard'); resolve({ ok: true }); }
            });
        })
    );

    // Histórico
    ipcMain.handle('get-historico', (_, { limite = 200 } = {}) =>
        query(`SELECT * FROM pedidos ORDER BY id DESC LIMIT ?`, [limite])
    );
}

module.exports = { setupIpc };
