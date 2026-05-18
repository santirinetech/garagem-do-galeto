#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 *  GARAGEM DO GALETO — Script de Limpeza Segura do Banco de Dados
 *  Uso: node scripts/limpar-banco.js [--confirmar]
 *
 *  ⚠️  ATENÇÃO: Execute com --confirmar para aplicar de fato.
 *              Sem a flag, roda em modo DRY-RUN (só mostra o que faria).
 * ═══════════════════════════════════════════════════════════════
 */

const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const fs      = require('fs');

// ── Configuração ────────────────────────────────────────────────
const DB_PATH   = path.join(__dirname, '..', 'loja.db');
const CONFIRMAR = process.argv.includes('--confirmar');

// ── Tabelas que serão LIMPAS (dados de teste/operação) ──────────
// A ordem importa: apagar filhos antes dos pais (integridade referencial)
const TABELAS_LIMPAR = [
    'itens_pedido',   // filho de pedidos e produtos
    'enderecos',      // filho de clientes
    'pedidos',        // pai de itens_pedido
    'despesas',       // independente
    'clientes',       // pai de enderecos e pedidos
];

// ── Tabelas que serão PRESERVADAS (configuração base) ───────────
const TABELAS_PRESERVAR = [
    'usuarios',
    'regioes',
    'categoria_produtos',
    'produtos',
    'categoria_despesas',
];

// ── Helpers ─────────────────────────────────────────────────────
function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function query(db, sql) {
    return new Promise((resolve, reject) => {
        db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function contarRegistros(db, tabela) {
    const rows = await query(db, `SELECT COUNT(*) as total FROM ${tabela}`);
    return rows[0]?.total ?? 0;
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
    console.log('\n══════════════════════════════════════════════════════');
    console.log('  🧹 GARAGEM DO GALETO — LIMPEZA DE BANCO DE DADOS');
    console.log('══════════════════════════════════════════════════════');
    console.log(`  Banco: ${DB_PATH}`);
    console.log(`  Modo:  ${CONFIRMAR ? '⚡ EXECUÇÃO REAL' : '👁  DRY-RUN (simulação)'}`);
    console.log('══════════════════════════════════════════════════════\n');

    if (!fs.existsSync(DB_PATH)) {
        console.error('❌ Banco de dados não encontrado em:', DB_PATH);
        process.exit(1);
    }

    // ── Backup automático antes de qualquer alteração ────────────
    if (CONFIRMAR) {
        const ts      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupPath = DB_PATH.replace('loja.db', `loja_backup_${ts}.db`);
        fs.copyFileSync(DB_PATH, backupPath);
        console.log(`✅ Backup criado: ${backupPath}\n`);
    }

    const db = new sqlite3.Database(DB_PATH);

    // ── 1. Relatório de ANTES ────────────────────────────────────
    console.log('📊 ESTADO ATUAL DO BANCO:\n');
    const todasTabelas = [...TABELAS_LIMPAR, ...TABELAS_PRESERVAR];
    for (const tabela of todasTabelas) {
        try {
            const total = await contarRegistros(db, tabela);
            const acao  = TABELAS_LIMPAR.includes(tabela) ? '🗑  será limpa' : '🔒 preservada';
            console.log(`   ${tabela.padEnd(22)} ${String(total).padStart(5)} registros  →  ${acao}`);
        } catch {
            console.log(`   ${tabela.padEnd(22)} (tabela não existe ainda)`);
        }
    }

    console.log('');

    if (!CONFIRMAR) {
        console.log('──────────────────────────────────────────────────────');
        console.log('  ℹ️  DRY-RUN: nenhuma alteração foi feita.');
        console.log('  Para executar de verdade, rode:');
        console.log('  node scripts/limpar-banco.js --confirmar');
        console.log('──────────────────────────────────────────────────────\n');
        db.close();
        return;
    }

    // ── 2. Executar limpeza ──────────────────────────────────────
    console.log('🚀 Executando limpeza...\n');
    await run(db, 'PRAGMA foreign_keys = OFF');  // desliga FKs temporariamente

    for (const tabela of TABELAS_LIMPAR) {
        try {
            const antes = await contarRegistros(db, tabela);
            await run(db, `DELETE FROM ${tabela}`);
            // Resetar o auto-increment (sqlite_sequence só existe se usou AUTOINCREMENT)
            await run(db, `DELETE FROM sqlite_sequence WHERE name = ?`, [tabela]).catch(() => {});
            console.log(`   ✅ ${tabela.padEnd(22)} ${antes} registro(s) removido(s)`);
        } catch (e) {
            console.log(`   ⚠️  ${tabela.padEnd(22)} Erro: ${e.message}`);
        }
    }

    await run(db, 'PRAGMA foreign_keys = ON');

    // ── 3. VACUUM — reorganiza e compacta o arquivo .db ─────────
    console.log('\n🗜  Executando VACUUM (pode levar alguns segundos)...');
    const statAntes = fs.statSync(DB_PATH).size;
    await run(db, 'VACUUM');
    db.close();

    const statDepois = fs.statSync(DB_PATH).size;
    const economiaKB = ((statAntes - statDepois) / 1024).toFixed(1);
    console.log(`   Tamanho antes:  ${(statAntes  / 1024).toFixed(0)} KB`);
    console.log(`   Tamanho depois: ${(statDepois / 1024).toFixed(0)} KB`);
    console.log(`   Economia:       ${economiaKB} KB`);

    // ── 4. Relatório de DEPOIS ────────────────────────────────────
    const db2 = new sqlite3.Database(DB_PATH);
    console.log('\n📊 ESTADO APÓS LIMPEZA:\n');
    for (const tabela of todasTabelas) {
        try {
            const total = await contarRegistros(db2, tabela);
            console.log(`   ${tabela.padEnd(22)} ${String(total).padStart(5)} registros`);
        } catch {
            console.log(`   ${tabela.padEnd(22)} (não existe)`);
        }
    }
    db2.close();

    console.log('\n══════════════════════════════════════════════════════');
    console.log('  ✅ LIMPEZA CONCLUÍDA COM SUCESSO');
    console.log('══════════════════════════════════════════════════════\n');
}

main().catch(e => {
    console.error('\n❌ ERRO FATAL:', e.message);
    process.exit(1);
});
