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
24. [Glosario](#glosario)
25. [Context Harvester](#context-harvester)
26. [Memoria de Traducción](#memoria-de-traducción)
27. [Traductor OCR](#traductor-ocr)
28. [Revisión IA](#revisión-ia)
29. [Pipeline IA](#pipeline-ia)
30. [Traductor de Emociones](#traductor-de-emociones)
31. [Adaptación Cultural](#adaptación-cultural)
32. [Mapa de Calor de Confianza](#mapa-de-calor-de-confianza)
33. [Gestor de Blog](#gestor-de-blog)
34. [Ren'Py Patcher](#renpy-patcher)
35. [RPG Maker Patcher](#rpg-maker-patcher)
36. [Wolf RPG Patcher](#wolf-rpg-patcher)
37. [Danganronpa Patcher](#danganronpa-patcher)
38. [Comparación Multi-LLM](#comparación-multi-llm) *(NUEVO)*
39. [Puntuación de Calidad en Vivo](#puntuación-de-calidad-en-vivo) *(NUEVO)*
40. [Perfiles de Voz de Personaje](#perfiles-de-voz-de-personaje) *(NUEVO)*
41. [Pipeline de Traducción por Voz](#pipeline-de-traducción-por-voz) *(NUEVO)*
42. [OCR Multi-Motor](#ocr-multi-motor) *(NUEVO)*
43. [OCR Retro-Juegos](#ocr-retro-juegos) *(NUEVO)*
44. [MT Adaptativa](#mt-adaptativa) *(NUEVO)*
45. [Traductor Batch de Carpetas](#traductor-batch-de-carpetas) *(NUEVO)*
46. [Traductor Offline](#traductor-offline) *(NUEVO)*
47. [Traductor Manga/Cómic](#traductor-mangacómic) *(NUEVO)*
48. [Traductor de Texturas](#traductor-de-texturas) *(NUEVO)*
49. [Auto-Glosario](#auto-glosario) *(NUEVO)*

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
```text

### Ejemplo de Respuesta

```json
{
  "translation": "¡Hola, mundo!",
  "source": "en",
  "target": "es",
  "provider": "gemini",
  "tokens": 12
}
```text

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

```text

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

```text

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

```text

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

```text

📁 Juegos
├── 📁 Decarnation
│   ├── 📄 dialogos.csv (897 cadenas)
│   └── 📄 items.csv (123 cadenas)
└── 📁 Otro Juego
    └── 📄 textos.json (456 cadenas)

```text

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

```text

%APPDATA%/GameStringer/dictionaries/
├── 1672310_decarnation.json
├── 123456_otro_juego.json
└── ...

```text

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

## Glosario

El Glosario gestiona diccionarios de terminología personalizados para cada juego, garantizando consistencia.

### Funciones

- **Niveles de términos**:
  - 🔴 **Locked** — término siempre traducido de forma idéntica (nombres propios, hechizos, lugares)
  - 🟡 **Synced** — traducción consistente, adaptable al contexto
  - 🟢 **Flexible** — traducción libre
- **Categorías**: personaje, lugar, objeto, habilidad, quest, UI, sistema, lore, criatura, facción
- **Extracción automática**: análisis IA para sugerir términos
- **Verificación de consistencia**: comprueba que cada término se traduzca uniformemente
- **Importar/Exportar**: CSV y JSON para compartir glosarios entre juegos

### Cómo usarlo

1. Ve a **Herramientas Avanzadas → Glosario**
2. Selecciona el juego de la lista
3. Añade términos manualmente o usa **"Extraer términos"** para sugerencias IA
4. Establece el nivel para cada término
5. El glosario se aplica automáticamente durante las traducciones

---

## Context Harvester

Analiza strings de texto para clasificarlos y enriquecerlos con contexto antes de la traducción IA.

### Funciones

- **Clasificación automática**: identifica tipo de pantalla (menú, diálogo, narrativa, tutorial, sistema)
- **Reconocimiento de hablante**: infiere quién habla y el tono (formal, coloquial, agresivo)
- **Metadatos de contexto**: cada string recibe género de juego, tipo de contenido y tono
- **Guardado de harvest**: contextos extraídos guardados y reutilizados en sesiones futuras
- **Procesamiento por lotes**: analiza archivos enteros en una operación

### Cómo usarlo

1. Ve a **Herramientas Avanzadas → Context Harvester**
2. Pega los strings o carga un archivo
3. Haz clic en **"Analizar"** para clasificar cada string
4. Descarga el resultado JSON como entrada para traducciones IA

---

## Memoria de Traducción

Base de datos persistente de todas las traducciones realizadas, con reutilización automática.

### Funciones

- **Reutilización automática**: strings ya traducidos se sugieren sin nueva llamada IA
- **Búsqueda**: por texto original, traducción o nombre de juego
- **Filtro por juego**: muestra solo traducciones de un título específico
- **Estadísticas**: unidades totales, distribución por juego, fecha de última modificación
- **Exportar**: JSON, CSV, TMX para otros herramientas CAT
- **Importar**: importa traducciones existentes desde TMX o CSV

### Cómo usarlo

1. Ve a **Herramientas Avanzadas → Memoria de Traducción**
2. Busca traducciones anteriores con la barra de búsqueda
3. Edita o elimina unidades individuales según necesidad
4. La memoria se consulta automáticamente durante traducciones IA

---

## Traductor OCR

Captura texto de cualquier ventana de juego o captura de pantalla en tiempo real y lo traduce instantáneamente.

### Funciones

- **Captura en tiempo real**: analiza la pantalla en intervalos configurables
- **Idiomas de origen**: japonés, inglés, chino simplificado, coreano
- **Selección de ventana**: apunta directamente a la ventana del juego
- **Selección de región**: define un área específica de pantalla
- **Confianza**: muestra nivel de fiabilidad para cada texto detectado
- **Tecla rápida global**: activa/desactiva captura con atajo de teclado
- **Caché de traducciones**: reutiliza traducciones anteriores para strings idénticos

### Cómo usarlo

1. Ve a **Traductor OCR** desde la barra lateral
2. Selecciona el idioma de origen del juego
3. Haz clic en **"Seleccionar ventana"** y elige la ventana del juego
4. *(Opcional)* Establece una región específica con **"Seleccionar región"**
5. Pulsa **"Iniciar"** para comenzar la captura y traducción automática

---

## Revisión IA

Revisión automática de calidad de traducciones con detección de errores y sugerencias.

### Funciones

- **Modo singular**: revisión de un par original/traducción
- **Modo lote**: revisión masiva en formato `original|traducción` por línea
- **Categorías de problemas**: exactitud, fluidez, terminología, tono, estructura
- **Niveles de gravedad**: crítico, advertencia, info
- **Auto-fix**: corrección automática de problemas menores
- **Estadísticas**: puntuación global 0–100 por lote

### Cómo usarlo

1. Ve a **Herramientas Avanzadas → Revisión IA**
2. Elige entre **Singular** o **Lote**
3. Pega el texto original y la traducción
4. Haz clic en **"Revisar"** para recibir el informe
5. Usa **"Auto-fix"** para aplicar las correcciones sugeridas

---

## Pipeline IA

Flujo de trabajo automatizado de 6 pasos para obtener traducciones de máxima calidad con un clic.

### Pasos del Pipeline

1. **Harvest** — extrae y clasifica contexto
2. **Translate** — traduce con el proveedor IA configurado
3. **QA Check** — verificación automática de calidad
4. **Auto-Fix** — corrige problemas encontrados
5. **Review** — revisión IA final
6. **Score** — calcula puntuación final 0–100

### Preajustes disponibles

- **Quick** — pasos esenciales (Translate + QA Check)
- **Max Quality** — los 6 pasos en secuencia

### Cómo usarlo

1. Ve a **Herramientas Avanzadas → Pipeline IA**
2. Pega los strings a traducir
3. Elige un preajuste o configura los pasos manualmente
4. Haz clic en **"Ejecutar Pipeline"**
5. Descarga el informe final con puntuaciones por string

---

## Traductor de Emociones

Traducción que analiza y preserva las emociones presentes en el diálogo original.

### Funciones

- **Análisis emocional**: detecta la emoción predominante (ira, tristeza, miedo, alegría, neutral, sorpresa, asco)
- **Intensidad**: mide el nivel de intensidad emocional (0–100)
- **Preservación del tono**: guía a la IA para mantener el mismo impacto emocional
- **EmotionBadge**: etiqueta visual por string con emoción e intensidad
- **Estadísticas por lotes**: distribución de emociones en un archivo completo

### Cómo usarlo

1. Ve a **Herramientas Avanzadas → Traductor de Emociones**
2. Pega el texto a traducir
3. Selecciona el idioma de destino
4. Haz clic en **"Analizar y Traducir"**
5. El resultado muestra la traducción con las emociones identificadas

---

## Adaptación Cultural

Analiza texto traducido para identificar elementos culturalmente problemáticos y propone adaptaciones.

### Funciones

- **Culturas soportadas**: IT, EN, DE, FR, ES, JA, KO, ZH, PT, RU
- **Categorías analizadas**: expresiones idiomáticas, referencias culturales, medidas/monedas, colores simbólicos, fórmulas de cortesía, humor
- **Sugerencias específicas**: alternativa adaptada a la cultura objetivo
- **Puntuación de adaptación**: porcentaje de texto que requiere revisión

### Cómo usarlo

1. Ve a **Herramientas Avanzadas → Adaptación Cultural**
2. Pega el texto traducido
3. Selecciona cultura de origen y destino
4. Haz clic en **"Analizar"**
5. Aplica las sugerencias antes de la publicación final

---

## Mapa de Calor de Confianza

Visualiza la calidad de cada traducción mediante un mapa codificado por colores, identificando instantáneamente las cadenas problemáticas.

### Funciones

- **8 métricas analizadas**: marcadores de posición faltantes, cadenas vacías, sin traducir, puntuación, mayúsculas, etiquetas HTML, longitud, números
- **Código de colores**:
  - 🟢 **Excelente** (90–100%) — traducción correcta
  - 🔵 **Buena** (75–89%) — pequeños problemas de estilo
  - 🟡 **Aceptable** (60–74%) — problemas menores
  - 🟠 **Revisar** (40–59%) — errores significativos
  - 🔴 **Deficiente** (<40%) — errores críticos
- **3 modos de entrada**: demo integrada, pegar texto (`original|traducción` por línea), cargar archivo (JSON/CSV/TXT)
- **Exportar informe**: descarga JSON con puntuaciones y problemas para cada cadena

### Cómo usarlo

1. Ve a **Herramientas Avanzadas → Mapa de Calor de Confianza**
2. Elige modo: **Demo** para ver un ejemplo, **Pegar** para entrada manual, **Archivo** para cargar
3. Haz clic en **"Analizar"**
4. Revisa el informe de colores: las cadenas rojas/naranjas necesitan revisión prioritaria
5. Usa **"Exportar Informe"** para guardar el resultado en JSON

---

## Gestor de Blog

Gestiona un blog de noticias y actualizaciones para el proyecto de traducción, visible en el panel de control.

### Funciones

- **Crear entradas**: título, fecha, descripción breve, etiqueta de categoría
- **Etiquetas disponibles**: Feature, UI, Fix, Security, AI, Update, News
- **Fijar**: ancla las entradas importantes en la parte superior de la lista
- **Edición en línea**: edita cualquier entrada sin cambiar de página
- **Eliminar entrada**: eliminación con confirmación
- **Visualización**: lista cronológica con fecha estilizada, insignia de etiqueta de color y vista previa de descripción

### Cómo usarlo

1. Ve a **Gestor de Blog** desde el menú principal
2. Haz clic en **"Nueva Entrada"**
3. Rellena fecha (ej. "24 Ene"), título (con emojis recomendados), descripción y etiqueta
4. Haz clic en **"Guardar"**
5. Usa el icono 📌 para fijar una entrada en la parte superior

---

## Ren'Py Patcher

Patcher dedicado para novelas visuales creadas con el motor Ren'Py. Extrae diálogos, menús y narración de archivos `.rpy` y genera los archivos de traducción nativos.

### Funciones

- **Detección automática**: identifica título, versión y archivos de script del juego
- **Tipos de cadena**: Diálogo, Menú, Narración
- **Identificación de personaje**: muestra qué personaje dice cada línea
- **Editor en línea**: haz clic en cualquier cadena para editar su traducción
- **Buscar y filtrar**: busca por texto o personaje, filtra por tipo
- **Generar archivos `.rpy`**: crea la estructura `tl/<idioma>/` compatible con Ren'Py
- **Guardar/Cargar JSON**: guarda el progreso y continúa más tarde
- **Estadísticas**: porcentaje de completación, recuento por tipo

### Cómo usarlo

1. Ve a **Ren'Py Patcher** desde la barra lateral
2. Haz clic en **"Examinar"** y selecciona la carpeta del juego Ren'Py
3. Haz clic en **"Extraer Cadenas"**
4. Edita traducciones en el editor (haz clic en una cadena para editarla)
5. Introduce el nombre del idioma objetivo (ej. `spanish`) y haz clic en **"Generar .rpy"**
6. Los archivos se guardan en la carpeta `tl/` del juego

---

## RPG Maker Patcher

Patcher dedicado para juegos RPG Maker (MV, MZ, XP, VX, VX Ace). Lee los archivos `.json` y `.rxdata`/`.rvdata` del proyecto.

### Funciones

- **Detección de versión**: identifica automáticamente MV/MZ/XP/VX/Ace
- **Archivos soportados**: Actors, Classes, Skills, Items, Weapons, Armors, Enemies, Troops, States, Maps, CommonEvents, System
- **Estadísticas por archivo**: progreso de traducción desglosado por archivo
- **Integración Translator++**: enlace directo de descarga de Translator++
- **Exportar parche**: guarda traducciones como JSON
- **Editor**: búsqueda de texto completo, edición en línea

### Cómo usarlo

1. Ve a **RPG Maker Patcher** desde la barra lateral
2. Selecciona la carpeta del proyecto RPG Maker
3. Haz clic en **"Extraer Cadenas"**
4. Traduce cadenas en el editor
5. Haz clic en **"Guardar Parche"**

---

## Wolf RPG Patcher

Patcher dedicado para juegos Wolf RPG Editor. Maneja archivos binarios `.wolf` y mapas del juego.

### Funciones

- **Archivos soportados**: Data/*.wolf (base de datos), Map/*.mps (mapas)
- **Tipos de cadena**: Base de datos, Mapa, Script, Evento
- **Detección de cifrado**: avisa si el juego usa archivos cifrados
- **Integración WolfTrans**: sugiere WolfTrans para archivos cifrados
- **Barra de progreso**: porcentaje de completación para todo el proyecto
- **Guardar/Cargar**: JSON para reanudar el trabajo

### Cómo usarlo

1. Ve a **Wolf RPG Patcher** desde la barra lateral
2. Selecciona la carpeta del juego Wolf RPG
3. Haz clic en **"Extraer Cadenas"**
4. Si el juego está cifrado, sigue las instrucciones de WolfTrans
5. Traduce cadenas y haz clic en **"Guardar"**

---

## Danganronpa Patcher

Patcher dedicado para la serie de juegos Danganronpa. Maneja archivos `.pak` y archivos de localización `.po`.

### Funciones

- **Detección de juego**: identifica automáticamente DR1, DR2, V3
- **Archivos PAK**: extrae y lista archivos en archivos `.pak`
- **Archivos PO**: soporte nativo para `.po`/`.pot` con estado traducido/no traducido/difuso
- **Traducción IA integrada**: botón para traducir automáticamente cadenas con la IA configurada
- **Estadísticas PO**: recuento de traducido, no traducido, difuso y porcentaje
- **Integración DRAT**: enlace a la herramienta DRAT para operaciones avanzadas
- **Exportar parche**: exporta el archivo `.po` modificado

### Cómo usarlo

1. Ve a **Danganronpa Patcher** desde la barra lateral
2. Selecciona la carpeta del juego Danganronpa
3. Extrae el archivo `.pak` o carga directamente un archivo `.po`
4. Edita cadenas en el editor o usa **"Traducir con IA"**
5. Exporta el archivo `.po` completado para reimportarlo al juego

---

## Comparación Multi-LLM

La Comparación Multi-LLM envía el mismo texto a múltiples proveedores de IA en paralelo y selecciona automáticamente la mejor traducción.

### Proveedores soportados

- **OpenAI** (GPT-4o)
- **Gemini** (Google)
- **Claude** (Anthropic)
- **DeepSeek**
- **Mistral**
- **DeepL**
- **Libre Translate**

### Funciones

- **Comparación paralela**: traducción simultánea con 2–7 proveedores
- **Selección automática**: el sistema elige la traducción con mayor puntuación
- **Traducción de consenso**: cuando varios modelos coinciden, se genera una versión combinada
- **Puntuación de calidad**: cada traducción recibe una puntuación en fluidez, precisión, coherencia y estilo
- **Perfiles de personaje**: aplica un perfil de voz para personalizar tono y vocabulario

### Cómo usarlo

1. Ve a **Translator → Compare** desde la barra lateral
2. Introduce el texto de origen y selecciona el idioma de destino
3. Elige al menos 2 proveedores de la barra superior
4. Haz clic en **"Comparar"** para lanzar las traducciones en paralelo
5. Revisa los resultados con puntuación y elige tu traducción preferida, o usa la seleccionada automáticamente

---

## Puntuación de Calidad en Vivo

El sistema de Puntuación de Calidad en Vivo evalúa automáticamente cada traducción en múltiples dimensiones, asignando una puntuación numérica y una categoría.

### Dimensiones evaluadas

| Dimensión | Descripción |
|---|---|
| **Fluidez** | Naturalidad y legibilidad en el idioma de destino |
| **Precisión** | Fidelidad al significado original |
| **Coherencia** | Consistencia terminológica con el resto del proyecto |
| **Estilo** | Adecuación del tono y registro al contexto del juego |

### Categorías de puntuación

- **Excelente** (90–100): traducción lista para publicación
- **Buena** (75–89): pequeñas mejoras opcionales
- **Aceptable** (60–74): revisión recomendada
- **A revisar** (40–59): correcciones necesarias
- **Deficiente** (0–39): retraducción necesaria

### Controles automáticos

- Preservación de números y marcadores de posición (`{0}`, `%s`, etc.)
- Coherencia en la longitud respecto al original
- Detección de palabras no traducidas
- Verificación de puntuación y formato

---

## Perfiles de Voz de Personaje

Los Perfiles de Voz de Personaje permiten personalizar las traducciones según la personalidad de cada personaje del juego.

### Arquetipos disponibles

Hero, Villain, Mentor, Sidekick, Love Interest, Comic Relief, Mysterious Stranger, Noble, Pirate, Warrior, Wizard, Merchant, Child, Robot, Monster, Narrator — o **Custom**.

### Parámetros configurables

- **Personalidad**: arquetipo, rasgos de carácter, estado de ánimo, edad, género
- **Estilo de habla**: formalidad (muy formal → muy informal), vocabulario (arcaico, sofisticado, estándar, simple, jerga, técnico), longitud de frases, puntuación
- **Patrones**: muletillas, palabras de relleno, sufijos finales, palabras a evitar, sustituciones preferidas
- **Voz TTS** *(opcional)*: proveedor (OpenAI, ElevenLabs, Azure), voz, tono, velocidad, emoción
- **Ejemplos de diálogo**: pares original/traducido para guiar a la IA

### Cómo usarlo

1. Abre el **Character Profile Manager** desde el panel de traducción
2. Elige un arquetipo predefinido o crea un perfil personalizado
3. Configura personalidad, estilo, patrones y vocabulario
4. Añade ejemplos de diálogo para mejorar la coherencia
5. Guarda el perfil — se aplicará automáticamente en futuras traducciones para ese personaje

---

## Pipeline de Traducción por Voz

La Pipeline de Traducción por Voz transforma audio hablado en texto traducido y sintetizado en otro idioma, en un único flujo de extremo a extremo.

### Etapas de la pipeline

1. **Grabación / Carga**: graba audio desde el micrófono o sube un archivo de audio
2. **Transcripción (Whisper)**: conversión de voz a texto mediante OpenAI Whisper
3. **Traducción IA**: traducción del texto transcrito al idioma de destino
4. **Síntesis de voz (TTS)**: generación del audio traducido con voces sintéticas

### Voces disponibles

| Voz | Característica |
|---|---|
| **Nova** | Femenina, natural |
| **Alloy** | Neutra, versátil |
| **Echo** | Masculina, cálida |
| **Fable** | Narrativa, expresiva |
| **Onyx** | Masculina, profunda |
| **Shimmer** | Femenina, brillante |

### Cómo usarlo

1. Ve a **Voice Translator** desde la barra lateral
2. Graba audio con el micrófono o sube un archivo `.wav`/`.mp3`
3. El sistema transcribe automáticamente el audio con Whisper
4. Selecciona el idioma de destino e inicia la traducción
5. Elige una voz TTS y genera el audio traducido
6. Reproduce o descarga el resultado

> **Nota**: Requiere una clave API de OpenAI configurada para Whisper y TTS.

---

## OCR Multi-Motor

OCR Multi-Motor soporta 4 motores OCR con detección automática y fallback inteligente para el reconocimiento de texto en capturas de pantalla de juegos.

### Motores soportados

| Motor | Descripción | Puntos fuertes |
|---|---|---|
| **OneOCR** | Windows 11 AI nativo (puerto 17231) | Fuentes estilizadas, texto superpuesto, baja resolución |
| **PaddleOCR** | Baidu open-source (puerto 8866) | CJK excelente, texto vertical, alta precisión |
| **RapidOCR** | Wrapper ligero ONNX (puerto 9003) | Rápido, ligero, fácil de instalar |
| **Tesseract.js** | Integrado en el navegador | Siempre disponible, 100+ idiomas, sin configuración |

### Funciones

- **Detección automática**: sondeo de motores disponibles al inicio
- **Cadena de fallback**: OneOCR → PaddleOCR → RapidOCR → Tesseract (CJK: PaddleOCR primero)
- **Modo comparación**: ejecuta todos los motores en paralelo y usa el mejor resultado
- **Preprocesamiento de imagen**: escala de grises, contraste, umbral, escalado para texto pequeño
- **Motor preferido**: guarda la preferencia para sesiones futuras

### Cómo usarlo

1. Ve a **OCR Multi-Engine** desde la barra lateral
2. Haz clic en **"Detectar Motores"** para verificar cuáles están en línea
3. Selecciona el motor preferido haciendo clic en la tarjeta correspondiente
4. Sube una captura de pantalla o pega una imagen
5. El sistema reconoce el texto con el motor elegido (o fallback automático)

---

## OCR Retro-Juegos

OCR Retro-Juegos es un módulo especializado para el reconocimiento de texto en capturas de juegos retro con fuentes pixeladas.

### Presets disponibles

| Preset | Era | Optimización |
|---|---|---|
| **8-bit** | NES, Game Boy, MSX | Escalado 4x, umbral alto, eliminación de dithering |
| **16-bit** | SNES, Mega Drive, PC Engine | Escalado 3x, contraste medio, sharpen |
| **DOS/PC** | DOS, EGA/VGA | Escalado 2x, umbral medio, fuente monoespaciada |
| **PC-98** | NEC PC-98 (japonés) | Escalado 3x, umbral alto, optimizado CJK |
| **Early Windows** | Windows 3.1/95/98 | Escalado 2x, contraste ligero |

### Parámetros configurables

- **Escalado**: factor de ampliación (nearest-neighbor para preservar píxeles)
- **Contraste**: aumento del contraste antes del reconocimiento
- **Umbral binario**: conversión a blanco/negro con umbral configurable
- **Eliminación de dithering**: filtra patrones de dithering típicos de juegos retro
- **Sharpen / Denoise**: enfoque y reducción de ruido

### Cómo usarlo

1. Abre el panel **Retro-Game OCR** en la sección OCR
2. Elige un preset de juego o configura los parámetros manualmente
3. Sube la captura del juego retro
4. El sistema preprocesa la imagen y aplica reconocimiento optimizado
5. Revisa y edita el texto reconocido

---

## MT Adaptativa

MT Adaptativa (Traducción Automática Adaptativa) es un sistema que aprende de las correcciones humanas para mejorar progresivamente la calidad de las traducciones.

### Cómo funciona

1. **Guardar correcciones**: cuando corriges una traducción AI, el par (original → corrección) se guarda
2. **Similitud fuzzy**: trigramas (coeficiente Dice) + similitud de palabras (Jaccard) para encontrar correcciones relevantes
3. **Few-shot learning**: las correcciones más similares al texto actual se inyectan en el prompt como ejemplos
4. **Feedback loop**: cuantas más correcciones guardes, mejores serán las traducciones futuras

### Funciones

- **Auto-detección de etiquetas**: tone_change, terminology, major_rewrite, length_change, punctuation, style
- **Boost contextual**: prioridad a correcciones del mismo juego (1.3x), mismo tipo de contenido (1.2x), correcciones recientes
- **Aprobación**: marca las correcciones como verificadas para mayor fiabilidad
- **Import/Export**: exporta e importa conjuntos de correcciones entre proyectos
- **Estadísticas**: número de correcciones por idioma, juego, tipo, etiqueta y uso promedio

### Configuración

| Parámetro | Por defecto | Descripción |
|---|---|---|
| **Max examples** | 5 | Máximo de ejemplos few-shot por prompt |
| **Umbral similitud** | 0.2 | Mínimo de similitud para incluir un ejemplo |
| **Mismo juego** | Sí | Preferir correcciones del mismo juego |
| **Solo aprobadas** | No | Usar solo correcciones marcadas como aprobadas |

---

## Traductor Batch de Carpetas

El Traductor Batch de Carpetas traduce carpetas enteras de archivos en una sola operación, manteniendo la estructura original.

### Funciones

- **Escaneo recursivo**: escanea automáticamente subcarpetas
- **Multi-formato**: soporta CSV, JSON, XML, PO, YAML, TXT, SRT, VTT y más
- **Selección inteligente**: filtra por tipo de archivo, tamaño o patrón
- **Salida flexible**: carpeta de salida personalizable con estructura preservada
- **Traducción paralela**: hasta 3 batches simultáneos para máxima velocidad
- **Translation Memory**: usa y alimenta la memoria de traducción automáticamente
- **Clasificación de contenido**: clasifica las cadenas por tipo (diálogo, UI, sistema) antes de traducir
- **Control de calidad**: QA automático con puntuación mínima configurable
- **Pausa/Reanudar**: pausa y reanuda la traducción en cualquier momento

### Parámetros

| Parámetro | Por defecto | Descripción |
|---|---|---|
| **Tamaño batch** | 40 | Cadenas por llamada API |
| **Paralelos** | 3 | Batches simultáneos |
| **Retardo** | 50ms | Pausa entre batches |
| **Puntuación mín.** | 70 | Umbral mínimo de calidad |
| **Max reintentos** | 3 | Reintentos en caso de error |

### Cómo usarlo

1. Ve a **Batch Translator** desde la barra lateral
2. Selecciona la carpeta fuente con los archivos a traducir
3. Elige idioma fuente, idioma destino y proveedor AI
4. Configura las opciones (TM, QA, clasificación, pipeline)
5. Haz clic en **"Iniciar"** para comenzar la traducción batch
6. Monitorea el progreso en tiempo real — puedes pausar o cancelar

---

## Traductor Offline

El Traductor Offline permite traducir textos sin conexión a internet, utilizando modelos AI locales a través de Ollama. Ningún dato se envía en línea.

### Requisitos

- **Ollama** instalado y en ejecución (`ollama serve`)
- Al menos un modelo de traducción descargado

### Modelos recomendados

| Modelo | Tamaño | Descripción |
|---|---|---|
| **huihui_ai/hy-mt1.5-abliterated:7b** | ~4.5 GB | Tencent HY-MT 1.5 — #1 WMT25, supera a Google Translate en 30/31 idiomas |
| **huihui_ai/hy-mt1.5-abliterated:1.8b** | ~1.2 GB | Versión ligera y ultrarrápida |
| **translategemma:12b** | ~8.0 GB | Google TranslateGemma — 55 idiomas, alta calidad |
| **translategemma:2b** | ~1.5 GB | Google TranslateGemma — 55 idiomas, rápido y ligero |
| **qwen3:4b** | ~2.5 GB | Alibaba Qwen 3 — propósito general, bueno para traducción |

### Funcionalidades

- **Modo individual**: traduce un texto a la vez
- **Modo batch**: traduce múltiples textos (uno por línea) en una sola operación
- **14 idiomas soportados**: IT, EN, FR, DE, ES, PT, RU, JA, KO, ZH, PL, NL, TR, CS
- **Intercambio de idiomas**: intercambia origen y destino con un clic
- **Selección de modelo**: elige entre los modelos instalados en Ollama
- **Historial de resultados**: todos los resultados mostrados con tiempo de traducción
- **Copiar resultados**: copia una traducción individual o todas juntas
- **Configuración integrada**: inicia Ollama y descarga modelos directamente desde la interfaz

### Cómo usarlo

1. Ve a **Traductor Offline** en la barra lateral
2. Si Ollama no está en ejecución, haz clic en **"Iniciar Ollama"** en el panel de configuración
3. Descarga un modelo recomendado (ej. `hy-mt1.5-abliterated:7b`)
4. Selecciona idioma de origen y destino
5. Introduce el texto y haz clic en **"Traducir"** (o Ctrl+Enter)
6. Para batch: activa el modo batch e introduce múltiples líneas

---

## Traductor Manga/Cómic

El Traductor Manga/Cómic es una herramienta especializada para la traducción de cómics y manga, con detección automática de globos, OCR, traducción e inpainting.

### Funcionalidades

- **Detección de globos**: identifica automáticamente los globos de texto en las páginas
- **OCR integrado**: reconoce el texto dentro de los globos (horizontal y vertical)
- **Traducción automática**: traduce el texto reconocido al idioma de destino
- **Inpainting**: elimina el texto original y lo reemplaza con la traducción
- **Estilos de fuente**: Manga Style, Comic Sans, Handwritten, Bold
- **Multi-página**: gestiona múltiples páginas simultáneamente
- **Traducción batch**: procesa todas las páginas en secuencia
- **Exportación**: exporta página individual o todas las páginas traducidas

### Idiomas soportados

JA (japonés), ZH (chino), KO (coreano), EN (inglés), IT (italiano), ES (español), FR (francés), DE (alemán)

### Cómo usarlo

1. Ve a **Manga Translator** en la barra lateral
2. Sube las páginas del manga/cómic (arrastrar y soltar o selección de archivos)
3. Selecciona idioma de origen y destino
4. Haz clic en **"Detectar y Traducir"** para analizar la página actual
5. Revisa los globos detectados y las traducciones
6. Haz clic en **"Inpainting"** para aplicar las traducciones en la imagen
7. Exporta la página traducida

---

## Traductor de Texturas

El Traductor de Texturas traduce el texto presente en las texturas de videojuegos (menús, HUD, botones, UI), preservando el estilo gráfico y la formateación.

### Formatos soportados

| Formato | Descripción |
|---|---|
| **DDS** | DirectDraw Surface (el más común en juegos) |
| **PNG** | Portable Network Graphics |
| **TGA** | Targa |
| **BMP** | Bitmap |
| **JPG** | JPEG |
| **WebP** | WebP |

### Funcionalidades

- **Detección de regiones**: escanea la textura para encontrar áreas con texto
- **OCR para texturas**: reconoce el texto en las regiones detectadas
- **Traducción automática**: traduce el texto preservando el contexto visual
- **Preservar estilo**: mantiene colores de fondo, color de texto, fuente y tamaño
- **Auto-match de fuente**: selecciona automáticamente la fuente más similar
- **Vista previa**: muestra la vista previa de la textura antes y después de la traducción
- **Procesamiento batch**: procesa todas las texturas en secuencia
- **Exportación**: exporta textura individual o todas las texturas modificadas

### Cómo usarlo

1. Ve a **Texture Translator** en la barra lateral
2. Sube las texturas (arrastrar y soltar, selección de archivos o carpeta entera)
3. Selecciona idioma de origen y destino
4. Haz clic en **"Escanear Textura"** para detectar las regiones de texto
5. Revisa y edita las traducciones propuestas
6. Haz clic en **"Aplicar Traducciones"** para generar la textura traducida
7. Exporta las texturas modificadas

---

## Auto-Glosario

El Auto-Glosario extrae automáticamente términos de juego de los textos usando LLM, los guarda en un glosario por juego y los inyecta en los prompts de traducción para garantizar coherencia terminológica.

### Sistema de 3 niveles

| Nivel | Icono | Comportamiento |
|---|---|---|
| **Locked** | 🔒 | Traducción fija, nunca modificada por la AI |
| **Synced** | 🔄 | Traducción preferida, la AI puede sugerir alternativas |
| **Flexible** | 🔓 | Traducción sugerida, la AI elige la mejor |

### Categorías de términos

👤 Personaje, 📍 Ubicación, 🎒 Objeto, ⚔️ Habilidad, 📜 Misión, 🖥️ UI, ⚙️ Sistema, 📚 Lore, 🐉 Criatura, 🏰 Facción, 📌 Otro

### Funcionalidades

- **Extracción automática**: analiza los textos del juego con LLM y extrae los términos clave
- **Términos por defecto**: añade automáticamente términos gaming comunes (HP, XP, NPC, etc.)
- **Búsqueda y filtro**: busca por texto, filtra por nivel o categoría
- **Inyección en prompts**: los términos se inyectan automáticamente en los prompts de traducción
- **Do Not Translate**: marca términos que no deben traducirse
- **Case-sensitive**: opción para términos sensibles a mayúsculas (nombres propios)
- **Import/Export**: exporta e importa glosarios en formato CSV o JSON
- **Control de coherencia**: verifica que los términos se usen de forma coherente en las traducciones
- **Estadísticas**: número de términos por nivel, categoría y origen (auto/manual)

### Configuración

| Parámetro | Por defecto | Descripción |
|---|---|---|
| **Habilitado** | Sí | Activa/desactiva el glosario automático |
| **Extraer en primer batch** | Sí | Extrae términos del primer batch traducido |
| **Max términos por extracción** | 20 | Máximo de términos extraídos por vez |
| **Confianza mínima** | 50 | Umbral mínimo de confianza (0–100) |
| **Inyectar en prompts** | Sí | Inyecta términos en los prompts de traducción |
| **Max términos en prompt** | 30 | Máximo de términos por prompt (limita context window) |

### Cómo usarlo

1. Ve a **Glosario** en la barra lateral
2. Crea un nuevo glosario seleccionando juego, idioma de origen y destino
3. Añade términos manualmente o haz clic en **"Extraer Términos"** para extracción AI
4. Configura el nivel (Locked/Synced/Flexible) y la categoría para cada término
5. Los términos se inyectan automáticamente en los prompts de traducción
6. Usa **"Verificar Coherencia"** para comprobar el uso uniforme de los términos

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

### Vision LLM Translator

- **Traducción context-aware**: usa capturas de pantalla del juego para contexto visual
- **3 proveedores soportados**: Ollama (local), Gemini 2.0 Flash, OpenAI GPT-4o
- **Subir o capturar**: carga una imagen o captura la pantalla para dar contexto a la IA
- **Página dedicada**: `/vision-translator` con sidebar integrada

### Herramientas IA Avanzadas

- **Lore Assistant**: chat RAG para explorar lore y diálogos del juego
- **Auto-Hook Scanner**: escaneo de memoria de procesos con WinAPI
- **System Monitor**: monitoreo VRAM/RAM en tiempo real (backend Rust)
- **Ollama Setup Wizard**: guía de instalación paso a paso de IA local
- **Debug Console**: consola de depuración con intercepción de logs
- **Plugin System**: documento de diseño `PLUGIN_SYSTEM.md`

### Community Hub

- **GitHub Discussions**: 12 discusiones creadas en las categorías Announcements, General, Ideas, Q&A, Show and tell, Polls
- **Fetch REST API pública**: el Community Hub ahora carga discusiones sin requerir token GitHub
- **Sidebar renombrada**: "Workshop" → "Steam Workshop" para mayor claridad

### Corrección Proveedores de Traducción

- **Ollama cooldown**: errores de red ahora usan cooldown de 30s en lugar de bloqueo permanente
- **Lingva 404**: truncamiento automático de textos >500 caracteres para evitar URLs demasiado largos
- **Auto-Translate Review**: nuevo botón "Traducir todas las no traducidas" con barra de progreso y stop
- **Tutorial querySelector**: fix SyntaxError con selectores `:contains()` (no CSS estándar)
- **Update Bell**: fix versión incorrecta en popup (fallback hardcoded eliminado)

### CI/CD y Seguridad

- **Tauri Signing Key**: configurada para generación automática de `latest.json` firmado en las releases
- **GitHub Secrets**: `TAURI_SIGNING_PRIVATE_KEY` y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` configurados
- **Workflow release.yml**: actualizado con variables de firma para ambos jobs (Windows + Linux)

### Unity: Auto-Instalación de BepInEx + XUnity AutoTranslator

- **Detección automática de Unity**: si el escáner no encuentra archivos traducibles en un juego Unity, muestra una tarjeta dedicada en lugar de un error genérico
- **Instalación con un clic**: el botón "Instalar BepInEx + XUnity AutoTranslator" detecta automáticamente el exe del juego, instala el framework y el plugin de traducción con logs en tiempo real
- **Flujo guiado**: tras la instalación, sugiere iniciar el juego una vez y volver a escanear — todos los textos se vuelven traducibles
- **Créditos**: BepInEx Team y bbepis (XUnity AutoTranslator)

---

*GameStringer v1.4.2 - Guía actualizada 03/03/2026*
