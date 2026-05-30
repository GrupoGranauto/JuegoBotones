const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Estado en memoria
const maxParticipantes = 3;
let participantes = []; // { id, nombre, equipo }
let estadoJuego = {
    ganador: null,
    timestamp: null
};

let adminId = null;
let puntajes = { 1: 0, 2: 0, 3: 0 };

// Ya no se usan imágenes de ruleta

// Limpiar la lista de desconectados
const eliminarParticipante = (id) => {
    if (id === adminId) {
        adminId = null;
        console.log(`Admin desconectado: ${id}`);
        return;
    }

    const idx = participantes.findIndex(p => p.id === id);
    if (idx !== -1) {
        participantes.splice(idx, 1);
        io.to(id).emit('usuarioSalio');
        
        if (estadoJuego.ganador) {
            estadoJuego.ganador = null;
            estadoJuego.timestamp = null;
            io.emit('reiniciarRonda');
        }

        io.emit('actualizarParticipantes', { participantes, maxParticipantes });
    }
};

io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);

    // Enviar estado actual al conectarse (por si recarga la página)
    socket.emit('estadoActual', { participantes, maxParticipantes, estadoJuego });
    socket.emit('actualizarPuntajes', puntajes);

    // Unirse a la ronda
    socket.on('unirse', ({ nombre, equipo }) => {
        if (participantes.length >= maxParticipantes) {
            socket.emit('error', 'La sala está llena.');
            return;
        }
        if (!nombre || nombre.trim() === '') {
            socket.emit('error', 'El nombre no puede estar vacío.');
            return;
        }
        if (!equipo || !['1', '2', '3'].includes(String(equipo))) {
            socket.emit('error', 'Equipo inválido.');
            return;
        }
        if (participantes.some(p => p.nombre === nombre)) {
            socket.emit('error', 'El nombre ya está en uso en esta ronda.');
            return;
        }
        if (participantes.some(p => p.equipo === String(equipo))) {
            socket.emit('error', `El Equipo ${equipo} ya está ocupado en esta ronda.`);
            return;
        }

        participantes.push({
            id: socket.id,
            nombre: nombre.trim(),
            equipo: String(equipo)
        });

        console.log(`Usuario unido: ${nombre} (Equipo ${equipo}) - Total: ${participantes.length}`);
        
        io.emit('actualizarParticipantes', { participantes, maxParticipantes });
        socket.emit('actualizarPuntajes', puntajes);

        // Si se llenó la sala, iniciar la ronda automáticamente
        if (participantes.length === maxParticipantes) {
            console.log('Ronda iniciada');
            io.emit('rondaIniciada');
        }
    });

    socket.on('presionarBoton', () => {
        // Verificar si el jugador es parte de la ronda
        const jugador = participantes.find(p => p.id === socket.id);
        if (!jugador) return; // Ignorar si no está en la lista

        // Solo se acepta si la ronda ya tiene los 3 y no hay ganador
        if (participantes.length < maxParticipantes) return;

        // Lógica Atómica
        if (!estadoJuego.ganador) {
            estadoJuego.ganador = jugador.nombre;
            estadoJuego.timestamp = new Date();

            console.log(`Ganador: ${estadoJuego.ganador} a las ${estadoJuego.timestamp.toISOString()}`);

            // Emitir al ganador a todos los participantes
            io.emit('juegoTerminado', {
                ganador: estadoJuego.ganador,
                equipoGanador: jugador.equipo,
                timestamp: estadoJuego.timestamp.toISOString()
            });
        }
    });

    socket.on('siguienteRonda', () => {
        console.log('Siguiente ronda (manteniendo participantes)...');
        estadoJuego = {
            ganador: null,
            timestamp: null
        };
        
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
    });

    socket.on('modificarPuntaje', ({ equipo, delta }) => {
        if (socket.id !== adminId) return;
        if (puntajes[equipo] !== undefined) {
            puntajes[equipo] += delta;
            io.emit('actualizarPuntajes', puntajes);
        }
    });

    socket.on('reiniciarPuntajes', () => {
        if (socket.id !== adminId) return;
        puntajes = { 1: 0, 2: 0, 3: 0 };
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
