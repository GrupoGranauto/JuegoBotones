const socket = io();

// Elementos del DOM
const screens = {
    login: document.getElementById('loginScreen'),
    waiting: document.getElementById('waitingScreen'),
    game: document.getElementById('gameScreen'),
    result: document.getElementById('resultScreen')
};

// Formularios e inputs
const joinForm = document.getElementById('joinForm');
const nameInput = document.getElementById('nameInput');
const loginError = document.getElementById('loginError');

// Sala de espera
const participantCount = document.getElementById('participantCount');
const participantsList = document.getElementById('participantsList');

// Juego
const gameButton = document.getElementById('gameButton');

// Resultados
const winnerName = document.getElementById('winnerName');
const winnerTime = document.getElementById('winnerTime');
const nextRoundBtn = document.getElementById('nextRoundBtn');
const leaveBtn = document.getElementById('leaveBtn');
const leaveWaitingBtn = document.getElementById('leaveWaitingBtn');
const ruletaImgElement = document.getElementById('ruletaImgElement');

// Toast
const toast = document.getElementById('toast');
let toastTimeout;

// Estado global local
let soyParticipante = false;

// Funciones de UI
const showScreen = (screenName) => {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
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
    if (name) {
        socket.emit('unirse', name);
    }
});

gameButton.addEventListener('click', () => {
    socket.emit('presionarBoton');
});

nextRoundBtn.addEventListener('click', () => {
    socket.emit('siguienteRonda');
});

leaveBtn.addEventListener('click', () => {
    socket.emit('salir');
});

leaveWaitingBtn.addEventListener('click', () => {
    socket.emit('salir');
});

// Eventos de Socket.IO
socket.on('error', (msg) => {
    loginError.textContent = msg;
    loginError.classList.remove('hidden');
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

    // Si alguien salió y quedamos menos de 3, volver a la sala de espera (si somos participantes)
    if (participantes.length < maxParticipantes && soyParticipante && !screens.waiting.classList.contains('active')) {
        showScreen('waiting');
        showToast("Un jugador ha salido. Esperando...");
    }

    // Actualizar UI
    participantCount.textContent = `${participantes.length}/${maxParticipantes}`;
    
    participantsList.innerHTML = '';
    participantes.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.nombre;
        if (p.id === socket.id) li.textContent += ' (Tú)';
        participantsList.appendChild(li);
    });
});

socket.on('rondaIniciada', () => {
    // Mostrar botón grande si el usuario está en la sala de espera
    if (screens.waiting.classList.contains('active')) {
        showScreen('game');
        gameButton.disabled = false;
    }
});

socket.on('juegoTerminado', ({ ganador, timestamp, ruletaImg }) => {
    winnerName.textContent = ganador;
    winnerTime.textContent = formatTime(timestamp);
    
    if (ruletaImg) {
        ruletaImgElement.src = ruletaImg;
        ruletaImgElement.classList.remove('hidden', 'hide-funny');
        ruletaImgElement.classList.add('show-funny');
    } else {
        ruletaImgElement.classList.add('hidden');
        ruletaImgElement.classList.remove('show-funny', 'hide-funny');
    }
    
    // Deshabilitar botón para que no sigan presionando
    gameButton.disabled = true;
    
    // Mostrar pantalla de resultados
    showScreen('result');
});

socket.on('reiniciarRonda', () => {
    // Limpiar ruleta animada
    if (ruletaImgElement.classList.contains('show-funny')) {
        ruletaImgElement.classList.remove('show-funny');
        ruletaImgElement.classList.add('hide-funny');
        setTimeout(() => {
            ruletaImgElement.classList.add('hidden');
        }, 600);
    } else {
        ruletaImgElement.classList.add('hidden');
    }

    // Volver a la pantalla de juego solo si somos participantes de la ronda
    if (soyParticipante) {
        gameButton.disabled = false;
        showScreen('game');
    }
});

socket.on('usuarioSalio', () => {
    // Limpiar ruleta animada
    if (ruletaImgElement.classList.contains('show-funny')) {
        ruletaImgElement.classList.remove('show-funny');
        ruletaImgElement.classList.add('hide-funny');
        setTimeout(() => {
            ruletaImgElement.classList.add('hidden');
        }, 600);
    } else {
        ruletaImgElement.classList.add('hidden');
    }

    // Limpiar estado local
    nameInput.value = '';
    loginError.classList.add('hidden');
    gameButton.disabled = true;
    
    // Volver a inicio
    showScreen('login');
});

// Restaurar estado si se recarga la página
socket.on('estadoActual', ({ participantes, maxParticipantes, estadoJuego }) => {
    // Si el usuario ya estaba registrado en esta sesión de socket, iría directo
    // Pero como socket id cambia al recargar, volverá al login.
    // Solo actualizamos la UI si hay ronda iniciada o terminada
    if (estadoJuego.ganador) {
        winnerName.textContent = estadoJuego.ganador;
        winnerTime.textContent = formatTime(estadoJuego.timestamp);
        showScreen('result');
    } else if (participantes.length === maxParticipantes) {
        showScreen('login');
        showToast("Hay una ronda en curso, espera a que termine.");
    } else {
        showScreen('login');
    }
});
