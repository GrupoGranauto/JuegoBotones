const socket = io();

// Elementos del DOM
const screens = {
    login: document.getElementById('loginScreen'),
    waiting: document.getElementById('waitingScreen'),
    spectator: document.getElementById('spectatorScreen'),
    game: document.getElementById('gameScreen'),
    result: document.getElementById('resultScreen')
};

// Formularios e inputs
const joinForm = document.getElementById('joinForm');
const nameInput = document.getElementById('nameInput');
const teamSelect = document.getElementById('teamSelect');
const loginError = document.getElementById('loginError');
const spectatorBtn = document.getElementById('spectatorBtn');
const leaveSpectatorBtn = document.getElementById('leaveSpectatorBtn');

const globalScoreboard = document.getElementById('globalScoreboard');
const score1 = document.getElementById('score1');
const score2 = document.getElementById('score2');
const score3 = document.getElementById('score3');

// Sala de espera
const participantCount = document.getElementById('participantCount');
const participantsList = document.getElementById('participantsList');

// Juego
const gameButton = document.getElementById('gameButton');

// Resultados
const firstPlace = document.getElementById('firstPlace');
const otherPlaces = document.getElementById('otherPlaces');
const winnerName = document.getElementById('winnerName');
const winnerTeam = document.getElementById('winnerTeam');
const winnerTime = document.getElementById('winnerTime');
const adminControls = document.getElementById('adminControls');
const nextRoundBtn = document.getElementById('nextRoundBtn');
const leaveBtn = document.getElementById('leaveBtn');
const leaveWaitingBtn = document.getElementById('leaveWaitingBtn');

// Toast
const toast = document.getElementById('toast');
let toastTimeout;

// Estado global local
let myId = null;
let soyParticipante = false;
let isSpectator = false;

// Funciones de UI
const showScreen = (screenName) => {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
    
    if (screenName === 'login') {
        globalScoreboard.classList.add('hidden');
    } else {
        globalScoreboard.classList.remove('hidden');
    }
};

const showToast = (message, duration = 3000) => {
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, duration);
};

const formatTime = (isoString) => {
    const date = new Date(isoString);
    const pad = (num, len = 2) => String(num).padStart(len, '0');
    
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    const ms = pad(date.getMilliseconds(), 3);

    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}.${ms}`;
};

// Eventos de usuario
joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const equipo = teamSelect.value;
    if (name && equipo) {
        isSpectator = false;
        socket.emit('unirse', { nombre: name, equipo });
    } else {
        loginError.textContent = "Debes ingresar tu nombre y seleccionar un equipo.";
        loginError.classList.remove('hidden');
    }
});

spectatorBtn.addEventListener('click', () => {
    loginError.classList.add('hidden');
    socket.emit('unirseAdmin');
});

socket.on('adminAceptado', () => {
    isSpectator = true;
    soyParticipante = false;
    document.body.classList.add('admin-mode');
    showScreen('waiting');
});

leaveSpectatorBtn.addEventListener('click', () => {
    isSpectator = false;
    showScreen('login');
});

gameButton.addEventListener('click', () => {
    socket.emit('presionarBoton');
    gameButton.disabled = true;
    gameButton.textContent = '¡Registrado!';
    gameButton.style.fontSize = '1.8rem';
});

nextRoundBtn.addEventListener('click', () => {
    socket.emit('siguienteRonda');
});

leaveBtn.addEventListener('click', () => {
    socket.emit('salir');
    if (isSpectator) {
        isSpectator = false;
        document.body.classList.remove('admin-mode');
        const wrapper = document.getElementById('adminImageWrapper');
        const btn = document.getElementById('toggleAdminImgBtn');
        if (wrapper) wrapper.classList.add('hidden');
        if (btn) btn.innerHTML = '<span>🖼️</span> Mostrar Imagen';
        showScreen('login');
    }
});

leaveWaitingBtn.addEventListener('click', () => {
    socket.emit('salir');
    if (isSpectator) {
        isSpectator = false;
        document.body.classList.remove('admin-mode');
        const wrapper = document.getElementById('adminImageWrapper');
        const btn = document.getElementById('toggleAdminImgBtn');
        if (wrapper) wrapper.classList.add('hidden');
        if (btn) btn.innerHTML = '<span>🖼️</span> Mostrar Imagen';
        showScreen('login');
    }
});

// Eventos de Socket.IO
socket.on('error', (msg) => {
    loginError.textContent = msg;
    loginError.classList.remove('hidden');
    isSpectator = false;
});

socket.on('rondaLlena', (msg) => {
    showToast(msg, 5000);
});

socket.on('actualizarParticipantes', ({ participantes, maxParticipantes }) => {
    soyParticipante = participantes.some(p => p.id === socket.id);
    
    // Si estábamos en login, pasamos a espera (si nos unimos exitosamente)
    if (screens.login.classList.contains('active') && soyParticipante) {
        showScreen('waiting');
    }

    // Si alguien salió y quedamos menos de 3, volver a la sala de espera
    if (participantes.length < maxParticipantes && (soyParticipante || isSpectator) && !screens.waiting.classList.contains('active')) {
        showScreen('waiting');
        if (soyParticipante) showToast("Un jugador ha salido. Esperando...");
    }

    // Actualizar UI
    participantCount.textContent = `${participantes.length}/${maxParticipantes}`;
    
    participantsList.innerHTML = '';
    participantes.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.nombre} (Eq. ${p.equipo})`;
        if (p.id === socket.id) li.textContent += ' (Tú)';
        participantsList.appendChild(li);
    });
});

socket.on('actualizarPuntajes', (puntajes) => {
    globalScoreboard.classList.remove('hidden');
    score1.textContent = puntajes[1];
    score2.textContent = puntajes[2];
    score3.textContent = puntajes[3];
});

window.addPoint = (equipo) => {
    socket.emit('modificarPuntaje', { equipo, delta: 1 });
};
window.removePoint = (equipo) => {
    socket.emit('modificarPuntaje', { equipo, delta: -1 });
};
window.resetScores = () => {
    socket.emit('reiniciarPuntajes');
};
window.toggleAdminImage = () => {
    const wrapper = document.getElementById('adminImageWrapper');
    const btn = document.getElementById('toggleAdminImgBtn');
    if (wrapper && btn) {
        if (wrapper.classList.contains('hidden')) {
            wrapper.classList.remove('hidden');
            btn.innerHTML = '<span>❌</span> Ocultar Imagen';
        } else {
            wrapper.classList.add('hidden');
            btn.innerHTML = '<span>🖼️</span> Mostrar Imagen';
        }
    }
};

socket.on('rondaIniciada', () => {
    gameButton.textContent = 'PRESIONA';
    gameButton.style.fontSize = '2.2rem';
    
    if (soyParticipante) {
        showScreen('game');
        gameButton.disabled = false;
    } else if (isSpectator) {
        showScreen('spectator');
    }
});

socket.on('juegoTerminado', (resultadosRonda) => {
    if (!resultadosRonda || resultadosRonda.length === 0) return;
    
    const ganador = resultadosRonda[0];
    winnerName.textContent = ganador.nombre;
    winnerTeam.textContent = `Equipo ${ganador.equipo}`;
    winnerTime.textContent = formatTime(ganador.timestamp);
    
    // Animación del ganador
    firstPlace.classList.remove('winner-animate');
    void firstPlace.offsetWidth; // trigger reflow
    firstPlace.classList.add('winner-animate');
    
    otherPlaces.innerHTML = '';
    if (resultadosRonda.length > 1) {
        const time0 = new Date(ganador.timestamp).getTime();
        for (let i = 1; i < resultadosRonda.length; i++) {
            const res = resultadosRonda[i];
            const diff = new Date(res.timestamp).getTime() - time0;
            const item = document.createElement('div');
            item.className = 'place-item';
            
            const rank = document.createElement('span');
            rank.className = 'place-rank';
            rank.textContent = `${i + 1}º`;
            
            const name = document.createElement('span');
            name.className = 'place-name';
            name.textContent = `${res.nombre} (Eq. ${res.equipo})`;
            
            const time = document.createElement('span');
            time.className = 'place-time';
            time.textContent = `+${diff}ms`;
            
            item.appendChild(rank);
            item.appendChild(name);
            item.appendChild(time);
            
            otherPlaces.appendChild(item);
        }
    }
    
    // Deshabilitar botón para que no sigan presionando
    gameButton.disabled = true;
    
    if (isSpectator) {
        adminControls.classList.remove('hidden');
        nextRoundBtn.classList.remove('hidden');
    } else {
        adminControls.classList.add('hidden');
        nextRoundBtn.classList.add('hidden');
    }
    
    // Mostrar pantalla de resultados
    showScreen('result');
});

socket.on('reiniciarRonda', () => {
    gameButton.textContent = 'PRESIONA';
    gameButton.style.fontSize = '2.2rem';
    
    // Volver a la pantalla de juego solo si somos participantes de la ronda
    if (soyParticipante) {
        gameButton.disabled = false;
        showScreen('game');
    } else if (isSpectator) {
        showScreen('spectator');
    }
});

socket.on('usuarioSalio', () => {
    // Limpiar estado local
    nameInput.value = '';
    teamSelect.value = '';
    loginError.classList.add('hidden');
    gameButton.disabled = true;
    
    // Reset admin image toggle if they are spectator
    if (isSpectator) {
        const wrapper = document.getElementById('adminImageWrapper');
        const btn = document.getElementById('toggleAdminImgBtn');
        if (wrapper) wrapper.classList.add('hidden');
        if (btn) btn.innerHTML = '<span>🖼️</span> Mostrar Imagen';
    }

    // Volver a inicio
    if (!isSpectator) {
        showScreen('login');
    }
});

// Restaurar estado si se recarga la página
socket.on('estadoActual', ({ participantes, maxParticipantes, resultadosRonda }) => {
    if (resultadosRonda && resultadosRonda.length > 0) {
        showScreen('login');
    } else if (participantes.length === maxParticipantes) {
        showScreen('login');
        showToast("Hay una ronda en curso, espera a que termine.");
    } else {
        showScreen('login');
    }
});
