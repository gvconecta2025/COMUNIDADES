if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => console.log('Falha SW:', error));
    });
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAy6KKgoKOfpSeSw0rxk--AGdTvq0Y1L3M",
  authDomain: "comunidades-e2f59.firebaseapp.com",
  projectId: "comunidades-e2f59",
  storageBucket: "comunidades-e2f59.firebasestorage.app",
  messagingSenderId: "923980743186",
  appId: "1:923980743186:web:1c560e5a14e6b409650ecb",
  measurementId: "G-YLC6X0CCVD"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginBtn = document.getElementById('login-btn');
const userEmailSpan = document.getElementById('user-email');
const adminPanelLink = document.getElementById('admin-panel-link');
const dynamicContent = document.getElementById('dynamic-content');
const adminPanel = document.getElementById('admin-panel');

// Navegação do Menu
document.getElementById('nav-admin').addEventListener('click', (e) => {
    e.preventDefault();
    dynamicContent.classList.add('hidden');
    adminPanel.classList.remove('hidden');
});

document.getElementById('nav-comunidades').addEventListener('click', (e) => {
    e.preventDefault();
    adminPanel.classList.add('hidden');
    dynamicContent.classList.remove('hidden');
});

// Observador de Estado
onAuthStateChanged(auth, async (user) => {
    if (user) {
        userEmailSpan.textContent = user.email;
        loginBtn.textContent = 'Sair';
        await carregarPerfilUsuario(user.uid);
    } else {
        userEmailSpan.textContent = 'Não logado';
        loginBtn.textContent = 'Entrar';
        adminPanelLink.style.display = 'none';
        adminPanel.classList.add('hidden');
        dynamicContent.classList.remove('hidden');
        dynamicContent.innerHTML = '<h2>Bem-vindo à plataforma</h2><p>Faça login para acessar.</p>';
    }
});

async function carregarPerfilUsuario(uid) {
    try {
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            if (userData.role === 'admin' || userData.role === 'produtor') {
                adminPanelLink.style.display = 'block';
            }
            dynamicContent.innerHTML = `<h2>Minhas Comunidades</h2><p>Carregando...</p>`;
        } else {
            dynamicContent.innerHTML = `<h2>Acesso Restrito</h2><p>Sem permissões configuradas.</p>`;
        }
    } catch (error) {
        console.error("Erro:", error);
    }
}

// Login
loginBtn.addEventListener('click', () => {
    if (auth.currentUser) {
        auth.signOut();
    } else {
        const email = prompt("E-mail:");
        const password = prompt("Senha:");
        if(email && password) {
            signInWithEmailAndPassword(auth, email, password).catch(e => alert("Erro: " + e.message));
        }
    }
});

// ==========================================
// FUNÇÕES DO PAINEL DE CONTROLE (GRAVAÇÃO)
// ==========================================

// Criar Comunidade
document.getElementById('form-comunidade').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('comunidade-nome').value;
    const desc = document.getElementById('comunidade-desc').value;
    const btn = e.target.querySelector('button');

    try {
        btn.textContent = 'Salvando...';
        btn.disabled = true;
        
        const docRef = await addDoc(collection(db, "comunidades"), {
            nome: nome,
            descricao: desc,
            id_produtor: auth.currentUser.uid // Vincula o criador como dono
        });
        
        alert(`Comunidade criada com sucesso!\nCopie e guarde este ID: ${docRef.id}`);
        e.target.reset();
    } catch (error) {
        alert("Erro ao criar comunidade: " + error.message);
    } finally {
        btn.textContent = 'Salvar Comunidade';
        btn.disabled = false;
    }
});

// Criar Projeto
document.getElementById('form-projeto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const titulo = document.getElementById('projeto-titulo').value;
    const idComunidade = document.getElementById('projeto-id-comunidade').value;
    const url = document.getElementById('projeto-url').value;
    const btn = e.target.querySelector('button');

    try {
        btn.textContent = 'Salvando...';
        btn.disabled = true;
        
        await addDoc(collection(db, "projetos"), {
            titulo: titulo,
            id_comunidade: idComunidade,
            conteudo_url: url
        });
        
        alert("Projeto salvo com sucesso!");
        e.target.reset();
    } catch (error) {
        alert("Erro ao salvar projeto: " + error.message);
    } finally {
        btn.textContent = 'Salvar Projeto';
        btn.disabled = false;
    }
});
