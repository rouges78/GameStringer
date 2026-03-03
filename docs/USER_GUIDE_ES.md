# 📖 GameStringer - Guía de Usuario Completa

## Índice

1. [Descripción General](#descripción-general)
2. [Primer Inicio y Perfiles](#primer-inicio-y-perfiles)
3. [Biblioteca y Detalles del Juego](#biblioteca-y-detalles-del-juego)
4. [Neural Translator Pro](#neural-translator-pro)
5. [Translation Wizard](#translation-wizard)
6. [Translation Bridge](#translation-bridge)
7. [Subtitle Translator Pro](#subtitle-translator-pro)
8. [Retro ROM Tools](#retro-rom-tools)
9. [API Pública v1](#api-pública-v1)
10. [Voice Clone Studio](#voice-clone-studio) *(NUEVO v1.0.5)*
11. [VR Text Overlay](#vr-text-overlay) *(NUEVO v1.0.5)*
12. [Quality Gates](#quality-gates) *(NUEVO v1.0.5)*
13. [Player Feedback](#player-feedback) *(NUEVO v1.0.5)*
14. [Nuevos Proveedores AI v1.0.6](#nuevos-proveedores-ai-v106) *(NUEVO v1.0.6)*
15. [Community Hub v1.0.7](#community-hub-v107) *(NUEVO v1.0.7)*
16. [Mejoras de UI v1.0.9](#mejoras-de-ui-v109) *(NUEVO v1.0.9)*
17. [Exportación de Parche](#exportación-de-parche)
18. [Aplicar al Juego](#aplicar-al-juego)
19. [Gestión de Copias de Seguridad](#gestión-de-copias-de-seguridad)
20. [Editor de Traducciones](#editor-de-traducciones)
21. [Historial de Actividad](#historial-de-actividad)
22. [Diccionarios](#diccionarios)
23. [Solución de Problemas](#solución-de-problemas)

---

## Descripción General

GameStringer es un sistema avanzado para la traducción automática y manual de videojuegos. Soporta:


- **Motores de juego**: Unity, Unreal Engine, RPG Maker, Ren'Py, Godot, Telltale, Wolf RPG, Kirikiri y otros
- **Formatos de archivo**: CSV, JSON, XML, PO/POT, YAML, TXT, SRT, VTT, ASS/SSA y otros
- **Proveedores AI**: Claude, Gemini, GPT, DeepSeek, Mistral, Groq, Ollama, **Qwen 3**, **NLLB-200** (18+ proveedores)
- **Idiomas**: 200+ idiomas soportados (con NLLB-200)
- **UI Multiidioma**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL (11 idiomas)
- **Tiendas de Juegos**: Steam, Epic Games, GOG, Origin, Battle.net, Ubisoft, itch.io, Amazon Games
- **NUEVO v1.0.5**: Voice Clone Studio, VR Text Overlay, Quality Gates, Player Feedback
- **NUEVO v1.0.6**: Qwen 3 (idiomas asiáticos), NLLB-200 (200 idiomas), correcciones
- **NUEVO v1.0.7**: Community Hub, GitHub Discussions, Licencia v1.1
- **NUEVO v1.0.8**: Corrección de descarga de actualizaciones
- **NUEVO v1.0.9**: Cabeceras animadas, notificaciones de actualización, mejoras de UI

---

## Primer Inicio y Perfiles

### Creación de Perfil

En el primer inicio, GameStringer requiere crear un perfil de usuario:


1. **Haz clic en "Crear Perfil"** en la pantalla inicial
2. **Introduce un nombre** para el perfil (ej. "MiNombre")
3. **Establece una contraseña** (mínimo 6 caracteres)
4. **Haz clic en "Crear"** para confirmar

### Inicio de Sesión

Para acceder a un perfil existente:


1. **Selecciona el perfil** de la lista
2. **Introduce la contraseña**
3. **(Opcional)** Marca "Recordar contraseña" para inicio automático
4. **Haz clic en "Acceder"**

### Gestión de Perfiles

- **Cambiar perfil**: Haz clic en el icono de perfil arriba a la derecha → "Cambiar perfil"
- **Cerrar sesión**: Haz clic en el icono de perfil → "Cerrar sesión"
- **Configuración de perfil**: Ve a Ajustes → Perfil

---

## Biblioteca y Detalles del Juego

### Biblioteca

La Biblioteca muestra todos tus juegos sincronizados de Steam, Epic Games, GOG y otras tiendas.

- **Actualizar**: Recarga la lista de juegos
- **Compartidos**: Mostrar/ocultar juegos de Family Sharing
- **Filtros**: Filtrar por plataforma, estado de instalación, motor

### Página de Detalles del Juego

Haz clic en un juego para abrir la página de detalles con diseño **3:1**:

#### Columna Principal (75%)

- **Galería de Capturas**: Cuadrícula de hasta 12 capturas clicables (lightbox)
- **Info Rápida**: Motor, número de archivos, ruta de instalación, DLC
- **Pestañas Archivos/Traducciones/Parche**:
  - **Archivos**: Archivos traducibles encontrados con botón "Neural Translator"
  - **Traducciones**: Traducciones activas para este juego
  - **Parche**: Instalar/eliminar parches para Unity, Unreal, RPG Maker

#### Barra Lateral Derecha (25%)

- **Info del Juego**: Desarrollador, editor, fecha de lanzamiento, géneros, idiomas soportados
- **Acciones**: Traducir Juego, Escanear Archivos
- **HowLongToBeat**: Tiempo estimado para completar el juego

#### Recomendación de Traducción

Al final de la página, el sistema analiza el juego y sugiere el **mejor método de traducción**:

| Método | Cuándo usarlo |
|--------|---------------|
| **Live Unity** | Juegos Unity con BepInEx + XUnity |
| **File Translation** | Archivos de localización encontrados (JSON, CSV, etc.) |
| **OCR Overlay** | Sin archivos encontrados, traducción visual en tiempo real |

---

## Neural Translator Pro

### Cómo Traducir un Archivo

1. **Selecciona un juego** de la biblioteca Steam o carga manualmente
2. **Carga el archivo** a traducir (arrastrar y soltar o explorar)
3. **Configura las opciones**:
   - **Idioma origen**: el idioma original (ej. Inglés)
   - **Idioma destino**: el idioma de destino (ej. Español)
   - **Proveedor AI**: Claude (recomendado), Gemini o GPT
   - **API Key**: introduce tu clave API del proveedor elegido
4. **Inicia la traducción** haciendo clic en "Iniciar Traducción"
5. **Monitoriza el progreso** en la barra de progreso

### Opciones Avanzadas

| Opción | Descripción |
|--------|-------------|
| **Quality Checks** | Verificación automática de calidad (números, formato, etc.) |
| **Translation Memory** | Reutiliza traducciones anteriores para acelerar |
| **Batch Size** | Número de cadenas traducidas en paralelo (por defecto: 10) |

### Costes Estimados

El sistema muestra una estimación de costes antes de iniciar:

- **Claude**: ~$0.003 por 1K tokens
- **Gemini**: ~$0.0005 por 1K tokens (más económico)
- **GPT-4**: ~$0.01 por 1K tokens

---

## Translation Wizard

El Translation Wizard es un procedimiento guiado para traducir automáticamente archivos de juegos.

### Cómo Usar el Wizard

1. **Ve a Translator** → haz clic en "Translation Wizard"
2. **Selecciona el juego** de la biblioteca o introduce la ruta manualmente
3. **Escanea archivos**: el wizard encuentra automáticamente archivos traducibles
4. **Selecciona archivos** a traducir (puedes seleccionar varios)
5. **Configura las opciones**:
   - Idioma origen y destino
   - Proveedor AI
   - Opciones de calidad
6. **Inicia la traducción por lotes**
7. **Monitoriza el progreso** en la barra de progreso

### Formatos Detectados Automáticamente

| Extensión | Tipo |
|-----------|------|
| `.json` | Localización JSON |
| `.csv` | Tablas de texto |
| `.xml` | Configuraciones XML |
| `.po/.pot` | Gettext (estándar Linux) |
| `.txt` | Texto plano |
| `.yaml` | Configuración YAML |

---

## Translation Bridge

Translation Bridge permite traducir juegos Unity **en tiempo real** durante el juego.

### Requisitos

- Juego Unity (Mono o IL2CPP)
- BepInEx instalado
- Plugin XUnity.AutoTranslator

### Cómo Configurar

1. **Ve a Translation Bridge** en el menú
2. **Selecciona el juego Unity** de la lista
3. **Instala BepInEx** (automático si no está presente)
4. **Configura XUnity.AutoTranslator**:
   - Idioma de destino
   - Endpoint de traducción
5. **Inicia el juego** - las traducciones aparecerán automáticamente

### Modos de Funcionamiento

- **Caché local**: Traducciones guardadas para reutilización
- **Traducción en vivo**: Nuevas cadenas traducidas al vuelo
- **Fallback**: Si está offline, usa solo la caché

---

## Subtitle Translator Pro

> NUEVO en v1.0.4

Subtitle Translator Pro permite traducir subtítulos en varios formatos.

### Formatos Soportados

| Formato | Extensión | Descripción |
|---------|-----------|-------------|
| **SubRip** | .srt | Formato más común |
| **WebVTT** | .vtt | Estándar web |
| **ASS/SSA** | .ass/.ssa | Subtítulos avanzados con estilos |

### Cómo Usar

1. **Ve a Subtitle Translator** en el menú
2. **Carga el archivo** de subtítulos (arrastrar y soltar o explorar)
3. **Selecciona idioma** origen y destino
4. **Vista previa en tiempo real** de las traducciones
5. **Exporta** en el formato deseado

### Funcionalidades

- **Validación QA**: Control automático de timing y formato
- **Vista previa sincronizada**: Ve las traducciones con el timing original
- **Exportación multi-formato**: Convierte entre SRT, VTT, ASS

---

## Retro ROM Tools

> NUEVO en v1.0.4

Herramientas para traducir juegos retro en ROMs.

### Consolas Soportadas

| Consola | Abreviación |
|---------|-------------|
| Nintendo Entertainment System | NES |
| Super Nintendo | SNES |
| Game Boy | GB |
| Game Boy Color | GBC |
| Game Boy Advance | GBA |
| Sega Genesis/Mega Drive | Genesis |
| PlayStation 1 | PSX |
| Nintendo 64 | N64 |

### Funcionalidades (2)

- **Table File Parser**: Lee y genera archivos .TBL para mapeo de caracteres
- **Font Injection**: Inyecta fuentes con caracteres acentuados
- **Editor Hex integrado**: Modificación directa de ROMs

### Cómo Usar (2)

1. **Ve a Retro ROM Tools** en el menú
2. **Carga la ROM** del juego
3. **Carga o genera** el Table File (.TBL)
4. **Extrae el texto** de la ROM
5. **Traduce** con AI o manualmente
6. **Inyecta** las traducciones en la ROM

---

## API Pública v1

> NUEVO en v1.0.4

GameStringer expone una API REST para integraciones externas.

### Endpoints Disponibles

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/v1/translate` | Traducción de cadena individual |
| `POST` | `/api/v1/batch` | Traducción por lotes (máx 100 cadenas) |
| `GET` | `/api/v1/languages` | Lista de 20 idiomas soportados |
| `GET` | `/api/v1/health` | Comprobación de salud del servicio |

### Ejemplo de Petición

```json
POST /api/v1/translate
{
  "text": "Hello, world!",
  "source": "en",
  "target": "es",
  "provider": "gemini"
}
```

### Ejemplo de Respuesta

```json
{
  "translation": "¡Hola, mundo!",
  "source": "en",
  "target": "es",
  "provider": "gemini",
  "tokens": 12
}
```

### Uso CI/CD

La API es ideal para integrar GameStringer en pipelines de build automatizados.

---

## Voice Clone Studio

> NUEVO en v1.0.5

Clona voces con AI para doblaje automático de juegos.

### Proveedores Soportados

| Proveedor | Tipo | Calidad |
|-----------|------|---------|
| **ElevenLabs** | Cloud | ⭐⭐⭐⭐⭐ Excelente |
| **OpenAI TTS** | Cloud | ⭐⭐⭐⭐ Muy buena |

### Presets de Voz

- 🎭 **Narrador**: Voz calmada y autoritaria
- ⚔️ **Héroe**: Voz valiente y determinada
- 😈 **Villano**: Voz amenazante y profunda
- 👶 **Niño**: Voz joven y alegre
- 🤖 **Robot**: Voz sintética y metálica
- 👻 **Susurro**: Voz baja y misteriosa

### Cómo Usar (3)

1. **Ve a Voice Clone** en el menú
2. **Introduce el texto** a convertir en audio
3. **Selecciona el proveedor** (ElevenLabs u OpenAI)
4. **Elige el preset** de voz
5. **Genera audio** y descarga el archivo MP3/WAV

---

## VR Text Overlay

> NUEVO en v1.0.5

Subtítulos espaciales 3D para juegos VR.

### Headsets Soportados

| Headset | Soporte |
|---------|---------|
| **Oculus Quest/Rift** | ✅ Completo |
| **SteamVR** (Valve Index, HTC Vive) | ✅ Completo |
| **Windows Mixed Reality** | ✅ Completo |

### Presets de Posición

- **Center** - Delante del jugador
- **Bottom** - Abajo (subtítulo clásico)
- **Top** - Arriba (notificaciones)
- **Follow Head** - Sigue la mirada

### Cómo Usar (4)

1. **Ve a VR Overlay** en el menú
2. **Detecta headset** automáticamente
3. **Configura posición** y tamaño de texto
4. **Inicia overlay** antes de lanzar el juego VR
5. Los subtítulos aparecerán en el espacio 3D

---

## Quality Gates

> NUEVO en v1.0.5

Sistema automático de control de calidad de traducciones.

### Controles Automáticos

| Control | Descripción |
|---------|-------------|
| **Placeholder** | Verifica {0}, {1}, %s, etc. |
| **Números** | Números preservados correctamente |
| **Tags HTML** | `<color>`, `<b>`, etc. intactos |
| **Longitud** | Traducción no muy larga/corta |
| **Puntuación** | Coherencia con el original |

### Niveles de Confianza

| Nivel | Puntuación | Color |
|-------|------------|-------|
| 🔴 Crítico | < 40% | Rojo |
| 🟠 Bajo | 40-59% | Naranja |
| 🟡 Medio | 60-74% | Amarillo |
| 🟢 Alto | 75-89% | Verde |
| 💚 Perfecto | 90-100% | Verde oscuro |

### Cómo Usar (5)

1. **Ve a Quality Gates** en el menú
2. **Carga traducciones** (JSON, CSV, o pega)
3. **Analiza** cada cadena automáticamente
4. **Filtra** por nivel de confianza
5. **Exporta informe** en JSON

---

## Player Feedback

> NUEVO en v1.0.5

Recoge y gestiona feedback de jugadores sobre traducciones.

### Categorías de Feedback

- 📝 **Traducción incorrecta** - Significado erróneo
- 🔤 **Error gramatical** - Gramática/ortografía
- 🎭 **Tono inapropiado** - Registro lingüístico incorrecto
- ❓ **No claro** - Traducción confusa
- ✨ **Sugerencia** - Propuesta de mejora

### Sistema de Valoración

⭐⭐⭐⭐⭐ Valoración 1-5 estrellas para cada traducción

### Estados de Feedback

| Estado | Descripción |
|--------|-------------|
| 🆕 Nuevo | Recién recibido |
| 👀 En revisión | En análisis |
| ✅ Resuelto | Corregido |
| ❌ Rechazado | No aplicable |

### Cómo Usar (6)

1. **Ve a Player Feedback** en el menú
2. **Visualiza feedback** recibidos
3. **Filtra** por categoría, estado, valoración
4. **Actualiza estado** del feedback
5. **Exporta** a CSV para análisis

---

## Nuevos Proveedores AI v1.0.6

> NUEVO en v1.0.6

### Qwen 3 - Idiomas Asiáticos

Proveedor optimizado para chino, japonés y coreano.

| Modelo | Parámetros | RAM Requerida |
|--------|------------|---------------|
| `qwen3:4b` | 4B | 4GB |
| `qwen3:8b` | 8B | 8GB |
| `qwen3:14b` | 14B | 16GB |
| `qwen3:32b` | 32B | 32GB |



``bash
ollama pull qwen3:14b
```

**Idiomas optimizados**: 中文 (Chino), 日本語 (Japonés), 한국어 (Coreano)

### NLLB-200 - 200 Idiomas

Proveedor Meta AI con soporte para 200 idiomas, incluyendo los raros.



Tailandés, Vietnamita, Hindi, Árabe
- Suajili, Indonesio, Turco
- Ucraniano, Bengalí, Tamil

**Configuración**:


1. Ve a **Ajustes → API Keys**
2. Introduce **HuggingFace API Key** (gratuito)
3. Selecciona **NLLB-200** como proveedor

### Generic Ollama

Usa cualquier modelo instalado en Ollama para traducciones.



`llama3.2` - Buen equilibrio calidad/velocidad
- `mistral` - Excelente para idiomas europeos
- `gemma2` - Rápido y ligero

---

## Community Hub v1.0.7

> NUEVO en v1.0.7

Hub centralizado para la comunidad de GameStringer.

### GitHub Discussions

Acceso directo a las discusiones de la comunidad:


- **Anuncios**: Noticias y actualizaciones oficiales
- **Q&A**: Preguntas y respuestas de la comunidad
- **Ideas**: Propuestas para nuevas funcionalidades
- **Showcase**: Proyectos y traducciones de la comunidad

### Cómo Acceder

1. **Ve a Community Hub** en el menú lateral
2. **Navega** entre las categorías de discusión
3. **Participa** directamente en GitHub

### Licencia v1.1

- **YouTubers/Streamers**: OK con atribución
- **Forks no comerciales**: Permitidos
- **Uso comercial**: Requiere autorización

---

## Mejoras de UI v1.0.9

> NUEVO en v1.0.9

Actualizaciones estéticas y funcionales de la interfaz.

### Cabeceras Animadas

Todas las páginas de traducción ahora tienen cabeceras con:


- **Efecto "Respiración"**: Gradiente que se expande/contrae suavemente (12s)
- **Sombras profundas**: shadow-xl con tinte azul
- **Gradiente uniforme**: Sky → Blue → Cyan

### Notificaciones de Actualización

La **campana** en la barra de navegación ahora gestiona las actualizaciones:

| Estado | Comportamiento |
|--------|----------------|
| 🔔 Gris | Sin notificaciones |
| 🔔 Amarilla | Notificaciones no leídas |
| 🔔 Verde + pulso | ¡Actualización disponible! |



**Sonido**: Dos tonos melódicos al detectar actualización
- **Badge verde**: Icono de descarga animado
- **Clic**: Abre popup con lista de novedades
- **Botón Descargar**: Abre página de descarga

### Menú Lateral

- **Hover sub-item**: Color verde oscuro (emerald-600)
- **Coherencia visual**: Estilo unificado

### Pantalla de Login

- **Versión bajo el logo**: Muestra v1.0.9 bajo el logo
- **Footer**: Frase ingeniosa en lugar del copyright

---

## Exportación de Parche

El Unity Patcher instala automáticamente BepInEx y XUnity.AutoTranslator en juegos Unity.

### Cómo Usar (7)

1. **Ve a Unity Patcher** en el menú lateral
2. **Selecciona un juego Unity** de la lista (badge verde "Unity")
3. **Elige el idioma** de destino (ej. Español)
4. **Elige el modo**:
   - **Solo captura**: Captura texto para traducción manual
   - **Google Translate**: Traducción automática in-game
   - **DeepL**: Traducción automática de mayor calidad
5. **Haz clic en "Instalar parche"**
6. **Inicia el juego** - pulsa `ALT+T` para abrir el menú XUnity

### Badge de Traducción

Después de la instalación, verás un badge indicando el estado:

| Badge | Significado |
|-------|-------------|
| 🥈 Plata | XUnity con auto-translate activo (Google/DeepL) |
| 🥉 Bronce | Solo captura de texto (traducción manual) |

### Seguimiento de Actividad

Cada parche instalado se registra en **Actividad Reciente** en el Dashboard con:

- Nombre del juego
- Modo de traducción elegido
- Idioma destino

---

## Historial de Actividad

El historial de actividad registra todas las operaciones realizadas.

### Acceso

Ve a **Historial de Actividad** en el menú lateral.

### Tipos de Actividad Registrados

| Icono | Tipo | Descripción |
|-------|------|-------------|
| 🌐 | Translation | Traducciones completadas |
| 🔧 | Patch | Parches creados/aplicados |
| ♻️ | SteamSync | Sincronizaciones Steam |
| ➕ | GameAdded | Juegos añadidos |
| 🎮 | GameLaunched | Juegos iniciados |
| 👤 | ProfileCreated | Perfiles creados |
| ⚙️ | SettingsChanged | Ajustes modificados |

### Filtros Disponibles

- **Por tipo**: Filtrar por categoría de actividad
- **Por fecha**: Seleccionar rango temporal
- **Por juego**: Mostrar solo actividades de un juego específico

---

## Exportación de Parche

Después de completar una traducción, puedes exportar un paquete listo para distribución.

### Botón "Exportar Parche"

Crea un archivo ZIP en tu **Escritorio** conteniendo:

```
📦 NombreJuego_es_patch.zip
├── 📁 translated/          # Archivos traducidos listos para usar
│   └── archivo_traducido.csv
├── 📁 backup/               # Copias de seguridad de archivos originales
│   └── archivo_original.csv
├── 📁 xunity/               # Formato XUnity.AutoTranslator
│   └── AutoTranslator/
│       └── Translation/
│           └── es/
│               └── _Translations.txt
├── 📄 README.txt            # Instrucciones de instalación
└── 📄 metadata.json         # Información de la traducción
```

### Formato XUnity.AutoTranslator

El formato XUnity es compatible con:

- **Juegos Unity** con BepInEx + XUnity.AutoTranslator
- Formato: `texto_original=texto_traducido`

---

## Aplicar al Juego

### Botón "Aplicar al juego"

Instala la traducción **directamente en el juego** automáticamente:


1. **Detecta el motor** del juego (Unity, Unreal, etc.)
2. **Verifica compatibilidad** con los patchers disponibles
3. **Instala el patcher** si es necesario (ej. BepInEx para Unity)
4. **Copia los archivos traducidos** a la carpeta correcta
5. **Configura el juego** para cargar las traducciones

### Motores Soportados

| Motor | Patcher | Estado |
|-------|---------|--------|
| Unity (Mono) | BepInEx + XUnity.AutoTranslator | ✅ Automático |
| Unity (IL2CPP) | BepInEx IL2CPP | ⚠️ Parcial |
| Unreal Engine | - | 🔧 Manual |
| RPG Maker | - | ✅ Sustitución directa |
| Ren'Py | - | ✅ Sustitución directa |

### ¿Qué Pasa con los Archivos Originales?

**¡Los archivos originales SIEMPRE se preservan!**

1. Antes de sobrescribir, se crea una copia de seguridad automática
2. Las copias se guardan en `.gamestringer_backups/` en la carpeta del juego
3. El nombre incluye timestamp: `20241228_001500_nombrearchivo.csv`

---

## Gestión de Copias de Seguridad

### Dónde Encontrar las Copias

Las copias de seguridad se guardan en dos lugares:


1. **En la carpeta del juego**: `[carpeta_juego]/.gamestringer_backups/`
2. **En el paquete ZIP exportado**: carpeta `backup/`

### Cómo Restaurar una Copia



Ve a la sección **Backup** de la app
2. Selecciona el archivo a restaurar
3. Haz clic en **Restaurar**



Encuentra el archivo en `.gamestringer_backups/`
2. Copia el archivo a la ubicación original
3. Renombra eliminando el timestamp

---

## Editor de Traducciones

El Editor permite modificar manualmente las traducciones.

### Estructura Jerárquica

```
📁 Juegos
├── 📁 Decarnation
│   ├── 📄 dialogos.csv (897 cadenas)
│   └── 📄 items.csv (123 cadenas)
└── 📁 Otro Juego
    └── 📄 textos.json (456 cadenas)
```

### Funcionalidades (3)

- **Búsqueda**: encuentra cadenas por texto
- **Filtros**: muestra solo traducciones incompletas, con errores, etc.
- **Sugerencias AI**: solicita nuevas traducciones para cadenas individuales
- **Guardado automático**: los cambios se guardan en el diccionario

---

## Diccionarios

Los diccionarios guardan las traducciones para cada juego.

### Cómo Funcionan

1. Cada juego tiene su propio diccionario separado
2. Las traducciones se guardan automáticamente
3. Se reutilizan para acelerar traducciones futuras
4. Exportables en varios formatos (JSON, CSV, TMX)

### Ubicación de los Diccionarios

```
%APPDATA%/GameStringer/dictionaries/
├── 1672310_decarnation.json
├── 123456_otro_juego.json
└── ...
```

---

## Solución de Problemas

### La traducción es lenta

- **Causa**: Demasiadas cadenas o proveedor lento
- **Solución**: Aumenta el batch size o usa Gemini (más rápido)

### Error de API Key

- **Causa**: Clave API no válida o expirada
- **Solución**: Verifica la clave en el sitio del proveedor

### El patcher no se instala

- **Causa**: Antivirus bloquea BepInEx
- **Solución**: Añade excepción para la carpeta del juego

### Archivo no reconocido

- **Causa**: Formato de archivo no soportado
- **Solución**: Convierte a CSV o JSON

### Traducción con errores de formato

- **Causa**: La IA modificó variables o tags
- **Solución**: Activa "Quality Checks" para detectar automáticamente

---

## Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| `Ctrl + S` | Guardar traducción actual |
| `Ctrl + Z` | Deshacer cambio |
| `Ctrl + F` | Buscar en archivo |
| `Esc` | Cerrar diálogo/panel |

---

## Soporte

- **GitHub**: [github.com/rouges78/GameStringer](https://github.com/rouges78/GameStringer)
- **Issues**: Reporta bugs o solicita funcionalidades
- **Wiki**: Documentación técnica detallada

---

## Novedades v1.4.0

### Radix UI Unificado

La biblioteca UI se migró de paquetes individuales `@radix-ui/react-*` al paquete unificado `radix-ui`:

- **37 componentes migrados** con imports simplificados
- **27 paquetes eliminados** de las dependencias, bundle más ligero
- Sin cambios visuales — misma UI, menos dependencias

### Quality Badges en Translator Pro

Cada fila traducida ahora muestra indicadores de calidad visuales:


- **QualityScoreBadge**: puntuación 0-100 con colores (🟢 ≥80, 🟡 ≥60, 🔴 <60)
- **ContentTypeBadge**: clasifica el tipo de contenido (UI, Diálogo, Narrativa, Sistema, Tutorial, etc.)
- **Vista previa en vivo**: durante la traducción batch, las últimas 3 filas aparecen con puntuación en tiempo real
- **Tabla de detalle**: en la página de resultados, hasta 200 filas con original, traducción, tipo y calidad

### Soporte RTL

- Detección automática de dirección de texto para idiomas RTL (árabe, hebreo)
- Atributo `dir` aplicado dinámicamente al documento HTML

### Ollama Genérico

- Nuevo provider `translateWithOllamaGeneric` para usar cualquier modelo Ollama
- PROVIDER_MAP con mapeo automático de modelos
- Chain presets con fallback automático entre providers

### Optimización de Bundle

- `optimizePackageImports` actualizado con `radix-ui`, `framer-motion`, `recharts`, `cmdk`, `react-hook-form`
- Cero errores TypeScript en archivos fuente

---

## Novedades v1.4.1

### Soporte Completo GOG Galaxy

- **Lectura librería GOG Galaxy 2.0**: lee juegos poseídos desde la base de datos SQLite local
- **Portadas y descripciones vía GOG API**: obtención automática de imágenes y detalles
- **Fusión con juegos instalados**: combina datos del registro con la base de datos Galaxy
- **Enlaces tienda y descarga**: página Store con enlaces directos a GOG Galaxy

### Dashboard Mejorado

- **Tiendas conectadas arriba**: las tiendas están junto al último juego abierto
- **Badges de tienda con conteos reales**: muestra el número real de juegos por tienda
- **Placeholder último juego**: visualización elegante cuando no se ha abierto ningún juego

### Detalle de Juego Mejorado

- **Pestaña Info**: requisitos del sistema, puntuación Metacritic, enlaces de tienda, lista DLC
- **Portadas GOG**: fallback automático para portadas de juegos GOG
- **Descripciones GOG**: obtención de descripción completa vía GOG API

### Correcciones Proveedores AI

- **Proveedores gratuitos nunca bloqueados permanentemente**: MyMemory, Lingva usan cooldown (30s)
- **Steam Wishlist**: nuevo endpoint IWishlistService con fallback legacy

### Rendimiento

- **Caché sessionStorage**: navegación instantánea al volver de detalle a librería
- **Guardado batch de portadas**: guardado con debounce (2s) para evitar race conditions
- **Deduplicación fetch SteamGridDB**: evita peticiones duplicadas en StrictMode

### Build Multiplataforma

- **Script build Node.js**: `build-tauri-cross.js` reemplaza el script solo-PowerShell
- **Soporte Linux**: el workflow GitHub Actions ahora compila para Linux (.deb, .AppImage)
- **Windows**: instalador (.msi, .exe NSIS) y versión portable (.zip)

### Documentación

- **11 guías de usuario**: correcciones markdown lint
- **Numeración de índice corregida**: índice ordenado sin saltos

---

## Novedades v1.4.2

### Community Hub

- **GitHub Discussions**: 12 discusiones creadas en las categorías Announcements, General, Ideas, Q&A, Show and tell, Polls
- **Fetch REST API pública**: el Community Hub ahora carga discusiones sin requerir token GitHub
- **Sidebar renombrada**: "Workshop" → "Steam Workshop" para mayor claridad

### Corrección Update Bell

- **Versión actual correcta**: el fallback en la campana de actualizaciones ahora muestra la versión real de la app
- **NotificationIndicator eliminado**: la campana de notificaciones duplicada ha sido eliminada permanentemente del header

### CI/CD y Seguridad

- **Tauri Signing Key**: configurada para generación automática de `latest.json` firmado en las releases
- **GitHub Secrets**: `TAURI_SIGNING_PRIVATE_KEY` y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` configurados
- **Workflow release.yml**: actualizado con variables de firma para ambos jobs (Windows + Linux)

---

*GameStringer v1.4.2 - Guía actualizada 03/03/2026*
