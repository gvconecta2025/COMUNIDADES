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

let currentUserRole = 'usuario';
let currentUserData = null; 
let currentCommunityId = null;
let currentProjetoId = null;
const PAGE_SIZE = 10;
let globalFeedPosts = []; let globalFeedIndex = 0;
let comFeedPosts = []; let comFeedIndex = 0;
let projFeedPosts = []; let projFeedIndex = 0;

// UX Sidebar & Mobile
const sidebar = document.getElementById('sidebar');
const mobileOverlay = document.getElementById('mobile-overlay');

window.closeSidebarMobile = () => {
    sidebar?.classList.remove('mobile-open');
    mobileOverlay?.classList.remove('active');
};

document.getElementById('mobile-menu-toggle')?.addEventListener('click', () => {
    sidebar?.classList.add('mobile-open');
    mobileOverlay?.classList.add('active');
});

document.getElementById('mobile-close-sidebar')?.addEventListener('click', window.closeSidebarMobile);
mobileOverlay?.addEventListener('click', window.closeSidebarMobile);
document.getElementById('sidebar-toggle')?.addEventListener('click', () => { sidebar.classList.toggle('expanded'); sidebar.classList.toggle('collapsed'); });

// Lógica de Sub-Abas do Painel e Pesquisa
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const parent = e.target.parentElement;
        parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        const targetId = e.target.getAttribute('data-target');
        const contentClass = targetId.startsWith('search') ? '#search-results-view .tab-content' : '#admin-panel .tab-content';
        document.querySelectorAll(contentClass).forEach(c => c.classList.add('hidden'));
        document.getElementById(targetId)?.classList.remove('hidden');
    });
});

window.esconderTelas = () => {
    document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
    document.getElementById('programmer-intel-panel')?.classList.add('hidden');
}

window.updateActiveNav = (idD, idM) => {
    document.querySelectorAll('#sidebar nav a, #mobile-bottom-nav a').forEach(el => el.classList.remove('active'));
    if(idD) document.getElementById(idD)?.classList.add('active');
    if(idM) document.getElementById(idM)?.classList.add('active');
}

window.abrirMeuFeed = (e) => {
    if(e) e.preventDefault(); window.closeSidebarMobile(); window.esconderTelas();
    document.getElementById('global-feed-view')?.classList.remove('hidden');
    window.updateActiveNav('nav-feed', 'mob-nav-feed');
    carregarFeedGlobal();
};

window.abrirExplorar = (e) => {
    if(e) e.preventDefault(); window.closeSidebarMobile(); window.esconderTelas();
    document.getElementById('dynamic-content')?.classList.remove('hidden');
    window.updateActiveNav('nav-comunidades', 'mob-nav-comunidades');
    carregarVitrineComunidades();
};

window.abrirMeusProjetos = (e) => {
    if(e) e.preventDefault(); window.closeSidebarMobile(); window.esconderTelas();
    document.getElementById('my-projects-view')?.classList.remove('hidden');
    window.updateActiveNav('nav-projetos', 'mob-nav-projetos');
    carregarMeusProjetos();
};

window.abrirPainel = (e) => {
    if(e) e.preventDefault(); window.closeSidebarMobile(); window.esconderTelas();
    document.getElementById('admin-panel')?.classList.remove('hidden');
    window.updateActiveNav('nav-admin', null);
    carregarListaGerenciamento(); carregarSolicitacoes();
};

window.goHome = () => { if(auth.currentUser) window.abrirMeuFeed(); };
document.getElementById('logo-home-mobile')?.addEventListener('click', window.goHome);
document.getElementById('logo-home-sidebar')?.addEventListener('click', window.goHome);

// AUTH
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('logout-btn')?.classList.remove('hidden');
        document.getElementById('auth-container')?.classList.add('hidden');
        document.getElementById('global-search-wrapper')?.classList.remove('hidden');
        await carregarPerfilUsuario(user.uid, user.email);
        window.goHome();
    } else {
        document.getElementById('user-name').textContent = 'Não logado';
        document.getElementById('logout-btn')?.classList.add('hidden');
        document.getElementById('global-search-wrapper')?.classList.add('hidden');
        window.esconderTelas(); document.getElementById('auth-container')?.classList.remove('hidden');
    }
});

async function carregarPerfilUsuario(uid, email) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            currentUserData = userDoc.data(); currentUserRole = currentUserData.role;
            document.getElementById('user-name').textContent = currentUserData.nome || email.split('@')[0];
            if (currentUserRole !== 'usuario') {
                document.getElementById('admin-panel-link')?.classList.remove('hidden');
                if(currentUserRole === 'programador') document.getElementById('master-tab-btn')?.classList.remove('hidden');
            }
            document.getElementById('tools-produtor')?.classList.toggle('hidden', !['programador','produtor'].includes(currentUserRole));
            
            resolverBadgesUsuario(); carregarComunidadesSelects(email, currentUserRole); atualizarSidebarComunidades();
        }
    } catch (e) {}
}

async function resolverBadgesUsuario() {
    let bHTML = '';
    if(currentUserRole === 'programador') { bHTML = '<div class="badge-role">👨‍💻 Programador</div>'; } 
    else {
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
        if(isAluno && currentUserRole === 'usuario') bHTML += '<div class="badge-role">👤 Membro</div>';
        if(!isProdutor && !isAdmin && !isAluno && currentUserRole === 'usuario') bHTML = '<div class="badge-role">👀 Visitante</div>';
    }
    document.getElementById('user-badges').innerHTML = bHTML;
}

// BUSCA GLOBAL
const searchInput = document.getElementById('global-search-input');
const searchResultsView = document.getElementById('search-results-view');
if(searchInput) {
    searchInput.addEventListener('input', async (e) => {
        const termo = e.target.value.toLowerCase().trim();
        if(termo.length < 2) return;
        window.esconderTelas(); searchResultsView?.classList.remove('hidden'); window.updateActiveNav(null, null);
        
        document.getElementById('search-comunidades-grid').innerHTML = '<p class="loading-text">Buscando...</p>';
        document.getElementById('search-projetos-grid').innerHTML = '<p class="loading-text">Buscando...</p>';
        document.getElementById('search-contas-list').innerHTML = '<p class="loading-text">Buscando...</p>';

        try {
            const snapCom = await getDocs(collection(db, "comunidades")); let hCom = '';
            snapCom.forEach(doc => {
                const d = doc.data();
                if(d.nome.toLowerCase().includes(termo) || d.descricao.toLowerCase().includes(termo)) {
                    hCom += `<div class="community-card"><div><h3>${d.nome}</h3><p>${d.descricao}</p></div><button onclick="window.listarProjetosDaComunidade('${doc.id}', '${d.nome}')">Acessar</button></div>`;
                }
            });
            document.getElementById('search-comunidades-grid').innerHTML = hCom || '<p class="loading-text">Nenhuma comunidade encontrada.</p>';

            const snapProj = await getDocs(collection(db, "projetos")); let hProj = '';
            snapProj.forEach(doc => {
                const d = doc.data();
                if(d.titulo.toLowerCase().includes(termo) || d.descricao.toLowerCase().includes(termo)) {
                    hProj += `<div class="community-card"><div><h3>${d.titulo}</h3><p>${d.descricao}</p></div><button onclick="window.abrirFeedProjeto('${doc.id}')">Acessar</button></div>`;
                }
            });
            document.getElementById('search-projetos-grid').innerHTML = hProj || '<p class="loading-text">Nenhum projeto encontrado.</p>';

            const snapUsers = await getDocs(collection(db, "users")); let hUsers = '';
            snapUsers.forEach(doc => {
                const d = doc.data();
                if(d.nome.toLowerCase().includes(termo) || d.email.toLowerCase().includes(termo)) {
                    hUsers += `<div class="user-card"><div class="user-info"><span class="user-email">${d.nome}</span><span style="font-size:0.8rem; color:#888;">${d.email}</span></div><span class="badge-role" style="background:#e2e8f0; color:#333; padding:4px 8px; border-radius:12px;">${d.role}</span></div>`;
                }
            });
            document.getElementById('search-contas-list').innerHTML = hUsers || '<p class="loading-text">Nenhuma conta encontrada.</p>';
        } catch(err) {}
    });
}

document.getElementById('form-login')?.addEventListener('submit', (e) => {
    e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = 'Aguarde...';
    signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-pass').value).catch(error => alert("Erro: " + error.message)).finally(() => btn.textContent = 'Entrar');
});
document.getElementById('form-register')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = 'Aguarde...'; const emailStr = document.getElementById('reg-email').value;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, emailStr, document.getElementById('reg-pass').value);
        let cargoInicial = 'usuario';
        const q = query(collection(db, "comunidades"), where("admins_emails", "array-contains", emailStr));
        if (!(await getDocs(q)).empty) cargoInicial = 'admin'; 
        await setDoc(doc(db, "users", userCredential.user.uid), { nome: emailStr.split('@')[0], email: emailStr, role: cargoInicial, acesso_comunidades: [], acesso_projetos: [] });
        alert("Conta criada!");
    } catch (error) { alert("Erro."); } finally { btn.textContent = 'Cadastrar'; }
});
document.getElementById('logout-btn')?.addEventListener('click', () => { signOut(auth); });

// GESTÃO
async function carregarListaGerenciamento() {
    const list = document.getElementById('management-list');
    list.innerHTML = '<p class="loading-text">Carregando conteúdos...</p>';
    try {
        let html = '<h4 style="margin-bottom:10px;">Minhas Comunidades</h4>';
        const qCom = (currentUserRole === 'programador') ? collection(db, "comunidades") : query(collection(db, "comunidades"), where("admins_emails", "array-contains", auth.currentUser.email));
        const snapCom = await getDocs(qCom);
        let coms = []; snapCom.forEach(d => coms.push({id: d.id, ...d.data()}));
        coms.sort((a,b) => a.nome.localeCompare(b.nome));

        coms.forEach(c => {
            html += `<div class="user-card"><div class="user-info"><span class="user-email">${c.nome}</span></div>
                     <div class="user-actions"><button class="btn-sm btn-edit" onclick="window.editarDocumentoTextual('comunidades', '${c.id}', 'nome')">Renomear</button>
                     <button class="btn-sm btn-delete" onclick="window.excluirDocumento('comunidades', '${c.id}')">Excluir</button></div></div>`;
        });

        html += '<h4 style="margin-top:20px; margin-bottom:10px;">Meus Projetos (Feeds)</h4>';
        const snapProj = await getDocs(collection(db, "projetos"));
        let projs = []; 
        snapProj.forEach(d => {
            const data = d.data();
            if(currentUserRole === 'programador' || coms.some(c => c.id === data.id_comunidade)) { projs.push({id: d.id, ...data}); }
        });
        projs.sort((a,b) => a.titulo.localeCompare(b.titulo));

        projs.forEach(p => {
            html += `<div class="user-card"><div class="user-info"><span class="user-email">${p.titulo}</span></div>
                     <div class="user-actions"><button class="btn-sm btn-edit" onclick="window.editarDocumentoTextual('projetos', '${p.id}', 'titulo')">Renomear</button>
                     <button class="btn-sm btn-delete" onclick="window.excluirDocumento('projetos', '${p.id}')">Excluir</button></div></div>`;
        });
        list.innerHTML = html;
    } catch(e) { list.innerHTML = 'Erro ao carregar.'; }
}

window.excluirDocumento = async (colecao, idDoc) => {
    if(confirm("Deseja excluir permanentemente? Isso não pode ser desfeito.")) {
        try { await deleteDoc(doc(db, colecao, idDoc)); alert("Excluído com sucesso!"); carregarListaGerenciamento(); atualizarSidebarComunidades(); } catch (e) { alert("Erro ao excluir."); }
    }
};

window.editarDocumentoTextual = async (colecao, idDoc, campo) => {
    const novo = prompt("Digite o novo valor:");
    if(novo) { try { await updateDoc(doc(db, colecao, idDoc), { [campo]: novo }); carregarListaGerenciamento(); atualizarSidebarComunidades(); } catch (e) {} }
};

async function carregarComunidadesSelects(userEmail, role) {
    const selects = [document.getElementById('projeto-id-comunidade-select'), document.getElementById('edit-com-select'), document.getElementById('batch-com-select')];
    try {
        let q = (role === 'programador') ? collection(db, "comunidades") : query(collection(db, "comunidades"), where("admins_emails", "array-contains", userEmail));
        const snapshot = await getDocs(q); let optionsHTML = '<option value="">Selecione...</option>';
        snapshot.forEach(doc => { optionsHTML += `<option value="${doc.id}">${doc.data().nome}</option>`; });
        selects.forEach(s => { if(s) s.innerHTML = optionsHTML; });
    } catch (error) { }
}

async function atualizarSidebarComunidades() {
    const list = document.getElementById('sidebar-communities-list'); if(!list) return; list.innerHTML = '';
    try {
        const snap = await getDocs(collection(db, "comunidades")); let html = '';
        snap.forEach(doc => {
            const data = doc.data();
            let isCriador = data.id_criador === auth.currentUser?.uid;
            let isAdmin = data.admins_emails && data.admins_emails.includes(auth.currentUser?.email);
            let isMembro = currentUserData?.acesso_comunidades?.includes(doc.id);
            if (isCriador || isAdmin || isMembro || currentUserRole === 'programador') {
                html += `<li><a href="#" class="dyn-sidebar-link" data-id="${doc.id}" data-nome="${data.nome}" title="${data.nome}"><span class="icon">💬</span> <span class="text">${data.nome}</span></a></li>`;
            }
        });
        if(html === '') document.getElementById('sidebar-dynamic-section')?.classList.add('hidden');
        else { 
            document.getElementById('sidebar-dynamic-section')?.classList.remove('hidden'); 
            list.innerHTML = html; 
            list.querySelectorAll('.dyn-sidebar-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault(); window.updateActiveNav(null, null);
                    window.listarProjetosDaComunidade(link.dataset.id, link.dataset.nome);
                    if(window.innerWidth <= 768) window.closeSidebarMobile();
                });
            });
        }
    } catch(e) {}
}

document.getElementById('form-comunidade')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = 'Salvando...'; btn.disabled = true;
    try {
        await addDoc(collection(db, "comunidades"), { nome: document.getElementById('comunidade-nome').value, descricao: document.getElementById('comunidade-desc').value, visibilidade: document.getElementById('comunidade-visibilidade').value, id_criador: auth.currentUser.uid, admins_emails: [auth.currentUser.email] });
        alert(`Comunidade criada!`); e.target.reset(); carregarComunidadesSelects(auth.currentUser.email, currentUserRole); carregarListaGerenciamento(); atualizarSidebarComunidades();
    } catch (error) {} finally { btn.textContent = 'Criar Comunidade'; btn.disabled = false; }
});

document.getElementById('edit-com-select')?.addEventListener('change', async (e) => {
    if(!e.target.value) { document.getElementById('form-edit-comunidade').reset(); return; }
    const docSnap = await getDoc(doc(db, "comunidades", e.target.value));
    if(docSnap.exists()){ const d = docSnap.data(); document.getElementById('edit-com-nome').value = d.nome; document.getElementById('edit-com-desc').value = d.descricao; document.getElementById('edit-com-visibilidade').value = d.visibilidade || 'publico'; document.getElementById('edit-com-admins').value = (d.admins_emails || []).join(', '); document.getElementById('edit-com-owner').value = ''; }
});

document.getElementById('form-edit-comunidade')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const comId = document.getElementById('edit-com-select').value;
    if(!comId) return alert("Selecione."); const btn = e.target.querySelector('button'); btn.textContent = 'Salvando...'; btn.disabled = true;
    try {
        let updateData = { nome: document.getElementById('edit-com-nome').value, descricao: document.getElementById('edit-com-desc').value, visibilidade: document.getElementById('edit-com-visibilidade').value, admins_emails: document.getElementById('edit-com-admins').value.split(',').map(em => em.trim()).filter(em => em) };
        const newOwnerEmail = document.getElementById('edit-com-owner').value.trim();
        if(newOwnerEmail) { const qUser = query(collection(db, "users"), where("email", "==", newOwnerEmail)); const userSnap = await getDocs(qUser); if(userSnap.empty) alert("O e-mail digitado não existe."); else { updateData.id_criador = userSnap.docs[0].id; alert("Propriedade transferida!"); } }
        await updateDoc(doc(db, "comunidades", comId), updateData); alert("Atualizada com sucesso!"); e.target.reset(); carregarComunidadesSelects(auth.currentUser.email, currentUserRole); carregarListaGerenciamento(); atualizarSidebarComunidades();
    } catch (err) {} finally { btn.textContent = 'Salvar Alterações'; btn.disabled = false; }
});

document.getElementById('form-projeto')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('button'); btn.textContent = 'Salvando...'; btn.disabled = true;
    try { await addDoc(collection(db, "projetos"), { titulo: document.getElementById('projeto-titulo').value, descricao: document.getElementById('projeto-desc').value, id_comunidade: document.getElementById('projeto-id-comunidade-select').value, visibilidade: document.getElementById('projeto-visibilidade').value, seguidores: 0, membros: 0, foto_url: "https://via.placeholder.com/150" }); alert("Projeto salvo!"); e.target.reset(); carregarListaGerenciamento(); } catch (error) {} finally { btn.textContent = 'Salvar Projeto'; btn.disabled = false; }
});

// FEEDS E RENDERIZAÇÃO
async function carregarFeedGlobal() {
    const globalPostsContainer = document.getElementById('global-posts-container');
    globalPostsContainer.innerHTML = '<p class="loading-text">Mapeando postagens...</p>';
    document.getElementById('btn-load-more-global')?.classList.add('hidden'); globalFeedIndex = 0;
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
            if(comunidadesPermitidas.includes(doc.data().id_comunidade)) { meusProjetosIds.push(doc.id); nomesProjetos[doc.id] = doc.data().titulo; }
        });

        if(meusProjetosIds.length === 0) { globalPostsContainer.innerHTML = '<p class="loading-text">Vá em Explorar para encontrar conteúdo!</p>'; return; }

        const qPosts = query(collection(db, "postagens"), orderBy("data_hora", "desc"), limit(200));
        const snapPosts = await getDocs(qPosts);
        globalFeedPosts = [];
        snapPosts.forEach(doc => {
            const p = doc.data(); if(meusProjetosIds.includes(p.id_projeto)) globalFeedPosts.push({id: doc.id, nome_projeto: nomesProjetos[p.id_projeto], ...p});
        });

        if(globalFeedPosts.length === 0) { globalPostsContainer.innerHTML = '<p class="loading-text">Nenhuma postagem recente.</p>'; return; }
        globalPostsContainer.innerHTML = ''; renderizarLoteFeedGlobal();
    } catch(error) {}
}

function renderizarLoteFeedGlobal() {
    const globalPostsContainer = document.getElementById('global-posts-container');
    const lote = globalFeedPosts.slice(globalFeedIndex, globalFeedIndex + PAGE_SIZE);
    lote.forEach(post => {
        const dataFormatada = new Date(post.data_hora).toLocaleString('pt-BR');
        const imgHtml = post.imagem_url ? `<img src="${post.imagem_url}" class="post-media">` : '';
        const card = document.createElement('div'); card.className = 'post-card';
        card.innerHTML = `<div class="post-header"><div class="post-meta"><b>${post.autor_email.split('@')[0]}</b> <span class="projeto-tag">${post.nome_projeto}</span><br>${dataFormatada}</div>
            <div class="post-actions"><button class="btn-sm btn-primary" onclick="window.abrirFeedProjeto('${post.id_projeto}', '${post.id}')"><span class="icon">💬</span> Ir para Mensagem</button></div></div>
            <div class="post-content">${processarTextoLinks(post.texto)}</div>${imgHtml}`;
        globalPostsContainer.appendChild(card);
    });
    globalFeedIndex += PAGE_SIZE;
    if (globalFeedIndex < globalFeedPosts.length) document.getElementById('btn-load-more-global')?.classList.remove('hidden');
    else document.getElementById('btn-load-more-global')?.classList.add('hidden');
}
document.getElementById('btn-load-more-global')?.addEventListener('click', renderizarLoteFeedGlobal);

window.listarProjetosDaComunidade = async (comId, comNome) => {
    window.esconderTelas(); document.getElementById('community-view')?.classList.remove('hidden'); window.updateActiveNav(null, null);
    currentCommunityId = comId;
    document.getElementById('com-view-title').textContent = comNome;
    document.getElementById('com-view-desc').textContent = "...";
    document.getElementById('com-view-projects-mini').innerHTML = '<p class="loading-text">Buscando...</p>';
    document.getElementById('community-posts-container').innerHTML = '<p class="loading-text">Buscando feed da comunidade...</p>';
    document.getElementById('btn-load-more-community')?.classList.add('hidden');
    comFeedIndex = 0;

    try {
        const docCom = await getDoc(doc(db, "comunidades", comId));
        if(docCom.exists()) document.getElementById('com-view-desc').textContent = docCom.data().descricao;

        const qProj = query(collection(db, "projetos"), where("id_comunidade", "==", comId));
        const snapProj = await getDocs(qProj);
        let projIds = []; let hProj = ''; let nProj = {};
        
        if (snapProj.empty) { 
            document.getElementById('com-view-projects-mini').innerHTML = '<span style="font-size:0.85rem; color:var(--text-light);">Nenhum projeto ainda.</span>';
            document.getElementById('community-posts-container').innerHTML = '<p class="loading-text">Sem postagens.</p>';
            return; 
        }

        snapProj.forEach(doc => {
            projIds.push(doc.id); nProj[doc.id] = doc.data().titulo;
            hProj += `<div class="mini-project-badge" onclick="window.abrirFeedProjeto('${doc.id}')">📁 ${doc.data().titulo}</div>`;
        });
        document.getElementById('com-view-projects-mini').innerHTML = hProj;

        const qPosts = query(collection(db, "postagens"), orderBy("data_hora", "desc"), limit(200));
        const snapPosts = await getDocs(qPosts);
        comFeedPosts = [];
        snapPosts.forEach(doc => { const p = doc.data(); if(projIds.includes(p.id_projeto)) comFeedPosts.push({id: doc.id, nome_projeto: nProj[p.id_projeto], ...p}); });

        if(comFeedPosts.length === 0) { document.getElementById('community-posts-container').innerHTML = '<p class="loading-text">Esta comunidade ainda não tem postagens.</p>'; return; }
        document.getElementById('community-posts-container').innerHTML = ''; renderizarLoteCommunity();
    } catch (error) {}
};

function renderizarLoteCommunity() {
    const lote = comFeedPosts.slice(comFeedIndex, comFeedIndex + PAGE_SIZE);
    lote.forEach(post => {
        const dataFormatada = new Date(post.data_hora).toLocaleString('pt-BR');
        const imgHtml = post.imagem_url ? `<img src="${post.imagem_url}" class="post-media">` : '';
        const card = document.createElement('div'); card.className = 'post-card';
        card.innerHTML = `<div class="post-header"><div class="post-meta"><b>${post.autor_email.split('@')[0]}</b> <span class="projeto-tag">${post.nome_projeto}</span><br>${dataFormatada}</div>
            <div class="post-actions"><button class="btn-sm btn-primary" onclick="window.abrirFeedProjeto('${post.id_projeto}', '${post.id}')"><span class="icon">💬</span> Ir para Mensagem</button></div></div>
            <div class="post-content">${processarTextoLinks(post.texto)}</div>${imgHtml}`;
        document.getElementById('community-posts-container').appendChild(card);
    });
    comFeedIndex += PAGE_SIZE;
    if (comFeedIndex < comFeedPosts.length) document.getElementById('btn-load-more-community')?.classList.remove('hidden');
    else document.getElementById('btn-load-more-community')?.classList.add('hidden');
}
document.getElementById('btn-load-more-community')?.addEventListener('click', renderizarLoteCommunity);

async function carregarVitrineComunidades() {
    const communitiesContainer = document.getElementById('communities-container');
    communitiesContainer.innerHTML = '<p class="loading-text">Buscando...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, "comunidades"));
        communitiesContainer.innerHTML = '';
        if (querySnapshot.empty) { communitiesContainer.innerHTML = '<p>Nenhuma comunidade encontrada.</p>'; return; }
        const arraysUsuario = { acesso: currentUserData?.acesso_comunidades || [] };

        querySnapshot.forEach((doc) => {
            const data = doc.data(); const id = doc.id;
            let isCriador = data.id_criador === auth.currentUser?.uid;
            let isAdmin = data.admins_emails && data.admins_emails.includes(auth.currentUser?.email);
            let isMembro = arraysUsuario.acesso.includes(id);

            if (!isCriador && !isAdmin && !isMembro && currentUserRole !== 'programador') {
                const vis = data.visibilidade || 'publico'; 
                const badge = vis === 'privado' ? '<span class="badge-private">Privada</span>' : '<span class="badge-public">Pública</span>';
                const btnAction = vis === 'publico' ? `<button onclick="window.ingressarComunidade('${id}')">Ingressar Agora</button>` : `<button class="btn-secondary" onclick="window.solicitarAcesso('${id}', '${data.nome}', '${data.id_criador}')">Solicitar Acesso</button>`;
                communitiesContainer.innerHTML += `<div class="community-card"><div><h3>${data.nome} ${badge}</h3><p>${data.descricao}</p></div>${btnAction}</div>`;
            }
        });
        if(communitiesContainer.innerHTML === '') communitiesContainer.innerHTML = '<p class="loading-text">Você já participa de todas as comunidades disponíveis!</p>';
    } catch (error) {}
}

window.ingressarComunidade = async (comId) => {
    try { await updateDoc(doc(db, "users", auth.currentUser.uid), { acesso_comunidades: arrayUnion(comId) }); alert("Você agora é membro!"); currentUserData.acesso_comunidades.push(comId); carregarVitrineComunidades(); resolverBadgesUsuario(); atualizarSidebarComunidades(); } catch (error) {}
};
window.solicitarAcesso = async (comId, comNome, idCriador) => {
    try {
        const q = query(collection(db, "solicitacoes"), where("uid_usuario", "==", auth.currentUser.uid), where("id_comunidade", "==", comId));
        if(!(await getDocs(q)).empty) { alert("Você já solicitou acesso."); return; }
        await addDoc(collection(db, "solicitacoes"), { id_comunidade: comId, nome_comunidade: comNome, id_criador: idCriador, uid_usuario: auth.currentUser.uid, email_usuario: auth.currentUser.email, nome_usuario: currentUserData.nome, status: 'pendente', data_hora: new Date().toISOString() });
        alert("Solicitação enviada!"); carregarVitrineComunidades(); 
    } catch (error) {}
};

async function carregarMeusProjetos() {
    const myProjectsContainer = document.getElementById('my-projects-container');
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
                html += `<div class="community-card"><div><h3>${p.data.titulo} ${badge}</h3><p>${p.data.descricao || ''}</p></div><button onclick="window.abrirFeedProjeto('${p.id}')">Acessar Feed</button></div>`; 
            });
            html += `</div></div>`; return html;
        };

        if (projetosProdutor.length === 0 && projetosAdmin.length === 0 && projetosMembro.length === 0) { myProjectsContainer.innerHTML = '<p class="loading-text">Você ainda não possui acessos. Vá em Explorar!</p>'; return; }
        myProjectsContainer.innerHTML += renderGrid("Sou Produtor", projetosProdutor);
        myProjectsContainer.innerHTML += renderGrid("Sou Administrador", projetosAdmin);
        myProjectsContainer.innerHTML += renderGrid("Sou Membro", projetosMembro);

    } catch(error) {}
}

window.abrirFeedProjeto = async (projId, targetPostId = null) => {
    window.esconderTelas(); document.getElementById('project-view')?.classList.remove('hidden'); 
    currentProjetoId = projId; currentTargetPostId = targetPostId;
    document.getElementById('posts-feed').innerHTML = '<p class="loading-text">Carregando postagens...</p>';
    document.getElementById('btn-load-more-project')?.classList.add('hidden');
    projFeedIndex = 0; window.updateActiveNav(null, null); 

    try {
        const projDoc = await getDoc(doc(db, "projetos", projId));
        if (projDoc.exists()) {
            const data = projDoc.data();
            const isProgramador = currentUserRole === 'programador';
            const isProdutor = currentUserRole === 'produtor'; 
            const isAdmin = currentUserRole === 'admin';
            
            if(data.visibilidade === 'privado' && !isProgramador && !isProdutor && !isAdmin && !currentUserData?.acesso_comunidades?.includes(data.id_comunidade)) {
                alert("Acesso restrito. Este projeto é privado e você não possui acesso a esta comunidade.");
                window.goHome(); return;
            }

            document.getElementById('feed-title').textContent = data.titulo;
            currentCommunityId = data.id_comunidade;

            if (currentUserRole !== 'usuario') { document.getElementById('post-creator')?.classList.remove('hidden'); } 
            else { document.getElementById('post-creator')?.classList.add('hidden'); }

            const qPosts = query(collection(db, "postagens"), where("id_projeto", "==", currentProjetoId));
            const snapshot = await getDocs(qPosts); projFeedPosts = []; snapshot.forEach(doc => projFeedPosts.push({id: doc.id, ...doc.data()}));
            projFeedPosts.sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora)); 

            const pFeed = document.getElementById('posts-feed'); pFeed.innerHTML = '';
            if(projFeedPosts.length === 0) { pFeed.innerHTML = '<p class="loading-text">Nenhuma postagem ainda.</p>'; return; }
            renderLoteProjeto();
        }
    } catch (error) {}
};

function renderLoteProjeto() {
    const lote = projFeedPosts.slice(projFeedIndex, projFeedIndex + PAGE_SIZE);
    const pFeed = document.getElementById('posts-feed');
    
    lote.forEach(post => {
        const dataFormatada = new Date(post.data_hora).toLocaleString('pt-BR');
        const imgHtml = post.imagem_url ? `<img src="${post.imagem_url}" class="post-media">` : '';
        const podeExcluir = (currentUserRole !== 'usuario' || post.autor_email === auth.currentUser?.email);
        const btnExcluir = podeExcluir ? `<button class="btn-sm btn-delete" onclick="window.excluirDocumento('postagens', '${post.id}')">Excluir</button>` : '';

        pFeed.innerHTML += `
            <div class="post-card" id="post-${post.id}">
                <div class="post-header">
                    <div class="post-meta"><b>${post.autor_email.split('@')[0]}</b> • ${dataFormatada}</div>
                    <div class="post-actions">${btnExcluir}</div>
                </div>
                <div class="post-content">${processarTextoLinks(post.texto)}</div>
                ${imgHtml}
                <div class="comments-section">
                    <div class="comment-list" id="comments-${post.id}">Carregando...</div>
                    <form class="comment-form" onsubmit="window.enviarComentario(event, '${post.id}')">
                        <input type="text" id="input-comment-${post.id}" placeholder="Escreva um comentário..." required>
                        <button type="submit">Enviar</button>
                    </form>
                </div>
            </div>`;
        carregarComentarios(post.id);
    });
    
    projFeedIndex += PAGE_SIZE;
    if (projFeedIndex < projFeedPosts.length) document.getElementById('btn-load-more-project')?.classList.remove('hidden');
    else document.getElementById('btn-load-more-project')?.classList.add('hidden');

    if(currentTargetPostId) {
        setTimeout(() => {
            const targetEl = document.getElementById(`post-${currentTargetPostId}`);
            if(targetEl) { targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); targetEl.classList.add('highlight-focus'); }
            currentTargetPostId = null;
        }, 300);
    }
}
document.getElementById('btn-load-more-project')?.addEventListener('click', renderLoteProjeto);

document.getElementById('form-post')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const texto = document.getElementById('post-text').value; const imageUrl = document.getElementById('post-image-url').value;
    const btn = e.target.querySelector('button'); btn.textContent = 'Postando...'; btn.disabled = true;
    try {
        await addDoc(collection(db, "postagens"), { id_projeto: currentProjetoId, id_comunidade: currentCommunityId || '', autor_email: auth.currentUser.email, texto: texto, imagem_url: imageUrl, data_hora: new Date().toISOString() });
        e.target.reset(); window.abrirFeedProjeto(currentProjetoId);
    } catch (error) {} finally { btn.textContent = 'Publicar'; btn.disabled = false; }
});

window.enviarComentario = async (e, postId) => {
    e.preventDefault(); const input = document.getElementById(`input-comment-${postId}`);
    const texto = input.value; input.disabled = true;
    try { await addDoc(collection(db, "comentarios"), { id_post: postId, autor_email: auth.currentUser.email, texto: texto, data_hora: new Date().toISOString() }); input.value = ''; carregarComentarios(postId); } 
    catch (error) {} finally { input.disabled = false; }
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
            const podeExcluir = (currentUserRole !== 'usuario' || c.autor_email === auth.currentUser?.email);
            const btnX = podeExcluir ? `<button onclick="window.excluirDocumento('comentarios', '${c.id}', '${postId}')" style="background:none; border:none; color:var(--danger-color); cursor:pointer;">✖</button>` : '';
            list.innerHTML += `<div class="comment-item"><div><span class="comment-author">${c.autor_email.split('@')[0]}</span> ${c.texto}</div>${btnX}</div>`;
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

document.getElementById('batch-com-select')?.addEventListener('change', async (e) => {
    const comId = e.target.value; const uList = document.getElementById('batch-users-list'); 
    if(!comId) { uList.innerHTML = 'Selecione...'; return; }
    uList.innerHTML = 'Buscando...'; 
    try {
        const qUsers = query(collection(db, "users"), where("acesso_comunidades", "array-contains", comId)); const snapUsers = await getDocs(qUsers); let uHtml = '';
        snapUsers.forEach(u => uHtml += `<label class="checkbox-item"><input type="checkbox" value="${u.data().email}"> ${u.data().nome || u.data().email}</label>`); uList.innerHTML = uHtml || '<p>Nenhum membro.</p>';
    } catch(err) { uList.innerHTML = 'Erro.'; }
});

document.getElementById('form-batch-manage')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const comId = document.getElementById('batch-com-select').value; if(!comId) return alert("Selecione.");
    const usersChecked = Array.from(document.querySelectorAll('#batch-users-list input:checked')).map(cb => cb.value);
    if(usersChecked.length === 0) return alert("Selecione pelo menos um membro.");
    const btn = e.target.querySelector('button'); btn.textContent = 'Aplicando...'; btn.disabled = true;
    try {
        const comRef = doc(db, "comunidades", comId); await updateDoc(comRef, { admins_emails: arrayUnion(...usersChecked) });
        alert(`Sucesso! Administradores adicionados.`); e.target.reset(); document.getElementById('batch-users-list').innerHTML = ''; 
    } catch (err) {} finally { btn.textContent = 'Conceder Acesso Administrativo'; btn.disabled = false; }
});

async function carregarSolicitacoes() {
    const list = document.getElementById('requests-list'); list.innerHTML = '<p class="loading-text">Buscando...</p>'; if(currentUserRole === 'usuario') return;
    try {
        const qCom = (currentUserRole === 'programador') ? collection(db, "comunidades") : query(collection(db, "comunidades"), where("admins_emails", "array-contains", auth.currentUser.email));
        const snapCom = await getDocs(qCom); let myComIds = []; snapCom.forEach(doc => myComIds.push(doc.id)); if(myComIds.length === 0) { list.innerHTML = '<p>Você não administra comunidades.</p>'; return; }
        const qSol = query(collection(db, "solicitacoes"), where("status", "==", "pendente")); const snapSol = await getDocs(qSol); let html = '';
        snapSol.forEach(doc => { const req = doc.data(); if(myComIds.includes(req.id_comunidade)) { html += `<div class="user-card" id="req-${doc.id}"><div class="user-info"><span class="user-email">${req.nome_usuario} deseja entrar em:</span><span class="projeto-tag" style="margin-left:0;">${req.nome_comunidade}</span></div><div class="user-actions"><button class="btn-sm btn-success" onclick="window.aprovarSolicitacao('${doc.id}', '${req.uid_usuario}', '${req.id_comunidade}')">Aprovar</button><button class="btn-sm btn-delete" onclick="window.excluirDocumento('solicitacoes', '${doc.id}')">Rejeitar</button></div></div>`; } });
        list.innerHTML = html || '<p>Nenhuma solicitação pendente.</p>';
    } catch(e) {}
}

window.aprovarSolicitacao = async (reqId, uidUsuario, comId) => { try { await updateDoc(doc(db, "users", uidUsuario), { acesso_comunidades: arrayUnion(comId) }); await deleteDoc(doc(db, "solicitacoes", reqId)); alert("Usuário aprovado!"); carregarSolicitacoes(); } catch(e) {} }

async function carregarListaDeUsuarios() {
    try { const querySnapshot = await getDocs(collection(db, "users")); allUsersData = []; querySnapshot.forEach((doc) => { allUsersData.push({ id: doc.id, ...doc.data() }); }); renderizarUsuarios(allUsersData); } catch (error) {}
}
function renderizarUsuarios(users) {
    const container = document.getElementById('users-list-container'); container.innerHTML = '';
    users.forEach(user => { const roleStr = user.role || 'usuario'; container.innerHTML += `<div class="user-card"><div class="user-info"><span class="user-email">${user.nome || user.email}</span><span class="tag tag-${roleStr}">${roleStr.toUpperCase()}</span></div><div class="user-actions"><select class="role-select-inline" id="select-${user.id}"><option value="usuario" ${roleStr === 'usuario' ? 'selected' : ''}>Usuário</option><option value="admin" ${roleStr === 'admin' ? 'selected' : ''}>Admin</option><option value="produtor" ${roleStr === 'produtor' ? 'selected' : ''}>Produtor</option><option value="programador" ${roleStr === 'programador' ? 'selected' : ''}>Programador</option></select><button class="btn-update-role btn-sm" style="background-color: var(--primary-color);" onclick="window.atualizarNivel('${user.id}')">Salvar</button></div></div>`; });
}
document.getElementById('search-user')?.addEventListener('input', (e) => { const termo = e.target.value.toLowerCase(); renderizarUsuarios(allUsersData.filter(u => (u.email && u.email.toLowerCase().includes(termo)) || (u.nome && u.nome.toLowerCase().includes(termo)))); });
window.atualizarNivel = async (uid) => { const selectEl = document.getElementById(`select-${uid}`); const btn = selectEl.nextElementSibling; try { btn.textContent = '...'; btn.disabled = true; await updateDoc(doc(db, "users", uid), { role: selectEl.value }); alert("Acesso atualizado!"); carregarListaDeUsuarios(); } catch (error) {} finally { btn.textContent = 'Salvar'; btn.disabled = false; } };
