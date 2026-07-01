import { useState, useEffect } from "react";
import { Filter, Calendar, RefreshCw, Trash2, Edit, Clock } from "lucide-react";
import { Match, Season, Player, MatchLog } from "../types";
import { getMedalIcon, getMedalTitle } from "../scoring";

interface MatchHistoryTabProps {
  players: Player[];
  seasons: Season[];
  matches: Match[];
  matchLogs?: MatchLog[];
  onDeleteMatch: (id: number) => void;
  onEditMatch: (m: Match) => void;
  isAdmin?: boolean;
}

export default function MatchHistoryTab({
  players = [],
  seasons = [],
  matches = [],
  matchLogs = [],
  onDeleteMatch,
  onEditMatch,
  isAdmin = false
}: MatchHistoryTabProps) {
  const [filterSeasonId, setFilterSeasonId] = useState<number | "">("");
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([]);
  const [viewMode, setViewMode] = useState<"matches" | "logs">("matches");

  useEffect(() => {
    if (!isAdmin && viewMode === "logs") {
      setViewMode("matches");
    }
  }, [isAdmin, viewMode]);

  useEffect(() => {
    if (filterSeasonId === "") {
      setFilteredMatches(matches);
    } else {
      setFilteredMatches(matches.filter(m => m.seasonId === filterSeasonId));
    }
  }, [matches, filterSeasonId]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const renderLogDetails = (detailsStr: string) => {
    try {
      const data = JSON.parse(detailsStr);
      if (data && data.type === "update_diff") {
        const diff = data;
        const beforePlayers = diff.participants?.before || [];
        const afterPlayers = diff.participants?.after || [];

        // Build a unique list of all player IDs mentioned
        const playerIds = Array.from(new Set([
          ...beforePlayers.map((p: any) => p.playerId),
          ...afterPlayers.map((p: any) => p.playerId)
        ]));

        const playerDiffs = playerIds.map((pid) => {
          const before = beforePlayers.find((b: any) => b.playerId === pid);
          const after = afterPlayers.find((a: any) => a.playerId === pid);
          const name = after?.name || before?.name || `Joueur #${pid}`;

          let status: "added" | "removed" | "modified" | "unchanged" = "unchanged";
          const changes: { field: string; beforeVal: string; afterVal: string }[] = [];

          if (before && !after) {
            status = "removed";
          } else if (!before && after) {
            status = "added";
          } else if (before && after) {
            // Compare fields
            if (before.rank !== after.rank) {
              changes.push({
                field: "Rang",
                beforeVal: `Rang ${before.rank}`,
                afterVal: `Rang ${after.rank}`
              });
            }
            if (before.scoreLeft !== after.scoreLeft) {
              changes.push({
                field: "Reste",
                beforeVal: `${before.scoreLeft} pts`,
                afterVal: `${after.scoreLeft} pts`
              });
            }
            if (before.xpEarned !== after.xpEarned) {
              changes.push({
                field: "XP",
                beforeVal: `+${before.xpEarned} XP`,
                afterVal: `+${after.xpEarned} XP`
              });
            }
            if (before.finishType !== after.finishType) {
              changes.push({
                field: "Fin",
                beforeVal: before.finishType || "SIMPLE",
                afterVal: after.finishType || "SIMPLE"
              });
            }
            
            const beforeMedals = before.medals || [];
            const afterMedals = after.medals || [];
            const beforeMedalsStr = beforeMedals.join(", ") || "Aucune";
            const afterMedalsStr = afterMedals.join(", ") || "Aucune";
            if (beforeMedalsStr !== afterMedalsStr) {
              changes.push({
                field: "Médailles",
                beforeVal: beforeMedalsStr,
                afterVal: afterMedalsStr
              });
            }

            if (changes.length > 0) {
              status = "modified";
            }
          }

          return { playerId: pid, name, status, before, after, changes };
        });

        const dateChanged = diff.playedAt && diff.playedAt.before !== diff.playedAt.after;

        return (
          <div className="mt-3 space-y-4 font-sans text-left">
            {/* If date changed */}
            {dateChanged && (
              <div className="flex items-center gap-3 bg-amber-500/5 p-3 border border-amber-500/25 text-xs rounded-none">
                <span className="text-amber-500 uppercase font-black text-[10px] tracking-wider">📅 DATE DU MATCH MODIFIÉE :</span>
                <span className="text-red-400 line-through font-mono">{formatDate(diff.playedAt.before)}</span>
                <span className="text-slate-400">➔</span>
                <span className="text-emerald-400 font-bold font-mono">{formatDate(diff.playedAt.after)}</span>
              </div>
            )}

            {/* Unified Comparison Table */}
            <div className="border border-[#2A2A2E] bg-slate-950/20 rounded-none overflow-hidden">
              <div className="bg-[#18181C] px-3 py-2 border-b border-[#2A2A2E] flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">📋 Comparatif des Joueurs (Avant / Après)</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {playerDiffs.filter(pd => pd.status !== "unchanged").length} modification(s)
                </span>
              </div>

              <div className="divide-y divide-[#2A2A2E]/50">
                {playerDiffs.map((pd) => {
                  let statusBadge = null;
                  let bgClass = "bg-transparent";

                  if (pd.status === "added") {
                    statusBadge = (
                      <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] font-black px-2 py-0.5 uppercase tracking-wide">
                        AJOUTÉ
                      </span>
                    );
                    bgClass = "bg-emerald-500/[0.01]";
                  } else if (pd.status === "removed") {
                    statusBadge = (
                      <span className="bg-red-500/15 border border-red-500/30 text-red-400 font-mono text-[9px] font-black px-2 py-0.5 uppercase tracking-wide">
                        SUPPRIMÉ
                      </span>
                    );
                    bgClass = "bg-red-500/[0.01]";
                  } else if (pd.status === "modified") {
                    statusBadge = (
                      <span className="bg-[#3dc7ff]/15 border border-[#3dc7ff]/30 text-[#3dc7ff] font-mono text-[9px] font-black px-2 py-0.5 uppercase tracking-wide">
                        MODIFIÉ
                      </span>
                    );
                    bgClass = "bg-[#3dc7ff]/[0.01]";
                  } else {
                    statusBadge = (
                      <span className="bg-slate-900 border border-slate-800 text-slate-500 font-mono text-[9px] font-medium px-2 py-0.5 uppercase tracking-wide">
                        INCHANGÉ
                      </span>
                    );
                  }

                  return (
                    <div key={pd.playerId} className={`p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 ${bgClass}`}>
                      {/* Left Side: Player Identity */}
                      <div className="flex items-center gap-2 shrink-0 md:w-1/4">
                        <div className="w-1.5 h-1.5 rounded-full bg-cosmic-accent" />
                        <span className="text-sm font-bold text-slate-200">{pd.name}</span>
                      </div>

                      {/* Middle Side: Precise changes list */}
                      <div className="flex-1 min-w-0">
                        {pd.status === "added" && pd.after && (
                          <div className="text-[11px] font-mono text-emerald-450 flex flex-wrap gap-x-3 gap-y-1">
                            <span>Score restant: <strong className="text-white font-semibold">{pd.after.scoreLeft} pts</strong></span>
                            <span>•</span>
                            <span>Rang: <strong className="text-white font-semibold">{pd.after.rank}</strong></span>
                            <span>•</span>
                            <span>XP: <strong className="text-white font-semibold">+{pd.after.xpEarned} XP</strong></span>
                            {pd.after.finishType && (
                              <>
                                <span>•</span>
                                <span>Fin: <strong className="text-white font-semibold">{pd.after.finishType}</strong></span>
                              </>
                            )}
                          </div>
                        )}

                        {pd.status === "removed" && pd.before && (
                          <div className="text-[11px] font-mono text-red-400 flex flex-wrap gap-x-3 gap-y-1 line-through opacity-70">
                            <span>Score restant: {pd.before.scoreLeft} pts</span>
                            <span>•</span>
                            <span>Rang: {pd.before.rank}</span>
                            <span>•</span>
                            <span>XP: +{pd.before.xpEarned} XP</span>
                          </div>
                        )}

                        {pd.status === "modified" && (
                          <div className="space-y-1.5">
                            {pd.changes.map((c, i) => (
                              <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                                <span className="text-slate-500 font-sans text-[10px] uppercase font-bold min-w-[70px]">{c.field} :</span>
                                <span className="text-red-400 line-through bg-red-500/5 px-1.5 py-0.5 border border-red-500/10 rounded">{c.beforeVal}</span>
                                <span className="text-slate-500">➔</span>
                                <span className="text-emerald-400 font-bold bg-emerald-500/5 px-1.5 py-0.5 border border-emerald-500/10 rounded">{c.afterVal}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {pd.status === "unchanged" && (
                          <span className="text-[11px] text-slate-500 italic">Aucune modification sur ce joueur</span>
                        )}
                      </div>

                      {/* Right Side: Status Badge */}
                      <div className="shrink-0 self-start md:self-center">
                        {statusBadge}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      }
    } catch (e) {
      // Ignore
    }

    return (
      <p className="text-xs text-slate-300 font-sans leading-relaxed select-text text-left">
        {detailsStr}
      </p>
    );
  };

  // Sort logs in chronological descending order (newest first)
  const sortedLogs = [...matchLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 bg-[#111114] border border-[#2A2A2E] rounded-none gap-4 box-glow">
        <div>
          <h2 className="text-xl font-bold font-display text-white tracking-wide uppercase">📜 Historique & Traces</h2>
          <p className="text-xs text-slate-400 mt-1">Revoir l'ensemble des parties terminées et suivre l'historique complet des modifications.</p>
        </div>

        {/* Filter bar (only show for match list) */}
        {viewMode === "matches" && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-cosmic-accent shrink-0" />
            <select
              value={filterSeasonId}
              onChange={(e) => setFilterSeasonId(e.target.value === "" ? "" : Number(e.target.value))}
              className="bg-slate-950 border border-[#2A2A2E] text-slate-300 font-bold text-xs px-3 py-2 rounded-none focus:border-cosmic-accent/60 focus:outline-none cursor-pointer w-full md:w-52"
            >
              <option value="">📋 Filtrer par toutes les saisons</option>
              {seasons.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Sub-navigation Toggles */}
      <div className="flex border-b border-[#2A2A2E] gap-1">
        <button
          onClick={() => setViewMode("matches")}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            viewMode === "matches"
              ? "border-b-cosmic-accent text-white font-extrabold"
              : "border-b-transparent text-slate-450 hover:text-white"
          }`}
        >
          📜 Liste des Matchs
        </button>
        {isAdmin && (
          <button
            onClick={() => setViewMode("logs")}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              viewMode === "logs"
                ? "border-b-cosmic-accent text-white font-extrabold"
                : "border-b-transparent text-slate-455 hover:text-white"
            }`}
          >
            🔄 Suivi des modifications
            {matchLogs.length > 0 && (
              <span className="ml-1 bg-cosmic-accent/20 text-cosmic-accent text-[9px] px-1.5 py-0.2 rounded-full border border-cosmic-accent/30 font-mono animate-pulse font-extrabold">
                {matchLogs.length}
              </span>
            )}
          </button>
        )}
      </div>

      {viewMode === "logs" && isAdmin ? (
        <div className="space-y-4">
          {sortedLogs.length > 0 ? (
            <div className="flex flex-col gap-3">
              {sortedLogs.map(log => {
                let badgeColor = "bg-slate-950 border-[#2A2A2E] text-slate-400";
                let actionText: string = log.action;
                
                if (log.action === "CREATE") {
                  badgeColor = "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
                  actionText = "CRÉATION";
                } else if (log.action === "UPDATE") {
                  badgeColor = "bg-[#3dc7ff]/10 border-[#3dc7ff]/30 text-[#3dc7ff]";
                  actionText = "MODIFICATION";
                } else if (log.action === "DELETE") {
                  badgeColor = "bg-red-500/10 border-red-500/30 text-red-400";
                  actionText = "SUPPRESSION";
                } else if (log.action === "LOTTERY_CLAIM") {
                  badgeColor = "bg-amber-500/10 border-amber-500/30 text-amber-400";
                  actionText = "TOMBOLA";
                }

                return (
                  <div
                    key={log.id}
                    className="bg-[#111114] border border-[#2A2A2E] rounded-none p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-cosmic-accent/25 transition duration-200"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border rounded-none ${badgeColor}`}>
                          {actionText}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-600" />
                          {formatDate(log.timestamp)}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Auteur : <strong className="text-slate-200 bg-slate-950 px-1.5 py-0.5 rounded-sm border border-slate-900">{log.author}</strong>
                        </span>
                      </div>
                      {renderLogDetails(log.details)}
                    </div>

                    <div className="shrink-0 self-start md:self-center">
                      <span className="px-2 py-1 bg-slate-950 border border-slate-800 text-slate-500 font-mono text-[10px] rounded-none">
                        MATCH #{log.matchId}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 bg-[#111114]/50 border border-[#2A2A2E] rounded-none text-center text-slate-400 select-none font-semibold text-xs">
              Aucune trace de modification disponible. Les actions futures sur les matchs y apparaîtront en temps réel.
            </div>
          )}
        </div>
      ) : (
        /* MATCH CARDS GRID */
        filteredMatches.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {filteredMatches.map(m => {
              const seasonName = seasons.find(s => s.id === m.seasonId)?.name || "Saison Inconnue";
              // Sort participants: rank ascending
              const sortedParticipants = [...(m.participants || [])].sort((a,b) => a.rank - b.rank);

              return (
                <div
                  key={m.id}
                  className="bg-[#111114] border border-[#2A2A2E] rounded-none overflow-hidden shadow-md flex flex-col divide-y divide-[#2A2A2E]/50 relative hover:border-cosmic-accent/30 transition-all duration-350"
                >
                  {/* Header segment with Match info */}
                  <div className="p-4 bg-slate-950 flex justify-between items-center flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-cosmic-accent font-mono tracking-wide">MATCH #{m.id}</span>
                      <span className="text-slate-600">•</span>
                      <span className="px-2 py-0.5 bg-slate-900 border border-[#2A2A2E] text-slate-300 font-bold rounded-none text-[10px]">
                        {seasonName}
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-400 flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 opacity-60 text-cosmic-accent" />
                        {formatDate(m.playedAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        onClick={() => onEditMatch(m)}
                        className="p-1 px-2.5 text-[10px] uppercase font-bold tracking-wider text-cosmic-accent bg-cosmic-accent/5 hover:bg-cosmic-accent/10 border border-cosmic-accent/20 hover:text-white rounded-none cursor-pointer transition flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        Modifier
                      </button>
                      <button
                        onClick={() => onDeleteMatch(m.id)}
                        className="p-1 px-2 text-[10px] uppercase font-bold tracking-wider text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 border border-red-500/25 rounded-none cursor-pointer transition flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Supprimer
                      </button>
                    </div>
                  </div>

                  {/* Score listing segments */}
                  <div className="p-4 bg-slate-950/20">
                    <ul className="space-y-3 font-mono">
                      {sortedParticipants.map(part => {
                        const pPlayer = players.find(x => x.id === part.playerId);
                        const pName = pPlayer?.name || `Joueur #${part.playerId}`;
                        const isWinner = part.rank === 1;

                        return (
                          <li key={part.playerId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                            {/* Left segment */}
                            <div className="flex items-center gap-3">
                              <span className={`w-6 h-6 rounded-none select-none font-black flex items-center justify-center text-[10px] border ${
                                isWinner
                                  ? "bg-amber-500/15 border-amber-500/35 text-amber-400"
                                  : "bg-slate-950 border-[#2A2A2E] text-slate-450"
                              }`}>
                                {isWinner ? "🏆" : part.rank}
                              </span>
                              <div>
                                <span className="font-bold text-white text-sm select-text font-sans">{pName}</span>
                                <span className="inline-block sm:hidden text-[10px] text-slate-500 ml-2">
                                  {isWinner ? `Félicitations ! Fermeture ${part.finishType}` : `Reste ${part.scoreLeft} pts`}
                                </span>
                              </div>
                              <span className="hidden sm:inline-block text-[10px] text-slate-400 font-normal">
                                {isWinner ? `· Fermeture ${part.finishType}` : `· Reste ${part.scoreLeft} pt(s)`}
                              </span>
                            </div>

                            {/* Right segment (XP and badges) */}
                            <div className="flex items-center gap-2 flex-wrap self-end sm:self-center font-sans">
                              <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 font-black font-mono text-xs rounded-none border border-emerald-505/20">
                                +{part.xpEarned} XP
                              </span>
                              {part.medals && part.medals.length > 0 && (
                                <div className="flex items-center gap-1">
                                  {part.medals.map(medal => (
                                    <span
                                      key={medal}
                                      className="p-1 px-1.5 bg-slate-950 border border-[#2A2A2E] hover:border-[#2A2A2E] text-xs rounded-none select-none flex items-center gap-1 shrink-0 filter brightness-110 cursor-help"
                                      title={getMedalTitle(medal)}
                                    >
                                      <span className="text-xs leading-none">{getMedalIcon(medal)}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 bg-[#111114]/50 border border-[#2A2A2E] rounded-none text-center text-slate-400 select-none font-semibold text-xs">
            Aucun match enregistré pour l'instant.
          </div>
        )
      )}
    </div>
  );
}
