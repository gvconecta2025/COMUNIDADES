if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(e => console.log('SW Erro:', e)); });
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, query, where, orderBy, limit, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAy6KKgoKOfpSeSw0rxk--AGdTvq0Y1L3M",
  authDomain: "comunidades-e2f59.firebaseapp.com",
  projectId: "comunidades-e2f59",
  storageBucket: "comunidades-e2f59.firebasestorage.app",
  messagingSenderId: "923980743186",
  appId: "1:923980743186:web:1c560e5a14e6b409650ecb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Referências Globais
let currentUserRole = 'usuario';
let currentUserData = null; 
let currentProjetoId = null;
let currentTargetPostId = null; // Guarda ID para focar o post
let allUsersData = []; 
let globalFeedPosts = []; 
let feedPageSize = 10;
let feedCurrentIndex = 0;

// Sidebar Toggle
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
if(sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('expanded');
        sidebar.classList.toggle('collapsed');
    });
}

// UI Globais
const userNameSpan = document.getElementById('user-name');
const userBadgesDiv = document.getElementById('user-badges');
const authContainer = document.getElementById('auth-container');
const loginBox = document.getElementById('login-box');
const registerBox = document.getElementById('register-box');

// Telas
const globalFeedView = document.getElementById('global-feed-view');
const dynamicContent = document.getElementById('dynamic-content'); 
const myProjectsView = document.getElementById('my-projects-view');
const projectView = document.getElementById('project-view');
const adminPanel = document.getElementById('admin-panel');

// Containers
const globalPostsContainer = document.getElementById('global-posts-container');
const communitiesContainer = document.getElementById('communities-container');
const myProjectsContainer = document.getElementById('my-projects-container');
const requestsList = document.getElementById('requests-list');

document.getElementById('link-show-register').addEventListener('click', (e) => { e.preventDefault(); loginBox.classList.add('hidden'); registerBox.classList.remove('hidden'); });
document.getElementById('link-show-login').addEventListener('click', (e) => { e.preventDefault(); registerBox.classList.add('hidden'); loginBox.classList.remove('hidden'); });

function esconderTelas() {
    globalFeedView.classList.add('hidden');
    dynamicContent.classList.add('hidden');
    adminPanel.classList.add('hidden');
    projectView.classList.add('hidden');
    myProjectsView.classList.add('hidden');
}

const navSetup = [
    { id: 'nav-feed', mobId: 'mob-nav-feed', action: () => { esconderTelas(); globalFeedView.classList.remove('hidden'); carregarFeedGlobal(); } },
    { id: 'nav-comunidades', mobId: 'mob-nav-comunidades', action: () => { esconderTelas(); dynamicContent.classList.remove('hidden'); carregarVitrineComunidades(); } },
    { id: 'nav-projetos', mobId: 'mob-nav-projetos', action: () => { esconderTelas(); myProjectsView.classList.remove('hidden'); carregarMeusProjetos(); } },
    { id: 'nav-admin', action: () => { esconderTelas(); adminPanel.classList.remove('hidden'); carregarListaGerenciamento(); carregarSolicitacoes(); } }
];

navSetup.forEach(nav => {
    if(document.getElementById(nav.id)) document.getElementById(nav.id).addEventListener('click', (e) => { e.preventDefault(); nav.action(); });
    if(nav.mobId && document.getElementById(nav.mobId)) document.getElementById(nav.mobId).addEventListener('click', (e) => { e.preventDefault(); nav.action(); });
});

// Ação de "HOME" nos Títulos Plataforma
const btnHomeMobile = document.getElementById('logo-home-mobile');
const btnHomeSidebar = document.getElementById('logo-home-sidebar');
const goHome = () => { if(auth.currentUser) { esconderTelas(); globalFeedView.classList.remove('hidden'); carregarFeedGlobal(); } };
if(btnHomeMobile) btnHomeMobile.addEventListener('click', goHome);
if(btnHomeSidebar) btnHomeSidebar.addEventListener('click', goHome);


onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('logout-btn').classList.remove('hidden');
        authContainer.classList.add('hidden');
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('mobile-bottom-nav').classList.remove('hidden');
        
        await carregarPerfilUsuario(user.uid, user.email);
        
        esconderTelas();
        globalFeedView.classList.remove('hidden');
        carregarFeedGlobal();
    } else {
        userNameSpan.textContent = 'Não logado';
        userBadgesDiv.innerHTML = '';
        document.getElementById('logout-btn').classList.add('hidden');
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('mobile-bottom-nav').classList.add('hidden');
        esconderTelas();
        authContainer.classList.remove('hidden');
    }
});

async function carregarPerfilUsuario(uid, email) {
    try {
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            currentUserRole = currentUserData.role;
            
            let nomeDisplay = currentUserData.nome;
            if(!nomeDisplay) {
                nomeDisplay = email.split('@')[0];
                await updateDoc(userDocRef, { nome: nomeDisplay });
                currentUserData.nome = nomeDisplay;
            }
            userNameSpan.textContent = `Olá, ${nomeDisplay}`;

            if (currentUserRole !== 'usuario') {
                document.getElementById('admin-panel-link').classList.remove('hidden');
                document.getElementById('mobile-admin-panel-link').classList.remove('hidden');
                carregarComunidadesSelects(email, currentUserRole);
            }
            if (currentUserRole === 'programador' || currentUserRole === 'produtor') {
                document.getElementById('tools-produtor').classList.remove('hidden');
                document.getElementById('join-requests-container').classList.remove('hidden');
            } else {
                document.getElementById('tools-produtor').classList.add('hidden');
                document.getElementById('join-requests-container').classList.add('hidden');
            }
            if (currentUserRole === 'programador') {
                document.getElementById('master-admin-tools').classList.remove('hidden');
                carregarListaDeUsuarios(); 
            }
            
            resolverBadgesUsuario();
            atualizarSidebarComunidades();
        }
    } catch (error) { console.error(error); }
}

async function atualizarSidebarComunidades() {
    const list = document.getElementById('sidebar-communities-list');
    if(!list) return; list.innerHTML = '';
    try {
        const snap = await getDocs(collection(db, "comunidades"));
        let html = '';
        snap.forEach(doc => {
            const data = doc.data();
            let isCriador = data.id_criador === auth.currentUser?.uid;
            let isAdmin = data.admins_emails && data.admins_emails.includes(auth.currentUser?.email);
            let isMembro = currentUserData?.acesso_comunidades?.includes(doc.id);
            
            if (isCriador || isAdmin || isMembro || currentUserRole === 'programador') {
                html += `<li><a href="#" onclick="event.preventDefault(); listarProjetosDaComunidade('${doc.id}', '${data.nome}')" title="${data.nome}"><span class="icon">💬</span> <span class="text">${data.nome}</span></a></li>`;
            }
        });
        if(html === '') document.getElementById('sidebar-dynamic-section').classList.add('hidden');
        else { document.getElementById('sidebar-dynamic-section').classList.remove('hidden'); list.innerHTML = html; }
    } catch(e) {}
}

async function resolverBadgesUsuario() {
    let bHTML = '';
    if(currentUserRole === 'programador') {
        bHTML += '<div class="badge-role">👨‍💻 Programador</div>';
    } else {
        let isProdutor = false; let isAdmin = false; let isAluno = false;
        const snap = await getDocs(collection(db, "comunidades"));
        snap.forEach(doc => {
            const data = doc.data();
            if(data.id_criador === auth.currentUser.uid) isProdutor = true;
            if(data.admins_emails && data.admins_emails.includes(auth.currentUser.email)) isAdmin = true;
            if(currentUserData?.acesso_comunidades?.includes(doc.id)) isAluno = true;
        });

        if(isProdutor || currentUserRole === 'produtor') bHTML += '<div class="badge-role">🎬 Produtor</div>';
        if(isAdmin) bHTML += '<div class="badge-role">🛡️ Administrador</div>';
        if(isAluno || currentUserRole === 'usuario') bHTML += '<div class="badge-role">👤 Membro</div>';
    }
    userBadgesDiv.innerHTML = bHTML;
}

document.getElementById('form-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.textContent = 'Aguarde...';
    signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value)
        .catch(error => alert("Erro: " + error.message)).finally(() => btn.textContent = 'Entrar');
});

document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.textContent = 'Aguarde...';
    const emailStr = document.getElementById('reg-email').value;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, emailStr, document.getElementById('reg-pass').value);
        let cargoInicial = 'usuario';
        
        const q = query(collection(db, "comunidades"), where("admins_emails", "array-contains", emailStr));
        if (!(await getDocs(q)).empty) cargoInicial = 'admin'; 

        const nomePadrao = emailStr.split('@')[0];

        await setDoc(doc(db, "users", userCredential.user.uid), {
            nome: nomePadrao, email: emailStr, role: cargoInicial, acesso_comunidades: [], acesso_projetos: []
        });
        alert("Conta criada com sucesso!");
    } catch (error) { alert("Erro: " + error.message); } 
    finally { btn.textContent = 'Cadastrar'; }
});
document.getElementById('logout-btn').addEventListener('click', () => { signOut(auth); });

// -----------------------------------------
// 1. MEU FEED (GLOBAL)
// -----------------------------------------
async function carregarFeedGlobal() {
    globalPostsContainer.innerHTML = '<p class="loading-text">Mapeando suas postagens...</p>';
    document.getElementById('btn-load-more').classList.add('hidden');
    feedCurrentIndex = 0;
    
    try {
        let meusProjetosIds = []; let nomesProjetos = {}; 
        const arraysUsuario = { acesso: currentUserData?.acesso_comunidades || [] };
        
        const comSnapshot = await getDocs(collection(db, "comunidades"));
        let comunidadesPermitidas = [];
        comSnapshot.forEach(doc => {
            const data = doc.data();
            let isCriador = data.id_criador === auth.currentUser.uid;
            let isAdmin = data.admins_emails && data.admins_emails.includes(auth.currentUser.email);
            let isMembro = arraysUsuario.acesso.includes(doc.id);
            if(isCriador || isAdmin || isMembro || currentUserRole === 'programador') comunidadesPermitidas.push(doc.id);
        });

        const projSnapshot = await getDocs(collection(db, "projetos"));
        projSnapshot.forEach(doc => {
            if(comunidadesPermitidas.includes(doc.data().id_comunidade)) {
                meusProjetosIds.push(doc.id); nomesProjetos[doc.id] = doc.data().titulo;
            }
        });

        if(meusProjetosIds.length === 0) {
            globalPostsContainer.innerHTML = '<p class="loading-text">Você ainda não participa de nenhuma comunidade ativa. Vá em Explorar!</p>'; return;
        }

        const qPosts = query(collection(db, "postagens"), orderBy("data_hora", "desc"), limit(100));
        const snapPosts = await getDocs(qPosts);
        
        globalFeedPosts = [];
        snapPosts.forEach(doc => {
            const p = doc.data();
            if(meusProjetosIds.includes(p.id_projeto)) globalFeedPosts.push({id: doc.id, nome_projeto: nomesProjetos[p.id_projeto], ...p});
        });

        if(globalFeedPosts.length === 0) { globalPostsContainer.innerHTML = '<p class="loading-text">Nenhuma postagem recente nos seus módulos.</p>'; return; }

        globalPostsContainer.innerHTML = '';
        renderizarLoteFeed();
    } catch(error) { globalPostsContainer.innerHTML = '<p>Erro ao carregar o feed.</p>'; }
}

function renderizarLoteFeed() {
    const lote = globalFeedPosts.slice(feedCurrentIndex, feedCurrentIndex + feedPageSize);
    lote.forEach(post => {
        const dataFormatada = new Date(post.data_hora).toLocaleString('pt-BR');
        const textoFormatado = processarTextoLinks(post.texto);
        const imgHtml = post.imagem_url ? `<img src="${post.imagem_url}" class="post-media">` : '';
        
        const card = document.createElement('div'); card.className = 'post-card';
        card.innerHTML = `
            <div class="post-header">
                <div class="post-meta"><b>${post.autor_email.split('@')[0]}</b> <span class="projeto-tag">${post.nome_projeto}</span><br>${dataFormatada}</div>
                <div class="post-actions"><button class="btn-sm btn-primary" onclick="abrirFeedProjeto('${post.id_projeto}', '${post.id}')"><span>💬</span> Acessar Post</button></div>
            </div>
            <div class="post-content">${textoFormatado}</div>
            ${imgHtml}
        `;
        globalPostsContainer.appendChild(card);
    });

    feedCurrentIndex += feedPageSize;
    if (feedCurrentIndex < globalFeedPosts.length) document.getElementById('btn-load-more').classList.remove('hidden');
    else { document.getElementById('btn-load-more').classList.add('hidden'); if(globalFeedPosts.length > 0) globalPostsContainer.innerHTML += '<p style="text-align:center; color: var(--text-light); margin-top: 20px;">Você chegou ao fim das novidades.</p>'; }
}
document.getElementById('btn-load-more').addEventListener('click', renderizarLoteFeed);

// -----------------------------------------
// 2. EXPLORAR E ACESSOS
// -----------------------------------------
async function carregarVitrineComunidades() {
    communitiesContainer.innerHTML = '<p class="loading-text">Buscando...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, "comunidades"));
        communitiesContainer.innerHTML = '';
        if (querySnapshot.empty) { communitiesContainer.innerHTML = '<p>Nenhuma comunidade encontrada.</p>'; return; }

        const arraysUsuario = { acesso: currentUserData?.acesso_comunidades || [] };

        querySnapshot.forEach((doc) => {
            const data = doc.data(); const id = doc.id;
            let isCriador = data.id_criador === auth.currentUser.uid;
            let isAdmin = data.admins_emails && data.admins_emails.includes(auth.currentUser.email);
            let isMembro = arraysUsuario.acesso.includes(id);

            if (!isCriador && !isAdmin && !isMembro && currentUserRole !== 'programador') {
                const visibilidade = data.visibilidade || 'publico'; 
                const badge = visibilidade === 'privado' ? '<span class="badge-private">Privada</span>' : '<span class="badge-public">Pública</span>';
                const btnAction = visibilidade === 'publico' 
                    ? `<button onclick="ingressarComunidade('${id}')">Ingressar Agora</button>`
                    : `<button class="btn-secondary" onclick="solicitarAcesso('${id}', '${data.nome}', '${data.id_criador}')">Solicitar Acesso</button>`;

                communitiesContainer.innerHTML += `
                    <div class="community-card">
                        <div><h3>${data.nome} ${badge}</h3><p>${data.descricao}</p></div>
                        ${btnAction}
                    </div>`;
            }
        });
        if(communitiesContainer.innerHTML === '') communitiesContainer.innerHTML = '<p class="loading-text">Você já participa de todas as comunidades disponíveis!</p>';
    } catch (error) {}
}

window.ingressarComunidade = async (comId) => {
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { acesso_comunidades: arrayUnion(comId) });
        alert("Sucesso! Você agora é membro desta comunidade.");
        currentUserData.acesso_comunidades.push(comId);
        carregarVitrineComunidades(); resolverBadgesUsuario(); atualizarSidebarComunidades();
    } catch (error) { alert("Erro ao ingressar."); }
};

window.solicitarAcesso = async (comId, comNome, idCriador) => {
    try {
        const q = query(collection(db, "solicitacoes"), where("uid_usuario", "==", auth.currentUser.uid), where("id_comunidade", "==", comId));
        if(!(await getDocs(q)).empty) { alert("Você já enviou uma solicitação para esta comunidade. Aguarde a aprovação."); return; }
        await addDoc(collection(db, "solicitacoes"), {
            id_comunidade: comId, nome_comunidade: comNome, id_criador: idCriador,
            uid_usuario: auth.currentUser.uid, email_usuario: auth.currentUser.email,
            nome_usuario: currentUserData.nome, status: 'pendente', data_hora: new Date().toISOString()
        });
        alert("Solicitação enviada aos administradores!"); carregarVitrineComunidades(); 
    } catch (error) {}
};

async function carregarMeusProjetos() {
    myProjectsContainer.innerHTML = '<p class="loading-text">Buscando seus projetos...</p>';
    try {
        const comSnapshot = await getDocs(collection(db, "comunidades"));
        let minhasComunidades = { produtor: [], admin: [], membro: [] };
        const arraysUsuario = { acesso: currentUserData?.acesso_comunidades || [] };

        comSnapshot.forEach(doc => {
            const data = doc.data(); const id = doc.id;
            if (data.id_criador === auth.currentUser.uid || currentUserRole === 'programador') minhasComunidades.produtor.push(id);
            else if (data.admins_emails && data.admins_emails.includes(auth.currentUser.email)) minhasComunidades.admin.push(id);
            else if (arraysUsuario.acesso.includes(id)) minhasComunidades.membro.push(id);
        });

        const projSnapshot = await getDocs(collection(db, "projetos"));
        let projetosProdutor = []; let projetosAdmin = []; let projetosMembro = [];

        projSnapshot.forEach(doc => {
            const data = doc.data();
            if (minhasComunidades.produtor.includes(data.id_comunidade)) projetosProdutor.push({id: doc.id, data});
            else if (minhasComunidades.admin.includes(data.id_comunidade)) projetosAdmin.push({id: doc.id, data});
            else if (minhasComunidades.membro.includes(data.id_comunidade)) projetosMembro.push({id: doc.id, data});
        });

        myProjectsContainer.innerHTML = '';
        const renderGrid = (titulo, lista) => {
            if(lista.length === 0) return '';
            let html = `<div class="category-section"><h3 class="category-title">${titulo}</h3><div class="community-grid">`;
            lista.forEach(p => { 
                const vis = p.data.visibilidade || 'publico';
                const badge = vis === 'privado' ? '<span class="badge-private">Privado</span>' : '<span class="badge-public">Público</span>';
                html += `<div class="community-card"><div><h3>${p.data.titulo} ${badge}</h3><p>${p.data.descricao || ''}</p></div><button onclick="abrirFeedProjeto('${p.id}')">Acessar Feed</button></div>`; 
            });
            html += `</div></div>`; return html;
        };

        if (projetosProdutor.length === 0 && projetosAdmin.length === 0 && projetosMembro.length === 0) {
            myProjectsContainer.innerHTML = '<p class="loading-text">Você ainda não possui acessos. Vá em Explorar!</p>'; return;
        }

        myProjectsContainer.innerHTML += renderGrid("Projetos como Produtor", projetosProdutor);
        myProjectsContainer.innerHTML += renderGrid("Projetos como Administrador", projetosAdmin);
        myProjectsContainer.innerHTML += renderGrid("Projetos como Membro", projetosMembro);

    } catch(error) {}
}

window.listarProjetosDaComunidade = async (comId, comNome) => {
    esconderTelas(); dynamicContent.classList.remove('hidden');
    document.getElementById('dynamic-title').textContent = "Projetos em: " + comNome;
    document.getElementById('dynamic-subtitle').textContent = "Selecione o feed que deseja acessar.";
    communitiesContainer.innerHTML = '<p class="loading-text">Buscando projetos...</p>';
    
    try {
        const q = query(collection(db, "projetos"), where("id_comunidade", "==", comId));
        const querySnapshot = await getDocs(q);
        communitiesContainer.innerHTML = '<div class="community-grid" id="projetos-grid"></div>';
        const grid = document.getElementById('projetos-grid');
        
        if (querySnapshot.empty) { grid.innerHTML = '<p>Esta comunidade não possui projetos.</p>'; return; }
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const vis = data.visibilidade || 'publico';
            const badge = vis === 'privado' ? '<span class="badge-private">Privado</span>' : '<span class="badge-public">Público</span>';
            grid.innerHTML += `
                <div class="community-card">
                    <div><h3>${data.titulo} ${badge}</h3><p>${data.descricao || ''}</p></div>
                    <button onclick="abrirFeedProjeto('${doc.id}')">Acessar Feed</button>
                </div>`;
        });
    } catch (error) { console.error(error); }
};

// -----------------------------------------
// 4. FEED DO PROJETO ESPECÍFICO
// -----------------------------------------
window.abrirFeedProjeto = async (projId, targetPostId = null) => {
    esconderTelas(); projectView.classList.remove('hidden'); 
    currentProjetoId = projId; currentTargetPostId = targetPostId;
    document.getElementById('posts-feed').innerHTML = '<p class="loading-text">Carregando postagens...</p>';

    try {
        const projDoc = await getDoc(doc(db, "projetos", projId));
        if (projDoc.exists()) {
            const data = projDoc.data();
            document.getElementById('feed-title').textContent = data.titulo;
            document.getElementById('feed-desc').textContent = data.descricao || '';
            document.getElementById('feed-photo').src = data.foto_url || "https://via.placeholder.com/150";

            if (currentUserRole !== 'usuario') { document.getElementById('post-creator').classList.remove('hidden'); document.getElementById('btn-edit-photo').classList.remove('hidden'); } 
            else { document.getElementById('post-creator').classList.add('hidden'); document.getElementById('btn-edit-photo').classList.add('hidden'); }

            carregarPostagensProjeto();
        }
    } catch (error) {}
};

document.getElementById('btn-edit-photo').addEventListener('click', async () => {
    const url = prompt("Cole o link (URL) da nova imagem circular:");
    if (url && currentProjetoId) {
        try { await updateDoc(doc(db, "projetos", currentProjetoId), { foto_url: url }); document.getElementById('feed-photo').src = url; } 
        catch (error) {}
    }
});

document.getElementById('form-post').addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = document.getElementById('post-text').value; const imageUrl = document.getElementById('post-image-url').value;
    const btn = e.target.querySelector('button'); btn.textContent = 'Postando...'; btn.disabled = true;

    try {
        await addDoc(collection(db, "postagens"), { id_projeto: currentProjetoId, autor_email: auth.currentUser.email, texto: texto, imagem_url: imageUrl, data_hora: new Date().toISOString() });
        e.target.reset(); carregarPostagensProjeto();
    } catch (error) {} finally { btn.textContent = 'Publicar'; btn.disabled = false; }
});

async function carregarPostagensProjeto() {
    try {
        const q = query(collection(db, "postagens"), where("id_projeto", "==", currentProjetoId));
        const snapshot = await getDocs(q); let posts = []; snapshot.forEach(doc => posts.push({id: doc.id, ...doc.data()}));
        posts.sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora)); 

        const pFeed = document.getElementById('posts-feed'); pFeed.innerHTML = '';
        if(posts.length === 0) { pFeed.innerHTML = '<p class="loading-text">Nenhuma postagem ainda.</p>'; return; }

        posts.forEach(post => {
            const dataFormatada = new Date(post.data_hora).toLocaleString('pt-BR');
            const textoFormatado = processarTextoLinks(post.texto);
            const imgHtml = post.imagem_url ? `<img src="${post.imagem_url}" class="post-media">` : '';
            const podeExcluir = (currentUserRole !== 'usuario' || post.autor_email === auth.currentUser.email);
            const btnExcluir = podeExcluir ? `<button class="btn-sm btn-delete" onclick="excluirDocumento('postagens', '${post.id}')">Excluir</button>` : '';

            pFeed.innerHTML += `
                <div class="post-card" id="post-${post.id}">
                    <div class="post-header">
                        <div class="post-meta"><b>${post.autor_email.split('@')[0]}</b> • ${dataFormatada}</div>
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

        // Foca visualmente no Post se veio de um "Deep Link" do Feed
        if(currentTargetPostId) {
            setTimeout(() => {
                const targetEl = document.getElementById(`post-${currentTargetPostId}`);
                if(targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetEl.classList.add('highlight-focus');
                }
                currentTargetPostId = null; // reseta
            }, 300);
        }

    } catch (error) {}
}

window.enviarComentario = async (e, postId) => {
    e.preventDefault(); const input = document.getElementById(`input-comment-${postId}`);
    const texto = input.value; input.disabled = true;
    try {
        await addDoc(collection(db, "comentarios"), { id_post: postId, autor_email: auth.currentUser.email, texto: texto, data_hora: new Date().toISOString() });
        input.value = ''; carregarComentarios(postId);
    } catch (error) {} finally { input.disabled = false; }
};

async function carregarComentarios(postId) {
    const list = document.getElementById(`comments-${postId}`);
    try {
        const q = query(collection(db, "comentarios"), where("id_post", "==", postId));
        const snapshot = await getDocs(q); let coments = []; snapshot.forEach(doc => coments.push({id: doc.id, ...doc.data()}));
        coments.sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora)); 

        list.innerHTML = '';
        if(coments.length === 0) { list.innerHTML = '<span style="font-size:0.85rem; color:var(--text-light);">Seja o primeiro a comentar.</span>'; return; }

        coments.forEach(c => {
            const podeExcluir = (currentUserRole !== 'usuario' || c.autor_email === auth.currentUser.email);
            const btnX = podeExcluir ? `<button onclick="excluirDocumento('comentarios', '${c.id}', '${postId}')" style="background:none; border:none; color:var(--danger-color); cursor:pointer;">✖</button>` : '';
            list.innerHTML += `
                <div class="comment-item">
                    <div><span class="comment-author">${c.autor_email.split('@')[0]}</span> ${c.texto}</div>
                    ${btnX}
                </div>`;
        });
    } catch (error) {}
}

function processarTextoLinks(texto) {
    let seguro = texto.replace(/</g, "&lt;").replace(/>/g, "&gt;"); const urlRegex = /(https?:\/\/[^\s]+)/g;
    return seguro.replace(urlRegex, (url) => {
        const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        if (ytMatch && ytMatch[1]) { return `<iframe class="post-media" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe>`; }
        return `<br><a href="${url}" target="_blank" class="btn-link">Acessar Link Externo</a><br>`;
    });
}

// -----------------------------------------
// PAINEL DE CONTROLE E GESTÃO
// -----------------------------------------
async function carregarComunidadesSelects(userEmail, role) {
    const selects = [document.getElementById('projeto-id-comunidade-select'), document.getElementById('add-admin-select'), document.getElementById('edit-com-select')];
    try {
        let q = (role === 'programador') ? collection(db, "comunidades") : query(collection(db, "comunidades"), where("admins_emails", "array-contains", userEmail));
        const snapshot = await getDocs(q); let optionsHTML = '<option value="">Selecione...</option>';
        snapshot.forEach(doc => { optionsHTML += `<option value="${doc.id}">${doc.data().nome}</option>`; });
        selects.forEach(s => { if(s) s.innerHTML = optionsHTML; });
    } catch (error) { }
}

document.getElementById('form-comunidade').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = 'Salvando...'; btn.disabled = true;
    try {
        await addDoc(collection(db, "comunidades"), {
            nome: document.getElementById('comunidade-nome').value, descricao: document.getElementById('comunidade-desc').value, 
            visibilidade: document.getElementById('comunidade-visibilidade').value,
            id_criador: auth.currentUser.uid, admins_emails: [auth.currentUser.email] 
        });
        alert(`Comunidade criada!`); e.target.reset(); carregarComunidadesSelects(auth.currentUser.email, currentUserRole); carregarListaGerenciamento(); atualizarSidebarComunidades();
    } catch (error) {} finally { btn.textContent = 'Criar Comunidade'; btn.disabled = false; }
});

document.getElementById('edit-com-select').addEventListener('change', async (e) => {
    if(!e.target.value) { document.getElementById('form-edit-comunidade').reset(); return; }
    const docSnap = await getDoc(doc(db, "comunidades", e.target.value));
    if(docSnap.exists()){
        const d = docSnap.data();
        document.getElementById('edit-com-nome').value = d.nome;
        document.getElementById('edit-com-desc').value = d.descricao;
        document.getElementById('edit-com-visibilidade').value = d.visibilidade || 'publico';
        document.getElementById('edit-com-admins').value = (d.admins_emails || []).join(', ');
        document.getElementById('edit-com-owner').value = ''; 
    }
});

document.getElementById('form-edit-comunidade').addEventListener('submit', async (e) => {
    e.preventDefault(); const comId = document.getElementById('edit-com-select').value;
    if(!comId) return alert("Selecione uma comunidade para editar.");
    const btn = e.target.querySelector('button'); btn.textContent = 'Salvando...'; btn.disabled = true;

    try {
        let updateData = {
            nome: document.getElementById('edit-com-nome').value, descricao: document.getElementById('edit-com-desc').value,
            visibilidade: document.getElementById('edit-com-visibilidade').value,
            admins_emails: document.getElementById('edit-com-admins').value.split(',').map(em => em.trim()).filter(em => em)
        };

        const newOwnerEmail = document.getElementById('edit-com-owner').value.trim();
        if(newOwnerEmail) {
            const qUser = query(collection(db, "users"), where("email", "==", newOwnerEmail));
            const userSnap = await getDocs(qUser);
            if(userSnap.empty) alert("O e-mail digitado para novo Dono não existe. As demais alterações foram salvas.");
            else { updateData.id_criador = userSnap.docs[0].id; alert("Propriedade transferida com sucesso!"); }
        }

        await updateDoc(doc(db, "comunidades", comId), updateData);
        alert("Atualizada com sucesso!"); e.target.reset(); 
        carregarComunidadesSelects(auth.currentUser.email, currentUserRole); carregarListaGerenciamento(); atualizarSidebarComunidades();
    } catch (err) {} finally { btn.textContent = 'Salvar Alterações'; btn.disabled = false; }
});

document.getElementById('form-projeto').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = 'Salvando...'; btn.disabled = true;
    try {
        await addDoc(collection(db, "projetos"), {
            titulo: document.getElementById('projeto-titulo').value, descricao: document.getElementById('projeto-desc').value,
            id_comunidade: document.getElementById('projeto-id-comunidade-select').value, visibilidade: document.getElementById('projeto-visibilidade').value,
            seguidores: 0, membros: 0, foto_url: "https://via.placeholder.com/150"
        });
        alert("Projeto salvo!"); e.target.reset(); carregarListaGerenciamento();
    } catch (error) {} finally { btn.textContent = 'Salvar Projeto'; btn.disabled = false; }
});

window.excluirDocumento = async (colecao, idDoc, refReloadId = null) => {
    if(confirm("Deseja excluir permanentemente?")) {
        try {
            await deleteDoc(doc(db, colecao, idDoc));
            if(colecao === 'postagens') { carregarPostagensProjeto(); carregarFeedGlobal(); }
            else if(colecao === 'comentarios') carregarComentarios(refReloadId);
            else if(colecao === 'solicitacoes') carregarSolicitacoes();
            else carregarListaGerenciamento();
        } catch (error) {}
    }
};

window.editarDocumentoTextual = async (colecao, idDoc, campoAtualizar) => {
    const novoValor = prompt("Digite o novo texto:");
    if(novoValor && novoValor.trim() !== "") {
        try { await updateDoc(doc(db, colecao, idDoc), { [campoAtualizar]: novoValor }); carregarListaGerenciamento(); atualizarSidebarComunidades(); } catch (error) {}
    }
}

async function carregarListaGerenciamento() {
    const mList = document.getElementById('management-list'); mList.innerHTML = '<p class="loading-text">Buscando...</p>';
    if(currentUserRole === 'usuario') return;

    try {
        let html = '<h4 style="margin-top:20px; margin-bottom: 10px; color: var(--text-color);">Seus Projetos</h4>';
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
        mList.innerHTML = html;
    } catch (error) { mList.innerHTML = '<p>Erro ao carregar dados.</p>'; }
}

async function carregarSolicitacoes() {
    const list = document.getElementById('requests-list'); list.innerHTML = '<p class="loading-text">Buscando...</p>';
    if(currentUserRole === 'usuario') return;

    try {
        const qCom = (currentUserRole === 'programador') ? collection(db, "comunidades") : query(collection(db, "comunidades"), where("admins_emails", "array-contains", auth.currentUser.email));
        const snapCom = await getDocs(qCom); let myComIds = []; snapCom.forEach(doc => myComIds.push(doc.id));
        if(myComIds.length === 0) { list.innerHTML = '<p>Você não administra comunidades.</p>'; return; }

        const qSol = query(collection(db, "solicitacoes"), where("status", "==", "pendente"));
        const snapSol = await getDocs(qSol);
        
        let html = '';
        snapSol.forEach(doc => {
            const req = doc.data();
            if(myComIds.includes(req.id_comunidade)) {
                html += `
                <div class="user-card" id="req-${doc.id}">
                    <div class="user-info">
                        <span class="user-email">${req.nome_usuario} deseja entrar em:</span>
                        <span class="projeto-tag" style="margin-left:0;">${req.nome_comunidade}</span>
                    </div>
                    <div class="user-actions">
                        <button class="btn-sm btn-success" onclick="aprovarSolicitacao('${doc.id}', '${req.uid_usuario}', '${req.id_comunidade}')">Aprovar</button>
                        <button class="btn-sm btn-delete" onclick="excluirDocumento('solicitacoes', '${doc.id}')">Rejeitar</button>
                    </div>
                </div>`;
            }
        });
        list.innerHTML = html || '<p>Nenhuma solicitação pendente.</p>';
    } catch(e) {}
}

window.aprovarSolicitacao = async (reqId, uidUsuario, comId) => {
    try {
        await updateDoc(doc(db, "users", uidUsuario), { acesso_comunidades: arrayUnion(comId) });
        await deleteDoc(doc(db, "solicitacoes", reqId));
        alert("Usuário aprovado!"); carregarSolicitacoes();
    } catch(e) { alert("Erro ao aprovar."); }
}

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
                <div class="user-info"><span class="user-email">${user.nome || user.email}</span><span class="tag tag-${roleStr}">${roleStr.toUpperCase()}</span></div>
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
    const termo = e.target.value.toLowerCase(); renderizarUsuarios(allUsersData.filter(u => (u.email && u.email.toLowerCase().includes(termo)) || (u.nome && u.nome.toLowerCase().includes(termo))));
});
window.atualizarNivel = async (uid) => {
    const selectEl = document.getElementById(`select-${uid}`); const btn = selectEl.nextElementSibling;
    try { btn.textContent = '...'; btn.disabled = true; await updateDoc(doc(db, "users", uid), { role: selectEl.value }); alert("Acesso atualizado!"); carregarListaDeUsuarios(); } 
    catch (error) { alert("Erro."); } finally { btn.textContent = 'Salvar'; btn.disabled = false; }
};
