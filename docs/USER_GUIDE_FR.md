# 📖 GameStringer - Guide Utilisateur Complète

## Sommaire

1. [Aperçu](#aperçu)
2. [Premier Lancement et Profils](#premier-lancement-et-profils)
3. [Bibliothèque et Détails du Jeu](#bibliothèque-et-détails-du-jeu)
4. [Neural Translator Pro](#neural-translator-pro)
5. [Translation Wizard](#translation-wizard)
6. [Translation Bridge](#translation-bridge)
7. [Subtitle Translator Pro](#subtitle-translator-pro)
8. [Retro ROM Tools](#retro-rom-tools)
9. [API Publique v1](#api-publique-v1)
10. [Voice Clone Studio](#voice-clone-studio) *(NOUVEAU v1.0.5)*
11. [VR Text Overlay](#vr-text-overlay) *(NOUVEAU v1.0.5)*
12. [Quality Gates](#quality-gates) *(NOUVEAU v1.0.5)*
13. [Player Feedback](#player-feedback) *(NOUVEAU v1.0.5)*
14. [Nouveaux Fournisseurs AI v1.0.6](#nouveaux-fournisseurs-ai-v106) *(NOUVEAU v1.0.6)*
15. [Community Hub v1.0.7](#community-hub-v107) *(NOUVEAU v1.0.7)*
16. [Améliorations UI v1.0.9](#améliorations-ui-v109) *(NOUVEAU v1.0.9)*
17. [Exportation de Patch](#exportation-de-patch)
18. [Appliquer au Jeu](#appliquer-au-jeu)
19. [Gestion des Sauvegardes](#gestion-des-sauvegardes)
20. [Éditeur de Traductions](#éditeur-de-traductions)
21. [Historique d'Activité](#historique-dactivité)
22. [Dictionnaires](#dictionnaires)
23. [Résolution de Problèmes](#résolution-de-problèmes)
24. [Glossaire](#glossaire)
25. [Context Harvester](#context-harvester)
26. [Mémoire de Traduction](#mémoire-de-traduction)
27. [Traducteur OCR](#traducteur-ocr)
28. [Révision IA](#révision-ia)
29. [Pipeline IA](#pipeline-ia)
30. [Traducteur d’Émotions](#traducteur-démotions)
31. [Adaptation Culturelle](#adaptation-culturelle)
32. [Carte de Chaleur de Confiance](#carte-de-chaleur-de-confiance)
33. [Gestionnaire de Blog](#gestionnaire-de-blog)
34. [Ren'Py Patcher](#renpy-patcher)
35. [RPG Maker Patcher](#rpg-maker-patcher)
36. [Wolf RPG Patcher](#wolf-rpg-patcher)
37. [Danganronpa Patcher](#danganronpa-patcher)
38. [Comparaison Multi-LLM](#comparaison-multi-llm) *(NOUVEAU)*
39. [Score de Qualité en Direct](#score-de-qualité-en-direct) *(NOUVEAU)*
40. [Profils de Voix de Personnage](#profils-de-voix-de-personnage) *(NOUVEAU)*
41. [Pipeline de Traduction Vocale](#pipeline-de-traduction-vocale) *(NOUVEAU)*
42. [OCR Multi-Moteur](#ocr-multi-moteur) *(NOUVEAU)*
43. [OCR Jeux Rétro](#ocr-jeux-rétro) *(NOUVEAU)*
44. [MT Adaptative](#mt-adaptative) *(NOUVEAU)*
45. [Traducteur Batch de Dossiers](#traducteur-batch-de-dossiers) *(NOUVEAU)*
46. [Traducteur Hors-ligne](#traducteur-hors-ligne) *(NOUVEAU)*
47. [Traducteur Manga/BD](#traducteur-mangabd) *(NOUVEAU)*
48. [Traducteur de Textures](#traducteur-de-textures) *(NOUVEAU)*
49. [Auto-Glossaire](#auto-glossaire) *(NOUVEAU)*

---

## Aperçu

GameStringer est un système avancé pour la traduction automatique et manuelle de jeux vidéo. Il supporte :

- **Moteurs de jeu** : Unity, Unreal Engine, RPG Maker, Ren'Py, Godot, Telltale, Wolf RPG, Kirikiri et autres
- **Formats de fichiers** : CSV, JSON, XML, PO/POT, YAML, TXT, SRT, VTT, ASS/SSA et autres
- **Fournisseurs AI** : Claude, Gemini, GPT, DeepSeek, Mistral, Groq, Ollama, **Qwen 3**, **NLLB-200** (18+ fournisseurs)
- **Langues** : 200+ langues supportées (avec NLLB-200)
- **UI Multilingue**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL (11 langues)
- **Boutiques de Jeux** : Steam, Epic Games, GOG, Origin, Battle.net, Ubisoft, itch.io, Amazon Games
- **NOUVEAU v1.0.5** : Voice Clone Studio, VR Text Overlay, Quality Gates, Player Feedback
- **NOUVEAU v1.0.6** : Qwen 3 (langues asiatiques), NLLB-200 (200 langues), corrections
- **NOUVEAU v1.0.7** : Community Hub, GitHub Discussions, Licence v1.1
- **NOUVEAU v1.0.8** : Correction du téléchargement des mises à jour
- **NOUVEAU v1.0.9** : En-têtes animés, notifications de mise à jour, polish UI

---

## Premier Lancement et Profils

### Création de Profil

Au premier lancement, GameStringer demande de créer un profil utilisateur :

1. **Cliquez sur "Créer Profil"** sur l'écran initial
2. **Entrez un nom** pour le profil (ex. "MonNom")
3. **Définissez un mot de passe** (minimum 6 caractères)
4. **Cliquez sur "Créer"** pour confirmer

### Connexion

Pour accéder à un profil existant :

1. **Sélectionnez le profil** dans la liste
2. **Entrez le mot de passe**
3. **(Optionnel)** Cochez "Retenir le mot de passe" pour connexion automatique
4. **Cliquez sur "Connexion"**

### Gestion des Profils

- **Changer de profil** : Cliquez sur l'icône profil en haut à droite → "Changer de profil"
- **Déconnexion** : Cliquez sur l'icône profil → "Déconnexion"
- **Paramètres du profil** : Allez dans Paramètres → Profil

---

## Bibliothèque et Détails du Jeu

### Bibliothèque

La Bibliothèque affiche tous vos jeux synchronisés depuis Steam, Epic Games, GOG et autres boutiques.

- **Actualiser** : Recharger la liste des jeux
- **Partagés** : Afficher/masquer les jeux Family Sharing
- **Filtres** : Filtrer par plateforme, état d'installation, moteur

### Page Détails du Jeu

Cliquez sur un jeu pour ouvrir la page de détails avec disposition **3:1** :

#### Colonne Principale (75%)

- **Galerie de Captures** : Grille jusqu'à 12 captures cliquables (lightbox)
- **Info Rapide** : Moteur, nombre de fichiers, chemin d'installation, DLC
- **Onglets Fichiers/Traductions/Patch** :
  - **Fichiers** : Fichiers traduisibles trouvés avec bouton "Neural Translator"
  - **Traductions** : Traductions actives pour ce jeu
  - **Patch** : Installer/supprimer patchs pour Unity, Unreal, RPG Maker

#### Barre Latérale Droite (25%)

- **Info Jeu** : Développeur, éditeur, date de sortie, genres, langues supportées
- **Actions** : Traduire Jeu, Scanner Fichiers
- **HowLongToBeat** : Temps estimé pour finir le jeu

#### Recommandation de Traduction

En bas de la page, le système analyse le jeu et suggère la **meilleure méthode de traduction** :

| Méthode | Quand l'utiliser |
|---------|------------------|
| **Live Unity** | Jeux Unity avec BepInEx + XUnity |
| **File Translation** | Fichiers de localisation trouvés (JSON, CSV, etc.) |
| **OCR Overlay** | Aucun fichier trouvé, traduction visuelle en temps réel |

---

## Neural Translator Pro

### Comment Traduire un Fichier

1. **Sélectionnez un jeu** de la bibliothèque Steam ou chargez manuellement
2. **Chargez le fichier** à traduire (glisser-déposer ou parcourir)
3. **Configurez les options** :
   - **Langue source** : la langue originale (ex. Anglais)
   - **Langue cible** : la langue de destination (ex. Français)
   - **Fournisseur AI** : Claude (recommandé), Gemini ou GPT
   - **Clé API** : entrez votre clé API du fournisseur choisi
4. **Lancez la traduction** en cliquant sur "Lancer la Traduction"
5. **Suivez la progression** dans la barre de progression

### Options Avancées

| Option | Description |
|--------|-------------|
| **Quality Checks** | Vérification automatique de qualité (nombres, formatage, etc.) |
| **Translation Memory** | Réutilise les traductions précédentes pour accélérer |
| **Batch Size** | Nombre de chaînes traduites en parallèle (défaut : 10) |

### Coûts Estimés

Le système affiche une estimation des coûts avant de commencer :

- **Claude** : ~$0.003 pour 1K tokens
- **Gemini** : ~$0.0005 pour 1K tokens (moins cher)
- **GPT-4** : ~$0.01 pour 1K tokens

---

## Translation Wizard

Le Translation Wizard est une procédure guidée pour traduire automatiquement les fichiers d'un jeu.

### Comment Utiliser le Wizard

1. **Allez dans Translator** → cliquez sur "Translation Wizard"
2. **Sélectionnez le jeu** de la bibliothèque ou entrez le chemin manuellement
3. **Scannez les fichiers** : le wizard trouve automatiquement les fichiers traduisibles
4. **Sélectionnez les fichiers** à traduire (vous pouvez en sélectionner plusieurs)
5. **Configurez les options** :
   - Langue source et cible
   - Fournisseur AI
   - Options de qualité
6. **Lancez la traduction par lot**
7. **Suivez la progression** dans la barre de progression

### Formats Détectés Automatiquement

| Extension | Type |
|-----------|------|
| `.json` | Localisation JSON |
| `.csv` | Tables de texte |
| `.xml` | Configurations XML |
| `.po/.pot` | Gettext (standard Linux) |
| `.txt` | Texte brut |
| `.yaml` | Config YAML |

---

## Translation Bridge

Translation Bridge permet de traduire les jeux Unity **en temps réel** pendant le jeu.

### Prérequis

- Jeu Unity (Mono ou IL2CPP)
- BepInEx installé
- Plugin XUnity.AutoTranslator

### Comment Configurer

1. **Allez dans Translation Bridge** dans le menu
2. **Sélectionnez le jeu Unity** de la liste
3. **Installez BepInEx** (automatique si non présent)
4. **Configurez XUnity.AutoTranslator** :
   - Langue de destination
   - Endpoint de traduction
5. **Lancez le jeu** - les traductions apparaîtront automatiquement

### Modes de Fonctionnement

- **Cache local** : Traductions sauvegardées pour réutilisation
- **Traduction en direct** : Nouvelles chaînes traduites à la volée
- **Fallback** : Si hors ligne, utilise uniquement le cache

---

## Subtitle Translator Pro

> NOUVEAU dans v1.0.4

Subtitle Translator Pro permet de traduire des sous-titres dans différents formats.

### Formats Supportés

| Format | Extension | Description |
|--------|-----------|-------------|
| **SubRip** | .srt | Format le plus courant |
| **WebVTT** | .vtt | Standard web |
| **ASS/SSA** | .ass/.ssa | Sous-titres avancés avec styles |

### Comment Utiliser

1. **Allez dans Subtitle Translator** dans le menu
2. **Chargez le fichier** de sous-titres (glisser-déposer ou parcourir)
3. **Sélectionnez la langue** source et cible
4. **Aperçu en temps réel** des traductions
5. **Exportez** dans le format souhaité

### Fonctionnalités

- **Validation QA** : Contrôle automatique timing et formatage
- **Aperçu synchronisé** : Voir les traductions avec le timing original
- **Export multi-format** : Convertir entre SRT, VTT, ASS

---

## Retro ROM Tools

> NOUVEAU dans v1.0.4

Outils pour traduire des jeux rétro sur ROM.

### Consoles Supportées

| Console | Abréviation |
|---------|-------------|
| Nintendo Entertainment System | NES |
| Super Nintendo | SNES |
| Game Boy | GB |
| Game Boy Color | GBC |
| Game Boy Advance | GBA |
| Sega Genesis/Mega Drive | Genesis |
| PlayStation 1 | PSX |
| Nintendo 64 | N64 |

### Fonctionnalités (2)

- **Table File Parser** : Lit et génère des fichiers .TBL pour mappage de caractères
- **Font Injection** : Injecte des polices avec caractères accentués
- **Éditeur Hex intégré** : Modification directe des ROMs

### Comment Utiliser (2)

1. **Allez dans Retro ROM Tools** dans le menu
2. **Chargez la ROM** du jeu
3. **Chargez ou générez** le Table File (.TBL)
4. **Extrayez le texte** de la ROM
5. **Traduisez** avec AI ou manuellement
6. **Injectez** les traductions dans la ROM

---

## API Publique v1

> NOUVEAU dans v1.0.4

GameStringer expose une API REST pour les intégrations externes.

### Endpoints Disponibles

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/translate` | Traduction d'une chaîne unique |
| `POST` | `/api/v1/batch` | Traduction par lot (max 100 chaînes) |
| `GET` | `/api/v1/languages` | Liste des 20 langues supportées |
| `GET` | `/api/v1/health` | Vérification de santé du service |

### Exemple de Requête

```json
POST /api/v1/translate
{
  "text": "Hello, world!",
  "source": "en",
  "target": "fr",
  "provider": "gemini"
}
```text

### Exemple de Réponse

```json
{
  "translation": "Bonjour le monde !",
  "source": "en",
  "target": "fr",
  "provider": "gemini",
  "tokens": 12
}
```text

### Utilisation CI/CD

L'API est idéale pour intégrer GameStringer dans des pipelines de build automatisés.

---

## Voice Clone Studio

> NOUVEAU dans v1.0.5

Clonez des voix avec AI pour le doublage automatique de jeux.

### Fournisseurs Supportés

| Fournisseur | Type | Qualité |
|-------------|------|---------|
| **ElevenLabs** | Cloud | ⭐⭐⭐⭐⭐ Excellente |
| **OpenAI TTS** | Cloud | ⭐⭐⭐⭐ Très bonne |

### Presets de Voix

- 🎭 **Narrateur** : Voix calme et autoritaire
- ⚔️ **Héros** : Voix courageuse et déterminée
- 😈 **Méchant** : Voix menaçante et profonde
- 👶 **Enfant** : Voix jeune et joyeuse
- 🤖 **Robot** : Voix synthétique et métallique
- 👻 **Chuchotement** : Voix basse et mystérieuse

### Comment Utiliser (3)

1. **Allez dans Voice Clone** dans le menu
2. **Entrez le texte** à convertir en audio
3. **Sélectionnez le fournisseur** (ElevenLabs ou OpenAI)
4. **Choisissez le preset** de voix
5. **Générez l'audio** et téléchargez le fichier MP3/WAV

---

## VR Text Overlay

> NOUVEAU dans v1.0.5

Sous-titres spatiaux 3D pour jeux VR.

### Casques Supportés

| Casque | Support |
|--------|---------|
| **Oculus Quest/Rift** | ✅ Complet |
| **SteamVR** (Valve Index, HTC Vive) | ✅ Complet |
| **Windows Mixed Reality** | ✅ Complet |

### Presets de Position

- **Center** - Devant le joueur
- **Bottom** - En bas (sous-titre classique)
- **Top** - En haut (notifications)
- **Follow Head** - Suit le regard

### Comment Utiliser (4)

1. **Allez dans VR Overlay** dans le menu
2. **Détectez le casque** automatiquement
3. **Configurez la position** et la taille du texte
4. **Lancez l'overlay** avant de lancer le jeu VR
5. Les sous-titres apparaîtront dans l'espace 3D

---

## Quality Gates

> NOUVEAU dans v1.0.5

Système automatique de contrôle qualité des traductions.

### Contrôles Automatiques

| Contrôle | Description |
|----------|-------------|
| **Placeholder** | Vérifie {0}, {1}, %s, etc. |
| **Nombres** | Nombres préservés correctement |
| **Tags HTML** | `<color>`, `<b>`, etc. intacts |
| **Longueur** | Traduction pas trop longue/courte |
| **Ponctuation** | Cohérence avec l'original |

### Niveaux de Confiance

| Niveau | Score | Couleur |
|--------|-------|---------|
| 🔴 Critique | < 40% | Rouge |
| 🟠 Bas | 40-59% | Orange |
| 🟡 Moyen | 60-74% | Jaune |
| 🟢 Élevé | 75-89% | Vert |
| 💚 Parfait | 90-100% | Vert foncé |

### Comment Utiliser (5)

1. **Allez dans Quality Gates** dans le menu
2. **Chargez les traductions** (JSON, CSV, ou collez)
3. **Analysez** chaque chaîne automatiquement
4. **Filtrez** par niveau de confiance
5. **Exportez le rapport** en JSON

---

## Player Feedback

> NOUVEAU dans v1.0.5

Collectez et gérez les retours des joueurs sur les traductions.

### Catégories de Feedback

- 📝 **Traduction incorrecte** - Sens erroné
- 🔤 **Erreur grammaticale** - Grammaire/orthographe
- 🎭 **Ton inapproprié** - Registre linguistique incorrect
- ❓ **Pas clair** - Traduction confuse
- ✨ **Suggestion** - Proposition d'amélioration

### Système de Notation

⭐⭐⭐⭐⭐ Note 1-5 étoiles pour chaque traduction

### États de Feedback

| État | Description |
|------|-------------|
| 🆕 Nouveau | Fraîchement reçu |
| 👀 En révision | En cours d'analyse |
| ✅ Résolu | Corrigé |
| ❌ Rejeté | Non applicable |

### Comment Utiliser (6)

1. **Allez dans Player Feedback** dans le menu
2. **Visualisez les feedbacks** reçus
3. **Filtrez** par catégorie, état, note
4. **Mettez à jour l'état** des feedbacks
5. **Exportez** en CSV pour analyse

---

## Nouveaux Fournisseurs AI v1.0.6

> NOUVEAU dans v1.0.6

### Qwen 3 - Langues Asiatiques

Fournisseur optimisé pour chinois, japonais et coréen.

| Modèle | Paramètres | RAM Requise |
|--------|------------|-------------|
| `qwen3:4b` | 4B | 4GB |
| `qwen3:8b` | 8B | 8GB |
| `qwen3:14b` | 14B | 16GB |
| `qwen3:32b` | 32B | 32GB |

**Installation** :

```bash
ollama pull qwen3:14b
```text

**Langues optimisées** : 中文 (Chinois), 日本語 (Japonais), 한국어 (Coréen)

### NLLB-200 - 200 Langues

Fournisseur Meta AI avec support pour 200 langues, y compris les rares.

**Langues spéciales supportées** :

- Thaï, Vietnamien, Hindi, Arabe
- Swahili, Indonésien, Turc
- Ukrainien, Bengali, Tamil

**Configuration** :

1. Allez dans **Paramètres → Clés API**
2. Entrez **HuggingFace API Key** (gratuit)
3. Sélectionnez **NLLB-200** comme fournisseur

### Generic Ollama

Utilisez n'importe quel modèle Ollama installé pour les traductions.

**Modèles recommandés** :

- `llama3.2` - Bon équilibre qualité/vitesse
- `mistral` - Excellent pour langues européennes
- `gemma2` - Rapide et léger

---

## Community Hub v1.0.7

> NOUVEAU dans v1.0.7

Hub centralisé pour la communauté GameStringer.

### GitHub Discussions

Accès direct aux discussions de la communauté :

- **Annonces** : Actualités et mises à jour officielles
- **Q&A** : Questions et réponses de la communauté
- **Idées** : Propositions pour nouvelles fonctionnalités
- **Showcase** : Projets et traductions de la communauté

### Comment Accéder

1. **Allez dans Community Hub** dans le menu latéral
2. **Naviguez** entre les catégories de discussion
3. **Participez** directement sur GitHub

### Licence v1.1

- **YouTubers/Streamers** : OK avec attribution
- **Forks non-commerciaux** : Autorisés
- **Usage commercial** : Nécessite autorisation

---

## Améliorations UI v1.0.9

> NOUVEAU dans v1.0.9

Mises à jour esthétiques et fonctionnelles de l'interface.

### En-têtes Animés

Toutes les pages de traduction ont maintenant des en-têtes avec :

- **Effet "Respiration"** : Dégradé qui s'étend/se contracte doucement (12s)
- **Ombres profondes** : shadow-xl avec teinte bleue
- **Dégradé uniforme** : Sky → Blue → Cyan

### Notifications de Mise à Jour

La **cloche** dans la barre de navigation gère maintenant les mises à jour :

| État | Comportement |
|------|--------------|
| 🔔 Grise | Pas de notifications |
| 🔔 Jaune | Notifications non lues |
| 🔔 Verte + pulse | Mise à jour disponible ! |

**Fonctionnalités** :

- **Son** : Deux tons mélodiques lors de la détection de mise à jour
- **Badge vert** : Icône de téléchargement animée
- **Clic** : Ouvre popup avec liste des nouveautés
- **Bouton Télécharger** : Ouvre la page de téléchargement

### Menu Latéral

- **Hover sous-item** : Couleur vert foncé (emerald-600)
- **Cohérence visuelle** : Style unifié

### Écran de Connexion

- **Version sous le logo** : Affiche v1.0.9 sous le logo
- **Footer** : Phrase spirituelle au lieu du copyright

---

## Exportation de Patch

Le Unity Patcher installe automatiquement BepInEx et XUnity.AutoTranslator sur les jeux Unity.

### Comment Utiliser (7)

1. **Allez dans Unity Patcher** dans le menu latéral
2. **Sélectionnez un jeu Unity** de la liste (badge vert "Unity")
3. **Choisissez la langue** de destination (ex. Français)
4. **Choisissez le mode** :
   - **Capture uniquement** : Capture le texte pour traduction manuelle
   - **Google Translate** : Traduction automatique in-game
   - **DeepL** : Traduction automatique de meilleure qualité
5. **Cliquez sur "Installer le patch"**
6. **Lancez le jeu** - appuyez sur `ALT+T` pour ouvrir le menu XUnity

### Badge de Traduction

Après l'installation, vous verrez un badge indiquant l'état :

| Badge | Signification |
|-------|---------------|
| 🥈 Argent | XUnity avec auto-translate actif (Google/DeepL) |
| 🥉 Bronze | Capture de texte uniquement (traduction manuelle) |

### Suivi d'Activité

Chaque patch installé est enregistré dans **Activité Récente** sur le Dashboard avec :

- Nom du jeu
- Mode de traduction choisi
- Langue cible

---

## Historique d'Activité

L'historique d'activité trace toutes les opérations effectuées.

### Accès

Allez dans **Historique d'Activité** dans le menu latéral.

### Types d'Activité Enregistrés

| Icône | Type | Description |
|-------|------|-------------|
| 🌐 | Translation | Traductions terminées |
| 🔧 | Patch | Patchs créés/appliqués |
| ♻️ | SteamSync | Synchronisations Steam |
| ➕ | GameAdded | Jeux ajoutés |
| 🎮 | GameLaunched | Jeux lancés |
| 👤 | ProfileCreated | Profils créés |
| ⚙️ | SettingsChanged | Paramètres modifiés |

### Filtres Disponibles

- **Par type** : Filtrer par catégorie d'activité
- **Par date** : Sélectionner plage temporelle
- **Par jeu** : Afficher uniquement les activités d'un jeu spécifique

---

## Exportation de Patch

Après avoir terminé une traduction, vous pouvez exporter un paquet prêt à distribuer.

### Bouton "Exporter Patch"

Crée un fichier ZIP sur votre **Bureau** contenant :

```text
📦 NomJeu_fr_patch.zip
├── 📁 translated/          # Fichiers traduits prêts à l'emploi
│   └── fichier_traduit.csv
├── 📁 backup/               # Sauvegardes des fichiers originaux
│   └── fichier_original.csv
├── 📁 xunity/               # Format XUnity.AutoTranslator
│   └── AutoTranslator/
│       └── Translation/
│           └── fr/
│               └── _Translations.txt
├── 📄 README.txt            # Instructions d'installation
└── 📄 metadata.json         # Informations sur la traduction
```text

### Format XUnity.AutoTranslator

Le format XUnity est compatible avec :

- **Jeux Unity** avec BepInEx + XUnity.AutoTranslator
- Format : `texte_original=texte_traduit`

---

## Appliquer au Jeu

### Bouton "Appliquer au jeu"

Installe la traduction **directement dans le jeu** automatiquement :

1. **Détecte le moteur** du jeu (Unity, Unreal, etc.)
2. **Vérifie la compatibilité** avec les patchers disponibles
3. **Installe le patcher** si nécessaire (ex. BepInEx pour Unity)
4. **Copie les fichiers traduits** dans le bon dossier
5. **Configure le jeu** pour charger les traductions

### Moteurs Supportés

| Moteur | Patcher | État |
|--------|---------|------|
| Unity (Mono) | BepInEx + XUnity.AutoTranslator | ✅ Automatique |
| Unity (IL2CPP) | BepInEx IL2CPP | ⚠️ Partiel |
| Unreal Engine | - | 🔧 Manuel |
| RPG Maker | - | ✅ Remplacement direct |
| Ren'Py | - | ✅ Remplacement direct |

### Que Se Passe-t-il avec les Fichiers Originaux ?

**Les fichiers originaux sont TOUJOURS préservés !**

1. Avant d'écraser, une sauvegarde automatique est créée
2. Les sauvegardes sont enregistrées dans `.gamestringer_backups/` dans le dossier du jeu
3. Le nom de sauvegarde inclut un timestamp : `20241228_001500_nomfichier.csv`

---

## Gestion des Sauvegardes

### Où Trouver les Sauvegardes

Les sauvegardes sont enregistrées à deux endroits :

1. **Dans le dossier du jeu** : `[dossier_jeu]/.gamestringer_backups/`
2. **Dans le paquet ZIP exporté** : dossier `backup/`

### Comment Restaurer une Sauvegarde

Allez dans la section **Backup** de l'app
2. Sélectionnez le fichier à restaurer
3. Cliquez sur **Restaurer**

Trouvez le fichier de sauvegarde dans `.gamestringer_backups/`
2. Copiez le fichier à l'emplacement original
3. Renommez en supprimant le timestamp

---

## Éditeur de Traductions

L'Éditeur permet de modifier manuellement les traductions.

### Structure Hiérarchique

```text
📁 Jeux
├── 📁 Decarnation
│   ├── 📄 dialogues.csv (897 chaînes)
│   └── 📄 items.csv (123 chaînes)
└── 📁 Autre Jeu
    └── 📄 textes.json (456 chaînes)
```text

### Fonctionnalités (3)

- **Recherche** : trouver des chaînes par texte
- **Filtres** : afficher uniquement les traductions incomplètes, avec erreurs, etc.
- **Suggestions AI** : demander de nouvelles traductions pour des chaînes individuelles
- **Sauvegarde automatique** : les modifications sont enregistrées dans le dictionnaire

---

## Dictionnaires

Les dictionnaires sauvegardent les traductions pour chaque jeu.

### Comment Ils Fonctionnent

1. Chaque jeu a son propre dictionnaire séparé
2. Les traductions sont sauvegardées automatiquement
3. Réutilisées pour accélérer les traductions futures
4. Exportables en différents formats (JSON, CSV, TMX)

### Emplacement des Dictionnaires

```text
%APPDATA%/GameStringer/dictionaries/
├── 1672310_decarnation.json
├── 123456_autre_jeu.json
└── ...
```text

---

## Résolution de Problèmes

### La traduction est lente

- **Cause** : Trop de chaînes ou fournisseur lent
- **Solution** : Augmentez le batch size ou utilisez Gemini (plus rapide)

### Erreur de Clé API

- **Cause** : Clé API invalide ou expirée
- **Solution** : Vérifiez la clé sur le site du fournisseur

### Le patcher ne s'installe pas

- **Cause** : Antivirus bloque BepInEx
- **Solution** : Ajoutez une exception pour le dossier du jeu

### Fichier non reconnu

- **Cause** : Format de fichier non supporté
- **Solution** : Convertissez en CSV ou JSON

### Traduction avec erreurs de formatage

- **Cause** : L'IA a modifié des variables ou tags
- **Solution** : Activez "Quality Checks" pour détecter automatiquement

---

## Raccourcis Clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl + S` | Sauvegarder la traduction actuelle |
| `Ctrl + Z` | Annuler la modification |
| `Ctrl + F` | Rechercher dans le fichier |
| `Esc` | Fermer dialogue/panneau |

---

## Support

- **GitHub** : [github.com/rouges78/GameStringer](https://github.com/rouges78/GameStringer)
- **Issues** : Signalez des bugs ou demandez des fonctionnalités
- **Wiki** : Documentation technique détaillée

---

## Glossaire

Le Glossaire gère des dictionnaires de terminologie personnalisés pour chaque jeu, garantissant la cohérence des traductions.

### Fonctionnalités

- **Niveaux de termes** :
  - 🔴 **Locked** — terme toujours traduit de façon identique (noms propres, sorts, lieux)
  - 🟡 **Synced** — traduction cohérente, adaptable au contexte
  - 🟢 **Flexible** — traduction libre
- **Catégories** : personnage, lieu, objet, compétence, quête, UI, système, lore, créature, faction
- **Extraction automatique** : analyse IA pour suggérer des termes
- **Vérification de cohérence** : assure une traduction uniforme dans tous les fichiers
- **Import/Export** : CSV et JSON pour partager les glossaires entre jeux

### Comment l’utiliser

1. Allez dans **Outils Avancés → Glossaire**
2. Sélectionnez le jeu dans la liste
3. Ajoutez des termes manuellement ou utilisez **« Extraire les termes »** pour des suggestions IA
4. Définissez le niveau pour chaque terme
5. Le glossaire est appliqué automatiquement lors des traductions

---

## Context Harvester

Analyse les chaînes de texte pour les classifier et les enrichir de contexte avant la traduction IA.

### Fonctionnalités

- **Classification automatique** : identifie le type d’écran (menu, dialogue, narration, tutoriel, système)
- **Reconnaissance du locuteur** : déduit qui parle et le type de ton (formel, familier, agressif)
- **Métadonnées contextuelles** : chaque chaîne reçoit genre de jeu, type de contenu et ton
- **Sauvegarde des harvests** : contextes extraits sauvegardés et réutilisés
- **Traitement par lots** : analyse des fichiers entiers en une opération

### Comment l’utiliser

1. Allez dans **Outils Avancés → Context Harvester**
2. Collez les chaînes ou chargez un fichier
3. Cliquez **« Analyser »** pour classifier chaque chaîne
4. Téléchargez le résultat JSON comme entrée pour les traductions IA

---

## Mémoire de Traduction

Base de données persistante de toutes les traductions effectuées, avec réutilisation automatique.

### Fonctionnalités

- **Réutilisation automatique** : chaînes déjà traduites proposées sans nouvel appel IA
- **Recherche** : par texte original, traduction ou nom de jeu
- **Filtre par jeu** : affiche uniquement les traductions d’un titre spécifique
- **Statistiques** : total d’unités, distribution par jeu, date de dernière modification
- **Export** : JSON, CSV, TMX pour autres outils CAT
- **Import** : importe des traductions existantes depuis TMX ou CSV

### Comment l’utiliser

1. Allez dans **Outils Avancés → Mémoire de Traduction**
2. Recherchez des traductions précédentes avec la barre de recherche
3. Modifiez ou supprimez des unités individuelles si nécessaire
4. La mémoire est consultée automatiquement lors des traductions IA

---

## Traducteur OCR

Capture du texte de toute fenêtre de jeu ou capture d’écran en temps réel et le traduit instantanément.

### Fonctionnalités

- **Capture en temps réel** : analyse l’écran à intervalles configurables
- **Langues source** : japonais, anglais, chinois simplifié, coréen
- **Sélection de fenêtre** : pointe directement sur la fenêtre du jeu
- **Sélection de région** : définit une zone spécifique de l’écran
- **Confiance** : affiche le niveau de fiabilité pour chaque texte détecté
- **Touche de raccourci globale** : active/désactive la capture par raccourci clavier
- **Cache de traductions** : réutilise les traductions précédentes pour les chaînes identiques

### Comment l’utiliser

1. Allez dans **Traducteur OCR** depuis la barre latérale
2. Sélectionnez la langue source du jeu
3. Cliquez **« Sélectionner fenêtre »** et choisissez la fenêtre du jeu
4. *(Optionnel)* Définissez une région spécifique avec **« Sélectionner région »**
5. Appuyez sur **« Démarrer »** pour la capture et traduction automatique

---

## Révision IA

Révision automatique de la qualité des traductions avec détection d’erreurs et suggestions.

### Fonctionnalités

- **Mode singulier** : révision d’une paire original/traduction
- **Mode lot** : révision massive au format `original|traduction` par ligne
- **Catégories de problèmes** : exactitude, fluidité, terminologie, ton, structure
- **Niveaux de gravité** : critique, avertissement, info
- **Auto-fix** : correction automatique des problèmes mineurs
- **Statistiques** : score global 0–100 par lot

### Comment l’utiliser

1. Allez dans **Outils Avancés → Révision IA**
2. Choisissez **Singulier** ou **Lot**
3. Collez le texte original et la traduction
4. Cliquez **« Réviser »** pour recevoir le rapport
5. Utilisez **« Auto-fix »** pour appliquer les corrections suggérées

---

## Pipeline IA

Flux de travail automatisé en 6 étapes pour des traductions de qualité maximale en un clic.

### Étapes du Pipeline

1. **Harvest** — extrait et classifie le contexte
2. **Translate** — traduit avec le fournisseur IA configuré
3. **QA Check** — vérification automatique de qualité
4. **Auto-Fix** — corrige les problèmes trouvés
5. **Review** — révision IA finale
6. **Score** — calcule le score final 0–100

### Préréglages disponibles

- **Quick** — étapes essentielles (Translate + QA Check)
- **Max Quality** — les 6 étapes en séquence

### Comment l’utiliser

1. Allez dans **Outils Avancés → Pipeline IA**
2. Collez les chaînes à traduire
3. Choisissez un préréglage ou configurez les étapes manuellement
4. Cliquez **« Lancer le Pipeline »**
5. Téléchargez le rapport final avec les scores

---

## Traducteur d’Émotions

Traduction qui analyse et préserve les émotions présentes dans le dialogue original.

### Fonctionnalités

- **Analyse émotionnelle** : détecte l’émotion prédominante (colère, tristesse, peur, joie, neutre, surprise, dégoût)
- **Intensité** : mesure le niveau d’intensité émotionnelle (0–100)
- **Préservation du ton** : guide l’IA pour maintenir le même impact émotionnel
- **EmotionBadge** : étiquette visuelle par chaîne avec émotion et intensité
- **Statistiques par lots** : distribution des émotions dans un fichier entier

### Comment l’utiliser

1. Allez dans **Outils Avancés → Traducteur d’Émotions**
2. Collez le texte à traduire
3. Sélectionnez la langue cible
4. Cliquez **« Analyser et Traduire »**
5. Le résultat affiche la traduction avec les émotions identifiées

---

## Adaptation Culturelle

Analyse le texte traduit pour identifier les éléments culturellement problématiques et propose des adaptations.

### Fonctionnalités

- **Cultures supportées** : IT, EN, DE, FR, ES, JA, KO, ZH, PT, RU
- **Catégories analysées** : expressions idiomatiques, références culturelles, mesures/devises, couleurs symboliques, formules de politesse, humour
- **Suggestions spécifiques** : alternative adaptée à la culture cible
- **Score d’adaptation** : pourcentage du texte nécessitant une révision

### Comment l’utiliser

1. Allez dans **Outils Avancés → Adaptation Culturelle**
2. Collez le texte traduit
3. Sélectionnez culture source et cible
4. Cliquez **« Analyser »**
5. Appliquez les suggestions avant la publication finale

---

## Carte de Chaleur de Confiance

Visualise la qualité de chaque traduction via une carte codée par couleurs, identifiant instantanément les chaînes problématiques.

### Fonctions

- **8 métriques analysées** : espaces réservés manquants, chaînes vides, non traduites, ponctuation, majuscules, balises HTML, longueur, nombres
- **Code couleur** :
  - 🟢 **Excellent** (90–100 %) — traduction correcte
  - 🔵 **Bien** (75–89 %) — petits problèmes de style
  - 🟡 **Acceptable** (60–74 %) — problèmes mineurs
  - 🟠 **À revoir** (40–59 %) — erreurs importantes
  - 🔴 **Médiocre** (<40 %) — erreurs critiques
- **3 modes de saisie** : démo intégrée, coller du texte (`original|traduction` par ligne), charger un fichier (JSON/CSV/TXT)
- **Exporter le rapport** : télécharge JSON avec scores et problèmes pour chaque chaîne

### Comment l'utiliser

1. Allez dans **Outils Avancés → Carte de Chaleur de Confiance**
2. Choisissez le mode : **Démo** pour voir un exemple, **Coller** pour saisie manuelle, **Fichier** pour charger
3. Cliquez **« Analyser »**
4. Examinez le rapport coloré : les chaînes rouges/oranges nécessitent une révision prioritaire
5. Utilisez **« Exporter Rapport »** pour sauvegarder le résultat en JSON

---

## Gestionnaire de Blog

Gère un blog d'actualités et de mises à jour pour le projet de traduction, visible dans le tableau de bord.

### Fonctions

- **Créer des articles** : titre, date, courte description, tag de catégorie
- **Tags disponibles** : Feature, UI, Fix, Security, AI, Update, News
- **Épingler** : fixe les articles importants en haut de la liste
- **Édition en ligne** : modifie n'importe quel article sans changer de page
- **Supprimer article** : suppression avec confirmation
- **Affichage** : liste chronologique avec date stylisée, badge de tag coloré et aperçu de description

### Comment l'utiliser

1. Allez dans **Gestionnaire de Blog** depuis le menu principal
2. Cliquez **« Nouvel Article »**
3. Remplissez date (ex. « 24 Jan »), titre (avec emojis recommandés), description et tag
4. Cliquez **« Enregistrer »**
5. Utilisez l'icône 📌 pour épingler un article en haut

---

## Ren'Py Patcher

Patcher dédié pour les visual novels créés avec le moteur Ren'Py. Extrait dialogues, menus et narration des fichiers `.rpy` et génère les fichiers de traduction natifs.

### Fonctions

- **Détection automatique** : identifie titre, version et fichiers script du jeu
- **Types de chaîne** : Dialogue, Menu, Narration
- **Identification du personnage** : montre quel personnage prononce chaque réplique
- **Éditeur en ligne** : cliquer sur une chaîne pour modifier sa traduction
- **Recherche et filtre** : chercher par texte ou personnage, filtrer par type
- **Générer des fichiers `.rpy`** : crée la structure `tl/<langue>/` compatible Ren'Py
- **Sauvegarder/Charger JSON** : sauvegarder la progression et reprendre plus tard
- **Statistiques** : pourcentage d'achèvement, nombre par type

### Comment l'utiliser

1. Allez dans **Ren'Py Patcher** depuis la barre latérale
2. Cliquez **« Parcourir »** et sélectionnez le dossier du jeu Ren'Py
3. Cliquez **« Extraire les Chaînes »**
4. Modifiez les traductions dans l'éditeur (cliquer sur une chaîne)
5. Entrez le nom de la langue cible (ex. `french`) et cliquez **« Générer .rpy »**
6. Les fichiers sont sauvegardés dans le dossier `tl/` du jeu

---

## RPG Maker Patcher

Patcher dédié pour les jeux RPG Maker (MV, MZ, XP, VX, VX Ace). Lit les fichiers `.json` et `.rxdata`/`.rvdata` du projet.

### Fonctions

- **Détection de version** : identifie automatiquement MV/MZ/XP/VX/Ace
- **Fichiers supportés** : Actors, Classes, Skills, Items, Weapons, Armors, Enemies, Troops, States, Maps, CommonEvents, System
- **Statistiques par fichier** : progression de traduction ventilée par fichier
- **Intégration Translator++** : lien de téléchargement direct vers Translator++
- **Exporter le patch** : sauvegarde les traductions en JSON
- **Éditeur** : recherche plein texte, édition en ligne

### Comment l'utiliser

1. Allez dans **RPG Maker Patcher** depuis la barre latérale
2. Sélectionnez le dossier du projet RPG Maker
3. Cliquez **« Extraire les Chaînes »**
4. Traduisez les chaînes dans l'éditeur
5. Cliquez **« Sauvegarder Patch »**

---

## Wolf RPG Patcher

Patcher dédié pour les jeux Wolf RPG Editor. Gère les fichiers binaires `.wolf` et les cartes du jeu.

### Fonctions

- **Fichiers supportés** : Data/*.wolf (base de données), Map/*.mps (cartes)
- **Types de chaîne** : Base de données, Carte, Script, Événement
- **Détection de chiffrement** : avertit si le jeu utilise des fichiers chiffrés
- **Intégration WolfTrans** : suggère WolfTrans pour les fichiers chiffrés
- **Barre de progression** : pourcentage d'achèvement pour l'ensemble du projet
- **Sauvegarder/Charger** : JSON pour reprendre le travail

### Comment l'utiliser

1. Allez dans **Wolf RPG Patcher** depuis la barre latérale
2. Sélectionnez le dossier du jeu Wolf RPG
3. Cliquez **« Extraire les Chaînes »**
4. Si le jeu est chiffré, suivez les instructions WolfTrans
5. Traduisez les chaînes et cliquez **« Sauvegarder »**

---

## Danganronpa Patcher

Patcher dédié pour la série de jeux Danganronpa. Gère les archives `.pak` et les fichiers de localisation `.po`.

### Fonctions

- **Détection du jeu** : identifie automatiquement DR1, DR2, V3
- **Archives PAK** : extrait et liste les fichiers dans les archives `.pak`
- **Fichiers PO** : support natif pour `.po`/`.pot` avec statut traduit/non traduit/approximatif
- **Traduction IA intégrée** : bouton pour traduire automatiquement avec l'IA configurée
- **Statistiques PO** : comptage traduit, non traduit, approximatif et pourcentage
- **Intégration DRAT** : lien vers l'outil DRAT pour les opérations avancées
- **Exporter le patch** : exporte le fichier `.po` modifié

### Comment l'utiliser

1. Allez dans **Danganronpa Patcher** depuis la barre latérale
2. Sélectionnez le dossier du jeu Danganronpa
3. Extrayez l'archive `.pak` ou chargez directement un fichier `.po`
4. Modifiez les chaînes dans l'éditeur ou utilisez **« Traduire avec IA »**
5. Exportez le fichier `.po` complété pour le réimporter dans le jeu

---

## Comparaison Multi-LLM

La Comparaison Multi-LLM envoie le même texte à plusieurs fournisseurs d'IA en parallèle et sélectionne automatiquement la meilleure traduction.

### Fournisseurs supportés

- **OpenAI** (GPT-4o)
- **Gemini** (Google)
- **Claude** (Anthropic)
- **DeepSeek**
- **Mistral**
- **DeepL**
- **Libre Translate**

### Fonctionnalités

- **Comparaison parallèle** : traduction simultanée avec 2–7 fournisseurs
- **Sélection automatique** : le système choisit la traduction ayant le meilleur score
- **Traduction de consensus** : lorsque plusieurs modèles concordent, une version combinée est générée
- **Score de qualité** : chaque traduction reçoit un score sur la fluidité, la précision, la cohérence et le style
- **Profils de personnage** : appliquez un profil de voix pour personnaliser le ton et le vocabulaire

### Comment l'utiliser

1. Allez dans **Translator → Compare** depuis la barre latérale
2. Saisissez le texte source et sélectionnez la langue cible
3. Choisissez au moins 2 fournisseurs dans la barre supérieure
4. Cliquez sur **« Comparer »** pour lancer les traductions en parallèle
5. Examinez les résultats avec score et choisissez votre traduction préférée, ou utilisez celle sélectionnée automatiquement

---

## Score de Qualité en Direct

Le système de Score de Qualité en Direct évalue automatiquement chaque traduction sur plusieurs dimensions, en attribuant un score numérique et une catégorie.

### Dimensions évaluées

| Dimension | Description |
|---|---|
| **Fluidité** | Naturel et lisibilité dans la langue cible |
| **Précision** | Fidélité au sens original |
| **Cohérence** | Consistance terminologique avec le reste du projet |
| **Style** | Adéquation du ton et du registre au contexte du jeu |

### Catégories de score

- **Excellent** (90–100) : traduction prête pour publication
- **Bon** (75–89) : petites améliorations optionnelles
- **Acceptable** (60–74) : révision recommandée
- **À revoir** (40–59) : corrections nécessaires
- **Médiocre** (0–39) : retraduction nécessaire

### Contrôles automatiques

- Préservation des nombres et des marqueurs de position (`{0}`, `%s`, etc.)
- Cohérence de la longueur par rapport à l'original
- Détection de mots non traduits
- Vérification de la ponctuation et du format

---

## Profils de Voix de Personnage

Les Profils de Voix de Personnage permettent de personnaliser les traductions en fonction de la personnalité de chaque personnage du jeu.

### Archétypes disponibles

Hero, Villain, Mentor, Sidekick, Love Interest, Comic Relief, Mysterious Stranger, Noble, Pirate, Warrior, Wizard, Merchant, Child, Robot, Monster, Narrator — ou **Custom**.

### Paramètres configurables

- **Personnalité** : archétype, traits de caractère, humeur, âge, genre
- **Style de parole** : formalité (très formel → très informel), vocabulaire (archaïque, sophistiqué, standard, simple, argot, technique), longueur de phrases, ponctuation
- **Motifs** : phrases récurrentes, mots de remplissage, suffixes finaux, mots à éviter, substitutions préférées
- **Voix TTS** *(optionnel)* : fournisseur (OpenAI, ElevenLabs, Azure), voix, tonalité, vitesse, émotion
- **Exemples de dialogues** : paires original/traduit pour guider l'IA

### Comment l'utiliser

1. Ouvrez le **Character Profile Manager** depuis le panneau de traduction
2. Choisissez un archétype prédéfini ou créez un profil personnalisé
3. Configurez personnalité, style, motifs et vocabulaire
4. Ajoutez des exemples de dialogues pour améliorer la cohérence
5. Sauvegardez le profil — il sera appliqué automatiquement dans les futures traductions pour ce personnage

---

## Pipeline de Traduction Vocale

La Pipeline de Traduction Vocale transforme l'audio parlé en texte traduit et synthétisé dans une autre langue, dans un seul flux de bout en bout.

### Étapes de la pipeline

1. **Enregistrement / Upload** : enregistrez l'audio depuis le microphone ou téléchargez un fichier audio
2. **Transcription (Whisper)** : conversion parole-texte via OpenAI Whisper
3. **Traduction IA** : traduction du texte transcrit dans la langue cible
4. **Synthèse vocale (TTS)** : génération de l'audio traduit avec des voix synthétiques

### Voix disponibles

| Voix | Caractéristique |
|---|---|
| **Nova** | Féminine, naturelle |
| **Alloy** | Neutre, polyvalente |
| **Echo** | Masculine, chaleureuse |
| **Fable** | Narrative, expressive |
| **Onyx** | Masculine, profonde |
| **Shimmer** | Féminine, brillante |

### Comment l'utiliser

1. Allez dans **Voice Translator** depuis la barre latérale
2. Enregistrez l'audio avec le microphone ou téléchargez un fichier `.wav`/`.mp3`
3. Le système transcrit automatiquement l'audio avec Whisper
4. Sélectionnez la langue cible et lancez la traduction
5. Choisissez une voix TTS et générez l'audio traduit
6. Écoutez ou téléchargez le résultat

> **Note** : Nécessite une clé API OpenAI configurée pour Whisper et TTS.

---

## OCR Multi-Moteur

OCR Multi-Moteur supporte 4 moteurs OCR avec détection automatique et fallback intelligent pour la reconnaissance de texte à partir de captures d'écran de jeux.

### Moteurs supportés

| Moteur | Description | Points forts |
|---|---|---|
| **OneOCR** | Windows 11 AI natif (port 17231) | Polices stylisées, texte superposé, basse résolution |
| **PaddleOCR** | Baidu open-source (port 8866) | CJK excellent, texte vertical, haute précision |
| **RapidOCR** | Wrapper léger ONNX (port 9003) | Rapide, léger, facile à installer |
| **Tesseract.js** | Intégré au navigateur | Toujours disponible, 100+ langues, aucune configuration |

### Fonctionnalités

- **Détection automatique** : sondage des moteurs disponibles au démarrage
- **Chaîne de fallback** : OneOCR → PaddleOCR → RapidOCR → Tesseract (CJK : PaddleOCR en premier)
- **Mode comparaison** : exécute tous les moteurs en parallèle et utilise le meilleur résultat
- **Prétraitement d'image** : niveaux de gris, contraste, seuil, mise à l'échelle pour petit texte
- **Moteur préféré** : sauvegarde la préférence pour les sessions futures

### Comment l'utiliser

1. Allez dans **OCR Multi-Engine** depuis la barre latérale
2. Cliquez sur **« Détecter les moteurs »** pour vérifier lesquels sont en ligne
3. Sélectionnez le moteur préféré en cliquant sur la carte correspondante
4. Téléchargez une capture d'écran ou collez une image
5. Le système reconnaît le texte avec le moteur choisi (ou fallback automatique)

---

## OCR Jeux Rétro

OCR Jeux Rétro est un module spécialisé pour la reconnaissance de texte à partir de captures de jeux rétro avec des polices pixelisées.

### Presets disponibles

| Preset | Époque | Optimisation |
|---|---|---|
| **8-bit** | NES, Game Boy, MSX | Mise à l'échelle 4x, seuil élevé, suppression du dithering |
| **16-bit** | SNES, Mega Drive, PC Engine | Mise à l'échelle 3x, contraste moyen, sharpen |
| **DOS/PC** | DOS, EGA/VGA | Mise à l'échelle 2x, seuil moyen, police monospace |
| **PC-98** | NEC PC-98 (japonais) | Mise à l'échelle 3x, seuil élevé, optimisé CJK |
| **Early Windows** | Windows 3.1/95/98 | Mise à l'échelle 2x, contraste léger |

### Paramètres configurables

- **Mise à l'échelle** : facteur d'agrandissement (nearest-neighbor pour préserver les pixels)
- **Contraste** : augmentation du contraste avant la reconnaissance
- **Seuil binaire** : conversion noir/blanc avec seuil configurable
- **Suppression du dithering** : filtre les motifs de dithering typiques des jeux rétro
- **Sharpen / Denoise** : netteté et réduction du bruit

### Comment l'utiliser

1. Ouvrez le panneau **Retro-Game OCR** dans la section OCR
2. Choisissez un preset de jeu ou configurez les paramètres manuellement
3. Téléchargez la capture du jeu rétro
4. Le système prétraite l'image et applique une reconnaissance optimisée
5. Vérifiez et modifiez le texte reconnu

---

## MT Adaptative

MT Adaptative (Traduction Automatique Adaptative) est un système qui apprend des corrections humaines pour améliorer progressivement la qualité des traductions.

### Comment ça fonctionne

1. **Sauvegarde des corrections** : quand vous corrigez une traduction AI, la paire (original → correction) est sauvegardée
2. **Similarité fuzzy** : trigrammes (coefficient de Dice) + similarité de mots (Jaccard) pour trouver des corrections pertinentes
3. **Few-shot learning** : les corrections les plus similaires au texte actuel sont injectées dans le prompt comme exemples
4. **Feedback loop** : plus vous sauvegardez de corrections, meilleures deviennent les traductions futures

### Fonctionnalités

- **Auto-détection de tags** : tone_change, terminology, major_rewrite, length_change, punctuation, style
- **Boost contextuel** : priorité aux corrections du même jeu (1.3x), même type de contenu (1.2x), corrections récentes
- **Approbation** : marquez les corrections comme vérifiées pour une fiabilité accrue
- **Import/Export** : exportez et importez des ensembles de corrections entre projets
- **Statistiques** : nombre de corrections par langue, jeu, type, tag et utilisation moyenne

### Configuration

| Paramètre | Par défaut | Description |
|---|---|---|
| **Max examples** | 5 | Maximum d'exemples few-shot par prompt |
| **Seuil similarité** | 0.2 | Minimum de similarité pour inclure un exemple |
| **Même jeu** | Oui | Préférer les corrections du même jeu |
| **Approuvées uniquement** | Non | Utiliser uniquement les corrections approuvées |

---

## Traducteur Batch de Dossiers

Le Traducteur Batch de Dossiers traduit des dossiers entiers de fichiers en une seule opération, en préservant la structure originale.

### Fonctionnalités

- **Scan récursif** : scanne automatiquement les sous-dossiers
- **Multi-format** : supporte CSV, JSON, XML, PO, YAML, TXT, SRT, VTT et plus
- **Sélection intelligente** : filtre par type de fichier, taille ou motif
- **Sortie flexible** : dossier de sortie personnalisable avec structure préservée
- **Traduction parallèle** : jusqu'à 3 batchs simultanés pour une vitesse maximale
- **Translation Memory** : utilise et alimente la mémoire de traduction automatiquement
- **Classification du contenu** : classe les chaînes par type (dialogue, UI, système) avant la traduction
- **Contrôle qualité** : QA automatique avec score minimum configurable
- **Pause/Reprise** : mettez en pause et reprenez la traduction à tout moment

### Paramètres

| Paramètre | Par défaut | Description |
|---|---|---|
| **Taille batch** | 40 | Chaînes par appel API |
| **Parallèles** | 3 | Batchs simultanés |
| **Délai** | 50ms | Pause entre batchs |
| **Score min.** | 70 | Seuil qualité minimum |
| **Max tentatives** | 3 | Tentatives en cas d'erreur |

### Comment l'utiliser

1. Allez dans **Batch Translator** depuis la barre latérale
2. Sélectionnez le dossier source contenant les fichiers à traduire
3. Choisissez langue source, langue cible et fournisseur AI
4. Configurez les options (TM, QA, classification, pipeline)
5. Cliquez sur **« Démarrer »** pour lancer la traduction batch
6. Suivez la progression en temps réel — vous pouvez mettre en pause ou annuler

---

## Traducteur Hors-ligne

Le Traducteur Hors-ligne permet de traduire des textes sans connexion internet, en utilisant des modèles AI locaux via Ollama. Aucune donnée n'est envoyée en ligne.

### Prérequis

- **Ollama** installé et en cours d'exécution (`ollama serve`)
- Au moins un modèle de traduction téléchargé

### Modèles recommandés

| Modèle | Taille | Description |
|---|---|---|
| **huihui_ai/hy-mt1.5-abliterated:7b** | ~4.5 Go | Tencent HY-MT 1.5 — #1 WMT25, bat Google Translate dans 30/31 langues |
| **huihui_ai/hy-mt1.5-abliterated:1.8b** | ~1.2 Go | Version légère et ultra-rapide |
| **translategemma:12b** | ~8.0 Go | Google TranslateGemma — 55 langues, haute qualité |
| **translategemma:2b** | ~1.5 Go | Google TranslateGemma — 55 langues, rapide et léger |
| **qwen3:4b** | ~2.5 Go | Alibaba Qwen 3 — usage général, bon pour la traduction |

### Fonctionnalités

- **Mode individuel** : traduisez un texte à la fois
- **Mode batch** : traduisez plusieurs textes (un par ligne) en une seule opération
- **14 langues supportées** : IT, EN, FR, DE, ES, PT, RU, JA, KO, ZH, PL, NL, TR, CS
- **Échange de langues** : inversez source et cible en un clic
- **Sélection de modèle** : choisissez parmi les modèles installés sur Ollama
- **Historique des résultats** : tous les résultats affichés avec le temps de traduction
- **Copier les résultats** : copiez une traduction individuelle ou toutes ensemble
- **Configuration intégrée** : démarrez Ollama et téléchargez des modèles directement depuis l'interface

### Comment l'utiliser

1. Allez dans **Traducteur Offline** depuis la barre latérale
2. Si Ollama n'est pas en cours d'exécution, cliquez sur **« Démarrer Ollama »** dans le panneau de configuration
3. Téléchargez un modèle recommandé (ex. `hy-mt1.5-abliterated:7b`)
4. Sélectionnez la langue source et cible
5. Saisissez le texte et cliquez sur **« Traduire »** (ou Ctrl+Entrée)
6. Pour le batch : activez le mode batch et saisissez plusieurs lignes

---

## Traducteur Manga/BD

Le Traducteur Manga/BD est un outil spécialisé pour la traduction de bandes dessinées et mangas, avec détection automatique des bulles, OCR, traduction et inpainting.

### Fonctionnalités

- **Détection des bulles** : identifie automatiquement les bulles de texte dans les pages
- **OCR intégré** : reconnaît le texte à l'intérieur des bulles (horizontal et vertical)
- **Traduction automatique** : traduit le texte reconnu dans la langue cible
- **Inpainting** : supprime le texte original et le remplace par la traduction
- **Styles de police** : Manga Style, Comic Sans, Handwritten, Bold
- **Multi-page** : gérez plusieurs pages simultanément
- **Traduction batch** : traite toutes les pages en séquence
- **Exportation** : exportez une page individuelle ou toutes les pages traduites

### Langues supportées

JA (japonais), ZH (chinois), KO (coréen), EN (anglais), IT (italien), ES (espagnol), FR (français), DE (allemand)

### Comment l'utiliser

1. Allez dans **Manga Translator** depuis la barre latérale
2. Téléchargez les pages du manga/BD (glisser-déposer ou sélection de fichiers)
3. Sélectionnez la langue source et cible
4. Cliquez sur **« Détecter & Traduire »** pour analyser la page courante
5. Vérifiez les bulles détectées et les traductions
6. Cliquez sur **« Inpainting »** pour appliquer les traductions sur l'image
7. Exportez la page traduite

---

## Traducteur de Textures

Le Traducteur de Textures traduit le texte présent dans les textures de jeux vidéo (menus, HUD, boutons, UI), en préservant le style graphique et le formatage.

### Formats supportés

| Format | Description |
|---|---|
| **DDS** | DirectDraw Surface (le plus courant dans les jeux) |
| **PNG** | Portable Network Graphics |
| **TGA** | Targa |
| **BMP** | Bitmap |
| **JPG** | JPEG |
| **WebP** | WebP |

### Fonctionnalités

- **Détection de régions** : scanne la texture pour trouver les zones avec du texte
- **OCR pour textures** : reconnaît le texte dans les régions détectées
- **Traduction automatique** : traduit le texte en préservant le contexte visuel
- **Préservation du style** : maintient les couleurs de fond, couleur du texte, police et taille
- **Auto-match de police** : sélectionne automatiquement la police la plus similaire
- **Aperçu** : montre l'aperçu de la texture avant et après la traduction
- **Traitement batch** : traite toutes les textures en séquence
- **Exportation** : exportez une texture individuelle ou toutes les textures modifiées

### Comment l'utiliser

1. Allez dans **Texture Translator** depuis la barre latérale
2. Téléchargez les textures (glisser-déposer, sélection de fichiers ou dossier entier)
3. Sélectionnez la langue source et cible
4. Cliquez sur **« Scanner Texture »** pour détecter les régions de texte
5. Vérifiez et modifiez les traductions proposées
6. Cliquez sur **« Appliquer Traductions »** pour générer la texture traduite
7. Exportez les textures modifiées

---

## Auto-Glossaire

L'Auto-Glossaire extrait automatiquement des termes de jeu à partir des textes en utilisant un LLM, les sauvegarde dans un glossaire par jeu et les injecte dans les prompts de traduction pour garantir la cohérence terminologique.

### Système à 3 niveaux

| Niveau | Icône | Comportement |
|---|---|---|
| **Locked** | 🔒 | Traduction fixe, jamais modifiée par l'AI |
| **Synced** | 🔄 | Traduction préférée, l'AI peut suggérer des alternatives |
| **Flexible** | 🔓 | Traduction suggérée, l'AI choisit la meilleure |

### Catégories de termes

👤 Personnage, 📍 Lieu, 🎒 Objet, ⚔️ Compétence, 📜 Quête, 🖥️ UI, ⚙️ Système, 📚 Lore, 🐉 Créature, 🏰 Faction, 📌 Autre

### Fonctionnalités

- **Extraction automatique** : analyse les textes du jeu avec LLM et extrait les termes clés
- **Termes par défaut** : ajoute automatiquement les termes gaming courants (HP, XP, NPC, etc.)
- **Recherche et filtre** : cherchez par texte, filtrez par niveau ou catégorie
- **Injection dans les prompts** : les termes sont automatiquement injectés dans les prompts de traduction
- **Do Not Translate** : marquez les termes qui ne doivent pas être traduits
- **Case-sensitive** : option pour les termes sensibles à la casse (noms propres)
- **Import/Export** : exportez et importez des glossaires en format CSV ou JSON
- **Contrôle de cohérence** : vérifie que les termes sont utilisés de manière cohérente dans les traductions
- **Statistiques** : nombre de termes par niveau, catégorie et source (auto/manuel)

### Configuration

| Paramètre | Par défaut | Description |
|---|---|---|
| **Activé** | Oui | Active/désactive le glossaire automatique |
| **Extraire au premier batch** | Oui | Extrait les termes du premier batch traduit |
| **Max termes par extraction** | 20 | Maximum de termes extraits par exécution |
| **Confiance minimale** | 50 | Seuil minimal de confiance (0–100) |
| **Injecter dans les prompts** | Oui | Injecte les termes dans les prompts de traduction |
| **Max termes dans le prompt** | 30 | Maximum de termes par prompt (limite la fenêtre de contexte) |

### Comment l'utiliser

1. Allez dans **Glossaire** depuis la barre latérale
2. Créez un nouveau glossaire en sélectionnant jeu, langue source et cible
3. Ajoutez des termes manuellement ou cliquez sur **« Extraire Termes »** pour l'extraction AI
4. Configurez le niveau (Locked/Synced/Flexible) et la catégorie pour chaque terme
5. Les termes sont automatiquement injectés dans les prompts de traduction
6. Utilisez **« Vérifier Cohérence »** pour vérifier l'utilisation uniforme des termes

---

## Nouveautés v1.4.0

### Radix UI Unifié

La bibliothèque UI a été migrée des packages individuels `@radix-ui/react-*` vers le package unifié `radix-ui` :

- **37 composants migrés** avec des imports simplifiés
- **27 packages supprimés** des dépendances, bundle plus léger
- Aucun changement visuel — même UI, moins de dépendances

### Quality Badges dans Translator Pro

Chaque ligne traduite affiche désormais des indicateurs de qualité visuels :

- **QualityScoreBadge** : score 0-100 avec couleurs (🟢 ≥80, 🟡 ≥60, 🔴 <60)
- **ContentTypeBadge** : classifie le type de contenu (UI, Dialogue, Narratif, Système, Tutoriel, etc.)
- **Aperçu en direct** : pendant la traduction batch, les 3 dernières lignes apparaissent avec le score en temps réel
- **Tableau de détails** : dans la page résultats, jusqu'à 200 lignes avec source, traduction, type et qualité

### Support RTL

- Détection automatique de la direction du texte pour les langues RTL (arabe, hébreu)
- Attribut `dir` appliqué dynamiquement au document HTML

### Ollama Générique

- Nouveau provider `translateWithOllamaGeneric` pour utiliser n'importe quel modèle Ollama
- PROVIDER_MAP avec mappage automatique des modèles
- Chain presets avec fallback automatique entre providers

### Optimisation du Bundle

- `optimizePackageImports` mis à jour avec `radix-ui`, `framer-motion`, `recharts`, `cmdk`, `react-hook-form`
- Zéro erreurs TypeScript dans les fichiers source

---

## Nouveautés v1.4.1

### Support Complet GOG Galaxy

- **Lecture bibliothèque GOG Galaxy 2.0** : lit les jeux possédés depuis la base SQLite locale
- **Couvertures et descriptions via GOG API** : récupération automatique des images et détails
- **Fusion avec jeux installés** : combine les données du registre avec Galaxy
- **Liens store et téléchargement** : page Store avec liens directs GOG Galaxy

### Tableau de Bord Amélioré

- **Stores connectés en haut** : les stores sont maintenant à côté du dernier jeu ouvert
- **Badges store avec comptages réels** : affiche le nombre réel de jeux par store
- **Placeholder dernier jeu** : affichage élégant quand aucun jeu ouvert

### Détail Jeu Amélioré

- **Onglet Info** : config requise, score Metacritic, liens store, liste DLC
- **Couvertures GOG** : fallback automatique pour les jeux GOG
- **Descriptions GOG** : récupération complète via GOG API

### Corrections Fournisseurs AI

- **Fournisseurs gratuits jamais bloqués définitivement** : MyMemory, Lingva utilisent cooldown (30s)
- **Steam Wishlist** : nouvel endpoint IWishlistService avec fallback legacy

### Performance

- **Cache sessionStorage** : navigation instantanée retour détail → bibliothèque
- **Sauvegarde batch couvertures** : avec debounce (2s) pour éviter les race conditions
- **Dédup fetch SteamGridDB** : évite les requêtes dupliquées en StrictMode

### Build Multi-Plateforme

- **Script build Node.js** : `build-tauri-cross.js` remplace le script PowerShell
- **Support Linux** : le workflow GitHub Actions compile aussi pour Linux (.deb, .AppImage)
- **Windows** : installeur (.msi, .exe NSIS) et version portable (.zip)

### Documentation

- **11 guides utilisateur** : corrections markdown lint
- **Numérotation index corrigée** : index ordonné sans sauts

---

## Nouveautés v1.4.2

### Vision LLM Translator

- **Traduction context-aware**: utilise des captures d'écran du jeu pour le contexte visuel
- **3 fournisseurs supportés**: Ollama (local), Gemini 2.0 Flash, OpenAI GPT-4o
- **Upload ou capture**: chargez une image ou capturez l'écran pour le contexte IA
- **Page dédiée**: `/vision-translator` avec sidebar intégrée

### Outils IA Avancés

- **Lore Assistant**: chat RAG pour explorer le lore et les dialogues du jeu
- **Auto-Hook Scanner**: scan mémoire de processus avec WinAPI
- **System Monitor**: monitoring VRAM/RAM en temps réel (backend Rust)
- **Ollama Setup Wizard**: guide d'installation IA locale étape par étape
- **Debug Console**: console de débogage avec interception des logs
- **Plugin System**: document de conception `PLUGIN_SYSTEM.md`

### Community Hub

- **GitHub Discussions**: 12 discussions créées dans les catégories Announcements, General, Ideas, Q&A, Show and tell, Polls
- **Fetch REST API publique**: le Community Hub charge maintenant les discussions sans token GitHub
- **Sidebar renommée**: "Workshop" → "Steam Workshop" pour plus de clarté

### Correction Fournisseurs de Traduction

- **Ollama cooldown**: les erreurs réseau utilisent maintenant un cooldown de 30s au lieu d'un blocage permanent
- **Lingva 404**: troncature automatique des textes >500 caractères pour éviter les URL trop longues
- **Auto-Translate Review**: nouveau bouton "Traduire toutes les non traduites" avec barre de progression et stop
- **Tutorial querySelector**: fix SyntaxError avec sélecteurs `:contains()` (non CSS standard)
- **Update Bell**: fix version incorrecte dans le popup (fallback hardcodé supprimé)

### CI/CD et Sécurité

- **Tauri Signing Key**: configurée pour la génération automatique de `latest.json` signé
- **GitHub Secrets**: `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` configurés
- **Workflow release.yml**: mis à jour avec les variables de signature pour les deux jobs (Windows + Linux)

### Unity : Installation automatique de BepInEx + XUnity AutoTranslator

- **Détection automatique Unity** : si le scanner ne trouve pas de fichiers traduisibles dans un jeu Unity, affiche une carte dédiée au lieu d’une erreur générique
- **Installation en un clic** : le bouton « Installer BepInEx + XUnity AutoTranslator » détecte automatiquement l’exe du jeu, installe le framework et le plugin de traduction avec des logs en temps réel
- **Flux guidé** : après l’installation, suggère de lancer le jeu une fois puis de rescanner — tous les textes deviennent traduisibles
- **Crédits** : BepInEx Team et bbepis (XUnity AutoTranslator)

---

> GameStringer v1.4.2 - Guide mis à jour le 03/03/2026
