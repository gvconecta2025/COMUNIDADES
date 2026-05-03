if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(e => console.log('SW Erro:', e)); });
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, query, where, orderBy, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

let currentUserRole = 'usuario';
let currentUserData = null; 
let currentProjetoId = null;
let allUsersData = []; 

// Lógica de Expansão do Menu CRM
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');

if(sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
        if(sidebar.classList.contains('expanded')) {
            sidebar.classList.remove('expanded');
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
            sidebar.classList.add('expanded');
        }
    });
}

// Elementos UI
const logoutBtn = document.getElementById('logout-btn');
const userEmailSpan = document.getElementById('user-email');
const authContainer = document.getElementById('auth-container');
const loginBox = document.getElementById('login-box');
const registerBox = document.getElementById('register-box');
const dynamicContent = document.getElementById('dynamic-content');
const projectView = document.getElementById('project-view');
const adminPanel = document.getElementById('admin-panel');
const communitiesContainer = document.getElementById('communities-container');
const dynamicTitle = document.getElementById('dynamic-title');
const dynamicSubtitle = document.getElementById('dynamic-subtitle');

const feedTitle = document.getElementById('feed-title');
const feedDesc = document.getElementById('feed-desc');
const feedPhoto = document.getElementById('feed-photo');
const feedFollowers = document.getElementById('feed-followers');
const feedMembers = document.getElementById('feed-members');
const postsFeed = document.getElementById('posts-feed');
const postCreator = document.getElementById('post-creator');
const btnEditPhoto = document.getElementById('btn-edit-photo');
const managementList = document.getElementById('management-list');

// Toggles de Menus
document.getElementById('link-show-register').addEventListener('click', (e) => { e.preventDefault(); loginBox.classList.add('hidden'); registerBox.classList.remove('hidden'); });
document.getElementById('link-show-login').addEventListener('click', (e) => { e.preventDefault(); registerBox.classList.add('hidden'); loginBox.classList.remove('hidden'); });

document.getElementById('nav-admin').addEventListener('click', (e) => { 
    e.preventDefault(); esconderTelas(); adminPanel.classList.remove('hidden'); carregarListaGerenciamento();
});
document.getElementById('nav-comunidades').addEventListener('click', (e) => { 
    e.preventDefault(); esconderTelas(); dynamicContent.classList.remove('hidden'); carregarVitrineComunidades(); 
});
document.getElementById('nav-projetos').addEventListener('click', (e) => { e.preventDefault(); alert("Função em desenvolvimento."); });

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
            currentUserData = userDoc.data();
            currentUserRole = currentUserData.role;

            if (currentUserRole !== 'usuario') {
                document.getElementById('admin-panel-link').classList.remove('hidden');
                carregarComunidadesSelects(currentUserData.email, currentUserRole);
            }
            if (currentUserRole === 'programador' || currentUserRole === 'produtor') {
                document.getElementById('tools-produtor').classList.remove('hidden');
            } else {
                document.getElementById('tools-produtor').classList.add('hidden');
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
            email: userCredential.user.email, role: cargoInicial, acesso_comunidades: [], seguindo_comunidades: [], acesso_projetos: []
        });
        alert("Conta criada!");
    } catch (error) { alert("Erro: " + error.message); } 
    finally { btn.textContent = 'Cadastrar'; }
});
logoutBtn.addEventListener('click', () => { signOut(auth); });

// -----------------------------------------
// VITRINE E FEED
// -----------------------------------------
async function carregarVitrineComunidades() {
    dynamicTitle.textContent = "Comunidades";
    dynamicSubtitle.textContent = "Acesse ou explore novas comunidades.";
    communitiesContainer.innerHTML = '<p class="loading-text">Buscando...</p>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "comunidades"));
        communitiesContainer.innerHTML = '';
        if (querySnapshot.empty) { communitiesContainer.innerHTML = '<p>Nenhuma comunidade encontrada.</p>'; return; }

        const arraysUsuario = {
            acesso: currentUserData?.acesso_comunidades || [],
            seguindo: currentUserData?.seguindo_comunidades || []
        };
        const categorias = { criadas: [], administradas: [], membro: [], seguindo: [], explorar: [] };

        querySnapshot.forEach((doc) => {
            const data = doc.data(); const id = doc.id;
            let isCriador = data.id_criador === auth.currentUser.uid;
            let isAdmin = data.admins_emails && data.admins_emails.includes(auth.currentUser.email) && !isCriador;
            let isMembro = arraysUsuario.acesso.includes(id);
            let isSeguidor = arraysUsuario.seguindo.includes(id);

            if (isCriador) categorias.criadas.push({id, data});
            else if (isAdmin) categorias.administradas.push({id, data});
            else if (isMembro) categorias.membro.push({id, data});
            else if (isSeguidor) categorias.seguindo.push({id, data});
            else categorias.explorar.push({id, data});
        });

        const renderizarSessao = (titulo, lista) => {
            if (lista.length === 0) return '';
            let html = `<div class="category-section"><h3 class="category-title">${titulo}</h3><div class="community-grid">`;
            lista.forEach(item => {
                html += `
                    <div class="community-card">
                        <div><h3>${item.data.nome}</h3><p>${item.data.descricao}</p></div>
                        <button onclick="listarProjetosDaComunidade('${item.id}', '${item.data.nome}')">Acessar</button>
                    </div>`;
            });
            html += `</div></div>`;
            return html;
        };

        communitiesContainer.innerHTML += renderizarSessao("Criadas por mim (Produtor)", categorias.criadas);
        communitiesContainer.innerHTML += renderizarSessao("Administrando", categorias.administradas);
        communitiesContainer.innerHTML += renderizarSessao("Membro", categorias.membro);
        communitiesContainer.innerHTML += renderizarSessao("Explorar", categorias.explorar);
    } catch (error) { console.error(error); }
}

window.listarProjetosDaComunidade = async (comId, comNome) => {
    dynamicTitle.textContent = "Projetos em: " + comNome;
    dynamicSubtitle.textContent = "Selecione o feed que deseja acessar.";
    communitiesContainer.innerHTML = '<p class="loading-text">Buscando projetos...</p>';
    
    try {
        const q = query(collection(db, "projetos"), where("id_comunidade", "==", comId));
        const querySnapshot = await getDocs(q);
        communitiesContainer.innerHTML = '<div class="community-grid" id="projetos-grid"></div>';
        const grid = document.getElementById('projetos-grid');
        
        if (querySnapshot.empty) { grid.innerHTML = '<p>Esta comunidade não possui projetos.</p>'; return; }
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            grid.innerHTML += `
                <div class="community-card">
                    <div><h3>${data.titulo}</h3><p>${data.descricao || ''}</p></div>
                    <button onclick="abrirFeedProjeto('${doc.id}')">Acessar Feed</button>
                </div>`;
        });
    } catch (error) { console.error(error); }
};

window.abrirFeedProjeto = async (projId) => {
    esconderTelas(); projectView.classList.remove('hidden'); currentProjetoId = projId;
    postsFeed.innerHTML = '<p class="loading-text">Carregando postagens...</p>';

    try {
        const projDoc = await getDoc(doc(db, "projetos", projId));
        if (projDoc.exists()) {
            const data = projDoc.data();
            feedTitle.textContent = data.titulo;
            feedDesc.textContent = data.descricao || '';
            feedFollowers.textContent = data.seguidores || 0;
            feedMembers.textContent = data.membros || 0;
            feedPhoto.src = data.foto_url || "https://via.placeholder.com/150";

            if (currentUserRole !== 'usuario') { postCreator.classList.remove('hidden'); btnEditPhoto.classList.remove('hidden'); } 
            else { postCreator.classList.add('hidden'); btnEditPhoto.classList.add('hidden'); }

            carregarPostagens();
        }
    } catch (error) { console.error(error); }
};

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
// POSTAGENS E COMENTÁRIOS
// -----------------------------------------
document.getElementById('form-post').addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = document.getElementById('post-text').value;
    const imageUrl = document.getElementById('post-image-url').value;
    const btn = e.target.querySelector('button'); btn.textContent = 'Postando...'; btn.disabled = true;

    try {
        await addDoc(collection(db, "postagens"), {
            id_projeto: currentProjetoId, autor_email: auth.currentUser.email, texto: texto, 
            imagem_url: imageUrl, data_hora: new Date().toISOString()
        });
        e.target.reset(); carregarPostagens();
    } catch (error) { alert("Erro ao postar: " + error.message); } 
    finally { btn.textContent = 'Publicar'; btn.disabled = false; }
});

async function carregarPostagens() {
    try {
        const q = query(collection(db, "postagens"), where("id_projeto", "==", currentProjetoId));
        const snapshot = await getDocs(q);
        let posts = []; snapshot.forEach(doc => posts.push({id: doc.id, ...doc.data()}));
        posts.sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora)); 

        postsFeed.innerHTML = '';
        if(posts.length === 0) { postsFeed.innerHTML = '<p class="loading-text">Nenhuma postagem ainda.</p>'; return; }

        posts.forEach(post => {
            const dataFormatada = new Date(post.data_hora).toLocaleString('pt-BR');
            const textoFormatado = processarTextoLinks(post.texto);
            const imgHtml = post.imagem_url ? `<img src="${post.imagem_url}" class="post-media">` : '';
            
            const podeExcluir = (currentUserRole !== 'usuario' || post.autor_email === auth.currentUser.email);
            const btnExcluir = podeExcluir ? `<button class="btn-sm btn-delete" onclick="excluirDocumento('postagens', '${post.id}')">Excluir</button>` : '';

            postsFeed.innerHTML += `
                <div class="post-card" id="post-${post.id}">
                    <div class="post-header">
                        <div class="post-meta"><b>${post.autor_email}</b> • ${dataFormatada}</div>
                        <div class="post-actions">${btnExcluir}</div>
                    </div>
                    <div class="post-content">${textoFormatado}</div>
                    ${imgHtml}
                    
                    <div class="comments-section">
                        <div class="comment-list" id="comments-${post.id}">Carregando...</div>
                        <form class="comment-form" onsubmit="enviarComentario(event, '${post.id}')">
                            <input type="text" id="input-comment-${post.id}" placeholder="Escreva um comentário..." required>
                            <button type="submit">Enviar</button>
                        </form>
                    </div>
                </div>`;
            
            carregarComentarios(post.id);
        });
    } catch (error) { console.error("Erro posts:", error); }
}

window.enviarComentario = async (e, postId) => {
    e.preventDefault();
    const input = document.getElementById(`input-comment-${postId}`);
    const texto = input.value;
    input.disabled = true;
    try {
        await addDoc(collection(db, "comentarios"), {
            id_post: postId, autor_email: auth.currentUser.email, texto: texto, data_hora: new Date().toISOString()
        });
        input.value = ''; carregarComentarios(postId);
    } catch (error) { alert("Erro ao comentar."); }
    finally { input.disabled = false; }
};

async function carregarComentarios(postId) {
    const list = document.getElementById(`comments-${postId}`);
    try {
        const q = query(collection(db, "comentarios"), where("id_post", "==", postId));
        const snapshot = await getDocs(q);
        let coments = []; snapshot.forEach(doc => coments.push({id: doc.id, ...doc.data()}));
        coments.sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora)); 

        list.innerHTML = '';
        if(coments.length === 0) { list.innerHTML = '<span style="font-size:0.85rem; color:var(--text-light);">Seja o primeiro a comentar.</span>'; return; }

        coments.forEach(c => {
            const podeExcluir = (currentUserRole !== 'usuario' || c.autor_email === auth.currentUser.email);
            const btnX = podeExcluir ? `<button onclick="excluirDocumento('comentarios', '${c.id}', '${postId}')" style="background:none; border:none; color:var(--danger-color); cursor:pointer;">✖</button>` : '';
            list.innerHTML += `
                <div class="comment-item">
                    <div><span class="comment-author">${c.autor_email}</span> ${c.texto}</div>
                    ${btnX}
                </div>`;
        });
    } catch (error) { list.innerHTML = 'Erro ao carregar comentários.'; }
}

function processarTextoLinks(texto) {
    let seguro = texto.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return seguro.replace(urlRegex, (url) => {
        const urlLower = url.toLowerCase();
        const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        if (ytMatch && ytMatch[1]) { return `<iframe class="post-media" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe>`; }
        return `<br><a href="${url}" target="_blank" class="btn-link">Acessar Link Externo</a><br>`;
    });
}

// -----------------------------------------
// PAINEL DE CONTROLE (GRAVAÇÕES E GESTÃO)
// -----------------------------------------
document.getElementById('form-comunidade').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.textContent = 'Salvando...'; btn.disabled = true;
    try {
        await addDoc(collection(db, "comunidades"), {
            nome: document.getElementById('comunidade-nome').value, descricao: document.getElementById('comunidade-desc').value, 
            id_criador: auth.currentUser.uid, admins_emails: [auth.currentUser.email] 
        });
        alert(`Comunidade criada!`); e.target.reset(); carregarComunidadesSelects(auth.currentUser.email, currentUserRole); carregarListaGerenciamento();
    } catch (error) { alert("Erro: " + error.message); } finally { btn.textContent = 'Salvar Comunidade'; btn.disabled = false; }
});

document.getElementById('form-projeto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.textContent = 'Salvando...'; btn.disabled = true;
    try {
        await addDoc(collection(db, "projetos"), {
            titulo: document.getElementById('projeto-titulo').value, descricao: document.getElementById('projeto-desc').value,
            id_comunidade: document.getElementById('projeto-id-comunidade-select').value, 
            seguidores: 0, membros: 0, foto_url: "https://via.placeholder.com/150"
        });
        alert("Projeto salvo com sucesso!"); e.target.reset(); carregarListaGerenciamento();
    } catch (error) { alert("Erro: " + error.message); } finally { btn.textContent = 'Salvar Projeto'; btn.disabled = false; }
});

// MOTOR DE EDIÇÃO E EXCLUSÃO GERAL
window.excluirDocumento = async (colecao, idDoc, refReloadId = null) => {
    if(confirm("Tem certeza que deseja excluir permanentemente este item?")) {
        try {
            await deleteDoc(doc(db, colecao, idDoc));
            if(colecao === 'postagens') carregarPostagens();
            else if(colecao === 'comentarios') carregarComentarios(refReloadId);
            else carregarListaGerenciamento();
        } catch (error) { alert("Erro ao excluir: " + error.message); }
    }
};

window.editarDocumentoTextual = async (colecao, idDoc, campoAtualizar) => {
    const novoValor = prompt("Digite o novo texto:");
    if(novoValor && novoValor.trim() !== "") {
        try {
            await updateDoc(doc(db, colecao, idDoc), { [campoAtualizar]: novoValor });
            carregarListaGerenciamento();
        } catch (error) { alert("Erro ao editar."); }
    }
}

async function carregarListaGerenciamento() {
    managementList.innerHTML = '<p class="loading-text">Buscando...</p>';
    if(currentUserRole === 'usuario') return;

    try {
        let html = '<h4 style="margin-bottom: 10px; color: var(--text-color);">Suas Comunidades</h4>';
        const qCom = (currentUserRole === 'programador') ? collection(db, "comunidades") : query(collection(db, "comunidades"), where("admins_emails", "array-contains", auth.currentUser.email));
        const snapCom = await getDocs(qCom);
        snapCom.forEach(doc => {
            html += `<div class="user-card">
                        <div class="user-info"><span class="user-email">${doc.data().nome}</span></div>
                        <div class="user-actions">
                            <button class="btn-sm btn-edit" onclick="editarDocumentoTextual('comunidades', '${doc.id}', 'nome')">Editar Nome</button>
                            <button class="btn-sm btn-delete" onclick="excluirDocumento('comunidades', '${doc.id}')">Excluir</button>
                        </div>
                     </div>`;
        });

        html += '<h4 style="margin-top:20px; margin-bottom: 10px; color: var(--text-color);">Seus Projetos</h4>';
        const snapProj = await getDocs(collection(db, "projetos"));
        snapProj.forEach(doc => {
            html += `<div class="user-card">
                        <div class="user-info"><span class="user-email">${doc.data().titulo}</span></div>
                        <div class="user-actions">
                            <button class="btn-sm btn-edit" onclick="editarDocumentoTextual('projetos', '${doc.id}', 'titulo')">Editar Título</button>
                            <button class="btn-sm btn-delete" onclick="excluirDocumento('projetos', '${doc.id}')">Excluir</button>
                        </div>
                     </div>`;
        });
        managementList.innerHTML = html;
    } catch (error) { managementList.innerHTML = '<p>Erro ao carregar dados.</p>'; }
}

// GESTÃO MASTER DE USUÁRIOS
async function carregarListaDeUsuarios() {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        allUsersData = []; querySnapshot.forEach((doc) => { allUsersData.push({ id: doc.id, ...doc.data() }); });
        renderizarUsuarios(allUsersData);
    } catch (error) {}
}

function renderizarUsuarios(users) {
    const container = document.getElementById('users-list-container'); container.innerHTML = '';
    users.forEach(user => {
        const roleStr = user.role || 'usuario';
        container.innerHTML += `
            <div class="user-card">
                <div class="user-info"><span class="user-email">${user.email}</span><span class="tag tag-${roleStr}">${roleStr.toUpperCase()}</span></div>
                <div class="user-actions">
                    <select class="role-select-inline" id="select-${user.id}">
                        <option value="usuario" ${roleStr === 'usuario' ? 'selected' : ''}>Usuário</option>
                        <option value="admin" ${roleStr === 'admin' ? 'selected' : ''}>Admin</option>
                        <option value="produtor" ${roleStr === 'produtor' ? 'selected' : ''}>Produtor</option>
                        <option value="programador" ${roleStr === 'programador' ? 'selected' : ''}>Programador</option>
                    </select>
                    <button class="btn-update-role btn-sm" style="background-color: var(--primary-color);" onclick="atualizarNivel('${user.id}')">Salvar</button>
                </div>
            </div>`;
    });
}
document.getElementById('search-user').addEventListener('input', (e) => {
    const termo = e.target.value.toLowerCase(); renderizarUsuarios(allUsersData.filter(u => u.email && u.email.toLowerCase().includes(termo)));
});
window.atualizarNivel = async (uid) => {
    const selectEl = document.getElementById(`select-${uid}`); const btn = selectEl.nextElementSibling;
    try { btn.textContent = '...'; btn.disabled = true; await updateDoc(doc(db, "users", uid), { role: selectEl.value }); alert("Acesso atualizado!"); carregarListaDeUsuarios(); } 
    catch (error) { alert("Erro."); } finally { btn.textContent = 'Salvar'; btn.disabled = false; }
};
