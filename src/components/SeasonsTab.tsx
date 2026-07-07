import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Calendar, Settings2, Sliders, ShieldAlert, BadgeInfo, BarChart, Users, Award, Percent, Flame, Medal, X, Crown, Database, Upload, Download } from "lucide-react";
import { Player, Season, Match, Guild, XPConfig } from "../types";
import { SEASON_DEFAULTS } from "../scoring";
import { dbStore } from "../dbStore";

interface SeasonsTabProps {
  seasons: Season[];
  players: Player[];
  matches: Match[];
  guilds: Guild[];
  onSeasonsUpdated: () => void;
  onShowToast: (msg: string, type: "ok" | "err" | "info") => void;
  onShowConfirm: (msg: string) => Promise<boolean>;
  isAdmin?: boolean;
}

export default function SeasonsTab({
  seasons = [],
  players = [],
  matches = [],
  guilds = [],
  onSeasonsUpdated,
  onShowToast,
  onShowConfirm,
  isAdmin = false
}: SeasonsTabProps) {
  // Season Form States
  const [editingSeasonId, setEditingSeasonId] = useState<number | null>(null);
  const [seasonName, setSeasonName] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");

  const [xpConfig, setXpConfig] = useState<XPConfig>({ ...SEASON_DEFAULTS });
  const [statusMsg, setStatusMsg] = useState("");
  const [selectedSeasonForStats, setSelectedSeasonForStats] = useState<Season | null>(null);

  useEffect(() => {
    resetForm();
  }, [seasons]);

  const resetForm = () => {
    setEditingSeasonId(null);
    setSeasonName("");
    setStartedAt("");
    setEndedAt("");
    setXpConfig({ ...SEASON_DEFAULTS });
    setStatusMsg("");
  };

  const handleEditSeason = (s: Season) => {
    setEditingSeasonId(s.id);
    setSeasonName(s.name);
    setStartedAt(formatDateForInput(s.startedAt));
    setEndedAt(formatDateForInput(s.endedAt || ""));
    setXpConfig({
      xpPerDefeatedOpponent: s.xpPerDefeatedOpponent,
      xpBonusSimple: s.xpBonusSimple,
      xpBonusDouble: s.xpBonusDouble,
      xpBonusTriple: s.xpBonusTriple,
      xpVampireMultiplier: s.xpVampireMultiplier,
      xpSurvivorBase: s.xpSurvivorBase,
      xpBonusPoulidor: s.xpBonusPoulidor,
      xpBonusJackpot: s.xpBonusJackpot,
      xpBonusEgalite: s.xpBonusEgalite,
      xpBonusTueurDeGeants: s.xpBonusTueurDeGeants,
      xpBonusPhenix: s.xpBonusPhenix,
      xpBonusSerialWinner: s.xpBonusSerialWinner,
      xpBonusBenjamin: s.xpBonusBenjamin,
      xpBonusLottery: s.xpBonusLottery,
      bonusVainqueurParRang: s.bonusVainqueurParRang
    });
    setStatusMsg("");
    document.getElementById("season-form-container")?.scrollIntoView({ behavior: "smooth" });
  };

  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const hours = d.getHours().toString().padStart(2, "0");
    const minutes = d.getMinutes().toString().padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleCreateOrUpdateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = seasonName.trim();
    if (!cleanName) return;

    const payload: Omit<Season, "id"> = {
      name: cleanName,
      startedAt: startedAt ? new Date(startedAt).toISOString() : new Date().toISOString(),
      endedAt: endedAt ? new Date(endedAt).toISOString() : null,
      ...xpConfig
    };

    try {
      if (editingSeasonId !== null) {
        const { matchesRecalculated } = await dbStore.updateSeason(editingSeasonId, payload);
        onShowToast(`Saison mise à jour · ${matchesRecalculated} match(s) recalculé(s) ✓`, "ok");
      } else {
        await dbStore.createSeason(payload);
        onShowToast("Saison créée avec succès ! ✓", "ok");
      }
      resetForm();
      onSeasonsUpdated();
    } catch (err: any) {
      setStatusMsg(err.message || "Erreur lors de la validation");
    }
  };

  const handleDeleteSeason = async (id: number, name: string) => {
    const ok = await onShowConfirm(`Êtes-vous absolument sûr de vouloir supprimer la saison "${name}" ? Cette action effacera également TOUT l'historique des matchs correspondants !`);
    if (!ok) return;

    try {
      await dbStore.deleteSeason(id);
      onShowToast("Saison supprimée !", "info");
      onSeasonsUpdated();
    } catch (err: any) {
      onShowToast(err.message || "Erreur de suppression", "err");
    }
  };

  const updateXpConfigParam = (key: keyof XPConfig, value: any) => {
    setXpConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Calculation of season statistics
  const stats = selectedSeasonForStats ? (() => {
    const seasonMatches = matches.filter(m => m.seasonId === selectedSeasonForStats.id);
    const totalMatches = seasonMatches.length;

    // Unique players
    const activePlayerSet = new Set<number>();
    seasonMatches.forEach(m => {
      (m.participants || []).forEach(p => activePlayerSet.add(p.playerId));
    });
    const uniquePlayers = activePlayerSet.size;

    // Total XP earned
    let totalXP = 0;
    seasonMatches.forEach(m => {
      (m.participants || []).forEach(p => {
        totalXP += p.xpEarned;
      });
    });

    const avgXP = totalMatches > 0 ? Math.round(totalXP / totalMatches) : 0;

    // Finish type counts
    let finishSimple = 0;
    let finishDouble = 0;
    let finishTriple = 0;

    seasonMatches.forEach(m => {
      const winner = (m.participants || []).find(p => p.rank === 1);
      if (winner) {
        if (winner.finishType === "SIMPLE") finishSimple++;
        else if (winner.finishType === "DOUBLE") finishDouble++;
        else if (winner.finishType === "TRIPLE") finishTriple++;
      }
    });

    // Medals earned in this season
    const badges: Record<string, number> = {
      TUEUR_DE_GEANTS: 0,
      PHENIX: 0,
      SERIAL_WINNER: 0,
      POULIDOR: 0,
      JACKPOT: 0,
      EGALITE: 0,
      BENJAMIN: 0,
      LOTTERY_WINNER: 0
    };

    seasonMatches.forEach(m => {
      (m.participants || []).forEach(p => {
        (p.medals || []).forEach(mName => {
          if (mName.startsWith("LOTTERY_WINNER:")) {
            badges.LOTTERY_WINNER++;
          } else if (badges[mName] !== undefined) {
            badges[mName]++;
          }
        });
      });
    });

    // Leaderboard for this season
    const statsMap = new Map<number, { xp: number; wins: number; matchesCount: number }>();
    seasonMatches.forEach(m => {
      (m.participants || []).forEach(p => {
        const prev = statsMap.get(p.playerId) || { xp: 0, wins: 0, matchesCount: 0 };
        statsMap.set(p.playerId, {
          xp: prev.xp + p.xpEarned,
          wins: prev.wins + (p.rank === 1 ? 1 : 0),
          matchesCount: prev.matchesCount + 1
        });
      });
    });

    const leaderboardRows: any[] = [];
    players.forEach(p => {
      const sData = statsMap.get(p.id);
      if (sData && sData.matchesCount > 0) {
        const pg = guilds.find(g => (g.memberIds || []).includes(p.id));
        leaderboardRows.push({
          id: p.id,
          name: p.name,
          xp: sData.xp,
          wins: sData.wins,
          played: sData.matchesCount,
          winRate: sData.matchesCount > 0 ? Math.round((sData.wins / sData.matchesCount) * 100) : 0,
          avgXP: Math.round(sData.xp / sData.matchesCount),
          guild: pg ? { name: pg.name, badgeIcon: pg.badgeIcon, badgeColor: pg.badgeColor } : null
        });
      }
    });

    // Sort leaderboardRows: XP desc, wins desc, played asc
    leaderboardRows.sort((a, b) => {
      if (b.xp !== a.xp) return b.xp - a.xp;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.played - b.played;
    });

    const champion = leaderboardRows[0] || null;

    return {
      totalMatches,
      uniquePlayers,
      totalXP,
      avgXP,
      finishSimple,
      finishDouble,
      finishTriple,
      badges,
      leaderboardRows,
      champion
    };
  })() : null;

  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#111114] border border-[#2A2A2E] rounded-none box-glow">
        <h2 className="text-xl font-bold font-display text-white tracking-wide uppercase">🏟️ Configurations des Saisons</h2>
        <p className="text-xs text-slate-400 mt-1">Créez de nouvelles saisons et affinez précisément la distribution de l'XP.</p>
      </div>

      {/* Season Creator/Editor Form */}
      <div id="season-form-container" className="bg-[#111114] border border-[#2A2A2E] p-5 rounded-none space-y-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 font-display flex items-center gap-1.5 border-b border-[#2A2A2E]/50 pb-3 select-none">
          <Settings2 className="w-4 h-4 text-cosmic-accent animate-spin-slow" />
          {editingSeasonId !== null ? "✏️ Éditer la Saison active" : "➕ Ouvrir une nouvelle Saison"}
        </h3>

        <form onSubmit={handleCreateOrUpdateSeason} className="space-y-6">
          {/* Section 1: Identification & dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5 md:col-span-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Identifiant / Nom</label>
              <input
                type="text"
                required
                maxLength={64}
                value={seasonName}
                onChange={(e) => setSeasonName(e.target.value)}
                placeholder="ex: Coupe d'Hiver 2026"
                className="bg-slate-950 border border-[#2A2A2E] text-xs text-slate-300 px-4 py-3 rounded-none focus:border-cosmic-accent/60 focus:outline-none placeholder:text-slate-700"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📅 Liaison Début</label>
              <input
                type="datetime-local"
                required
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                className="bg-slate-950 border border-[#2A2A2E] text-xs text-slate-300 px-4 py-2.5 rounded-none focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🏁 Fin de la Saison (Facultatif)</label>
              <input
                type="datetime-local"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
                className="bg-slate-950 border border-[#2A2A2E] text-xs text-slate-300 px-4 py-2.5 rounded-none focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Correcting the startedAt handler typo */}
          <script dangerouslySetInnerHTML={{__html: ""}} />

          {/* Configs parameters: Sliders / numerical panels */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-[#88888F] uppercase tracking-widest flex items-center gap-1.5 border-b border-[#2A2A2E]/50 pb-1.5">
              <Sliders className="w-3.5 h-3.5 text-cosmic-accent" />
              ⚔️ Configuration d'XP de Base & Closing
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="flex flex-col gap-1 bg-slate-950 border border-[#2A2A2E] p-2.5 rounded-none text-center">
                <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider leading-none">Opp XP Defeated</span>
                <input
                  type="number"
                  min={0}
                  value={xpConfig.xpPerDefeatedOpponent}
                  onChange={(e) => updateXpConfigParam("xpPerDefeatedOpponent", Number(e.target.value))}
                  className="bg-transparent text-center font-bold font-mono text-xs text-white focus:outline-none pt-1"
                />
              </div>

              <div className="flex flex-col gap-1 bg-slate-950 border border-[#2A2A2E] p-2.5 rounded-none text-center">
                <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider leading-none">Simple Close</span>
                <input
                  type="number"
                  min={0}
                  value={xpConfig.xpBonusSimple}
                  onChange={(e) => updateXpConfigParam("xpBonusSimple", Number(e.target.value))}
                  className="bg-transparent text-center font-bold font-mono text-xs text-white focus:outline-none pt-1"
                />
              </div>

              <div className="flex flex-col gap-1 bg-slate-950 border border-[#2A2A2E] p-2.5 rounded-none text-center">
                <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider leading-none">Double Close</span>
                <input
                  type="number"
                  min={0}
                  value={xpConfig.xpBonusDouble}
                  onChange={(e) => updateXpConfigParam("xpBonusDouble", Number(e.target.value))}
                  className="bg-transparent text-center font-bold font-mono text-xs text-white focus:outline-none pt-1"
                />
              </div>

              <div className="flex flex-col gap-1 bg-slate-950 border border-[#2A2A2E] p-2.5 rounded-none text-center">
                <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider leading-none">Triple Close</span>
                <input
                  type="number"
                  min={0}
                  value={xpConfig.xpBonusTriple}
                  onChange={(e) => updateXpConfigParam("xpBonusTriple", Number(e.target.value))}
                  className="bg-transparent text-center font-bold font-mono text-xs text-white focus:outline-none pt-1"
                />
              </div>

              <div className="flex flex-col gap-1 bg-slate-950 border border-[#2A2A2E] p-2.5 rounded-none text-center">
                <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider leading-none">Vampire Mlt (x)</span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={xpConfig.xpVampireMultiplier}
                  onChange={(e) => updateXpConfigParam("xpVampireMultiplier", Number(e.target.value))}
                  className="bg-transparent text-center font-bold font-mono text-xs text-white focus:outline-none pt-1"
                />
              </div>

              <div className="flex flex-col gap-1 bg-slate-950 border border-[#2A2A2E] p-2.5 rounded-none text-center">
                <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider leading-none">Survivor Base</span>
                <input
                  type="number"
                  min={0}
                  value={xpConfig.xpSurvivorBase}
                  onChange={(e) => updateXpConfigParam("xpSurvivorBase", Number(e.target.value))}
                  className="bg-transparent text-center font-bold font-mono text-xs text-white focus:outline-none pt-1"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Badges metrics */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-[#88888F] uppercase tracking-widest flex items-center gap-1.5 border-b border-[#2A2A2E]/50 pb-1.5">
              <Sliders className="w-3.5 h-3.5 text-cosmic-accent" />
              🎖️ Configuration d'XP des Badges
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
              {[
                { name: "Poulidor 🥈", key: "xpBonusPoulidor" },
                { name: "Jackpot 🎰", key: "xpBonusJackpot" },
                { name: "Égalité 🤝", key: "xpBonusEgalite" },
                { name: "Géant ⚔️🏆", key: "xpBonusTueurDeGeants" },
                { name: "Phénix 🔥", key: "xpBonusPhenix" },
                { name: "Serial 🔥🔥", key: "xpBonusSerialWinner" },
                { name: "Benjamin 🥉", key: "xpBonusBenjamin" },
                { name: "Tombola 🍀", key: "xpBonusLottery" }
              ].map(badge => {
                return (
                  <div key={badge.key} className="flex flex-col gap-1 bg-slate-950 border border-[#2A2A2E] p-2 rounded-none text-center">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-none truncate">{badge.name}</span>
                    <input
                      type="number"
                      min={0}
                      value={(xpConfig as any)[badge.key]}
                      onChange={(e) => updateXpConfigParam(badge.key as keyof XPConfig, Number(e.target.value))}
                      className="bg-transparent text-center font-bold font-mono text-xs text-white focus:outline-none pt-1 w-full"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Advanced options */}
          <div className="space-y-3 pt-1 border-t border-[#2A2A2E]/40">
            <div className="flex items-center gap-3 bg-slate-950 border border-[#2A2A2E] p-4 rounded-none">
              <input
                type="checkbox"
                id="season-bonus-rang"
                checked={xpConfig.bonusVainqueurParRang}
                onChange={(e) => updateXpConfigParam("bonusVainqueurParRang", e.target.checked)}
                className="w-4 h-4 bg-slate-950 border-slate-805 rounded-none checked:bg-cosmic-accent cursor-pointer text-cosmic-accent"
              />
              <div className="space-y-0.5">
                <label htmlFor="season-bonus-rang" className="text-xs font-bold text-white cursor-pointer select-none">
                  ⚖️ Ajustement XP vainqueur selon l'écart de niveau (-25% / +25% par palier)
                </label>
                <p className="text-[10px] text-slate-[#55555F]">
                  Si activé, applique un malus de -25% par palier d'écart si le vainqueur est d'un niveau supérieur au vaincu, et un bonus de +25% par palier s'il est d'un niveau inférieur.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2.5 justify-end">
            {editingSeasonId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 border border-[#2A2A2E] bg-slate-900 hover:border-slate-700 text-slate-440 hover:text-slate-200 rounded-none cursor-pointer"
              >
                Annuler
              </button>
            )}
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-cosmic-accent to-[#8E1E1E] hover:from-cosmic-accent/90 hover:to-[#8E1E1E]/90 text-white font-extrabold uppercase tracking-widest text-xs rounded-none border border-cosmic-accent/30 cursor-pointer shadow transform hover:-translate-y-0.5 active:translate-y-0 shadow-cosmic-accent/15"
            >
              {editingSeasonId !== null ? "Enregistrer les modifications" : "Lancer la Saison"}
            </button>
          </div>

          {statusMsg && (
            <p className="text-xs font-semibold text-red-400 py-1">{statusMsg}</p>
          )}
        </form>
      </div>

      {/* SEASONS CHRONOLOGICAL TABLE */}
      <div className="bg-[#111114] border border-[#2A2A2E] rounded-none overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950 border-b border-[#2A2A2E]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display select-none">Saisons Historiques & Actives ({seasons.length})</h3>
        </div>

        <ul className="divide-y divide-[#2A2A2E]/50">
          {seasons.map(s => {
            const hasEnded = s.endedAt ? new Date(s.endedAt) < new Date() : false;
            const startDateStr = new Date(s.startedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
            const endDateStr = s.endedAt ? new Date(s.endedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "Indéfini";

            return (
              <li key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#16161A] transition">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-none flex items-center justify-center border font-display shrink-0 text-sm ${
                    hasEnded
                      ? "bg-slate-950 text-[#55555F] border-slate-900"
                      : "bg-emerald-500/10 border-emerald-500/25 text-emerald-420 font-bold"
                  }`}>
                    {hasEnded ? "🔒" : "🟢"}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm select-text font-serif">{s.name}</h4>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                      Début : {startDateStr} • Fin : {endDateStr}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 ml-11 sm:ml-0">
                  <button
                    onClick={() => setSelectedSeasonForStats(s)}
                    className="p-1.5 px-3 bg-[#111114] hover:bg-slate-900 border border-[#2A2A2E] text-emerald-400 text-[10px] font-bold rounded-none cursor-pointer transition flex items-center gap-1"
                    title="Voir les statistiques de cette saison"
                  >
                    <BarChart className="w-3.5 h-3.5" />
                    Stats
                  </button>
                  <button
                    onClick={() => handleEditSeason(s)}
                    className="p-1.5 px-3 bg-slate-950 hover:bg-slate-900 hover:text-white border border-[#2A2A2E] text-cosmic-accent text-[10px] font-bold rounded-none cursor-pointer transition flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Éditer
                  </button>
                  <button
                    onClick={() => handleDeleteSeason(s.id, s.name)}
                    className="p-1.5 px-2 bg-red-500/5 hover:bg-red-500/10 text-red-405 hover:text-red-350 border border-red-500/20 rounded-none cursor-pointer transition flex items-center"
                    title="Supprimer la saison"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* BACKUP & RESTORE SECTION - ONLY VISIBLE TO ADMINS */}
      {isAdmin && (
        <div className="bg-[#111114] border border-[#2A2A2E] rounded-none overflow-hidden shadow-xl mt-6 p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#2A2A2E]/50 pb-3">
            <Database className="w-4 h-4 text-cosmic-accent" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 font-display">
              Sauvegardes de Sécurité & Restauration
            </h3>
          </div>

          <p className="text-xs text-slate-400">
            Exportez l’intégralité de vos classements, joueurs, saisons, guildes, et historiques de matchs sous forme de fichier JSON cryptographiquement conforme, ou réinstallez une sauvegarde antérieure.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Export block */}
            <div className="bg-slate-950 p-4 border border-[#2A2A2E] flex flex-col justify-between space-y-3">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  Exporter les Données
                </h4>
                <p className="text-[11px] text-[#88888F] mt-1">
                  Télécharge un instantané complet de votre base de données Firestore en format JSON de manière 100% sécurisée et instantanée.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  try {
                    const json = dbStore.getBackupJSON();
                    const blob = new Blob([json], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    const dateStr = new Date().toISOString().split("T")[0];
                    link.href = url;
                    link.download = `dartos-backup-${dateStr}.json`;
                    link.click();
                    URL.revokeObjectURL(url);
                    onShowToast("Sauvegarde exportée avec succès ! ✓", "ok");
                  } catch (err: any) {
                    onShowToast(`Échec de l'exportation: ${err.message}`, "err");
                  }
                }}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider text-[11px] border border-emerald-500/20 hover:border-emerald-500/40 rounded-none cursor-pointer transition text-center flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Télécharger un Backup (.json)
              </button>
            </div>

            {/* Import / Restore block */}
            <div className="bg-slate-950 p-4 border border-[#2A2A2E] flex flex-col justify-between space-y-3">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <Upload className="w-3.5 h-3.5 text-cosmic-accent" />
                  Restaurer un Backup
                </h4>
                <p className="text-[11px] text-[#88888F] mt-1 text-red-500/80">
                  ⚠️ Action irréversible. L'importation écrase toutes les collections existantes dans Firebase Firestore avec les données du fichier chargé.
                </p>
              </div>
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const ok = await onShowConfirm(
                      `Êtes-vous absolument sûr de vouloir RESTAURER la sauvegarde "${file.name}" ?\n\nToutes les données actuelles de l'application seront écrasées de façon définitive !`
                    );
                    if (!ok) {
                      e.target.value = ""; // reset input
                      return;
                    }

                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                      try {
                        const content = evt.target?.result as string;
                        onShowToast("Restauration de la base de données de secours...", "info");
                        await dbStore.restoreBackup(content);
                        onShowToast("Base de données restaurée avec succès ! ✓", "ok");
                        onSeasonsUpdated();
                      } catch (err: any) {
                        onShowToast(`Échec de la restauration: ${err.message}`, "err");
                      } finally {
                        e.target.value = ""; // reset input
                      }
                    };
                    reader.readAsText(file);
                  }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                />
                <button
                  type="button"
                  className="w-full px-4 py-2.5 bg-slate-900 text-cosmic-accent font-bold uppercase tracking-wider text-[11px] border border-red-500/20 rounded-none flex items-center justify-center gap-1.5 pointer-events-none"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Sélectionner & Restaurer (.json)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEASON STATISTICS DRAWER/MODAL DISPLAY */}
      {selectedSeasonForStats && stats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none overflow-y-auto">
          <div className="w-full max-w-3xl bg-slate-900 border border-[#2A2A2E] rounded-none shadow-2xl relative flex flex-col my-8 max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 bg-slate-950 border-b border-[#2A2A2E] flex justify-between items-center shrink-0">
              <div className="space-y-0.5">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#3dc7ff] bg-[#3dc7ff]/10 px-2.5 py-0.5 border border-[#3dc7ff]/20">
                  STATS DE SAISON 📊
                </span>
                <h3 className="text-lg font-black font-serif text-white tracking-wide pt-1">
                  {selectedSeasonForStats.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSeasonForStats(null)}
                className="text-slate-400 hover:text-white hover:bg-slate-800/40 p-2 border border-[#2A2A2E] rounded-none transition cursor-pointer"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 max-h-[calc(90vh-140px)] select-text">
              
              {/* Quick Summary Cards Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-950/60 border border-[#2A2A2E] p-4 text-center rounded-none relative overflow-hidden group">
                  <div className="absolute top-1 right-2 opacity-5 select-none text-white pointer-events-none text-2xl font-black">🎯</div>
                  <span className="block text-2xl font-black font-mono text-white leading-none">
                    {isAdmin ? stats.totalMatches : "🔒"}
                  </span>
                  <span className="block text-[9px] uppercase font-bold tracking-wider text-slate-400 mt-1">
                    Matchs Joués
                  </span>
                </div>

                <div className="bg-slate-950/60 border border-[#2A2A2E] p-4 text-center rounded-none relative overflow-hidden group">
                  <div className="absolute top-1 right-2 opacity-5 select-none text-white pointer-events-none text-2xl font-black">👥</div>
                  <span className="block text-2xl font-black font-mono text-white leading-none">
                    {stats.uniquePlayers}
                  </span>
                  <span className="block text-[9px] uppercase font-bold tracking-wider text-slate-400 mt-1">
                    Lanceurs Actifs
                  </span>
                </div>

                <div className="bg-slate-950/60 border border-[#2A2A2E] p-4 text-center rounded-none relative overflow-hidden group">
                  <div className="absolute top-1 right-2 opacity-5 select-none text-white pointer-events-none text-2xl font-black">💎</div>
                  <span className="block text-2xl font-black font-mono text-emerald-400 leading-none">
                    {stats.totalXP.toLocaleString()}
                  </span>
                  <span className="block text-[9px] uppercase font-bold tracking-wider text-slate-400 mt-1">
                    XP Total Accumulé
                  </span>
                </div>

                <div className="bg-slate-950/60 border border-[#2A2A2E] p-4 text-center rounded-none relative overflow-hidden group">
                  <div className="absolute top-1 right-2 opacity-5 select-none text-white pointer-events-none text-2xl font-black">⚡</div>
                  <span className="block text-2xl font-black font-mono text-sky-400 leading-none">
                    {stats.avgXP}
                  </span>
                  <span className="block text-[9px] uppercase font-bold tracking-wider text-slate-400 mt-1">
                    Moyenne XP / Match
                  </span>
                </div>
              </div>

              {/* Champion & Closing styles section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Champion of the season card */}
                <div className="bg-gradient-to-b from-amber-500/10 to-[#0F0F12] border border-amber-500/20 p-5 rounded-none flex items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 font-bold font-mono text-[9px] border border-amber-500/20 rounded-none uppercase">
                      <Crown className="w-3 h-3" /> Roi de la Saison
                    </span>
                    {stats.champion ? (
                      <div>
                        <h4 className="text-base font-black text-white select-text font-serif">
                          {stats.champion.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-sans mt-1">
                          Dominant avec <strong className="text-emerald-400 font-mono">{stats.champion.xp} XP</strong> et <strong className="text-amber-400 font-mono">{stats.champion.wins} victoires</strong> {isAdmin ? `sur ${stats.champion.played} matchs !` : "!"}
                        </p>
                        <p className="text-[10px] text-[#55555F] font-mono mt-0.5">
                          Taux de réussite : {stats.champion.winRate}% (Moy. {stats.champion.avgXP} XP/match)
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 pt-1">
                        Aucun champion identifié pour le moment.
                      </p>
                    )}
                  </div>
                  <span className="text-4xl filter drop-shadow-[0_0_8px_rgba(245,158,11,0.3)] select-none">👑</span>
                </div>

                {/* Closing finishes stats */}
                <div className="bg-[#111114] border border-[#2A2A2E] p-4 rounded-none space-y-3.5">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-[#2A2A2E]/50 pb-2">
                    <Percent className="w-3.5 h-3.5 text-cosmic-accent" />
                    Types de Fermeture gagnants
                  </h4>

                  {stats.totalMatches > 0 ? (
                    <div className="space-y-2.5 text-xs">
                      {/* Simple Close */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold font-mono text-slate-400">
                          <span>SIMPLE</span>
                          <span>{stats.finishSimple} ({Math.round((stats.finishSimple / stats.totalMatches) * 100)}%)</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 border border-[#2A2A2E] rounded-none overflow-hidden">
                          <div className="h-full bg-slate-400" style={{ width: `${(stats.finishSimple / stats.totalMatches) * 100}%` }} />
                        </div>
                      </div>

                      {/* Double Close */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold font-mono text-amber-400">
                          <span>DOUBLE (Double Close)</span>
                          <span>{stats.finishDouble} ({Math.round((stats.finishDouble / stats.totalMatches) * 100)}%)</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 border border-[#2A2A2E] rounded-none overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${(stats.finishDouble / stats.totalMatches) * 100}%` }} />
                        </div>
                      </div>

                      {/* Triple Close */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold font-mono text-cosmic-accent">
                          <span>TRIPLE (Triple Close)</span>
                          <span>{stats.finishTriple} ({Math.round((stats.finishTriple / stats.totalMatches) * 100)}%)</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 border border-[#2A2A2E] rounded-none overflow-hidden">
                          <div className="h-full bg-cosmic-accent" style={{ width: `${(stats.finishTriple / stats.totalMatches) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-4">Pas de données de match disponibles.</p>
                  )}
                </div>

              </div>

              {/* Medals counts section */}
              <div className="bg-[#111114] border border-[#2A2A2E] p-4 rounded-none space-y-3.5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-[#2A2A2E]/50 pb-2">
                  <Medal className="w-3.5 h-3.5 text-cosmic-accent" />
                  Médailles et Badges décernés
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {[
                    { key: "TUEUR_DE_GEANTS", name: "Tueur de Géant", emoji: "⚔️🏆", color: "text-amber-400" },
                    { key: "PHENIX", name: "Phénix", emoji: "🔥", color: "text-red-400" },
                    { key: "SERIAL_WINNER", name: "Serial Winner", emoji: "🔥🔥", color: "text-pink-400" },
                    { key: "POULIDOR", name: "Poulidor", emoji: "🥈", color: "text-slate-300" },
                    { key: "JACKPOT", name: "Jackpot", emoji: "🎰", color: "text-purple-400" },
                    { key: "EGALITE", name: "Égalité", emoji: "🤝", color: "text-sky-400" },
                    { key: "BENJAMIN", name: "Benjamin", emoji: "👶", color: "text-orange-400" },
                    { key: "LOTTERY_WINNER", name: "Tombola", emoji: "🍀", color: "text-emerald-400" }
                  ].map(badge => {
                    const count = stats.badges[badge.key] || 0;
                    return (
                      <div key={badge.key} className="bg-slate-950 p-2.5 border border-[#2A2A2E] flex items-center justify-between rounded-none">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base select-none">{badge.emoji}</span>
                          <span className="text-[11px] font-bold text-slate-300 truncate">{badge.name}</span>
                        </div>
                        <span className="font-mono text-white font-extrabold px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-xs">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Table of Season performances */}
              <div className="bg-[#111114] border border-[#2A2A2E] rounded-none overflow-hidden">
                <div className="p-3 bg-slate-950 border-b border-[#2A2A2E] flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <BarChart className="w-3.5 h-3.5 text-[#3dc7ff]" />
                    Classement de la Saison
                  </h4>
                  <span className="text-[9px] font-mono text-slate-500 uppercase font-bold">
                    {stats.leaderboardRows.length} Joueur(s) actif(s)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950/40 border-b border-[#2A2A2E] text-[9.5px] font-bold tracking-wider text-slate-400 uppercase font-mono">
                        <th className="py-2.5 px-3 w-10 text-center">Rang</th>
                        <th className="py-2.5 px-3">Lanceur</th>
                        {isAdmin && <th className="py-2.5 px-3 text-center">Parties</th>}
                        <th className="py-2.5 px-3 text-center">Victoires</th>
                        <th className="py-2.5 px-3 text-center">Win Rate</th>
                        <th className="py-2.5 px-3 text-right">Moy XP</th>
                        <th className="py-2.5 px-3 text-right">XP Saison</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60 font-sans text-slate-300">
                      {stats.leaderboardRows.length > 0 ? (
                        stats.leaderboardRows.map((row, index) => (
                          <tr key={row.id} className="hover:bg-slate-900/40 transition">
                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">
                              {index + 1}
                            </td>
                            <td className="py-2 px-3 font-semibold text-white">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold">{row.name}</span>
                                {row.guild && (
                                  <span
                                    className="px-1.5 py-0.5 text-[8.5px] rounded-none font-bold text-white border filter brightness-110 shrink-0"
                                    style={{
                                      backgroundColor: `${row.guild.badgeColor}15`,
                                      borderColor: `${row.guild.badgeColor}30`,
                                      color: row.guild.badgeColor
                                    }}
                                  >
                                    {row.guild.badgeIcon} {row.guild.name}
                                  </span>
                                )}
                              </div>
                            </td>
                            {isAdmin && (
                              <td className="py-2 px-3 text-center font-mono text-slate-400">
                                {row.played}
                              </td>
                            )}
                            <td className="py-2 px-3 text-center font-mono text-amber-400 font-bold">
                              {row.wins}
                            </td>
                            <td className="py-2 px-3 text-center font-mono text-slate-450">
                              {row.winRate}%
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-sky-400">
                              {row.avgXP}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-400 font-bold">
                              {row.xp.toLocaleString()} XP
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={isAdmin ? 7 : 6} className="py-6 text-center text-slate-500">Aucune activité enregistrée sur cette saison.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-[#2A2A2E] text-center shrink-0">
              <button
                onClick={() => setSelectedSeasonForStats(null)}
                className="px-5 py-2 hover:bg-slate-900 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider rounded-none border border-[#2A2A2E] transition cursor-pointer"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
