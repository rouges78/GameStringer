# GameStringer - Guia Completo

## Índice

1. [Configuração Inicial](#fase-1-configuração-inicial)
2. [Conexão de Lojas](#fase-2-conexão-de-lojas)
3. [Biblioteca de Jogos](#fase-3-biblioteca-de-jogos)
4. [Traduzir Jogo (Auto-Translate)](#fase-4-traduzir-jogo)
5. [Patcher Engine](#fase-5-patcher-engine)
6. [Unity CSV Translator](#fase-6-unity-csv-translator)
7. [BepInEx + XUnity](#fase-7-bepinex--xunity)
8. [AI Pipeline Multi-Agent](#fase-8-ai-pipeline)
9. [Tradutor AI](#fase-9-tradutor-ai)
10. [Tradutor OCR e Multi-Engine](#fase-10-tradutor-ocr)
11. [Tradutor de Voz](#fase-11-tradutor-de-voz)
12. [Tradução em Lote e Offline](#fase-12-tradução-em-lote-e-offline)
13. [Danganronpa Patcher](#fase-13-danganronpa-patcher)
14. [Prediction Tool e QA Check](#fase-14-prediction-tool-e-qa-check)
15. [Glossário, TM e Adaptive MT](#fase-15-glossário-tm-e-adaptive-mt)
16. [Ferramentas Avançadas](#fase-16-ferramentas-avançadas)
17. [Segurança e Recovery Key](#fase-17-segurança)
18. [Resolução de Problemas](#fase-18-resolução-de-problemas)
19. [Chat da Comunidade (Tempo Real)](#fase-19-chat-da-comunidade) *(NOVO v1.5.0)*

---

## FASE 1: CONFIGURAÇÃO INICIAL

### Primeiro Início

Inicie o GameStringer. Na primeira execução, a tela de criação de perfil aparece.

### Criação de Perfil

- **Nome**: escolha um nome (ex. "Mario Gaming")
- **Avatar**: selecione uma cor/gradiente
- **Senha**: mínimo 4 caracteres
- Clique em **"Criar Perfil"** — autenticação automática

### Interface

- **Barra lateral** (esquerda): navegação entre seções
- **Dashboard** (centro): visão geral dos jogos, estatísticas, widget AI Engine
- **Ctrl+K**: busca rápida global para acessar qualquer página

---

## FASE 2: CONEXÃO DE LOJAS

### Lojas Suportadas

Steam, Epic Games, GOG, Ubisoft Connect, Origin/EA, Battle.net, Itch.io, Rockstar, Amazon Games.

### Configuração do Steam (Prioridade)

1. Obtenha a API Key em https://steamcommunity.com/dev/apikey
2. Encontre seu Steam ID64 em https://steamid.io/
3. No GS: **Configurações** → insira a API Key e o Steam ID
4. O perfil Steam deve ser **Público**

O GS também detecta jogos do **Steam Family Sharing**.

---

## FASE 3: BIBLIOTECA DE JOGOS

- Barra lateral → **"Biblioteca"** ou Dashboard → **"Atualizar Biblioteca"**
- O carregamento leva 1-2 minutos para centenas de jogos
- Ao clicar em um jogo: detalhes, engine detectada, caminho, botão **"Traduzir Jogo"**

---

## FASE 4: TRADUZIR JOGO

Barra lateral → **"Traduzir Jogo"** (Auto-Translate). O coração do GameStringer.

### Fluxo de Trabalho

1. **Selecionar jogo** da biblioteca ou caminho manual
2. **Scan**: detecta engine (Unity, Unreal, Godot, RPG Maker, Ren'Py, etc.) e arquivos traduzíveis
3. **Smart Auto-Select**: recomenda o melhor método para a engine detectada
4. **Tradução AI**: strings traduzidas com a engine AI configurada
5. **Revisão**: revisar, editar, aprovar
6. **Aplicar Patch**: backup automático + aplicação

### Smart Auto-Select para Unity

| Tipo | Método Recomendado | Alternativa |
|------|-------------------|-------------|
| Unity Mono (sem BepInEx) | Unity CSV Translator | BepInEx + XUnity |
| Unity Mono (BepInEx presente) | Unity CSV Translator | Traduzir strings capturadas com AI |
| Unity IL2CPP | Unity CSV Translator | Nenhuma (BepInEx incompatível) |

### Engines Detectadas

Unity (Mono/IL2CPP), Unreal Engine, Godot, RPG Maker, Ren'Py, Source Engine, CryEngine, RE Engine, Frostbite, id Tech, Creation Engine, Construct, AGS, Defold, Love2D.

---

## FASE 5: PATCHER ENGINE

Barra lateral → **Patcher** → **Patcher Engine**. 5 patchers especializados:

- **Unity**: BepInEx + XUnity AutoTranslator para Mono
- **Unreal Engine**: tradução de arquivos .locres (UE4/UE5)
- **Godot**: extrair/traduzir/re-empacotar arquivos .pck (Godot 3/4)
- **RPG Maker**: tradução JSON para MV/MZ (diálogos, itens, habilidades)
- **Ren'Py**: tradução de arquivos .rpy (visual novels)

---

## FASE 6: UNITY CSV TRANSLATOR

O **melhor método** para jogos Unity (Mono e IL2CPP).

### Como Funciona

1. Escaneia assets Unity (resources.assets, etc.)
2. Extrai tabelas CSV de localização
3. Traduz com AI (Ollama ou nuvem)
4. Injeta traduções com **Resize Injection** (zero truncamento)

### Vantagens

- Funciona com **todos** os jogos Unity (Mono e IL2CPP)
- Zero truncamento graças ao resize
- Cobertura completa (todas as strings, não apenas as da tela)
- Sem dependências externas
- Backup automático (.backup) e restauração

---

## FASE 7: BEPINEX + XUNITY

Para jogos **Unity Mono** — tradução ao vivo durante o gameplay.

1. GS detecta o jogo Unity e encontra o exe
2. Clique em **"Instalar BepInEx + XUnity"**
3. Inicie o jogo — XUnity captura strings na tela
4. Feche e volte ao GS — traduza strings capturadas com AI

**Limitação**: não funciona com IL2CPP (causa crash). Use Unity CSV Translator para IL2CPP.

---

## FASE 8: AI PIPELINE

Busque **"AI Pipeline"** com Ctrl+K. Sistema multi-etapas para alta qualidade.

### 6 Etapas

Harvest → Translate → QA Check → Auto-Fix → Review → Score

### 3 Modos

- **Quick**: Translate + QA (rápido)
- **Balanced**: + Auto-Fix (recomendado)
- **Max Quality**: todas as 6 etapas, limiar 75, máximo 3 tentativas

### Multi-Agent

Atribua modelos diferentes por etapa (ex. qwen para Translate, gemma para Review). 4 presets: Default, Speed, Max Quality, Diversified.

### Benchmark

Histórico de execuções com pontuação, duração, ms/string. Comparação de presets.

---

## FASE 9: TRADUTOR AI

Barra lateral → **Tradução** → **Tradutor AI**.

### Provedores

- **Ollama** (local, gratuito), **OpenAI/GPT-4**, **Claude**, **Gemini**, **DeepL**, **Lingva**

### Funcionalidades

- Tradução individual ou em lote
- Detecção automática do idioma de origem
- Estilo: natural, literal, gaming
- Preservação de placeholders ({0}, %s, \n)
- Integração com Glossário + Translation Memory + Adaptive MT

---

## FASE 10: TRADUTOR OCR

Barra lateral → **Tradução** → **Tradutor OCR**.

Traduz texto da tela em tempo real:

- Captura manual ou área selecionada
- OCR ao vivo contínuo
- Hotkey global: **Ctrl+Shift+T**

### OCR Multi-Engine

4 engines: **OneOCR** (Win11), **PaddleOCR** (CJK), **RapidOCR** (ONNX), **Tesseract** (fallback).

- Sondagem automática de engines ativos
- Cadeia de fallback automática
- Modo de comparação paralela

---

## FASE 11: TRADUTOR DE VOZ

Barra lateral → **Tradução** → **Tradutor de Voz**.

- Reconhecimento de voz no jogo
- Áudio → texto traduzido
- Overlay de legendas em tempo real

---

## FASE 12: TRADUÇÃO EM LOTE E OFFLINE

### Em Lote

Barra lateral → **Tradução** → **Batch**. Traduz pastas inteiras:

- Suporta .txt, .json, .csv, .po, .xml, .rpy, .ini
- Progresso em tempo real por arquivo
- Opção pipeline AI para qualidade máxima

### Offline (Ollama)

Barra lateral → **Tradução** → **Tradutor Offline**.

- Tradução completamente local com Ollama
- Sem necessidade de conexão à internet
- Privacidade total — os dados não saem do seu PC

---

## FASE 13: DANGANRONPA PATCHER

Busque **"Danganronpa"** com Ctrl+K.

### Funcionalidades

1. **Aba Aplicar Patch**: selecione jogo Steam, ver arquivos WAD, aplicar patch
2. **Aba WAD Extractor**: extrair, buscar, filtrar e traduzir 35.865 strings
3. **Tradução Batch AI**: selecionar strings → traduzir com AI → exportar JSON
4. **Exportar .zip distribuível**: WAD patcheado + instalador automático + instruções
5. No jogo: Configurações → Control Hints → "Keyboard and Mouse"

---

## FASE 14: PREDICTION TOOL E QA CHECK

### Prediction Tool

Busque com Ctrl+K. Analisa um jogo antes da tradução:

- Estimativa de strings e palavras
- Custo estimado por provedor (DeepL, OpenAI, local)
- Tempo estimado por método
- Cadeias de tradução recomendadas

### QA Check

Busque com Ctrl+K. Controle de qualidade pós-tradução:

- Verificação de placeholders
- Controle de números e valores
- Verificação de comprimento de strings
- Controle de formato e pontuação
- Pontuação de qualidade por string

---

## FASE 15: GLOSSÁRIO, TM E ADAPTIVE MT

### Glossário

Busque com Ctrl+K. Terminologia personalizada por jogo:

- Adicione termos (ex. "quest" → "missão")
- Categorias: gameplay, UI, personagens, lore
- Integrado automaticamente na tradução AI

### Smart Glossary

Gera glossário automaticamente da análise dos arquivos do jogo.

### Translation Memory

Dashboard → widget "Entradas TM". Memória de tradução:

- Salva automaticamente cada par traduzido
- Reutiliza traduções anteriores
- Backend Rust para performance

### Adaptive MT

Aprende com suas correções:

- Salva: original → AI → correção humana
- Encontra correções similares com similaridade trigram/palavra
- Injeta exemplos few-shot no prompt AI
- Melhora com o tempo

---

## FASE 16: FERRAMENTAS AVANÇADAS

### Context Harvester

Escaneia arquivos do jogo e extrai contexto para a tradução AI.

### Editor de Traduções

Editor avançado para revisão manual de strings com filtros e busca.

### Overlay de Legendas

Overlay no jogo para legendas traduzidas em tempo real.

### ROM Patcher

Aplica e cria patches IPS/BPS para traduções retrô (SNES, GBA, etc.).

### Exportar Formatos

Exporta traduções para: PO, XLIFF, CSV, JSON, TMX.

### Community Hub

Compartilhe traduções, vote, comente, baixe traduções da comunidade.

---

## FASE 17: SEGURANÇA

### Recovery Key

Na criação do perfil, uma **Recovery Key** é gerada (12 palavras mnemônicas).

- Copie ou baixe como .txt
- **Guarde em um local seguro!**

### Recuperação de Senha

Tela de login → **"Esqueceu a senha?"** → insira as 12 palavras → nova senha.

---

## FASE 18: RESOLUÇÃO DE PROBLEMAS

### Jogo Não Encontrado

- Verifique se está instalado e Steam/Epic está aberto
- Atualize a biblioteca e reinicie o GS

### Tradução Não Aplicada

- Reinicie o jogo completamente
- Verifique permissões de escrita
- Execute o GS como administrador

### AI Não Responde

- Verifique a conexão à internet (para provedores na nuvem)
- Para Ollama: verifique se está em execução (ponto verde na barra lateral)
- Tente uma engine diferente

### Jogo Crashou Após Patch

- Clique em **"Restaurar Backup"** na ferramenta usada
- Verifique a integridade no Steam (clique direito → Propriedades → Arquivos Locais)

### Unity IL2CPP + BepInEx = Crash

- O GS agora bloqueia automaticamente o BepInEx para IL2CPP
- Use Unity CSV Translator em vez disso

### Ollama Lento ou Não Responde

- Barra lateral: ponto verde = online, vermelho = offline
- Ollama Manager → verificar modelos instalados
- Recomendado: modelo 7B para velocidade, 13B+ para qualidade

---

## FASE 19: CHAT DA COMUNIDADE

*(NOVO v1.5.0)*

Chat em tempo real integrado ao Community Hub, alimentado por Supabase Realtime.

### Acesso

1. Vá ao **Community Hub** pela barra lateral
2. Clique na aba **Chat** ou no ícone de chat no canto inferior direito
3. Se estiver logado no seu perfil GameStringer, você é **conectado automaticamente**

### Salas padrão

- **Geral**: chat livre da comunidade GameStringer
- **Traduções**: discuta traduções, peça ajuda, compartilhe progresso
- **Feedback & Bugs**: reporte bugs e sugira melhorias
- **Anúncios**: novidades e atualizações oficiais

### Funcionalidades

- **Mensagens em tempo real** via Supabase Realtime
- **Presença online**: veja quem está online
- **Responder mensagens**: clique para responder
- **Editar/Excluir**: edite ou exclua suas mensagens
- **Criar salas personalizadas**: salas dedicadas para projetos ou jogos
- **Auto-login**: conexão automática via perfil GameStringer

## Novidades v1.6.0

### Patcher Bethesda Engine
- **Jogos suportados**: Skyrim LE/SE/AE, Fallout 3/NV/4, Oblivion, Starfield
- **Formatos de arquivo**: BSA v103/v104/v105 e BA2 (GNRL + DX10)
- **Plugins**: análise ESP/ESM com extração de registros traduzíveis
- **Strings localizadas**: STRINGS, DLSTRINGS, ILSTRINGS

### Patcher CRI Middleware
- **Jogos suportados**: Persona 5 Royal, Yakuza, Tales of, Dragon Ball e todos os títulos CRI
- **Arquivos**: CPK com descompressão CRILAYLA
- **Formatos de mensagem**: MSG, BMD, FTD

### Unity Localization Package
- Pipeline para o pacote oficial Unity Localization (Unity 2021.3+)
- StringTable + SharedTableData, Addressables, Smart Strings
- Validador dedicado para placeholders e formas plurais

### Exportação PO universal
- Exportação gettext PO com metadados completos de cada patcher
- Compatível com Poedit, Weblate, Crowdin

### Acessibilidade WCAG 2.1 AA
- aria-label, cabeçalhos semânticos, focus-visible
- Skip link, prefers-reduced-motion, Windows High Contrast

### Design System e OCR
- Variantes de Card via cva, Button xs/icon-sm
- Backend Tauri Tesseract real no lugar do stub OCR
- Correção: console flash loop no Windows com app na bandeja

---

GameStringer v1.6.0 - Guia atualizado 04/04/2026