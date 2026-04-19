document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const btnSubmit = document.getElementById('btn-submit');
    const errorMsg  = document.getElementById('error-msg');
    const errorText = document.getElementById('error-text');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const usuario = document.getElementById('usuario').value;
        const senha = document.getElementById('senha').value;

        // Limpar erros
        errorMsg.style.display = 'none';
        
        // Estado de carregamento
        btnSubmit.classList.add('loading');

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario, senha })
            });

            const data = await response.json();

            if (response.ok) {
                // Sucesso: redirecionar para o dashboard
                window.location.href = 'index.html';
            } else {
                // Erro: mostrar mensagem
                errorText.innerText = data.erro || 'Erro ao realizar login.';
                errorMsg.style.display = 'flex';
                btnSubmit.classList.remove('loading');
            }
        } catch (err) {
            errorText.innerText = 'Falha na conexão com o servidor.';
            errorMsg.style.display = 'flex';
            btnSubmit.classList.remove('loading');
        }
    });

    // Verificar se já está logado
    fetch('/api/check-session')
        .then(res => res.json())
        .then(data => {
            if (data.logado) {
                window.location.href = 'index.html';
            }
        })
        .catch(() => {});
});
