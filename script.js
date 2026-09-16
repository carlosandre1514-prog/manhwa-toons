import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

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
    where
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
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

let usuarioAtualData = null;


/* =========================================================
   BANCO DE DADOS DE OBRAS PARA PESQUISA
   ========================================================= */

const listaObrasCompleta = [
    {
        titulo: "Solo Leveling",
        views: "3.9M"
    },
    {
        titulo: "Solo Leveling: Ragnarok",
        views: "4.5M"
    },
    {
        titulo: "Solo Max-Level Newbie",
        views: "2.3M"
    },
    {
        titulo: "Omniscient Reader's Viewpoint",
        views: "3.5M"
    },
    {
        titulo: "Tower of God",
        views: "4.2M"
    },
    {
        titulo: "Nano Machine",
        views: "3.1M"
    },
    {
        titulo: "The Beginning After The End",
        views: "2.8M"
    },
    {
        titulo: "Ranker Who Lives A Second Time",
        views: "2.4M"
    },
    {
        titulo: "The Great Mage Returns After 4000 Years",
        views: "1.7M"
    },
    {
        titulo: "Mercenary Enrollment",
        views: "1.5M"
    }
];


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


window.mudarTela = function(idTela) {

    // Painel ADM é restrito
    if (idTela === 'adm' && !isAdminUser()) {
        alert('Acesso restrito ao Painel ADM.');
        return;
    }

    const views = document.querySelectorAll('.view');

    views.forEach(v => {
        v.classList.remove('ativo');
    });

    const telaSelecionada =
        document.getElementById('view-' + idTela);

    if (telaSelecionada) {
        telaSelecionada.classList.add('ativo');
    }

    toggleMenu();

    window.scrollTo(0, 0);

    // Ações específicas de cada tela
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

            obrasLidas: 1,

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

                obrasLidas: 1,

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

                obrasLidas: 1,

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

        alert(
            "Erro ao logar com Google: " +
            error.message
        );
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
                limit(10)
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

        let posicao = 1;


        querySnapshot.forEach(
            (docSnap) => {

                const data =
                    docSnap.data();


                const card =
                    document.createElement(
                        'div'
                    );


                card.className =
                    'ranking-card';


                let avatarHTML =
                    data.avatar
                        ? `<img src="${data.avatar}">`
                        : '👤';


                card.innerHTML = `

                    <div class="ranking-posicao">
                        ${posicao}º
                    </div>

                    <div class="ranking-avatar">
                        ${avatarHTML}
                    </div>

                    <div
                        class="ranking-nick"
                        title="${data.nick}"
                    >
                        ${data.nick}
                    </div>

                    <div class="ranking-obras">
                        ${data.obrasLidas} obras
                    </div>
                `;


                container.appendChild(
                    card
                );


                posicao++;
            }
        );

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

                    obrasLidas: 1,

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

const dadosObras = {
    "Solo Leveling": {
        titulo: "Solo Leveling",
        status: "Concluído",
        views: "5.8M",
        generos: ["Ação", "Fantasia", "Aventura", "Sobrenatural"],
        sinopse: "Há 10 anos, um portal conectando o mundo real a uma dimensão repleta de monstros se abriu. Desde então, alguns humanos despertaram poderes e passaram a ser conhecidos como Caçadores. Sung Jin-Woo, um caçador de ranking E (o mais baixo), é conhecido como o mais fraco da humanidade. Após um incidente quase fatal em uma dungeon, ele começa a subir de nível de forma única e se torna o caçador mais poderoso do mundo.",
        capitulos: [
            { num: 179, titulo: "O Fim de uma Era", data: "Concluído", novo: false, lido: true },
            { num: 178, titulo: "O Monarca das Sombras", data: "Concluído", novo: false, lido: true },
            { num: 177, titulo: "Batalha Final", data: "Concluído", novo: false, lido: false },
            { num: 176, titulo: "O Último Portal", data: "Concluído", novo: false, lido: false },
            { num: 175, titulo: "Reencontro", data: "Concluído", novo: false, lido: false },
            { num: 174, titulo: "Poder Absoluto", data: "Concluído", novo: false, lido: false },
            { num: 173, titulo: "A Verdade Revelada", data: "Concluído", novo: false, lido: false },
            { num: 172, titulo: "O Sistema", data: "Concluído", novo: false, lido: false }
        ]
    },
    "Solo Leveling: Ragnarok": {
        titulo: "Solo Leveling: Ragnarok",
        status: "Ativo",
        views: "4.5M",
        generos: ["Ação", "Fantasia", "Aventura"],
        sinopse: "Após os eventos de Solo Leveling, o mundo enfrenta uma nova ameaça. Sung Suho, filho de Jin-Woo, herda o poder do Monarca das Sombras e precisa proteger a Terra de uma nova onda de portais e monstros em uma era pós-apocalíptica.",
        capitulos: [
            { num: 45, titulo: "O Novo Monarca", data: "Hoje", novo: true, lido: false },
            { num: 44, titulo: "Sombra do Passado", data: "Ontem", novo: true, lido: false },
            { num: 43, titulo: "Primeiro Portal", data: "2d", novo: false, lido: false },
            { num: 42, titulo: "Despertar", data: "3d", novo: false, lido: false },
            { num: 41, titulo: "Herança", data: "4d", novo: false, lido: false },
            { num: 40, titulo: "O Filho do Caçador", data: "5d", novo: false, lido: false }
        ]
    },
    "Omniscient Reader": {
        titulo: "Omniscient Reader's Viewpoint",
        status: "Ativo",
        views: "4.9M",
        generos: ["Ação", "Fantasia", "Drama", "Apocalipse"],
        sinopse: "Kim Dokja é o único leitor de uma webnovel obscura chamada 'Três Maneiras de Sobreviver em um Mundo Arruinado'. Quando o mundo real se transforma na história da novel, Dokja se torna o único que conhece o final. Com seu conhecimento, ele tenta sobreviver e mudar o destino de todos.",
        capitulos: [
            { num: 215, titulo: "O Leitor Onisciente", data: "Hoje", novo: true, lido: false },
            { num: 214, titulo: "Cenário 50", data: "Ontem", novo: true, lido: false },
            { num: 213, titulo: "Companheiros", data: "2d", novo: false, lido: false },
            { num: 212, titulo: "O Fim do Mundo", data: "3d", novo: false, lido: false },
            { num: 211, titulo: "Estrela da História", data: "4d", novo: false, lido: false }
        ]
    },
    "Omniscient Reader's Viewpoint": {
        titulo: "Omniscient Reader's Viewpoint",
        status: "Ativo",
        views: "4.9M",
        generos: ["Ação", "Fantasia", "Drama", "Apocalipse"],
        sinopse: "Kim Dokja é o único leitor de uma webnovel obscura chamada 'Três Maneiras de Sobreviver em um Mundo Arruinado'. Quando o mundo real se transforma na história da novel, Dokja se torna o único que conhece o final. Com seu conhecimento, ele tenta sobreviver e mudar o destino de todos.",
        capitulos: [
            { num: 215, titulo: "O Leitor Onisciente", data: "Hoje", novo: true, lido: false },
            { num: 214, titulo: "Cenário 50", data: "Ontem", novo: true, lido: false },
            { num: 213, titulo: "Companheiros", data: "2d", novo: false, lido: false },
            { num: 212, titulo: "O Fim do Mundo", data: "3d", novo: false, lido: false }
        ]
    },
    "Tower of God": {
        titulo: "Tower of God",
        status: "Ativo",
        views: "4.2M",
        generos: ["Ação", "Aventura", "Fantasia", "Mistério"],
        sinopse: "A Torre de Deus é um lugar misterioso onde quem chega ao topo tem todos os desejos concedidos. Bam, um menino que viveu sua vida na escuridão, entra na Torre para encontrar sua amiga Rachel. Dentro da Torre, ele enfrenta testes mortais e descobre segredos sobre sua própria existência.",
        capitulos: [
            { num: 590, titulo: "O Rei da Torre", data: "Hoje", novo: true, lido: false },
            { num: 589, titulo: "Batalha no Andar 50", data: "Ontem", novo: false, lido: false },
            { num: 588, titulo: "Revelações", data: "2d", novo: false, lido: false },
            { num: 587, titulo: "O Irregular", data: "3d", novo: false, lido: false },
            { num: 586, titulo: "Companheiros de Equipe", data: "4d", novo: false, lido: false }
        ]
    },
    "Nano Machine": {
        titulo: "Nano Machine",
        status: "Ativo",
        views: "3.7M",
        generos: ["Ação", "Artes Marciais", "Fantasia", "Reencarnação"],
        sinopse: "Cheon Yeo-woon é um membro desprezado do clã Cheon. Após ser traído e morto, ele reencarna no passado com uma nanomáquina avançada em seu corpo. Agora, com o poder da tecnologia do futuro, ele busca vingança e se torna o líder mais poderoso do mundo marcial.",
        capitulos: [
            { num: 210, titulo: "O Senhor do Clã", data: "Hoje", novo: true, lido: false },
            { num: 209, titulo: "Nanomáquina Ativada", data: "Ontem", novo: true, lido: false },
            { num: 208, titulo: "Vingança", data: "2d", novo: false, lido: false },
            { num: 207, titulo: "Treinamento Secreto", data: "3d", novo: false, lido: false },
            { num: 206, titulo: "O Traidor", data: "4d", novo: false, lido: false }
        ]
    },
    "The Beginning After The End": {
        titulo: "The Beginning After The End",
        status: "Ativo",
        views: "2.8M",
        generos: ["Ação", "Fantasia", "Aventura", "Reencarnação"],
        sinopse: "Rei Grey, o monarca mais poderoso do continente, é assassinado e reencarna em um novo mundo como Arthur Leywin. Com as memórias de sua vida anterior, ele busca uma vida diferente, mas o destino o puxa novamente para o centro de conflitos épicos e guerras entre raças.",
        capitulos: [
            { num: 185, titulo: "O Novo Rei", data: "Hoje", novo: true, lido: false },
            { num: 184, titulo: "Treinamento no Continente", data: "Ontem", novo: false, lido: false },
            { num: 183, titulo: "Ameaças Antigas", data: "2d", novo: false, lido: false },
            { num: 182, titulo: "Poder Despertado", data: "3d", novo: false, lido: false }
        ]
    },
    "Mercenary Enrollment": {
        titulo: "Mercenary Enrollment",
        status: "Ativo",
        views: "1.5M",
        generos: ["Ação", "Escolar", "Drama", "Comédia"],
        sinopse: "Ijin Yu cresceu em um campo de batalha como mercenário desde criança. Após ser resgatado e adotado, ele tenta viver uma vida normal no ensino médio. Porém, seu passado e suas habilidades mortais continuam o perseguindo, enquanto ele protege sua nova família e amigos.",
        capitulos: [
            { num: 180, titulo: "Vida Escolar", data: "Hoje", novo: true, lido: false },
            { num: 179, titulo: "Ameaça Antiga", data: "Ontem", novo: false, lido: false },
            { num: 178, titulo: "Proteção", data: "2d", novo: false, lido: false },
            { num: 177, titulo: "O Passado Retorna", data: "3d", novo: false, lido: false }
        ]
    },
    "Ranker Who Lives A Second Time": {
        titulo: "Ranker Who Lives A Second Time",
        status: "Ativo",
        views: "2.4M",
        generos: ["Ação", "Fantasia", "Aventura", "Reencarnação"],
        sinopse: "Yeon-woo, após descobrir a morte do irmão gêmeo dentro da Torre de Obelisco, decide subir a Torre para descobrir a verdade e se vingar. Com o diário do irmão em mãos, ele recomeça a jornada com conhecimento privilegiado e se torna um Ranker lendário.",
        capitulos: [
            { num: 195, titulo: "O Ranker", data: "Hoje", novo: true, lido: false },
            { num: 194, titulo: "Vingança", data: "Ontem", novo: false, lido: false },
            { num: 193, titulo: "Segredos da Torre", data: "2d", novo: false, lido: false },
            { num: 192, titulo: "O Diário", data: "3d", novo: false, lido: false }
        ]
    }
};

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

        // Capa grande
        const capaEl = document.getElementById('obraCapaGrande');
        if (capaEl) {
            capaEl.innerHTML = htmlCapa(nomeObra);
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

        // Muda para a tela da obra
        const views = document.querySelectorAll('.view');
        views.forEach(v => v.classList.remove('ativo'));
        document.getElementById('view-obra').classList.add('ativo');
        window.scrollTo(0, 0);
    });
};

window.voltarParaInicio = function() {
    const views = document.querySelectorAll('.view');
    views.forEach(v => v.classList.remove('ativo'));
    document.getElementById('view-inicio').classList.add('ativo');
    window.scrollTo(0, 0);
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

    // Também os botões do carrossel "Começar a ler" e "Ver descrição"
    document.querySelectorAll('.btn-ler, .btn-desc').forEach(btn => {
        const originalOnclick = btn.getAttribute('onclick');
        if (originalOnclick && originalOnclick.includes('Solo Leveling: Ragnarok')) {
            btn.setAttribute('onclick', "abrirObra('Solo Leveling: Ragnarok')");
        } else if (originalOnclick && originalOnclick.includes('Omniscient Reader')) {
            btn.setAttribute('onclick', "abrirObra('Omniscient Reader')");
        } else if (originalOnclick && originalOnclick.includes('Tower of God')) {
            btn.setAttribute('onclick', "abrirObra('Tower of God')");
        } else if (originalOnclick && originalOnclick.includes('Nano Machine')) {
            btn.setAttribute('onclick', "abrirObra('Nano Machine')");
        } else if (originalOnclick && originalOnclick.includes('The Beginning After The End')) {
            btn.setAttribute('onclick', "abrirObra('The Beginning After The End')");
        } else if (originalOnclick && originalOnclick.includes('Mercenary Enrollment')) {
            btn.setAttribute('onclick', "abrirObra('Mercenary Enrollment')");
        } else if (originalOnclick && originalOnclick.includes('Ranker Who Lives A Second Time')) {
            btn.setAttribute('onclick', "abrirObra('Ranker Who Lives A Second Time')");
        }
    });
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

function urlCapa(titulo) {
    // Tenta: capas/solo-leveling.png
    return `capas/${slugify(titulo)}.png`;
}

function htmlCapa(titulo, classeExtra = '') {
    // Se a obra foi cadastrada no Painel ADM com capa, usa ela
    const obra = (typeof dadosObras !== 'undefined' && (dadosObras[titulo] || Object.values(dadosObras).find(o => o && o.titulo === titulo)));
    if (obra && obra.capaData) {
        return `<img src="${obra.capaData}" alt="${titulo}" class="${classeExtra}">`;
    }
    // img real em capas/slug.png com onerror → logo-capa.png
    return `<img src="${urlCapa(titulo)}" alt="${titulo}" class="${classeExtra}" onerror="this.onerror=null; this.src='logo-capa.png'; this.classList.add('capa-fallback');">`;
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
    const obra = dadosObras[titulo] || Object.values(dadosObras).find(o => o.titulo === titulo);
    const total = obra && obra.capitulos ? obra.capitulos.length : 0;
    const hist = carregarHistorico()[titulo];
    const lidos = hist ? hist.capitulosLidos.length : 0;
    const ultimo = hist ? hist.ultimo : null;
    return { total, lidos, ultimo, pct: total ? Math.round((lidos / total) * 100) : 0 };
}


/* =========================================================
   CONTINUAR LENDO (home)
   ========================================================= */

window.renderizarContinuarLendo = function() {
    const secao = document.getElementById('secaoContinuarLendo');
    const scroll = document.getElementById('continuarLendoScroll');
    if (!secao || !scroll) return;

    const hist = carregarHistorico();
    const itens = Object.entries(hist)
        .filter(([, v]) => v.ultimo != null)
        .sort((a, b) => (b[1].atualizado || 0) - (a[1].atualizado || 0))
        .slice(0, 10);

    if (itens.length === 0) {
        secao.style.display = 'none';
        return;
    }

    secao.style.display = 'block';
    scroll.innerHTML = '';

    itens.forEach(([titulo, info]) => {
        const obra = dadosObras[titulo] || Object.values(dadosObras).find(o => o.titulo === titulo);
        const card = document.createElement('div');
        card.className = 'manhwa-card';
        card.onclick = () => {
            mostrarLoading(() => {
                abrirObra(titulo);
                // opcional: já abrir o último capítulo
            });
        };
        const prog = getProgresso(titulo);
        card.innerHTML = `
            <div class="manhwa-capa">${htmlCapa(titulo)}</div>
            <div class="manhwa-info">
                <div class="manhwa-titulo">${titulo}</div>
                <div class="ultimos-caps">
                    <div class="cap-linha">
                        <span class="cap-numero">Cap. ${info.ultimo}</span>
                        <span class="cap-data">${prog.pct}%</span>
                    </div>
                </div>
                <div class="progresso-barra-wrap">
                    <div class="progresso-barra" style="width:${prog.pct}%"></div>
                </div>
            </div>
        `;
        scroll.appendChild(card);
    });
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

        const views = document.querySelectorAll('.view');
        views.forEach(v => v.classList.remove('ativo'));
        document.getElementById('view-leitor').classList.add('ativo');
        window.scrollTo(0, 0);
    });
};

window.fecharLeitor = function() {
    if (leitorEstado.titulo) {
        mostrarLoading(() => abrirObra(leitorEstado.titulo), 800);
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
    const prog = getProgresso(obra.titulo);
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
            ${prog.total ? `<div class="progresso-barra-wrap"><div class="progresso-barra" style="width:${prog.pct}%"></div></div>` : ''}
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


/* =========================================================
   PAINEL ADM + SUPORTE — FIREBASE (Firestore + Storage)
   =========================================================
   Estrutura:
     Firestore: obras/{slug}
     Storage:   caps/{slug}/capa.jpg
                caps/{slug}/{numCap}/01.jpg, 02.jpg...
     Firestore: tickets/{id}
     users:     campo isAdmin (opcional)
*/

const EMAILS_ADMIN = [
    // Quando quiser restringir, coloque seu e-mail:
    // 'seu-email@gmail.com'
];

const CHAVE_ADMINS_EXTRA = 'manhwaToons_admins_extra';

function isAdminUser() {
    if (!EMAILS_ADMIN.length) return true; // modo dev: todos veem
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

/* ---------- Carregar obras do Firestore e mesclar ---------- */
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
                    capaData: data.capaURL || null, // reutiliza no htmlCapa
                    _firebaseSlug: docSnap.id // marca que essa obra existe de verdade no Firestore (pode ser apagada)
                };
            }
        });
        console.log('[ADM] Obras carregadas do Firestore:', snap.size);
    } catch (e) {
        console.warn('[ADM] Erro ao carregar obras:', e.message);
    }
}

/* ---------- Abas ---------- */
window.admTab = function(nome) {
    document.querySelectorAll('.adm-tab').forEach(t => t.classList.remove('ativo'));
    document.querySelectorAll('.adm-panel').forEach(p => p.classList.remove('ativo'));
    const btn = document.querySelector(`.adm-tab[onclick="admTab('${nome}')"]`);
    const panel = document.getElementById('admTab-' + nome);
    if (btn) btn.classList.add('ativo');
    if (panel) panel.classList.add('ativo');
    if (nome === 'obras') admRenderListaObras();
    if (nome === 'capitulos') admPopularSelectObras();
    if (nome === 'tickets') admRenderTickets();
    if (nome === 'usuarios') admRenderUsuarios();
};

function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

async function uploadArquivoStorage(caminho, file) {
    const storageRef = ref(storage, caminho);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
}

/* ---------- Salvar obra (Firestore + capa no Storage) ---------- */
window.admSalvarObra = async function() {
    const titulo = document.getElementById('admObraTitulo').value.trim();
    const status = document.getElementById('admObraStatus').value;
    const generosStr = document.getElementById('admObraGeneros').value.trim();
    const sinopse = document.getElementById('admObraSinopse').value.trim();
    const capaInput = document.getElementById('admObraCapa');
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
        msg.textContent = 'Salvando no Firebase...';
        msg.style.display = 'block';

        // capa
        let capaURL = null;
        if (capaInput.files && capaInput.files[0]) {
            const ext = (capaInput.files[0].name.split('.').pop() || 'jpg').toLowerCase();
            capaURL = await uploadArquivoStorage(`caps/${slug}/capa.${ext}`, capaInput.files[0]);
        } else if (dadosObras[titulo] && dadosObras[titulo].capaURL) {
            capaURL = dadosObras[titulo].capaURL;
        }

        // capítulos já existentes (se editar)
        let capitulos = [];
        if (dadosObras[titulo] && Array.isArray(dadosObras[titulo].capitulos)) {
            capitulos = dadosObras[titulo].capitulos;
        }

        const obraData = {
            titulo,
            slug,
            status,
            generos: generos.length ? generos : ['Outros'],
            sinopse,
            views: (dadosObras[titulo] && dadosObras[titulo].views) || '0',
            capaURL: capaURL || null,
            capitulos,
            atualizadoEm: Date.now()
        };

        await setDoc(doc(db, 'obras', slug), obraData, { merge: true });

        // atualiza memória local
        dadosObras[titulo] = {
            ...obraData,
            capaData: capaURL,
            _firebaseSlug: slug
        };

        msg.textContent = 'Obra salva no Firebase com sucesso!';
        document.getElementById('admObraTitulo').value = '';
        document.getElementById('admObraSinopse').value = '';
        document.getElementById('admObraGeneros').value = '';
        capaInput.value = '';
        admRenderListaObras();
        admPopularSelectObras();
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
            box.innerHTML = '<div class="conteudo-placeholder">Nenhuma obra no Firebase ainda.</div>';
            return;
        }
        box.innerHTML = todas.map(o => {
            const tituloEscapado = String(o.titulo).replace(/'/g, "\\'");
            const btnExcluir = o._firebaseSlug
                ? `<button class="perigo" onclick="admApagarObra('${o._firebaseSlug}', '${tituloEscapado}')">Excluir</button>`
                : `<span style="font-size:9px;color:var(--cinza-texto);" title="Obra de exemplo fixa no código — não vem do Firebase">exemplo</span>`;
            return `
            <div class="adm-item">
                <div class="adm-item-titulo">${o.titulo}</div>
                <div class="adm-item-meta">${o.status} · ${o.views} · ${(o.generos||[]).join(', ')}</div>
                <div class="adm-item-acoes">
                    <button onclick="abrirObra('${tituloEscapado}')">Ver</button>
                    ${btnExcluir}
                </div>
            </div>
        `;
        }).join('');
    } catch (e) {
        box.innerHTML = `<div class="conteudo-placeholder">Erro: ${e.message}</div>`;
    }
};

/* ---------- Apagar obra (Firestore + memória local) ---------- */
window.admApagarObra = async function(slug, titulo) {
    if (!confirm(`Excluir "${titulo}" definitivamente? Isso apaga a obra e a lista de capítulos do Firebase (as imagens enviadas ao Storage não são apagadas automaticamente).`)) {
        return;
    }
    try {
        await deleteDoc(doc(db, 'obras', slug));
        delete dadosObras[titulo];
        admRenderListaObras();
        admPopularSelectObras();
        renderizarContinuarLendo();
    } catch (e) {
        alert('Erro ao excluir: ' + (e.message || e));
    }
};

/* ---------- Capítulos ---------- */
window.admPopularSelectObras = function() {
    const sel = document.getElementById('admCapObra');
    if (!sel) return;
    const obras = obterTodasObras();
    sel.innerHTML = obras.map(o => `<option value="${o.titulo}">${o.titulo}</option>`).join('')
        || '<option value="">Nenhuma obra — cadastre uma primeiro</option>';
};

document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'admCapPaginas') {
        const n = e.target.files ? e.target.files.length : 0;
        const prev = document.getElementById('admCapPreview');
        if (prev) prev.textContent = n ? `${n} imagem(ns) selecionada(s)` : '';
    }
});

window.admSalvarCapitulo = async function() {
    const titulo = document.getElementById('admCapObra').value;
    const num = parseInt(document.getElementById('admCapNumero').value, 10);
    const capTitulo = document.getElementById('admCapTitulo').value.trim() || `Capítulo ${num}`;
    const files = document.getElementById('admCapPaginas').files;
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
        msg.textContent = 'Enviando imagens para o Firebase...';
        msg.style.display = 'block';

        const paginasURLs = [];
        if (files && files.length) {
            // ordena por nome do arquivo
            const lista = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
            for (let i = 0; i < lista.length; i++) {
                const pag = String(i + 1).padStart(2, '0');
                const ext = (lista[i].name.split('.').pop() || 'jpg').toLowerCase();
                const url = await uploadArquivoStorage(`caps/${slug}/${num}/${pag}.${ext}`, lista[i]);
                paginasURLs.push(url);
                msg.textContent = `Enviando... ${i + 1}/${lista.length}`;
            }
        }

        // lê obra atual do Firestore
        const refObra = doc(db, 'obras', slug);
        const snap = await getDoc(refObra);
        let obraData = snap.exists() ? snap.data() : (dadosObras[titulo] ? { ...dadosObras[titulo], slug } : null);
        if (!obraData) {
            err.textContent = 'Obra não encontrada no Firebase. Cadastre a obra antes.';
            err.style.display = 'block';
            msg.style.display = 'none';
            return;
        }

        if (!Array.isArray(obraData.capitulos)) obraData.capitulos = [];
        const entry = {
            num,
            titulo: capTitulo,
            data: 'Hoje',
            novo: true,
            paginasURLs: paginasURLs.length ? paginasURLs : (obraData.capitulos.find(c => c.num === num) || {}).paginasURLs || []
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
            capaURL: obraData.capaURL || null,
            capaData: obraData.capaURL || null
        };

        msg.textContent = `Capítulo ${num} salvo no Firebase${paginasURLs.length ? ` com ${paginasURLs.length} página(s)` : ''}!`;
        document.getElementById('admCapNumero').value = '';
        document.getElementById('admCapTitulo').value = '';
        document.getElementById('admCapPaginas').value = '';
        document.getElementById('admCapPreview').textContent = '';
    } catch (e) {
        console.error(e);
        err.textContent = 'Erro ao salvar capítulo: ' + (e.message || e);
        err.style.display = 'block';
        msg.style.display = 'none';
    }
};

/* ---------- Tickets (Firestore) ---------- */
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
            assunto,
            mensagem,
            email: usuarioAtualData ? usuarioAtualData.email : 'anônimo',
            nick: usuarioAtualData ? usuarioAtualData.nick : 'Visitante',
            uid: usuarioAtualData ? usuarioAtualData.uid : null,
            data: new Date().toLocaleString('pt-BR'),
            createdAt: Date.now(),
            status: 'aberto'
        });
        ok.textContent = 'Ticket enviado com sucesso!';
        ok.style.display = 'block';
        document.getElementById('ticketAssunto').value = '';
        document.getElementById('ticketMensagem').value = '';
    } catch (e) {
        err.textContent = 'Erro ao enviar: ' + (e.message || e);
        err.style.display = 'block';
    }
};

window.admRenderTickets = async function() {
    const box = document.getElementById('admListaTickets');
    if (!box) return;
    box.innerHTML = '<div style="font-size:10px;color:var(--cinza-texto);">Carregando tickets...</div>';
    try {
        const q = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'), limit(50));
        const snap = await getDocs(q);
        if (snap.empty) {
            box.innerHTML = '<div class="conteudo-placeholder">Nenhum ticket ainda.</div>';
            return;
        }
        let html = '';
        snap.forEach(d => {
            const t = d.data();
            html += `
                <div class="adm-item">
                    <div class="adm-item-titulo">${t.assunto}</div>
                    <div class="adm-item-meta">${t.nick || ''} · ${t.email || ''} · ${t.data || ''} · ${t.status || ''}</div>
                    <div style="font-size:10px;color:#ccc;margin-bottom:6px;">${t.mensagem || ''}</div>
                    <div class="adm-item-acoes">
                        <button onclick="admFecharTicket('${d.id}')">Marcar resolvido</button>
                        <button class="perigo" onclick="admApagarTicket('${d.id}')">Apagar</button>
                    </div>
                </div>`;
        });
        box.innerHTML = html;
    } catch (e) {
        box.innerHTML = `<div class="conteudo-placeholder">Erro ao carregar tickets. Crie o índice no Firebase se pedido.<br>${e.message || ''}</div>`;
    }
};

window.admFecharTicket = async function(id) {
    try {
        await updateDoc(doc(db, 'tickets', id), { status: 'resolvido' });
        admRenderTickets();
    } catch (e) {
        alert('Erro: ' + e.message);
    }
};

window.admApagarTicket = async function(id) {
    try {
        await deleteDoc(doc(db, 'tickets', id));
        admRenderTickets();
    } catch (e) {
        alert('Erro: ' + e.message);
    }
};

/* ---------- Usuários ---------- */
window.admRenderUsuarios = async function() {
    const box = document.getElementById('admListaUsuarios');
    if (!box) return;
    box.innerHTML = '<div style="font-size:10px;color:var(--cinza-texto);">Carregando usuários...</div>';
    try {
        const q = query(collection(db, 'users'), limit(50));
        const snap = await getDocs(q);
        const extraAdmins = JSON.parse(localStorage.getItem(CHAVE_ADMINS_EXTRA) || '[]');
        if (snap.empty) {
            box.innerHTML = '<div class="conteudo-placeholder">Nenhum usuário no Firebase ainda.</div>';
            return;
        }
        let html = '';
        snap.forEach(docSnap => {
            const u = docSnap.data();
            const email = u.email || '';
            const isAdm = u.isAdmin
                || EMAILS_ADMIN.map(e => e.toLowerCase()).includes(email.toLowerCase())
                || extraAdmins.map(e => e.toLowerCase()).includes(email.toLowerCase());
            html += `
                <div class="adm-item">
                    <div class="adm-item-titulo">${u.nick || 'Sem nick'}</div>
                    <div class="adm-item-meta">${email} · obras: ${u.obrasLidas || 0} ${isAdm ? '· 🛠️ ADM' : ''}</div>
                    <div class="adm-item-acoes">
                        ${isAdm
                            ? `<button class="perigo" onclick="admRemoverAdmin('${docSnap.id}', '${email}')">Remover ADM</button>`
                            : `<button onclick="admPromoverAdmin('${docSnap.id}', '${email}')">Promover a ADM</button>`
                        }
                    </div>
                </div>`;
        });
        box.innerHTML = html;
    } catch (e) {
        box.innerHTML = `<div class="conteudo-placeholder">Erro: ${e.message || e}</div>`;
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
    } catch (e) {
        alert('Erro ao promover: ' + e.message);
    }
};

window.admRemoverAdmin = async function(uid, email) {
    try {
        await updateDoc(doc(db, 'users', uid), { isAdmin: false });
        let arr = JSON.parse(localStorage.getItem(CHAVE_ADMINS_EXTRA) || '[]');
        arr = arr.filter(e => e.toLowerCase() !== String(email).toLowerCase());
        localStorage.setItem(CHAVE_ADMINS_EXTRA, JSON.stringify(arr));
        atualizarVisibilidadeMenuAdm();
        admRenderUsuarios();
    } catch (e) {
        alert('Erro: ' + e.message);
    }
};

/* ---------- Hooks ---------- */
document.addEventListener('DOMContentLoaded', () => {
    atualizarVisibilidadeMenuAdm();
    carregarObrasFirestore().then(() => {
        renderizarContinuarLendo();
    });
    setInterval(atualizarVisibilidadeMenuAdm, 4000);
});
