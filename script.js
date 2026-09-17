import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    getDocs,
    collection,
    query,
    orderBy,
    limit,
    updateDoc,
    deleteDoc,
    where,
    onSnapshot,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";


const firebaseConfig = {
    apiKey: "AIzaSyBesrTVJe5iOqc21bOOco6Cx91gmnt1qf4",
    authDomain: "manhwatoons-f384c.firebaseapp.com",
    projectId: "manhwatoons-f384c",
    storageBucket: "manhwatoons-f384c.firebasestorage.app",
    messagingSenderId: "518512384379",
    appId: "1:518512384379:web:33ebcf1a5e37b4d41e45de"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let messaging = null;
// Cole a chave Web Push (VAPID) do Firebase Console → Project Settings → Cloud Messaging
const FIREBASE_VAPID_KEY = ''; // ex: 'BNxxxx...'

const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

let usuarioAtualData = null;


/* =========================================================
   BANCO DE DADOS DE OBRAS PARA PESQUISA
   ========================================================= */

// Lista dinâmica — só obras do Firestore (sem exemplos)
let listaObrasCompleta = [];

function sincronizarListaPesquisa() {
    listaObrasCompleta = obterTodasObras().map(o => ({
        titulo: o.titulo,
        views: o.views || '0'
    }));
}



/* =========================================================
   MENU LATERAL
   ========================================================= */

window.toggleMenu = function() {

    const menu = document.getElementById('menu-lateral');
    const overlay = document.getElementById('overlay');

    if (
        menu.style.left === '-280px' ||
        menu.style.left === ''
    ) {

        menu.style.left = '0';

        overlay.style.opacity = '1';
        overlay.style.visibility = 'visible';

    } else {

        menu.style.left = '-280px';

        overlay.style.opacity = '0';

        setTimeout(() => {
            overlay.style.visibility = 'hidden';
        }, 300);
    }
};



/* Navegação com direção de animação */
function trocarView(idTela, direcao) {
    // direcao: 'forward' | 'back' | 'fade'
    const views = document.querySelectorAll('.view');
    views.forEach(v => {
        v.classList.remove('ativo', 'nav-forward', 'nav-back', 'nav-fade');
    });
    const el = document.getElementById('view-' + idTela);
    if (!el) return;
    const cls = direcao === 'back' ? 'nav-back' : (direcao === 'forward' ? 'nav-forward' : 'nav-fade');
    // reflow para reiniciar animação
    void el.offsetWidth;
    el.classList.add(cls, 'ativo');
}

window.mudarTela = function(idTela) {

    // Painel ADM é restrito
    if (idTela === 'adm' && !isAdminUser()) {
        alert('Acesso restrito ao Painel ADM.');
        return;
    }

    const atual = document.querySelector('.view.ativo');
    const saindoDeChat = atual && atual.id === 'view-chat';
    const saindoDeObra = atual && atual.id === 'view-obra';
    const saindoDeLeitor = atual && atual.id === 'view-leitor';
    let dir = 'fade';
    if (idTela === 'chat' || idTela === 'obra' || idTela === 'leitor' || idTela === 'adm') dir = 'forward';
    if (idTela === 'inicio' && (saindoDeChat || saindoDeObra || saindoDeLeitor)) dir = 'back';
    if (idTela === 'biblioteca' || idTela === 'favoritos' || idTela === 'config' || idTela === 'suporte') dir = 'fade';
    trocarView(idTela, dir);

    // Chat em tela cheia: trava scroll do body
    document.body.classList.toggle('chat-aberto', idTela === 'chat');
    if (idTela !== 'chat') {
        document.documentElement.style.setProperty('--kb-offset', '0px');
        pararAjusteTecladoChat();
    }

    // Fecha menu se estiver aberto
    const menu = document.getElementById('menu-lateral');
    if (menu && menu.style.left === '0px') {
        toggleMenu();
    } else if (menu && (menu.style.left === '' || menu.style.left === '-280px')) {
        // já fechado — só garante overlay
        const overlay = document.getElementById('overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.visibility = 'hidden';
        }
    } else {
        toggleMenu();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (idTela === 'biblioteca') {
        generoFiltroAtivo = 'Todos';
        renderizarFiltrosGenero();
        renderizarBiblioteca();
        const input = document.getElementById('inputPesquisaBiblioteca');
        if (input) input.value = '';
    }
    if (idTela === 'favoritos') {
        renderizarFavoritos();
    }
    if (idTela === 'inicio') {
        renderizarContinuarLendo();
    }
    if (idTela === 'adm') {
        admTab('obras');
    }
    if (idTela === 'chat') {
        iniciarChatComunidade();
        iniciarAjusteTecladoChat();
        // already forward via trocarView
        setTimeout(() => {
            const box = document.getElementById('chatMensagens');
            if (box) box.scrollTop = box.scrollHeight;
        }, 300);
    }
};


/* =========================================================
   PESQUISA EM TEMPO REAL
   ========================================================= */

window.executarPesquisa = function(termo) {

    const containerResultados =
        document.getElementById('resultadosPesquisa');

    const termoLimpo =
        termo.trim().toLowerCase();

    if (!termoLimpo) {

        containerResultados.style.display = 'none';

        containerResultados.innerHTML = '';

        return;
    }

    const resultados =
        listaObrasCompleta.filter(
            obra =>
                obra.titulo
                    .toLowerCase()
                    .includes(termoLimpo)
        );


    if (resultados.length === 0) {

        containerResultados.style.display = 'block';

        containerResultados.innerHTML = `
            <div
                class="search-result-item"
                style="color: var(--cinza-texto);"
            >
                Nenhuma obra encontrada
            </div>
        `;

        return;
    }


    let htmlResultados = '';

    resultados.forEach(obra => {

        htmlResultados += `
            <div
                class="search-result-item"
                onclick="selecionarObraPesquisa('${obra.titulo}')"
            >
                <span>📖 ${obra.titulo}</span>

                <span
                    style="
                        font-size: 9px;
                        color: var(--verde-neon);
                    "
                >
                    👁️ ${obra.views}
                </span>
            </div>
        `;
    });


    containerResultados.innerHTML = htmlResultados;

    containerResultados.style.display = 'block';
};


window.selecionarObraPesquisa = function(nomeObra) {

    document.getElementById('inputPesquisa').value =
        nomeObra;

    document.getElementById('resultadosPesquisa')
        .style.display = 'none';

    abrirObra(nomeObra);
};


document.addEventListener('click', function(e) {

    if (!e.target.closest('.search-container')) {

        const res =
            document.getElementById('resultadosPesquisa');

        if (res) {
            res.style.display = 'none';
        }
    }
});


/* =========================================================
   MODAL E AUTH FIREBASE
   ========================================================= */

window.abrirModalPerfil = function() {

    document
        .getElementById('modalPerfil')
        .classList.add('ativo');

    renderizarConteudoModal();
};


window.fecharModalPerfil = function() {

    document
        .getElementById('modalPerfil')
        .classList.remove('ativo');
};


window.fecharModalFora = function(event) {

    if (event.target.id === 'modalPerfil') {
        fecharModalPerfil();
    }
};


window.renderizarConteudoModal = function(tipo = 'login') {

    const container =
        document.getElementById('modalConteudoInterno');


    if (usuarioAtualData) {

        container.innerHTML = `

            <div class="user-profile-box">

                <div
                    class="user-big-avatar"
                    id="modalUserAvatarDisplay"
                >
                    ${
                        usuarioAtualData.avatar
                            ? `<img src="${usuarioAtualData.avatar}">`
                            : '👤'
                    }
                </div>


                <div
                    style="
                        width: 100%;
                        margin-top: 5px;
                    "
                >

                    <label
                        style="
                            font-size: 9px;
                            color: var(--cinza-texto);
                            display: block;
                            text-align: left;
                            margin-bottom: 2px;
                        "
                    >
                        Editar Nick (Único):
                    </label>


                    <div
                        style="
                            display: flex;
                            gap: 5px;
                        "
                    >

                        <input
                            type="text"
                            id="inputNovoNick"
                            class="form-input"
                            value="${usuarioAtualData.nick}"
                        >

                        <button
                            class="btn-submit"
                            style="
                                width: 70px;
                                margin-top: 0;
                                font-size: 10px;
                            "
                            onclick="alterarNickFirebase()"
                        >
                            Salvar
                        </button>

                    </div>


                    <div
                        id="nickMsgErro"
                        class="erro-msg"
                    ></div>

                    <div
                        id="nickMsgSucesso"
                        class="sucesso-msg"
                    ></div>

                </div>


                <div
                    class="user-email-display"
                    style="
                        font-size: 10px;
                        color: var(--cinza-texto);
                        margin-top: 4px;
                    "
                >
                    ${usuarioAtualData.email}
                </div>


                <div
                    style="
                        font-size: 9px;
                        color: var(--verde-neon);
                    "
                >
                    Obras Lidas:
                    ${usuarioAtualData.obrasLidas || 1}
                </div>


                <label class="file-input-label">

                    📁 Alterar Foto de Perfil

                    <input
                        type="file"
                        accept="image/*"
                        class="file-input-hidden"
                        onchange="atualizarFotoPerfilFirebase(event)"
                    >

                </label>


                <button
                    class="btn-submit"
                    style="
                        background-color: #ff4444;
                        color: white;
                        margin-top: 10px;
                    "
                    onclick="fazerLogoutFirebase()"
                >
                    Sair da Conta (Logout)
                </button>

            </div>
        `;

        return;
    }


    if (tipo === 'login') {

        container.innerHTML = `

            <h3 class="modal-titulo">
                ENTRAR NA CONTA
            </h3>


            <div class="form-group">

                <label>E-mail</label>

                <input
                    type="email"
                    id="loginEmail"
                    class="form-input"
                    placeholder="seu@email.com"
                >

            </div>


            <div class="form-group">

                <label>Senha</label>

                <input
                    type="password"
                    id="loginSenha"
                    class="form-input"
                    placeholder="Sua senha"
                >

                <button
                    type="button"
                    class="btn-toggle-pass"
                    onclick="toggleSenha('loginSenha', this)"
                >
                    Mostrar
                </button>

            </div>


            <div
                id="loginErro"
                class="erro-msg"
            ></div>


            <button
                class="btn-submit"
                onclick="processarLoginFirebase()"
            >
                Entrar
            </button>


            <button
                class="btn-google"
                onclick="fazerLoginGoogleFirebase()"
            >

                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                >
                    <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />

                    <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.93H1.14v3.15C3.15 21.35 7.23 24 12 24z"
                    />

                    <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.14C.41 8.03 0 9.68 0 12s.41 3.97 1.14 5.42l4.14-3.15z"
                    />

                    <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.15 2.65 1.14 6.58l4.14 3.15c.95-2.82 3.6-4.98 6.72-4.98z"
                    />
                </svg>

                Entrar com Google

            </button>


            <div class="modal-link-troca">
                Não tem conta?

                <span
                    onclick="renderizarConteudoModal('cadastro')"
                >
                    Cadastre-se
                </span>
            </div>
        `;

    } else {

        container.innerHTML = `

            <h3 class="modal-titulo">
                CADASTRAR CONTA
            </h3>


            <div class="form-group">

                <label>Nick Único</label>

                <input
                    type="text"
                    id="cadNick"
                    class="form-input"
                    placeholder="Ex: ShadowHunter"
                >

            </div>


            <div class="form-group">

                <label>E-mail</label>

                <input
                    type="email"
                    id="cadEmail"
                    class="form-input"
                    placeholder="seu@email.com"
                >

            </div>


            <div class="form-group">

                <label>
                    Senha (Mín. 1 maiúscula, 1 minúscula e 1 número)
                </label>

                <input
                    type="password"
                    id="cadSenha"
                    class="form-input"
                    placeholder="Sua senha"
                >

                <button
                    type="button"
                    class="btn-toggle-pass"
                    onclick="toggleSenha('cadSenha', this)"
                >
                    Mostrar
                </button>

            </div>


            <div
                id="cadErro"
                class="erro-msg"
            ></div>


            <button
                class="btn-submit"
                onclick="processarCadastroFirebase()"
            >
                Cadastrar
            </button>


            <button
                class="btn-google"
                onclick="fazerLoginGoogleFirebase()"
            >

                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                >
                    <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />

                    <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.93H1.14v3.15C3.15 21.35 7.23 24 12 24z"
                    />

                    <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.14C.41 8.03 0 9.68 0 12s.41 3.97 1.14 5.42l4.14-3.15z"
                    />

                    <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.15 2.65 1.14 6.58l4.14 3.15c.95-2.82 3.6-4.98 6.72-4.98z"
                    />
                </svg>

                Cadastrar com Google

            </button>


            <div class="modal-link-troca">
                Já tem conta?

                <span
                    onclick="renderizarConteudoModal('login')"
                >
                    Faça login
                </span>
            </div>
        `;
    }
};


window.toggleSenha = function(idInput, btn) {

    const input =
        document.getElementById(idInput);

    if (input.type === 'password') {

        input.type = 'text';

        btn.textContent = 'Ocultar';

    } else {

        input.type = 'password';

        btn.textContent = 'Mostrar';
    }
};


async function verificarNickDisponivel(nickDesejado) {

    const q = query(
        collection(db, "users"),
        where("nick", "==", nickDesejado)
    );

    const querySnapshot =
        await getDocs(q);

    return querySnapshot.empty;
}


window.processarCadastroFirebase = async function() {

    const nick =
        document.getElementById('cadNick').value.trim();

    const email =
        document.getElementById('cadEmail').value.trim();

    const senha =
        document.getElementById('cadSenha').value;

    const erroDiv =
        document.getElementById('cadErro');

    erroDiv.style.display = 'none';


    if (!nick || !email || !senha) {

        erroDiv.textContent =
            'Preencha todos os campos.';

        erroDiv.style.display = 'block';

        return;
    }


    const temMaiuscula =
        /[A-Z]/.test(senha);

    const temMinuscula =
        /[a-z]/.test(senha);

    const temNumero =
        /[0-9]/.test(senha);


    if (
        !temMaiuscula ||
        !temMinuscula ||
        !temNumero
    ) {

        erroDiv.textContent =
            'A senha precisa conter letra maiúscula, minúscula e número.';

        erroDiv.style.display = 'block';

        return;
    }


    try {

        const disponivel =
            await verificarNickDisponivel(nick);


        if (!disponivel) {

            erroDiv.textContent =
                'Este nick já está em uso. Escolha outro.';

            erroDiv.style.display = 'block';

            return;
        }


        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                senha
            );


        const user =
            userCredential.user;


        const userData = {

            uid: user.uid,

            nick: nick,

            email: email,

            obrasLidas: 0,

            avatar: null
        };


        await setDoc(
            doc(db, "users", user.uid),
            userData
        );


        usuarioAtualData =
            userData;


        atualizarAvatarCabecalho();

        renderizarConteudoModal();

        carregarRankingLeitoresFirestore();

    } catch (error) {

        erroDiv.textContent =
            error.message;

        erroDiv.style.display = 'block';
    }
};


window.processarLoginFirebase = async function() {

    const email =
        document.getElementById('loginEmail').value.trim();

    const senha =
        document.getElementById('loginSenha').value;

    const erroDiv =
        document.getElementById('loginErro');

    erroDiv.style.display = 'none';


    if (!email || !senha) {

        erroDiv.textContent =
            'Preencha e-mail e senha.';

        erroDiv.style.display = 'block';

        return;
    }


    try {

        const userCredential =
            await signInWithEmailAndPassword(
                auth,
                email,
                senha
            );


        const user =
            userCredential.user;


        const docSnap =
            await getDoc(
                doc(db, "users", user.uid)
            );


        if (docSnap.exists()) {

            usuarioAtualData =
                docSnap.data();

        } else {

            usuarioAtualData = {

                uid: user.uid,

                nick: user.email.split('@')[0],

                email: user.email,

                obrasLidas: 0,

                avatar: null
            };
        }


        atualizarAvatarCabecalho();

        renderizarConteudoModal();

        carregarRankingLeitoresFirestore();

    } catch (error) {

        erroDiv.textContent =
            "Credenciais inválidas ou erro ao entrar.";

        erroDiv.style.display = 'block';
    }
};


window.fazerLoginGoogleFirebase = async function() {

    try {

        const result =
            await signInWithPopup(
                auth,
                googleProvider
            );


        const user =
            result.user;


        const docRef =
            doc(db, "users", user.uid);


        const docSnap =
            await getDoc(docRef);


        if (docSnap.exists()) {

            usuarioAtualData =
                docSnap.data();

        } else {

            let baseNick =
                user.displayName
                    ? user.displayName.split(' ')[0]
                    : user.email.split('@')[0];


            let nickFinal =
                baseNick;

            let contador = 1;


            while (
                !(await verificarNickDisponivel(nickFinal))
            ) {

                nickFinal =
                    `${baseNick}${contador}`;

                contador++;
            }


            usuarioAtualData = {

                uid: user.uid,

                nick: nickFinal,

                email: user.email,

                obrasLidas: 0,

                avatar: user.photoURL || null
            };


            await setDoc(
                docRef,
                usuarioAtualData
            );
        }


        atualizarAvatarCabecalho();

        renderizarConteudoModal();

        carregarRankingLeitoresFirestore();

    } catch (error) {

        console.error('Google login:', error);
        let msg = error.message || String(error);
        if (error.code === 'auth/unauthorized-domain') {
            msg = 'Domínio não autorizado. No Firebase Console → Authentication → Settings → Authorized domains, adicione: carlosandre1514-prog.github.io';
        } else if (error.code === 'auth/popup-blocked') {
            msg = 'Popup bloqueado. Permita popups neste site e tente de novo.';
        } else if (error.code === 'auth/popup-closed-by-user') {
            msg = 'Login cancelado.';
        }
        alert('Erro ao logar com Google: ' + msg);
    }
};


window.alterarNickFirebase = async function() {

    const novoNick =
        document.getElementById('inputNovoNick')
            .value
            .trim();


    const errDiv =
        document.getElementById('nickMsgErro');


    const sucDiv =
        document.getElementById('nickMsgSucesso');


    errDiv.style.display = 'none';

    sucDiv.style.display = 'none';


    if (
        !novoNick ||
        novoNick === usuarioAtualData.nick
    ) {

        errDiv.textContent =
            'Digite um nick diferente e válido.';

        errDiv.style.display = 'block';

        return;
    }


    try {

        const disponivel =
            await verificarNickDisponivel(
                novoNick
            );


        if (!disponivel) {

            errDiv.textContent =
                'Este nick já está em uso por outro leitor.';

            errDiv.style.display = 'block';

            return;
        }


        await updateDoc(
            doc(
                db,
                "users",
                usuarioAtualData.uid
            ),
            {
                nick: novoNick
            }
        );


        usuarioAtualData.nick =
            novoNick;


        sucDiv.textContent =
            'Nick atualizado com sucesso!';

        sucDiv.style.display =
            'block';


        carregarRankingLeitoresFirestore();

    } catch (e) {

        errDiv.textContent =
            'Erro ao atualizar nick.';

        errDiv.style.display =
            'block';
    }
};


window.fazerLogoutFirebase = async function() {

    await signOut(auth);

    usuarioAtualData = null;

    atualizarAvatarCabecalho();

    renderizarConteudoModal('login');
};


window.atualizarFotoPerfilFirebase = async function(event) {

    const file =
        event.target.files[0];


    if (
        !file ||
        !auth.currentUser
    ) {
        return;
    }


    const user =
        auth.currentUser;


    const storageRef =
        ref(
            storage,
            `avatars/${user.uid}.jpg`
        );


    try {

        await uploadBytes(
            storageRef,
            file
        );


        const downloadURL =
            await getDownloadURL(
                storageRef
            );


        await updateDoc(
            doc(
                db,
                "users",
                user.uid
            ),
            {
                avatar: downloadURL
            }
        );


        usuarioAtualData.avatar =
            downloadURL;


        atualizarAvatarCabecalho();

        renderizarConteudoModal();

        carregarRankingLeitoresFirestore();

    } catch (error) {

        alert(
            "Erro ao enviar imagem: " +
            error.message
        );
    }
};


function atualizarAvatarCabecalho() {

    const container =
        document.getElementById(
            'headerAvatarContainer'
        );


    if (
        usuarioAtualData &&
        usuarioAtualData.avatar
    ) {

        container.innerHTML = `
            <img
                src="${usuarioAtualData.avatar}"
                class="profile-avatar-img"
            >
        `;

    } else {

        container.innerHTML = '👤';
    }
}


async function carregarRankingLeitoresFirestore() {

    const container =
        document.getElementById(
            'rankingLeitoresScroll'
        );


    if (!container) {
        return;
    }


    try {

        const q =
            query(
                collection(db, "users"),
                orderBy(
                    "obrasLidas",
                    "desc"
                ),
                limit(50)
            );


        const querySnapshot =
            await getDocs(q);


        if (querySnapshot.empty) {

            container.innerHTML = `
                <div
                    style="
                        font-size: 9px;
                        color: var(--cinza-texto);
                        padding: 10px;
                    "
                >
                    Nenhum leitor no ranking ainda.
                </div>
            `;

            return;
        }


        container.innerHTML = '';

        // 1 e-mail = 1 pessoa no ranking (vários UIDs de teste com mesmo nick não repetem)
        const porEmail = new Map();
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const lidas = Number(data.obrasLidas) || 0;
            if (lidas < 1) return;
            const emailKey = (data.email || docSnap.id || '').toString().toLowerCase().trim();
            if (!emailKey) return;
            const atual = porEmail.get(emailKey);
            if (!atual || lidas > atual.obrasLidas) {
                porEmail.set(emailKey, {
                    uid: docSnap.id,
                    nick: data.nick || 'Leitor',
                    email: data.email || '',
                    avatar: data.avatar || null,
                    obrasLidas: lidas
                });
            }
        });
        // Se vários e-mails tiverem o MESMO nick (contas de teste), fica só o de maior score
        const porNick = new Map();
        Array.from(porEmail.values()).forEach(u => {
            const nk = (u.nick || '').toString().toLowerCase().trim() || u.uid;
            const atual = porNick.get(nk);
            if (!atual || u.obrasLidas > atual.obrasLidas) porNick.set(nk, u);
        });
        const leitores = Array.from(porNick.values()).sort((a, b) => b.obrasLidas - a.obrasLidas);

        if (!leitores.length) {
            container.innerHTML = `
                <div style="font-size: 9px; color: var(--cinza-texto); padding: 10px;">
                    Nenhum leitor no ranking ainda. Complete um capítulo para entrar.
                </div>`;
            return;
        }

        leitores.slice(0, 10).forEach((data, i) => {
            const card = document.createElement('div');
            card.className = 'ranking-card';
            const avatarHTML = data.avatar ? `<img src="${data.avatar}">` : '👤';
            card.innerHTML = `
                <div class="ranking-posicao">${i + 1}º</div>
                <div class="ranking-avatar">${avatarHTML}</div>
                <div class="ranking-nick" title="${data.nick || ''}">${data.nick || 'Leitor'}</div>
                <div class="ranking-obras">${data.obrasLidas} obra${data.obrasLidas === 1 ? '' : 's'}</div>
            `;
            container.appendChild(card);
        });

    } catch (e) {

        container.innerHTML = `
            <div
                style="
                    font-size: 9px;
                    color: var(--cinza-texto);
                    padding: 10px;
                "
            >
                Erro ao carregar ranking.
            </div>
        `;
    }
}


onAuthStateChanged(
    auth,
    async (user) => {

        if (user) {

            const docSnap =
                await getDoc(
                    doc(
                        db,
                        "users",
                        user.uid
                    )
                );


            if (docSnap.exists()) {

                usuarioAtualData =
                    docSnap.data();

            } else {

                usuarioAtualData = {

                    uid: user.uid,

                    nick:
                        user.email.split('@')[0],

                    email:
                        user.email,

                    obrasLidas: 0,

                    avatar: null
                };
            }

        } else {

            usuarioAtualData = null;
        }


        atualizarAvatarCabecalho();

        carregarRankingLeitoresFirestore();
    }
);


/* =========================================================
   CARROSSEL PRINCIPAL - NOVA ESTRUTURA (scroll-snap)
   ========================================================= */

const slider = document.getElementById('carouselSlider');
const dotsContainer = document.getElementById('carouselDots');
const slides = slider ? slider.children : [];
let currentIndex = 0;
let autoPlayTimer;

// Gerar as bolinhas automaticamente com base na quantidade de imagens/slides
if (slider && dotsContainer) {
    for (let i = 0; i < slides.length; i++) {
        const dot = document.createElement('div');
        dot.style.width = i === 0 ? '20px' : '8px';
        dot.style.height = '8px';
        dot.style.borderRadius = '4px';
        dot.style.background = i === 0 ? '#39FF14' : 'rgba(255,255,255,0.4)';
        dot.style.transition = 'all 0.3s ease';
        dot.style.cursor = 'pointer';

        dot.onclick = () => {
            currentIndex = i;
            scrollToIndex();
            resetAutoPlay();
        };
        dotsContainer.appendChild(dot);
    }
}

function scrollToIndex() {
    if (!slider) return;
    slider.scrollTo({
        left: slider.clientWidth * currentIndex,
        behavior: 'smooth'
    });
    updateDots();
}

function updateDots() {
    if (!dotsContainer) return;
    Array.from(dotsContainer.children).forEach((dot, index) => {
        dot.style.width = index === currentIndex ? '20px' : '8px';
        dot.style.background = index === currentIndex ? '#39FF14' : 'rgba(255,255,255,0.4)';
    });
}

function nextSlide() {
    if (!slides.length) return;
    currentIndex = (currentIndex + 1) % slides.length;
    scrollToIndex();
}

function startAutoPlay() {
    autoPlayTimer = setInterval(nextSlide, 4000);
}

function resetAutoPlay() {
    clearInterval(autoPlayTimer);
    startAutoPlay();
}

// Sincroniza o índice se o usuário arrastar manualmente com o dedo
if (slider) {
    let isScrolling;
    slider.addEventListener('scroll', () => {
        clearTimeout(isScrolling);
        isScrolling = setTimeout(() => {
            const newIndex = Math.round(slider.scrollLeft / slider.clientWidth);
            if (newIndex !== currentIndex) {
                currentIndex = newIndex;
                updateDots();
                resetAutoPlay();
            }
        }, 60);
    }, { passive: true });

    // Iniciar o timer automático
    startAutoPlay();
}


/* =========================================================
   SELO NEW + LÓGICA DE TEMPO DE LANÇAMENTO
   =========================================================
   - Mostra minutos até 59 min
   - Mostra horas até 23 hrs
   - A partir de 24h mostra "1 dia"
   - A partir de 48h (2 dias) o selo some automaticamente
*/

// Offsets de demonstração em milissegundos (relativos ao momento atual)
// Ordem dos slides: 5min, 45min, 3h, 12h, 20h, 30h, 50h
const offsetsDemo = [
    5 * 60 * 1000,           // 5 min
    45 * 60 * 1000,          // 45 min
    3 * 60 * 60 * 1000,      // 3 hrs
    12 * 60 * 60 * 1000,     // 12 hrs
    20 * 60 * 60 * 1000,     // 20 hrs
    30 * 60 * 60 * 1000,     // 30 hrs → 1 dia
    50 * 60 * 60 * 1000      // 50 hrs → some (≥ 2 dias)
];

function formatarTempoLancamento(diffMs) {
    const totalMinutos = Math.floor(diffMs / (1000 * 60));
    const totalHoras = Math.floor(diffMs / (1000 * 60 * 60));
    const totalDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // ≥ 2 dias → some o selo
    if (totalDias >= 2) {
        return null;
    }

    // 1 dia (24h ~ 47h59)
    if (totalDias >= 1 || totalHoras >= 24) {
        return '1 dia';
    }

    // Horas (1h ~ 23h)
    if (totalHoras >= 1) {
        return totalHoras === 1 ? '1 hr' : `${totalHoras} hrs`;
    }

    // Minutos
    if (totalMinutos < 1) {
        return 'agora';
    }

    return totalMinutos === 1 ? '1 min' : `${totalMinutos} min`;
}

function atualizarSelosNew() {
    const slidesEl = document.querySelectorAll('#carouselSlider .carousel-slide');
    const agora = Date.now();

    slidesEl.forEach((slide, index) => {
        const badge = slide.querySelector('.badge-new');
        if (!badge) return;

        // Define o timestamp de lançamento se ainda não tiver
        let lancamentoStr = slide.getAttribute('data-lancamento');
        if (!lancamentoStr) {
            // Usa o offset de demo correspondente
            const offset = offsetsDemo[index] !== undefined ? offsetsDemo[index] : (2 * 24 * 60 * 60 * 1000);
            const dataLancamento = new Date(agora - offset);
            slide.setAttribute('data-lancamento', dataLancamento.toISOString());
            lancamentoStr = dataLancamento.toISOString();
        }

        const dataLancamento = new Date(lancamentoStr);
        const diffMs = agora - dataLancamento.getTime();

        const textoTempo = formatarTempoLancamento(diffMs);

        if (textoTempo === null) {
            // ≥ 2 dias → esconde o selo
            badge.classList.add('hidden');
        } else {
            badge.classList.remove('hidden');
            const timeSpan = badge.querySelector('.badge-new-time');
            if (timeSpan) {
                timeSpan.textContent = textoTempo;
            }
        }
    });
}

// Atualiza os selos ao carregar e a cada 30 segundos
atualizarSelosNew();
setInterval(atualizarSelosNew, 30000);


/* =========================================================
   TELA DE DETALHES DA OBRA (Sinopse + Gêneros + Capítulos)
   ========================================================= */

const dadosObras = {};
// Todas as obras vêm do Firestore via carregarObrasFirestore()

let obraAtualFavoritada = false;

window.abrirObra = function(nomeObra) {
    mostrarLoading(() => {
        const obra = dadosObras[nomeObra] || Object.values(dadosObras).find(o => o.titulo === nomeObra);

        if (!obra) {
            // Fallback genérico para obra desconhecida
            document.getElementById('obraTitulo').textContent = nomeObra;
            document.getElementById('obraStatus').textContent = 'Ativo';
            document.getElementById('obraViews').textContent = '👁️ --';
            document.getElementById('obraSinopse').textContent = 'Sinopse ainda não disponível para esta obra.';
            document.getElementById('obraGeneros').innerHTML = '<span class="genero-tag">Desconhecido</span>';
            document.getElementById('capitulosLista').innerHTML = `
                <div class="capitulo-item" onclick="alert('Capítulo em breve...')">
                    <div class="capitulo-info">
                        <span class="capitulo-numero">Cap. 1</span>
                        <span class="capitulo-titulo">Em breve</span>
                    </div>
                    <div class="capitulo-direita">
                        <span class="capitulo-data">--</span>
                    </div>
                </div>
            `;
        } else {
            document.getElementById('obraTitulo').textContent = obra.titulo;
            document.getElementById('obraStatus').textContent = obra.status;
            document.getElementById('obraViews').textContent = '👁️ ' + obra.views;
            document.getElementById('obraSinopse').textContent = obra.sinopse;

            // Gêneros
            const generosHTML = obra.generos.map(g => `<span class="genero-tag">${g}</span>`).join('');
            document.getElementById('obraGeneros').innerHTML = generosHTML;

            // Capítulos (com status lido + ordenação — ver atualizarListaCapitulos)
            atualizarListaCapitulos(obra);
        }

        // Capa grande (mesma lógica: capas/{slug}/qualquer imagem)
        const capaEl = document.getElementById('obraCapaGrande');
        if (capaEl) {
            const tituloCapa = obra ? obra.titulo : nomeObra;
            capaEl.innerHTML = htmlCapa(tituloCapa);
            setTimeout(aplicarCapasGithub, 150);
        }

        // Estado do botão favoritar
        const titulo = obra ? obra.titulo : nomeObra;
        const btnFav = document.getElementById('btnFavoritar');
        if (isFavorito(titulo)) {
            btnFav.textContent = '★ Favoritado';
            btnFav.classList.add('favoritado');
            obraAtualFavoritada = true;
        } else {
            btnFav.textContent = '☆ Favoritar';
            btnFav.classList.remove('favoritado');
            obraAtualFavoritada = false;
        }

        // Progresso de leitura
        const prog = getProgresso(titulo);
        const txt = document.getElementById('obraProgressoTexto');
        const wrap = document.getElementById('obraProgressoBarraWrap');
        const bar = document.getElementById('obraProgressoBarra');
        if (txt && wrap && bar) {
            if (prog.total > 0) {
                txt.textContent = `Progresso: ${prog.lidos} de ${prog.total} capítulos (${prog.pct}%)`;
                wrap.style.display = 'block';
                bar.style.width = prog.pct + '%';
            } else {
                txt.textContent = '';
                wrap.style.display = 'none';
            }
        }

        // Botão "Começar a ler" → abre o último capítulo lido ou o mais recente
        const btnLer = document.getElementById('btnLerAgora');
        if (btnLer) {
            btnLer.onclick = () => {
                if (!obra || !obra.capitulos || !obra.capitulos.length) {
                    alert('Nenhum capítulo disponível');
                    return;
                }
                const hist = carregarHistorico()[titulo];
                const num = hist && hist.ultimo ? hist.ultimo : obra.capitulos[obra.capitulos.length - 1].num;
                abrirCapitulo(obra.titulo, num);
            };
        }

        // Muda para a tela da obra (animação avançar)
        trocarView('obra', 'forward');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
};

window.voltarParaInicio = function() {
    document.body.classList.remove('chat-aberto');
    document.documentElement.style.setProperty('--kb-offset', '0px');
    if (typeof pararAjusteTecladoChat === 'function') pararAjusteTecladoChat();
    trocarView('inicio', 'back');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Atualiza os cards existentes para abrirem a tela de detalhes
document.addEventListener('DOMContentLoaded', () => {
    // Deixa todos os manhwa-card clicáveis
    document.querySelectorAll('.manhwa-card').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', function() {
            const tituloEl = this.querySelector('.manhwa-titulo');
            if (tituloEl) {
                abrirObra(tituloEl.textContent.trim());
            }
        });
    });

    // Carrossel é preenchido só com obras do Firestore (sem exemplos fixos)
});


/* =========================================================
   BIBLIOTECA (Acervo) + FAVORITOS (persistido no localStorage)
   ========================================================= */

const CHAVE_FAVORITOS = 'manhwaToons_favoritos';

function carregarFavoritosSalvos() {
    try {
        const raw = localStorage.getItem(CHAVE_FAVORITOS);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function salvarFavoritos(lista) {
    localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify(lista));
}

function isFavorito(titulo) {
    return carregarFavoritosSalvos().includes(titulo);
}

function adicionarFavorito(titulo) {
    const lista = carregarFavoritosSalvos();
    if (!lista.includes(titulo)) {
        lista.push(titulo);
        salvarFavoritos(lista);
    }
}

function removerFavorito(titulo) {
    const lista = carregarFavoritosSalvos().filter(t => t !== titulo);
    salvarFavoritos(lista);
}

// Lista de todas as obras do app (para a Biblioteca)
function obterTodasObras() {
    // Usa as chaves únicas do objeto dadosObras, evitando duplicatas
    const vistos = new Set();
    const lista = [];
    for (const key of Object.keys(dadosObras)) {
        const obra = dadosObras[key];
        if (!vistos.has(obra.titulo)) {
            vistos.add(obra.titulo);
            lista.push({
                key: key,
                titulo: obra.titulo,
                views: obra.views,
                status: obra.status,
                generos: obra.generos,
                _firebaseSlug: obra._firebaseSlug || null
            });
        }
    }
    return lista;
}

window.filtrarBiblioteca = function(termo) {
    renderizarBiblioteca(termo);
};

window.renderizarFavoritos = function() {
    const grid = document.getElementById('favoritosGrid');
    const vazio = document.getElementById('favoritosVazio');
    if (!grid || !vazio) return;

    const favoritos = carregarFavoritosSalvos();
    grid.innerHTML = '';

    if (favoritos.length === 0) {
        vazio.style.display = 'block';
        grid.style.display = 'none';
        return;
    }

    vazio.style.display = 'none';
    grid.style.display = 'grid';

    favoritos.forEach(titulo => {
        const obra = dadosObras[titulo] || Object.values(dadosObras).find(o => o.titulo === titulo);
        if (obra) {
            grid.appendChild(criarCardObra({
                titulo: obra.titulo,
                views: obra.views,
                status: obra.status,
                generos: obra.generos
            }));
        }
    });
    setTimeout(aplicarCapasGithub, 80);
};

window.toggleFavorito = function() {
    const titulo = document.getElementById('obraTitulo').textContent.trim();
    const btn = document.getElementById('btnFavoritar');

    if (isFavorito(titulo)) {
        removerFavorito(titulo);
        btn.textContent = '☆ Favoritar';
        btn.classList.remove('favoritado');
    } else {
        adicionarFavorito(titulo);
        btn.textContent = '★ Favoritado';
        btn.classList.add('favoritado');
    }

    // Atualiza a tela de favoritos se estiver aberta
    renderizarFavoritos();
};

/* =========================================================
   LOADING OVERLAY
   ========================================================= */

window.mostrarLoading = function(callback, tempo = 1400) {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        if (callback) callback();
        return;
    }

    // reinicia animação da barra
    const inner = overlay.querySelector('.loading-barra-inner');
    if (inner) {
        inner.style.animation = 'none';
        void inner.offsetWidth;
        inner.style.animation = 'loadBar 1.3s ease forwards';
    }

    // anima os pontinhos: CARREGANDO → CARREGANDO. → .. → ... → volta
    const textoEl = document.getElementById('loadingTexto');
    let dots = 0;
    if (window._loadingDotsInterval) {
        clearInterval(window._loadingDotsInterval);
    }
    if (textoEl) {
        textoEl.textContent = 'CARREGANDO';
        window._loadingDotsInterval = setInterval(() => {
            dots = (dots + 1) % 4; // 0,1,2,3
            textoEl.textContent = 'CARREGANDO' + '.'.repeat(dots);
        }, 280);
    }

    overlay.classList.add('ativo');
    setTimeout(() => {
        overlay.classList.remove('ativo');
        if (window._loadingDotsInterval) {
            clearInterval(window._loadingDotsInterval);
            window._loadingDotsInterval = null;
        }
        if (callback) callback();
    }, tempo);
};


/* =========================================================
   CAPAS REAIS + FALLBACK (logo-capa.png)
   ========================================================= */

function slugify(titulo) {
    return titulo
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}


/* =========================================================
   IMAGENS via GitHub Pages (relativo) + jsDelivr (listagem)
   Estrutura:
     capas/{nome-obra}/qualquer-imagem
     caps/{nome-obra}/{numero}/qualquer-imagem
   ========================================================= */
const GITHUB_OWNER = window.GITHUB_OWNER || 'carlosandre1514-prog';
const GITHUB_REPO = window.GITHUB_REPO || 'manhwa-toons';
const GITHUB_BRANCH = window.GITHUB_BRANCH || 'main';

let _repoTreeCache = null;
let _repoTreePromise = null;

async function carregarArvoreRepo() {
    if (_repoTreeCache) return _repoTreeCache;
    if (_repoTreePromise) return _repoTreePromise;
    _repoTreePromise = (async () => {
        try {
            // jsDelivr não sofre o rate limit da API do GitHub
            const url = `https://data.jsdelivr.com/v1/packages/gh/${GITHUB_OWNER}/${GITHUB_REPO}@${GITHUB_BRANCH}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('jsdelivr ' + res.status);
            const data = await res.json();
            _repoTreeCache = data;
            return data;
        } catch (e) {
            console.warn('árvore repo', e);
            _repoTreeCache = { files: [] };
            return _repoTreeCache;
        } finally {
            _repoTreePromise = null;
        }
    })();
    return _repoTreePromise;
}

function _isImgName(name) {
    return /\.(png|jpe?g|webp|gif|bmp|avif|jfif)$/i.test(name || '');
}

function _walkDir(node, parts) {
    if (!node || !parts.length) return node;
    const [head, ...rest] = parts;
    if (!node.files) return null;
    const child = node.files.find(f => f.name === head);
    if (!child) return null;
    if (!rest.length) return child;
    return _walkDir(child, rest);
}

function _listImagesInDir(node) {
    if (!node || !node.files) return [];
    return node.files
        .filter(f => f.type === 'file' && _isImgName(f.name))
        .map(f => f.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

/** URL pública da imagem (Pages relativo ou jsDelivr CDN) */
function urlArquivoRepo(pathRelativo) {
    // Caminho relativo funciona no GitHub Pages
    const limpo = String(pathRelativo || '').replace(/^\/+/, '');
    // Preferência: relativo (mesmo domínio do app)
    return limpo;
}

function urlArquivoCdn(pathRelativo) {
    const limpo = String(pathRelativo || '').replace(/^\/+/, '');
    return `https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@${GITHUB_BRANCH}/${limpo}`;
}

function urlCapa(titulo) {
    return `capas/${slugify(titulo)}/`;
}

function htmlCapa(titulo, classeExtra = '') {
    const obra = (typeof dadosObras !== 'undefined' && (dadosObras[titulo] || Object.values(dadosObras).find(o => o && o.titulo === titulo)));
    if (obra && (obra.capaURL || obra.capaData) && String(obra.capaURL || obra.capaData).startsWith('http')) {
        return `<img src="${obra.capaURL || obra.capaData}" alt="${titulo}" class="${classeExtra}" onerror="this.onerror=null; this.src='logo-capa.png'; this.classList.add('capa-fallback');">`;
    }
    const slug = slugify(titulo);
    // logo até resolver a imagem real da pasta capas/{slug}/
    return `<img src="logo-capa.png" data-slug="${slug}" data-capa="1" alt="${titulo}" class="${classeExtra} capa-fallback">`;
}

const _capaGithubCache = {};

async function resolverCapaGithub(titulo) {
    const slug = slugify(titulo);
    if (_capaGithubCache[slug]) return _capaGithubCache[slug];

    // tenta slug e variações comuns (solo vs solo-leveling)
    const candidatos = [slug];
    if (!slug.includes('-')) {
        // se o título no app for só "Solo", tenta pastas que começam com solo
    }

    try {
        const tree = await carregarArvoreRepo();
        const capasRoot = _walkDir(tree, ['capas']);
        if (!capasRoot || !capasRoot.files) return null;

        // 1) pasta exata capas/{slug}/
        let pasta = capasRoot.files.find(f => f.type === 'directory' && f.name === slug);
        // 2) pasta que começa com o slug (solo → solo-leveling)
        if (!pasta) {
            pasta = capasRoot.files.find(f => f.type === 'directory' && (f.name.startsWith(slug + '-') || f.name.startsWith(slug + '_')));
        }
        // 3) slug contido no nome da pasta
        if (!pasta) {
            pasta = capasRoot.files.find(f => f.type === 'directory' && f.name.includes(slug));
        }

        if (pasta) {
            const imgs = _listImagesInDir(pasta);
            if (imgs[0]) {
                const path = `capas/${pasta.name}/${imgs[0]}`;
                // testa relativo; CDN como fallback no onerror via data-cdn
                _capaGithubCache[slug] = path;
                return path;
            }
        }

        // arquivo solto em capas/
        const solto = (capasRoot.files || []).find(f =>
            f.type === 'file' && _isImgName(f.name) &&
            f.name.replace(/\.[^.]+$/, '').toLowerCase() === slug
        );
        if (solto) {
            const path = `capas/${solto.name}`;
            _capaGithubCache[slug] = path;
            return path;
        }
    } catch (e) {
        console.warn('capa', e);
    }
    return null;
}

async function aplicarCapasGithub() {
    const imgs = document.querySelectorAll('img[data-slug][data-capa]');
    for (const img of imgs) {
        if (img.dataset.ghDone) continue;
        img.dataset.ghDone = '1';
        const url = await resolverCapaGithub(img.dataset.slug);
        if (url) {
            img.classList.remove('capa-fallback');
            const cdn = urlArquivoCdn(url);
            img.onerror = function() {
                // se relativo falhar, tenta CDN
                if (!this.dataset.triedCdn) {
                    this.dataset.triedCdn = '1';
                    this.src = cdn;
                    return;
                }
                this.onerror = null;
                this.src = 'logo-capa.png';
                this.classList.add('capa-fallback');
            };
            img.src = url; // relativo no Pages
        }
    }
}

async function listarPaginasGithub(slug, numCap) {
    const num = String(numCap);
    try {
        const tree = await carregarArvoreRepo();
        const capsRoot = _walkDir(tree, ['caps']);
        if (!capsRoot) return [];

        // pasta da obra
        let obraDir = (capsRoot.files || []).find(f => f.type === 'directory' && f.name === slug);
        if (!obraDir) {
            obraDir = (capsRoot.files || []).find(f => f.type === 'directory' && (f.name.startsWith(slug + '-') || f.name.includes(slug)));
        }
        if (!obraDir) return [];

        // pasta do capítulo: 01, 1, 02...
        let capDir = (obraDir.files || []).find(f => f.type === 'directory' && f.name === num);
        if (!capDir) {
            // tenta com zero à esquerda
            const pad = num.padStart(2, '0');
            capDir = (obraDir.files || []).find(f => f.type === 'directory' && (f.name === pad || f.name === String(parseInt(num, 10))));
        }
        if (!capDir) return [];

        const names = _listImagesInDir(capDir);
        const obraName = obraDir.name;
        const capName = capDir.name;
        return names.map(n => {
            const rel = `caps/${obraName}/${capName}/${n}`;
            return { rel, cdn: urlArquivoCdn(rel) };
        });
    } catch (e) {
        console.warn('listar paginas', e);
        return [];
    }
}




/* =========================================================
   HISTÓRICO + PROGRESSO DE LEITURA
   ========================================================= */

const CHAVE_HISTORICO = 'manhwaToons_historico';

function carregarHistorico() {
    try {
        const raw = localStorage.getItem(CHAVE_HISTORICO);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function salvarHistorico(obj) {
    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(obj));
}

function registrarLeitura(titulo, numCapitulo) {
    const hist = carregarHistorico();
    if (!hist[titulo]) {
        hist[titulo] = { capitulosLidos: [], ultimo: null, atualizado: null };
    }
    if (!hist[titulo].capitulosLidos.includes(numCapitulo)) {
        hist[titulo].capitulosLidos.push(numCapitulo);
    }
    hist[titulo].ultimo = numCapitulo;
    hist[titulo].atualizado = Date.now();
    salvarHistorico(hist);
}

function getProgresso(titulo) {
    const obra = dadosObras[titulo] || Object.values(dadosObras).find(o => o && o.titulo === titulo);
    const total = obra && obra.capitulos ? obra.capitulos.length : 0;
    const hist = carregarHistorico()[titulo];
    const lidos = hist ? (hist.capitulosLidos || []).length : 0;
    const ultimo = hist ? hist.ultimo : null;
    let pct = 0;
    if (total > 0 && hist && hist.progresso) {
        // soma o % de cada capítulo (completo = 100)
        let soma = 0;
        const nums = (obra.capitulos || []).map(c => c.num);
        nums.forEach(n => {
            if ((hist.capitulosLidos || []).includes(n)) soma += 100;
            else if (hist.progresso[n] != null) soma += hist.progresso[n];
        });
        pct = Math.min(100, Math.round(soma / total));
    } else if (total > 0) {
        pct = Math.round((lidos / total) * 100);
    }
    return { total, lidos, ultimo, pct };
}


/* =========================================================
   CONTINUAR LENDO (home)
   ========================================================= */

window.renderizarContinuarLendo = function() {
    const secao = document.getElementById('secaoContinuarLendo');
    const scroll = document.getElementById('continuarLendoScroll');
    if (!secao || !scroll) return;

    const hist = carregarHistorico();
    // Apaga do histórico qualquer obra que NÃO está no catálogo Firestore
    let mudou = false;
    Object.keys(hist).forEach(titulo => {
        const existe = dadosObras[titulo] || Object.values(dadosObras).find(o => o && o.titulo === titulo);
        if (!existe) {
            delete hist[titulo];
            mudou = true;
        }
    });
    if (mudou) salvarHistorico(hist);

    const itens = Object.entries(hist)
        .filter(([titulo, v]) => {
            if (v.ultimo == null) return false;
            return !!(dadosObras[titulo] || Object.values(dadosObras).find(o => o && o.titulo === titulo));
        })
        .sort((a, b) => (b[1].atualizado || 0) - (a[1].atualizado || 0))
        .slice(0, 10);

    if (itens.length === 0) {
        secao.style.display = 'none';
        scroll.innerHTML = '';
        return;
    }

    secao.style.display = 'block';
    scroll.innerHTML = '';

    itens.forEach(([titulo, info]) => {
        const card = document.createElement('div');
        card.className = 'manhwa-card';
        card.onclick = () => {
            mostrarLoading(() => abrirObra(titulo));
        };
        card.innerHTML = `
            <div class="manhwa-capa">${htmlCapa(titulo)}</div>
            <div class="manhwa-info">
                <div class="manhwa-titulo">${titulo}</div>
                <div class="ultimos-caps">
                    <div class="cap-linha">
                        <span class="cap-numero">Cap. ${info.ultimo}</span>
                    </div>
                </div>
            </div>
        `;
        scroll.appendChild(card);
    });
    setTimeout(aplicarCapasGithub, 200);
};


/* =========================================================
   LEITOR DE CAPÍTULOS + ESTRUTURA DE PASTAS
   =========================================================
   Pastas:
     caps/{slug-da-obra}/{numero-do-capitulo}/01.png
     caps/{slug-da-obra}/{numero-do-capitulo}/02.png
     ...
   Exemplo:
     caps/solo-leveling/179/01.png
     caps/solo-leveling/179/02.png
   Se a imagem não existir, mostra placeholder.
*/

let leitorEstado = {
    titulo: null,
    numAtual: null,
    listaCaps: []
};

function caminhoPaginaCapitulo(titulo, numCap, numPagina) {
    // numPagina com 2 dígitos: 01, 02, 03...
    const pag = String(numPagina).padStart(2, '0');
    return `caps/${slugify(titulo)}/${numCap}/${pag}.png`;
}

window.abrirCapitulo = function(titulo, numero) {
    const obra = dadosObras[titulo] || Object.values(dadosObras).find(o => o.titulo === titulo);
    if (!obra) {
        alert('Obra não encontrada');
        return;
    }

    // Se o capítulo tem páginas enviadas via Painel ADM (Firebase Storage), usa elas.
    const cap = obra.capitulos ? obra.capitulos.find(c => c.num === numero) : null;
    const urlsFirebase = cap && Array.isArray(cap.paginasURLs) ? cap.paginasURLs : null;

    mostrarLoading(() => {
        leitorEstado.titulo = titulo;
        leitorEstado.numAtual = numero;
        // Ordena do mais antigo pro mais novo para navegação sequencial
        leitorEstado.listaCaps = (obra.capitulos || []).map(c => c.num).sort((a, b) => a - b);

        document.getElementById('leitorTitulo').textContent = `${titulo} — Cap. ${numero}`;

        const paginas = document.getElementById('leitorPaginas');
        paginas.innerHTML = '';

        if (urlsFirebase && urlsFirebase.length) {
            // Páginas hospedadas no Firebase Storage (cadastradas via Painel ADM)
            urlsFirebase.forEach((url, i) => {
                const div = document.createElement('div');
                div.className = 'leitor-pagina';
                div.style.minHeight = 'auto';
                div.style.padding = '0';
                div.style.border = 'none';
                div.style.background = 'transparent';
                div.innerHTML = `<img src="${url}" alt="Página ${i + 1}" style="width:100%;height:auto;display:block;">`;
                paginas.appendChild(div);
            });
        } else {
            // Fallback: procura páginas manuais na pasta local caps/{obra}/{numero}/01.png, 02.png...
            // Tenta carregar páginas 01..30; para quando der erro em sequência
            const maxTentativas = 30;
            let carregadas = 0;
            let falhasSeguidas = 0;

            function tentarPagina(n) {
                if (n > maxTentativas || falhasSeguidas >= 2) {
                    if (carregadas === 0) {
                        // Nenhuma página real: mostra placeholders
                        for (let i = 1; i <= 3; i++) {
                            const div = document.createElement('div');
                            div.className = 'leitor-pagina';
                            div.innerHTML = `
                                <img src="logo-capa.png" alt="" style="max-width:140px;opacity:0.45;" onerror="this.style.display='none'">
                                <div style="color:var(--verde-neon);font-family:Orbitron,sans-serif;font-size:13px;">Cap. ${numero}</div>
                                <div>Página ${i}</div>
                                <div style="font-size:9px;color:#666;text-align:center;max-width:240px;">
                                    Coloque as imagens em:<br>
                                    <code style="color:#39FF14;">caps/${slugify(titulo)}/${numero}/0${i}.png</code>
                                </div>
                            `;
                            paginas.appendChild(div);
                        }
                    }
                    return;
                }

                const img = new Image();
                const src = caminhoPaginaCapitulo(titulo, numero, n);
                img.onload = () => {
                    falhasSeguidas = 0;
                    carregadas++;
                    const div = document.createElement('div');
                    div.className = 'leitor-pagina';
                    div.style.minHeight = 'auto';
                    div.style.padding = '0';
                    div.style.border = 'none';
                    div.style.background = 'transparent';
                    const el = document.createElement('img');
                    el.src = src;
                    el.alt = `Página ${n}`;
                    el.style.width = '100%';
                    el.style.height = 'auto';
                    el.style.display = 'block';
                    div.appendChild(el);
                    paginas.appendChild(div);
                    tentarPagina(n + 1);
                };
                img.onerror = () => {
                    falhasSeguidas++;
                    tentarPagina(n + 1);
                };
                img.src = src;
            }

            tentarPagina(1);
        }

        registrarLeitura(titulo, numero);
        renderizarContinuarLendo();

        const idx = leitorEstado.listaCaps.indexOf(numero);
        document.getElementById('btnCapAnterior').style.opacity = idx > 0 ? '1' : '0.35';
        document.getElementById('btnCapProximo').style.opacity = idx < leitorEstado.listaCaps.length - 1 ? '1' : '0.35';

        trocarView('leitor', 'forward');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
};

window.fecharLeitor = function() {
    window.removeEventListener('scroll', window._leitorScrollHandler);
    if (leitorEstado.titulo) {
        // volta para a obra com animação "back" (sem loading longo)
        const titulo = leitorEstado.titulo;
        mostrarLoading(() => {
            abrirObra(titulo);
            // força direção back na view obra
            setTimeout(() => trocarView('obra', 'back'), 30);
        }, 500);
    } else {
        voltarParaInicio();
    }
};

window.capituloAnterior = function() {
    const idx = leitorEstado.listaCaps.indexOf(leitorEstado.numAtual);
    if (idx > 0) {
        abrirCapitulo(leitorEstado.titulo, leitorEstado.listaCaps[idx - 1]);
    }
};

window.capituloProximo = function() {
    const idx = leitorEstado.listaCaps.indexOf(leitorEstado.numAtual);
    if (idx < leitorEstado.listaCaps.length - 1) {
        abrirCapitulo(leitorEstado.titulo, leitorEstado.listaCaps[idx + 1]);
    }
};

/* Marcar capítulo como lido manualmente (além do automático ao abrir) */
window.marcarCapituloLido = function(titulo, numero, event) {
    if (event) event.stopPropagation();
    registrarLeitura(titulo, numero);
    // re-render lista se estiver na tela da obra
    const obraTitulo = document.getElementById('obraTitulo');
    if (obraTitulo && obraTitulo.textContent.trim() === titulo) {
        // força refresh dos capítulos
        const obra = dadosObras[titulo] || Object.values(dadosObras).find(o => o.titulo === titulo);
        if (obra) atualizarListaCapitulos(obra);
    }
    renderizarContinuarLendo();
};

function atualizarListaCapitulos(obra) {
    const lista = document.getElementById('capitulosLista');
    if (!lista) return;
    const hist = carregarHistorico()[obra.titulo] || { capitulosLidos: [] };
    // mais novo primeiro
    const caps = [...(obra.capitulos || [])].sort((a, b) => b.num - a.num);
    let html = '';
    caps.forEach(cap => {
        const lido = hist.capitulosLidos.includes(cap.num);
        const classeLido = lido ? 'capitulo-lido' : '';
        const badgeNovo = cap.novo ? '<span class="capitulo-novo">NEW</span>' : '';
        const badgeLido = lido ? '<span class="badge-lido">LIDO</span>' : '';
        html += `
            <div class="capitulo-item ${classeLido}" onclick="abrirCapitulo('${obra.titulo}', ${cap.num})">
                <div class="capitulo-info">
                    <span class="capitulo-numero">Cap. ${cap.num}</span>
                    <span class="capitulo-titulo">${cap.titulo}</span>
                    ${!lido ? `<button class="btn-marcar-lido" onclick="marcarCapituloLido('${obra.titulo}', ${cap.num}, event)">Marcar como lido</button>` : ''}
                </div>
                <div class="capitulo-direita">
                    ${badgeNovo}
                    ${badgeLido}
                    <span class="capitulo-data">${cap.data}</span>
                </div>
            </div>
        `;
    });
    lista.innerHTML = html;
}



/* =========================================================
   BIBLIOTECA COM FILTRO DE GÊNERO + CAPAS
   ========================================================= */

let generoFiltroAtivo = 'Todos';

window.renderizarFiltrosGenero = function() {
    const container = document.getElementById('filtroGeneros');
    if (!container) return;

    const generosSet = new Set(['Todos']);
    obterTodasObras().forEach(o => (o.generos || []).forEach(g => generosSet.add(g)));
    const generos = Array.from(generosSet);

    container.innerHTML = generos.map(g =>
        `<button class="filtro-chip ${g === generoFiltroAtivo ? 'ativo' : ''}" onclick="aplicarFiltroGenero('${g}')">${g}</button>`
    ).join('');
};

window.aplicarFiltroGenero = function(genero) {
    generoFiltroAtivo = genero;
    renderizarFiltrosGenero();
    const input = document.getElementById('inputPesquisaBiblioteca');
    filtrarBiblioteca(input ? input.value : '');
};

window.criarCardObra = function(obra) {
    const card = document.createElement('div');
    card.className = 'manhwa-card';
    card.onclick = () => abrirObra(obra.titulo);
    card.innerHTML = `
        <div class="manhwa-capa">
            ${htmlCapa(obra.titulo)}
            <span class="badge-views">👁️ ${obra.views}</span>
        </div>
        <div class="manhwa-info">
            <div class="manhwa-titulo">${obra.titulo}</div>
            <div class="ultimos-caps">
                <div class="cap-linha">
                    <span class="cap-numero">${obra.status}</span>
                    <span class="cap-data">${obra.generos[0] || ''}</span>
                </div>
            </div>
        </div>
    `;
    return card;
};

window.renderizarBiblioteca = function(filtro = '') {
    const grid = document.getElementById('bibliotecaGrid');
    if (!grid) return;

    grid.innerHTML = '';
    const termo = filtro.trim().toLowerCase();
    let obras = obterTodasObras().filter(o =>
        !termo || o.titulo.toLowerCase().includes(termo)
    );

    if (generoFiltroAtivo && generoFiltroAtivo !== 'Todos') {
        obras = obras.filter(o => (o.generos || []).includes(generoFiltroAtivo));
    }

    if (obras.length === 0) {
        grid.innerHTML = `<div class="conteudo-placeholder" style="grid-column: 1 / -1;">Nenhuma obra encontrada.</div>`;
        return;
    }

    obras.forEach(obra => grid.appendChild(criarCardObra(obra)));
    setTimeout(aplicarCapasGithub, 80);
};

/* =========================================================
   ATUALIZA CARDS ESTÁTICOS DO HTML COM CAPAS + CLIQUE
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
    // Continuar lendo na home
    renderizarContinuarLendo();

    // Troca [ CAPA ] por imagem com fallback em todos os cards estáticos
    document.querySelectorAll('.manhwa-capa').forEach(capa => {
        if (capa.querySelector('img')) return;
        const card = capa.closest('.manhwa-card');
        const tituloEl = card ? card.querySelector('.manhwa-titulo') : null;
        const titulo = tituloEl ? tituloEl.textContent.trim() : '';
        const badge = capa.querySelector('.badge-views');
        const badgeHTML = badge ? badge.outerHTML : '';
        capa.innerHTML = htmlCapa(titulo || 'default') + badgeHTML;
    });
});



/* GitHub owner/repo: definidos acima junto com listarPaginasGithub */
window.GITHUB_OWNER = window.GITHUB_OWNER || 'carlosandre1514-prog';
window.GITHUB_REPO = window.GITHUB_REPO || 'manhwa-toons';
window.GITHUB_BRANCH = window.GITHUB_BRANCH || 'main';


function parseViewsNumber(v) {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const s = String(v).toUpperCase().replace(/[^0-9.KM]/g, '');
    if (s.endsWith('M')) return parseFloat(s) * 1e6;
    if (s.endsWith('K')) return parseFloat(s) * 1e3;
    return parseFloat(s) || 0;
}

function formatViews(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.floor(n));
}

window.renderizarRankingObras = function() {
    const el = document.getElementById('rankingObrasScroll');
    if (!el) return;
    const obras = obterTodasObras().slice().sort((a, b) => parseViewsNumber(b.views) - parseViewsNumber(a.views));
    if (!obras.length) {
        el.innerHTML = '<div style="font-size:10px;color:var(--cinza-texto);padding:10px;">Nenhuma obra ainda.</div>';
        return;
    }
    el.innerHTML = '';
    obras.slice(0, 20).forEach((o, i) => {
        const card = document.createElement('div');
        card.className = 'manhwa-card';
        card.onclick = () => abrirObra(o.titulo);
        card.innerHTML = `
            <div class="manhwa-capa">
                ${htmlCapa(o.titulo)}
                <span class="badge-views">👁️ ${o.views || '0'}</span>
            </div>
            <div class="manhwa-info">
                <div class="manhwa-titulo">${o.titulo}</div>
                <div class="ultimos-caps">
                    <div class="cap-linha">
                        <span class="cap-numero">Top ${i + 1}</span>
                        <span class="cap-data">${o.status || ''}</span>
                    </div>
                </div>
            </div>`;
        el.appendChild(card);
    });
    setTimeout(aplicarCapasGithub, 80);
};

window.renderizarMaisLidos = function() {
    const el = document.getElementById('maisLidosScroll');
    if (!el) return;
    // Usa as mesmas obras por views (semana = ranking geral por enquanto)
    const obras = obterTodasObras().slice().sort((a, b) => parseViewsNumber(b.views) - parseViewsNumber(a.views));
    if (!obras.length) {
        el.innerHTML = '<div style="font-size:10px;color:var(--cinza-texto);padding:10px;">Nenhuma obra ainda.</div>';
        return;
    }
    el.innerHTML = '';
    obras.slice(0, 6).forEach(o => {
        const full = dadosObras[o.titulo] || o;
        const caps = [...(full.capitulos || [])].sort((a, b) => b.num - a.num);
        const c1 = caps[0];
        const c2 = caps[1];
        let capsHtml = '';
        if (c1) capsHtml += `<div class="cap-linha"><span class="cap-numero">Cap. ${c1.num}</span><span class="cap-data">${c1.data || 'Novo'}</span></div>`;
        if (c2) capsHtml += `<div class="cap-linha"><span class="cap-numero">Cap. ${c2.num}</span><span class="cap-data">${c2.data || '-'}</span></div>`;
        if (!c1) capsHtml = `<div class="cap-linha"><span class="cap-numero">0 caps</span><span class="cap-data">Nova</span></div>`;
        const card = document.createElement('div');
        card.className = 'manhwa-card';
        card.onclick = () => abrirObra(o.titulo);
        card.innerHTML = `
            <div class="manhwa-capa">${htmlCapa(o.titulo)}<span class="badge-views">👁️ ${o.views || '0'}</span></div>
            <div class="manhwa-info">
                <div class="manhwa-titulo">${o.titulo}</div>
                <div class="ultimos-caps">${capsHtml}</div>
            </div>`;
        el.appendChild(card);
    });
    setTimeout(aplicarCapasGithub, 80);
};

window.renderizarCarrossel = async function() {
    const slider = document.getElementById('carouselSlider');
    if (!slider) return;
    let obras = obterTodasObras().filter(o => {
        const full = dadosObras[o.titulo] || o;
        return full.carrossel === true;
    });
    obras = obras.sort((a, b) => {
        const da = (dadosObras[a.titulo] && dadosObras[a.titulo].atualizadoEm) || 0;
        const db = (dadosObras[b.titulo] && dadosObras[b.titulo].atualizadoEm) || 0;
        return db - da;
    }).slice(0, 8);

    if (!obras.length) {
        slider.innerHTML = `<div class="carousel-slide">
            <div class="carousel-info"><h3>Manhwa Toons</h3><p>Marque obras em ADM → Destaques.</p></div>
        </div>`;
        return;
    }

    // Banner dedicado (carrossel/) OU mesma capa da obra (capas/)
    const medias = await Promise.all(obras.map(async (o) => {
        const banner = await resolverBannerCarrossel(o.titulo);
        if (banner) return { tipo: 'banner', url: banner };
        const capa = await resolverCapaGithub(o.titulo);
        return { tipo: 'capa', url: capa || 'logo-capa.png' };
    }));

    slider.innerHTML = obras.map((o, i) => {
        const full = dadosObras[o.titulo] || o;
        const sin = (full.sinopse || '').slice(0, 90) + ((full.sinopse || '').length > 90 ? '...' : '');
        const t = String(o.titulo).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const m = medias[i];
        const url = m.url || 'logo-capa.png';
        const cdn = (url.startsWith('http') ? url : urlArquivoCdn(url));
        // banner horizontal: cover | capa vertical: cover no topo (sem ficar minúscula)
        const fitClass = m.tipo === 'banner' ? 'carousel-media-banner' : 'carousel-media-capa';
        return `<div class="carousel-slide">
            <div class="carousel-media ${fitClass}">
                <img src="${url}" data-cdn="${cdn}" alt="" onerror="if(!this.dataset.t){this.dataset.t=1;this.src=this.dataset.cdn||'logo-capa.png';}">
            </div>
            <div class="carousel-gradiente"></div>
            <div class="badge-new"><span class="badge-new-label">NEW</span><span class="badge-new-time">destaque</span></div>
            <div class="carousel-info">
                <h3>${o.titulo.toUpperCase()}</h3>
                <p>${sin || 'Nova obra no catálogo.'}</p>
                <div class="carousel-botoes">
                    <button class="btn-ler" onclick="abrirObra('${t}')">Começar a ler</button>
                    <button class="btn-desc" onclick="abrirObra('${t}')">Ver descrição</button>
                </div>
            </div>
        </div>`;
    }).join('');
};

const _bannerCache = {};
async function resolverBannerCarrossel(titulo) {
    const slug = slugify(titulo);
    if (_bannerCache[slug]) return _bannerCache[slug];
    try {
        const tree = await carregarArvoreRepo();
        const root = _walkDir(tree, ['carrossel']);
        if (!root || !root.files) return null;
        // carrossel/{slug}/qualquer imagem
        let pasta = root.files.find(f => f.type === 'directory' && f.name === slug);
        if (!pasta) pasta = root.files.find(f => f.type === 'directory' && (f.name.startsWith(slug) || f.name.includes(slug)));
        if (pasta) {
            const imgs = _listImagesInDir(pasta);
            if (imgs[0]) {
                const path = `carrossel/${pasta.name}/${imgs[0]}`;
                _bannerCache[slug] = path;
                return path;
            }
        }
        // carrossel/slug.webp arquivo solto
        const solto = root.files.find(f => f.type === 'file' && _isImgName(f.name) &&
            f.name.replace(/\\.[^.]+$/, '').toLowerCase().startsWith(slug));
        if (solto) {
            const path = `carrossel/${solto.name}`;
            _bannerCache[slug] = path;
            return path;
        }
    } catch (e) {
        console.warn('banner', e);
    }
    return null;
}

/* Views só contam ao terminar o capítulo (scroll no fim) */
async function registrarViewCompleta(titulo) {
    const obra = dadosObras[titulo];
    if (!obra || !obra._firebaseSlug) return;
    const key = 'viewed_' + slugify(titulo) + '_' + (obra.capitulos || []).map(c => c.num).join('-');
    // por capítulo na chamada abaixo
}

async function incrementarViewObra(titulo, numCap) {
    // 1 view por USUÁRIO (ou dispositivo se não logado) por OBRA — só quem ainda não leu
    const idLeitor = (usuarioAtualData && usuarioAtualData.uid)
        ? usuarioAtualData.uid
        : ('anon_' + (localStorage.getItem('mt_anon_id') || (localStorage.setItem('mt_anon_id', String(Date.now())+Math.random()), localStorage.getItem('mt_anon_id'))));
    const flagObra = `mt_view_obra_${slugify(titulo)}_${idLeitor}`;
    if (localStorage.getItem(flagObra)) return; // esse usuário já contou view nesta obra
    localStorage.setItem(flagObra, '1');

    const obra = dadosObras[titulo];
    if (!obra || !obra._firebaseSlug) return;
    try {
        const n = parseViewsNumber(obra.views) + 1;
        const viewsStr = formatViews(n);
        await updateDoc(doc(db, 'obras', obra._firebaseSlug), { views: viewsStr });
        obra.views = viewsStr;

        // Ranking leitores: +1 quando completa um capítulo (por usuário logado)
        if (usuarioAtualData && usuarioAtualData.uid) {
            try {
                const flagUser = `mt_user_cap_${usuarioAtualData.uid}_${slugify(titulo)}_${numCap}`;
                if (!localStorage.getItem(flagUser)) {
                    localStorage.setItem(flagUser, '1');
                    const novo = (Number(usuarioAtualData.obrasLidas) || 0) + 1;
                    usuarioAtualData.obrasLidas = novo;
                    await updateDoc(doc(db, 'users', usuarioAtualData.uid), { obrasLidas: novo });
                    carregarRankingLeitoresFirestore();
                }
            } catch (err) { console.warn('obrasLidas user', err); }
        }

        // Atualiza UI de views
        const elViews = document.getElementById('obraViews');
        if (elViews && document.getElementById('obraTitulo') &&
            document.getElementById('obraTitulo').textContent.trim() === titulo) {
            elViews.textContent = '👁️ ' + viewsStr;
        }
        sincronizarListaPesquisa();
        renderizarRankingObras();
        renderizarMaisLidos();
        renderizarLancamentos();
    } catch (e) {
        console.warn('view:', e);
        localStorage.removeItem(flagObra); // permite tentar de novo se falhou
    }
}

function salvarProgressoScroll(titulo, numCap, pct) {
    const hist = carregarHistorico();
    if (!hist[titulo]) hist[titulo] = { capitulosLidos: [], ultimo: null, atualizado: null, progresso: {} };
    if (!hist[titulo].progresso) hist[titulo].progresso = {};
    const prev = hist[titulo].progresso[numCap] || 0;
    hist[titulo].progresso[numCap] = Math.max(prev, Math.min(100, Math.round(pct)));
    hist[titulo].ultimo = numCap;
    hist[titulo].atualizado = Date.now();
    if (pct >= 92 && !hist[titulo].capitulosLidos.includes(numCap)) {
        hist[titulo].capitulosLidos.push(numCap);
    }
    salvarHistorico(hist);
}


/* =========================================================
   PAINEL ADM + SUPORTE — Firestore (dados) + GitHub (imagens)
   =========================================================
   SEM Firebase Storage.
   Capas:     capas/{slug}.png
   Capítulos: caps/{slug}/{numero}/01.png, 02.png, ...
   Dados:     Firestore obras/{slug}
*/

const EMAILS_ADMIN = [
    // 'seu-email@gmail.com'
];

const CHAVE_ADMINS_EXTRA = 'manhwaToons_admins_extra';

function isAdminUser() {
    if (!EMAILS_ADMIN.length) return true;
    const extra = JSON.parse(localStorage.getItem(CHAVE_ADMINS_EXTRA) || '[]');
    const permitidos = [...EMAILS_ADMIN, ...extra];
    if (!usuarioAtualData || !usuarioAtualData.email) return false;
    return permitidos.map(e => e.toLowerCase()).includes(String(usuarioAtualData.email).toLowerCase())
        || !!(usuarioAtualData.isAdmin);
}

function atualizarVisibilidadeMenuAdm() {
    const item = document.getElementById('menuItemAdm');
    if (!item) return;
    item.style.display = isAdminUser() ? '' : 'none';
}

async function carregarObrasFirestore() {
    try {
        const snap = await getDocs(collection(db, 'obras'));
        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (data && data.titulo) {
                dadosObras[data.titulo] = {
                    titulo: data.titulo,
                    status: data.status || 'Ativo',
                    views: data.views || '0',
                    generos: data.generos || ['Outros'],
                    sinopse: data.sinopse || '',
                    capitulos: data.capitulos || [],
                    capaURL: data.capaURL || null,
                    capaData: data.capaURL || null,
                    atualizadoEm: data.atualizadoEm || 0,
                    carrossel: data.carrossel === true,
                    _firebaseSlug: docSnap.id
                };
            }
        });
        console.log('[ADM] Obras Firestore:', snap.size);
        sincronizarListaPesquisa();
        renderizarLancamentos();
        renderizarRankingObras();
        renderizarMaisLidos();
        renderizarCarrossel();
        setTimeout(aplicarCapasGithub, 300);
    } catch (e) {
        console.warn('[ADM] Erro obras:', e.message);
    }
}

/* ----- Lançamentos dinâmicos (mais recentes primeiro) ----- */
window.renderizarLancamentos = function() {
    const grid = document.getElementById('lancamentosGrid');
    if (!grid) return;

    const obras = obterTodasObras().slice();
    // ordena por atualizadoEm desc; exemplos sem data ficam no fim
    obras.sort((a, b) => {
        const da = (dadosObras[a.titulo] && dadosObras[a.titulo].atualizadoEm) || 0;
        const db_ = (dadosObras[b.titulo] && dadosObras[b.titulo].atualizadoEm) || 0;
        return db_ - da;
    });

    if (!obras.length) {
        grid.innerHTML = `<div class="conteudo-placeholder" style="grid-column:1/-1;font-size:11px;">Nenhuma obra ainda. Cadastre no Painel ADM.</div>`;
        return;
    }

    grid.innerHTML = '';
    obras.forEach(o => {
        const full = dadosObras[o.titulo] || o;
        const caps = full.capitulos || [];
        const ordenados = [...caps].sort((a, b) => b.num - a.num);
        const c1 = ordenados[0];
        const c2 = ordenados[1];
        const card = document.createElement('div');
        card.className = 'manhwa-card';
        card.onclick = () => abrirObra(o.titulo);
        let capsHtml = '';
        if (c1) {
            capsHtml += `<div class="cap-linha"><span class="cap-numero">Cap. ${c1.num}</span><span class="cap-data">${c1.data || 'Novo'}</span></div>`;
        } else {
            capsHtml += `<div class="cap-linha"><span class="cap-numero">0 capítulos</span><span class="cap-data">Nova</span></div>`;
        }
        if (c2) {
            capsHtml += `<div class="cap-linha"><span class="cap-numero">Cap. ${c2.num}</span><span class="cap-data">${c2.data || '-'}</span></div>`;
        }
        card.innerHTML = `
            <div class="manhwa-capa">
                ${htmlCapa(o.titulo)}
                <span class="badge-views">👁️ ${o.views || '0'}</span>
            </div>
            <div class="manhwa-info">
                <div class="manhwa-titulo">${o.titulo}</div>
                <div class="ultimos-caps">${capsHtml}</div>
            </div>
        `;
        grid.appendChild(card);
    });
    setTimeout(aplicarCapasGithub, 80);
};

window.admTab = function(nome) {
    document.querySelectorAll('.adm-tab').forEach(t => t.classList.remove('ativo'));
    document.querySelectorAll('.adm-panel').forEach(p => p.classList.remove('ativo'));
    const btn = document.querySelector(`.adm-tab[onclick="admTab('${nome}')"]`);
    const panel = document.getElementById('admTab-' + nome);
    if (btn) btn.classList.add('ativo');
    if (panel) panel.classList.add('ativo');
    if (nome === 'obras') admRenderListaObras();
    if (nome === 'capitulos') {
        admPopularSelectObras();
        atualizarHintCapitulo();
    }
    if (nome === 'destaques') admRenderDestaques();
    if (nome === 'avisos') {}
    if (nome === 'tickets') admRenderTickets();
    if (nome === 'usuarios') admRenderUsuarios();
};

function atualizarHintObra() {
    const titulo = (document.getElementById('admObraTitulo') || {}).value || 'nome-da-obra';
    const el = document.getElementById('admObraCapaPath');
    if (el) el.textContent = `capas/${slugify(titulo.trim() || 'nome-da-obra')}/  (qualquer imagem dentro)`;
}

function atualizarHintCapitulo() {
    const titulo = (document.getElementById('admCapObra') || {}).value || 'nome-da-obra';
    const num = (document.getElementById('admCapNumero') || {}).value || 'NUMERO';
    const el = document.getElementById('admCapPathHint');
    if (el) el.textContent = `caps/${slugify(titulo)}/${num}/  (pasta do capítulo: 0, 00, 1... + qualquer imagem)`;
}

document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'admObraTitulo') atualizarHintObra();
    if (e.target && (e.target.id === 'admCapNumero' || e.target.id === 'admCapObra')) atualizarHintCapitulo();
});
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'admCapObra') atualizarHintCapitulo();
});

/* ----- Salvar obra (só Firestore + caminho GitHub) ----- */
window.admSalvarObra = async function() {
    const titulo = document.getElementById('admObraTitulo').value.trim();
    const status = document.getElementById('admObraStatus').value;
    const generosStr = document.getElementById('admObraGeneros').value.trim();
    const sinopse = document.getElementById('admObraSinopse').value.trim();
    const msg = document.getElementById('admObraMsg');
    const err = document.getElementById('admObraErro');
    msg.style.display = 'none';
    err.style.display = 'none';

    if (!titulo || !sinopse) {
        err.textContent = 'Preencha título e sinopse.';
        err.style.display = 'block';
        return;
    }

    const generos = generosStr.split(',').map(g => g.trim()).filter(Boolean);
    const slug = slugify(titulo);

    try {
        msg.textContent = 'Salvando no Firestore...';
        msg.style.display = 'block';

        let capitulos = [];
        if (dadosObras[titulo] && Array.isArray(dadosObras[titulo].capitulos)) {
            capitulos = dadosObras[titulo].capitulos;
        }

        // capaURL aponta para o arquivo no próprio site (GitHub Pages)
        const capaURL = `capas/${slug}/`;

        const obraData = {
            titulo,
            slug,
            status,
            generos: generos.length ? generos : ['Outros'],
            sinopse,
            views: (dadosObras[titulo] && dadosObras[titulo].views) || '0',
            capaURL,
            capitulos,
            atualizadoEm: Date.now()
        };

        await setDoc(doc(db, 'obras', slug), obraData, { merge: true });

        dadosObras[titulo] = {
            ...obraData,
            capaData: capaURL,
            _firebaseSlug: slug
        };

        msg.innerHTML = `Obra salva!<br>No GitHub crie a pasta e coloque a capa:<br><code style="color:#39FF14">capas/${slug}/qualquer-imagem.webp</code>`;
        msg.style.display = 'block';
        document.getElementById('admObraTitulo').value = '';
        document.getElementById('admObraSinopse').value = '';
        document.getElementById('admObraGeneros').value = '';
        atualizarHintObra();
        admRenderListaObras();
        admPopularSelectObras();
        renderizarLancamentos();
    } catch (e) {
        console.error(e);
        err.textContent = 'Erro ao salvar: ' + (e.message || e);
        err.style.display = 'block';
        msg.style.display = 'none';
    }
};

window.admRenderListaObras = async function() {
    const box = document.getElementById('admListaObras');
    if (!box) return;
    box.innerHTML = '<div style="font-size:10px;color:var(--cinza-texto);">Carregando...</div>';
    try {
        await carregarObrasFirestore();
        const todas = obterTodasObras();
        if (!todas.length) {
            box.innerHTML = '<div class="conteudo-placeholder">Nenhuma obra ainda.</div>';
            return;
        }
        box.innerHTML = todas.map(o => {
            const full = dadosObras[o.titulo] || {};
            const tituloEsc = String(o.titulo).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const slug = full._firebaseSlug || slugify(o.titulo);
            const isFb = !!full._firebaseSlug;
            const btnExcluir = isFb
                ? `<button class="perigo" onclick="admApagarObra('${slug}', '${tituloEsc}')">Excluir</button>`
                : `<button class="perigo" onclick="admOcultarExemplo('${tituloEsc}')">Ocultar exemplo</button>`;
            return `
            <div class="adm-item">
                <div class="adm-item-titulo">${o.titulo}</div>
                <div class="adm-item-meta">${o.status} · capa: capas/${slug}.png · ${(o.generos||[]).join(', ')}</div>
                <div class="adm-item-acoes">
                    <button onclick="abrirObra('${tituloEsc}')">Ver</button>
                    ${btnExcluir}
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        box.innerHTML = `<div class="conteudo-placeholder">Erro: ${e.message}</div>`;
    }
};

window.admApagarObra = async function(slug, titulo) {
    if (!confirm(`Excluir "${titulo}" do Firebase? (As imagens no GitHub você apaga manualmente se quiser.)`)) return;
    try {
        await deleteDoc(doc(db, 'obras', slug));
        delete dadosObras[titulo];
        admRenderListaObras();
        admPopularSelectObras();
        renderizarLancamentos();
        renderizarContinuarLendo();
    } catch (e) {
        alert('Erro: ' + (e.message || e));
    }
};

window.admOcultarExemplo = function(titulo) {
    delete dadosObras[titulo];
    // remove também da lista de pesquisa se existir
    const idx = listaObrasCompleta.findIndex(o => o.titulo === titulo);
    if (idx >= 0) listaObrasCompleta.splice(idx, 1);
    admRenderListaObras();
    renderizarLancamentos();
};

window.admPopularSelectObras = function() {
    const sel = document.getElementById('admCapObra');
    if (!sel) return;
    const obras = obterTodasObras();
    sel.innerHTML = obras.map(o => `<option value="${o.titulo}">${o.titulo}</option>`).join('')
        || '<option value="">Nenhuma obra — cadastre uma primeiro</option>';
    atualizarHintCapitulo();
};

/* ----- Salvar capítulo (só metadados; imagens no GitHub) ----- */
window.admSalvarCapitulo = async function() {
    const titulo = document.getElementById('admCapObra').value;
    const num = parseInt(document.getElementById('admCapNumero').value, 10);
    const capTitulo = document.getElementById('admCapTitulo').value.trim() || `Capítulo ${num}`;
    const msg = document.getElementById('admCapMsg');
    const err = document.getElementById('admCapErro');
    msg.style.display = 'none';
    err.style.display = 'none';

    if (!titulo || !num) {
        err.textContent = 'Selecione a obra e o número do capítulo.';
        err.style.display = 'block';
        return;
    }

    const slug = slugify(titulo);

    try {
        msg.textContent = 'Salvando capítulo no Firestore...';
        msg.style.display = 'block';

        const refObra = doc(db, 'obras', slug);
        const snap = await getDoc(refObra);
        let obraData = snap.exists() ? snap.data() : (dadosObras[titulo] ? { ...dadosObras[titulo], slug } : null);
        if (!obraData || !snap.exists()) {
            // se só existe como exemplo local, cria no Firestore
            if (dadosObras[titulo]) {
                obraData = {
                    titulo,
                    slug,
                    status: dadosObras[titulo].status || 'Ativo',
                    generos: dadosObras[titulo].generos || ['Outros'],
                    sinopse: dadosObras[titulo].sinopse || '',
                    views: dadosObras[titulo].views || '0',
                    capaURL: `capas/${slug}.png`,
                    capitulos: dadosObras[titulo].capitulos || [],
                    atualizadoEm: Date.now()
                };
            } else {
                err.textContent = 'Cadastre a obra primeiro na aba Obras.';
                err.style.display = 'block';
                msg.style.display = 'none';
                return;
            }
        }

        if (!Array.isArray(obraData.capitulos)) obraData.capitulos = [];
        const entry = {
            num,
            titulo: capTitulo,
            data: 'Hoje',
            novo: true
            // páginas vêm de caps/{slug}/{num}/01.png no GitHub
        };
        const idx = obraData.capitulos.findIndex(c => c.num === num);
        if (idx >= 0) obraData.capitulos[idx] = { ...obraData.capitulos[idx], ...entry };
        else obraData.capitulos.push(entry);
        obraData.capitulos.sort((a, b) => b.num - a.num);
        obraData.atualizadoEm = Date.now();

        await setDoc(refObra, obraData, { merge: true });

        dadosObras[titulo] = {
            titulo: obraData.titulo || titulo,
            status: obraData.status || 'Ativo',
            views: obraData.views || '0',
            generos: obraData.generos || [],
            sinopse: obraData.sinopse || '',
            capitulos: obraData.capitulos,
            capaURL: obraData.capaURL || `capas/${slug}.png`,
            capaData: obraData.capaURL || `capas/${slug}.png`,
            atualizadoEm: obraData.atualizadoEm,
            _firebaseSlug: slug
        };

        msg.innerHTML = `Capítulo ${num} salvo!<br>No GitHub:<br><code style="color:#39FF14">caps/${slug}/${num}/</code><br>Qualquer imagem dentro (webp, png, jpg...). Capítulos 0 ou 00 também valem.`;
        msg.style.display = 'block';
        document.getElementById('admCapNumero').value = '';
        document.getElementById('admCapTitulo').value = '';
        atualizarHintCapitulo();
        renderizarLancamentos();
    } catch (e) {
        console.error(e);
        err.textContent = 'Erro: ' + (e.message || e);
        err.style.display = 'block';
        msg.style.display = 'none';
    }
};

/* ----- Leitor: pasta GitHub caps/slug/num/01.png ----- */
// sobrescreve abrirCapitulo se já existir wrapper — força caminho de pastas
const _abrirCapAntes = window.abrirCapitulo;
window.abrirCapitulo = function(titulo, numero) {
    const obra = dadosObras[titulo] || Object.values(dadosObras).find(o => o && o.titulo === titulo);

    mostrarLoading(async () => {
        leitorEstado.titulo = titulo;
        leitorEstado.numAtual = numero;
        leitorEstado.listaCaps = (obra && obra.capitulos ? obra.capitulos : []).map(c => c.num).sort((a, b) => a - b);

        document.getElementById('leitorTitulo').textContent = `${titulo} — Cap. ${numero}`;
        const paginas = document.getElementById('leitorPaginas');
        paginas.innerHTML = '';

        const slug = slugify(titulo);
        // 1) Lista imagens em caps/{obra}/{numero}/ via jsDelivr (sem rate limit do GitHub)
        let pages = await listarPaginasGithub(slug, numero);

        // 2) Fallback: se slug for "solo" e pasta for "solo-leveling", listarPaginas já tenta include
        if (!pages.length) {
            // tenta número com zero: 1 ↔ 01
            const alt = String(numero).padStart(2, '0');
            if (alt !== String(numero)) pages = await listarPaginasGithub(slug, alt);
        }

        if (!pages.length) {
            const div = document.createElement('div');
            div.className = 'leitor-pagina';
            div.innerHTML = `
                <img src="logo-capa.png" style="max-width:120px;opacity:0.5" onerror="this.style.display='none'">
                <div style="color:var(--verde-neon);font-family:Orbitron,sans-serif;">Cap. ${numero}</div>
                <div style="font-size:10px;text-align:center;max-width:280px;line-height:1.45;">
                    Nenhuma página encontrada.<br>
                    No GitHub coloque em:<br>
                    <code style="color:#39FF14">caps/${slug}/${numero}/</code><br>
                    (qualquer nome de imagem)
                </div>`;
            paginas.appendChild(div);
        } else {
            pages.forEach((p, i) => {
                const rel = typeof p === 'string' ? p : p.rel;
                const cdn = typeof p === 'string' ? p : p.cdn;
                const div = document.createElement('div');
                div.className = 'leitor-pagina';
                div.style.minHeight = 'auto';
                div.style.padding = '0';
                div.style.border = 'none';
                div.style.background = 'transparent';
                div.innerHTML = `<img src="${rel}" data-cdn="${cdn}" alt="Página ${i + 1}" style="width:100%;height:auto;display:block;" loading="lazy" onerror="if(!this.dataset.t){this.dataset.t=1;this.src=this.dataset.cdn;}">`;
                paginas.appendChild(div);
            });
        }

        registrarLeitura(titulo, numero);

        // Progresso por scroll + view só no final
        let viewRegistrada = false;
        const onScroll = () => {
            const doc = document.documentElement;
            const scrollTop = window.scrollY || doc.scrollTop;
            const height = doc.scrollHeight - doc.clientHeight;
            const pct = height > 0 ? (scrollTop / height) * 100 : 0;
            salvarProgressoScroll(titulo, numero, pct);
            if (pct >= 92 && !viewRegistrada) {
                viewRegistrada = true;
                incrementarViewObra(titulo, numero);
            }
            renderizarContinuarLendo();
        };
        window.removeEventListener('scroll', window._leitorScrollHandler);
        window._leitorScrollHandler = onScroll;
        window.addEventListener('scroll', onScroll, { passive: true });

        // restaura posição aproximada se já tinha progresso
        const hist = carregarHistorico()[titulo];
        const pctSalvo = hist && hist.progresso ? hist.progresso[numero] : 0;
        setTimeout(() => {
            if (pctSalvo > 5 && pctSalvo < 95) {
                const doc = document.documentElement;
                const height = doc.scrollHeight - doc.clientHeight;
                window.scrollTo(0, (pctSalvo / 100) * height);
            }
        }, 400);

        const idx = leitorEstado.listaCaps.indexOf(numero);
        document.getElementById('btnCapAnterior').style.opacity = idx > 0 ? '1' : '0.35';
        document.getElementById('btnCapProximo').style.opacity = idx < leitorEstado.listaCaps.length - 1 ? '1' : '0.35';

        trocarView('leitor', 'forward');
        if (!(pctSalvo > 5)) window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 900);
};


/* ----- Tickets ----- */

window.admRenderDestaques = function() {
    const box = document.getElementById('admListaDestaques');
    if (!box) return;
    const obras = obterTodasObras();
    if (!obras.length) {
        box.innerHTML = '<div class="conteudo-placeholder">Nenhuma obra cadastrada.</div>';
        return;
    }
    box.innerHTML = obras.map(o => {
        const full = dadosObras[o.titulo] || {};
        const on = full.carrossel === true;
        const slug = full._firebaseSlug || slugify(o.titulo);
        const t = String(o.titulo).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `<div class="adm-item">
            <div class="adm-item-titulo">${o.titulo}</div>
            <div class="adm-item-meta">
                Carrossel: ${on ? '✅ ATIVO' : 'não'} · Views: ${o.views || 0}<br>
                Banner: <code style="color:#39FF14">carrossel/${slug}.webp</code>
            </div>
            <div class="adm-item-acoes">
                <button onclick="admToggleCarrossel('${slug}', '${t}', ${on ? 'false' : 'true'})">
                    ${on ? '🗑 Remover do carrossel' : '➕ Colocar no carrossel'}
                </button>
            </div>
        </div>`;
    }).join('');
};

window.admToggleCarrossel = async function(slug, titulo, valor) {
    try {
        const on = valor === true || valor === 'true';
        await updateDoc(doc(db, 'obras', slug), { carrossel: on });
        if (dadosObras[titulo]) dadosObras[titulo].carrossel = on;
        admRenderDestaques();
        renderizarCarrossel();
        if (on) {
            alert('Ativado! No GitHub envie o banner:\\ncarrossel/' + slug + '.webp\\nIdeal: 1200×450 px');
        }
    } catch (e) {
        alert('Erro: ' + (e.message || e));
    }
};

/* =========================================================
   CHAT DA COMUNIDADE — Firestore, some após 24h
   ========================================================= */
let _chatUnsub = null;
const CHAT_TTL_MS = 24 * 60 * 60 * 1000;

function formatChatHora(ts) {
    try {
        const d = ts && ts.toDate ? ts.toDate() : new Date(ts);
        const agora = new Date();
        const diff = (agora - d) / 1000;
        if (diff < 60) return 'agora';
        if (diff < 3600) return Math.floor(diff / 60) + ' min';
        if (diff < 86400 && d.getDate() === agora.getDate()) {
            return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
        return '';
    }
}

function formatChatDia(ts) {
    try {
        const d = ts && ts.toDate ? ts.toDate() : new Date(ts);
        const hoje = new Date();
        const ontem = new Date();
        ontem.setDate(hoje.getDate() - 1);
        if (d.toDateString() === hoje.toDateString()) return 'Hoje';
        if (d.toDateString() === ontem.toDateString()) return 'Ontem';
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) {
        return '';
    }
}

function chatCorAvatar(nick) {
    const cores = ['#39FF14', '#00E5FF', '#FF6B9D', '#FFD60A', '#BF5AF2', '#64D2FF', '#30D158'];
    let h = 0;
    const s = String(nick || 'A');
    for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 1)) % cores.length;
    return cores[h];
}

window.chatAtualizarContador = function() {
    const input = document.getElementById('chatInput');
    const el = document.getElementById('chatContador');
    if (!input || !el) return;
    const n = (input.value || '').length;
    el.textContent = n + '/300';
    el.classList.toggle('quase', n >= 250 && n < 300);
    el.classList.toggle('cheio', n >= 300);
};

window.chatIrParaFim = function() {
    const box = document.getElementById('chatMensagens');
    if (box) box.scrollTop = box.scrollHeight;
    const btn = document.getElementById('chatScrollBtn');
    if (btn) btn.style.display = 'none';
};

function chatBindScrollBtn() {
    const box = document.getElementById('chatMensagens');
    const btn = document.getElementById('chatScrollBtn');
    if (!box || !btn || box.dataset.scrollBound) return;
    box.dataset.scrollBound = '1';
    box.addEventListener('scroll', () => {
        const longe = box.scrollHeight - box.scrollTop - box.clientHeight > 120;
        btn.style.display = longe ? 'block' : 'none';
    }, { passive: true });
}

window.iniciarChatComunidade = function() {
    const box = document.getElementById('chatMensagens');
    if (!box) return;
    chatBindScrollBtn();
    chatAtualizarContador();

    if (_chatUnsub) {
        try { _chatUnsub(); } catch (_) {}
        _chatUnsub = null;
    }

    const col = collection(db, 'chat');
    const q = query(col, orderBy('createdAt', 'desc'), limit(100));
    const limite = Date.now() - CHAT_TTL_MS;

    _chatUnsub = onSnapshot(q, async (snap) => {
        const msgs = [];
        const apagar = [];
        snap.forEach(d => {
            const m = d.data();
            const t = m.createdAt && m.createdAt.toMillis ? m.createdAt.toMillis() : (m.createdAtMs || 0);
            if (t && t < limite) {
                apagar.push(d.id);
                return;
            }
            msgs.push({ id: d.id, ...m, _t: t });
        });
        apagar.slice(0, 15).forEach(id => {
            deleteDoc(doc(db, 'chat', id)).catch(() => {});
        });

        msgs.sort((a, b) => (a._t || 0) - (b._t || 0));

        const sub = document.getElementById('chatTopSub');
        if (sub) sub.textContent = msgs.length
            ? `${msgs.length} msg nas últimas 24h · tempo real`
            : 'Canal ao vivo · msgs expiram em 24h';

        if (!msgs.length) {
            box.innerHTML = `<div class="chat-empty">
                <div class="chat-empty-ring" style="animation:none;border-color:rgba(57,255,20,0.35);"></div>
                <div class="chat-empty-title">Canal silencioso</div>
                <div class="chat-empty-desc">Nenhuma mensagem nas últimas 24h.<br>Seja o primeiro a escrever.</div>
            </div>`;
            return;
        }

        const noFundo = box.scrollHeight - box.scrollTop - box.clientHeight < 100;
        let html = '';
        let ultimoDia = '';
        msgs.forEach(m => {
            const dia = formatChatDia(m.createdAt || m.createdAtMs);
            if (dia && dia !== ultimoDia) {
                html += `<div class="chat-dia">${dia}</div>`;
                ultimoDia = dia;
            }
            const eu = usuarioAtualData && m.uid && m.uid === usuarioAtualData.uid;
            const nick = m.nick || 'Anônimo';
            const inicial = (nick.trim()[0] || '?').toUpperCase();
            const cor = chatCorAvatar(nick);
            html += `<div class="chat-row ${eu ? 'chat-row-eu' : ''}">
                <div class="chat-avatar" style="background:linear-gradient(135deg,${cor},#111)">${escapeHtml(inicial)}</div>
                <div class="chat-msg ${eu ? 'chat-msg-eu' : ''}">
                    <div class="chat-msg-nick">${eu ? 'Você' : escapeHtml(nick)}</div>
                    <div class="chat-msg-texto">${escapeHtml(m.texto || '')}</div>
                    <div class="chat-msg-hora">${formatChatHora(m.createdAt || m.createdAtMs)}</div>
                </div>
            </div>`;
        });
        box.innerHTML = html;
        if (noFundo) box.scrollTop = box.scrollHeight;
    }, (err) => {
        console.warn(err);
        box.innerHTML = `<div class="chat-empty">
            <div class="chat-empty-title" style="color:#ff6b6b;">Falha no canal</div>
            <div class="chat-empty-desc">${escapeHtml(err.message || String(err))}</div>
        </div>`;
    });
};

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

window.enviarChat = async function() {
    const input = document.getElementById('chatInput');
    const err = document.getElementById('chatErro');
    const btn = document.getElementById('chatBtnEnviar');
    if (err) {
        err.textContent = '';
        err.classList.remove('visivel');
    }
    const texto = (input && input.value || '').trim();
    if (!texto) return;
    if (!usuarioAtualData || !usuarioAtualData.uid) {
        if (err) {
            err.textContent = 'Faça login para enviar no canal.';
            err.classList.add('visivel');
        } else alert('Faça login para enviar mensagens.');
        return;
    }
    try {
        if (input) input.disabled = true;
        if (btn) btn.disabled = true;
        await addDoc(collection(db, 'chat'), {
            texto: texto.slice(0, 300),
            nick: usuarioAtualData.nick || 'Leitor',
            uid: usuarioAtualData.uid,
            email: usuarioAtualData.email || '',
            createdAtMs: Date.now(),
            createdAt: new Date()
        });
        input.value = '';
        chatAtualizarContador();
        setTimeout(() => chatIrParaFim(), 180);
    } catch (e) {
        console.error(e);
        if (err) {
            err.textContent = 'Erro ao enviar: ' + (e.message || e);
            err.classList.add('visivel');
        }
    } finally {
        if (input) {
            input.disabled = false;
            input.focus();
        }
        if (btn) btn.disabled = false;
    }
};

/* Teclado mobile: sobe o composer acima do teclado */
let _kbHandler = null;
function iniciarAjusteTecladoChat() {
    pararAjusteTecladoChat();
    const vv = window.visualViewport;
    if (!vv) return;
    _kbHandler = () => {
        if (!document.body.classList.contains('chat-aberto')) return;
        // diferença entre altura layout e viewport visível = teclado
        const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        document.documentElement.style.setProperty('--kb-offset', offset + 'px');
        const box = document.getElementById('chatMensagens');
        if (box && offset > 40) {
            box.scrollTop = box.scrollHeight;
        }
    };
    vv.addEventListener('resize', _kbHandler);
    vv.addEventListener('scroll', _kbHandler);
    _kbHandler();
}
function pararAjusteTecladoChat() {
    const vv = window.visualViewport;
    if (vv && _kbHandler) {
        vv.removeEventListener('resize', _kbHandler);
        vv.removeEventListener('scroll', _kbHandler);
    }
    _kbHandler = null;
    document.documentElement.style.setProperty('--kb-offset', '0px');
}

window.enviarTicketSuporte = async function() {
    const assunto = document.getElementById('ticketAssunto').value.trim();
    const mensagem = document.getElementById('ticketMensagem').value.trim();
    const ok = document.getElementById('ticketMsg');
    const err = document.getElementById('ticketErro');
    ok.style.display = 'none';
    err.style.display = 'none';
    if (!assunto || !mensagem) {
        err.textContent = 'Preencha assunto e mensagem.';
        err.style.display = 'block';
        return;
    }
    try {
        const id = String(Date.now());
        await setDoc(doc(db, 'tickets', id), {
            assunto, mensagem,
            email: usuarioAtualData ? usuarioAtualData.email : 'anônimo',
            nick: usuarioAtualData ? usuarioAtualData.nick : 'Visitante',
            uid: usuarioAtualData ? usuarioAtualData.uid : null,
            data: new Date().toLocaleString('pt-BR'),
            createdAt: Date.now(),
            status: 'aberto'
        });
        ok.textContent = 'Ticket enviado!';
        ok.style.display = 'block';
        document.getElementById('ticketAssunto').value = '';
        document.getElementById('ticketMensagem').value = '';
    } catch (e) {
        err.textContent = 'Erro: ' + (e.message || e);
        err.style.display = 'block';
    }
};

window.admRenderTickets = async function() {
    const box = document.getElementById('admListaTickets');
    if (!box) return;
    box.innerHTML = '<div style="font-size:10px;color:var(--cinza-texto);">Carregando...</div>';
    try {
        const q = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'), limit(50));
        const snap = await getDocs(q);
        if (snap.empty) {
            box.innerHTML = '<div class="conteudo-placeholder">Nenhum ticket.</div>';
            return;
        }
        let html = '';
        snap.forEach(d => {
            const t = d.data();
            html += `<div class="adm-item">
                <div class="adm-item-titulo">${t.assunto}</div>
                <div class="adm-item-meta">${t.nick||''} · ${t.email||''} · ${t.data||''} · ${t.status||''}</div>
                <div style="font-size:10px;color:#ccc;margin-bottom:6px;">${t.mensagem||''}</div>
                <div class="adm-item-acoes">
                    <button onclick="admFecharTicket('${d.id}')">Resolvido</button>
                    <button class="perigo" onclick="admApagarTicket('${d.id}')">Apagar</button>
                </div>
            </div>`;
        });
        box.innerHTML = html;
    } catch (e) {
        box.innerHTML = `<div class="conteudo-placeholder">Erro: ${e.message||''}</div>`;
    }
};

window.admFecharTicket = async function(id) {
    try { await updateDoc(doc(db, 'tickets', id), { status: 'resolvido' }); admRenderTickets(); }
    catch (e) { alert(e.message); }
};
window.admApagarTicket = async function(id) {
    try { await deleteDoc(doc(db, 'tickets', id)); admRenderTickets(); }
    catch (e) { alert(e.message); }
};

window.admRenderUsuarios = async function() {
    const box = document.getElementById('admListaUsuarios');
    if (!box) return;
    box.innerHTML = '<div style="font-size:10px;color:var(--cinza-texto);">Carregando...</div>';
    try {
        const snap = await getDocs(query(collection(db, 'users'), limit(50)));
        const extraAdmins = JSON.parse(localStorage.getItem(CHAVE_ADMINS_EXTRA) || '[]');
        if (snap.empty) {
            box.innerHTML = '<div class="conteudo-placeholder">Nenhum usuário.</div>';
            return;
        }
        let html = '';
        snap.forEach(docSnap => {
            const u = docSnap.data();
            const email = u.email || '';
            const isAdm = u.isAdmin || EMAILS_ADMIN.map(e=>e.toLowerCase()).includes(email.toLowerCase())
                || extraAdmins.map(e=>e.toLowerCase()).includes(email.toLowerCase());
            html += `<div class="adm-item">
                <div class="adm-item-titulo">${u.nick||'Sem nick'}</div>
                <div class="adm-item-meta">${email} · ${u.obrasLidas||0} obras ${isAdm?'· 🛠️ ADM':''}</div>
                <div class="adm-item-acoes">
                    ${isAdm
                        ? `<button class="perigo" onclick="admRemoverAdmin('${docSnap.id}','${email}')">Remover ADM</button>`
                        : `<button onclick="admPromoverAdmin('${docSnap.id}','${email}')">Promover ADM</button>`}
                </div>
            </div>`;
        });
        box.innerHTML = html;
    } catch (e) {
        box.innerHTML = `<div class="conteudo-placeholder">Erro: ${e.message||e}</div>`;
    }
};

window.admPromoverAdmin = async function(uid, email) {
    try {
        await updateDoc(doc(db, 'users', uid), { isAdmin: true });
        const arr = JSON.parse(localStorage.getItem(CHAVE_ADMINS_EXTRA) || '[]');
        if (email && !arr.includes(email)) arr.push(email);
        localStorage.setItem(CHAVE_ADMINS_EXTRA, JSON.stringify(arr));
        atualizarVisibilidadeMenuAdm();
        admRenderUsuarios();
    } catch (e) { alert(e.message); }
};
window.admRemoverAdmin = async function(uid, email) {
    try {
        await updateDoc(doc(db, 'users', uid), { isAdmin: false });
        let arr = JSON.parse(localStorage.getItem(CHAVE_ADMINS_EXTRA) || '[]');
        arr = arr.filter(e => e.toLowerCase() !== String(email).toLowerCase());
        localStorage.setItem(CHAVE_ADMINS_EXTRA, JSON.stringify(arr));
        atualizarVisibilidadeMenuAdm();
        admRenderUsuarios();
    } catch (e) { alert(e.message); }
};

document.addEventListener('DOMContentLoaded', () => {
    atualizarVisibilidadeMenuAdm();
    carregarObrasFirestore().then(() => {
        renderizarContinuarLendo();
        renderizarLancamentos();
    });
    setInterval(atualizarVisibilidadeMenuAdm, 4000);
});


/* =========================================================
   NOTIFICAÇÕES (FCM + avisos em tempo real via Firestore)
   ========================================================= */
const CHAVE_NOTIF_OFF = 'mt_notif_pausado';

async function initMessaging() {
    try {
        const ok = await isSupported();
        if (!ok) {
            atualizarStatusNotif('Neste navegador não há suporte a push.');
            return;
        }
        messaging = getMessaging(app);
        onMessage(messaging, (payload) => {
            const title = (payload.notification && payload.notification.title) || 'Manhwa Toons';
            const body = (payload.notification && payload.notification.body) || '';
            mostrarNotificacaoLocal(title, body);
        });
        escutarAvisosFirestore();
        atualizarStatusNotif();
    } catch (e) {
        console.warn('messaging', e);
        escutarAvisosFirestore();
        atualizarStatusNotif('Push avançado indisponível; avisos in-app ativos.');
    }
}

function atualizarStatusNotif(extra) {
    const el = document.getElementById('notifStatus');
    if (!el) return;
    if (localStorage.getItem(CHAVE_NOTIF_OFF) === '1') {
        el.textContent = 'Status: pausado neste dispositivo' + (extra ? ' · ' + extra : '');
        return;
    }
    if (typeof Notification === 'undefined') {
        el.textContent = 'Status: navegador sem Notification API';
        return;
    }
    el.textContent = 'Status: ' + Notification.permission + (extra ? ' · ' + extra : '');
}

window.ativarNotificacoes = async function() {
    localStorage.removeItem(CHAVE_NOTIF_OFF);
    if (typeof Notification === 'undefined') {
        alert('Seu navegador não suporta notificações.');
        return;
    }
    const perm = await Notification.requestPermission();
    atualizarStatusNotif();
    if (perm !== 'granted') {
        alert('Permissão negada. Ative nas configurações do navegador.');
        return;
    }
    mostrarNotificacaoLocal('Manhwa Toons', 'Notificações ativadas!');
    if (!messaging) {
        try { messaging = getMessaging(app); } catch (_) {}
    }
    if (messaging && FIREBASE_VAPID_KEY) {
        try {
            const reg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
            const token = await getToken(messaging, {
                vapidKey: FIREBASE_VAPID_KEY,
                serviceWorkerRegistration: reg
            });
            if (token && usuarioAtualData && usuarioAtualData.uid) {
                await setDoc(doc(db, 'users', usuarioAtualData.uid), {
                    fcmToken: token,
                    fcmUpdatedAt: Date.now()
                }, { merge: true });
            }
            atualizarStatusNotif('token salvo');
        } catch (e) {
            console.warn('getToken', e);
            atualizarStatusNotif('permisão ok (configure VAPID no código para FCM completo)');
        }
    } else {
        atualizarStatusNotif('ativo (avisos em tempo real)');
        // registra SW mesmo sem VAPID para futuras msgs
        try { await navigator.serviceWorker.register('./firebase-messaging-sw.js'); } catch (_) {}
    }
};

window.desativarNotificacoesLocal = function() {
    localStorage.setItem(CHAVE_NOTIF_OFF, '1');
    atualizarStatusNotif();
    alert('Notificações pausadas neste dispositivo.');
};

function mostrarNotificacaoLocal(titulo, corpo) {
    if (localStorage.getItem(CHAVE_NOTIF_OFF) === '1') return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
        const n = new Notification(titulo, {
            body: corpo,
            icon: 'logo.png',
            badge: 'logo.png'
        });
        n.onclick = () => { window.focus(); n.close(); };
    } catch (e) {
        console.warn(e);
    }
}

let _avisosUnsub = null;
function escutarAvisosFirestore() {
    if (_avisosUnsub) return;
    const col = collection(db, 'avisos');
    const q = query(col, orderBy('createdAt', 'desc'), limit(1));
    let primeiro = true;
    _avisosUnsub = onSnapshot(q, (snap) => {
        if (primeiro) { primeiro = false; return; } // ignora snapshot inicial
        snap.docChanges().forEach(change => {
            if (change.type !== 'added') return;
            const a = change.doc.data();
            mostrarNotificacaoLocal(a.titulo || 'Manhwa Toons', a.texto || '');
            // toast simples se app aberto
            try {
                if (a.titulo) console.log('[AVISO]', a.titulo, a.texto);
            } catch (_) {}
        });
    }, (err) => console.warn('avisos', err));
}

window.admEnviarAviso = async function() {
    const titulo = (document.getElementById('avisoTitulo') || {}).value || '';
    const texto = (document.getElementById('avisoTexto') || {}).value || '';
    const msg = document.getElementById('avisoMsg');
    const err = document.getElementById('avisoErro');
    if (msg) msg.style.display = 'none';
    if (err) err.style.display = 'none';
    if (!titulo.trim() || !texto.trim()) {
        if (err) { err.textContent = 'Preencha título e mensagem.'; err.style.display = 'block'; }
        return;
    }
    try {
        await addDoc(collection(db, 'avisos'), {
            titulo: titulo.trim().slice(0, 80),
            texto: texto.trim().slice(0, 200),
            createdAt: Date.now(),
            por: usuarioAtualData ? usuarioAtualData.nick : 'ADM'
        });
        if (msg) { msg.textContent = 'Aviso enviado! Quem estiver com o app aberto recebe agora.'; msg.style.display = 'block'; }
        document.getElementById('avisoTitulo').value = '';
        document.getElementById('avisoTexto').value = '';
        // mostra também no próprio ADM
        mostrarNotificacaoLocal(titulo.trim(), texto.trim());
    } catch (e) {
        if (err) { err.textContent = 'Erro: ' + (e.message || e); err.style.display = 'block'; }
    }
};

// inicia messaging após load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initMessaging, 1200);
});
