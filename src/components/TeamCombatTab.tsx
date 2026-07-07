import React, { useState, useEffect } from "react";
import { User, Trophy, Swords, Sparkles, Shuffle, Shield, Zap, RefreshCw, Star, AlertCircle, Save, Check, UserPlus, Flame, RotateCcw, AlertTriangle, ShieldCheck, ZapOff, ArrowLeftRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Player, Season, Match, FinishType, MatchParticipant } from "../types";
import { dbStore } from "../dbStore";
import { calculateMatchResults, calculatePlayerCareerXPBeforeMatch, calculatePlayerSeasonXPBeforeMatch, countConsecutiveWinsBefore } from "../scoring";

interface TeamCombatTabProps {
  players: Player[];
  seasons: Season[];
  matches: Match[];
  onMatchRecorded: (newMatch: Match) => void;
  unlockedGuildIds?: number[];
  setUnlockedGuildIds?: React.Dispatch<React.SetStateAction<number[]>>;
  isAdmin?: boolean;
}

interface Quest {
  id: string;
  title: string;
  description: string;
  badge: string;
  conditionText: string;
}

interface PowerUp {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

interface TeamState {
  name: string;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  players: Player[];
  score: number;
  shieldActive: boolean;
  powerUps: PowerUp[];
}

const QUESTS_POOL: Quest[] = [
  { id: "double", title: "Double Ring 🎯", description: "Frapper au moins un secteur Double (x2)", badge: "🎯", conditionText: "Cochez 'Double' lors du lancer" },
  { id: "triple", title: "Triple Ring 🔱", description: "Frapper au moins un secteur Triple (x3)", badge: "🔱", conditionText: "Cochez 'Triple' lors du lancer" },
  { id: "bullseye", title: "Cœur de Cible 🔥", description: "Atteindre le Bullseye central (25 ou 50)", badge: "🔥", conditionText: "Cochez 'Bullseye' lors du lancer" },
  { id: "triple_identical", title: "Le Triplé Identique 👑", description: "Placer vos 3 fléchettes dans le même numéro (ex: trois 12, simples ou doubles)", badge: "👑", conditionText: "3 fléchettes identiques (clic direct)" },
  { id: "sequence_doubled", title: "L'Enchaînement Géométrique 📈", description: "Réaliser une suite doublée de points (ex: faire un 2, puis un 4, puis un 8 ou 1, 2, 4)", badge: "📈", conditionText: "Suite doublée 2 ➔ 4 ➔ 8 ou autre (clic direct)" },
  { id: "adjacent_sectors", title: "Le Voisinage Direct 🏡", description: "Toucher 3 secteurs côte à côte (adjacents) sur le cadran (ex: 8, 16 et 7)", badge: "🏡", conditionText: "3 secteurs adjacents (clic direct)" },
  { id: "symmetrical_triangle", title: "Le Triangle de Force 🔺", description: "Former un triangle parfait sur la cible en touchant le 20, le 11 et le 6", badge: "🔺", conditionText: "Toucher le 20, 11 et 6 (clic direct)" },
  { id: "alternating_colors", title: "Couleurs Alternées 🎨", description: "Alterner les couleurs de secteurs (noir, puis rouge/vert, puis noir) avec vos lancers", badge: "🎨", conditionText: "Secteurs Noir ➔ Couleur ➔ Noir (clic direct)" },
  { id: "red_green_only", title: "Le Couloir Rouge/Vert 🍏", description: "Toutes vos fléchettes de ce tour atterrissent dans des zones vertes ou rouges", badge: "🍏", conditionText: "3 fléchettes dans le rouge/vert (clic direct)" },
  { id: "symmetrical_diagonale", title: "La Diagonale du Fou 🏁", description: "Tracer une ligne horizontale/diagonale en touchant le 11, le Bullseye et le 6", badge: "🏁", conditionText: "11 + Bullseye + 6 (clic direct)" },
  { id: "single_club", title: "Club des Célibataires 🧍", description: "Placer vos 3 fléchettes dans 3 secteurs simples différents (pas de double/triple)", badge: "🧍", conditionText: "3 simples différents (clic direct)" }
];

const POWERUPS_POOL: PowerUp[] = [
  { id: "replay_dart", name: "Rejouer une Fléchette", description: "La fléchette a glissé ou loupé ? Retirez-la physiquement et relancez-la sans remords !", icon: "🔄", color: "from-teal-500 to-emerald-500" },
  { id: "eyes_closed", name: "Lancer Aveugle", description: "Malédiction ! Le prochain tireur adverse doit lancer ses 3 fléchettes en fermant complètement les yeux !", icon: "🙈", color: "from-purple-600 to-pink-600" },
  { id: "other_hand", name: "Mauvaise Main", description: "Malédiction ! Le prochain tireur adverse doit effectuer tous les lancers de son tour avec sa main non-dominante !", icon: "🖐️", color: "from-amber-600 to-red-600" },
  { id: "step_back", name: "Recul Impérial", description: "Contrainte physique ! Forcez le prochain tireur adverse à se placer un mètre derrière la ligne de tir réglementaire !", icon: "👣", color: "from-orange-500 to-yellow-600" },
  { id: "distract", name: "Vacarme de l'Arène", description: "Distraction légale ! Vous avez le droit d'agiter les bras, de crier ou de danser devant le tireur adverse pour le déconcentrer !", icon: "🗣️", color: "from-red-500 to-rose-500" },
  { id: "shield", name: "Bouclier de Fer", description: "Dresse instantanément un Bouclier de Fer protégeant votre équipe de toute malédiction active ou future pendant un tour !", icon: "🛡️", color: "from-blue-500 to-cyan-500" },
  { id: "extra", name: "Encore un Tour !", description: "Votre équipe rejoue immédiatement un tour complet de 3 lancers consécutifs sur la machine !", icon: "⚡", color: "from-amber-500 to-yellow-500" },
  { id: "freeze", name: "Gel du Guerrier", description: "Sacre de glace ! Bloquez le prochain tireur de l'équipe adverse, le forçant à passer complètement son tour physique !", icon: "❄️", color: "from-indigo-500 to-blue-500" }
];

interface ActiveMission {
  id: string;
  type: string;
  title: string;
  conditionText: string;
  level: number;
  powerName: string;
  powerIcon: string;
  powerDesc: string;
  check: (score: number, d: boolean, t: boolean, b: boolean) => boolean;
  applyPower: (teamColor: "crimson" | "cobalt", setTeams: any, addLog: (text: string) => void) => void;
}

interface MissionTemplate {
  type: string;
  levelCondition: (level: number) => {
    conditionText: string;
    check: (score: number, d: boolean, t: boolean, b: boolean) => boolean;
  };
}

const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    type: "enchainement_points",
    levelCondition: (level) => {
      if (level <= 1) {
        return {
          conditionText: "Enchaînement simple : toucher le 1, puis le 2 lors du tour (ordre libre)",
          check: () => false
        };
      } else if (level === 2) {
        return {
          conditionText: "Enchaînement doublé : faire un 2, puis un 4, puis un 8 lors du tour (clic direct)",
          check: () => false
        };
      } else if (level === 3) {
        return {
          conditionText: "Suite géométrique : faire un 3, puis un 6, puis un 12 lors du tour (clic direct)",
          check: () => false
        };
      } else {
        return {
          conditionText: "Suite royale : faire un 5, puis un 10, puis un 20 lors du tour (clic direct)",
          check: () => false
        };
      }
    }
  },
  {
    type: "meme_numero",
    levelCondition: (level) => {
      if (level <= 1) {
        return {
          conditionText: "Double Répétition : placer au moins 2 fléchettes dans le même numéro",
          check: () => false
        };
      } else if (level === 2) {
        return {
          conditionText: "Le Triplé Identique : faire 3 fois le même numéro (ex: trois simples 10)",
          check: () => false
        };
      } else if (level === 3) {
        return {
          conditionText: "Placer 2 fléchettes dans le même secteur Double ou Triple (ex: deux fois double 20)",
          check: () => false
        };
      } else {
        return {
          conditionText: "Le Triplé Parfait : loger 3 fléchettes dans le même secteur Triple (ex: trois fois triple 20)",
          check: () => false
        };
      }
    }
  },
  {
    type: "secteurs_physiques",
    levelCondition: (level) => {
      if (level <= 1) {
        return {
          conditionText: "Secteurs opposés : toucher un chiffre en haut (ex: 20) et un tout en bas (ex: 3)",
          check: () => false
        };
      } else if (level === 2) {
        return {
          conditionText: "La Croix de l'Arène : Toucher un chiffre en haut (20), un en bas (3), et un sur le côté (11 ou 6)",
          check: () => false
        };
      } else if (level === 3) {
        return {
          conditionText: "Le Triangle de Force : Toucher le 20, le 11 et le 6 dans le même tour",
          check: () => false
        };
      } else {
        return {
          conditionText: "L'Alignement Céleste : Toucher un chiffre à gauche (11), le Bullseye au centre, et un chiffre à droite (6)",
          check: () => false
        };
      }
    }
  },
  {
    type: "multiplicateurs_et_bull",
    levelCondition: (level) => {
      if (level === 1) {
        return {
          conditionText: "Atteindre au moins un secteur Double (x2)",
          check: (score, d) => d
        };
      } else if (level === 2) {
        return {
          conditionText: "Atteindre au moins un secteur Triple (x3)",
          check: (score, d, t) => t
        };
      } else if (level === 3) {
        return {
          conditionText: "Frapper le Bullseye central (🎯)",
          check: (score, d, t, b) => b
        };
      } else {
        return {
          conditionText: "Frapper à la fois un Double (x2) et un Triple (x3) lors du même tour !",
          check: (score, d, t) => d && t
        };
      }
    }
  },
  {
    type: "precision_cercles",
    levelCondition: (level) => {
      if (level <= 1) {
        return {
          conditionText: "Club des Célibataires : Placer vos 3 fléchettes dans 3 simples différents",
          check: () => false
        };
      } else if (level === 2) {
        return {
          conditionText: "Double Frappe : Toucher deux secteurs Double (x2) différents lors du tour",
          check: () => false
        };
      } else if (level === 3) {
        return {
          conditionText: "Triple Frappe : Toucher deux secteurs Triple (x3) différents lors du tour",
          check: () => false
        };
      } else {
        return {
          conditionText: "Le Maître Archer : Toucher un Triple (x3) ET le Bullseye (🎯) dans le même tour !",
          check: () => false
        };
      }
    }
  },
  {
    type: "scores_visuels",
    levelCondition: (level) => {
      if (level === 1) {
        return {
          conditionText: "Score rond visuel : faire un score de tour finissant par 0 (ex: 10, 20, 30)",
          check: (score) => score > 0 && score % 10 === 0
        };
      } else if (level === 2) {
        return {
          conditionText: "Le Score Miroir : faire un score palindrome (ex: 11, 22, 33, 44)",
          check: (score) => score >= 11 && score <= 99 && score % 11 === 0
        };
      } else if (level === 3) {
        return {
          conditionText: "Le Score Maudit : faire un score de exactement 13 ou 66 points",
          check: (score) => score === 13 || score === 66
        };
      } else {
        return {
          conditionText: "Le Sniper de Comptoir : faire un score total de exactement 26 points (20 + 5 + 1)",
          check: (score) => score === 26
        };
      }
    }
  }
];

const POWER_REWARDS = [
  { name: "Bouclier de Fer", icon: "🛡️", desc: "Active le Bouclier de protection de votre équipe.", id: "shield" },
  { name: "Lancer Aveugle", icon: "🙈", desc: "Offre un sortilège 'Lancer Aveugle' (yeux fermés) à votre équipe.", id: "eyes_closed" },
  { name: "Rejouer Fléchette", icon: "🔄", desc: "Offre un sortilège 'Rejouer une Fléchette' à votre équipe.", id: "replay_dart" },
  { name: "Mauvaise Main", icon: "🖐️", desc: "Offre un sortilège 'Mauvaise Main' à votre équipe.", id: "other_hand" },
  { name: "Recul Impérial", icon: "👣", desc: "Offre un sortilège 'Recul Impérial' à votre équipe.", id: "step_back" },
  { name: "Vacarme de l'Arène", icon: "🗣️", desc: "Offre un sortilège 'Vacarme de l'Arène' à votre équipe.", id: "distract" },
  { name: "Gel du Guerrier", icon: "❄️", desc: "Offre un sortilège 'Gel du Guerrier' à votre équipe.", id: "freeze" },
  { name: "Encore un Tour !", icon: "⚡", desc: "Offre un sortilège 'Encore un Tour !' à votre équipe.", id: "extra" }
];

const generateDynamicPlayerMission = (
  playerId: number,
  level: number,
  teamActiveTypes: string[]
): ActiveMission => {
  let templates = MISSION_TEMPLATES.filter(t => !teamActiveTypes.includes(t.type));
  if (templates.length === 0) {
    templates = MISSION_TEMPLATES;
  }
  const chosenTemplate = templates[Math.floor(Math.random() * templates.length)];
  const { conditionText, check } = chosenTemplate.levelCondition(level);

  let possibleRewardIds: string[] = [];
  if (level === 1) {
    possibleRewardIds = ["shield", "replay_dart", "distract"];
  } else if (level === 2) {
    possibleRewardIds = ["eyes_closed", "other_hand", "step_back"];
  } else if (level === 3) {
    possibleRewardIds = ["freeze", "shield", "replay_dart"];
  } else {
    possibleRewardIds = ["extra", "freeze"];
  }

  const chosenRewardId = possibleRewardIds[Math.floor(Math.random() * possibleRewardIds.length)];
  const rewardInfo = POWER_REWARDS.find(r => r.id === chosenRewardId) || POWER_REWARDS[0];

  const guilds = dbStore.getGuilds();
  const playerGuild = guilds.find(g => (g.memberIds || []).includes(playerId));
  const guildPrefix = playerGuild ? `${playerGuild.badgeIcon} [${playerGuild.name}] ` : "🏹 [Warrior] ";

  return {
    id: `${chosenTemplate.type}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    type: chosenTemplate.type,
    title: `${guildPrefix}Mission Niv. ${level}`,
    conditionText,
    level,
    powerName: rewardInfo.name,
    powerIcon: rewardInfo.icon,
    powerDesc: rewardInfo.desc,
    check,
    applyPower: (teamColor: "crimson" | "cobalt", setTeams: any, addLog: (text: string) => void) => {
      setTeams((prev: any) => {
        const nextTeam = { ...prev[teamColor] };
        if (rewardInfo.id === "shield") {
          nextTeam.shieldActive = true;
        } else {
          const card = POWERUPS_POOL.find(p => p.id === rewardInfo.id);
          if (card) {
            nextTeam.powerUps = [...nextTeam.powerUps, card];
          }
        }
        return { ...prev, [teamColor]: nextTeam };
      });
      addLog(`✨ Effet Actif : [${rewardInfo.name} ${rewardInfo.icon}] est ajouté aux forces de l'équipe ${teamColor === "crimson" ? "Crimson" : "Cobalt"} !`);
    }
  };
};

export default function TeamCombatTab({
  players = [],
  seasons = [],
  matches = [],
  onMatchRecorded,
  unlockedGuildIds = [],
  setUnlockedGuildIds,
  isAdmin = false
}: TeamCombatTabProps) {
  // Game Setup State
  const [step, setStep] = useState<"setup" | "distribution" | "active" | "finished">("setup");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [startingScore, setStartingScore] = useState<number>(301);
  const [bountyXP, setBountyXP] = useState<number>(200);

  // Distribution phase states
  const [shuffling, setShuffling] = useState(false);
  const [distributedTeams, setDistributedTeams] = useState<{
    crimson: Player[];
    cobalt: Player[];
  }>({ crimson: [], cobalt: [] });

  // Game Active States
  const [teams, setTeams] = useState<{
    crimson: TeamState;
    cobalt: TeamState;
  }>({
    crimson: {
      name: "Équipe Crimson",
      color: "red",
      bgClass: "bg-red-500/10",
      borderClass: "border-red-500",
      textClass: "text-red-400",
      players: [],
      score: 301,
      shieldActive: false,
      powerUps: []
    },
    cobalt: {
      name: "Équipe Cobalt",
      color: "blue",
      bgClass: "bg-blue-500/10",
      borderClass: "border-blue-500",
      textClass: "text-blue-400",
      players: [],
      score: 301,
      shieldActive: false,
      powerUps: []
    }
  });

  const [turnOrder, setTurnOrder] = useState<{ player: Player; team: "crimson" | "cobalt" }[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);

  // Active Quests (3 random ones)
  const [activeQuests, setActiveQuests] = useState<Quest[]>([]);
  const [completedQuestNotif, setCompletedQuestNotif] = useState<{ quest: Quest; team: string; bonus: PowerUp } | null>(null);

  // Active Physical Power/Curse challenge
  const [activePhysicalPower, setActivePhysicalPower] = useState<{
    id: string;
    name: string;
    icon: string;
    team: "crimson" | "cobalt";
    targetTeam: "crimson" | "cobalt";
    desc: string;
  } | null>(null);

  // Guild Unlocked Notification State
  const [guildMissionUnlockedNotif, setGuildMissionUnlockedNotif] = useState<{
    playerName: string;
    guildName: string;
    badgeIcon: string;
    badgeColor: string;
    powerName: string;
    powerIcon: string;
    powerDesc: string;
    missionTitle: string;
  } | null>(null);

  // Active Turn entry states
  const [turnScore, setTurnScore] = useState("");
  const [hitDouble, setHitDouble] = useState(false);
  const [hitTriple, setHitTriple] = useState(false);
  const [hitBullseye, setHitBullseye] = useState(false);
  const [turnDeductionCrimson, setTurnDeductionCrimson] = useState("");
  const [turnDeductionCobalt, setTurnDeductionCobalt] = useState("");

  // Powerup active state flags for the current throw
  const [doubleScoreActive, setDoubleScoreActive] = useState(false);
  const [extraTurnPending, setExtraTurnPending] = useState(false);
  const [nextTurnFrozen, setNextTurnFrozen] = useState(false);

  // Dynamic progressive player missions
  const [playerMissions, setPlayerMissions] = useState<Record<number, ActiveMission>>({});

  // Status Alerts
  const [alertText, setAlertText] = useState<{ text: string; type: "ok" | "err" | "info" } | null>(null);
  const [gameLogs, setGameLogs] = useState<string[]>([]);

  // Recording State
  const [winningTeamColor, setWinningTeamColor] = useState<"crimson" | "cobalt" | null>(null);
  const [winnerFinishType, setWinnerFinishType] = useState<FinishType>("DOUBLE");
  const [winningPlayerId, setWinningPlayerId] = useState<number | null>(null);
  const [opponentScoreLeft, setOpponentScoreLeft] = useState<number>(0);
  const [recordingLoading, setRecordingLoading] = useState(false);

  // Reset/Clear State on Mount
  useEffect(() => {
    const shuffled = [...QUESTS_POOL].sort(() => Math.random() - 0.5);
    setActiveQuests(shuffled.slice(0, 1));
  }, [step]);

  // Handle toast timers
  useEffect(() => {
    if (alertText) {
      const t = setTimeout(() => setAlertText(null), 4000);
      return () => clearTimeout(t);
    }
  }, [alertText]);

  // Setup selections
  const togglePlayerSelection = (playerId: number) => {
    setSelectedIds(prev => {
      const idx = prev.indexOf(playerId);
      if (idx > -1) {
        return prev.filter(id => id !== playerId);
      } else {
        return [...prev, playerId];
      }
    });
  };

  // 1. GENERATE TEAMS & SHUFFLE
  const handleStartDistribution = () => {
    if (selectedIds.length < 2) {
      setAlertText({ text: "Veuillez sélectionner au moins 2 joueurs.", type: "err" });
      return;
    }

    setStep("distribution");
    setShuffling(true);

    // Bourse de combat ultra généreuse calculée automatiquement :
    // Base généreuse de 500 PX, plus 150 PX pour chaque combattant sélectionné !
    const numPlayers = selectedIds.length;
    const calculatedBounty = 500 + (numPlayers * 150);
    setBountyXP(calculatedBounty);

    const shuffledPlayers = selectedIds
      .map(id => players.find(p => p.id === id)!)
      .filter(Boolean)
      .sort(() => Math.random() - 0.5);

    // Distribute dynamically for any number of players
    const crimson: Player[] = [];
    const cobalt: Player[] = [];

    shuffledPlayers.forEach((p, idx) => {
      if (idx % 2 === 0) {
        crimson.push(p);
      } else {
        cobalt.push(p);
      }
    });

    setTimeout(() => {
      setDistributedTeams({ crimson, cobalt });
      setShuffling(false);
    }, 2000);
  };

  // 2. LAUNCH ACTIVE BATTLE
  const handleLaunchBattle = () => {
    const crimsonPlayers = distributedTeams.crimson;
    const cobaltPlayers = distributedTeams.cobalt;

    // Build rotation turn order dynamically interleaving crimson and cobalt
    const order: { player: Player; team: "crimson" | "cobalt" }[] = [];
    const maxPlayers = Math.max(crimsonPlayers.length, cobaltPlayers.length);

    for (let i = 0; i < maxPlayers; i++) {
      const crimsonPlayer = crimsonPlayers[i % crimsonPlayers.length];
      const cobaltPlayer = cobaltPlayers[i % cobaltPlayers.length];
      order.push({ player: crimsonPlayer, team: "crimson" });
      order.push({ player: cobaltPlayer, team: "cobalt" });
    }

    setTeams({
      crimson: {
        name: "Équipe Crimson",
        color: "red",
        bgClass: "bg-red-500/10",
        borderClass: "border-red-500",
        textClass: "text-red-400",
        players: crimsonPlayers,
        score: startingScore,
        shieldActive: false,
        powerUps: []
      },
      cobalt: {
        name: "Équipe Cobalt",
        color: "blue",
        bgClass: "bg-blue-500/10",
        borderClass: "border-blue-500",
        textClass: "text-blue-400",
        players: cobaltPlayers,
        score: startingScore,
        shieldActive: false,
        powerUps: []
      }
    });

    // Generate initial dynamic missions for each player, ensuring no duplicates per team
    const initialMissions: Record<number, ActiveMission> = {};
    const crimsonActiveTypes: string[] = [];
    crimsonPlayers.forEach(p => {
      const m = generateDynamicPlayerMission(p.id, 1, crimsonActiveTypes);
      initialMissions[p.id] = m;
      crimsonActiveTypes.push(m.type);
    });

    const cobaltActiveTypes: string[] = [];
    cobaltPlayers.forEach(p => {
      const m = generateDynamicPlayerMission(p.id, 1, cobaltActiveTypes);
      initialMissions[p.id] = m;
      cobaltActiveTypes.push(m.type);
    });

    setPlayerMissions(initialMissions);

    setTurnOrder(order);
    setCurrentTurnIndex(0);
    setRoundNumber(1);
    setGameLogs([
      `🏹 Début de la bataille ! Cible initiale : ${startingScore} points.`,
      `💰 Bourse aux trésors scellée : ${bountyXP} PX en jeu !`
    ]);
    setStep("active");

    // Clear active cards state
    setDoubleScoreActive(false);
    setExtraTurnPending(false);
    setNextTurnFrozen(false);
    setGuildMissionUnlockedNotif(null);
  };

  // TRUST-BASED DIRECT COMPLETED ACTIONS
  const handleValidateQuestDirectly = (questId: string, teamColor: "crimson" | "cobalt") => {
    const q = activeQuests.find(quest => quest.id === questId);
    if (!q) return;

    const activeTeamName = teamColor === "crimson" ? "Crimson" : "Cobalt";
    const randomPower = POWERUPS_POOL[Math.floor(Math.random() * POWERUPS_POOL.length)];
    
    // Add powerup to the team
    setTeams(prev => {
      const nextTeam = { ...prev[teamColor] };
      nextTeam.powerUps = [...nextTeam.powerUps, randomPower];
      return { ...prev, [teamColor]: nextTeam };
    });

    // Show notification
    setCompletedQuestNotif({
      quest: q,
      team: activeTeamName,
      bonus: randomPower
    });

    // Log it
    setGameLogs(prev => [
      `🏆 Quête accomplie par l'Équipe ${activeTeamName} ! [${q.title}] -> Carte gagnée : ${randomPower.name} ${randomPower.icon}`,
      ...prev
    ]);

    // Replace quest in activeQuests pool
    setActiveQuests(prev => {
      const nextQuests = prev.filter(quest => quest.id !== questId);
      const unusedQuests = QUESTS_POOL.filter(qp => !nextQuests.some(nq => nq.id === qp.id));
      if (unusedQuests.length > 0) {
        const newQuest = unusedQuests[Math.floor(Math.random() * unusedQuests.length)];
        return [...nextQuests, newQuest];
      }
      return nextQuests;
    });
  };

  const handleTriggerGuildPowerDirectly = (player: Player, teamColor: "crimson" | "cobalt") => {
    const mission = playerMissions[player.id];
    if (!mission) return;

    // Apply power-up immediately
    mission.applyPower(teamColor, setTeams, (text: string) => {
      setGameLogs(prev => [text, ...prev]);
    });

    const guilds = dbStore.getGuilds();
    const playerGuild = guilds.find(g => (g.memberIds || []).includes(player.id));

    // Show beautiful banner
    setGuildMissionUnlockedNotif({
      playerName: player.name,
      guildName: playerGuild ? playerGuild.name : "Guerrier Libre",
      badgeIcon: playerGuild ? playerGuild.badgeIcon : "🏹",
      badgeColor: playerGuild ? playerGuild.badgeColor : "#E2E8F0",
      powerName: mission.powerName,
      powerIcon: mission.powerIcon,
      powerDesc: mission.powerDesc,
      missionTitle: mission.title
    });

    // Generate next, harder mission! "quand une mission est terminé, il faut que la suivant soit plus compliqué"
    const nextLevel = Math.min(4, mission.level + 1);
    const teamTeammates = teamColor === "crimson" ? distributedTeams.crimson : distributedTeams.cobalt;
    const otherTeammatesMissions = teamTeammates
      .filter(tp => tp.id !== player.id)
      .map(tp => playerMissions[tp.id]?.type)
      .filter(Boolean);

    const newMission = generateDynamicPlayerMission(player.id, nextLevel, otherTeammatesMissions);
    setPlayerMissions(prev => ({
      ...prev,
      [player.id]: newMission
    }));

    setGameLogs(prev => [
      `📈 Promotion ! ${player.name} passe au niveau de quête supérieur (Niveau ${nextLevel}) : [${newMission.conditionText}]`,
      ...prev
    ]);
  };

  const handleDeductScore = (teamColor: "crimson" | "cobalt", amount: number) => {
    if (isNaN(amount) || amount <= 0) return;
    setTeams(prev => {
      const nTeam = { ...prev[teamColor] };
      const oldScore = nTeam.score;
      const newScore = Math.max(0, oldScore - amount);
      return { ...prev, [teamColor]: { ...nTeam, score: newScore } };
    });
    setGameLogs(prev => [
      `🎯 Équipe ${teamColor === "crimson" ? "Crimson" : "Cobalt"} : Score diminué de -${amount} pts.`,
      ...prev
    ]);
  };

  const handleAddScore = (teamColor: "crimson" | "cobalt", amount: number) => {
    if (isNaN(amount) || amount <= 0) return;
    setTeams(prev => {
      const nTeam = { ...prev[teamColor] };
      const oldScore = nTeam.score;
      const newScore = Math.min(startingScore, oldScore + amount);
      return { ...prev, [teamColor]: { ...nTeam, score: newScore } };
    });
    setGameLogs(prev => [
      `🔄 Correction : Équipe ${teamColor === "crimson" ? "Crimson" : "Cobalt"} : Score augmenté de +${amount} pts.`,
      ...prev
    ]);
  };

  const handleOpenVictoryScreen = (teamColor: "crimson" | "cobalt") => {
    const defaultWinner = distributedTeams[teamColor]?.[0];
    setWinningTeamColor(teamColor);
    if (defaultWinner) {
      setWinningPlayerId(defaultWinner.id);
    }
    const losingTeamColor = teamColor === "crimson" ? "cobalt" : "crimson";
    setOpponentScoreLeft(teams[losingTeamColor].score);
    setStep("finished");
  };

  // 3. COMPLETE QUESTS ENGINE
  const checkQuests = (score: number, teamColor: "crimson" | "cobalt", scoreRemaining: number) => {
    const activeTeamName = teamColor === "crimson" ? "Crimson" : "Cobalt";
    let completedQuest: Quest | null = null;

    for (const q of activeQuests) {
      let isMet = false;
      if (q.id === "double" && hitDouble) isMet = true;
      else if (q.id === "triple" && hitTriple) isMet = true;
      else if (q.id === "bullseye" && hitBullseye) isMet = true;
      // Other visual and pattern quests are trust-validated directly in the UI by clicking Crimson/Cobalt
      // on the quest banner, which prevents false triggers and keeps gameplay active.

      if (isMet) {
        completedQuest = q;
        break;
      }
    }

    if (completedQuest) {
      // Award a random bonus card
      const randomPower = POWERUPS_POOL[Math.floor(Math.random() * POWERUPS_POOL.length)];
      
      // Add powerup to the team
      setTeams(prev => {
        const nextTeam = { ...prev[teamColor] };
        nextTeam.powerUps = [...nextTeam.powerUps, randomPower];
        return { ...prev, [teamColor]: nextTeam };
      });

      // Show notification
      setCompletedQuestNotif({
        quest: completedQuest,
        team: activeTeamName,
        bonus: randomPower
      });

      // Log it
      setGameLogs(prev => [
        `🏆 Quête accomplie par l'Équipe ${activeTeamName} ! [${completedQuest!.title}] -> Carte gagnée : ${randomPower.name}`,
        ...prev
      ]);

      // Replace quest in activeQuests pool
      setActiveQuests(prev => {
        const nextQuests = prev.filter(q => q.id !== completedQuest!.id);
        const unusedQuests = QUESTS_POOL.filter(qp => !nextQuests.some(nq => nq.id === qp.id));
        const newQuest = unusedQuests[Math.floor(Math.random() * unusedQuests.length)];
        return [...nextQuests, newQuest];
      });
    }
  };

  // 4. POWER-UP TRIGGER LOGIC
  const handlePlayPowerUp = (powerupId: string, teamColor: "crimson" | "cobalt") => {
    const oppColor = teamColor === "crimson" ? "cobalt" : "crimson";
    const ownTeam = teams[teamColor];
    const oppTeam = teams[oppColor];

    if (!ownTeam.powerUps.some(p => p.id === powerupId)) return;

    // Use / consume the card
    setTeams(prev => {
      const nextOwn = { ...prev[teamColor] };
      nextOwn.powerUps = nextOwn.powerUps.filter(p => p.id !== powerupId);
      return { ...prev, [teamColor]: nextOwn };
    });

    const power = POWERUPS_POOL.find(p => p.id === powerupId);
    if (!power) return;

    // Shield check: shields block all offensive curses/malus targeting the opponent team
    const isOffensive = ["eyes_closed", "other_hand", "step_back", "distract", "freeze"].includes(powerupId);

    if (isOffensive && oppTeam.shieldActive) {
      // Opponent shield breaks, blocking the curse!
      setTeams(prev => {
        const nextOpp = { ...prev[oppColor] };
        nextOpp.shieldActive = false;
        return { ...prev, [oppColor]: nextOpp };
      });
      setAlertText({ text: `🛡️ Le Bouclier de l'équipe adverse a bloqué votre sort [${power.name}] !`, type: "info" });
      setGameLogs(prev => [
        `🛡️ Bouclier : Le Bouclier de l'Équipe ${oppColor === "crimson" ? "Crimson" : "Cobalt"} a paré le sort [${power.name}] lancé par l'Équipe ${teamColor === "crimson" ? "Crimson" : "Cobalt"} !`,
        ...prev
      ]);
    } else {
      // Execute the power
      if (powerupId === "shield") {
        setTeams(prev => {
          const nextOwn = { ...prev[teamColor] };
          nextOwn.shieldActive = true;
          return { ...prev, [teamColor]: nextOwn };
        });
        setAlertText({ text: `🛡️ Bouclier de Fer activé pour votre équipe !`, type: "ok" });
        setGameLogs(prev => [
          `🛡️ Protection : L'Équipe ${teamColor === "crimson" ? "Crimson" : "Cobalt"} active un Bouclier de Fer !`,
          ...prev
        ]);
      } else {
        // Set the active physical power challenge for display
        setActivePhysicalPower({
          id: power.id,
          name: power.name,
          icon: power.icon,
          team: teamColor,
          targetTeam: isOffensive ? oppColor : teamColor,
          desc: power.description
        });
        setAlertText({ text: `⚡ Sort [${power.name}] activé avec succès !`, type: "ok" });
        setGameLogs(prev => [
          `🔮 Sort Actif : L'Équipe ${teamColor === "crimson" ? "Crimson" : "Cobalt"} joue [${power.name}] !`,
          ...prev
        ]);
      }
    }
  };

  // 5. VALIDATE THE TURN SCORE
  const handleValidateTurn = (e: React.FormEvent) => {
    e.preventDefault();
    const scoreVal = Number(turnScore);

    if (turnScore === "" || isNaN(scoreVal) || scoreVal < 0 || scoreVal > 180) {
      setAlertText({ text: "Saisissez un score de tour valide entre 0 et 180 points.", type: "err" });
      return;
    }

    const activeTurn = turnOrder[currentTurnIndex];
    const teamColor = activeTurn.team;
    const teamState = teams[teamColor];
    const playerName = activeTurn.player.name;

    // Calculate applied deduction
    let appliedDeduction = scoreVal;
    if (doubleScoreActive) {
      appliedDeduction = scoreVal * 2;
    }

    const startScore = teamState.score;
    const finalScore = startScore - appliedDeduction;

    let nextScore = finalScore;
    let bust = false;

    if (finalScore < 0) {
      // BUST!
      bust = true;
      nextScore = startScore;
      setAlertText({ text: `💀 BUST pour ${playerName} ! Score inférieur à 0, compteur restauré à ${startScore}.`, type: "err" });
      setGameLogs(prev => [`💀 BUST : ${playerName} dépasse ! Score reste à ${startScore}.`, ...prev]);
    } else {
      setGameLogs(prev => [
        `🎯 ${playerName} marque ${appliedDeduction} points${doubleScoreActive ? " (Doublé !)" : ""}. Reste : ${finalScore} points.`,
        ...prev
      ]);
    }

    // Apply score update
    setTeams(prev => {
      const nTeam = { ...prev[teamColor] };
      nTeam.score = nextScore;
      // Consume shields at turn validation
      nTeam.shieldActive = false;
      return { ...prev, [teamColor]: nTeam };
    });

    // Check quests on the recorded turn score (before bust checks, on standard score)
    if (!bust) {
      checkQuests(scoreVal, teamColor, nextScore);

      // Check Dynamic Player Mission
      const mission = playerMissions[activeTurn?.player?.id];
      if (mission) {
        const missionCompleted = mission.check(scoreVal, hitDouble, hitTriple, hitBullseye);
        if (missionCompleted) {
          mission.applyPower(teamColor, setTeams, (text: string) => {
            setGameLogs(prev => [text, ...prev]);
          });

          const guilds = dbStore.getGuilds();
          const playerGuild = guilds.find(g => (g.memberIds || []).includes(activeTurn.player.id));

          setGuildMissionUnlockedNotif({
            playerName,
            guildName: playerGuild ? playerGuild.name : "Guerrier Libre",
            badgeIcon: playerGuild ? playerGuild.badgeIcon : "🏹",
            badgeColor: playerGuild ? playerGuild.badgeColor : "#E2E8F0",
            powerName: mission.powerName,
            powerIcon: mission.powerIcon,
            powerDesc: mission.powerDesc,
            missionTitle: mission.title
          });

          // Generate next, harder mission! "quand une mission est terminé, il faut que la suivant soit plus compliqué"
          const nextLevel = Math.min(4, mission.level + 1);
          const teamTeammates = teamColor === "crimson" ? distributedTeams.crimson : distributedTeams.cobalt;
          const otherTeammatesMissions = teamTeammates
            .filter(tp => tp.id !== activeTurn.player.id)
            .map(tp => playerMissions[tp.id]?.type)
            .filter(Boolean);

          const newMission = generateDynamicPlayerMission(activeTurn.player.id, nextLevel, otherTeammatesMissions);
          setPlayerMissions(prev => ({
            ...prev,
            [activeTurn.player.id]: newMission
          }));

          setGameLogs(prev => [
            `📈 Promotion ! ${playerName} passe au niveau de quête supérieur (Niveau ${nextLevel}) : [${newMission.conditionText}]`,
            ...prev
          ]);
        }
      }
    }

    // Check Victory
    if (nextScore === 0) {
      // We have a winner!
      setWinningTeamColor(teamColor);
      setWinningPlayerId(activeTurn.player.id);
      const losingTeamColor = teamColor === "crimson" ? "cobalt" : "crimson";
      setOpponentScoreLeft(teams[losingTeamColor].score);
      setStep("finished");
      return;
    }

    // Determine next player turn
    let nextIndex = currentTurnIndex;
    if (extraTurnPending) {
      // Repeat current index!
      setExtraTurnPending(false);
    } else {
      nextIndex = (currentTurnIndex + 1) % turnOrder.length;
      
      // If frozen, skip!
      if (nextTurnFrozen) {
        const skippedPlayer = turnOrder[nextIndex];
        setGameLogs(prev => [`❄️ Gel de tour : ${skippedPlayer.player.name} est gelé(e) et passe son tour !`, ...prev]);
        nextIndex = (nextIndex + 1) % turnOrder.length;
        setNextTurnFrozen(false);
      }
    }

    // Increment round count if wrapped back to start
    if (nextIndex === 0) {
      setRoundNumber(prev => prev + 1);
    }

    setCurrentTurnIndex(nextIndex);

    // Reset round validation toggles
    setTurnScore("");
    setHitDouble(false);
    setHitTriple(false);
    setHitBullseye(false);
    setDoubleScoreActive(false);
  };

  // 6. RECORD THE MATCH TO FIREBASE DB
  const handleRecordMatchToDatabase = async () => {
    if (!winningTeamColor || !winningPlayerId) return;

    setRecordingLoading(true);

    const activeSeason = seasons.find(s => {
      const now = new Date();
      const start = new Date(s.startedAt);
      const end = s.endedAt ? new Date(s.endedAt) : null;
      return start <= now && (!end || end >= now);
    });

    if (!activeSeason) {
      setAlertText({ text: "Aucune saison active pour enregistrer le match.", type: "err" });
      setRecordingLoading(false);
      return;
    }

    try {
      const matchDateStr = new Date().toISOString();

      // Determine losers payload
      const losersPayload: { playerId: number; scoreLeft: number }[] = [];
      
      // The teammate of the winner gets Co-Winner Rank 2 with scoreLeft = 0 (which triggers Poulidor in calculations)
      const winningTeamPlayers = distributedTeams[winningTeamColor];
      const losingTeamColor = winningTeamColor === "crimson" ? "cobalt" : "crimson";
      const losingTeamPlayers = distributedTeams[losingTeamColor];
      const losingScoreLeft = opponentScoreLeft;

      // Add winning teammate (if 2 players on winning team) as scoreLeft = 0 (co-winner)
      winningTeamPlayers.forEach(p => {
        if (p.id !== winningPlayerId) {
          losersPayload.push({
            playerId: p.id,
            scoreLeft: 0 // Special co-winner marker! Gets 0 points left
          });
        }
      });

      // Add losing team members with the final score left
      losingTeamPlayers.forEach(p => {
        losersPayload.push({
          playerId: p.id,
          scoreLeft: Math.max(1, losingScoreLeft) // Must be >= 1 for the engine
        });
      });

      // Pull historical data strictly before now
      const winnerCareerXPBefore = calculatePlayerCareerXPBeforeMatch(winningPlayerId, matches, matchDateStr);
      
      const loserXPsBeforeMap = new Map<number, number>();
      losersPayload.forEach(l => {
        const xp = calculatePlayerCareerXPBeforeMatch(l.playerId, matches, matchDateStr);
        loserXPsBeforeMap.set(l.playerId, xp);
      });

      const consecutiveWins = countConsecutiveWinsBefore(winningPlayerId, activeSeason.id, matches, matchDateStr);

      const seasonXPsBeforeMap = new Map<number, number>();
      players.forEach(p => {
        const xp = calculatePlayerSeasonXPBeforeMatch(p.id, activeSeason.id, matches, matchDateStr);
        seasonXPsBeforeMap.set(p.id, xp);
      });

      // Compute calculations using official scoring engine
      const calculatedParticipants = calculateMatchResults(
        winningPlayerId,
        winnerFinishType,
        losersPayload,
        winnerCareerXPBefore,
        loserXPsBeforeMap,
        activeSeason,
        consecutiveWins,
        seasonXPsBeforeMap
      );

      // Share bounty among winning team members
      const share = Math.floor(bountyXP / winningTeamPlayers.length);
      const updatedParticipants = calculatedParticipants.map(part => {
        // Is this participant in the winning team?
        const isWinnerTeam = winningTeamPlayers.some(p => p.id === part.playerId);
        if (isWinnerTeam) {
          return {
            ...part,
            xpEarned: part.xpEarned + share,
            medals: [...(part.medals || []), `BOURSE_PX:${share}`]
          };
        }
        return part;
      });

      // Save using dbStore
      const savedMatch = await dbStore.recordMatch({
        seasonId: activeSeason.id,
        playedAt: matchDateStr,
        participants: updatedParticipants
      }, isAdmin ? "Administrateur" : "Visiteur");

      setAlertText({ text: "Bataille en Équipe enregistrée avec succès dans l'historique ! ✓", type: "ok" });
      onMatchRecorded(savedMatch);
      
      // Cleanup & Return to Setup
      setStep("setup");
      setSelectedIds([]);
      setWinningTeamColor(null);
      setWinningPlayerId(null);
    } catch (err: any) {
      setAlertText({ text: "Erreur lors de l'enregistrement : " + err.message, type: "err" });
    } finally {
      setRecordingLoading(false);
    }
  };

  const sortedPlayersList = [...players].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      {/* 1. SETUP STEP */}
      {step === "setup" && (
        <div className="space-y-6">
          <div className="p-5 bg-[#111114] border border-[#2A2A2E] rounded-none box-glow flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold font-display text-white tracking-wide uppercase flex items-center gap-2">
                <Swords className="w-5 h-5 text-cosmic-accent" /> Combat en Équipe !
              </h2>
              <p className="text-xs text-slate-400 mt-1">Ligue Live Interactive : Choississez les guerriers, générez des équipes aléatoires, accomplissez des quêtes et jetez des sorts !</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display">Choisissez vos Combattants</h3>
              <p className="text-xs text-slate-400">Le système répartira équitablement et aléatoirement les tireurs dans l'arène (combat ouvert à plus de 4 joueurs !).</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {sortedPlayersList.map(p => {
                const isSelected = selectedIds.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => togglePlayerSelection(p.id)}
                    className={`p-3.5 border flex flex-col items-center justify-center text-center gap-2 transition cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 rounded-none ${
                      isSelected
                        ? "bg-cosmic-accent/15 border-cosmic-accent text-white font-black shadow-[0_0_15px_rgba(255,62,62,0.15)]"
                        : "bg-[#111114]/50 border-[#2A2A2E]/60 hover:border-[#2A2A2E] text-slate-400 hover:bg-[#111114]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-none bg-slate-950 border border-[#2A2A2E] flex items-center justify-center text-slate-300 font-bold font-display select-none">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold truncate w-full select-text">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleStartDistribution}
            disabled={selectedIds.length < 2}
            className={`w-full py-4 rounded-none font-extrabold uppercase tracking-widest font-display select-none transition transform hover:-translate-y-0.5 active:translate-y-0 text-xs border flex items-center justify-center gap-2 cursor-pointer ${
              selectedIds.length < 2
                ? "bg-slate-950 text-slate-600 border-[#2A2A2E] pointer-events-none"
                : "bg-gradient-to-r from-cosmic-accent to-[#8E1E1E] hover:from-cosmic-accent/90 hover:to-[#8E1E1E]/90 text-white border-cosmic-accent/30 shadow-lg shadow-cosmic-accent/15"
            }`}
          >
            <Shuffle className="w-4 h-4" />
            Distribuer les Équipes Aléatoirement
          </button>
        </div>
      )}

      {/* 2. DISTRIBUTION SHUFFLE STEP */}
      {step === "distribution" && (
        <div className="p-8 bg-[#111114] border border-[#2A2A2E] text-center space-y-6 flex flex-col items-center justify-center min-h-[350px] rounded-none">
          {shuffling ? (
            <div className="space-y-4 max-w-sm">
              <RefreshCw className="w-12 h-12 text-cosmic-accent animate-spin mx-auto" />
              <h2 className="text-lg font-bold font-display text-white tracking-wider uppercase animate-pulse">Assignation des rôles en cours...</h2>
              <p className="text-xs text-slate-400">Le destin est en train de forger les alliances secrètes dans l'arène des fléchettes !</p>
            </div>
          ) : (
            <div className="space-y-6 w-full max-w-2xl animate-fadeIn">
              <div className="space-y-1">
                <span className="text-4xl">⚔️</span>
                <h2 className="text-xl font-black font-display tracking-wider text-white uppercase">Équipes Décidées par l'Arène !</h2>
                <p className="text-xs text-slate-400">Les équipes ont été générées de façon purement aléatoire pour garantir le frisson du combat.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                {/* Team Crimson */}
                <div className="bg-red-500/5 border border-red-500/30 p-5 space-y-3">
                  <div className="flex items-center gap-2 justify-center text-red-400 font-bold font-display uppercase tracking-wider text-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
                    Équipe Crimson
                  </div>
                  <div className="space-y-2">
                    {distributedTeams.crimson.map(p => (
                      <div key={p.id} className="bg-slate-950/80 border border-[#2A2A2E]/50 p-3 text-xs text-slate-200 font-bold font-sans">
                        👤 {p.name}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Team Cobalt */}
                <div className="bg-blue-500/5 border border-blue-500/30 p-5 space-y-3">
                  <div className="flex items-center gap-2 justify-center text-blue-400 font-bold font-display uppercase tracking-wider text-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                    Équipe Cobalt
                  </div>
                  <div className="space-y-2">
                    {distributedTeams.cobalt.map(p => (
                      <div key={p.id} className="bg-slate-950/80 border border-[#2A2A2E]/50 p-3 text-xs text-slate-200 font-bold font-sans">
                        👤 {p.name}
                      </div>
                    ))}
                    {distributedTeams.cobalt.length === 1 && (
                      <div className="p-2 border border-blue-500/15 bg-blue-500/[0.02] rounded-none text-[10px] text-blue-300 leading-normal">
                        ⚖️ Guerrier Solo ! Pour équilibrer, ce joueur lancera deux fois par round !
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-center pt-4">
                <button
                  onClick={() => setStep("setup")}
                  className="px-5 py-3 border border-[#2A2A2E] text-xs font-bold text-slate-400 hover:text-white rounded-none cursor-pointer uppercase tracking-wider"
                >
                  <RotateCcw className="w-4 h-4 inline-block mr-1" /> Re-générer
                </button>
                <button
                  onClick={handleLaunchBattle}
                  className="px-6 py-3 bg-gradient-to-r from-cosmic-accent to-[#8E1E1E] text-white font-extrabold text-xs uppercase tracking-wider rounded-none cursor-pointer shadow-lg border border-cosmic-accent/30"
                >
                  Lancer le Combat Live ! ⚔️
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. ACTIVE LIVE GAMEPLAY Companion */}
      {step === "active" && (
        <div className="space-y-6">
          {/* Active Quests & completed notifications */}
          <AnimatePresence mode="wait">
            {completedQuestNotif && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-gradient-to-r from-amber-500/10 to-yellow-500/5 border border-amber-500 p-5 rounded-none text-center relative overflow-hidden shadow-2xl"
              >
                <button
                  onClick={() => setCompletedQuestNotif(null)}
                  className="absolute top-2 right-2 text-slate-400 hover:text-white font-mono text-xs cursor-pointer select-none"
                >
                  ✕
                </button>
                <div className="space-y-1">
                  <span className="text-3xl animate-bounce block">✨🏆✨</span>
                  <h3 className="text-sm font-black text-amber-300 uppercase tracking-wider">QUÊTE COMPLÉTÉE PAR L'ÉQUIPE {completedQuestNotif.team.toUpperCase()} !</h3>
                  <p className="text-xs text-white max-w-md mx-auto">
                    La quête <strong>{completedQuestNotif.quest.title}</strong> a été validée !
                  </p>
                  <div className="inline-block bg-slate-950 border border-amber-500/30 p-2.5 mt-2 rounded-none text-left max-w-xs">
                    <span className="block text-[9px] text-[#66666E] uppercase tracking-wider font-mono">Récompense obtenue :</span>
                    <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5 pt-0.5">
                      <span>{completedQuestNotif.bonus.icon}</span>
                      <span>{completedQuestNotif.bonus.name}</span>
                    </span>
                    <span className="block text-[10px] text-slate-400 pt-0.5 leading-normal">{completedQuestNotif.bonus.description}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Guild Mission Unlocked notification */}
          <AnimatePresence mode="wait">
            {guildMissionUnlockedNotif && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="border p-5 rounded-none text-center relative overflow-hidden shadow-2xl space-y-2 bg-slate-950"
                style={{
                  borderColor: guildMissionUnlockedNotif.badgeColor,
                  backgroundImage: `linear-gradient(to right, ${guildMissionUnlockedNotif.badgeColor}15, transparent)`
                }}
              >
                <button
                  onClick={() => setGuildMissionUnlockedNotif(null)}
                  className="absolute top-2 right-2 text-slate-400 hover:text-white font-mono text-xs cursor-pointer select-none"
                >
                  ✕
                </button>
                <div className="space-y-1">
                  <span className="text-3xl animate-bounce block">{guildMissionUnlockedNotif.badgeIcon} ✨🛡️✨</span>
                  <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: guildMissionUnlockedNotif.badgeColor }}>
                    POUVOIR DE GUILDE ACTIVER PAR {guildMissionUnlockedNotif.playerName.toUpperCase()} !
                  </h3>
                  <p className="text-xs text-white max-w-md mx-auto leading-normal">
                    Fidèle à l'alliance <strong style={{ color: guildMissionUnlockedNotif.badgeColor }}>{guildMissionUnlockedNotif.guildName}</strong>, l'archer a accompli sa mission : <span className="italic">"{guildMissionUnlockedNotif.missionTitle}"</span> !
                  </p>
                  <div className="inline-block bg-slate-950 border p-2.5 mt-2 rounded-none text-left max-w-xs" style={{ borderColor: `${guildMissionUnlockedNotif.badgeColor}40` }}>
                    <span className="block text-[9px] text-[#66666E] uppercase tracking-wider font-mono">Pouvoir de Guilde activé :</span>
                    <span className="text-xs font-black flex items-center gap-1.5 pt-0.5 text-white">
                      <span>{guildMissionUnlockedNotif.powerIcon}</span>
                      <span>{guildMissionUnlockedNotif.powerName}</span>
                    </span>
                    <span className="block text-[10px] text-slate-400 pt-0.5 leading-normal">{guildMissionUnlockedNotif.powerDesc}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Physical Spell/Challenge Warn Box */}
          <AnimatePresence mode="wait">
            {activePhysicalPower && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`p-6 border-4 text-center space-y-4 rounded-none shadow-2xl bg-slate-950 relative overflow-hidden transition-all duration-300 ${
                  activePhysicalPower.targetTeam === "crimson"
                    ? "border-red-500 shadow-red-500/20"
                    : "border-blue-500 shadow-blue-500/20"
                }`}
              >
                {/* Glowing decorative background */}
                <div className={`absolute inset-0 opacity-[0.03] pointer-events-none bg-gradient-to-br ${
                  activePhysicalPower.targetTeam === "crimson" ? "from-red-500 to-transparent" : "from-blue-500 to-transparent"
                }`} />

                <div className="absolute top-2 right-2 p-3">
                  <span className="text-5xl opacity-20 animate-pulse">{activePhysicalPower.icon}</span>
                </div>
                
                <div className="space-y-3 relative z-10">
                  <span className="inline-block text-[11px] font-mono font-black uppercase tracking-widest text-yellow-400 bg-yellow-500/10 px-4 py-1.5 border border-yellow-500/30 animate-pulse">
                    ⚡ SORTILÈGE PHYSIQUE ACTIF DANS L'ARÈNE ⚡
                  </span>
                  
                  <h3 className="text-2xl font-black font-display text-white tracking-tight leading-tight uppercase pt-1">
                    {activePhysicalPower.icon} {activePhysicalPower.name} !
                  </h3>
                  
                  <p className="text-sm text-slate-300 font-bold max-w-xl mx-auto leading-relaxed">
                    L'Équipe <span className={activePhysicalPower.team === "crimson" ? "text-red-400 font-extrabold" : "text-blue-400 font-extrabold"}>{activePhysicalPower.team === "crimson" ? "Crimson 🔴" : "Cobalt 🔵"}</span> a lancé ce sort :
                  </p>
                  
                  <div className="bg-slate-900/90 border-2 border-yellow-500/30 p-5 font-display text-lg text-yellow-100 font-black tracking-wide my-3 leading-relaxed max-w-2xl mx-auto shadow-inner">
                    👉 {activePhysicalPower.desc}
                  </div>
                  
                  <p className="text-xs text-slate-400 italic">
                    {activePhysicalPower.targetTeam === "crimson" ? "🔴 Les archers de Crimson" : "🔵 Les archers de Cobalt"} doivent respecter cette règle lors de leurs lancers sur la machine !
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    setGameLogs(prev => [`✅ Défi physique [${activePhysicalPower.name}] complété/résolu avec succès.`, ...prev]);
                    setActivePhysicalPower(null);
                  }}
                  className="px-8 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-widest cursor-pointer rounded-none transition shadow-lg transform active:translate-y-0.5"
                >
                  C'est fait ! Défi Validé ⚔️
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {/* 1. UNE SEULE QUÊTE GLOBALE D'ARÈNE */}
          <div className="space-y-4">
            {/* Global Arena Quest (1 line compact banner) */}
            {activeQuests.length > 0 && (
              <div className="bg-[#111114] border border-amber-500/50 p-2 rounded-none flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl select-none shrink-0">{activeQuests[0].badge}</span>
                  <div>
                    <span className="font-extrabold text-amber-400 uppercase tracking-wide mr-1.5">Quête Globale d'Arène : {activeQuests[0].title}</span>
                    <span className="text-[10px] text-slate-300 italic">({activeQuests[0].conditionText})</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                  <span className="text-[9px] text-slate-400 uppercase font-mono mr-1">Récompenser :</span>
                  <button
                    type="button"
                    onClick={() => handleValidateQuestDirectly(activeQuests[0].id, "crimson")}
                    className="px-2.5 py-1 bg-red-950 hover:bg-red-900 border border-red-500 text-red-200 font-bold text-[9px] uppercase cursor-pointer rounded-none transition"
                  >
                    🔴 Crimson
                  </button>
                  <button
                    type="button"
                    onClick={() => handleValidateQuestDirectly(activeQuests[0].id, "cobalt")}
                    className="px-2.5 py-1 bg-blue-950 hover:bg-blue-900 border border-blue-500 text-blue-200 font-bold text-[9px] uppercase cursor-pointer rounded-none transition"
                  >
                    🔵 Cobalt
                  </button>
                </div>
              </div>
            )}

            {/* Guide to No Mental Math */}
            <div className="bg-[#16161a] border border-slate-800/80 p-3.5 flex items-start gap-3.5 text-xs leading-relaxed animate-fadeIn">
              <span className="text-xl select-none shrink-0" role="img" aria-label="lightbulb">🎯💡</span>
              <div className="text-slate-400">
                <span className="font-extrabold text-white uppercase tracking-wider text-[10px] block mb-1">ZÉRO CALCUL MENTAL !</span>
                Pour les quêtes et les missions visuelles, ne vous fatiguez pas à compter vos points : observez simplement la position de vos fléchettes sur la cible, puis cliquez directement sur le bouton <span className="text-amber-400 font-extrabold font-mono">⚡ Valider</span> d'un archer ou sur <span className="text-red-400 font-bold">🔴 Crimson</span> / <span className="text-blue-400 font-bold">🔵 Cobalt</span> pour débloquer votre récompense de guilde !
              </div>
            </div>

            {/* Arena Table of Players & Missions */}
            <div className="overflow-x-auto border border-[#2A2A2E] bg-[#111114] rounded-none shadow-lg animate-fadeIn">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 border-b border-[#2A2A2E] text-slate-400 uppercase font-mono tracking-wider text-[10px]">
                    <th className="p-2.5 px-3">Archer & Équipe</th>
                    <th className="p-2.5 px-3">Mission Active & Sort à Débloquer</th>
                    <th className="p-2.5 px-3 text-right">Action Directe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2E]/60">
                  {[
                    ...teams.crimson.players.map(p => ({ player: p, team: "crimson" as const })),
                    ...teams.cobalt.players.map(p => ({ player: p, team: "cobalt" as const }))
                  ].map(({ player, team }) => {
                    const mission = playerMissions[player.id];
                    
                    return (
                      <tr key={player.id} className="hover:bg-slate-950/60 transition duration-150">
                        {/* 1. ARCHER & EQUIPE */}
                        <td className="p-2.5 px-3 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${team === "crimson" ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" : "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]"}`} />
                            <span className="truncate max-w-[120px]" title={player.name}>{player.name}</span>
                            {team === "cobalt" && teams.cobalt.players.length === 1 && (
                              <span className="text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1 py-0.5 uppercase tracking-widest font-mono font-bold" title="Lancer double pour équilibrer">⚖️ Solo</span>
                            )}
                          </div>
                        </td>
                        
                        {/* 2. MISSION & POUVOIR (ON TWO LINES) */}
                        <td className="p-2.5 px-3">
                          {mission ? (
                            <div className="space-y-1.5 max-w-xl">
                              {/* Line 1: Mission Active */}
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[9px] font-black uppercase tracking-wider font-mono">
                                  Niv. {mission.level}
                                </span>
                                <span className="font-extrabold text-white text-xs">
                                  {mission.conditionText}
                                </span>
                              </div>
                              
                              {/* Line 2: Sort à débloquer */}
                              <div className="pl-2 border-l-2 border-slate-800/80 flex flex-wrap items-center gap-1.5 text-slate-300">
                                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wide shrink-0">🎁 Récompense :</span>
                                <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                                  <span>{mission.powerIcon}</span>
                                  <span>{mission.powerName}</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  ({mission.powerDesc})
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Aucune mission</span>
                          )}
                        </td>
                        
                        {/* 3. ACTION */}
                        <td className="p-2.5 px-3 text-right">
                          {mission ? (
                            <button
                              type="button"
                              onClick={() => handleTriggerGuildPowerDirectly(player, team)}
                              className={`px-2 py-1 border font-black text-[10px] uppercase tracking-wider rounded-none cursor-pointer transition active:translate-y-0.5 inline-flex items-center gap-1 ${
                                team === "crimson"
                                  ? "bg-red-950 hover:bg-red-900 border-red-500/40 text-red-200 hover:text-white"
                                  : "bg-blue-950 hover:bg-blue-900 border-blue-500/40 text-blue-200 hover:text-white"
                              }`}
                            >
                              <span>⚡</span>
                              <span>Valider</span>
                            </button>
                          ) : (
                            <span className="text-slate-600 font-mono text-[10px]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* COMBAT ACTIONS & RESERVES FOOTER GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Spells Reserve and Match End Actions */}
              <div className="space-y-4 flex flex-col justify-between">
                {/* Reserves Card */}
                <div className="bg-[#111114] border border-[#2A2A2E] p-3 space-y-3 flex-1">
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-black border-b border-[#2A2A2E] pb-1.5 flex items-center justify-between">
                    <span>🃏 Sortilèges d'Alliance en Réserve</span>
                    <span className="text-[9px] text-slate-500 lowercase normal-case">Activez un sort !</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Crimson Reserve */}
                    <div className="space-y-1.5 bg-red-500/5 border border-red-500/10 p-2">
                      <span className="block text-[10px] font-black text-red-400 uppercase tracking-wider">🔴 Crimson ({teams.crimson.powerUps.length})</span>
                      {teams.crimson.powerUps.length === 0 ? (
                        <span className="text-[10px] text-slate-500 italic block">Aucun sort disponible</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {teams.crimson.powerUps.map((pu, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handlePlayPowerUp(pu.id, "crimson")}
                              className="px-2 py-1 bg-red-950 hover:bg-red-900 border border-red-500/30 text-[9px] text-red-200 font-extrabold uppercase rounded-none cursor-pointer transition hover:text-white"
                              title={pu.description}
                            >
                              {pu.icon} {pu.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Cobalt Reserve */}
                    <div className="space-y-1.5 bg-blue-500/5 border border-blue-500/10 p-2">
                      <span className="block text-[10px] font-black text-blue-400 uppercase tracking-wider">🔵 Cobalt ({teams.cobalt.powerUps.length})</span>
                      {teams.cobalt.powerUps.length === 0 ? (
                        <span className="text-[10px] text-slate-500 italic block">Aucun sort disponible</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {teams.cobalt.powerUps.map((pu, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handlePlayPowerUp(pu.id, "cobalt")}
                              className="px-2 py-1 bg-blue-950 hover:bg-blue-900 border border-blue-500/30 text-[9px] text-blue-200 font-extrabold uppercase rounded-none cursor-pointer transition hover:text-white"
                              title={pu.description}
                            >
                              {pu.icon} {pu.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score & Winner Panel */}
                <div className="bg-[#111114] border border-[#2A2A2E] p-3 space-y-3.5">
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-black border-b border-[#2A2A2E] pb-1.5 flex items-center justify-between">
                    <span>🏆 TABLEAU DES SCORES & STATUTS</span>
                    <span className="text-[10px] font-mono text-amber-400 font-bold">💰 Bourse : {bountyXP} PX</span>
                  </div>
                  
                  {/* Scores Display & Correction */}
                  <div className="grid grid-cols-2 gap-3.5 text-xs pb-1">
                    {/* Crimson Score Card */}
                    <div className="space-y-2 bg-red-500/[0.02] border border-red-500/10 p-2 relative">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-extrabold text-red-400">🔴 Crimson :</span>
                        <span className="font-mono text-xs text-white font-black">{teams.crimson.score} pts</span>
                      </div>
                      
                      {/* Crimson Badges */}
                      <div className="flex flex-wrap gap-1">
                        {teams.crimson.shieldActive && (
                          <span className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/40 text-blue-300 font-mono text-[9px] font-black uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                            <span>🛡️</span> <span>Bouclier</span>
                          </span>
                        )}
                        {activePhysicalPower && activePhysicalPower.targetTeam === "crimson" && (
                          <span className="px-1.5 py-0.5 bg-red-500/20 border border-red-500/40 text-red-400 font-mono text-[9px] font-black uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                            <span>⚠️</span> <span>Malus {activePhysicalPower.icon}</span>
                          </span>
                        )}
                      </div>

                      {/* Crimson Correction Input */}
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="number"
                          placeholder="Points"
                          value={turnDeductionCrimson}
                          onChange={(e) => setTurnDeductionCrimson(e.target.value)}
                          className="w-full bg-slate-950 border border-[#2A2A2E]/60 text-[10px] text-white p-1 text-center font-bold focus:outline-none focus:border-red-500/50"
                        />
                        <button
                          type="button"
                          onClick={() => { handleDeductScore("crimson", Number(turnDeductionCrimson)); setTurnDeductionCrimson(""); }}
                          className="px-2 py-1 bg-red-950 hover:bg-red-900 border border-red-500/30 text-red-200 text-xs font-black cursor-pointer rounded-none"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => { handleAddScore("crimson", Number(turnDeductionCrimson)); setTurnDeductionCrimson(""); }}
                          className="px-2 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-200 text-xs font-black cursor-pointer rounded-none"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Cobalt Score Card */}
                    <div className="space-y-2 bg-blue-500/[0.02] border border-blue-500/10 p-2 relative">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-extrabold text-blue-400">🔵 Cobalt :</span>
                        <span className="font-mono text-xs text-white font-black">{teams.cobalt.score} pts</span>
                      </div>
                      
                      {/* Cobalt Badges */}
                      <div className="flex flex-wrap gap-1">
                        {teams.cobalt.shieldActive && (
                          <span className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/40 text-blue-300 font-mono text-[9px] font-black uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                            <span>🛡️</span> <span>Bouclier</span>
                          </span>
                        )}
                        {activePhysicalPower && activePhysicalPower.targetTeam === "cobalt" && (
                          <span className="px-1.5 py-0.5 bg-red-500/20 border border-red-500/40 text-red-400 font-mono text-[9px] font-black uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                            <span>⚠️</span> <span>Malus {activePhysicalPower.icon}</span>
                          </span>
                        )}
                      </div>

                      {/* Cobalt Correction Input */}
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="number"
                          placeholder="Points"
                          value={turnDeductionCobalt}
                          onChange={(e) => setTurnDeductionCobalt(e.target.value)}
                          className="w-full bg-slate-950 border border-[#2A2A2E]/60 text-[10px] text-white p-1 text-center font-bold focus:outline-none focus:border-blue-500/50"
                        />
                        <button
                          type="button"
                          onClick={() => { handleDeductScore("cobalt", Number(turnDeductionCobalt)); setTurnDeductionCobalt(""); }}
                          className="px-2 py-1 bg-blue-950 hover:bg-blue-900 border border-blue-500/30 text-blue-200 text-xs font-black cursor-pointer rounded-none"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => { handleAddScore("cobalt", Number(turnDeductionCobalt)); setTurnDeductionCobalt(""); }}
                          className="px-2 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-200 text-xs font-black cursor-pointer rounded-none"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Winner Buttons */}
                  <div className="space-y-1">
                    <span className="block text-[9px] font-mono text-slate-500 uppercase tracking-widest text-center">Déclarer le Vainqueur final</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenVictoryScreen("crimson")}
                        className="py-1.5 bg-gradient-to-r from-red-800 to-red-900 hover:from-red-700 hover:to-red-850 border border-red-500/40 text-white text-[10px] font-black uppercase tracking-wider rounded-none shadow-md cursor-pointer transition active:translate-y-0.5 text-center"
                      >
                        🔴 Victoire Crimson
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenVictoryScreen("cobalt")}
                        className="py-1.5 bg-gradient-to-r from-blue-800 to-blue-900 hover:from-blue-700 hover:to-blue-850 border border-blue-500/40 text-white text-[10px] font-black uppercase tracking-wider rounded-none shadow-md cursor-pointer transition active:translate-y-0.5 text-center"
                      >
                        🔵 Victoire Cobalt
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Journal d'Arène & Quit button */}
              <div className="bg-[#111114] border border-[#2A2A2E] p-3 flex flex-col justify-between h-[215px]">
                <div className="space-y-1 flex-1 flex flex-col min-h-0">
                  <span className="text-[10px] uppercase tracking-widest font-mono text-slate-500 border-b border-[#2A2A2E] pb-1 block shrink-0">⚔ Journal d'Arène</span>
                  <div className="overflow-y-auto pr-1 flex-1 space-y-1 text-[10px] leading-relaxed select-text mt-1.5 font-mono scrollbar-thin max-h-[135px]">
                    {gameLogs.map((log, index) => (
                      <div key={index} className="text-slate-300 border-l border-cosmic-accent/20 pl-1.5">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Voulez-vous abandonner le combat en équipe en cours ? Vos scores seront perdus.")) {
                      setStep("setup");
                    }
                  }}
                  className="w-full py-1.5 bg-slate-950 hover:bg-slate-900 border border-[#2A2A2E]/60 text-[9px] text-red-400 font-bold uppercase tracking-wider mt-2 shrink-0 cursor-pointer"
                >
                  Quitter l'Arène (Abandonner)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. FINISHED BATTLE & RECORDING SUBMIT STEP */}
      {step === "finished" && winningTeamColor && (
        <div className="p-8 bg-[#111114] border border-[#2A2A2E] rounded-none max-w-xl mx-auto space-y-6 text-center shadow-2xl relative overflow-hidden animate-fadeIn">
          {/* Neon crown accent */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-500 animate-pulse" />
          
          <div className="space-y-2">
            <span className="text-5xl block animate-bounce">👑🏆👑</span>
            <h2 className="text-2xl font-black font-display tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-200 to-yellow-500 uppercase">
              BATAILLE TERMINÉE !
            </h2>
            <p className="text-xs text-slate-300">
              L'arène vient d'élire ses maîtres du jour. Gloire aux guerriers !
            </p>
          </div>

          <div className="bg-slate-950 border border-[#2A2A2E] p-5 space-y-4">
            <div className="space-y-1.5">
              <span className="text-[10px] text-[#66666E] uppercase font-mono tracking-wider block">Équipe Triomphante</span>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWinningTeamColor("crimson");
                    const pList = distributedTeams.crimson;
                    if (pList && pList.length > 0) {
                      setWinningPlayerId(pList[0].id);
                    }
                    setOpponentScoreLeft(teams.cobalt.score);
                  }}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded-none cursor-pointer transition ${
                    winningTeamColor === "crimson"
                      ? "bg-red-500/10 border-red-500 text-red-400 font-black shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                      : "bg-[#111114]/40 border-[#2A2A2E] text-slate-400"
                  }`}
                >
                  🔴 Équipe Crimson
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWinningTeamColor("cobalt");
                    const pList = distributedTeams.cobalt;
                    if (pList && pList.length > 0) {
                      setWinningPlayerId(pList[0].id);
                    }
                    setOpponentScoreLeft(teams.crimson.score);
                  }}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded-none cursor-pointer transition ${
                    winningTeamColor === "cobalt"
                      ? "bg-blue-500/10 border-blue-500 text-blue-400 font-black shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                      : "bg-[#111114]/40 border-[#2A2A2E] text-slate-400"
                  }`}
                >
                  🔵 Équipe Cobalt
                </button>
              </div>
            </div>

            <div className="border-t border-[#2A2A2E]/50 pt-3 space-y-1 bg-amber-500/[0.02] p-2 border border-amber-500/10">
              <span className="text-xs font-extrabold text-amber-400 flex items-center justify-center gap-1.5 uppercase font-display">
                💰 Bourse de PX en jeu : {bountyXP} PX
              </span>
              <span className="block text-[10px] text-slate-400 leading-normal">
                Partagée équitablement entre les coéquipiers : chaque membre empoche <strong className="text-white">+{Math.floor(bountyXP / distributedTeams[winningTeamColor].length)} PX</strong> !
              </span>
            </div>
            
            <div className="flex justify-center gap-2 flex-wrap pt-2">
              {distributedTeams[winningTeamColor].map(p => {
                const isFinalThrow = p.id === winningPlayerId;
                const share = Math.floor(bountyXP / distributedTeams[winningTeamColor].length);
                return (
                  <div key={p.id} className="px-3 py-2 bg-[#111114] border border-[#2A2A2E] text-xs font-bold text-white flex flex-col items-center gap-1 min-w-[120px]">
                    <span className="flex items-center gap-1">
                      👤 {p.name} {isFinalThrow && <span className="text-amber-400 font-bold" title="Lancer gagnant">🎯</span>}
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono font-bold">+{share} PX (Bourse)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Record Options Form */}
          <div className="space-y-4 bg-[#0A0A0C] border border-[#2A2A2E]/60 p-4 text-left">
            <h4 className="text-xs uppercase font-extrabold tracking-wider font-display text-slate-300">Enregistrement au Championnat</h4>
            <p className="text-[10px] text-slate-550 leading-relaxed">
              Enregistrez le match pour distribuer de l'XP de guilde et de saison. 
              Le joueur ayant porté le coup fatal (vainqueur principal) obtiendra le bonus d'XP du finish, 
              son coéquipier obtiendra la médaille Poulidor et l'XP de soutien !
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="space-y-2">
                <label className="block text-[10px] uppercase text-slate-400 font-bold tracking-wider font-sans">Buteur final :</label>
                <select
                  value={winningPlayerId || ""}
                  onChange={(e) => setWinningPlayerId(Number(e.target.value))}
                  className="w-full bg-[#111114] border border-[#2A2A2E] text-xs text-white p-2 focus:outline-none rounded-none cursor-pointer font-bold"
                >
                  {distributedTeams[winningTeamColor].map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] uppercase text-slate-400 font-bold tracking-wider font-sans">Type de fermeture :</label>
                <select
                  value={winnerFinishType}
                  onChange={(e) => setWinnerFinishType(e.target.value as FinishType)}
                  className="w-full bg-[#111114] border border-[#2A2A2E] text-xs text-white p-2 focus:outline-none rounded-none cursor-pointer font-bold"
                >
                  <option value="SIMPLE">🎯 SIMPLE (x1)</option>
                  <option value="DOUBLE">✖️2 DOUBLE (x2)</option>
                  <option value="TRIPLE">✖️3 TRIPLE (x3)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] uppercase text-slate-400 font-bold tracking-wider font-sans">
                  Reste adverse ({winningTeamColor === "crimson" ? "Cobalt 🔵" : "Crimson 🔴"}) :
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={opponentScoreLeft !== 0 ? opponentScoreLeft : ""}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, "");
                    const val = clean === "" ? 0 : Number(clean);
                    setOpponentScoreLeft(val);
                  }}
                  onBlur={() => {
                    setOpponentScoreLeft(prev => Math.max(1, Math.min(startingScore, prev || 1)));
                  }}
                  className="w-full bg-[#111114] border border-[#2A2A2E] text-xs text-white p-2 focus:outline-none focus:border-amber-500/50 rounded-none font-bold"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={() => {
                if (confirm("Êtes-vous sûr de vouloir ignorer l'enregistrement ? Le match ne sera pas comptabilisé.")) {
                  setStep("setup");
                  setSelectedIds([]);
                  setWinningTeamColor(null);
                  setWinningPlayerId(null);
                }
              }}
              className="px-4 py-3 border border-[#2A2A2E] text-xs font-bold text-slate-400 hover:text-white rounded-none cursor-pointer uppercase tracking-wider"
            >
              Ignorer
            </button>
            <button
              onClick={handleRecordMatchToDatabase}
              disabled={recordingLoading}
              className="px-6 py-3 bg-gradient-to-r from-cosmic-accent to-[#8E1E1E] text-white font-extrabold text-xs uppercase tracking-wider rounded-none cursor-pointer shadow-lg border border-cosmic-accent/30 flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {recordingLoading ? "Enregistrement..." : "Enregistrer au Championnat"}
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Alerts inside the component */}
      <AnimatePresence>
        {alertText && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={`fixed bottom-28 md:bottom-8 right-4 left-4 md:left-auto z-50 p-4 border rounded-none flex items-center gap-2.5 max-w-sm shadow-xl pointer-events-auto leading-relaxed select-text ${
              alertText.type === "ok"
                ? "bg-emerald-950/50 border-emerald-500/35 text-emerald-300"
                : alertText.type === "err"
                ? "bg-red-950/50 border-red-500/35 text-red-300"
                : "bg-blue-950/50 border-blue-500/35 text-blue-300"
            }`}
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-xs font-bold leading-normal">{alertText.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
