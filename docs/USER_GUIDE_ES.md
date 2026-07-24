# GameStringer - Guía Completa

## 🆕 Novedades en v1.15.0

- ⚙️ **Parámetros de inferencia de Ollama**: nueva página *Ollama Manager → Avanzado* con 3 presets (Fiel/Equilibrado/Creativo) y un modo experto para ajustar `temperature`, `top_p`, `top_k`, `repeat_penalty`, `num_ctx` y `seed` de los modelos locales.
- 🚀 **Proyectos ↔ Patch Hub**: cada `.gspack` importado se registra como un proyecto completado; desde Proyectos puedes **Aplicar al juego** (con copia de seguridad `.bak`) o **Publicar** la traducción pre-rellenada en el Patch Hub.
- 💬 **Widget de feedback** en *Ajustes → Comunidad*: reporta errores o ideas con el contexto técnico adjuntado automáticamente (versión, plataforma, pantalla).
- ⚡ **Patch Hub más rápido**: caché local de la lista y límites anti-abuso para moverte entre pestañas sin recargar del servidor cada vez.

## 🆕 Novedades en v1.12.0

- 👁️ Traducción con contexto visual (VLM): la IA ve la pantalla y traduce con contexto, resolviendo palabras ambiguas (p. ej. "Chest" = cofre o pecho). Local (Ollama) u OpenAI/Gemini
- 🪞 Pasada autocorrectiva (Reflection): una segunda pasada opcional revisa y refina la traducción según glosario, tono y coherencia — solo donde hace falta
- 🧠 Memoria semántica (RAG): memoria de traducción y glosario emparejados por significado mediante embeddings locales, para una terminología coherente en todo el juego
- ⚡ Traducción en vivo más fluida y procesamiento nativo de capturas (recorte/redimensionado antes de la llamada a la IA)
- 🔌 Más proveedores listos para usar: DeepL, Groq, Cerebras, Cohere, Together, Fireworks, Hugging Face, Azure Translator, DashScope, LibreTranslate, Lingva, MyMemory
- 🧰 Nuevos ajustes para regular reflection, RAG semántico y contexto visual (calidad vs. velocidad/coste)

## 🆕 Novedades en v1.11.2

- **Más tiendas**: ahora se detectan automáticamente Humble App, Game Jolt y Big Fish Games.
- **Búsqueda de traducción**: comprueba vía PCGamingWiki si un juego ya trae tu idioma, con enlaces de búsqueda de parches ITA no oficiales.
- **Publicar en el Patch Hub**: envía un proyecto completado al Patch Hub de la comunidad en un paso (Proyectos → Publicar).
- **Nuevos motores**: pipeline en la nube para TyranoScript y un parser `.pck` reescrito que lee archivos reales de Godot 4.4+.
- **Unity**: puente Ollama local para XUnity (CustomTranslate); las descargas (BepInEx/XUnity/TMP/UABEA) se resuelven vía la API de GitHub.

## Índice

1. [Configuración Inicial](#fase-1-configuración-inicial)
2. [Conexión de Tiendas](#fase-2-conexión-de-tiendas)
3. [Biblioteca de Juegos](#fase-3-biblioteca-de-juegos)
4. [Traducir Juego (Auto-Translate)](#fase-4-traducir-juego)
5. [Patcher Engine](#fase-5-patcher-engine)
6. [Unity CSV Translator](#fase-6-unity-csv-translator)
7. [BepInEx + XUnity](#fase-7-bepinex--xunity)
8. [AI Pipeline Multi-Agent](#fase-8-ai-pipeline)
9. [Traductor AI](#fase-9-traductor-ai)
10. [Traductor OCR y Multi-Engine](#fase-10-traductor-ocr)
11. [Traductor de Voz](#fase-11-traductor-de-voz)
12. [Traducción por Lotes y Offline](#fase-12-traducción-por-lotes-y-offline)
13. [Danganronpa Patcher](#fase-13-danganronpa-patcher)
14. [Prediction Tool y QA Check](#fase-14-prediction-tool-y-qa-check)
15. [Glosario, TM y Adaptive MT](#fase-15-glosario-tm-y-adaptive-mt)
16. [Herramientas Avanzadas](#fase-16-herramientas-avanzadas)
17. [Seguridad y Recovery Key](#fase-17-seguridad)
18. [Solución de Problemas](#fase-18-solución-de-problemas)
19. [Chat de la Comunidad (Tiempo Real)](#fase-19-chat-de-la-comunidad) *(NUEVO v1.5.0)*
20. [Proyectos y Patch Hub](#proyectos-y-patch-hub) *(ACTUALIZADO v1.15.0)*
21. [Parámetros de Inferencia de Ollama](#parámetros-de-inferencia-de-ollama) *(NUEVO v1.15.0)*
22. [Enviar Feedback](#enviar-feedback) *(NUEVO v1.15.0)*

---

## FASE 1: CONFIGURACIÓN INICIAL

### Primer Inicio

Inicia GameStringer. En la primera ejecución aparece la pantalla de creación de perfil.

### Creación de Perfil

- **Nombre**: elige un nombre (ej. "Mario Gaming")
- **Avatar**: selecciona un color/gradiente
- **Contraseña**: mínimo 4 caracteres
- Haz clic en **"Crear Perfil"** — autenticación automática

### Interfaz

- **Barra lateral** (izquierda): navegación entre secciones
- **Dashboard** (centro): vista general de juegos, estadísticas, widget AI Engine
- **Ctrl+K**: búsqueda rápida global para acceder a cualquier página

---

## FASE 2: CONEXIÓN DE TIENDAS

### Tiendas Soportadas

Steam, Epic Games, GOG, Ubisoft Connect, Origin/EA, Battle.net, Itch.io, Rockstar, Amazon Games.

### Configuración de Steam (Prioridad)

1. Obtén la API Key en https://steamcommunity.com/dev/apikey
2. Encuentra tu Steam ID64 en https://steamid.io/
3. En GS: **Ajustes** → introduce API Key y Steam ID
4. El perfil de Steam debe ser **Público**

GS también detecta juegos de **Steam Family Sharing**.

---

## FASE 3: BIBLIOTECA DE JUEGOS

- Barra lateral → **"Biblioteca"** o Dashboard → **"Actualizar Biblioteca"**
- La carga tarda 1-2 minutos para cientos de juegos
- Al hacer clic en un juego: detalles, motor detectado, ruta, botón **"Traducir Juego"**

---

## FASE 4: TRADUCIR JUEGO

Barra lateral → **"Traducir Juego"** (Auto-Translate). El corazón de GameStringer.

### Flujo de Trabajo

1. **Seleccionar juego** de la biblioteca o ruta manual
2. **Escaneo**: detecta motor (Unity, Unreal, Godot, RPG Maker, Ren'Py, etc.) y archivos traducibles
3. **Smart Auto-Select**: recomienda el mejor método para el motor detectado
4. **Traducción AI**: cadenas traducidas con el motor AI configurado
5. **Revisión**: revisar, editar, aprobar
6. **Aplicar Parche**: backup automático + aplicación

### Smart Auto-Select para Unity

| Tipo | Método Recomendado | Alternativa |
|------|-------------------|-------------|
| Unity Mono (sin BepInEx) | Unity CSV Translator | BepInEx + XUnity |
| Unity Mono (BepInEx presente) | Unity CSV Translator | Traducir cadenas capturadas con AI |
| Unity IL2CPP | Unity CSV Translator | Ninguna (BepInEx incompatible) |

### Motores Detectados

Unity (Mono/IL2CPP), Unreal Engine, Godot, RPG Maker, Ren'Py, Source Engine, CryEngine, RE Engine, Frostbite, id Tech, Creation Engine, Construct, AGS, Defold, Love2D.

---

## FASE 5: PATCHER ENGINE

Barra lateral → **Patcher** → **Patcher Engine**. 5 patchers especializados:

- **Unity**: BepInEx + XUnity AutoTranslator para Mono
- **Unreal Engine**: traducción de archivos .locres (UE4/UE5)
- **Godot**: extraer/traducir/re-empaquetar archivos .pck (Godot 3/4)
- **RPG Maker**: traducción JSON para MV/MZ (diálogos, objetos, habilidades)
- **Ren'Py**: traducción de archivos .rpy (novelas visuales)

---

## FASE 6: UNITY CSV TRANSLATOR

El **mejor método** para juegos Unity (Mono e IL2CPP).

### Cómo Funciona

1. Escanea assets de Unity (resources.assets, etc.)
2. Extrae tablas CSV de localización
3. Traduce con AI (Ollama o nube)
4. Inyecta traducciones con **Resize Injection** (cero truncamiento)

### Ventajas

- Funciona con **todos** los juegos Unity (Mono e IL2CPP)
- Cero truncamiento gracias al resize
- Cobertura completa (todas las cadenas, no solo las de pantalla)
- Sin dependencias externas
- Backup automático (.backup) y restauración

---

## FASE 7: BEPINEX + XUNITY

Para juegos **Unity Mono** — traducción en vivo durante el gameplay.

1. GS detecta el juego Unity y encuentra el exe
2. Haz clic en **"Instalar BepInEx + XUnity"**
3. Inicia el juego — XUnity captura cadenas en pantalla
4. Cierra y vuelve a GS — traduce cadenas capturadas con AI

**Limitación**: no funciona con IL2CPP (causa crash). Usa Unity CSV Translator para IL2CPP.

---

## FASE 8: AI PIPELINE

Busca **"AI Pipeline"** con Ctrl+K. Sistema multi-paso para alta calidad.

### 6 Pasos

Harvest → Translate → QA Check → Auto-Fix → Review → Score

### 3 Modos

- **Quick**: Translate + QA (rápido)
- **Balanced**: + Auto-Fix (recomendado)
- **Max Quality**: los 6 pasos, umbral 75, máximo 3 intentos

### Multi-Agent

Asigna diferentes modelos por paso (ej. qwen para Translate, gemma para Review). 4 presets: Default, Speed, Max Quality, Diversified.

### Benchmark

Historial de ejecuciones con puntuación, duración, ms/cadena. Comparación de presets.

---

## FASE 9: TRADUCTOR AI

Barra lateral → **Traducción** → **Traductor AI**.

### Proveedores

- **Ollama** (local, gratuito), **OpenAI/GPT-4**, **Claude**, **Gemini**, **DeepL**, **Lingva**

### Funcionalidades

- Traducción individual o por lotes
- Detección automática del idioma origen
- Estilo: natural, literal, gaming
- Preservación de placeholders ({0}, %s, \n)
- Integración con Glosario + Translation Memory + Adaptive MT

---

## FASE 10: TRADUCTOR OCR

Barra lateral → **Traducción** → **Traductor OCR**.

Traduce texto de la pantalla en tiempo real:

- Captura manual o área seleccionada
- OCR en vivo continuo
- Hotkey global: **Ctrl+Shift+T**

### OCR Multi-Engine

4 motores: **OneOCR** (Win11), **PaddleOCR** (CJK), **RapidOCR** (ONNX), **Tesseract** (fallback).

- Sondeo automático de motores activos
- Cadena de fallback automática
- Modo de comparación paralela

---

## FASE 11: TRADUCTOR DE VOZ

Barra lateral → **Traducción** → **Traductor de Voz**.

- Reconocimiento de voz in-game
- Audio → texto traducido
- Overlay de subtítulos en tiempo real

---

## FASE 12: TRADUCCIÓN POR LOTES Y OFFLINE

### Por Lotes

Barra lateral → **Traducción** → **Batch**. Traduce carpetas enteras:

- Soporta .txt, .json, .csv, .po, .xml, .rpy, .ini
- Progreso en tiempo real por archivo
- Opción pipeline AI para máxima calidad

### Offline (Ollama)

Barra lateral → **Traducción** → **Traductor Offline**.

- Traducción completamente local con Ollama
- Sin conexión a internet necesaria
- Privacidad total — los datos no salen de tu PC

---

## FASE 13: DANGANRONPA PATCHER

Busca **"Danganronpa"** con Ctrl+K.

### Funcionalidades

1. **Tab Aplicar Parche**: selecciona juego Steam, ver archivos WAD, aplicar parche
2. **Tab WAD Extractor**: extraer, buscar, filtrar y traducir 35.865 cadenas
3. **Traducción Batch AI**: seleccionar cadenas → traducir con AI → exportar JSON
4. **Exportar .zip distribuible**: WAD parcheado + instalador automático + instrucciones
5. En el juego: Ajustes → Control Hints → "Keyboard and Mouse"

---

## FASE 14: PREDICTION TOOL Y QA CHECK

### Prediction Tool

Busca con Ctrl+K. Analiza un juego antes de la traducción:

- Estimación de cadenas y palabras
- Costo estimado por proveedor (DeepL, OpenAI, local)
- Tiempo estimado por método
- Cadenas de traducción recomendadas

### QA Check

Busca con Ctrl+K. Control de calidad post-traducción:

- Verificación de placeholders
- Control de números y valores
- Verificación de longitud de cadenas
- Control de formato y puntuación
- Puntuación de calidad por cadena

---

## FASE 15: GLOSARIO, TM Y ADAPTIVE MT

### Glosario

Busca con Ctrl+K. Terminología personalizada por juego:

- Añade términos (ej. "quest" → "misión")
- Categorías: gameplay, UI, personajes, lore
- Integrado automáticamente en la traducción AI

### Smart Glossary

Genera glosario automáticamente del análisis de archivos del juego.

### Translation Memory

Dashboard → widget "Entradas TM". Memoria de traducción:

- Guarda automáticamente cada par traducido
- Reutiliza traducciones anteriores
- Backend Rust para rendimiento

### Adaptive MT

Aprende de tus correcciones:

- Guarda: original → AI → corrección humana
- Encuentra correcciones similares con similitud trigram/word
- Inyecta ejemplos few-shot en el prompt AI
- Mejora con el tiempo

---

## FASE 16: HERRAMIENTAS AVANZADAS

### Context Harvester

Escanea archivos del juego y extrae contexto para la traducción AI.

### Editor de Traducciones

Editor avanzado para revisión manual de cadenas con filtros y búsqueda.

### Overlay de Subtítulos

Overlay in-game para subtítulos traducidos en tiempo real.

### ROM Patcher

Aplica y crea parches IPS/BPS para traducciones retro (SNES, GBA, etc.).

### Exportar Formatos

Exporta traducciones a: PO, XLIFF, CSV, JSON, TMX.

### Community Hub

Comparte traducciones, vota, comenta, descarga traducciones de la comunidad.

---

## FASE 17: SEGURIDAD

### Recovery Key

Al crear el perfil se genera una **Recovery Key** (12 palabras mnemónicas).

- Copia o descarga como .txt
- **¡Guárdala en un lugar seguro!**

### Recuperación de Contraseña

Pantalla de login → **"¿Olvidaste tu contraseña?"** → introduce las 12 palabras → nueva contraseña.

---

## FASE 18: SOLUCIÓN DE PROBLEMAS

### Juego No Encontrado

- Verifica que está instalado y Steam/Epic está abierto
- Actualiza la biblioteca y reinicia GS

### Traducción No Aplicada

- Reinicia el juego completamente
- Comprueba permisos de escritura
- Ejecuta GS como administrador

### AI No Responde

- Comprueba conexión a internet (para proveedores en la nube)
- Para Ollama: verifica que está ejecutándose (punto verde en barra lateral)
- Prueba un motor diferente

### Juego Crasheó Después del Parche

- Haz clic en **"Restaurar Backup"** en la herramienta usada
- Verifica integridad en Steam (clic derecho → Propiedades → Archivos Locales)

### Unity IL2CPP + BepInEx = Crash

- GS ahora bloquea automáticamente BepInEx para IL2CPP
- Usa Unity CSV Translator en su lugar

### Ollama Lento o No Responde

- Barra lateral: punto verde = online, rojo = offline
- Ollama Manager → verificar modelos instalados
- Recomendado: modelo 7B para velocidad, 13B+ para calidad

---

## FASE 19: CHAT DE LA COMUNIDAD

*(NUEVO v1.5.0)*

Chat en tiempo real integrado en el Community Hub, impulsado por Supabase Realtime.

### Acceso

1. Ve al **Community Hub** desde la barra lateral
2. Haz clic en la pestaña **Chat** o en el icono de chat abajo a la derecha
3. Si estás conectado a tu perfil de GameStringer, te conectas **automáticamente**

### Salas predeterminadas

- **General**: chat libre de la comunidad GameStringer
- **Traducciones**: discute traducciones, pide ayuda, comparte progresos
- **Feedback & Bugs**: reporta errores y sugiere mejoras
- **Anuncios**: noticias y actualizaciones oficiales

### Funciones

- **Mensajes en tiempo real** vía Supabase Realtime
- **Presencia online**: ve quién está conectado
- **Responder mensajes**: haz clic para responder
- **Editar/Eliminar**: edita o elimina tus mensajes
- **Crear salas personalizadas**: salas dedicadas para proyectos o juegos
- **Auto-login**: conexión automática vía perfil GameStringer

## Patch Hub (Packs de traducción de la comunidad)

El Patch Hub es un mercado al estilo de Steam Workshop para compartir y descargar packs de traducción de la comunidad, respaldado por el servidor de la comunidad de GameStringer. Ábrelo desde la entrada **Patch Hub** en la barra lateral (sección naranja/ámbar).

### Explorar packs
La vista principal lista los packs publicados con búsqueda y ordenación (más descargados, mejor valorados, actualizados recientemente, nivel de completado). Cada tarjeta muestra el juego, los idiomas origen→destino, el % de completado, la valoración y el número de descargas. Haz clic en un pack para abrir su página de detalle con estadísticas, descripción, archivos incluidos y registro de cambios.

### Descargar un pack
En la página de detalle de un pack, haz clic en **Download** (Descargar). GameStringer obtiene todos los archivos del pack desde el servidor de la comunidad y los guarda localmente como un paquete `.gspack` en tu biblioteca de packs (`Documents/GameStringer/packs`). Desde ahí puedes gestionar el pack e importarlo desde la página de detalle de un juego para aplicar la traducción.

### Publicar un pack
Haz clic en **Publish patch** (Publicar parche) para abrir el formulario de publicación. Rellena el nombre del pack, el juego, el idioma de origen y de destino, una descripción y etiquetas opcionales, y adjunta tu(s) archivo(s) de traducción. Cuando has iniciado sesión en el Community Hub, el pack se sube al servidor de la comunidad y entra en una cola de moderación antes de hacerse públicamente visible. Si no has iniciado sesión, el pack se guarda como borrador local: inicia sesión y publica de nuevo para compartirlo en línea.

> Publicar en línea requiere una cuenta del Community Hub (independiente de tu perfil local). Explorar y descargar funcionan sin cuenta.

---

## Novedades v1.9.0

### Parcheador Bethesda Engine
- **Juegos compatibles**: Skyrim LE/SE/AE, Fallout 3/NV/4, Oblivion, Starfield
- **Formatos de archivo**: BSA v103/v104/v105 y BA2 (GNRL + DX10)
- **Plugins**: análisis ESP/ESM con extracción de registros traducibles
- **Cadenas localizadas**: STRINGS, DLSTRINGS, ILSTRINGS

### Parcheador CRI Middleware
- **Juegos compatibles**: Persona 5 Royal, Yakuza, Tales of, Dragon Ball y todos los títulos CRI
- **Archivos**: CPK con descompresión CRILAYLA
- **Formatos de mensaje**: MSG, BMD, FTD

### Unity Localization Package
- Pipeline para el paquete oficial Unity Localization (Unity 2021.3+)
- StringTable + SharedTableData, Addressables, Smart Strings
- Validador dedicado para placeholders y formas plurales

### Exportación PO universal
- Exportación gettext PO con metadatos completos desde cada parcheador
- Compatible con Poedit, Weblate, Crowdin

### Accesibilidad WCAG 2.1 AA
- aria-label, encabezados semánticos, focus-visible
- Enlace de salto, prefers-reduced-motion, Windows High Contrast

### Sistema de diseño y OCR
- Variantes de Card vía cva, Button xs/icon-sm
- Backend Tauri Tesseract real en lugar del stub OCR
- Fix: bucle de flash de consola en Windows con la app en la bandeja

---

## Proyectos y Patch Hub

*(ACTUALIZADO v1.15.0)*

La página **Proyectos** reúne, en un solo lugar, cada juego que estás traduciendo o que ya has traducido — a partir de Quality Scoring, diccionarios, Translation Memory y la biblioteca de juegos. Desde aquí gestionas todo el ciclo de vida de una traducción: abrir, aplicar, publicar.

### Importar `.gspack` → proyecto

Cuando **importas un paquete `.gspack`** (descargado del Patch Hub o creado por ti), GameStringer no solo lo aplica: **registra un proyecto completado** y **guarda los archivos traducidos** localmente. El juego aparece entonces en Proyectos al 100 %, listo para volver a aplicarse o publicarse más tarde sin rehacer ningún trabajo.

### Aplicar al juego

Para los proyectos **completados**, el botón **"Aplicar al juego"** (icono de carpeta) copia los archivos traducidos directamente en la instalación:

1. Elige la **carpeta de instalación** del juego
2. Antes de sobrescribir un archivo existente, se crea una **copia de seguridad `.bak`** junto al original
3. **Seguridad**: si falla la copia de seguridad de un archivo, ese archivo se **omite** (nunca se sobrescribe sin una copia de seguridad)
4. Al terminar, verás cuántos archivos se escribieron y cuántos se omitieron

Para restaurar un original, simplemente renombra el archivo `.bak`, quitando la extensión.

### Publicar (pre-rellenado)

El botón **"Publicar en el Patch Hub"** (icono de compartir) envía la traducción a la comunidad. Publica **el archivo traducido real** (no solo un manifiesto de metadatos), con nombre, juego, idiomas y porcentaje de completado **ya pre-rellenados**. El pack entra en una **cola de moderación** antes de hacerse públicamente visible.

> Publicar requiere haber iniciado sesión en el **Community Hub** (una cuenta independiente de tu perfil local).

### Explorar / Mis parches

La página **Patch Hub** tiene dos pestañas:

- **Explorar** — todos los packs publicados por la comunidad, con búsqueda y ordenación (más descargados, mejor valorados, actualizados recientemente, completado)
- **Mis parches** — solo los packs que has publicado con el perfil actual

### Rendimiento

Las listas del Patch Hub usan una **caché local** (unos 60 segundos): moverte de una pestaña a otra ya no recarga del servidor cada vez. La caché se actualiza automáticamente tras una publicación o descarga. Publicar y reportar también tienen un pequeño **intervalo mínimo** entre envíos, para no sobrecargar el servidor compartido.

---

## Parámetros de Inferencia de Ollama

*(NUEVO v1.15.0)*

Cuando traduces con un **modelo local de Ollama**, puedes controlar *cómo* genera el texto el modelo. Abre la página desde **Ollama Manager → "Avanzado"** (ruta `/ollama-manager/advanced`).

> Si no cambias nada, se mantienen los valores por defecto recomendados: la traducción se comporta exactamente como antes. Los parámetros avanzados se envían a Ollama **solo** cuando los configuras.

### Presets

Tres perfiles listos para usar, ajustados para la traducción de videojuegos:

| Preset | Temperature | `num_ctx` | Cuándo usarlo |
|--------|-------------|-----------|---------------|
| 🎯 **Fiel** | 0.1 | 8192 | Máxima fidelidad al texto, poca invención. **Recomendado** para traducir. |
| ⚖️ **Equilibrado** | 0.3 | 4096 | Un compromiso entre fidelidad y naturalidad. |
| ✨ **Creativo** | 0.7 | 4096 | Más libertad estilística: para diálogos y tono expresivo. |

### Modo experto

Despliega **"Modo experto"** para ajustar cada parámetro con controles deslizantes:

| Parámetro | Efecto |
|-----------|--------|
| `temperature` | Aleatoriedad de la generación. Bajo = más determinista y fiel; alto = más variado y creativo. |
| `top_p` | *Nucleus sampling*: considera solo los tokens más probables hasta esta masa de probabilidad. Más bajo = más enfocado. |
| `top_k` | Limita la elección a los k tokens más probables en cada paso. Más bajo = menos digresiones. |
| `repeat_penalty` | Desincentiva la repetición de palabras. Por encima de 1.0 reduce los bucles; demasiado alto puede distorsionar el texto. |
| `num_ctx` | Ventana de contexto (tokens en memoria). **Más amplia = sin truncamiento en textos largos**, pero más RAM/VRAM. |
| `seed` *(opcional)* | Fija la semilla aleatoria para resultados **reproducibles** (útil para benchmarks). Desactivada = cada ejecución puede variar. |

Editar cualquier valor cambia el preset a **"custom"** automáticamente.

### Cuándo y por qué usarlos

- **Fidelidad vs. creatividad**: para traducir, prefiere una **temperatura baja** (preset Fiel) — menos invención, más fidelidad. Súbela solo para diálogos donde quieras un tono más expresivo.
- **Archivos largos**: si traduces textos largos y notas truncamiento o pérdida de contexto, aumenta **`num_ctx`** (a costa de más RAM/VRAM).
- **Reproducibilidad**: activa la **`seed`** cuando quieras comparar dos modelos o repetir la misma traducción y obtener exactamente el mismo resultado.

### Cómo usarlos

1. Abre **Ollama Manager** desde la barra lateral y haz clic en **"Avanzado"**
2. Elige un preset (empieza con **Fiel** para traducir) o abre el **Modo experto**
3. Ajusta los parámetros (p. ej. sube `num_ctx` para archivos largos, activa `seed` para resultados repetibles)
4. Haz clic en **"Guardar"** — los parámetros se almacenan para las siguientes traducciones

> **Alcance**: estos parámetros se aplican a las traducciones ejecutadas con **modelos locales de Ollama** (incluida la pasada de *reflection*). No afectan a los proveedores web (Gemini, Groq, etc.).

---

## Enviar Feedback

*(NUEVO v1.15.0)*

Puedes reportar un error, sugerir una idea o decirnos lo que piensas directamente desde la app, sin salir de GameStringer.

### Cómo enviarlo

1. Ve a **Ajustes → Comunidad** (pestaña Community Hub)
2. En el recuadro **"Enviar feedback"**, haz clic en **"Enviar feedback"**
3. Elige una **categoría** — 🐞 Error, 💡 Idea o 💬 Otro
4. Escribe tu mensaje y haz clic en **"Enviar"**

### Contexto adjuntado automáticamente

Para ayudarnos a entender el problema, se adjunta al mensaje un **contexto técnico mínimo**:

- **Versión** de la app
- **Plataforma** (sistema operativo + Tauri/Web)
- **Pantalla** en la que estabas (la ruta actual)
- **Juego** (solo si estabas trabajando en un título específico)

> **Privacidad**: sin datos personales. Solo versión, plataforma y pantalla actual.

### Si el backend no está disponible

El widget es **fail-open**: si el servidor no está configurado o estás sin conexión, el mensaje no se pierde. Todavía puedes **copiar el informe** al portapapeles o enviarlo por **correo electrónico** con un clic — el contexto técnico ya está incluido en el texto.

---

## Novedades v1.8.1

### Overlay de Traducción en Vivo
- Ve a la página **/live-translate** o presiona **Ctrl+Alt+O**
- Selecciona idioma origen/destino y proveedor AI
- Haz clic en **Iniciar** — el overlay aparece sobre el juego
- El texto se captura mediante OCR cada 2 segundos
- Las traducciones aparecen como cajas de overlay transparentes
- La detección de diferencias omite texto sin cambios (ahorra llamadas API)

### Mercado del Hub
- Ve al **Community Hub** para explorar paquetes de traducción
- **Instalación con 1 clic**: descargar → validar → importar
- Califica y reseña los paquetes de la comunidad
- Publica tus propias traducciones como archivos **.gspack**
- Perfiles de usuario con reputación e insignias

### Red de Memoria de Traducción
- Activa en **Ajustes → Red TM**
- Opt-in: tus traducciones de alta calidad contribuyen al pool global
- Privacidad primero: texto fuente hasheado, sin datos de usuario compartidos
- El siguiente usuario que traduzca el mismo juego recibe sugerencias pre-rellenadas
- Integrado automáticamente en el pipeline de traducción

### Pipeline de Doblaje AI
- Ve a la página **/dubbing**
- Selecciona la carpeta del juego y configura idiomas/voz
- Pipeline de 7 pasos: escanear → transcribir → traducir → sintetizar → parchear → sincronización labial → subtítulos
- El ajuste de duración mantiene el audio traducido con la misma longitud que el original
- Perfiles de voz de personaje con 16 arquetipos

### Sistema de Plugins
- La comunidad puede crear nuevos parcheadores de motores de juego en JavaScript
- No se necesita compilación de Rust
- El generador de plantillas crea un andamiaje completo del plugin
- Los plugins se distribuyen como paquetes **.gsplugin**

---

## Novedades v1.9.0

### Mejoras de UI del Community Hub
- **Community Hub rediseñado**: diseño más limpio y consistente sin gradientes excesivos y blobs decorativos
- **KPI Cards compactas**: tarjetas de estadísticas más pequeñas y sutiles con colores mínimos
- **Category Cards minimalistas**: diseño limpio sin gradientes pesados y sombras
- **Trending Cards unificadas**: estilo consistente en todos los tipos de tarjetas

### Sidebar de Amigos Compacta
- **Ancho reducido**: de 72 a 56 (w-56) para más espacio en pantalla
- **Friend Cards compactas**: avatares más pequeños (7x7), espaciado más ajustado
- **Secciones más pequeñas**: encabezados Online/Offline con texto reducido
- **Scrollbar ultra-delgada**: 4px, invisible por defecto, aparece al hover

### Mejoras del Chat Persistente
- **Botón de chat discreto**: elegante, pequeño en la esquina inferior derecha
- **Visible en todas las páginas**: chat accesible en toda la app
- **Diseño más limpio**: eliminadas animaciones y decoraciones excesivas

### Funcionalidades Sociales de Supabase
- **Esquema compatible**: esquema social de Supabase alineado con las expectativas del frontend (tools/supabase_social_compatible.sql)
- **RLS deshabilitado temporalmente**: para depuración más fácil de las funciones sociales
- **Fix chat participants**: nombres de columnas corregidos para validación UUID

### Correcciones de Errores
- **Fix Loop Chat**: añadido estado chatAttempted para prevenir bucle infinito en startDirectChat
- **Eliminación de Mock Data**: eliminados datos mock UUID no válidos (user-123, etc.) que causaban errores 400
- **Fix Ollama IPC**: reemplazadas todas las llamadas check_ollama_status IPC con HTTP directo a localhost:11434
- **Enlace Stores**: añadido enlace Stores en sección Recursos de la sidebar
- **Epic Connect**: cambiado de OAuth roto a modal de credenciales
- **Prueba de Conexión**: testConnection ahora usa comandos reales de Tauri en lugar de API simulada
- **Fix Disconnect**: añadida eliminación de credenciales Epic/Steam en el backend de Tauri
- **Fix Presence**: añadido guard de sesión en updatePresence para evitar 400 Bad Request

---

## Novedades en v1.9.0

### 🟢 Presencia Online Unificada

Sistema de presencia unificado que combina Supabase Realtime y base de datos:

- **Actualizaciones instantáneas**: Los usuarios online aparecen en tiempo real (Supabase Realtime Presence)
- **Heartbeat global**: El estado de presencia se actualiza automáticamente cada 30 segundos
- **Auto-away**: Si la ventana no tiene foco durante 2+ minutos, el estado cambia a "Ausente"
- **Auto-online**: Cuando la ventana recupera el foco, el estado vuelve a "Online"
- **Fallback DB**: Si Realtime no está disponible, el sistema usa la base de datos como fallback
- **Widget actualizado**: El widget "Usuarios Online" muestra nombres de usuario, avatares e indicador Realtime

### 🔔 Notificaciones de Bandeja del Sistema

Notificaciones nativas del SO para eventos importantes:

- **💬 Mensajes de Chat**: Notificación del SO al recibir un mensaje en el chat de la comunidad
- **✅ Traducciones Completadas**: Notificación cuando una traducción finaliza con éxito
- **❌ Errores de Traducción/Sistema**: Notificación para errores críticos (siempre visibles)
- **🔄 Actualizaciones de la App**: Notificación cuando hay una actualización de GameStringer disponible
- **🎮 Actualizaciones de Juegos**: Notificación cuando un juego actualizado puede haber invalidado el parche
- **🟢 Amigos Online**: Notificación cuando un amigo se conecta
- **📰 Noticias**: Notificaciones de noticias y actualizaciones de la comunidad

**Configuración**: Configuración → Notificaciones → Notificaciones de Bandeja del Sistema
- Toggle para cada tipo de notificación
- **Horas de Silencio**: Suprimir notificaciones en horas específicas (ej. 23:00-07:00)
- **Botón de Prueba**: Enviar una notificación de prueba para verificar el funcionamiento
- **Tooltip de Bandeja**: El icono de la bandeja muestra el conteo de notificaciones no leídas

### 🛡️ Error Boundaries + Recuperación de Crashes

Protección contra crashes de componentes:

- **WidgetErrorBoundary**: Si un widget crashea, muestra un mensaje compacto e intenta automáticamente la recuperación tras 5 segundos (máx. 3 intentos)
- **AppErrorBoundary**: Si la app entera crashea, muestra una pantalla de error con opción "Recargar App"
- **Auto-recuperación**: Los widgets se restauran automáticamente sin intervención del usuario

### 🌐 Resiliencia de Red / Modo Offline

Gestión elegante de desconexiones:

- **Monitor de Red**: Detecta estado online/offline + health check de Supabase cada 30 segundos
- **Barra de Estado de Conexión**: Barra roja arriba si offline, ámbar si Supabase caído, verde al restaurarse la conexión
- **Reintento con Backoff**: Operaciones de red fallidas se reintentan automáticamente con backoff exponencial (1s, 2s, 4s)
- **Cola Offline**: Si estás offline, las operaciones (mensajes de chat, actualizaciones de presencia) se encolan y ejecutan al volver la conexión
- **"Modo offline"**: Los cambios se sincronizarán automáticamente al volver la conexión

### 🎙️ Perfiles de Voz de Personajes (Voice Cloning)

Sistema para preservar la "voz" de los personajes durante la traducción:

- **Extracción Automática**: Analiza los diálogos del juego para identificar personajes y su estilo lingüístico
- **16 Tonos Disponibles**: Formal, Casual, Agresivo, Dulce, Misterioso, Cómico, Dramático, Estoico, Sarcastic, Sabio, Infantil, Noble, Pirata, Militar, Académico, Callejero
- **5 Niveles de Formalidad**: Muy formal → Muy informal
- **5 Grupos de Edad**: Niño, Adolescente, Joven adulto, Adulto, Anciano
- **Patrones de Voz**: Reconocimiento automático de patrones (palabras arcaicas, exclamaciones, preguntas frecuentes)
- **Catchphrases**: Identificación automática de expresiones recurrentes del personaje
- **Inyección en el Prompt**: Los perfiles de voz se inyectan automáticamente en el prompt de traducción
- **Perfil por Defecto**: Establecer un perfil como fallback para personajes no identificados

**Cómo usarlo**:
1. En la página Auto-Translate, tras cargar archivos, aparece el panel "Perfiles de Voz de Personajes"
2. Haz clic en **"Extraer Automáticamente"** para analizar los diálogos
3. O crea perfiles manualmente con **"Nuevo Perfil"**
4. Los perfiles se aplican automáticamente durante la traducción

### 🧠 Infraestructura de Fine-Tuning

Sistema para generar datasets de entrenamiento y gestionar modelos por juego:

- **Dataset desde Correcciones**: Generar datasets JSONL desde correcciones humanas (Adaptive MT)
- **4 Formatos de Exportación**: OpenAI JSONL, Ollama JSONL, Alpaca JSON, ChatML TXT
- **Solo Aprobadas**: Opción para usar solo correcciones aprobadas en el dataset
- **Gestión de Modelos**: Registrar y gestionar modelos fine-tuned por juego
- **Integración Ollama**: Verificar disponibilidad de Ollama para entrenamiento local
- **Estadísticas del Dataset**: Conteo de ejemplos, longitud promedio, puntuación de calidad

**Cómo usarlo**:
1. Ve a **Configuración → AI → Infraestructura de Fine-Tuning**
2. Selecciona el par de idiomas y haz clic en **"Generar"**
3. Haz clic en **"Exportar"** para descargar en el formato deseado
4. Usa el dataset para fine-tuning con Ollama o proveedores cloud

### ⚡ Code Splitting / Lazy Loading

Optimización del tiempo de inicio:

- 8 componentes pesados (Chat, Trabajos en Segundo Plano, Paleta de Comandos, etc.) se cargan solo cuando se necesitan
- La app se inicia más rápido y usa menos memoria

---

GameStringer v1.15.0 - Guía actualizada 24/07/2026
