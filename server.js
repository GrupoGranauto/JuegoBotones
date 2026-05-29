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
let participantes = []; // { id, nombre }
const MAX_PARTICIPANTES = 3;

let estadoJuego = {
    ganador: null,
    timestamp: null
};

// Limpiar la lista de desconectados
const eliminarParticipante = (id) => {
    const prevLen = participantes.length;
    participantes = participantes.filter(p => p.id !== id);
    return prevLen !== participantes.length;
};

io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);

    // Enviar estado actual al conectarse (por si recarga la página)
    socket.emit('estadoActual', {
        participantes,
        maxParticipantes: MAX_PARTICIPANTES,
        estadoJuego
    });

    socket.on('unirse', (nombre) => {
        const nombreTrim = nombre.trim();

        if (!nombreTrim) {
            return socket.emit('error', 'El nombre no puede estar vacío.');
        }

        if (participantes.some(p => p.nombre.toLowerCase() === nombreTrim.toLowerCase())) {
            return socket.emit('error', 'El nombre ya está en uso en esta ronda.');
        }

        if (participantes.length >= MAX_PARTICIPANTES) {
            return socket.emit('rondaLlena', 'Ronda llena. Espera a la siguiente ronda.');
        }

        // Registrar participante
        participantes.push({
            id: socket.id,
            nombre: nombreTrim
        });

        console.log(`${nombreTrim} se ha unido.`);

        // Notificar a todos sobre la actualización de participantes
        io.emit('actualizarParticipantes', {
            participantes,
            maxParticipantes: MAX_PARTICIPANTES
        });

        // Si se llenó la sala, iniciar la ronda automáticamente
        if (participantes.length === MAX_PARTICIPANTES) {
            console.log('Ronda iniciada');
            io.emit('rondaIniciada');
        }
    });

    socket.on('presionarBoton', () => {
        // Verificar si el jugador es parte de la ronda
        const jugador = participantes.find(p => p.id === socket.id);
        if (!jugador) return; // Ignorar si no está en la lista

        // Solo se acepta si la ronda ya tiene los 3 y no hay ganador
        if (participantes.length < MAX_PARTICIPANTES) return;

        // Lógica Atómica (Single Thread de Node.js garantiza que no habrá race condition real en memoria)
        if (!estadoJuego.ganador) {
            estadoJuego.ganador = jugador.nombre;
            estadoJuego.timestamp = new Date();

            console.log(`Ganador: ${estadoJuego.ganador} a las ${estadoJuego.timestamp.toISOString()}`);

            // Emitir al ganador a todos los participantes
            io.emit('juegoTerminado', {
                ganador: estadoJuego.ganador,
                timestamp: estadoJuego.timestamp.toISOString()
            });
        }
    });

    socket.on('nuevaRonda', () => {
        console.log('Reiniciando ronda...');
        participantes = [];
        estadoJuego = {
            ganador: null,
            timestamp: null
        };
        
        io.emit('reiniciarRonda');
    });

    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.id}`);
        const eliminado = eliminarParticipante(socket.id);
        
        if (eliminado) {
            io.emit('actualizarParticipantes', {
                participantes,
                maxParticipantes: MAX_PARTICIPANTES
            });
        }
    });
});

server.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
