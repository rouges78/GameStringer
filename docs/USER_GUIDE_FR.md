# GameStringer - Guide Complète

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

---

GameStringer v1.5.0 - Guide mise à jour le 24/03/2026