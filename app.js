if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(e => console.log('SW Erro:', e)); });
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where, orderBy, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Referências Globais
let currentUserRole = 'usuario';
let currentProjetoId = null;
let allUsersData = []; 

// Elementos UI
const logoutBtn = document.getElementById('logout-btn');
const userEmailSpan = document.getElementById('user-email');
const authContainer = document.getElementById('auth-container');
const loginBox = document.getElementById('login-box');
const registerBox = document.getElementById('register-box');
const dynamicContent = document.getElementById('dynamic-content');
const projectView = document.getElementById('project-view');
const adminPanel = document.getElementById('admin-panel');
const communityGrid = document.getElementById('community-grid');
const dynamicTitle = document.getElementById('dynamic-title');
const dynamicSubtitle = document.getElementById('dynamic-subtitle');

// Elementos do Feed
const feedTitle = document.getElementById('feed-title');
const feedDesc = document.getElementById('feed-desc');
const feedPhoto = document.getElementById('feed-photo');
const feedFollowers = document.getElementById('feed-followers');
const feedMembers = document.getElementById('feed-members');
const postsFeed = document.getElementById('posts-feed');
const postCreator = document.getElementById('post-creator');
const btnEditPhoto = document.getElementById('btn-edit-photo');

// Toggles de Menus
document.getElementById('link-show-register').addEventListener('click', (e) => { e.preventDefault(); loginBox.classList.add('hidden'); registerBox.classList.remove('hidden'); });
document.getElementById('link-show-login').addEventListener('click', (e) => { e.preventDefault(); registerBox.classList.add('hidden'); loginBox.classList.remove('hidden'); });

document.getElementById('nav-admin').addEventListener('click', (e) => { 
    e.preventDefault(); 
    esconderTelas(); document.getElementById('admin-panel').classList.remove('hidden'); 
});
document.getElementById('nav-comunidades').addEventListener('click', (e) => { 
    e.preventDefault(); 
    esconderTelas(); dynamicContent.classList.remove('hidden'); 
    carregarVitrineComunidades(); 
});
document.getElementById('nav-projetos').addEventListener('click', (e) => {
    e.preventDefault();
    alert("Função 'Meus Projetos' (Atalhos diretos) em desenvolvimento.");
});

function esconderTelas() {
    dynamicContent.classList.add('hidden');
    adminPanel.classList.add('hidden');
    projectView.classList.add('hidden');
}

// Observador de Estado
onAuthStateChanged(auth, async (user) => {
    if (user) {
        userEmailSpan.textContent = user.email;
        logoutBtn.classList.remove('hidden');
        authContainer.classList.add('hidden');
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('mobile-bottom-nav').classList.remove('hidden');
        dynamicContent.classList.remove('hidden');
        
        await carregarPerfilUsuario(user.uid);
        carregarVitrineComunidades();
    } else {
        userEmailSpan.textContent = 'Não logado';
        logoutBtn.classList.add('hidden');
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('mobile-bottom-nav').classList.add('hidden');
        esconderTelas();
        authContainer.classList.remove('hidden');
    }
});

async function carregarPerfilUsuario(uid) {
    try {
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            currentUserRole = userDoc.data().role;

            if (currentUserRole !== 'usuario') {
                document.getElementById('admin-panel-link').classList.remove('hidden');
                carregarComunidadesSelects(userDoc.data().email, currentUserRole);
            }
            if (currentUserRole === 'programador' || currentUserRole === 'produtor') {
                document.getElementById('tools-produtor').classList.remove('hidden');
            }
            if (currentUserRole === 'programador') {
                document.getElementById('master-admin-tools').classList.remove('hidden');
                carregarListaDeUsuarios(); 
            }
        }
    } catch (error) { console.error(error); }
}

async function carregarComunidadesSelects(userEmail, role) {
    const selects = [document.getElementById('projeto-id-comunidade-select'), document.getElementById('add-admin-select')];
    try {
        let q = (role === 'programador') ? collection(db, "comunidades") : query(collection(db, "comunidades"), where("admins_emails", "array-contains", userEmail));
        const snapshot = await getDocs(q);
        let optionsHTML = '<option value="">Selecione a Comunidade...</option>';
        snapshot.forEach(doc => { optionsHTML += `<option value="${doc.id}">${doc.data().nome}</option>`; });
        selects.forEach(s => { if(s) s.innerHTML = optionsHTML; });
    } catch (error) { console.error("Erro selects:", error); }
}

// -----------------------------------------
// AUTENTICAÇÃO
// -----------------------------------------
document.getElementById('form-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.textContent = 'Aguarde...';
    signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value)
        .catch(error => alert("Erro: " + error.message)).finally(() => btn.textContent = 'Entrar');
});

document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.textContent = 'Aguarde...';
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, document.getElementById('reg-email').value, document.getElementById('reg-pass').value);
        let cargoInicial = 'usuario';
        const q = query(collection(db, "comunidades"), where("admins_emails", "array-contains", userCredential.user.email));
        if (!(await getDocs(q)).empty) cargoInicial = 'admin'; 

        await setDoc(doc(db, "users", userCredential.user.uid), {
            email: userCredential.user.email, role: cargoInicial, acesso_comunidades: [], acesso_projetos: []
        });
        alert("Conta criada!");
    } catch (error) { alert("Erro: " + error.message); } 
    finally { btn.textContent = 'Cadastrar'; }
});
logoutBtn.addEventListener('click', () => { signOut(auth); });

// -----------------------------------------
// NAVEGAÇÃO: COMUNIDADES -> PROJETOS -> FEED
// -----------------------------------------
async function carregarVitrineComunidades() {
    dynamicTitle.textContent = "Explorar Comunidades";
    dynamicSubtitle.textContent = "Confira as comunidades disponíveis.";
    communityGrid.innerHTML = '<p>Buscando...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, "comunidades"));
        communityGrid.innerHTML = '';
        if (querySnapshot.empty) { communityGrid.innerHTML = '<p>Nenhuma comunidade encontrada.</p>'; return; }
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            communityGrid.innerHTML += `
                <div class="community-card">
                    <div><h3>${data.nome}</h3><p>${data.descricao}</p></div>
                    <button onclick="listarProjetosDaComunidade('${doc.id}', '${data.nome}')">Ver Projetos</button>
                </div>`;
        });
    } catch (error) { console.error(error); }
}

window.listarProjetosDaComunidade = async (comId, comNome) => {
    // NOTA: Aqui entraria a checagem de permissão/compra do usuário.
    // Como solicitado, liberamos a visualização por enquanto para focar na estrutura do Feed.
    dynamicTitle.textContent = "Projetos em: " + comNome;
    dynamicSubtitle.textContent = "Selecione o feed que deseja acessar.";
    communityGrid.innerHTML = '<p>Buscando projetos...</p>';
    
    try {
        const q = query(collection(db, "projetos"), where("id_comunidade", "==", comId));
        const querySnapshot = await getDocs(q);
        communityGrid.innerHTML = '';
        
        if (querySnapshot.empty) {
            communityGrid.innerHTML = '<p>Esta comunidade ainda não possui projetos.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            communityGrid.innerHTML += `
                <div class="community-card">
                    <div>
                        <h3>${data.titulo}</h3>
                        <p>${data.descricao || 'Sem descrição.'}</p>
                    </div>
                    <button onclick="abrirFeedProjeto('${doc.id}')">Acessar Feed</button>
                </div>`;
        });
    } catch (error) { console.error(error); }
};

window.abrirFeedProjeto = async (projId) => {
    esconderTelas();
    projectView.classList.remove('hidden');
    currentProjetoId = projId;
    postsFeed.innerHTML = '<p>Carregando postagens...</p>';

    try {
        const projDoc = await getDoc(doc(db, "projetos", projId));
        if (projDoc.exists()) {
            const data = projDoc.data();
            feedTitle.textContent = data.titulo;
            feedDesc.textContent = data.descricao || '';
            feedFollowers.textContent = data.seguidores || 0;
            feedMembers.textContent = data.membros || 0;
            feedPhoto.src = data.foto_url || "https://via.placeholder.com/150";

            if (currentUserRole !== 'usuario') {
                postCreator.classList.remove('hidden');
                btnEditPhoto.classList.remove('hidden');
            } else {
                postCreator.classList.add('hidden');
                btnEditPhoto.classList.add('hidden');
            }

            carregarPostagens();
        }
    } catch (error) { console.error(error); }
};

// Edição de Foto (Simplificada via URL)
btnEditPhoto.addEventListener('click', async () => {
    const url = prompt("Cole o link (URL) da nova imagem circular:");
    if (url && currentProjetoId) {
        try {
            await updateDoc(doc(db, "projetos", currentProjetoId), { foto_url: url });
            feedPhoto.src = url;
        } catch (error) { alert("Erro ao atualizar foto."); }
    }
});

// -----------------------------------------
// POSTAGENS E INTERAÇÕES (FEED)
// -----------------------------------------
document.getElementById('form-post').addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = document.getElementById('post-text').value;
    const btn = e.target.querySelector('button'); btn.textContent = 'Postando...'; btn.disabled = true;

    try {
        await addDoc(collection(db, "postagens"), {
            id_projeto: currentProjetoId,
            autor_email: auth.currentUser.email,
            texto: texto,
            data_hora: new Date().toISOString()
        });
        e.target.reset();
        carregarPostagens();
    } catch (error) { alert("Erro ao postar: " + error.message); } 
    finally { btn.textContent = 'Publicar'; btn.disabled = false; }
});

async function carregarPostagens() {
    try {
        // Ordenação exige criação de Índice no Firebase se houver muitos acessos. 
        // Para simplificar no modo teste, pegamos todos e ordenamos no JS.
        const q = query(collection(db, "postagens"), where("id_projeto", "==", currentProjetoId));
        const snapshot = await getDocs(q);
        
        let posts = [];
        snapshot.forEach(doc => posts.push(doc.data()));
        posts.sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora)); // Mais recentes primeiro

        postsFeed.innerHTML = '';
        if(posts.length === 0) {
            postsFeed.innerHTML = '<p>Nenhuma postagem ainda. Seja o primeiro a postar!</p>';
            return;
        }

        posts.forEach(post => {
            const dataFormatada = new Date(post.data_hora).toLocaleString('pt-BR');
            const textoFormatado = processarTextoLinks(post.texto);
            postsFeed.innerHTML += `
                <div class="post-card">
                    <div class="post-meta">Postado por <b>${post.autor_email}</b> em ${dataFormatada}</div>
                    <div class="post-content">${textoFormatado}</div>
                </div>`;
        });
    } catch (error) { console.error("Erro ao carregar posts:", error); }
}

// MOTOR DE FORMATAÇÃO DE LINKS
function processarTextoLinks(texto) {
    // Protege contra HTML malicioso
    let seguro = texto.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    return seguro.replace(urlRegex, (url) => {
        const urlLower = url.toLowerCase();
        
        // Verifica se é imagem
        if (urlLower.match(/\.(jpeg|jpg|gif|png|webp|bmp)(?:\?.*)?$/)) {
            return `<img src="${url}" class="post-media" alt="Imagem postada">`;
        }
        
        // Verifica se é YouTube
        const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        if (ytMatch && ytMatch[1]) {
            return `<iframe class="post-media" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe>`;
        }
        
        // Se não for mídia, cria o Botão
        return `<br><a href="${url}" target="_blank" class="btn-link">Acessar Link Externo</a><br>`;
    });
}

// -----------------------------------------
// PAINEL DE CONTROLE (GRAVAÇÕES ADMIN)
// -----------------------------------------
document.getElementById('form-comunidade').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.textContent = 'Salvando...'; btn.disabled = true;
    try {
        await addDoc(collection(db, "comunidades"), {
            nome: document.getElementById('comunidade-nome').value, 
            descricao: document.getElementById('comunidade-desc').value, 
            id_criador: auth.currentUser.uid,
            admins_emails: [auth.currentUser.email] 
        });
        alert(`Comunidade criada!`); e.target.reset(); carregarComunidadesSelects(auth.currentUser.email, currentUserRole);
    } catch (error) { alert("Erro: " + error.message); } 
    finally { btn.textContent = 'Salvar Comunidade'; btn.disabled = false; }
});

document.getElementById('form-add-admin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const adminEmail = document.getElementById('add-admin-email').value;
    const btn = e.target.querySelector('button'); btn.textContent = 'Processando...'; btn.disabled = true;
    try {
        await updateDoc(doc(db, "comunidades", document.getElementById('add-admin-select').value), { admins_emails: arrayUnion(adminEmail) });
        const q = query(collection(db, "users"), where("email", "==", adminEmail));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            querySnapshot.forEach(async (uDoc) => {
                if(uDoc.data().role === 'usuario') await updateDoc(doc(db, "users", uDoc.id), { role: 'admin' });
            });
            alert(`Sucesso! Usuário promovido.`);
        } else { alert(`E-mail vinculado! Ele será promovido quando criar conta.`); }
        e.target.reset();
    } catch (error) { alert("Erro: " + error.message); } 
    finally { btn.textContent = 'Nomear Administrador'; btn.disabled = false; }
});

document.getElementById('form-projeto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.textContent = 'Salvando...'; btn.disabled = true;
    try {
        await addDoc(collection(db, "projetos"), {
            titulo: document.getElementById('projeto-titulo').value, 
            descricao: document.getElementById('projeto-desc').value,
            id_comunidade: document.getElementById('projeto-id-comunidade-select').value, 
            seguidores: 0,
            membros: 0,
            foto_url: "https://via.placeholder.com/150"
        });
        alert("Projeto (Feed) salvo com sucesso!"); e.target.reset();
    } catch (error) { alert("Erro: " + error.message); } 
    finally { btn.textContent = 'Salvar Projeto'; btn.disabled = false; }
});

// GESTÃO MASTER DE USUÁRIOS
async function carregarListaDeUsuarios() {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        allUsersData = [];
        querySnapshot.forEach((doc) => { allUsersData.push({ id: doc.id, ...doc.data() }); });
        renderizarUsuarios(allUsersData);
    } catch (error) { console.error(error); }
}

function renderizarUsuarios(users) {
    const container = document.getElementById('users-list-container'); container.innerHTML = '';
    users.forEach(user => {
        const roleStr = user.role || 'usuario';
        container.innerHTML += `
            <div class="user-card">
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
            </div>`;
    });
}

document.getElementById('search-user').addEventListener('input', (e) => {
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
