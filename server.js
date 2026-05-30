const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Estado en memoria
let participantes = []; // { id, equipo }
let resultadosRonda = []; // [{ id, equipo, timestamp }]
let timeoutRonda = null;
let estadoJuego = 'esperando_equipos'; // 'esperando_equipos', 'en_ronda', 'resultados'
let adminId = null;
let puntajes = {}; // { [nombreEquipo]: puntaje }

const finalizarRonda = () => {
    if (timeoutRonda) {
        clearTimeout(timeoutRonda);
        timeoutRonda = null;
    }
    
    // Ordenar por tiempo (el primero es el 1er lugar)
    resultadosRonda.sort((a, b) => a.timestamp - b.timestamp);
    
    estadoJuego = 'resultados';
    io.emit('juegoTerminado', resultadosRonda);
};

// Limpiar la lista de desconectados
const eliminarParticipante = (id) => {
    if (id === adminId) {
        adminId = null;
        console.log(`Admin desconectado: ${id}`);
        return;
    }

    const idx = participantes.findIndex(p => p.id === id);
    if (idx !== -1) {
        const equipoNombre = participantes[idx].equipo;
        participantes.splice(idx, 1);
        io.to(id).emit('usuarioSalio');

        // Si se sale un equipo en medio de la ronda y quedamos con menos de 2, regresamos al lobby
        if (participantes.length < 2 && estadoJuego !== 'esperando_equipos') {
            resultadosRonda = [];
            if (timeoutRonda) {
                clearTimeout(timeoutRonda);
                timeoutRonda = null;
            }
            estadoJuego = 'esperando_equipos';
            io.emit('reiniciarRonda');
        }

        console.log(`Equipo desconectado: ${equipoNombre}. Activos: ${participantes.length}`);
        io.emit('actualizarParticipantes', { participantes });
    }
};

io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);

    // Enviar estado actual al conectarse (por si recarga la página)
    socket.emit('estadoActual', { participantes, estadoJuego, resultadosRonda });
    socket.emit('actualizarPuntajes', puntajes);

    // Unirse a la ronda
    socket.on('unirse', ({ equipo }) => {
        if (estadoJuego === 'en_ronda') {
            socket.emit('error', 'La ronda ya ha iniciado. Por favor espera a que termine.');
            return;
        }
        if (!equipo || equipo.trim() === '') {
            socket.emit('error', 'El nombre del equipo no puede estar vacío.');
            return;
        }
        
        const nombreEquipo = equipo.trim();
        if (participantes.some(p => p.equipo.toLowerCase() === nombreEquipo.toLowerCase())) {
            socket.emit('error', 'Ese nombre de equipo ya está en uso en esta ronda.');
            return;
        }

        participantes.push({
            id: socket.id,
            equipo: nombreEquipo
        });

        // Inicializar puntaje si es un equipo nuevo
        if (puntajes[nombreEquipo] === undefined) {
            puntajes[nombreEquipo] = 0;
        }

        console.log(`Equipo unido: ${nombreEquipo} - Total: ${participantes.length}`);
        
        io.emit('actualizarParticipantes', { participantes });
        io.emit('actualizarPuntajes', puntajes);
    });

    socket.on('iniciarRonda', () => {
        if (socket.id !== adminId) return; // Solo el admin puede iniciar la ronda
        if (participantes.length < 2) {
            socket.emit('error', 'Se necesitan al menos 2 equipos para iniciar la ronda.');
            return;
        }

        console.log('Ronda iniciada manualmente por el administrador.');
        estadoJuego = 'en_ronda';
        resultadosRonda = [];
        if (timeoutRonda) {
            clearTimeout(timeoutRonda);
            timeoutRonda = null;
        }

        io.emit('rondaIniciada');
    });

    socket.on('presionarBoton', () => {
        // Verificar si el jugador es parte de la ronda
        const jugador = participantes.find(p => p.id === socket.id);
        if (!jugador) return;

        // Solo se acepta si estamos en ronda activa
        if (estadoJuego !== 'en_ronda') return;

        // Validar si ya presionó
        if (resultadosRonda.some(r => r.id === socket.id)) return;

        const ts = new Date();
        resultadosRonda.push({
            id: socket.id,
            equipo: jugador.equipo,
            timestamp: ts
        });

        console.log(`Boton presionado por: ${jugador.equipo} a las ${ts.toISOString()}`);

        if (resultadosRonda.length === 1) {
            // Primer jugador en presionar: Iniciar ventana de 3 segundos
            timeoutRonda = setTimeout(finalizarRonda, 3000);
        } else if (resultadosRonda.length === participantes.length) {
            // Ya presionaron todos los equipos activos, finalizar de inmediato
            finalizarRonda();
        }
    });

    socket.on('siguienteRonda', () => {
        if (socket.id !== adminId) return; // Solo admin
        
        console.log('Siguiente ronda (manteniendo participantes, volviendo al lobby)...');
        resultadosRonda = [];
        if (timeoutRonda) {
            clearTimeout(timeoutRonda);
            timeoutRonda = null;
        }
        estadoJuego = 'esperando_equipos';
        
        io.emit('reiniciarRonda');
    });

    socket.on('salir', () => {
        console.log(`Usuario salió de la ronda: ${socket.id}`);
        eliminarParticipante(socket.id);
    });

    // Control de Administrador
    socket.on('unirseAdmin', () => {
        if (adminId && adminId !== socket.id) {
            socket.emit('error', 'Ya hay un administrador conectado.');
            return;
        }
        adminId = socket.id;
        console.log(`Admin unido: ${socket.id}`);
        socket.emit('adminAceptado');
        socket.emit('actualizarPuntajes', puntajes);
        socket.emit('actualizarParticipantes', { participantes });
        
        // Sincronizar al admin con el estado actual del juego
        if (estadoJuego === 'resultados' && resultadosRonda.length > 0) {
            socket.emit('juegoTerminado', resultadosRonda);
        } else if (estadoJuego === 'en_ronda') {
            socket.emit('rondaIniciada');
        }
    });

    socket.on('modificarPuntaje', ({ equipo, delta }) => {
        if (socket.id !== adminId) return;
        if (puntajes[equipo] !== undefined) {
            puntajes[equipo] += delta;
            // Evitar puntajes negativos
            if (puntajes[equipo] < 0) puntajes[equipo] = 0;
            io.emit('actualizarPuntajes', puntajes);
        }
    });

    socket.on('reiniciarPuntajes', () => {
        if (socket.id !== adminId) return;
        
        puntajes = {};
        participantes.forEach(p => {
            puntajes[p.equipo] = 0;
        });
        
        io.emit('actualizarPuntajes', puntajes);
    });

    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.id}`);
        eliminarParticipante(socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
