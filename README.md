# 🗳️ Votaciones

App web para crear votaciones de fechas y compartirlas con un grupo. Es la evolución de
[votaciones](https://github.com/manuelmarcas/votaciones) (la votación de comida/cena de Navidad),
pero todo es configurable.

## Qué se puede hacer

- **Crear votaciones** con:
  1. Nombre (y descripción opcional).
  2. Tipo: **horas**, **días**, **semanas** o **meses**.
  3. Los meses en los que estará la votación (pueden ser de años distintos).
  4. Los días (o semanas) concretos que se podrán votar dentro de esos meses. El resto aparecen bloqueados.
     Hay atajos (todos, ninguno, lunes a viernes, fines de semana) y, en ordenador, Mayús + clic marca un rango.
  5. En las de **días**: de 1 a 4 opciones por día (p. ej. comida y cena), cada una con su nombre y su icono.
     El icono se ve en el calendario y el nombre en la leyenda.
  6. En las de **horas**: rango horario (desde/hasta) y duración de cada franja (30 min, 1 h, 2 h),
     que se repite en cada día elegido.
- **Votar** pulsando en el calendario, con el contador en cada casilla, el borde verde en lo más votado,
  el resumen de "opciones más votadas" y la tabla por participante, igual que en el original.
- **Mis votaciones**: cada usuario tiene su colección (las que ha creado y aquellas en las que ha entrado)
  y puede organizarla en **grupos** con el nombre que quiera (crear, renombrar, eliminar, mover votaciones).
- **Menú lateral** dentro de cada votación: todas tus votaciones por grupos para saltar de una a otra sin volver
  a la portada, con buscador. Desde ahí se organizan (menú ⋯ o arrastrando a otro grupo) y se crean, renombran,
  pliegan o eliminan grupos. En el móvil se abre con el botón ☰.
- **Emojis** en el título, la descripción y las opciones de cada día, con un selector completo
  (todos los emojis de Unicode, como WhatsApp) con categorías, búsqueda en español, tonos de piel y recientes.
- **Perfil**: cada usuario elige el nombre que ven los demás y su imagen (subida desde el dispositivo, la de Google
  o ninguna, y entonces se muestra su inicial). El cambio se aplica a todas las votaciones en las que participa.
- **Compartir** con enlace, **código QR** (también descargable en PNG), WhatsApp, Telegram, correo
  o el menú de compartir del móvil.
- Quien abre el enlace e inicia sesión **queda como participante** (aparece en la tabla aunque aún no haya votado)
  y la votación **se añade a su menú**.
- **Ranking**: "opciones más votadas" muestra las 5 primeras de todas las opciones, con su puesto (los empates
  comparten puesto).
- **Desempate**: si hay varias opciones empatadas en el primer puesto, el creador puede abrir un desempate.
  La votación principal se cierra y cada participante elige **una sola** de las empatadas (puede cambiarla mientras
  esté abierto). El creador lo finaliza, puede repetirlo entre las que sigan empatadas o anularlo; la ganadora se
  marca en el ranking. Reabrir la votación principal anula el desempate.
- **Votos visibles o anónimos** (se elige al crearla). Con votos visibles, en la tabla de participantes se pulsa
  un nombre para ver qué ha votado esa persona, y en "opciones más votadas" se puede desplegar quién las votó.
  En las anónimas solo se ven los totales y si cada persona ha votado. El creador puede hacer anónima una votación
  visible, pero no al revés.
  *Ojo*: el anonimato es de la interfaz. Los votos se guardan en documentos que cualquier participante puede leer
  (la app los necesita para el recuento), así que alguien con conocimientos técnicos podría consultarlos.
- El creador puede **cerrar/reabrir** la votación (cerrada ya no admite cambios) y **eliminarla**;
  cerrar y eliminar piden confirmación.

## Probarla en local (modo demo, sin Firebase)

Al ser módulos ES, hay que servirla por HTTP (no vale abrir el archivo con doble clic):

```bash
python -m http.server 8000
```

y abre <http://localhost:8000/?demo>. En modo demo los datos se guardan en el `localStorage` del navegador
y te pide solo un nombre. Para simular a varias personas, abre otra pestaña y entra con otro nombre.

Sin `?demo`, usa Firebase (login con Google) con el proyecto configurado en `js/config.js`.

## Ponerla en marcha con Firebase

`js/config.js` ya apunta al mismo proyecto de Firebase que el original (`votaciones-9bc95`).

1. **Reglas de Firestore**: la app usa colecciones nuevas (`polls` y `users`), así que hay que publicar
   las reglas de [`firestore.rules`](firestore.rules) en *Firebase Console › Firestore Database › Reglas*.
   Cada vez que cambie este archivo hay que volver a publicarlo.
   El archivo incluye también la regla de `/votes` para que la votación de Navidad original siga funcionando;
   si tus reglas actuales para `/votes` son distintas, conserva las tuyas y añade el resto.
2. **Authentication**: el proveedor de Google ya está activado. Si publicas la app en un dominio nuevo,
   añádelo en *Authentication › Configuración › Dominios autorizados* (`localhost` ya viene incluido).
3. **Publicarla**: es una web estática sin compilación. Por ejemplo, con GitHub Pages:
   sube el repositorio y activa *Settings › Pages › Deploy from a branch* (`main`, carpeta raíz).

## Estructura

```
index.html            Contenedor: login, barra superior y vista
css/styles.css        Estilos (misma paleta que el original)
js/app.js             Arranque, sesión y rutas (#/, #/nueva, #/v/<id>, #/perfil)
js/home.js            "Mis votaciones" con grupos
js/sidebar.js         Menú lateral (navegar y organizar)
js/library.js         Suscripción compartida a la colección del usuario
js/create.js          Asistente de nueva votación
js/poll.js            Calendario, votos, resumen y participantes
js/profile.js         Perfil: nombre visible e imagen
js/emoji.js           Selector de emojis (emoji-picker-element, se carga al abrirlo)
js/share.js           Diálogo de compartir y QR
js/model.js           Modelo de la votación y recuentos
js/dates.js           Utilidades de fechas (semanas ISO, rangos, formatos)
js/store.js           Datos: Firebase o modo demo (misma interfaz)
js/config.js          Configuración de Firebase
js/vendor/qrcode.js   qrcode-generator 1.4.4 (MIT, Kazuhiko Arase)
firestore.rules       Reglas de seguridad
```

## Modelo de datos (Firestore)

| Ruta | Contenido |
| --- | --- |
| `polls/{pollId}` | `title`, `description`, `type`, `anonymous`, `tiebreak` (`id`, `candidates`, `done`, `round`), `months`, `slots` (días, lunes de cada semana o meses votables), `hours` y `hourStep` (solo horas), `options` (solo días), `ownerUid`, `ownerName`, `createdAt`, `closed` |
| `polls/{pollId}/votes/{uid}` | Un documento por participante: `name`, `photo`, `picks` (`"<casilla>\|<opción>"`), `tb` (voto del desempate: `{ id, pick }`), `seenAt`, `updatedAt` |
| `users/{uid}` | Perfil: `name` (nombre visible), `photo` (imagen reducida en base64, URL de Google o vacía), `updatedAt` |
| `users/{uid}/polls/{pollId}` | Colección privada del usuario: `title`, `type`, `role` (`owner`/`participant`), `groupId`, `addedAt`, `openedAt` |
| `users/{uid}/groups/{groupId}` | Grupos privados del usuario: `name`, `createdAt` |

La imagen de perfil se reduce en el navegador a 128×128 px (unos pocos KB) y se guarda en Firestore,
así que no hace falta Firebase Storage (que en proyectos nuevos exige el plan de pago).

Cualquier usuario con sesión puede abrir una votación si tiene el enlace; solo el creador puede cerrarla o
borrarla; cada uno solo puede modificar su propio voto; y la colección/grupos de cada usuario es privada.

## Librerías externas

- [Firebase](https://firebase.google.com/) 10.12.2 (desde `gstatic.com`).
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4, MIT, incluida en `js/vendor/`.
- [emoji-picker-element](https://github.com/nolanlawson/emoji-picker-element) 1.29.1, Apache-2.0, y sus datos
  en español (`emoji-picker-element-data` 1.8.0), desde jsDelivr. Solo se descargan al abrir el selector de emojis.
