# GameStringer - Guia Completo

## 🆕 Novidades na v1.15.0

- ⚙️ **Parâmetros de inferência do Ollama**: nova página *Ollama Manager → Avançado* com 3 presets (Fiel/Equilibrado/Criativo) e um modo especialista para ajustar `temperature`, `top_p`, `top_k`, `repeat_penalty`, `num_ctx` e `seed` dos modelos locais.
- 🚀 **Projetos ↔ Patch Hub**: cada `.gspack` importado é registrado como um projeto concluído; a partir de Projetos você pode **Aplicar ao jogo** (com backup `.bak`) ou **Publicar** a tradução pré-preenchida no Patch Hub.
- 💬 **Widget de feedback** em *Configurações → Comunidade*: reporte bugs ou ideias com o contexto técnico anexado automaticamente (versão, plataforma, tela).
- ⚡ **Patch Hub mais rápido**: cache local da lista e limites anti-abuso para você navegar entre as abas sem recarregar do servidor a cada vez.

## 🆕 Novidades na v1.12.0

- 👁️ Tradução com contexto visual (VLM): a IA vê a tela e traduz com contexto, resolvendo palavras ambíguas (ex.: "Chest" = baú ou peito). Local (Ollama) ou OpenAI/Gemini
- 🪞 Passagem autocorretiva (Reflection): uma segunda passagem opcional revisa e refina a tradução conforme glossário, tom e consistência — apenas onde é preciso
- 🧠 Memória semântica (RAG): memória de tradução e glossário combinados por significado via embeddings locais, para terminologia consistente no jogo todo
- ⚡ Tradução ao vivo mais fluida e processamento nativo de capturas (recorte/redimensionamento antes da chamada à IA)
- 🔌 Mais provedores prontos para uso: DeepL, Groq, Cerebras, Cohere, Together, Fireworks, Hugging Face, Azure Translator, DashScope, LibreTranslate, Lingva, MyMemory
- 🧰 Novas configurações para ajustar reflection, RAG semântico e contexto visual (qualidade vs. velocidade/custo)

## 🆕 Novidades na v1.11.2

- **Mais lojas**: Humble App, Game Jolt e Big Fish Games agora são detectados automaticamente.
- **Busca de tradução**: verifica via PCGamingWiki se um jogo já traz o seu idioma, com links de busca de patches ITA feitos por fãs.
- **Publicar no Patch Hub**: envie um projeto concluído ao Patch Hub da comunidade em um passo (Projetos → Publicar).
- **Novos motores**: pipeline em nuvem para TyranoScript e um parser `.pck` reescrito que lê arquivos reais do Godot 4.4+.
- **Unity**: ponte Ollama local para XUnity (CustomTranslate); os downloads (BepInEx/XUnity/TMP/UABEA) são resolvidos via API do GitHub.

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
20. [Projetos e Patch Hub](#projetos-e-patch-hub) *(ATUALIZADO v1.15.0)*
21. [Parâmetros de Inferência do Ollama](#parâmetros-de-inferência-do-ollama) *(NOVO v1.15.0)*
22. [Enviar Feedback](#enviar-feedback) *(NOVO v1.15.0)*

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

## Novidades v1.9.0

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

## Patch Hub (Pacotes de Tradução da Comunidade)

O Patch Hub é um marketplace no estilo Steam Workshop para compartilhar e baixar pacotes de tradução da comunidade, suportado pelo servidor da comunidade GameStringer. Abra-o pela entrada **Patch Hub** na barra lateral (seção laranja/âmbar).

### Explorar pacotes
A visualização principal lista os pacotes publicados com busca e ordenação (mais baixados, mais bem avaliados, atualizados recentemente, conclusão). Cada cartão mostra o jogo, os idiomas de origem→destino, o % de conclusão, a avaliação e a contagem de downloads. Clique em um pacote para abrir sua página de detalhes com estatísticas, descrição, arquivos incluídos e changelog.

### Baixar um pacote
Na página de detalhes de um pacote, clique em **Download** (Baixar). O GameStringer obtém todos os arquivos do pacote a partir do servidor da comunidade e os salva localmente como um pacote `.gspack` em sua biblioteca de pacotes (`Documents/GameStringer/packs`). A partir daí, você pode gerenciar o pacote e importá-lo da página de detalhes de um jogo para aplicar a tradução.

### Publicar um pacote
Clique em **Publish patch** (Publicar patch) para abrir o formulário de publicação. Preencha o nome do pacote, o jogo, os idiomas de origem e destino, uma descrição e tags opcionais, e anexe o(s) seu(s) arquivo(s) de tradução. Quando você está conectado ao Community Hub, o pacote é enviado ao servidor da comunidade e entra em uma fila de moderação antes de se tornar publicamente visível. Se você não estiver conectado, o pacote é mantido como um rascunho local — conecte-se e publique novamente para compartilhá-lo online.

> A publicação online requer uma conta do Community Hub (separada do seu perfil local). Explorar e baixar funcionam sem uma conta.

---

## Projetos e Patch Hub

*(ATUALIZADO v1.15.0)*

A página **Projetos** reúne, em um só lugar, cada jogo que você está traduzindo ou já traduziu — a partir do Quality Scoring, dicionários, Translation Memory e da biblioteca de jogos. Daqui você gerencia todo o ciclo de vida de uma tradução: abrir, aplicar, publicar.

### Importar `.gspack` → projeto

Quando você **importa um pacote `.gspack`** (baixado do Patch Hub ou feito por você), o GameStringer não apenas o aplica: ele **registra um projeto concluído** e **salva os arquivos traduzidos** localmente. O jogo então aparece em Projetos a 100 %, pronto para ser reaplicado ou publicado mais tarde sem refazer nenhum trabalho.

### Aplicar ao jogo

Para projetos **concluídos**, o botão **"Aplicar ao jogo"** (ícone de pasta) copia os arquivos traduzidos diretamente para a instalação:

1. Escolha a **pasta de instalação** do jogo
2. Antes de sobrescrever um arquivo existente, um **backup `.bak`** é criado ao lado do original
3. **Segurança**: se o backup de um arquivo falhar, esse arquivo é **ignorado** (nunca sobrescrito sem uma cópia de segurança)
4. Ao terminar, você vê quantos arquivos foram gravados e quantos foram ignorados

Para restaurar um original, basta renomear o arquivo `.bak`, removendo a extensão.

### Publicar (pré-preenchido)

O botão **"Publicar no Patch Hub"** (ícone de compartilhar) envia a tradução para a comunidade. Ele publica **o arquivo traduzido real** (não apenas um manifesto de metadados), com nome, jogo, idiomas e porcentagem de conclusão **já pré-preenchidos**. O pacote entra em uma **fila de moderação** antes de se tornar publicamente visível.

> Publicar requer estar conectado ao **Community Hub** (uma conta separada do seu perfil local).

### Explorar / Meus patches

A página **Patch Hub** tem duas abas:

- **Explorar** — todos os pacotes publicados pela comunidade, com busca e ordenação (mais baixados, mais bem avaliados, atualizados recentemente, conclusão)
- **Meus patches** — apenas os pacotes que você publicou com o perfil atual

### Desempenho

As listas do Patch Hub usam um **cache local** (cerca de 60 segundos): ir e voltar entre as abas não recarrega mais do servidor a cada vez. O cache é atualizado automaticamente após uma publicação ou download. Publicar e reportar também têm um pequeno **intervalo mínimo** entre os envios, para não sobrecarregar o servidor compartilhado.

---

## Parâmetros de Inferência do Ollama

*(NOVO v1.15.0)*

Quando você traduz com um **modelo local do Ollama**, pode controlar *como* o modelo gera o texto. Abra a página em **Ollama Manager → "Avançado"** (rota `/ollama-manager/advanced`).

> Se você não mudar nada, os padrões recomendados permanecem ativos: a tradução se comporta exatamente como antes. Os parâmetros avançados são enviados ao Ollama **somente** quando você os define.

### Presets

Três perfis prontos, ajustados para a tradução de videogames:

| Preset | Temperature | `num_ctx` | Quando usar |
|--------|-------------|-----------|-------------|
| 🎯 **Fiel** | 0.1 | 8192 | Máxima aderência ao texto, pouca invenção. **Recomendado** para tradução. |
| ⚖️ **Equilibrado** | 0.3 | 4096 | Um compromisso entre fidelidade e naturalidade. |
| ✨ **Criativo** | 0.7 | 4096 | Mais liberdade estilística: para diálogos e tom expressivo. |

### Modo especialista

Expanda **"Modo especialista"** para ajustar cada parâmetro com controles deslizantes:

| Parâmetro | Efeito |
|-----------|--------|
| `temperature` | Aleatoriedade da geração. Baixo = mais determinístico e fiel; alto = mais variado e criativo. |
| `top_p` | *Nucleus sampling*: considera apenas os tokens mais prováveis até esta massa de probabilidade. Mais baixo = mais focado. |
| `top_k` | Limita a escolha aos k tokens mais prováveis em cada passo. Mais baixo = menos digressões. |
| `repeat_penalty` | Desestimula a repetição de palavras. Acima de 1.0 reduz os loops; alto demais pode distorcer o texto. |
| `num_ctx` | Janela de contexto (tokens mantidos na memória). **Mais ampla = sem truncamento em textos longos**, mas mais RAM/VRAM. |
| `seed` *(opcional)* | Fixa a semente aleatória para resultados **reproduzíveis** (útil para benchmarks). Desligada = cada execução pode variar. |

Editar qualquer valor muda o preset para **"custom"** automaticamente.

### Quando e por que usá-los

- **Fidelidade vs. criatividade**: para tradução, prefira uma **temperatura baixa** (preset Fiel) — menos invenção, mais aderência. Aumente-a apenas para diálogos em que você queira um tom mais expressivo.
- **Arquivos longos**: se você traduz textos longos e nota truncamento ou perda de contexto, aumente **`num_ctx`** (ao custo de mais RAM/VRAM).
- **Reprodutibilidade**: ative a **`seed`** quando quiser comparar dois modelos ou repetir a mesma tradução e obter exatamente a mesma saída.

### Como usá-los

1. Abra o **Ollama Manager** na barra lateral e clique em **"Avançado"**
2. Escolha um preset (comece com **Fiel** para tradução) ou abra o **Modo especialista**
3. Ajuste os parâmetros (ex. aumente `num_ctx` para arquivos longos, ative `seed` para resultados repetíveis)
4. Clique em **"Salvar"** — os parâmetros são armazenados para as traduções seguintes

> **Escopo**: esses parâmetros se aplicam às traduções executadas com **modelos locais do Ollama** (incluindo a passagem de *reflection*). Eles não afetam os provedores web (Gemini, Groq, etc.).

---

## Enviar Feedback

*(NOVO v1.15.0)*

Você pode reportar um bug, sugerir uma ideia ou nos dizer o que pensa diretamente do app, sem sair do GameStringer.

### Como enviar

1. Vá em **Configurações → Comunidade** (aba Community Hub)
2. Na caixa **"Enviar feedback"**, clique em **"Enviar feedback"**
3. Escolha uma **categoria** — 🐞 Bug, 💡 Ideia ou 💬 Outro
4. Escreva sua mensagem e clique em **"Enviar"**

### Contexto anexado automaticamente

Para nos ajudar a entender o problema, um **contexto técnico mínimo** é anexado à mensagem:

- **Versão** do app
- **Plataforma** (sistema operacional + Tauri/Web)
- **Tela** em que você estava (a rota atual)
- **Jogo** (apenas se você estava trabalhando em um título específico)

> **Privacidade**: sem dados pessoais. Apenas versão, plataforma e tela atual.

### Se o backend estiver indisponível

O widget é **fail-open**: se o servidor não estiver configurado ou você estiver offline, a mensagem não é perdida. Você ainda pode **copiar o relatório** para a área de transferência ou enviá-lo por **e-mail** com um clique — o contexto técnico já está incluído no texto.

---

## Novidades v1.8.1

### Overlay de Tradução ao Vivo
- Vá para a página **/live-translate** ou pressione **Ctrl+Alt+O**
- Selecione idioma de origem/destino e provedor AI
- Clique em **Iniciar** — o overlay aparece sobre o jogo
- O texto é capturado via OCR a cada 2 segundos
- As traduções aparecem como caixas de overlay transparentes
- A detecção de diferenças pula texto inalterado (economiza chamadas API)

### Marketplace do Hub
- Vá ao **Community Hub** para explorar pacotes de tradução
- **Instalação com 1 clique**: baixar → validar → importar
- Avalie e faça reviews dos pacotes da comunidade
- Publique suas próprias traduções como arquivos **.gspack**
- Perfis de usuário com reputação e badges

### Rede de Memória de Tradução
- Ative em **Configurações → Rede TM**
- Opt-in: suas traduções de alta qualidade contribuem para o pool global
- Privacidade em primeiro lugar: texto fonte hasheado, sem compartilhamento de dados do usuário
- O próximo usuário traduzindo o mesmo jogo recebe sugestões pré-preenchidas
- Integrado automaticamente no pipeline de tradução

### Pipeline de Dublagem AI
- Vá para a página **/dubbing**
- Selecione a pasta do jogo e configure idiomas/voz
- Pipeline de 7 etapas: scan → transcrever → traduzir → sintetizar → patch → sincronização labial → legendas
- Ajuste de duração mantém o áudio traduzido com a mesma duração do original
- Perfis de voz de personagem com 16 arquétipos

### Sistema de Plugins
- A comunidade pode criar novos patchers de engines de jogos em JavaScript
- Sem necessidade de compilação Rust
- O gerador de templates cria um scaffold completo de plugin
- Plugins distribuídos como pacotes **.gsplugin**

---

## Novidades v1.9.0

### Melhorias de UI do Community Hub
- **Community Hub redesenhado**: design mais limpo e consistente sem gradientes excessivos e blobs decorativos
- **KPI Cards compactas**: cartões de estatísticas menores e sutis com cores mínimas
- **Category Cards minimalistas**: design limpo sem gradientes pesados e sombras
- **Trending Cards unificadas**: estilo consistente em todos os tipos de cartões

### Sidebar de Amigos Compacta
- **Largura reduzida**: de 72 para 56 (w-56) para mais espaço na tela
- **Friend Cards compactas**: avatares menores (7x7), espaçamento mais apertado
- **Seções menores**: cabeçalhos Online/Offline com texto reduzido
- **Scrollbar ultra-fina**: 4px, invisível por padrão, aparece no hover

### Melhorias no Chat Persistente
- **Botão de chat discreto**: elegante, pequeno no canto inferior direito
- **Visível em todas as páginas**: chat acessível em todo o app
- **Design mais limpo**: animações e decorações excessivas removidas

### Funcionalidades Sociais Supabase
- **Schema compatível**: schema social Supabase alinhado com expectativas do frontend (tools/supabase_social_compatible.sql)
- **RLS desabilitado temporariamente**: para depuração mais fácil das funcionalidades sociais
- **Fix chat participants**: nomes de colunas corrigidos para validação UUID

### Correções de Bugs
- **Fix Loop Chat**: adicionado estado chatAttempted para prevenir loop infinito em startDirectChat
- **Remoção Mock Data**: removidos dados mock UUID inválidos (user-123, etc.) que causavam erros 400
- **Fix Ollama IPC**: substituídas todas as chamadas check_ollama_status IPC por HTTP direto para localhost:11434
- **Link Stores**: adicionado link Stores na seção Recursos da sidebar
- **Epic Connect**: alterado de OAuth quebrado para modal de credenciais
- **Teste de Conexão**: testConnection agora usa comandos reais do Tauri em vez de API simulada
- **Fix Disconnect**: adicionada exclusão de credenciais Epic/Steam no backend Tauri
- **Fix Presence**: adicionado guarda de sessão em updatePresence para evitar 400 Bad Request

---

## Novidades na v1.9.0

### 🟢 Presença Online Unificada

Sistema de presença unificado combinando Supabase Realtime e base de dados:

- **Atualizações instantâneas**: Utilizadores online aparecem em tempo real (Supabase Realtime Presence)
- **Heartbeat global**: Estado de presença atualizado automaticamente a cada 30 segundos
- **Auto-away**: Se a janela não tem foco durante 2+ minutos, o estado muda para "Ausente"
- **Auto-online**: Quando a janela recupera o foco, o estado volta a "Online"
- **Fallback DB**: Se Realtime não está disponível, o sistema usa a base de dados como fallback
- **Widget atualizado**: O widget "Utilizadores Online" mostra nomes, avatares e indicador Realtime

### 🔔 Notificações da Bandeja do Sistema

Notificações nativas do SO para eventos importantes:

- **💬 Mensagens de Chat**: Notificação do SO ao receber uma mensagem no chat da comunidade
- **✅ Traduções Concluídas**: Notificação quando uma tradução termina com sucesso
- **❌ Erros de Tradução/Sistema**: Notificação para erros críticos (sempre visíveis)
- **🔄 Atualizações da App**: Notificação quando uma atualização do GameStringer está disponível
- **🎮 Atualizações de Jogos**: Notificação quando um jogo atualizado pode ter invalidado o patch
- **🟢 Amigos Online**: Notificação quando um amigo fica online
- **📰 Notícias**: Notificações para notícias e atualizações da comunidade

**Configuração**: Configurações → Notificações → Notificações da Bandeja do Sistema
- Toggle para cada tipo de notificação
- **Horas de Silêncio**: Suprimir notificações em horas específicas (ex. 23:00-07:00)
- **Botão de Teste**: Enviar uma notificação de teste para verificar o funcionamento
- **Tooltip da Bandeja**: O ícone da bandeja mostra a contagem de notificações não lidas

### 🛡️ Error Boundaries + Recuperação de Crashes

Proteção contra crashes de componentes:

- **WidgetErrorBoundary**: Se um widget crasha, mostra uma mensagem compacta e tenta automaticamente a recuperação após 5 segundos (máx. 3 tentativas)
- **AppErrorBoundary**: Se a app crasha completamente, mostra um ecrã de erro com opção "Recarregar App"
- **Auto-recuperação**: Widgets restauram automaticamente sem intervenção do utilizador

### 🌐 Resiliência de Rede / Modo Offline

Gestão elegante de desconexões:

- **Monitor de Rede**: Deteta estado online/offline + health check do Supabase a cada 30 segundos
- **Barra de Estado de Conexão**: Barra vermelha no topo se offline, âmbar se Supabase down, verde quando a conexão é restaurada
- **Retry com Backoff**: Operações de rede falhadas são automaticamente retentadas com backoff exponencial (1s, 2s, 4s)
- **Fila Offline**: Se está offline, as operações (mensagens de chat, atualizações de presença) são enfileiradas e executadas quando a conexão retorna
- **"Modo offline"**: As alterações serão automaticamente sincronizadas quando a conexão retornar

### 🎙️ Perfis de Voz de Personagens (Voice Cloning)

Sistema para preservar a "voz" dos personagens durante a tradução:

- **Extração Automática**: Analisa os diálogos do jogo para identificar personagens e o seu estilo linguístico
- **16 Tons Disponíveis**: Formal, Casual, Agressivo, Doce, Misterioso, Cómico, Dramático, Estoico, Sarcástico, Sábio, Infantil, Nobre, Pirata, Militar, Académico, Rua
- **5 Níveis de Formalidade**: Muito formal → Muito informal
- **5 Grupos Etários**: Criança, Adolescente, Jovem adulto, Adulto, Idoso
- **Padrões de Voz**: Reconhecimento automático de padrões (palavras arcaicas, exclamações, perguntas frequentes)
- **Catchphrases**: Identificação automática de expressões recorrentes do personagem
- **Injeção no Prompt**: Os perfis de voz são automaticamente injetados no prompt de tradução
- **Perfil Padrão**: Definir um perfil como fallback para personagens não identificados

**Como usar**:
1. Na página Auto-Translate, após carregar ficheiros, aparece o painel "Perfis de Voz de Personagens"
2. Clique em **"Extrair Automaticamente"** para analisar os diálogos
3. Ou crie perfis manualmente com **"Novo Perfil"**
4. Os perfis são aplicados automaticamente durante a tradução

### 🧠 Infraestrutura de Fine-Tuning

Sistema para gerar datasets de treino e gerir modelos por jogo:

- **Dataset de Correções**: Gerar datasets JSONL de correções humanas (Adaptive MT)
- **4 Formatos de Exportação**: OpenAI JSONL, Ollama JSONL, Alpaca JSON, ChatML TXT
- **Apenas Aprovadas**: Opção para usar apenas correções aprovadas no dataset
- **Gestão de Modelos**: Registar e gerir modelos fine-tuned por jogo
- **Integração Ollama**: Verificar disponibilidade do Ollama para treino local
- **Estatísticas do Dataset**: Contagem de exemplos, comprimento médio, pontuação de qualidade

**Como usar**:
1. Vá a **Configurações → AI → Infraestrutura de Fine-Tuning**
2. Selecione o par de idiomas e clique em **"Gerar"**
3. Clique em **"Exportar"** para descarregar no formato desejado
4. Use o dataset para fine-tuning com Ollama ou fornecedores cloud

### ⚡ Code Splitting / Lazy Loading

Otimização do tempo de arranque:

- 8 componentes pesados (Chat, Tarefas em Segundo Plano, Paleta de Comandos, etc.) são carregados apenas quando necessários
- A app arranca mais rápido e usa menos memória

---

GameStringer v1.15.0 - Guia atualizado 24/07/2026