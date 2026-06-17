# 🎯 Dartos

**Ligue de fléchettes 301 Sudden Death** avec système RPG d'XP, médailles, saisons configurables et guildes.

## 📋 Description

Dartos est une application web complète de gestion de compétitions de fléchettes. Elle intègre :

- **Système de scoring** : 301 Sudden Death
- **Système RPG** : Gain d'XP, médailles et badges
- **Gestion de saisons** : Créer et gérer des saisons configurables
- **Guildes** : Organisation des joueurs en groupes
- **Classements dynamiques** : Leaderboards en temps réel
- **Historique des matches** : Traçabilité complète
- **Système d'admin** : Gestion sécurisée des données

## 🚀 Stack Technique

- **Frontend** : React 19 + TypeScript
- **Build** : Vite 6
- **Styling** : Tailwind CSS
- **Base de données** : Firebase Firestore
- **Graphiques** : Recharts
- **Icônes** : Lucide React
- **Animations** : Motion (Framer Motion)
- **API AI** : Google Generative AI

## 🛠️ Installation

### Prérequis

- Node.js 16+
- npm ou yarn
- Compte Firebase avec Firestore activé

### Étapes

1. **Cloner le repository et installer les dépendances :**
   ```bash
   npm install
   ```

2. **Configurer Firebase :**
   - Créer un projet Firebase
   - Ajouter les fichiers de configuration Firebase dans le répertoire racine
   - Configurer les règles Firestore selon `firestore.rules`

3. **Variables d'environnement :**
   - Créer un fichier `.env.local` à la racine
   - Ajouter votre clé API Gemini (optionnel, pour les fonctionnalités AI)
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Démarrer l'application :**
   ```bash
   npm run dev
   ```
   L'app sera accessible sur `http://localhost:3000`

## 📁 Structure du Projet

```
src/
├── components/          # Composants React
│   ├── LeaderboardTab.tsx      # Affichage du classement
│   ├── MatchEntryTab.tsx       # Entrée de nouveaux matches
│   ├── MatchHistoryTab.tsx     # Historique des matches
│   ├── PlayersTab.tsx          # Gestion des joueurs
│   ├── GuildsTab.tsx           # Gestion des guildes
│   ├── SeasonsTab.tsx          # Gestion des saisons
│   ├── PlayerDetailModal.tsx   # Détails joueur
│   ├── SlotMachineLottery.tsx  # Animation loterie
│   └── SplashModal.tsx         # Modals d'information
├── App.tsx              # Composant principal
├── main.tsx             # Point d'entrée
├── dbStore.ts           # Logique Firebase/Firestore
├── scoring.ts           # Système de scoring et médailles
├── types.ts             # Types TypeScript
└── index.css            # Styles globaux
```

## 📋 Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarre le serveur de développement (port 3000) |
| `npm run build` | Crée une build optimisée pour la production |
| `npm run preview` | Prévisualise la build |
| `npm run lint` | Vérifie les erreurs TypeScript |
| `npm run clean` | Nettoie les fichiers compilés |

## 🎮 Fonctionnalités principales

### 📊 Leaderboard
- Classement des joueurs par saison
- Affichage des XP, médailles et taux de victoire
- Filtrage et tri dynamiques

### ⚔️ Entrée de Matches
- Formulaire intuitive pour enregistrer les résultats
- Support de matches simples et complexes
- Mise à jour automatique du classement

### 📈 Historique
- Visualisation de tous les matches joués
- Statistiques détaillées par joueur
- Graphiques de progression

### 👥 Gestion des Joueurs
- Création et modification de profils
- Attribution de médailles et badges
- Historique personnel

### 🏰 Système de Guildes
- Organisation des joueurs
- Statistiques collectives
- Classement des guildes

### 🎪 Saisons
- Création de périodes de compétition
- Reset d'XP entre saisons
- Archivage et historique

## 🔐 Authentification Admin

L'application inclut un système d'authentification admin pour protéger les opérations sensibles. Les admins peuvent :
- Modifier les données des joueurs
- Gérer les saisons et guildes
- Supprimer ou restaurer des données
- Accéder aux statistiques avancées

## 🌐 Déploiement

### Production
```bash
npm run build
```

La build est générée dans le dossier `dist/` et peut être déployée sur :
- Firebase Hosting
- Vercel
- Netlify
- Tout serveur web standard

### Avec Firebase Hosting
```bash
firebase deploy
```

## 📝 Notes de développement

- Les données sont stockées dans Firestore avec les règles définies dans `firestore.rules`
- Les configurations spécifiques sont dans `firebase-applet-config.json`
- Les index Firestore personnalisés sont dans `firestore.indexes.json`
- La Web App Progressive (PWA) est configurée via `public/manifest.json` et `public/sw.js`

## 📧 Support

Pour des questions ou problèmes, veuillez consulter la documentation ou ouvrir une issue.
