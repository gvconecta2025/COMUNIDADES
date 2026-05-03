// Registra o Service Worker (PWA para instalação no celular/PC)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registrado com sucesso');
            })
            .catch(error => {
                console.log('Falha ao registrar o Service Worker:', error);
            });
    });
}

// =========================================================
// CONFIGURAÇÃO DO FIREBASE (Colocaremos os dados reais depois)
// =========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "ID",
    appId: "APP_ID"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Referências dos elementos HTML
const loginBtn = document.getElementById('login-btn');
const userEmailSpan = document.getElementById('user-email');
const adminPanelLink = document.getElementById('admin-panel-link');
const dynamicContent = document.getElementById('dynamic-content');

// Observador de Estado: Verifica se o usuário está logado ou não
onAuthStateChanged(auth, async (user) => {
    if (user) {
        userEmailSpan.textContent = user.email;
        loginBtn.textContent = 'Sair';
        await carregarPerfilUsuario(user.uid);
    } else {
        userEmailSpan.textContent = 'Não logado';
        loginBtn.textContent = 'Entrar';
        adminPanelLink.style.display = 'none';
        dynamicContent.innerHTML = '<h2>Bem-vindo à plataforma</h2><p>Faça login com seu e-mail para acessar seus projetos.</p>';
    }
});

// Busca o nível de acesso (role) e permissões no Banco de Dados
async function carregarPerfilUsuario(uid) {
    try {
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Libera painel de controle se for admin ou produtor
            if (userData.role === 'admin' || userData.role === 'produtor') {
                adminPanelLink.style.display = 'block';
            }

            dynamicContent.innerHTML = `<h2>Área de Projetos</h2><p>Carregando os módulos que você possui acesso...</p>`;
        } else {
            dynamicContent.innerHTML = `<h2>Erro</h2><p>Usuário não encontrado no banco de dados. Fale com o administrador.</p>`;
        }
    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
    }
}

// Ação do Botão de Login / Logout
loginBtn.addEventListener('click', () => {
    if (auth.currentUser) {
        auth.signOut();
    } else {
        const email = prompt("Digite seu e-mail:");
        const password = prompt("Digite sua senha:");
        
        if(email && password) {
            signInWithEmailAndPassword(auth, email, password)
                .catch(error => {
                    alert("Erro ao logar: " + error.message);
                });
        }
    }
});
