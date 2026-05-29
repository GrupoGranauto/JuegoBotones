# Juego de Botones en Tiempo Real

Este es un juego multijugador en tiempo real desarrollado con Node.js, Express y Socket.IO.

## Reglas
- Máximo 3 participantes por ronda.
- El primer jugador en presionar el botón gigante es el ganador.
- Todo el estado se mantiene en la memoria del servidor de forma efímera.

## Despliegue en Railway

Esta aplicación está lista para ser desplegada en [Railway](https://railway.app/).

### Pasos para desplegar:

1. **Subir el código a GitHub**:
   Inicializa un repositorio de Git en esta carpeta, haz un commit y súbelo a un nuevo repositorio en GitHub.

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/tu-usuario/tu-repo.git
   git push -u origin main
   ```

2. **Crear proyecto en Railway**:
   - Inicia sesión en Railway.
   - Haz clic en **"New Project"**.
   - Selecciona **"Deploy from GitHub repo"**.
   - Conecta tu cuenta de GitHub (si no lo has hecho) y selecciona el repositorio que acabas de crear.
   - Railway detectará automáticamente que es un proyecto Node.js y utilizará el script `npm start` definido en `package.json`.

3. **Variables de Entorno (Opcional)**:
   - Railway asignará un puerto automáticamente en la variable `PORT`, nuestro código `server.js` ya está configurado para escuchar `process.env.PORT || 3000`.

4. **Acceso al Dominio**:
   - Una vez desplegado, Railway te proporcionará un dominio público para acceder a la aplicación desde cualquier dispositivo móvil o de escritorio.
