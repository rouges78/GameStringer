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
```

### Exemple de Réponse

```json
{
  "translation": "Bonjour le monde !",
  "source": "en",
  "target": "fr",
  "provider": "gemini",
  "tokens": 12
}
```

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
```

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

```
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
```

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

```
📁 Jeux
├── 📁 Decarnation
│   ├── 📄 dialogues.csv (897 chaînes)
│   └── 📄 items.csv (123 chaînes)
└── 📁 Autre Jeu
    └── 📄 textes.json (456 chaînes)
```

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

```
%APPDATA%/GameStringer/dictionaries/
├── 1672310_decarnation.json
├── 123456_autre_jeu.json
└── ...
```

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

### Community Hub

- **GitHub Discussions**: 12 discussions créées dans les catégories Announcements, General, Ideas, Q&A, Show and tell, Polls
- **Fetch REST API publique**: le Community Hub charge maintenant les discussions sans token GitHub
- **Sidebar renommée**: "Workshop" → "Steam Workshop" pour plus de clarté

### Correction Update Bell

- **Version actuelle correcte**: le fallback dans la cloche de mise à jour affiche maintenant la version réelle
- **NotificationIndicator supprimé**: la cloche de notification dupliquée a été supprimée définitivement du header

### CI/CD et Sécurité

- **Tauri Signing Key**: configurée pour la génération automatique de `latest.json` signé
- **GitHub Secrets**: `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` configurés
- **Workflow release.yml**: mis à jour avec les variables de signature pour les deux jobs (Windows + Linux)

---

*GameStringer v1.4.2 - Guide mis à jour le 03/03/2026*
