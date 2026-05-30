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
const loginError = document.getElementById('loginError');
const spectatorBtn = document.getElementById('spectatorBtn');
const leaveSpectatorBtn = document.getElementById('leaveSpectatorBtn');

const globalScoreboard = document.getElementById('globalScoreboard');

// Sala de espera
const participantCount = document.getElementById('participantCount');
const participantsList = document.getElementById('participantsList');
const adminStartRoundBtn = document.getElementById('adminStartRoundBtn');

// Juego
const gameButton = document.getElementById('gameButton');

// Resultados
const firstPlace = document.getElementById('firstPlace');
const otherPlaces = document.getElementById('otherPlaces');
const winnerName = document.getElementById('winnerName');
const winnerTeam = document.getElementById('winnerTeam');
const winnerTime = document.getElementById('winnerTime');
const adminControls = document.getElementById('adminControls');
const adminTeamsList = document.getElementById('adminTeamsList');
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
    const teamName = nameInput.value.trim();
    if (teamName) {
        isSpectator = false;
        socket.emit('unirse', { equipo: teamName });
    } else {
        loginError.textContent = "Debes ingresar el nombre de tu equipo.";
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
    document.body.classList.remove('admin-mode');
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
        if (btn) btn.innerHTML = '<span></span> Mostrar Imagen';
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
        if (btn) btn.innerHTML = '<span></span> Mostrar Imagen';
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

socket.on('actualizarParticipantes', ({ participantes }) => {
    soyParticipante = participantes.some(p => p.id === socket.id);
    
    // Si estábamos en login, pasamos a espera (si nos unimos exitosamente)
    if (screens.login.classList.contains('active') && soyParticipante) {
        showScreen('waiting');
    }

    // Si alguien salió y quedamos menos de 2 en medio de una ronda, el servidor nos regresará
    if (participantes.length < 2 && (soyParticipante || isSpectator) && !screens.waiting.classList.contains('active') && !screens.login.classList.contains('active')) {
        showScreen('waiting');
        if (soyParticipante) showToast("Se requieren mínimo 2 equipos conectados. Esperando...");
    }

    // Actualizar contador descriptivo
    participantCount.textContent = `${participantes.length} ${participantes.length === 1 ? 'equipo conectado' : 'equipos conectados'}`;
    
    participantsList.innerHTML = '';
    participantes.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.equipo;
        if (p.id === socket.id) li.textContent += ' (Tú)';
        participantsList.appendChild(li);
    });

    // Control de visibilidad del botón de Iniciar Ronda para Admin
    if (isSpectator) {
        adminStartRoundBtn.classList.remove('hidden');
        if (participantes.length >= 2) {
            adminStartRoundBtn.removeAttribute('disabled');
            adminStartRoundBtn.style.opacity = '1';
            adminStartRoundBtn.textContent = 'Iniciar Ronda';
        } else {
            adminStartRoundBtn.setAttribute('disabled', 'true');
            adminStartRoundBtn.style.opacity = '0.5';
            adminStartRoundBtn.textContent = 'Esperando Equipos (Mínimo 2)';
        }
    } else {
        adminStartRoundBtn.classList.add('hidden');
    }
});

// Función auxiliar para renderizar los controles de administración de puntajes
const actualizarControlesAdmin = (puntajes) => {
    adminTeamsList.innerHTML = '';
    const keys = Object.keys(puntajes);
    
    if (keys.length === 0) {
        adminTeamsList.innerHTML = '<p style="color: var(--secondary-color); font-size: 0.95rem;">No hay equipos registrados.</p>';
        return;
    }

    keys.forEach((equipo) => {
        const teamRow = document.createElement('div');
        teamRow.className = 'admin-team';
        
        const teamInfo = document.createElement('div');
        teamInfo.className = 'admin-team-info';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'admin-team-name';
        nameSpan.textContent = equipo;
        
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'admin-team-score';
        scoreSpan.textContent = `Puntaje: ${puntajes[equipo]}`;
        
        teamInfo.appendChild(nameSpan);
        teamInfo.appendChild(scoreSpan);
        
        const btnGroup = document.createElement('div');
        btnGroup.className = 'admin-btn-group';
        
        const minusBtn = document.createElement('button');
        minusBtn.className = 'btn-score btn-minus';
        minusBtn.textContent = '-1';
        minusBtn.onclick = () => removePoint(equipo);
        
        const plusBtn = document.createElement('button');
        plusBtn.className = 'btn-score btn-plus';
        plusBtn.textContent = '+1';
        plusBtn.style.background = 'var(--primary-color)';
        plusBtn.onclick = () => addPoint(equipo);
        
        btnGroup.appendChild(minusBtn);
        btnGroup.appendChild(plusBtn);
        
        teamRow.appendChild(teamInfo);
        teamRow.appendChild(btnGroup);
        
        adminTeamsList.appendChild(teamRow);
    });
};

socket.on('actualizarPuntajes', (puntajes) => {
    if (!screens.login.classList.contains('active')) {
        globalScoreboard.classList.remove('hidden');
    }
    
    // Renderizado dinámico del marcador superior
    globalScoreboard.innerHTML = '';
    const keys = Object.keys(puntajes);
    
    if (keys.length === 0) {
        globalScoreboard.innerHTML = '<p style="color: var(--secondary-color); margin: 0; font-size: 0.95rem;">Sin puntuaciones</p>';
    } else {
        keys.forEach((equipo, index) => {
            const scoreCard = document.createElement('div');
            scoreCard.className = 'team-score';
            
            // Asignar un color del array de colores de manera cíclica
            const colors = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#06b6d4'];
            const colorClass = colors[index % colors.length];
            
            const label = document.createElement('span');
            label.className = 'team-label';
            label.textContent = equipo;
            
            const val = document.createElement('span');
            val.className = 'score-value';
            val.textContent = puntajes[equipo];
            val.style.color = colorClass;
            
            scoreCard.appendChild(label);
            scoreCard.appendChild(val);
            globalScoreboard.appendChild(scoreCard);
        });
    }

    // Actualizar controles de admin si es espectador
    if (isSpectator) {
        actualizarControlesAdmin(puntajes);
    }
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
window.startRound = () => {
    socket.emit('iniciarRonda');
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
    winnerName.textContent = ganador.equipo;
    winnerTeam.textContent = '🏆 1er Lugar 🏆';
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
            name.textContent = res.equipo;
            
            const time = document.createElement('span');
            time.className = 'place-time';
            time.textContent = `+${diff}ms`;
            
            item.appendChild(rank);
            item.appendChild(name);
            item.appendChild(time);
            
            otherPlaces.appendChild(item);
        }
    }
    
    // Deshabilitar botón
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
    
    // Al reiniciar la ronda, regresamos todos al lobby (sala de espera) para iniciar ordenadamente
    if (soyParticipante || isSpectator) {
        showScreen('waiting');
        if (soyParticipante) {
            showToast("Preparando siguiente ronda... Espera al administrador.");
        }
    }
});

socket.on('usuarioSalio', () => {
    // Limpiar estado local
    nameInput.value = '';
    loginError.classList.add('hidden');
    gameButton.disabled = true;
    
    // Reset admin image toggle if they are spectator
    if (isSpectator) {
        const wrapper = document.getElementById('adminImageWrapper');
        const btn = document.getElementById('toggleAdminImgBtn');
        if (wrapper) wrapper.classList.add('hidden');
        if (btn) btn.innerHTML = '<span></span> Mostrar Imagen';
    }

    // Volver a inicio
    if (!isSpectator) {
        showScreen('login');
    }
});

// Restaurar estado si se recarga la página
socket.on('estadoActual', ({ participantes, estadoJuego, resultadosRonda }) => {
    soyParticipante = participantes.some(p => p.id === socket.id);
    
    if (estadoJuego === 'resultados' && resultadosRonda && resultadosRonda.length > 0) {
        if (soyParticipante || isSpectator) {
            // Se le asignará a los resultados automáticamente por el evento del servidor
        } else {
            showScreen('login');
        }
    } else if (estadoJuego === 'en_ronda') {
        if (soyParticipante) {
            showScreen('game');
        } else if (isSpectator) {
            showScreen('spectator');
        } else {
            showScreen('login');
            showToast("Ronda en curso, espera a que termine.");
        }
    } else {
        if (soyParticipante) {
            showScreen('waiting');
        } else if (isSpectator) {
            showScreen('waiting');
        } else {
            showScreen('login');
        }
    }
});
