# 🚀 Guia Oficial de Deploy: Galeto Master

Este documento descreve os passos necessários para configurar, blindar e executar o sistema **Galeto Master** no ambiente oficial de produção (servidor do cliente).

---

## 1. Pré-Requisitos do Servidor

* **Node.js**: Versão 18.x ou 20.x instalada (`node -v` para verificar).
* **NPM**: Gerenciador de pacotes (`npm -v` para verificar).
* **PM2**: Gerenciador de processos de produção (Instalar globalmente: `npm install -g pm2`).
* **Git**: Para clonar o repositório (`git --version`).

---

## 2. Clonando e Preparando o Projeto

No terminal do servidor do cliente, acesse o diretório de destino e clone o projeto:

```bash
# 1. Clonar o projeto (certifique-se de que não vai baixar o loja.db com os testes)
git clone https://github.com/SeuUsuario/garagem-do-galeto.git
cd garagem-do-galeto

# 2. Instalar apenas dependências de produção (ignora devDependencies como nodemon/electron)
npm install --production
```

---

## 3. Configurando a Segurança (Variáveis de Ambiente)

A segurança baseia-se em não deixar segredos no código. 

1. Copie o arquivo de exemplo para gerar o arquivo de configuração real:
   ```bash
   cp .env.example .env
   ```
2. Edite o arquivo `.env` (usando `nano .env` ou bloco de notas) e insira uma senha **forte e única** para o `SESSION_SECRET`.
   * *Dica:* Você pode gerar um secret rodando `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` no terminal.

---

## 4. Gerando a Base de Dados de Produção

Se você trouxe um banco de dados de teste (`loja.db`) para o servidor, você precisará limpá-lo para a produção. 
O sistema inclui um script interativo (`scripts/reset-banco-prod.js`) e um script SQL bruto (`scripts/reset_banco_producao.sql`).

Para limpar via Node (Recomendado):
```bash
node scripts/reset-banco-prod.js
```
*Confirme digitando 's' e o banco estará limpo, mantendo apenas usuários administradores, categorias, produtos e regiões.*

---

## 5. Colocando no Ar com PM2 (Background)

O PM2 irá manter o seu aplicativo rodando em segundo plano e reiniciará o app automaticamente caso o servidor do cliente seja reiniciado.

```bash
# 1. Iniciar o servidor com o PM2
# Nota: rodamos o arquivo server-standalone.js (a API isolada) 
pm2 start server-standalone.js --name "galeto-master"

# 2. Salvar a lista atual de processos do PM2
pm2 save

# 3. Gerar o script de inicialização para que o PM2 inicie junto com o Windows/Linux
pm2 startup
```

Para monitorar os logs em tempo real, caso dê algum problema na operação, use:
```bash
pm2 logs galeto-master
```

---

## ✅ Verificação Final

* [ ] Acesse `http://IP_DO_SERVIDOR:3000`.
* [ ] Faça login com as credenciais administrativas configuradas (ex: `admin`).
* [ ] Conecte o QR Code do WhatsApp.
* [ ] Verifique se o "Faturamento Diário" e "Mensal" estão zerados.
* [ ] O ambiente está formalmente em **Produção**!
