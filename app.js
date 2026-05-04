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

// Globais
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
        // Esconde apenas as abas do mesmo contexto (pesquisa ou admin)
        const contentClass = targetId.startsWith('search') ? '#search-results-view .tab-content' : '#admin-panel .tab-content';
        document.querySelectorAll(contentClass).forEach(c => c.classList.add('hidden'));
        document.getElementById(targetId)?.classList.remove('hidden');
    });
});

// NAVEGAÇÃO GLOBAL
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
            document.getElementById('tools-produtor-conteudo')?.classList.toggle('hidden', !['programador','produtor'].includes(currentUserRole));
            document.getElementById('tools-produtor-membros')?.classList.toggle('hidden', !['programador','produtor'].includes(currentUserRole));
            
            resolverBadgesUsuario(); carregarComunidadesSelects(email, currentUserRole); atualizarSidebarComunidades();
        }
    } catch (e) {}
}

async function carregarListaGerenciamento() {
    const list = document.getElementById('management-list');
    list.innerHTML = '<p class="loading-text">Carregando conteúdos...</p>';
    try {
        // LISTAR COMUNIDADES
        let html = '<h4>Minhas Comunidades</h4>';
        const qCom = (currentUserRole === 'programador') ? collection(db, "comunidades") : query(collection(db, "comunidades"), where("admins_emails", "array-contains", auth.currentUser.email));
        const snapCom = await getDocs(qCom);
        let coms = []; snapCom.forEach(d => coms.push({id: d.id, ...d.data()}));
        coms.sort((a,b) => a.nome.localeCompare(b.nome));

        coms.forEach(c => {
            html += `<div class="user-card"><div class="user-info"><span class="user-email">${c.nome}</span></div>
                     <div class="user-actions"><button class="btn-sm btn-edit" onclick="window.editarDocumentoTextual('comunidades', '${c.id}', 'nome')">Renomear</button>
                     <button class="btn-sm btn-delete" onclick="window.excluirDocumento('comunidades', '${c.id}')">Excluir</button></div></div>`;
        });

        // LISTAR PROJETOS
        html += '<h4 style="margin-top:20px;">Meus Projetos (Feeds)</h4>';
        const snapProj = await getDocs(collection(db, "projetos"));
        let projs = []; 
        snapProj.forEach(d => {
            const data = d.data();
            // Programador vê tudo, outros veem apenas o que gerenciam
            if(currentUserRole === 'programador' || coms.some(c => c.id === data.id_comunidade)) {
                projs.push({id: d.id, ...data});
            }
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

// RESTANTE DAS FUNÇÕES (FEED, SEARCH, ETC) SEGUEM A MESMA LÓGICA BLINDADA DO ÚLTIMO TURNO
// ... (Adicione aqui as funções carregarFeedGlobal, carregarVitrineComunidades e carregarMeusProjetos enviadas anteriormente) ...

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

// Inicia as demais funções necessárias para rodar o sistema...
// (Garanta que todas as funções window. estão mapeadas no app.js para evitar links quebrados)
