# GameStringer - Guide Complète

## 🆕 Nouveautés v1.15.0

- ⚙️ **Paramètres d'inférence Ollama** : nouvelle page *Ollama Manager → Avancé* avec 3 presets (Fidèle/Équilibré/Créatif) et un mode expert pour régler `temperature`, `top_p`, `top_k`, `repeat_penalty`, `num_ctx` et `seed` des modèles locaux.
- 🚀 **Projets ↔ Patch Hub** : chaque `.gspack` importé est enregistré comme un projet terminé ; depuis Projets vous pouvez **Appliquer au jeu** (avec sauvegarde `.bak`) ou **Publier** la traduction pré-remplie sur le Patch Hub.
- 💬 **Widget de feedback** dans *Paramètres → Communauté* : signalez des bugs ou des idées avec le contexte technique joint automatiquement (version, plateforme, écran).
- ⚡ **Patch Hub plus rapide** : cache local de la liste et limites anti-abus pour naviguer entre les onglets sans recharger depuis le serveur à chaque fois.

## 🆕 Nouveautés v1.12.0

- 👁️ Traduction avec contexte visuel (VLM) : l'IA voit l'écran et traduit avec le contexte, levant les ambiguïtés (ex. "Chest" = coffre ou poitrine). Local (Ollama) ou OpenAI/Gemini
- 🪞 Passe autocorrective (Reflection) : une seconde passe optionnelle revoit et affine la traduction selon le glossaire, le ton et la cohérence — seulement si nécessaire
- 🧠 Mémoire sémantique (RAG) : mémoire de traduction et glossaire appariés par le sens via des embeddings locaux, pour une terminologie cohérente dans tout le jeu
- ⚡ Traduction en direct plus fluide et traitement natif des captures (recadrage/redimensionnement avant l'appel à l'IA)
- 🔌 Plus de fournisseurs prêts à l'emploi : DeepL, Groq, Cerebras, Cohere, Together, Fireworks, Hugging Face, Azure Translator, DashScope, LibreTranslate, Lingva, MyMemory
- 🧰 Nouveaux réglages pour ajuster reflection, RAG sémantique et contexte visuel (qualité vs. vitesse/coût)

## 🆕 Nouveautés de la v1.11.2

- **Plus de boutiques** : Humble App, Game Jolt et Big Fish Games sont désormais détectés automatiquement.
- **Recherche de traduction** : vérifie via PCGamingWiki si un jeu propose déjà votre langue, avec des liens de recherche de patchs italiens fan-made.
- **Publier sur le Patch Hub** : envoyez un projet terminé au Patch Hub communautaire en une étape (Projets → Publier).
- **Nouveaux moteurs** : pipeline cloud TyranoScript et un parseur `.pck` réécrit qui lit les vraies archives Godot 4.4+.
- **Unity** : pont Ollama local pour XUnity (CustomTranslate) ; les téléchargements (BepInEx/XUnity/TMP/UABEA) passent par l’API GitHub.

## Sommaire

1. [Configuration Initiale](#phase-1-configuration-initiale)
2. [Connexion des Boutiques](#phase-2-connexion-des-boutiques)
3. [Bibliothèque de Jeux](#phase-3-bibliothèque-de-jeux)
4. [Traduire un Jeu (Auto-Translate)](#phase-4-traduire-un-jeu)
5. [Patcher Engine](#phase-5-patcher-engine)
6. [Unity CSV Translator](#phase-6-unity-csv-translator)
7. [BepInEx + XUnity](#phase-7-bepinex--xunity)
8. [AI Pipeline Multi-Agent](#phase-8-ai-pipeline)
9. [Traducteur AI](#phase-9-traducteur-ai)
10. [Traducteur OCR et Multi-Engine](#phase-10-traducteur-ocr)
11. [Traducteur Vocal](#phase-11-traducteur-vocal)
12. [Traduction par Lots et Hors Ligne](#phase-12-traduction-par-lots)
13. [Danganronpa Patcher](#phase-13-danganronpa-patcher)
14. [Prediction Tool et QA Check](#phase-14-prediction-tool-et-qa-check)
15. [Glossaire, TM et Adaptive MT](#phase-15-glossaire-tm-et-adaptive-mt)
16. [Outils Avancés](#phase-16-outils-avancés)
17. [Sécurité et Recovery Key](#phase-17-sécurité)
18. [Dépannage](#phase-18-dépannage)
19. [Chat Communautaire (Temps Réel)](#phase-19-chat-communautaire) *(NOUVEAU v1.5.0)*
20. [Projets et Patch Hub](#projets-et-patch-hub) *(MIS À JOUR v1.15.0)*
21. [Paramètres d'Inférence Ollama](#paramètres-dinférence-ollama) *(NOUVEAU v1.15.0)*
22. [Envoyer un Feedback](#envoyer-un-feedback) *(NOUVEAU v1.15.0)*

---

## PHASE 1: CONFIGURATION INITIALE

### Premier Lancement

Lancez GameStringer. Au premier démarrage, l'écran de création de profil apparaît.

### Création de Profil

- **Nom** : choisissez un nom (ex. "Mario Gaming")
- **Avatar** : sélectionnez une couleur/dégradé
- **Mot de passe** : minimum 4 caractères
- Cliquez sur **"Créer Profil"** — authentification automatique

### Interface

- **Barre latérale** (gauche) : navigation entre les sections
- **Dashboard** (centre) : aperçu des jeux, statistiques, widget AI Engine
- **Ctrl+K** : recherche rapide globale pour accéder à n'importe quelle page

---

## PHASE 2: CONNEXION DES BOUTIQUES

### Boutiques Supportées

Steam, Epic Games, GOG, Ubisoft Connect, Origin/EA, Battle.net, Itch.io, Rockstar, Amazon Games.

### Configuration Steam (Prioritaire)

1. Obtenez la clé API sur https://steamcommunity.com/dev/apikey
2. Trouvez votre Steam ID64 sur https://steamid.io/
3. Dans GS : **Paramètres** → entrez la clé API et le Steam ID
4. Le profil Steam doit être **Public**

GS détecte aussi les jeux du **Steam Family Sharing**.

---

## PHASE 3: BIBLIOTHÈQUE DE JEUX

- Barre latérale → **"Bibliothèque"** ou Dashboard → **"Mettre à jour la bibliothèque"**
- Le chargement prend 1 à 2 minutes pour des centaines de jeux
- En cliquant sur un jeu : détails, moteur détecté, chemin, bouton **"Traduire le jeu"**

---

## PHASE 4: TRADUIRE UN JEU

Barre latérale → **"Traduire un jeu"** (Auto-Translate). Le cœur de GameStringer.

### Flux de Travail

1. **Sélectionner le jeu** depuis la bibliothèque ou chemin manuel
2. **Scan** : détecte le moteur (Unity, Unreal, Godot, RPG Maker, Ren'Py, etc.) et les fichiers traduisibles
3. **Smart Auto-Select** : recommande la meilleure méthode pour le moteur détecté
4. **Traduction AI** : chaînes traduites avec le moteur AI configuré
5. **Révision** : réviser, modifier, approuver
6. **Appliquer le Patch** : sauvegarde automatique + application

### Smart Auto-Select pour Unity

| Type | Méthode Recommandée | Alternative |
|------|---------------------|-------------|
| Unity Mono (sans BepInEx) | Unity CSV Translator | BepInEx + XUnity |
| Unity Mono (BepInEx présent) | Unity CSV Translator | Traduire les chaînes capturées avec AI |
| Unity IL2CPP | Unity CSV Translator | Aucune (BepInEx incompatible) |

### Moteurs Détectés

Unity (Mono/IL2CPP), Unreal Engine, Godot, RPG Maker, Ren'Py, Source Engine, CryEngine, RE Engine, Frostbite, id Tech, Creation Engine, Construct, AGS, Defold, Love2D.

---

## PHASE 5: PATCHER ENGINE

Barre latérale → **Patcher** → **Patcher Engine**. 5 patchers spécialisés :

- **Unity** : BepInEx + XUnity AutoTranslator pour Mono
- **Unreal Engine** : traduction de fichiers .locres (UE4/UE5)
- **Godot** : extraction/traduction/re-pack de fichiers .pck (Godot 3/4)
- **RPG Maker** : traduction JSON pour MV/MZ (dialogues, objets, compétences)
- **Ren'Py** : traduction de fichiers .rpy (romans visuels)

---

## PHASE 6: UNITY CSV TRANSLATOR

La **meilleure méthode** pour les jeux Unity (Mono et IL2CPP).

### Fonctionnement

1. Scanne les assets Unity (resources.assets, etc.)
2. Extrait les tables CSV de localisation
3. Traduit avec AI (Ollama ou cloud)
4. Injecte les traductions avec **Resize Injection** (zéro troncature)

### Avantages

- Fonctionne avec **tous** les jeux Unity (Mono et IL2CPP)
- Zéro troncature grâce au redimensionnement
- Couverture complète (toutes les chaînes, pas seulement celles à l'écran)
- Aucune dépendance externe
- Sauvegarde automatique (.backup) et restauration

---

## PHASE 7: BEPINEX + XUNITY

Pour les jeux **Unity Mono** — traduction en direct pendant le gameplay.

1. GS détecte le jeu Unity et trouve l'exe
2. Cliquez sur **"Installer BepInEx + XUnity"**
3. Lancez le jeu — XUnity capture les chaînes à l'écran
4. Fermez et revenez dans GS — traduisez les chaînes capturées avec AI

**Limitation** : ne fonctionne pas avec IL2CPP (cause un crash). Utilisez Unity CSV Translator pour IL2CPP.

---

## PHASE 8: AI PIPELINE

Cherchez **"AI Pipeline"** avec Ctrl+K. Système multi-étapes pour haute qualité.

### 6 Étapes

Harvest → Translate → QA Check → Auto-Fix → Review → Score

### 3 Modes

- **Quick** : Translate + QA (rapide)
- **Balanced** : + Auto-Fix (recommandé)
- **Max Quality** : les 6 étapes, seuil 75, maximum 3 tentatives

### Multi-Agent

Assignez différents modèles par étape (ex. qwen pour Translate, gemma pour Review). 4 presets : Default, Speed, Max Quality, Diversified.

### Benchmark

Historique d'exécutions avec score, durée, ms/chaîne. Comparaison de presets.

---

## PHASE 9: TRADUCTEUR AI

Barre latérale → **Traduction** → **Traducteur AI**.

### Fournisseurs

- **Ollama** (local, gratuit), **OpenAI/GPT-4**, **Claude**, **Gemini**, **DeepL**, **Lingva**

### Fonctionnalités

- Traduction unique ou par lots
- Détection automatique de la langue source
- Style : naturel, littéral, gaming
- Préservation des placeholders ({0}, %s, \n)
- Intégration Glossaire + Translation Memory + Adaptive MT

---

## PHASE 10: TRADUCTEUR OCR

Barre latérale → **Traduction** → **Traducteur OCR**.

Traduit le texte à l'écran en temps réel :

- Capture manuelle ou zone sélectionnée
- OCR en direct continu
- Raccourci global : **Ctrl+Shift+T**

### OCR Multi-Engine

4 moteurs : **OneOCR** (Win11), **PaddleOCR** (CJK), **RapidOCR** (ONNX), **Tesseract** (fallback).

- Sondage automatique des moteurs actifs
- Chaîne de fallback automatique
- Mode de comparaison parallèle

---

## PHASE 11: TRADUCTEUR VOCAL

Barre latérale → **Traduction** → **Traducteur Vocal**.

- Reconnaissance vocale in-game
- Audio → texte traduit
- Overlay de sous-titres en temps réel

---

## PHASE 12: TRADUCTION PAR LOTS ET HORS LIGNE

### Par Lots

Barre latérale → **Traduction** → **Batch**. Traduit des dossiers entiers :

- Supporte .txt, .json, .csv, .po, .xml, .rpy, .ini
- Progression en temps réel par fichier
- Option pipeline AI pour qualité maximale

### Hors Ligne (Ollama)

Barre latérale → **Traduction** → **Traducteur Offline**.

- Traduction entièrement locale avec Ollama
- Aucune connexion internet nécessaire
- Confidentialité totale — les données ne quittent pas votre PC

---

## PHASE 13: DANGANRONPA PATCHER

Cherchez **"Danganronpa"** avec Ctrl+K.

### Fonctionnalités

1. **Onglet Appliquer Patch** : sélectionnez le jeu Steam, voir les fichiers WAD, appliquer le patch
2. **Onglet WAD Extractor** : extraire, chercher, filtrer et traduire 35 865 chaînes
3. **Traduction Batch AI** : sélectionner → traduire avec AI → exporter JSON
4. **Export .zip distribuable** : WAD patché + installateur automatique + instructions
5. En jeu : Paramètres → Control Hints → "Keyboard and Mouse"

---

## PHASE 14: PREDICTION TOOL ET QA CHECK

### Prediction Tool

Cherchez avec Ctrl+K. Analyse un jeu avant la traduction :

- Estimation du nombre de chaînes et de mots
- Coût estimé par fournisseur (DeepL, OpenAI, local)
- Temps estimé par méthode
- Chaînes de traduction recommandées

### QA Check

Cherchez avec Ctrl+K. Contrôle qualité post-traduction :

- Vérification des placeholders
- Contrôle des nombres et valeurs
- Vérification de la longueur des chaînes
- Contrôle du format et de la ponctuation
- Score de qualité par chaîne

---

## PHASE 15: GLOSSAIRE, TM ET ADAPTIVE MT

### Glossaire

Cherchez avec Ctrl+K. Terminologie personnalisée par jeu :

- Ajoutez des termes (ex. "quest" → "quête")
- Catégories : gameplay, UI, personnages, lore
- Intégré automatiquement dans la traduction AI

### Smart Glossary

Génère automatiquement un glossaire à partir de l'analyse des fichiers du jeu.

### Translation Memory

Dashboard → widget "Entrées TM". Mémoire de traduction :

- Sauvegarde automatiquement chaque paire traduite
- Réutilise les traductions précédentes
- Backend Rust pour la performance

### Adaptive MT

Apprend de vos corrections :

- Sauvegarde : original → AI → correction humaine
- Trouve des corrections similaires avec similarité trigram/mot
- Injecte des exemples few-shot dans le prompt AI
- S'améliore avec le temps

---

## PHASE 16: OUTILS AVANCÉS

### Context Harvester

Scanne les fichiers du jeu et extrait le contexte pour la traduction AI.

### Éditeur de Traductions

Éditeur avancé pour la révision manuelle des chaînes avec filtres et recherche.

### Overlay de Sous-titres

Overlay in-game pour sous-titres traduits en temps réel.

### ROM Patcher

Appliquez et créez des patchs IPS/BPS pour les traductions rétro (SNES, GBA, etc.).

### Export de Formats

Exportez les traductions en : PO, XLIFF, CSV, JSON, TMX.

### Community Hub

Partagez des traductions, votez, commentez, téléchargez les traductions de la communauté.

---

## PHASE 17: SÉCURITÉ

### Recovery Key

À la création du profil, une **Recovery Key** est générée (12 mots mnémoniques).

- Copiez ou téléchargez en .txt
- **Conservez-la en lieu sûr !**

### Récupération du Mot de Passe

Écran de connexion → **"Mot de passe oublié ?"** → entrez les 12 mots → nouveau mot de passe.

---

## PHASE 18: DÉPANNAGE

### Jeu Non Trouvé

- Vérifiez qu'il est installé et que Steam/Epic est ouvert
- Mettez à jour la bibliothèque et redémarrez GS

### Traduction Non Appliquée

- Redémarrez complètement le jeu
- Vérifiez les permissions d'écriture
- Exécutez GS en tant qu'administrateur

### AI Ne Répond Pas

- Vérifiez la connexion internet (pour les fournisseurs cloud)
- Pour Ollama : vérifiez qu'il est en cours d'exécution (point vert dans la barre latérale)
- Essayez un moteur différent

### Jeu Crashé Après Patch

- Cliquez sur **"Restaurer la Sauvegarde"** dans l'outil utilisé
- Vérifiez l'intégrité sur Steam (clic droit → Propriétés → Fichiers Locaux)

### Unity IL2CPP + BepInEx = Crash

- GS bloque maintenant automatiquement BepInEx pour IL2CPP
- Utilisez Unity CSV Translator à la place

### Ollama Lent ou Ne Répond Pas

- Barre latérale : point vert = en ligne, rouge = hors ligne
- Ollama Manager → vérifier les modèles installés
- Recommandé : modèle 7B pour la vitesse, 13B+ pour la qualité

---

## PHASE 19 : CHAT COMMUNAUTAIRE

*(NOUVEAU v1.5.0)*

Chat en temps réel intégré au Community Hub, propulsé par Supabase Realtime.

### Accès

1. Allez au **Community Hub** depuis la barre latérale
2. Cliquez sur l'onglet **Chat** ou l'icône chat en bas à droite
3. Si vous êtes connecté à votre profil GameStringer, vous êtes **automatiquement connecté**

### Salons par défaut

- **Général** : chat libre de la communauté GameStringer
- **Traductions** : discutez traductions, demandez de l'aide, partagez vos progrès
- **Retours & Bugs** : signalez des bugs et suggérez des améliorations
- **Annonces** : nouvelles et mises à jour officielles

### Fonctionnalités

- **Messages en temps réel** via Supabase Realtime
- **Présence en ligne** : voyez qui est connecté
- **Répondre aux messages** : cliquez pour répondre
- **Modifier/Supprimer** : modifiez ou supprimez vos messages
- **Créer des salons personnalisés** : salons dédiés pour projets ou jeux
- **Auto-login** : connexion automatique via profil GameStringer

## Nouveautés v1.9.0

### Patcheur Bethesda Engine
- **Jeux pris en charge** : Skyrim LE/SE/AE, Fallout 3/NV/4, Oblivion, Starfield
- **Formats d'archive** : BSA v103/v104/v105 et BA2 (GNRL + DX10)
- **Plugins** : analyse ESP/ESM avec extraction des enregistrements traduisibles
- **Chaînes localisées** : STRINGS, DLSTRINGS, ILSTRINGS

### Patcheur CRI Middleware
- **Jeux pris en charge** : Persona 5 Royal, Yakuza, Tales of, Dragon Ball et tous les titres CRI
- **Archives** : CPK avec décompression CRILAYLA
- **Formats de messages** : MSG, BMD, FTD

### Unity Localization Package
- Pipeline pour le package officiel Unity Localization (Unity 2021.3+)
- StringTable + SharedTableData, Addressables, Smart Strings
- Validator dédié pour les placeholders et les formes plurielles

### Export PO universel
- Export gettext PO avec métadonnées complètes depuis chaque patcheur
- Compatible avec Poedit, Weblate, Crowdin

### Accessibilité WCAG 2.1 AA
- aria-label, titres sémantiques, focus-visible
- Lien d'évitement, prefers-reduced-motion, Windows High Contrast

### Design System et OCR
- Variantes de Card via cva, Button xs/icon-sm
- Vrai backend Tauri Tesseract OCR à la place du stub
- Correction : boucle de flash console Windows en mode tray

---

## Patch Hub (Packs de traduction communautaires)

Le Patch Hub est une place de marché de style Steam Workshop permettant de partager et de télécharger des packs de traduction communautaires, adossée au serveur communautaire GameStringer. Ouvrez-le depuis l'entrée **Patch Hub** dans la barre latérale (section orange/ambre).

### Parcourir les packs
La vue principale liste les packs publiés avec recherche et tri (les plus téléchargés, les mieux notés, récemment mis à jour, taux de complétion). Chaque carte indique le jeu, les langues source→cible, le pourcentage de complétion, la note et le nombre de téléchargements. Cliquez sur un pack pour ouvrir sa page de détail avec les statistiques, la description, les fichiers inclus et le journal des modifications.

### Télécharger un pack
Sur la page de détail d'un pack, cliquez sur **Download** (Télécharger). GameStringer récupère tous les fichiers du pack depuis le serveur communautaire et les enregistre localement sous forme d'un ensemble `.gspack` dans votre bibliothèque de packs (`Documents/GameStringer/packs`). De là, vous pouvez gérer le pack et l'importer depuis la page de détail d'un jeu pour appliquer la traduction.

### Publier un pack
Cliquez sur **Publish patch** (Publier le correctif) pour ouvrir le formulaire de publication. Renseignez le nom du pack, le jeu, la langue source et cible, une description et des tags facultatifs, puis joignez votre ou vos fichiers de traduction. Lorsque vous êtes connecté au Community Hub, le pack est téléversé sur le serveur communautaire et entre dans une file de modération avant de devenir visible publiquement. Si vous n'êtes pas connecté, le pack est conservé comme brouillon local — connectez-vous et publiez à nouveau pour le partager en ligne.

> La publication en ligne nécessite un compte Community Hub (distinct de votre profil local). La navigation et le téléchargement fonctionnent sans compte.

---

## Projets et Patch Hub

*(MIS À JOUR v1.15.0)*

La page **Projets** rassemble, en un seul endroit, chaque jeu que vous traduisez ou avez déjà traduit — à partir du Quality Scoring, des dictionnaires, de la Translation Memory et de la bibliothèque de jeux. De là, vous gérez tout le cycle de vie d'une traduction : ouvrir, appliquer, publier.

### Importer `.gspack` → projet

Lorsque vous **importez un ensemble `.gspack`** (téléchargé depuis le Patch Hub ou créé par vous), GameStringer ne se contente pas de l'appliquer : il **enregistre un projet terminé** et **sauvegarde les fichiers traduits** localement. Le jeu apparaît alors dans Projets à 100 %, prêt à être ré-appliqué ou publié plus tard sans refaire aucun travail.

### Appliquer au jeu

Pour les projets **terminés**, le bouton **"Appliquer au jeu"** (icône dossier) copie les fichiers traduits directement dans l'installation :

1. Choisissez le **dossier d'installation** du jeu
2. Avant d'écraser un fichier existant, une **sauvegarde `.bak`** est créée à côté de l'original
3. **Sécurité** : si la sauvegarde d'un fichier échoue, ce fichier est **ignoré** (jamais écrasé sans copie de sécurité)
4. À la fin, vous voyez combien de fichiers ont été écrits et combien ont été ignorés

Pour restaurer un original, il suffit de renommer le fichier `.bak` en retirant l'extension.

### Publier (pré-rempli)

Le bouton **"Publier sur le Patch Hub"** (icône de partage) envoie la traduction à la communauté. Il publie **le vrai fichier traduit** (pas seulement un manifeste de métadonnées), avec le nom, le jeu, les langues et le pourcentage de complétion **déjà pré-remplis**. Le pack entre dans une **file de modération** avant de devenir visible publiquement.

> La publication nécessite d'être connecté au **Community Hub** (un compte distinct de votre profil local).

### Explorer / Mes patchs

La page **Patch Hub** comporte deux onglets :

- **Explorer** — tous les packs publiés par la communauté, avec recherche et tri (les plus téléchargés, les mieux notés, récemment mis à jour, complétion)
- **Mes patchs** — uniquement les packs que vous avez publiés avec le profil actuel

### Performance

Les listes du Patch Hub utilisent un **cache local** (environ 60 secondes) : passer d'un onglet à l'autre ne recharge plus depuis le serveur à chaque fois. Le cache se rafraîchit automatiquement après une publication ou un téléchargement. Publier et signaler ont aussi un petit **intervalle minimum** entre les envois, afin de ne pas surcharger le serveur partagé.

---

## Paramètres d'Inférence Ollama

*(NOUVEAU v1.15.0)*

Lorsque vous traduisez avec un **modèle Ollama local**, vous pouvez contrôler *comment* le modèle génère le texte. Ouvrez la page depuis **Ollama Manager → "Avancé"** (route `/ollama-manager/advanced`).

> Si vous ne changez rien, les valeurs par défaut recommandées restent actives : la traduction se comporte exactement comme avant. Les paramètres avancés ne sont envoyés à Ollama **que** lorsque vous les définissez.

### Presets

Trois profils prêts à l'emploi, réglés pour la traduction de jeux vidéo :

| Preset | Temperature | `num_ctx` | Quand l'utiliser |
|--------|-------------|-----------|------------------|
| 🎯 **Fidèle** | 0.1 | 8192 | Adhérence maximale au texte, peu d'invention. **Recommandé** pour la traduction. |
| ⚖️ **Équilibré** | 0.3 | 4096 | Un compromis entre fidélité et naturel. |
| ✨ **Créatif** | 0.7 | 4096 | Plus de liberté stylistique : pour les dialogues et le ton expressif. |

### Mode expert

Développez **"Mode expert"** pour régler chaque paramètre avec des curseurs :

| Paramètre | Effet |
|-----------|-------|
| `temperature` | Aléatoire de la génération. Bas = plus déterministe et fidèle ; élevé = plus varié et créatif. |
| `top_p` | *Nucleus sampling* : ne considère que les tokens les plus probables jusqu'à cette masse de probabilité. Plus bas = plus focalisé. |
| `top_k` | Limite le choix aux k tokens les plus probables à chaque étape. Plus bas = moins de digressions. |
| `repeat_penalty` | Décourage la répétition des mots. Au-dessus de 1.0 réduit les boucles ; trop élevé peut déformer le texte. |
| `num_ctx` | Fenêtre de contexte (tokens gardés en mémoire). **Plus large = pas de troncature sur les longs textes**, mais plus de RAM/VRAM. |
| `seed` *(optionnel)* | Fixe la graine aléatoire pour des résultats **reproductibles** (utile pour les benchmarks). Désactivée = chaque exécution peut varier. |

Modifier une valeur bascule automatiquement le preset sur **"custom"**.

### Quand et pourquoi les utiliser

- **Fidélité vs créativité** : pour la traduction, préférez une **température basse** (preset Fidèle) — moins d'invention, plus de fidélité. Ne l'augmentez que pour les dialogues où vous voulez un ton plus expressif.
- **Fichiers longs** : si vous traduisez de longs textes et remarquez une troncature ou une perte de contexte, augmentez **`num_ctx`** (au prix de plus de RAM/VRAM).
- **Reproductibilité** : activez la **`seed`** quand vous voulez comparer deux modèles ou relancer la même traduction et obtenir exactement le même résultat.

### Comment les utiliser

1. Ouvrez **Ollama Manager** depuis la barre latérale et cliquez sur **"Avancé"**
2. Choisissez un preset (commencez par **Fidèle** pour la traduction) ou ouvrez le **Mode expert**
3. Ajustez les paramètres (ex. augmentez `num_ctx` pour les fichiers longs, activez `seed` pour des résultats répétables)
4. Cliquez sur **"Enregistrer"** — les paramètres sont mémorisés pour les traductions suivantes

> **Portée** : ces paramètres s'appliquent aux traductions effectuées avec des **modèles Ollama locaux** (y compris la passe de *reflection*). Ils n'affectent pas les fournisseurs web (Gemini, Groq, etc.).

---

## Envoyer un Feedback

*(NOUVEAU v1.15.0)*

Vous pouvez signaler un bug, suggérer une idée ou nous dire ce que vous pensez directement depuis l'application, sans quitter GameStringer.

### Comment l'envoyer

1. Allez dans **Paramètres → Communauté** (onglet Community Hub)
2. Dans l'encadré **"Envoyer un feedback"**, cliquez sur **"Envoyer un feedback"**
3. Choisissez une **catégorie** — 🐞 Bug, 💡 Idée ou 💬 Autre
4. Rédigez votre message et cliquez sur **"Envoyer"**

### Contexte joint automatiquement

Pour nous aider à comprendre le problème, un **contexte technique minimal** est joint au message :

- **Version** de l'application
- **Plateforme** (système d'exploitation + Tauri/Web)
- **Écran** sur lequel vous étiez (la route actuelle)
- **Jeu** (uniquement si vous travailliez sur un titre précis)

> **Confidentialité** : aucune donnée personnelle. Seulement la version, la plateforme et l'écran actuel.

### Si le backend est indisponible

Le widget est **fail-open** : si le serveur n'est pas configuré ou que vous êtes hors ligne, le message n'est pas perdu. Vous pouvez toujours **copier le rapport** dans le presse-papiers ou l'envoyer par **e-mail** en un clic — le contexte technique est déjà inclus dans le texte.

---

## Nouveautés v1.8.1

### Overlay de Traduction en Direct
- Allez sur la page **/live-translate** ou appuyez sur **Ctrl+Alt+O**
- Sélectionnez la langue source/cible et le fournisseur AI
- Cliquez sur **Démarrer** — l'overlay apparaît par-dessus le jeu
- Le texte est capturé par OCR toutes les 2 secondes
- Les traductions apparaissent sous forme de boîtes d'overlay transparentes
- La détection des différences ignore le texte inchangé (économise les appels API)

### Marketplace du Hub
- Allez au **Community Hub** pour parcourir les packs de traduction
- **Installation en 1 clic** : télécharger → valider → importer
- Notez et évaluez les packs de la communauté
- Publiez vos propres traductions sous forme de fichiers **.gspack**
- Profils utilisateur avec réputation et badges

### Réseau de Mémoire de Traduction
- Activez dans **Paramètres → Réseau TM**
- Opt-in : vos traductions de haute qualité contribuent au pool global
- Confidentialité d'abord : texte source haché, aucune donnée utilisateur partagée
- L'utilisateur suivant traduisant le même jeu reçoit des suggestions pré-remplies
- Intégré automatiquement dans le pipeline de traduction

### Pipeline de Doublage AI
- Allez sur la page **/dubbing**
- Sélectionnez le dossier du jeu et configurez les langues/voix
- Pipeline en 7 étapes : scan → transcrire → traduire → synthétiser → patcher → synchronisation labiale → sous-titres
- L'ajustement de durée maintient l'audio traduit à la même longueur que l'original
- Profils vocaux de personnage avec 16 archétypes

### Système de Plugins
- La communauté peut créer de nouveaux patchers de moteurs de jeu en JavaScript
- Aucune compilation Rust nécessaire
- Le générateur de modèles crée un squelette complet de plugin
- Les plugins sont distribués sous forme de paquets **.gsplugin**

---

## Nouveautés v1.9.0

### Améliorations UI du Community Hub
- **Community Hub redessiné**: design plus propre et cohérent sans dégradés excessifs et blobs décoratifs
- **KPI Cards compactes**: cartes statistiques plus petites et discrètes avec des couleurs minimales
- **Category Cards minimalistes**: design propre sans dégradés lourds et ombres
- **Trending Cards unifiées**: style cohérent sur tous les types de cartes

### Sidebar Amis Compacte
- **Largeur réduite**: de 72 à 56 (w-56) pour plus d'espace d'écran
- **Friend Cards compactes**: avatars plus petits (7x7), espacement plus serré
- **Sections plus petites**: en-têtes Online/Offline avec texte réduit
- **Scrollbar ultra-fine**: 4px, invisible par défaut, apparaît au survol

### Améliorations du Chat Persistant
- **Bouton de chat discret**: élégant, petit en bas à droite
- **Visible sur toutes les pages**: chat accessible dans toute l'application
- **Design plus propre**: animations et décorations excessives supprimées

### Fonctionnalités Sociales Supabase
- **Schéma compatible**: schéma social Supabase aligné avec les attentes du frontend (tools/supabase_social_compatible.sql)
- **RLS désactivé temporairement**: pour débogage plus facile des fonctionnalités sociales
- **Fix chat participants**: noms de colonnes corrigés pour validation UUID

### Corrections de Bugs
- **Fix Loop Chat**: ajouté état chatAttempted pour éviter boucle infinie dans startDirectChat
- **Suppression Mock Data**: supprimé données mock UUID invalides (user-123, etc.) causant erreurs 400
- **Fix Ollama IPC**: remplacé tous les appels check_ollama_status IPC par HTTP direct vers localhost:11434
- **Lien Stores**: ajouté lien Stores dans section Ressources de la sidebar
- **Epic Connect**: changé d'OAuth défaillant à modal d'identifiants
- **Test de Connexion**: testConnection utilise désormais de vraies commandes Tauri au lieu d'API simulée
- **Fix Disconnect**: ajouté suppression identifiants Epic/Steam dans backend Tauri
- **Fix Presence**: ajouté garde de session dans updatePresence pour éviter 400 Bad Request

---

## Nouveautés v1.9.0

### 🟢 Présence En Ligne Unifiée

Système de présence unifié combinant Supabase Realtime et base de données :

- **Mises à jour instantanées** : Les utilisateurs en ligne apparaissent en temps réel (Supabase Realtime Presence)
- **Heartbeat global** : Le statut de présence est mis à jour automatiquement toutes les 30 secondes
- **Auto-absent** : Si la fenêtre n'est pas focalisée pendant 2+ minutes, le statut devient "Absent"
- **Auto-en ligne** : Quand la fenêtre retrouve le focus, le statut revient à "En ligne"
- **Fallback DB** : Si Realtime n'est pas disponible, le système utilise la base de données comme fallback
- **Widget mis à jour** : Le widget "Utilisateurs en ligne" affiche les noms, avatars et indicateur Realtime

### 🔔 Notifications Barre Système

Notifications OS natives pour les événements importants :

- **💬 Messages Chat** : Notification OS lors de la réception d'un message dans le chat communautaire
- **✅ Traductions Terminées** : Notification quand une traduction se termine avec succès
- **❌ Erreurs Traduction/Système** : Notification pour les erreurs critiques (toujours visibles)
- **🔄 Mises à Jour App** : Notification quand une mise à jour de GameStringer est disponible
- **🎮 Mises à Jour Jeux** : Notification quand un jeu mis à jour peut avoir invalidé le patch
- **🟢 Amis en Ligne** : Notification quand un ami se connecte
- **📰 Actualités** : Notifications pour les nouvelles et mises à jour communautaires

**Configuration** : Paramètres → Notifications → Notifications Barre Système
- Toggle pour chaque type de notification
- **Heures Calmes** : Supprimer les notifications pendant certaines heures (ex. 23:00-07:00)
- **Bouton Test** : Envoyer une notification test pour vérifier le fonctionnement
- **Tooltip Barre** : L'icône de la barre affiche le nombre de notifications non lues

### 🛡️ Error Boundaries + Récupération Crash

Protection contre les crashes de composants :

- **WidgetErrorBoundary** : Si un widget crash, affiche un message compact et tente automatiquement la récupération après 5 secondes (max 3 tentatives)
- **AppErrorBoundary** : Si l'app crash entièrement, affiche un écran d'erreur avec option "Recharger l'App"
- **Auto-récupération** : Les widgets se restaurent automatiquement sans intervention utilisateur

### 🌐 Résilience Réseau / Mode Hors Ligne

Gestion élégante des déconnexions :

- **Moniteur Réseau** : Détecte le statut en ligne/hors ligne + health check Supabase toutes les 30 secondes
- **Barre Statut Connexion** : Barre rouge en haut si hors ligne, ambre si Supabase down, vert quand la connexion est restaurée
- **Retry avec Backoff** : Les opérations réseau échouées sont automatiquement retentées avec backoff exponentiel (1s, 2s, 4s)
- **File Hors Ligne** : Si vous êtes hors ligne, les opérations (messages chat, mises à jour présence) sont mises en file et exécutées au retour de la connexion
- **"Mode hors ligne"** : Les modifications seront automatiquement synchronisées au retour de la connexion

### 🎙️ Profils Voix Personnage (Voice Cloning)

Système pour préserver la "voix" des personnages lors de la traduction :

- **Extraction Automatique** : Analyse les dialogues du jeu pour identifier les personnages et leur style linguistique
- **16 Tons Disponibles** : Formel, Décontracté, Agressif, Doux, Mystérieux, Comique, Dramatique, Stoïque, Sarcastique, Sage, Enfantin, Noble, Pirate, Militaire, Académique, Argot de rue
- **5 Niveaux de Formalité** : Très formel → Très informel
- **5 Groupes d'Âge** : Enfant, Adolescent, Jeune adulte, Adulte, Personne âgée
- **Patterns Vocaux** : Reconnaissance automatique des patterns (mots archaïques, exclamations, questions fréquentes)
- **Catchphrases** : Identification automatique des expressions récurrentes du personnage
- **Injection dans le Prompt** : Les profils voix sont automatiquement injectés dans le prompt de traduction
- **Profil par Défaut** : Définir un profil comme fallback pour les personnages non identifiés

**Comment l'utiliser** :
1. Sur la page Auto-Translate, après avoir chargé les fichiers, le panneau "Profils Voix Personnage" apparaît
2. Cliquez sur **"Extraire Automatiquement"** pour analyser les dialogues
3. Ou créez des profils manuellement avec **"Nouveau Profil"**
4. Les profils sont appliqués automatiquement lors de la traduction

### 🧠 Infrastructure Fine-Tuning

Système pour générer des datasets d'entraînement et gérer des modèles par jeu :

- **Dataset depuis Corrections** : Générer des datasets JSONL depuis les corrections humaines (Adaptive MT)
- **4 Formats d'Export** : OpenAI JSONL, Ollama JSONL, Alpaca JSON, ChatML TXT
- **Approuvées Uniquement** : Option pour utiliser uniquement les corrections approuvées dans le dataset
- **Gestion des Modèles** : Enregistrer et gérer les modèles fine-tuned par jeu
- **Intégration Ollama** : Vérifier la disponibilité d'Ollama pour l'entraînement local
- **Statistiques Dataset** : Nombre d'exemples, longueur moyenne, score de qualité

**Comment l'utiliser** :
1. Allez dans **Paramètres → AI → Infrastructure Fine-Tuning**
2. Sélectionnez la paire de langues et cliquez sur **"Générer"**
3. Cliquez sur **"Exporter"** pour télécharger dans le format souhaité
4. Utilisez le dataset pour le fine-tuning avec Ollama ou des fournisseurs cloud

### ⚡ Code Splitting / Lazy Loading

Optimisation du temps de démarrage :

- 8 composants lourds (Chat, Tâches en arrière-plan, Palette de commandes, etc.) sont chargés uniquement quand nécessaire
- L'app démarre plus vite et utilise moins de mémoire

---

GameStringer v1.15.0 - Guide mise à jour le 24/07/2026