# Telegram Resta Bot MVP

Bot de Telegram construido con **Node.js + Telegraf** para practicar restas por chat.

El proyecto está pensado como un **MVP simple y operativo**:

- una sola sesión activa por chat,
- estado en memoria,
- respuestas por botones o texto,
- despliegue sencillo en Render,
- soporte para **polling** y **webhook**,
- endpoint liviano para **health checks** y **cronjob keepalive**.

---

## 1. Qué hace el bot

- `/start` inicia o reinicia una partida.
- Cada turno presenta una resta con opciones.
- El usuario puede responder:
  - tocando un botón, o
  - escribiendo el número correcto manualmente.
- Cada acierto suma puntos y genera una nueva resta.
- Una respuesta incorrecta termina la sesión.
- Si el tiempo del turno se vence, termina toda la sesión.

### Progresión de dificultad

- **Nivel 1**: operandos de `0` a `9`.
- **Nivel 2**: operandos de `10` a `99`.
- El nivel sube automáticamente al llegar a **20 puntos**.

---

## 2. Limitaciones del MVP

Aquí NO hay magia. Es importante entender el modelo actual:

- el estado vive en memoria usando un `Map`,
- no existe persistencia en base de datos,
- si el proceso reinicia, las sesiones se pierden,
- no hay historial acumulado entre reinicios,
- no hay panel administrativo real.

Eso significa que este proyecto está bien para:

- practicar arquitectura básica,
- probar lógica de juego,
- desplegar un bot funcional,
- validar una idea.

No está pensado todavía para producción seria con escalado horizontal o recuperación de estado.

---

## 3. Arquitectura actual

El proceso hace tres cosas relevantes:

1. levanta el bot de Telegram,
2. expone un dashboard administrativo para supervisión interna,
3. mantiene un servidor HTTP compatible con Render, webhook y health checks.

Ese runtime HTTP cumple varias funciones al mismo tiempo:

- servir `GET /dashboard`,
- exponer `GET /health`,
- exponer `GET /api/snapshot`,
- recibir el webhook de Telegram cuando se usa `TELEGRAM_MODE=webhook`,
- permitir que Render y cron-job.org mantengan vivo el servicio.

### Por qué existe ese servidor HTTP

Porque si despliegas en **Render Web Service**, necesitas un puerto HTTP activo.

Además:

- el **webhook** necesita una ruta HTTP pública,
- el **cronjob keepalive** necesita una URL para hacer ping,
- el **health check** necesita una ruta estable.

---

## 4. Modos de ejecución de Telegram

El proyecto soporta dos modos.

### A) `polling`

El bot consulta activamente a Telegram con `getUpdates`.

Útil para:

- desarrollo local,
- pruebas rápidas,
- entornos sin URL pública.

Desventajas:

- es más sensible a errores de red,
- puede chocar con otra instancia activa del mismo bot,
- no es el modo ideal para un Web Service en Render.

### B) `webhook`

Telegram envía los updates a tu URL pública.

Útil para:

- Render,
- producción,
- despliegues con endpoint HTTP público.

Ventajas:

- se adapta mejor a un Web Service,
- evita conflictos típicos de polling,
- reduce dependencia de conexiones largas salientes.

**RECOMENDACIÓN:** en Render usa **webhook**.

---

## 5. Endpoints disponibles

### `GET /`

Alias liviano de salud del servicio.

### `GET /health`

Endpoint recomendado para:

- Render,
- cron-job.org,
- UptimeRobot,
- verificaciones manuales.

Ejemplo de respuesta:

```json
{
  "ok": true,
  "service": "reto-bot",
  "generatedAt": "2026-05-12T19:00:00.000Z",
  "uptimeSeconds": 120,
  "telegram": {
    "mode": "webhook",
    "status": "connected",
    "launchAttempts": 1,
    "connectedAt": "2026-05-12T18:58:30.000Z",
    "lastError": null
  },
  "sessions": {
    "total": 2,
    "active": 1,
    "ended": 1,
    "expired": 0
  }
}
```

### `GET /api/health`

Alias compatible del health check.

### `GET /api/snapshot`

Devuelve un snapshot serializable del proceso actual y del estado efímero del juego.

### `POST /telegram/webhook`

Ruta por defecto del webhook de Telegram.

Se puede cambiar mediante `WEBHOOK_PATH`.

### `GET /dashboard`

Dashboard administrativo pensado para profesores y administradores internos.

Incluye:

- estado del bot,
- sesiones activas,
- chats visibles,
- historial reciente del proceso,
- errores recientes,
- bitácora operativa.

Importante: ese historial sigue siendo **del proceso actual**, no un histórico persistente global.

---

## 6. Variables de entorno

### Obligatoria

- `BOT_TOKEN`: token del bot de Telegram.

### Juego

- `SCORE_INCREMENT` (default `1`): puntos por respuesta correcta.
- `TURN_TIMEOUT_SECONDS` (default `15`): duración máxima de cada turno.

### HTTP / hosting

- `PORT`: puerto inyectado por Render u otro proveedor.
- `DASHBOARD_PORT` (default `3000`): puerto local cuando `PORT` no existe.

### Telegram runtime

- `TELEGRAM_MODE`: `polling` o `webhook`.
- `WEBHOOK_BASE_URL`: URL pública del servicio. Requerida en modo `webhook`.
- `WEBHOOK_PATH` (default `/telegram/webhook`): ruta del webhook.
- `WEBHOOK_SECRET_TOKEN`: token opcional para validar el webhook.

### Cómo decide el modo por defecto

La app usa esta lógica:

- si existe `WEBHOOK_BASE_URL` o `RENDER_EXTERNAL_URL` → usa `webhook`
- si no existe URL pública → usa `polling`

---

## 7. Configuración local

### 1) Copiar variables

En PowerShell:

```powershell
Copy-Item .env.example .env
```

### 2) Completar `.env`

Ejemplo para local en polling:

```env
BOT_TOKEN=tu_token
TELEGRAM_MODE=polling
SCORE_INCREMENT=1
TURN_TIMEOUT_SECONDS=15
DASHBOARD_PORT=3000
```

### 3) Instalar dependencias

```bash
npm install
```

### 4) Ejecutar

Desarrollo:

```bash
npm run dev
```

Producción local:

```bash
npm start
```

### 5) Verificar salud

```txt
http://127.0.0.1:3000/health
```

o el puerto que definas en `DASHBOARD_PORT`.

---

## 8. Despliegue en Render

### Recomendación

Usa:

- **Render Web Service**
- **modo webhook**

### Variables recomendadas en Render

```env
BOT_TOKEN=tu_token_real
TELEGRAM_MODE=webhook
WEBHOOK_BASE_URL=https://reto-bot.onrender.com
WEBHOOK_PATH=/telegram/webhook
WEBHOOK_SECRET_TOKEN=tu_secreto_opcional
SCORE_INCREMENT=1
TURN_TIMEOUT_SECONDS=15
```

### Start command

```bash
node src/index.js
```

### Health check

Usa:

```txt
/health
```

### Importante

No ejecutes otra instancia del mismo bot con el mismo token si estás usando polling. Eso provoca el error:

```txt
409 Conflict: terminated by other getUpdates request
```

---

## 9. Keepalive con cron-job.org

Si tu servicio gratuito se duerme por inactividad, puedes hacer ping externo.

### URL recomendada

```txt
https://tu-servicio.onrender.com/health
```

### Frecuencia recomendada

Cada **5 minutos**.

No uses 1 minuto si no hace falta. Eso solo mete ruido innecesario.

### Lo que NO debes hacer

NO uses cron para ejecutar otra vez:

```bash
node src/index.js
```

Eso sería incorrecto porque podría levantar otra instancia del bot.

El cron debe hacer solo una **petición HTTP GET**.

---

## 10. Estrategia de resiliencia actual

El proyecto ya incluye varias medidas para no caerse innecesariamente:

- preferencia por IPv4 (`dns.setDefaultResultOrder('ipv4first')`),
- retries con backoff para errores transitorios,
- estado del bot visible en `/health`,
- separación entre error de conexión a Telegram y vida del proceso HTTP,
- soporte para webhook como estrategia principal en hosting.

Errores transitorios que sí se reintentan:

- `ETIMEDOUT`
- `ECONNRESET`
- `ENOTFOUND`
- `EAI_AGAIN`

Errores de configuración o de uso NO deben ocultarse con retries infinitos.

---

## 11. Scripts disponibles

```bash
npm start
npm run dev
npm test
npm run validate
```

### Qué hace `npm run validate`

- valida sintaxis real del proyecto,
- luego ejecuta toda la suite de tests.

---

## 12. Pruebas

Ejecuta:

```bash
npm test
```

El proyecto incluye pruebas para:

- handlers del bot,
- reglas del juego,
- sesiones en memoria,
- dashboard administrativo y endpoints HTTP,
- carga de variables de entorno.

---

## 13. Próximas mejoras naturales

Si quieres llevar este MVP al siguiente nivel, estas son las mejoras correctas:

1. persistencia real de sesiones,
2. separación entre bot worker y web runtime,
3. métricas reales,
4. logs estructurados,
5. despliegue con secretos gestionados,
6. soporte multiinstancia sin perder estado.

---

## 14. Resumen corto

Este proyecto ahora sí incluye un dashboard, pero con propósito real.

Su enfoque actual es:

- **bot de Telegram**,
- **dashboard administrativo para supervisión interna**,
- **runtime estable en Render**,
- **health endpoint liviano**,
- **webhook preferido**,
- **cronjob solo para keepalive HTTP**.

Ese es el modelo sano para este MVP.
