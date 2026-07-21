import { Player, Season, Match, Guild, MatchParticipant, MatchLog } from "./types";
import { getPlayersCareerXPs, getSeasonPlayerXPs, calculateGuildRank, calculateMatchResults } from "./scoring";

// Firebase imports
import { initializeApp } from "firebase/app";
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDocFromServer, initializeFirestore, writeBatch } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Error handling types and helper as specified by instructions
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function areParticipantsEqual(a: MatchParticipant[] | undefined | null, b: MatchParticipant[] | undefined | null): boolean {
  const arrA = a || [];
  const arrB = b || [];
  if (arrA.length !== arrB.length) return false;
  for (let i = 0; i < arrA.length; i++) {
    const pa = arrA[i];
    const pb = arrB[i];
    if (!pa || !pb) {
      if (pa !== pb) return false;
      continue;
    }
    if (pa.playerId !== pb.playerId) return false;
    if (pa.rank !== pb.rank) return false;
    if (pa.scoreLeft !== pb.scoreLeft) return false;
    if (pa.xpBefore !== pb.xpBefore) return false;
    if (pa.xpEarned !== pb.xpEarned) return false;
    if (pa.xpBonusLotteryEarned !== pb.xpBonusLotteryEarned) return false;
    if (pa.finishType !== pb.finishType) return false;
    
    const medalsA = pa.medals || [];
    const medalsB = pb.medals || [];
    if (medalsA.length !== medalsB.length) return false;
    const sortedA = [...medalsA].sort();
    const sortedB = [...medalsB].sort();
    for (let j = 0; j < sortedA.length; j++) {
      if (sortedA[j] !== sortedB[j]) return false;
    }
  }
  return true;
}

function cleanUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

const STORAGE_KEY = "dartos_db_v1";

interface DatabaseState {
  players: Player[];
  seasons: Season[];
  matches: Match[];
  guilds: Guild[];
  adminPassword?: string;
  matchLogs?: MatchLog[];
}

// Initial seeding data
const INITIAL_STATE: DatabaseState = {
  adminPassword: "admin", // Default admin password
  players: [],
  seasons: [],
  matches: [],
  guilds: [],
  matchLogs: []
};

class DartosDB {
  private state: DatabaseState;
  private listeners: (() => void)[] = [];
  private notifyTimeout: any = null;

  constructor() {
    // 1. Initialise with localStorage cached values first to build fast-boot capability
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        this.state = JSON.parse(raw);
        if (!this.state.players) this.state.players = [];
        if (!this.state.seasons) this.state.seasons = [];
        if (!this.state.matches) this.state.matches = [];
        this.state.matches.forEach(m => {
          m.participants = (m.participants || []).map(p => ({
            ...p,
            playerId: Number(p.playerId),
            rank: Number(p.rank),
            scoreLeft: p.scoreLeft !== null && p.scoreLeft !== undefined ? Number(p.scoreLeft) : null,
            xpBefore: Number(p.xpBefore),
            xpEarned: Number(p.xpEarned),
            xpBonusLotteryEarned: p.xpBonusLotteryEarned !== undefined && p.xpBonusLotteryEarned !== null ? Number(p.xpBonusLotteryEarned) : undefined,
          }));
        });
        if (!this.state.guilds) this.state.guilds = [];
        this.state.guilds.forEach(g => {
          if (!g.memberIds) g.memberIds = [];
        });
        if (!this.state.matchLogs) this.state.matchLogs = [];
        if (!this.state.adminPassword) this.state.adminPassword = "admin";
      } catch (e) {
        this.state = { ...INITIAL_STATE };
        this.saveLocalAndNotify();
      }
    } else {
      this.state = { ...INITIAL_STATE };
      this.saveLocalAndNotify();
    }

    // 2. Hydrate realtime updates from Firestore
    this.setupListeners();

    // 3. Test Connection
    this.testConnection();
  }

  private async testConnection() {
    try {
      await getDocFromServer(doc(db, 'players', '1'));
    } catch (error) {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
      }
    }
  }

  private setupListeners() {
    // Players query snapshot
    onSnapshot(collection(db, "players"), (snap) => {
      const players: Player[] = [];
      snap.forEach(d => {
        const p = d.data() as Player;
        if (p) {
          players.push(p);
        }
      });
      // If Firestore is empty but we have our initial memory state,
      // let's keep the memory state rather than wiping it right away.
      if (players.length === 0 && !localStorage.getItem(STORAGE_KEY)) {
        return;
      }
      this.state.players = players.sort((a,b) => a.id - b.id);
      this.saveLocalAndNotify();
    }, (error) => {
      console.warn("Firestore players onSnapshot error: ", error);
    });

    // Seasons query snapshot
    onSnapshot(collection(db, "seasons"), (snap) => {
      const seasons: Season[] = [];
      snap.forEach(d => {
        const s = d.data() as Season;
        if (s) {
          seasons.push(s);
        }
      });
      this.state.seasons = seasons.sort((a,b) => a.id - b.id);
      this.saveLocalAndNotify();
    }, (error) => {
      console.warn("Firestore seasons onSnapshot error: ", error);
    });

    // Matches query snapshot
    onSnapshot(collection(db, "matches"), (snap) => {
      const matches: Match[] = [];
      snap.forEach(d => {
        const m = d.data() as Match;
        if (m) {
          m.participants = (m.participants || []).map(p => ({
            ...p,
            playerId: Number(p.playerId),
            rank: Number(p.rank),
            scoreLeft: p.scoreLeft !== null && p.scoreLeft !== undefined ? Number(p.scoreLeft) : null,
            xpBefore: Number(p.xpBefore),
            xpEarned: Number(p.xpEarned),
            xpBonusLotteryEarned: p.xpBonusLotteryEarned !== undefined && p.xpBonusLotteryEarned !== null ? Number(p.xpBonusLotteryEarned) : undefined,
          }));
          matches.push(m);
        }
      });
      this.state.matches = matches.sort((a,b) => a.id - b.id);
      this.saveLocalAndNotify();
    }, (error) => {
      console.warn("Firestore matches onSnapshot error: ", error);
    });

    // Guilds query snapshot
    onSnapshot(collection(db, "guilds"), (snap) => {
      const guilds: Guild[] = [];
      snap.forEach(d => {
        const g = d.data() as Guild;
        if (g) {
          g.memberIds = g.memberIds || [];
          guilds.push(g);
        }
      });
      this.state.guilds = guilds.sort((a,b) => a.id - b.id);
      this.saveLocalAndNotify();
    }, (error) => {
      console.warn("Firestore guilds onSnapshot error: ", error);
    });

    // MatchLogs query snapshot
    onSnapshot(collection(db, "matchLogs"), (snap) => {
      const logs: MatchLog[] = [];
      snap.forEach(d => {
        const l = d.data() as MatchLog;
        if (l) {
          logs.push(l);
        }
      });
      this.state.matchLogs = logs.sort((a,b) => b.timestamp.localeCompare(a.timestamp));
      this.saveLocalAndNotify();
    }, (error) => {
      console.warn("Firestore matchLogs onSnapshot error: ", error);
    });

    // AdminSettings document snapshot
    onSnapshot(doc(db, "adminSettings", "config"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        this.state.adminPassword = data.adminPassword || "admin";
        this.saveLocalAndNotify();
      } else {
        // Safe creation of admin config without seeding any collections with mock objects
        setDoc(doc(db, "adminSettings", "config"), { adminPassword: "admin" }).catch(e => {
          console.warn("Error setting default admin password in Firestore", e);
        });
      }
    }, (error) => {
      console.warn("Firestore adminSettings config onSnapshot error: ", error);
    });
  }

  private saveLocalAndNotify() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.notify();
  }

  subscribe(callback: () => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify() {
    if (this.notifyTimeout) {
      clearTimeout(this.notifyTimeout);
    }
    this.notifyTimeout = setTimeout(() => {
      this.listeners.forEach(l => l());
      this.notifyTimeout = null;
    }, 50);
  }

  // --- Admin ---
  getAdminPassword(): string {
    return this.state.adminPassword || "admin";
  }

  async setAdminPassword(psw: string) {
    const cleanPassword = psw.trim() || "admin";
    try {
      await setDoc(doc(db, "adminSettings", "config"), { adminPassword: cleanPassword });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "adminSettings/config");
    }
    this.state.adminPassword = cleanPassword;
    this.saveLocalAndNotify();
  }

  // --- Backup & Restore ---
  getBackupJSON(): string {
    const backup = {
      version: 1,
      timestamp: new Date().toISOString(),
      data: {
        players: this.state.players,
        seasons: this.state.seasons,
        matches: this.state.matches,
        guilds: this.state.guilds,
        adminPassword: this.state.adminPassword,
        matchLogs: this.state.matchLogs || []
      }
    };
    return JSON.stringify(backup, null, 2);
  }

  async restoreBackup(backupContent: string): Promise<void> {
    let parsed: any;
    try {
      parsed = JSON.parse(backupContent);
    } catch (e) {
      throw new Error("Le fichier backup n'est pas un JSON valide.");
    }

    if (!parsed || parsed.version !== 1 || !parsed.data) {
      throw new Error("Format de sauvegarde invalide ou version non supportée.");
    }

    const { players, seasons, matches, guilds, adminPassword, matchLogs } = parsed.data;

    if (!Array.isArray(players) || !Array.isArray(seasons) || !Array.isArray(matches) || !Array.isArray(guilds)) {
      throw new Error("Les données de sauvegarde sont incomplètes ou corrompues.");
    }

    // Prepare arrays
    const newPlayers = players as Player[];
    const newSeasons = seasons as Season[];
    const newMatches = matches as Match[];
    const newGuilds = guilds as Guild[];
    const newMatchLogs = Array.isArray(matchLogs) ? (matchLogs as MatchLog[]) : [];

    // 1. Delete all existing docs in current memory state to clear Firestore
    const deleteBatch = writeBatch(db);
    
    // We clean players
    for (const p of this.state.players) {
      deleteBatch.delete(doc(db, "players", p.id.toString()));
    }
    // We clean seasons
    for (const s of this.state.seasons) {
      deleteBatch.delete(doc(db, "seasons", s.id.toString()));
    }
    // We clean matches
    for (const m of this.state.matches) {
      deleteBatch.delete(doc(db, "matches", m.id.toString()));
    }
    // We clean guilds
    for (const g of this.state.guilds) {
      deleteBatch.delete(doc(db, "guilds", g.id.toString()));
    }
    // We clean matchLogs
    if (this.state.matchLogs) {
      for (const l of this.state.matchLogs) {
        deleteBatch.delete(doc(db, "matchLogs", l.id));
      }
    }

    try {
      await deleteBatch.commit();
    } catch (error) {
      console.warn("Erreur lors du nettoyage de la base de données: ", error);
    }

    // 2. Upload new records using writeBatches (chunked by 100 to stay under Firestore batch limits of 500)
    let currentBatch = writeBatch(db);
    let countInBatch = 0;

    const commitBatchIfNeeded = async (force = false) => {
      if (countInBatch >= 200 || (force && countInBatch > 0)) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        countInBatch = 0;
      }
    };

    // Add players
    for (const p of newPlayers) {
      currentBatch.set(doc(db, "players", p.id.toString()), p);
      countInBatch++;
      await commitBatchIfNeeded();
    }

    // Add seasons
    for (const s of newSeasons) {
      currentBatch.set(doc(db, "seasons", s.id.toString()), s);
      countInBatch++;
      await commitBatchIfNeeded();
    }

    // Add matches
    for (const m of newMatches) {
      currentBatch.set(doc(db, "matches", m.id.toString()), m);
      countInBatch++;
      await commitBatchIfNeeded();
    }

    // Add guilds
    for (const g of newGuilds) {
      currentBatch.set(doc(db, "guilds", g.id.toString()), g);
      countInBatch++;
      await commitBatchIfNeeded();
    }

    // Add matchLogs
    for (const l of newMatchLogs) {
      currentBatch.set(doc(db, "matchLogs", l.id), l);
      countInBatch++;
      await commitBatchIfNeeded();
    }

    // Add admin password if supplied
    if (adminPassword) {
      currentBatch.set(doc(db, "adminSettings", "config"), { adminPassword: adminPassword.trim() || "admin" });
      countInBatch++;
    }

    // Final commit
    await commitBatchIfNeeded(true);

    // Save locally and refresh memory state
    this.state.players = newPlayers.sort((a,b) => a.id - b.id);
    this.state.seasons = newSeasons.sort((a,b) => a.id - b.id);
    this.state.matches = newMatches.sort((a,b) => a.id - b.id);
    this.state.guilds = newGuilds.sort((a,b) => a.id - b.id);
    this.state.matchLogs = newMatchLogs.sort((a,b) => b.timestamp.localeCompare(a.timestamp));
    if (adminPassword) {
      this.state.adminPassword = adminPassword;
    }
    this.saveLocalAndNotify();
  }

  // --- MatchLogs ---
  getMatchLogs(): MatchLog[] {
    return this.state.matchLogs || [];
  }

  async addMatchLog(matchId: number, action: MatchLog["action"], details: string, author?: string): Promise<void> {
    const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const log: MatchLog = {
      id,
      matchId,
      action,
      timestamp: new Date().toISOString(),
      details,
      author: author || "Système"
    };

    try {
      await setDoc(doc(db, "matchLogs", id), cleanUndefined(log));
    } catch (error) {
      console.warn("Failed to save match log to Firestore: ", error);
    }

    if (!this.state.matchLogs) this.state.matchLogs = [];
    this.state.matchLogs.unshift(log);
    this.saveLocalAndNotify();
  }

  // --- Players ---
  getPlayers(): Player[] {
    return this.state.players;
  }

  async createPlayer(name: string): Promise<Player> {
    const exists = this.state.players.some(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (exists) {
      throw new Error("Un joueur avec ce nom existe déjà");
    }
    const maxId = this.state.players.reduce((max, p) => p.id > max ? p.id : max, 0);
    const player: Player = {
      id: maxId + 1,
      name: name.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "players", player.id.toString()), cleanUndefined(player));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `players/${player.id}`);
    }

    this.state.players.push(player);
    this.saveLocalAndNotify();
    return player;
  }

  async updatePlayer(id: number, name: string): Promise<Player> {
    const player = this.state.players.find(p => p.id === id);
    if (!player) throw new Error("Joueur introuvable");

    const exists = this.state.players.some(p => p.id !== id && p.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (exists) {
      throw new Error("Un joueur avec ce nom existe déjà");
    }

    const updated = {
      ...player,
      name: name.trim()
    };

    try {
      await setDoc(doc(db, "players", id.toString()), cleanUndefined(updated));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `players/${id}`);
    }

    player.name = name.trim();
    this.saveLocalAndNotify();
    return player;
  }

  // --- Seasons ---
  getSeasons(): Season[] {
    return [...this.state.seasons].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async createSeason(season: Omit<Season, "id">): Promise<Season> {
    const exists = this.state.seasons.some(s => s.name.trim().toLowerCase() === season.name.trim().toLowerCase());
    if (exists) {
      throw new Error("Une saison avec ce nom existe déjà");
    }
    const maxId = this.state.seasons.reduce((max, s) => s.id > max ? s.id : max, 0);
    const newSeason: Season = {
      ...season,
      id: maxId + 1
    };

    try {
      await setDoc(doc(db, "seasons", newSeason.id.toString()), cleanUndefined(newSeason));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `seasons/${newSeason.id}`);
    }

    this.state.seasons.push(newSeason);
    this.saveLocalAndNotify();
    return newSeason;
  }

  async updateSeason(id: number, seasonData: Partial<Omit<Season, "id">>): Promise<{ season: Season; matchesRecalculated: number }> {
    const index = this.state.seasons.findIndex(s => s.id === id);
    if (index === -1) throw new Error("Saison introuvable");

    if (seasonData.name) {
      const exists = this.state.seasons.some(s => s.id !== id && s.name.trim().toLowerCase() === seasonData.name!.trim().toLowerCase());
      if (exists) {
        throw new Error("Une saison avec ce nom existe déjà");
      }
    }

    const updated = {
      ...this.state.seasons[index],
      ...seasonData
    } as Season;

    try {
      await setDoc(doc(db, "seasons", id.toString()), cleanUndefined(updated));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `seasons/${id}`);
    }

    this.state.seasons[index] = updated;
    this.saveLocalAndNotify();

    // Trigger auto-recalculation of all matches in this season
    const matchesRecalculated = await this.recalculateSeasonMatches(id);
    return { season: updated, matchesRecalculated };
  }

  async deleteSeason(id: number) {
    const sIndex = this.state.seasons.findIndex(s => s.id === id);
    if (sIndex === -1) throw new Error("Saison introuvable");

    const matchesToRemove = this.state.matches.filter(m => m.seasonId === id);

    try {
      await deleteDoc(doc(db, "seasons", id.toString()));
      for (const m of matchesToRemove) {
        await deleteDoc(doc(db, "matches", m.id.toString()));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `seasons/${id}`);
    }

    this.state.seasons.splice(sIndex, 1);
    this.state.matches = this.state.matches.filter(m => m.seasonId !== id);
    this.saveLocalAndNotify();
  }

  // --- Matches ---
  getMatches(seasonId?: number): Match[] {
    const filtered = seasonId ? this.state.matches.filter(m => m.seasonId === seasonId) : this.state.matches;
    return [...filtered].sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
  }

  private getMatchDetailsString(participants: MatchParticipant[]): string {
    return (participants || []).map(p => {
      const pName = this.state.players.find(pl => pl.id === p.playerId)?.name || `Joueur #${p.playerId}`;
      const scoreDetail = p.scoreLeft !== null && p.scoreLeft !== undefined ? ` (score resté: ${p.scoreLeft})` : ' (Gagnant)';
      return `${pName}${scoreDetail} [Rang ${p.rank}]: +${p.xpEarned} XP`;
    }).join("; ");
  }

  async recordMatch(match: Omit<Match, "id">, author?: string): Promise<Match> {
    const maxId = this.state.matches.reduce((max, m) => m.id > max ? m.id : max, 0);
    const newMatch: Match = {
      ...match,
      id: maxId + 1
    };

    try {
      await setDoc(doc(db, "matches", newMatch.id.toString()), cleanUndefined(newMatch));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${newMatch.id}`);
    }

    this.state.matches.push(newMatch);

    // Save locally and notify first so state contains player data for log formatting
    this.saveLocalAndNotify();

    // Create match log
    const details = `Match #${newMatch.id} créé. Participants: ${this.getMatchDetailsString(newMatch.participants)}`;
    await this.addMatchLog(newMatch.id, "CREATE", details, author);
    
    return newMatch;
  }

  async updateMatch(id: number, updatedData: Omit<Match, "id">, author?: string): Promise<Match> {
    const index = this.state.matches.findIndex(m => m.id === id);
    if (index === -1) throw new Error("Match introuvable");
    
    // Deep copy of old state
    const oldMatch = JSON.parse(JSON.stringify(this.state.matches[index])) as Match;

    const updated: Match = {
      ...updatedData,
      id
    };

    try {
      await setDoc(doc(db, "matches", id.toString()), cleanUndefined(updated));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${id}`);
    }

    this.state.matches[index] = updated;

    // Auto-recalculate season to propagate consecutive wins and updated xpBefore correctly
    await this.recalculateSeasonMatches(updated.seasonId);

    this.saveLocalAndNotify();

    const recalculatedMatch = this.state.matches.find(m => m.id === id) || updated;

    // Detailed difference tracking payload
    const diffData = {
      type: "update_diff",
      playedAt: {
        before: oldMatch.playedAt,
        after: recalculatedMatch.playedAt
      },
      participants: {
        before: oldMatch.participants.map(p => {
          const name = this.state.players.find(pl => pl.id === p.playerId)?.name || `Joueur #${p.playerId}`;
          return {
            playerId: p.playerId,
            name,
            rank: p.rank,
            scoreLeft: p.scoreLeft,
            xpEarned: p.xpEarned,
            finishType: p.finishType,
            medals: p.medals || []
          };
        }),
        after: recalculatedMatch.participants.map(p => {
          const name = this.state.players.find(pl => pl.id === p.playerId)?.name || `Joueur #${p.playerId}`;
          return {
            playerId: p.playerId,
            name,
            rank: p.rank,
            scoreLeft: p.scoreLeft,
            xpEarned: p.xpEarned,
            finishType: p.finishType,
            medals: p.medals || []
          };
        })
      }
    };

    const details = JSON.stringify(diffData);
    await this.addMatchLog(id, "UPDATE", details, author);

    return recalculatedMatch;
  }

  async deleteMatch(id: number, author?: string) {
    const index = this.state.matches.findIndex(m => m.id === id);
    if (index === -1) throw new Error("Match introuvable");

    const matchToDelete = this.state.matches[index];
    const seasonId = matchToDelete.seasonId;

    try {
      await deleteDoc(doc(db, "matches", id.toString()));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `matches/${id}`);
    }

    this.state.matches.splice(index, 1);

    // Auto-recalculate season to propagate consecutive wins and updated xpBefore correctly
    await this.recalculateSeasonMatches(seasonId);

    this.saveLocalAndNotify();

    // Create match log
    const details = `Match #${id} supprimé de la saison #${seasonId}. Participants d'origine: ${this.getMatchDetailsString(matchToDelete.participants)}`;
    await this.addMatchLog(id, "DELETE", details, author);
  }

  // --- Tombola update ---
  async updateLotteryGains(matchId: number, playerGains: { playerId: number; xpBonus: number; emojis: string[] }[], author?: string): Promise<Match> {
    const match = this.state.matches.find(m => m.id === matchId);
    if (!match) throw new Error("Match introuvable");

    const cloned = JSON.parse(JSON.stringify(match)) as Match;

    playerGains.forEach(gain => {
      const p = (cloned.participants || []).find(part => part.playerId === gain.playerId);
      if (p) {
        p.xpEarned += gain.xpBonus;
        p.xpBonusLotteryEarned = (p.xpBonusLotteryEarned || 0) + gain.xpBonus;
        
        const currentMedals = p.medals || [];
        gain.emojis.forEach(emoji => {
          const medalStr = `LOTTERY_WINNER:${emoji}`;
          if (!currentMedals.includes(medalStr)) {
            currentMedals.push(medalStr);
          }
        });
        p.medals = currentMedals;
      }
    });

    try {
      await setDoc(doc(db, "matches", matchId.toString()), cleanUndefined(cloned));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${matchId}`);
    }

    const idx = this.state.matches.findIndex(m => m.id === matchId);
    if (idx !== -1) {
      this.state.matches[idx] = cloned;
    }
    this.saveLocalAndNotify();

    // Create match log for lottery claim
    const gainsSummary = playerGains.map(g => {
      const pName = this.state.players.find(pl => pl.id === g.playerId)?.name || `Joueur #${g.playerId}`;
      return `${pName}: +${g.xpBonus} XP (${g.emojis.join("")})`;
    }).join("; ");
    const details = `Gains de tombola appliqués au Match #${matchId}. Détails: ${gainsSummary}`;
    await this.addMatchLog(matchId, "LOTTERY_CLAIM", details, author);

    return cloned;
  }

  // --- Guilds ---
  getGuilds(): Guild[] {
    return this.state.guilds;
  }

  async createGuild(payload: { name: string; badgeIcon: string; badgeColor: string; password?: string; creatorId?: number }): Promise<Guild> {
    const exists = this.state.guilds.some(g => g.name.trim().toLowerCase() === payload.name.trim().toLowerCase());
    if (exists) {
      throw new Error("Une guilde avec ce nom existe déjà");
    }
    const maxId = this.state.guilds.reduce((max, g) => g.id > max ? g.id : max, 0);
    const guild: Guild = {
      id: maxId + 1,
      name: payload.name.trim(),
      badgeIcon: payload.badgeIcon.trim(),
      badgeColor: payload.badgeColor.trim(),
      createdAt: new Date().toISOString(),
      memberIds: [],
      password: payload.password?.trim() || "",
      creatorId: payload.creatorId ? Number(payload.creatorId) : undefined
    };

    try {
      await setDoc(doc(db, "guilds", guild.id.toString()), cleanUndefined(guild));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `guilds/${guild.id}`);
    }

    this.state.guilds.push(guild);
    this.saveLocalAndNotify();
    return guild;
  }

  async updateGuild(id: number, payload: { name?: string; badgeIcon?: string; badgeColor?: string; password?: string; creatorId?: number }): Promise<Guild> {
    const guild = this.state.guilds.find(g => g.id === id);
    if (!guild) throw new Error("Guilde introuvable");

    const cloned = { ...guild };

    if (payload.name) {
      const exists = this.state.guilds.some(g => g.id !== id && g.name.trim().toLowerCase() === payload.name!.trim().toLowerCase());
      if (exists) {
        throw new Error("Une guilde avec ce nom existe déjà");
      }
      cloned.name = payload.name.trim();
    }
    if (payload.badgeIcon) cloned.badgeIcon = payload.badgeIcon.trim();
    if (payload.badgeColor) cloned.badgeColor = payload.badgeColor.trim();
    if (payload.password !== undefined) cloned.password = payload.password.trim();
    if (payload.creatorId !== undefined) cloned.creatorId = payload.creatorId ? Number(payload.creatorId) : undefined;

    try {
      await setDoc(doc(db, "guilds", id.toString()), cleanUndefined(cloned));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `guilds/${id}`);
    }

    Object.assign(guild, cloned);
    this.saveLocalAndNotify();
    return guild;
  }

  async deleteGuild(id: number) {
    const index = this.state.guilds.findIndex(g => g.id === id);
    if (index === -1) throw new Error("Guilde introuvable");

    try {
      await deleteDoc(doc(db, "guilds", id.toString()));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `guilds/${id}`);
    }

    this.state.guilds.splice(index, 1);
    this.saveLocalAndNotify();
  }

  async joinGuild(guildId: number, playerId: number): Promise<Guild> {
    const guild = this.state.guilds.find(g => g.id === guildId);
    if (!guild) throw new Error("Guilde introuvable");

    // Players can only be in one guild at a time
    const updatedGuilds = this.state.guilds.map(g => {
      const updated = { ...g, memberIds: g.memberIds || [] };
      if (g.id === guildId) {
        if (!updated.memberIds.includes(playerId)) {
          updated.memberIds = [...updated.memberIds, playerId];
        }
      } else {
        updated.memberIds = updated.memberIds.filter(id => id !== playerId);
      }
      return updated;
    });

    try {
      for (const g of updatedGuilds) {
        await setDoc(doc(db, "guilds", g.id.toString()), cleanUndefined(g));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `guilds/${guildId}`);
    }

    this.state.guilds = updatedGuilds;
    this.saveLocalAndNotify();
    return this.state.guilds.find(g => g.id === guildId)!;
  }

  async leaveGuild(guildId: number, playerId: number): Promise<Guild> {
    const guild = this.state.guilds.find(g => g.id === guildId);
    if (!guild) throw new Error("Guilde introuvable");

    const cloned = { ...guild, memberIds: guild.memberIds || [] };
    cloned.memberIds = cloned.memberIds.filter(id => id !== playerId);

    try {
      await setDoc(doc(db, "guilds", guildId.toString()), cleanUndefined(cloned));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `guilds/${guildId}`);
    }

    guild.memberIds = cloned.memberIds;
    this.saveLocalAndNotify();
    return guild;
  }

  // --- Calculations & Auto-Recalculate engine ---
  async recalculateSeasonMatches(seasonId: number): Promise<number> {
    const season = this.state.seasons.find(s => s.id === seasonId);
    if (!season) return 0;

    const seasonMatches = this.state.matches
      .filter(m => m.seasonId === seasonId)
      .sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());

    if (seasonMatches.length === 0) return 0;

    const allMatches = [...this.state.matches].sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());

    const simulatedCareerXPs = new Map<number, number>();
    const simulatedSeasonXPs = new Map<number, number>();

    // Pre-initialize all players with 0 XP for seasonal stats
    const allPlayers = this.getPlayers();
    allPlayers.forEach(p => {
      simulatedSeasonXPs.set(p.id, 0);
    });

    const firstSeasonMatchTime = new Date(seasonMatches[0].playedAt).getTime();
    const priorMatches = allMatches.filter(m => new Date(m.playedAt).getTime() < firstSeasonMatchTime);

    for (const pm of priorMatches) {
      if (pm.excluded) continue;
      for (const part of pm.participants || []) {
        const cur = simulatedCareerXPs.get(part.playerId) || 0;
        simulatedCareerXPs.set(part.playerId, cur + part.xpEarned);

        if (pm.seasonId === seasonId) {
          const curSeason = simulatedSeasonXPs.get(part.playerId) || 0;
          simulatedSeasonXPs.set(part.playerId, curSeason + part.xpEarned);
        }
      }
    }

    const matchesToUpdate: Match[] = [];

    for (const m of seasonMatches) {
      if (m.excluded) {
        const originalParticipants = m.participants || [];
        const updatedParticipants = originalParticipants.map(p => ({
          ...p,
          xpEarned: 0,
          medals: []
        }));
        const hasChanged = !areParticipantsEqual(originalParticipants, updatedParticipants);
        m.participants = updatedParticipants;
        if (hasChanged) {
          matchesToUpdate.push(m);
        }
        continue;
      }

      const winnerPart = (m.participants || []).find(p => p.rank === 1);
      const loserParts = (m.participants || []).filter(p => p.rank > 1);

      if (!winnerPart) continue;

      const winnerId = winnerPart.playerId;
      const finishType = winnerPart.finishType || "SIMPLE";

      const losers = loserParts.map(lp => ({
        playerId: lp.playerId,
        scoreLeft: lp.scoreLeft ?? 50
      }));

      const winnerCareerXPBefore = simulatedCareerXPs.get(winnerId) || 0;
      const loserXPBeforeMap = new Map<number, number>();
      losers.forEach(l => {
        loserXPBeforeMap.set(l.playerId, simulatedCareerXPs.get(l.playerId) || 0);
      });

      const currentIndexInSeason = seasonMatches.findIndex(match => match.id === m.id);
      let consecutiveWins = 0;
      for (let i = currentIndexInSeason - 1; i >= 0; i--) {
        const prevMatch = seasonMatches[i];
        if (prevMatch.excluded) continue;
        const participants = prevMatch.participants || [];
        const participated = participants.some(p => p.playerId === winnerId);
        if (participated) {
          const prevWinner = participants.find(p => p.rank === 1);
          if (prevWinner && prevWinner.playerId === winnerId) {
            consecutiveWins++;
          } else {
            break;
          }
        }
      }

      // Clone simulatedSeasonXPs before caller to represent season XP before the match
      const seasonXPBeforeMap = new Map(simulatedSeasonXPs);

      const recalculated = calculateMatchResults(
        winnerId,
        finishType,
        losers,
        winnerCareerXPBefore,
        loserXPBeforeMap,
        season,
        consecutiveWins,
        seasonXPBeforeMap
      );

      const originalParticipants = m.participants || [];
      const updatedParticipants = originalParticipants.map(p => {
        const recalc = recalculated.find(r => r.playerId === p.playerId);
        if (!recalc) return p;

        const lotteryBonus = p.xpBonusLotteryEarned || 0;

        const finalMedals = [...(recalc.medals || [])];
        const existingLotteryMedals = (p.medals || []).filter(med => med.startsWith("LOTTERY_WINNER:"));
        existingLotteryMedals.forEach(lotm => {
          if (!finalMedals.includes(lotm)) {
            finalMedals.push(lotm);
          }
        });

        return {
          ...p,
          xpBefore: recalc.xpBefore,
          xpEarned: recalc.xpEarned + lotteryBonus,
          medals: finalMedals
        };
      });

      const hasChanged = !areParticipantsEqual(originalParticipants, updatedParticipants);
      m.participants = updatedParticipants;

      for (const p of m.participants || []) {
        simulatedCareerXPs.set(p.playerId, (simulatedCareerXPs.get(p.playerId) || 0) + p.xpEarned);
        simulatedSeasonXPs.set(p.playerId, (simulatedSeasonXPs.get(p.playerId) || 0) + p.xpEarned);
      }

      // Collect changes to write to Firestore ONLY if they actually changed
      if (hasChanged) {
        matchesToUpdate.push(m);
      }
    }

    if (matchesToUpdate.length > 0) {
      try {
        // Chunk write operations in batches of 100
        const chunkSize = 100;
        for (let i = 0; i < matchesToUpdate.length; i += chunkSize) {
          const chunk = matchesToUpdate.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          chunk.forEach(m => {
            batch.set(doc(db, "matches", m.id.toString()), cleanUndefined(m));
          });
          await batch.commit();
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `matches/recalculate-batch`);
      }
    }

    this.saveLocalAndNotify();
    return seasonMatches.length;
  }
}

export const dbStore = new DartosDB();
