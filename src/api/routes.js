const express = require('express');
const router = express.Router();
const tenantMiddleware = require('../middlewares/tenantMiddleware');
const produtosController = require('./produtosController');

// Todas as rotas abaixo deste middleware exigirão o slug da loja
router.use(tenantMiddleware);

// Rotas de Produtos
router.get('/produtos', produtosController.listarProdutos);
router.post('/produtos', produtosController.criarProduto);

// Outras rotas podem ser adicionadas no mesmo padrão, por exemplo:
// router.get('/pedidos', pedidosController.listarPedidos);

module.exports = router;
