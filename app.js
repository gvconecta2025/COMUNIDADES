if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(e => console.log('SW Erro:', e)); });
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const toolsProdutor = document.getElementById('tools-produtor');
const communityGrid = document.getElementById('community-grid');
const searchUserInput = document.getElementById('search-user');
const usersListContainer = document.getElementById('users-list-container');
let allUsersData = []; 

// UI Toggles
document.getElementById('link-show-register').addEventListener('click', (e) => { e.preventDefault(); loginBox.classList.add('hidden'); registerBox.classList.remove('hidden'); });
document.getElementById('link-show-login').addEventListener('click', (e) => { e.preventDefault(); registerBox.classList.add('hidden'); loginBox.classList.remove('hidden'); });

document.getElementById('nav-admin').addEventListener('click', (e) => { e.preventDefault(); dynamicContent.classList.add('hidden'); adminPanel.classList.remove('hidden'); });
document.getElementById('nav-comunidades').addEventListener('click', (e) => { e.preventDefault(); adminPanel.classList.add('hidden'); dynamicContent.classList.remove('hidden'); carregarVitrineComunidades(); });

// Observador de Estado
onAuthStateChanged(auth, async (user) => {
    if (user) {
        userEmailSpan.textContent = user.email;
        logoutBtn.classList.remove('hidden');
        authContainer.classList.add('hidden');
        sidebar.classList.remove('hidden');
        mobileNav.classList.remove('hidden');
        dynamicContent.classList.remove('hidden');
        
        await carregarPerfilUsuario(user.uid);
        carregarVitrineComunidades();
    } else {
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

            // Controle do Painel
            if (nivel === 'programador' || nivel === 'produtor' || nivel === 'admin') {
                adminPanelLink.classList.remove('hidden');
            }
            // Controle da Criação de Comunidades e Gestão de Admins
            if (nivel === 'programador' || nivel === 'produtor') {
                toolsProdutor.classList.remove('hidden');
            } else {
                toolsProdutor.classList.add('hidden');
            }
            // Controle Master
            if (nivel === 'programador') {
                masterAdminTools.classList.remove('hidden');
                carregarListaDeUsuarios(); 
            } else {
                masterAdminTools.classList.add('hidden');
            }

        }
    } catch (error) { console.error(error); }
}

// -----------------------------------------
// AUTENTICAÇÃO E CADASTRO INTELIGENTE
// -----------------------------------------
document.getElementById('form-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.textContent = 'Aguarde...';
    signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value)
        .catch(error => alert("Erro: " + error.message)).finally(() => btn.textContent = 'Entrar');
});

document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    const btn = e.target.querySelector('button'); btn.textContent = 'Aguarde...';

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;

        // VERIFICAÇÃO DE CONVITE: Checa se o e-mail está listado como admin em alguma comunidade
        let cargoInicial = 'usuario';
        const q = query(collection(db, "comunidades"), where("admins_emails", "array-contains", email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            cargoInicial = 'admin'; // Nasce como admin pois foi convidado previamente
        }

        await setDoc(doc(db, "users", user.uid), {
            email: email, role: cargoInicial, acesso_comunidades: [], acesso_projetos: []
        });
        alert("Conta criada com sucesso!");
    } catch (error) { alert("Erro: " + error.message); } 
    finally { btn.textContent = 'Cadastrar'; }
});

logoutBtn.addEventListener('click', () => { signOut(auth); });

// -----------------------------------------
// VITRINE DE COMUNIDADES
// -----------------------------------------
async function carregarVitrineComunidades() {
    communityGrid.innerHTML = '<p>Buscando comunidades...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, "comunidades"));
        communityGrid.innerHTML = '';
        
        if (querySnapshot.empty) {
            communityGrid.innerHTML = '<p>Nenhuma comunidade encontrada.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const card = document.createElement('div');
            card.className = 'community-card';
            card.innerHTML = `
                <div>
                    <h3>${data.nome}</h3>
                    <span class="card-id">ID: ${doc.id}</span>
                    <p>${data.descricao}</p>
                </div>
                <button onclick="acessarComunidade('${doc.id}')">Acessar Conteúdo</button>
            `;
            communityGrid.appendChild(card);
        });
    } catch (error) {
        communityGrid.innerHTML = '<p>Erro ao carregar.</p>';
        console.error(error);
    }
}

window.acessarComunidade = (id) => {
    alert("Função de acesso em desenvolvimento para o ID: " + id + "\nNo futuro, isso checará se você tem permissão ou exibirá o link de compra.");
};

// -----------------------------------------
// PAINEL DE CONTROLE (PRODUTORES/ADMINS)
// -----------------------------------------
document.getElementById('form-comunidade').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.textContent = 'Salvando...'; btn.disabled = true;
    try {
        const docRef = await addDoc(collection(db, "comunidades"), {
            nome: document.getElementById('comunidade-nome').value, 
            descricao: document.getElementById('comunidade-desc').value, 
            id_criador: auth.currentUser.uid,
            admins_emails: [auth.currentUser.email] // O criador já nasce na lista de admins
        });
        alert(`Comunidade criada!\nGuarde o ID: ${docRef.id}`);
        e.target.reset(); carregarVitrineComunidades();
    } catch (error) { alert("Erro: " + error.message); } 
    finally { btn.textContent = 'Salvar Comunidade'; btn.disabled = false; }
});

// Formulário: Adicionar Administrador à Comunidade (Produtores)
document.getElementById('form-add-admin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const comId = document.getElementById('add-admin-id').value;
    const adminEmail = document.getElementById('add-admin-email').value;
    const btn = e.target.querySelector('button'); btn.textContent = 'Processando...'; btn.disabled = true;

    try {
        // 1. Grava o e-mail no array da comunidade
        const comRef = doc(db, "comunidades", comId);
        await updateDoc(comRef, { admins_emails: arrayUnion(adminEmail) });

        // 2. Tenta achar o usuário para promover imediatamente
        const q = query(collection(db, "users"), where("email", "==", adminEmail));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            querySnapshot.forEach(async (userDoc) => {
                const userData = userDoc.data();
                if(userData.role === 'usuario') { // Só sobe pra admin se for usuário comum
                    await updateDoc(doc(db, "users", userDoc.id), { role: 'admin' });
                }
            });
            alert(`Sucesso! O usuário ${adminEmail} foi promovido a Administrador.`);
        } else {
            alert(`O e-mail ${adminEmail} foi vinculado à comunidade!\nComo ele ainda não tem conta, será promovido automaticamente quando se cadastrar.`);
        }
        e.target.reset();
    } catch (error) {
        alert("Erro. Verifique se o ID da comunidade está correto. " + error.message);
    } finally {
        btn.textContent = 'Nomear Administrador'; btn.disabled = false;
    }
});

document.getElementById('form-projeto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.textContent = 'Salvando...'; btn.disabled = true;
    try {
        await addDoc(collection(db, "projetos"), {
            titulo: document.getElementById('projeto-titulo').value, 
            id_comunidade: document.getElementById('projeto-id-comunidade').value, 
            conteudo_url: document.getElementById('projeto-url').value
        });
        alert("Projeto salvo com sucesso!"); e.target.reset();
    } catch (error) { alert("Erro: " + error.message); } 
    finally { btn.textContent = 'Salvar Projeto'; btn.disabled = false; }
});

// -----------------------------------------
// GESTÃO MASTER DE USUÁRIOS
// -----------------------------------------
async function carregarListaDeUsuarios() {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        allUsersData = [];
        querySnapshot.forEach((doc) => { allUsersData.push({ id: doc.id, ...doc.data() }); });
        renderizarUsuarios(allUsersData);
    } catch (error) { console.error(error); }
}

function renderizarUsuarios(users) {
    usersListContainer.innerHTML = '';
    users.forEach(user => {
        const roleStr = user.role || 'usuario';
        const card = document.createElement('div'); card.className = 'user-card';
        card.innerHTML = `
            <div class="user-info">
                <span class="user-email">${user.email}</span>
                <span class="tag tag-${roleStr}">${roleStr.toUpperCase()}</span>
            </div>
            <div class="user-actions">
                <select class="role-select-inline" id="select-${user.id}">
                    <option value="usuario" ${roleStr === 'usuario' ? 'selected' : ''}>Usuário</option>
                    <option value="admin" ${roleStr === 'admin' ? 'selected' : ''}>Admin</option>
                    <option value="produtor" ${roleStr === 'produtor' ? 'selected' : ''}>Produtor</option>
                    <option value="programador" ${roleStr === 'programador' ? 'selected' : ''}>Programador</option>
                </select>
                <button class="btn-update-role" onclick="atualizarNivel('${user.id}')">Salvar</button>
            </div>
        `;
        usersListContainer.appendChild(card);
    });
}

searchUserInput.addEventListener('input', (e) => {
    const termo = e.target.value.toLowerCase();
    renderizarUsuarios(allUsersData.filter(u => u.email && u.email.toLowerCase().includes(termo)));
});

window.atualizarNivel = async (uid) => {
    const selectEl = document.getElementById(`select-${uid}`);
    const btn = selectEl.nextElementSibling;
    try {
        btn.textContent = '...'; btn.disabled = true;
        await updateDoc(doc(db, "users", uid), { role: selectEl.value });
        alert("Acesso atualizado!"); carregarListaDeUsuarios(); 
    } catch (error) { alert("Erro: " + error.message); } 
    finally { btn.textContent = 'Salvar'; btn.disabled = false; }
};
