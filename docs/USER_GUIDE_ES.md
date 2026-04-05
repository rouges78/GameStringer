# GameStringer - Guía Completa

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

## Novedades v1.6.0

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

GameStringer v1.6.0 - Guía actualizada 04/04/2026
