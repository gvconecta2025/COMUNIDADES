if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => console.log('Falha SW:', error));
    });
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Referências de UI
const logoutBtn = document.getElementById('logout-btn');
const userEmailSpan = document.getElementById('user-email');
const authContainer = document.getElementById('auth-container');
const loginBox = document.getElementById('login-box');
const registerBox = document.getElementById('register-box');
const dynamicContent = document.getElementById('dynamic-content');
const adminPanel = document.getElementById('admin-panel');
const sidebar = document.getElementById('sidebar');
const mobileNav = document.getElementById('mobile-bottom-nav');
const adminPanelLink = document.getElementById('admin-panel-link');
const masterAdminTools = document.getElementById('master-admin-tools');

// Alternar entre Login e Cadastro
document.getElementById('link-show-register').addEventListener('click', (e) => {
    e.preventDefault();
    loginBox.classList.add('hidden');
    registerBox.classList.remove('hidden');
});
document.getElementById('link-show-login').addEventListener('click', (e) => {
    e.preventDefault();
    registerBox.classList.add('hidden');
    loginBox.classList.remove('hidden');
});

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
        // Usuário Logado
        userEmailSpan.textContent = user.email;
        logoutBtn.classList.remove('hidden');
        authContainer.classList.add('hidden');
        sidebar.classList.remove('hidden');
        mobileNav.classList.remove('hidden');
        dynamicContent.classList.remove('hidden');
        
        await carregarPerfilUsuario(user.uid);
    } else {
        // Usuário Deslogado
        userEmailSpan.textContent = 'Não logado';
        logoutBtn.classList.add('hidden');
        sidebar.classList.add('hidden');
        mobileNav.classList.add('hidden');
        dynamicContent.classList.add('hidden');
        adminPanel.classList.add('hidden');
        adminPanelLink.classList.add('hidden');
        authContainer.classList.remove('hidden');
    }
});

async function carregarPerfilUsuario(uid) {
    try {
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            const nivel = userData.role;

            // Níveis 1, 2 e 3 veem o Painel de Controle
            if (nivel === 'programador' || nivel === 'produtor' || nivel === 'admin') {
                adminPanelLink.classList.remove('hidden');
            }
            
            // Nível 1 (Programador) vê a ferramenta extra de trocar níveis
            if (nivel === 'programador') {
                masterAdminTools.classList.remove('hidden');
            }

        } else {
            dynamicContent.innerHTML = `<h2>Erro</h2><p>Perfil de usuário não encontrado no banco de dados.</p>`;
        }
    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
    }
}

// -----------------------------------------
// SISTEMA DE AUTENTICAÇÃO
// -----------------------------------------

// Realizar Login
document.getElementById('form-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    const btn = e.target.querySelector('button');
    btn.textContent = 'Aguarde...';
    
    signInWithEmailAndPassword(auth, email, pass)
        .catch(error => alert("Erro ao logar: " + error.message))
        .finally(() => btn.textContent = 'Entrar');
});

// Realizar Cadastro (Cria Autenticação e Banco de Dados Nível 4)
document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    const btn = e.target.querySelector('button');
    btn.textContent = 'Aguarde...';

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;

        // Grava no Banco de Dados como Nível 4 (usuario)
        await setDoc(doc(db, "users", user.uid), {
            email: email,
            role: 'usuario',
            acesso_comunidades: [],
            acesso_projetos: []
        });

        alert("Conta criada com sucesso!");
    } catch (error) {
        alert("Erro ao criar conta: " + error.message);
    } finally {
        btn.textContent = 'Cadastrar';
    }
});

// Botão Sair
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// -----------------------------------------
// FUNÇÕES DO PAINEL DE CONTROLE
// -----------------------------------------

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
            id_criador: auth.currentUser.uid
        });
        alert(`Comunidade criada!\nGuarde o ID: ${docRef.id}`);
        e.target.reset();
    } catch (error) {
        alert("Erro: " + error.message);
    } finally {
        btn.textContent = 'Salvar Comunidade';
        btn.disabled = false;
    }
});

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
        alert("Erro: " + error.message);
    } finally {
        btn.textContent = 'Salvar Projeto';
        btn.disabled = false;
    }
});

// Alterar Nível (Exclusivo Programador)
document.getElementById('form-role').addEventListener('submit', async (e) => {
    e.preventDefault();
    const uid = document.getElementById('role-uid').value;
    const role = document.getElementById('role-select').value;
    const btn = e.target.querySelector('button');

    try {
        btn.textContent = 'Atualizando...';
        btn.disabled = true;
        await updateDoc(doc(db, "users", uid), {
            role: role
        });
        alert("Nível de acesso atualizado com sucesso!");
        e.target.reset();
    } catch (error) {
        alert("Erro ao atualizar (verifique se o UID está correto): " + error.message);
    } finally {
        btn.textContent = 'Atualizar Nível';
        btn.disabled = false;
    }
});
