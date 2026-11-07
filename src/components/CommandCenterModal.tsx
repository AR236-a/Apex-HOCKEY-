import React, { useState } from 'react';
import {
  HOCKEY_TEAMS,
  UNLOCKABLE_JERSEYS,
  DAILY_CHALLENGES,
  SEASON_REWARDS,
  LeaderboardEntry,
  SocialClubEntry,
  TournamentCategory,
  getTeamById,
} from '../data/teamsAndJerseys';
import {
  PlayerAttributes,
  MAX_ATTRIBUTE_BUDGET,
  validateAttributeBudget,
  TournamentBracketState,
} from '../game/physics';
import { FirestorePlayerProfile, ChatMessageDoc } from '../firebase';

export type CommandTab =
  | 'tournaments'
  | 'locker'
  | 'leaderboards'
  | 'challenges'
  | 'social';

interface MultiplayerRoomItem {
  id: string;
  name: string;
  mode: string;
  hostId: string;
  hostName: string;
  hostTeamId: string;
  guestId: string | null;
  guestName: string | null;
  status: 'waiting' | 'active';
}

interface VoicePeerItem {
  id: string;
  displayName: string;
  teamId: string;
  isSpeaking: boolean;
}

interface CommandCenterModalProps {
  activeTab: CommandTab;
  onSelectTab: (tab: CommandTab) => void;
  onClose: () => void;
  profile: FirestorePlayerProfile;
  isSignedIn: boolean;
  onSignInGoogle: () => void;
  onSignOut: () => void;
  onUpdateProfileCustomization: (updates: {
    displayName: string;
    teamId: string;
    equippedJerseyId: string;
    unlockedJerseyIds: string[];
    attrs: PlayerAttributes;
  }) => void;
  // Tournament state & actions
  activeBracket: TournamentBracketState;
  onSwitchTournamentMode: (mode: TournamentCategory, userTeamId: string) => void;
  onPlayTournamentMatch: (opponentTeamId: string) => void;
  onSimulateTournamentRound: () => void;
  // Leaderboards
  leaderboardEntries: LeaderboardEntry[];
  // Social, Chat & Multiplayer
  chatChannel: 'global' | 'world-cup' | 'asia-cup' | 'lfg' | 'strategy';
  onChangeChatChannel: (ch: 'global' | 'world-cup' | 'asia-cup' | 'lfg' | 'strategy') => void;
  chatMessages: ChatMessageDoc[];
  onSendChatMessage: (text: string) => void;
  socialClubs: SocialClubEntry[];
  onCreateSocialClub: (club: {
    name: string;
    tag: string;
    region: 'Global' | 'North America' | 'Europe' | 'Asia-Pacific';
    description: string;
  }) => void;
  onJoinSocialClub: (clubId: string) => void;
  rooms: MultiplayerRoomItem[];
  onCreateRoom: (name: string, mode: string) => void;
  onJoinRoom: (roomId: string) => void;
  voiceActive: boolean;
  voicePeers: VoicePeerItem[];
  onToggleVoiceChat: () => void;
  onClaimDailyChallenge: (challengeId: string) => void;
  onClaimSeasonReward: (rewardId: string) => void;
}

export const CommandCenterModal: React.FC<CommandCenterModalProps> = ({
  activeTab,
  onSelectTab,
  onClose,
  profile,
  isSignedIn,
  onSignInGoogle,
  onSignOut,
  onUpdateProfileCustomization,
  activeBracket,
  onSwitchTournamentMode,
  onPlayTournamentMatch,
  onSimulateTournamentRound,
  leaderboardEntries,
  chatChannel,
  onChangeChatChannel,
  chatMessages,
  onSendChatMessage,
  socialClubs,
  onCreateSocialClub,
  onJoinSocialClub,
  rooms,
  onCreateRoom,
  onJoinRoom,
  voiceActive,
  voicePeers,
  onToggleVoiceChat,
  onClaimDailyChallenge,
  onClaimSeasonReward,
}) => {
  // Locker room local editing state
  const [callsign, setCallsign] = useState(profile.displayName);
  const [selectedTeamId, setSelectedTeamId] = useState(profile.teamId);
  const [selectedJerseyId, setSelectedJerseyId] = useState(profile.equippedJerseyId);
  const [attrs, setAttrs] = useState<PlayerAttributes>({
    statSpeed: profile.statSpeed,
    statPower: profile.statPower,
    statHandling: profile.statHandling,
    statChecking: profile.statChecking,
    statStamina: profile.statStamina,
  });
  const [lockerSavedNotice, setLockerSavedNotice] = useState('');

  // Leaderboard sub-filter
  const [lbFilter, setLbFilter] = useState<'overall' | 'world_cup' | 'asia_cup' | 'goals'>('overall');

  // Chat & Social inputs
  const [chatInput, setChatInput] = useState('');
  const [roomNameInput, setRoomNameInput] = useState('');
  const [roomModeInput, setRoomModeInput] = useState('world_cup');
  const [clubName, setClubName] = useState('');
  const [clubTag, setClubTag] = useState('');
  const [clubRegion, setClubRegion] = useState<'Global' | 'North America' | 'Europe' | 'Asia-Pacific'>('Asia-Pacific');
  const [clubDesc, setClubDesc] = useState('');
  const [clubError, setClubError] = useState('');
  const [joinedClubIds, setJoinedClubIds] = useState<string[]>([]);
  const [inviteCopied, setInviteCopied] = useState(false);

  const budgetCheck = validateAttributeBudget(attrs);

  const handleAttrChange = (key: keyof PlayerAttributes, delta: number) => {
    setAttrs(prev => {
      const nextVal = Math.min(99, Math.max(50, prev[key] + delta));
      const candidate = { ...prev, [key]: nextVal };
      const check = validateAttributeBudget(candidate);
      if (delta > 0 && !check.valid) return prev;
      return candidate;
    });
  };

  const handleSaveLocker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!callsign.trim()) return;
    onUpdateProfileCustomization({
      displayName: callsign.trim(),
      teamId: selectedTeamId,
      equippedJerseyId: selectedJerseyId,
      unlockedJerseyIds: profile.unlockedJerseyIds,
      attrs,
    });
    setLockerSavedNotice('Skater build & jersey equipped.');
    setTimeout(() => setLockerSavedNotice(''), 2500);
  };

  const sortedLeaderboard = [...leaderboardEntries].sort((a, b) => {
    if (lbFilter === 'world_cup') return b.worldCupTitles - a.worldCupTitles || b.mmr - a.mmr;
    if (lbFilter === 'asia_cup') return b.asiaCupTitles - a.asiaCupTitles || b.mmr - a.mmr;
    if (lbFilter === 'goals') return b.goals - a.goals || b.mmr - a.mmr;
    return b.mmr - a.mmr;
  });

  const currentRoundUserMatch = activeBracket.matches.find(
    m => m.round === activeBracket.currentRound && m.involvesUser
  );
  const nextOpponentId = currentRoundUserMatch
    ? currentRoundUserMatch.homeTeamId === activeBracket.userTeamId
      ? currentRoundUserMatch.awayTeamId
      : currentRoundUserMatch.homeTeamId
    : 'JPN';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Hockey Command Center"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050811]/88 pointer-events-auto"
    >
      <div className="w-full max-w-6xl h-[86vh] bg-[#0B1221] border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Command Center Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#080E1A]">
          <div className="flex items-center gap-6">
            <h2 className="text-2xl font-bold tracking-wider uppercase font-display text-white">
              Apex Ice Command Center
            </h2>
            <div className="text-xs text-slate-400 font-mono-tabular">
              <span>{profile.displayName}</span>
              <span aria-hidden="true"> · </span>
              <span>{profile.rankTier} ({profile.mmr} MMR)</span>
              <span aria-hidden="true"> · </span>
              <span>Season Lv.{profile.seasonPassLevel} ({profile.xp} XP)</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <button
                type="button"
                onClick={onSignOut}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignInGoogle}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Sign In with Google
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Command Center"
              className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              Return to Ice
            </button>
          </div>
        </div>

        {/* Segmented Navigation Bar */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-[#090F1C] border-b border-slate-800/80 overflow-x-auto">
          {(
            [
              { id: 'tournaments', label: 'World Cup & Asia Cup' },
              { id: 'locker', label: 'Locker Room & Jerseys' },
              { id: 'leaderboards', label: 'Ranked Leaderboards' },
              { id: 'challenges', label: 'Daily Challenges & Season Pass' },
              { id: 'social', label: 'Multiplayer, Voice & Global Chat' },
            ] as { id: CommandTab; label: string }[]
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: WORLD CUP, ASIA CUP & ALL TEAMS TOURNAMENTS */}
          {activeTab === 'tournaments' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-bold font-display uppercase tracking-wide text-white">
                    {activeBracket.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Select World Cup, Asia Cup, or All-Teams Super Cup to compete through Quarterfinals, Semifinals, and the Championship Final.
                  </p>
                </div>

                {/* Mode Switcher */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => onSwitchTournamentMode('world_cup', profile.teamId)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      activeBracket.mode === 'world_cup'
                        ? 'bg-sky-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    World Cup (Global)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSwitchTournamentMode(
                        'asia_cup',
                        getTeamById(profile.teamId).isAsiaCup ? profile.teamId : 'IND'
                      )
                    }
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      activeBracket.mode === 'asia_cup'
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Asia Cup (IND · PAK · JPN · KOR)
                  </button>
                  <button
                    type="button"
                    onClick={() => onSwitchTournamentMode('all_teams', profile.teamId)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      activeBracket.mode === 'all_teams'
                        ? 'bg-emerald-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    All Teams Super Cup
                  </button>
                </div>
              </div>

              {/* Team Selector for Current Tournament & Campaign Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="tournament-team-select"
                      className="text-xs font-semibold text-slate-300"
                    >
                      Select Your Federation / Team
                    </label>
                    <span className="text-xs text-slate-400 font-mono-tabular">
                      Status: {activeBracket.status.toUpperCase()}
                    </span>
                  </div>
                  <select
                    id="tournament-team-select"
                    value={activeBracket.userTeamId}
                    onChange={e => onSwitchTournamentMode(activeBracket.mode, e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-md text-white"
                  >
                    {HOCKEY_TEAMS.filter(t =>
                      activeBracket.mode === 'asia_cup'
                        ? t.isAsiaCup
                        : activeBracket.mode === 'world_cup'
                        ? t.isWorldCup
                        : true
                    ).map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code}) — Rating {t.rating} · {t.region}
                      </option>
                    ))}
                  </select>

                  {/* Quick Asia Cup Derby Selector for India (IND) & Pakistan (PAK) */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onSwitchTournamentMode('asia_cup', 'IND')}
                      className={`py-1.5 px-2.5 rounded text-xs font-semibold border transition-colors ${
                        activeBracket.mode === 'asia_cup' && activeBracket.userTeamId === 'IND'
                          ? 'bg-sky-500 text-slate-950 border-sky-400'
                          : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      Asia Cup: Play as India (IND)
                    </button>
                    <button
                      type="button"
                      onClick={() => onSwitchTournamentMode('asia_cup', 'PAK')}
                      className={`py-1.5 px-2.5 rounded text-xs font-semibold border transition-colors ${
                        activeBracket.mode === 'asia_cup' && activeBracket.userTeamId === 'PAK'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      Asia Cup: Play as Pakistan (PAK)
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center font-mono-tabular">
                    <div>
                      <div className="text-xs text-slate-400">Wins</div>
                      <div className="text-lg font-bold text-white">{activeBracket.wins}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Goals For</div>
                      <div className="text-lg font-bold text-sky-400">{activeBracket.goalsFor}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Goals Against</div>
                      <div className="text-lg font-bold text-rose-400">{activeBracket.goalsAgainst}</div>
                    </div>
                  </div>

                  {activeBracket.status === 'active' ? (
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => onPlayTournamentMatch(nextOpponentId)}
                        className="w-full py-2.5 px-4 text-xs font-bold uppercase tracking-wider bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-md transition-colors"
                      >
                        Play Fixture On Ice vs {getTeamById(nextOpponentId).name}
                      </button>
                      <button
                        type="button"
                        onClick={onSimulateTournamentRound}
                        className="w-full py-2 px-4 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors"
                      >
                        Simulate Current Round Result
                      </button>
                    </div>
                  ) : (
                    <div className="pt-2 space-y-2">
                      <div className="text-sm font-semibold text-amber-400">
                        {activeBracket.status === 'champion'
                          ? `CHAMPION! You lifted the ${activeBracket.title}!`
                          : 'Eliminated from knockout bracket.'}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onSwitchTournamentMode(activeBracket.mode, activeBracket.userTeamId)
                        }
                        className="w-full py-2 px-4 text-xs font-semibold bg-sky-500 text-slate-950 rounded-md hover:bg-sky-400 transition-colors"
                      >
                        Start New Tournament Run
                      </button>
                    </div>
                  )}
                </div>

                {/* Knockout Bracket Columns */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { round: 0, title: '01. Quarterfinals' },
                    { round: 1, title: '02. Semifinals' },
                    { round: 2, title: '03. Championship Final' },
                  ].map(col => {
                    const roundMatches = activeBracket.matches.filter(m => m.round === col.round);
                    return (
                      <div
                        key={col.round}
                        className="bg-[#0F172A] border border-slate-800 rounded-lg p-4 flex flex-col gap-3"
                      >
                        <h4 className="text-xs font-semibold text-slate-300 border-b border-slate-800 pb-2">
                          {col.title}
                        </h4>
                        {roundMatches.length === 0 ? (
                          <div className="text-xs text-slate-500 py-6 text-center">
                            Awaiting previous round winners
                          </div>
                        ) : (
                          roundMatches.map(m => {
                            const hTeam = getTeamById(m.homeTeamId);
                            const aTeam = getTeamById(m.awayTeamId);
                            return (
                              <div
                                key={m.id}
                                className={`p-3 rounded-md border ${
                                  m.involvesUser
                                    ? 'border-sky-500/60 bg-slate-900'
                                    : 'border-slate-800 bg-slate-950/70'
                                } space-y-1.5 font-mono-tabular`}
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span
                                    className={
                                      m.winnerTeamId === hTeam.id
                                        ? 'font-bold text-white'
                                        : 'text-slate-300'
                                    }
                                  >
                                    {hTeam.code} · {hTeam.name}
                                  </span>
                                  <span className="font-bold text-sky-400">
                                    {m.homeScore !== null ? m.homeScore : '-'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span
                                    className={
                                      m.winnerTeamId === aTeam.id
                                        ? 'font-bold text-white'
                                        : 'text-slate-300'
                                    }
                                  >
                                    {aTeam.code} · {aTeam.name}
                                  </span>
                                  <span className="font-bold text-sky-400">
                                    {m.awayScore !== null ? m.awayScore : '-'}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOCKER ROOM (CUSTOM PLAYER STATS & UNLOCKABLE JERSEYS) */}
          {activeTab === 'locker' && (
            <form onSubmit={handleSaveLocker} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Custom Player Attributes & Identity */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-5 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-lg font-bold font-display uppercase tracking-wide text-white">
                    01. Custom Skater Attributes
                  </h3>
                  <span className="text-xs font-mono-tabular text-sky-400">
                    Skill Points Remaining: {budgetCheck.remaining} / {MAX_ATTRIBUTE_BUDGET}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="skater-callsign-input"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      Skater Callsign
                    </label>
                    <input
                      id="skater-callsign-input"
                      type="text"
                      required
                      maxLength={60}
                      value={callsign}
                      onChange={e => setCallsign(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-md text-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="primary-federation-select"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      Primary Federation / Club
                    </label>
                    <select
                      id="primary-federation-select"
                      value={selectedTeamId}
                      onChange={e => setSelectedTeamId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-md text-white"
                    >
                      {HOCKEY_TEAMS.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.code}) · {t.archetype}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 5 Custom Physics Attributes */}
                <div className="space-y-3 pt-2">
                  {(
                    [
                      {
                        key: 'statSpeed',
                        label: 'Skating Top Speed',
                        desc: 'Governs maximum stride velocity on breakaways',
                      },
                      {
                        key: 'statPower',
                        label: 'Slapshot Velocity',
                        desc: 'Scales charged slapshot speed and one-timer force',
                      },
                      {
                        key: 'statHandling',
                        label: 'Stick Handling & Agility',
                        desc: 'Improves puck pickup radius and edge turn acceleration',
                      },
                      {
                        key: 'statChecking',
                        label: 'Body Checking Impact',
                        desc: 'Increases collision knockback and puck strip radius',
                      },
                      {
                        key: 'statStamina',
                        label: 'Endurance & Recovery',
                        desc: 'Reduces sprint drain and speeds up stamina recovery',
                      },
                    ] as { key: keyof PlayerAttributes; label: string; desc: string }[]
                  ).map(stat => (
                    <div
                      key={stat.key}
                      className="flex items-center justify-between gap-4 p-3 bg-slate-950/70 border border-slate-800/80 rounded-md"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white">{stat.label}</div>
                        <div className="text-xs text-slate-400 truncate">{stat.desc}</div>
                      </div>
                      <div className="flex items-center gap-2 font-mono-tabular">
                        <button
                          type="button"
                          aria-label={`Decrease ${stat.label}`}
                          onClick={() => handleAttrChange(stat.key, -1)}
                          className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-sky-400">
                          {attrs[stat.key]}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase ${stat.label}`}
                          onClick={() => handleAttrChange(stat.key, 1)}
                          className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-emerald-400">{lockerSavedNotice}</span>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-md transition-colors"
                  >
                    Save Skater Build & Equip
                  </button>
                </div>
              </div>

              {/* Right Column: Unlockable Team Jerseys */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-lg font-bold font-display uppercase tracking-wide text-white">
                    02. Unlockable Team Jerseys
                  </h3>
                  <span className="text-xs text-slate-400 font-mono-tabular">
                    Unlocked: {profile.unlockedJerseyIds.length} / {UNLOCKABLE_JERSEYS.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[52vh] overflow-y-auto pr-1">
                  {UNLOCKABLE_JERSEYS.map(j => {
                    const isUnlocked =
                      j.defaultUnlocked || profile.unlockedJerseyIds.includes(j.id);
                    const isEquipped = selectedJerseyId === j.id;
                    return (
                      <div
                        key={j.id}
                        className={`p-3.5 rounded-lg border transition-colors flex flex-col justify-between gap-3 ${
                          isEquipped
                            ? 'border-sky-400 bg-slate-900'
                            : 'border-slate-800 bg-slate-950/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* SVG Jersey Preview Swatch */}
                          <svg
                            viewBox="0 0 48 48"
                            className="w-12 h-12 shrink-0"
                            aria-hidden="true"
                          >
                            <path
                              d="M12 8 L18 6 L30 6 L36 8 L44 18 L38 24 L34 19 L34 42 L14 42 L14 19 L10 24 L4 18 Z"
                              fill={j.primaryColor}
                              stroke={j.trimColor}
                              strokeWidth="2"
                            />
                            <rect
                              x="14"
                              y="22"
                              width="20"
                              height="6"
                              fill={j.secondaryColor}
                            />
                          </svg>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">
                              {j.name}
                            </div>
                            <div className="text-xs text-slate-400">
                              {j.teamId} · {j.rarity} · {j.pattern}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {j.unlockRequirement}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          {isUnlocked ? (
                            <button
                              type="button"
                              onClick={() => setSelectedJerseyId(j.id)}
                              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                                isEquipped
                                  ? 'bg-sky-500 text-slate-950'
                                  : 'bg-slate-800 hover:bg-slate-700 text-white'
                              }`}
                            >
                              {isEquipped ? 'Equipped' : 'Equip Jersey'}
                            </button>
                          ) : (
                            <span className="text-xs text-amber-400/90 font-mono-tabular">
                              Locked · Complete Goal
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </form>
          )}

          {/* TAB 3: RANKED & INDIVIDUAL TOURNAMENT LEADERBOARDS */}
          {activeTab === 'leaderboards' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold font-display uppercase tracking-wide text-white">
                    Global Ranked & Tournament Leaderboards
                  </h3>
                  <p className="text-xs text-slate-400">
                    Individual skater rankings across Ranked MMR, World Cup Titles, Asia Cup Championships, and Career Goals.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                  {(
                    [
                      { id: 'overall', label: 'Ranked MMR' },
                      { id: 'world_cup', label: 'World Cup Champions' },
                      { id: 'asia_cup', label: 'Asia Cup Leaders' },
                      { id: 'goals', label: 'Individual Goal Scorers' },
                    ] as const
                  ).map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setLbFilter(f.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        lbFilter === f.id
                          ? 'bg-sky-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#0F172A] border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse font-mono-tabular">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400 bg-slate-950/60">
                      <th className="py-3 px-4">Rank</th>
                      <th className="py-3 px-4">Skater</th>
                      <th className="py-3 px-4">Federation</th>
                      <th className="py-3 px-4">Division · MMR</th>
                      <th className="py-3 px-4">W - L</th>
                      <th className="py-3 px-4">Goals · Assists</th>
                      <th className="py-3 px-4">Hits · Saves</th>
                      <th className="py-3 px-4">World Cup / Asia Cup</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-xs">
                    {sortedLeaderboard.map((row, idx) => (
                      <tr
                        key={row.uid}
                        className={
                          row.uid === profile.uid
                            ? 'bg-sky-950/35 text-white font-semibold'
                            : 'text-slate-200 hover:bg-slate-900/50'
                        }
                      >
                        <td className="py-3 px-4 font-bold text-sky-400">#{idx + 1}</td>
                        <td className="py-3 px-4 font-sans">{row.displayName}</td>
                        <td className="py-3 px-4">{row.teamId}</td>
                        <td className="py-3 px-4">
                          {row.rankTier} · {row.mmr}
                        </td>
                        <td className="py-3 px-4">
                          {row.wins}W - {row.losses}L
                        </td>
                        <td className="py-3 px-4">
                          {row.goals}G · {row.assists}A
                        </td>
                        <td className="py-3 px-4">
                          {row.hits} HT · {row.saves} SV
                        </td>
                        <td className="py-3 px-4 text-amber-400">
                          {row.worldCupTitles} WC · {row.asiaCupTitles} AC
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: DAILY CHALLENGES & SEASONAL REWARDS PASS */}
          {activeTab === 'challenges' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Challenges */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-5 space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-lg font-bold font-display uppercase tracking-wide text-white">
                    01. Daily Ice Challenges
                  </h3>
                  <p className="text-xs text-slate-400">
                    Complete daily objectives to earn bonus Season XP and unlock national jerseys.
                  </p>
                </div>

                <div className="space-y-3">
                  {DAILY_CHALLENGES.map(ch => {
                    const currentVal =
                      ch.metric === 'goals'
                        ? profile.goals
                        : ch.metric === 'hits'
                        ? profile.hits
                        : ch.metric === 'shots'
                        ? profile.shots
                        : ch.metric === 'wins'
                        ? profile.wins
                        : profile.assists;
                    const progress = Math.min(ch.target, currentVal);
                    const isCompleted = profile.completedChallengeIds.includes(ch.id);
                    const canClaim = progress >= ch.target && !isCompleted;

                    return (
                      <div
                        key={ch.id}
                        className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-white">{ch.title}</div>
                          <div className="text-xs text-slate-400">{ch.description}</div>
                          <div className="text-xs font-mono-tabular text-sky-400">
                            Progress: {progress} / {ch.target} · Reward: +{ch.xpReward} XP
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!canClaim && !isCompleted}
                          onClick={() => onClaimDailyChallenge(ch.id)}
                          className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                            isCompleted
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : canClaim
                              ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isCompleted ? 'Claimed' : canClaim ? 'Claim Reward' : `${progress}/${ch.target}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Seasonal Rewards Pass */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-lg font-bold font-display uppercase tracking-wide text-white">
                      02. Season 1 Championship Pass
                    </h3>
                    <p className="text-xs text-slate-400">
                      Current XP: {profile.xp} · Level {profile.seasonPassLevel}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {SEASON_REWARDS.map(sr => {
                    const isUnlocked = profile.xp >= sr.xpRequired;
                    const isClaimed = profile.claimedRewardIds.includes(sr.id);
                    return (
                      <div
                        key={sr.id}
                        className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-4 font-mono-tabular"
                      >
                        <div>
                          <div className="text-xs text-sky-400">
                            Tier {sr.level} · {sr.xpRequired} XP
                          </div>
                          <div className="text-sm font-semibold text-white font-sans">
                            {sr.rewardLabel}
                          </div>
                          <div className="text-xs text-slate-400 font-sans">
                            Title: {sr.title} ({sr.type})
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!isUnlocked || isClaimed}
                          onClick={() => onClaimSeasonReward(sr.id)}
                          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                            isClaimed
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : isUnlocked
                              ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {isClaimed ? 'Unlocked' : isUnlocked ? 'Claim Tier' : 'Locked'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: REAL-TIME MULTIPLAYER, VOICE CHAT, GLOBAL CHAT & SOCIAL CLUBS */}
          {activeTab === 'social' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Column 1: Real-Time Multiplayer Matchmaking & Voice Comms */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold font-display uppercase tracking-wide text-white">
                    01. Live Rooms & Voice Chat
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(window.location.href).catch(() => {});
                      setInviteCopied(true);
                      setTimeout(() => setInviteCopied(false), 2000);
                    }}
                    className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-sky-400 rounded transition-colors"
                  >
                    {inviteCopied ? 'Invite Link Copied!' : 'Copy Friend Invite'}
                  </button>
                </div>

                {/* Voice Chat Channel Control */}
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Locker Room Voice Comms
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {voiceActive
                          ? 'Microphone active · WebRTC channel connected'
                          : 'Join real-time voice channel with squadmates'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onToggleVoiceChat}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        voiceActive
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      {voiceActive ? 'Mute / Leave Voice' : 'Join Voice Channel'}
                    </button>
                  </div>

                  {voicePeers.length > 0 && (
                    <div className="text-xs text-slate-300 pt-1 border-t border-slate-800/80 space-y-1">
                      {voicePeers.map(vp => (
                        <div key={vp.id} className="flex items-center justify-between">
                          <span>
                            {vp.displayName} ({vp.teamId})
                          </span>
                          <span className="text-emerald-400 font-mono-tabular">
                            {vp.isSpeaking ? 'Speaking' : 'Connected'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Create Multiplayer Room */}
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (!roomNameInput.trim()) return;
                    onCreateRoom(roomNameInput.trim(), roomModeInput);
                    setRoomNameInput('');
                  }}
                  className="space-y-2 pt-2 border-t border-slate-800"
                >
                  <label
                    htmlFor="new-room-name"
                    className="block text-xs font-semibold text-slate-300"
                  >
                    Host New Multiplayer Rink
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="new-room-name"
                      type="text"
                      required
                      placeholder="Arena room name..."
                      value={roomNameInput}
                      onChange={e => setRoomNameInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-white"
                    />
                    <select
                      aria-label="Room Mode"
                      value={roomModeInput}
                      onChange={e => setRoomModeInput(e.target.value)}
                      className="px-2 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-white"
                    >
                      <option value="world_cup">World Cup</option>
                      <option value="asia_cup">Asia Cup</option>
                      <option value="ranked">Ranked 1v1</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded transition-colors"
                  >
                    Create Multiplayer Room
                  </button>
                </form>

                {/* Active Rooms List */}
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {rooms.map(r => (
                    <div
                      key={r.id}
                      className="p-3 rounded bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {r.name} ({r.id})
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Host: {r.hostName} ({r.hostTeamId}) · {r.mode.replace('_', ' ')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onJoinRoom(r.id)}
                        className="px-3 py-1 text-xs font-semibold bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-white rounded transition-colors shrink-0"
                      >
                        Join Ice
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: Global & Tournament Channel Chat */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-4 flex flex-col h-[62vh]">
                <div className="border-b border-slate-800 pb-3 space-y-2">
                  <h3 className="text-base font-bold font-display uppercase tracking-wide text-white">
                    02. Global & Strategy Chat
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: 'global', label: 'Global' },
                        { id: 'world-cup', label: 'World Cup' },
                        { id: 'asia-cup', label: 'Asia Cup' },
                        { id: 'strategy', label: 'Strategy' },
                        { id: 'lfg', label: 'Find Squad' },
                      ] as const
                    ).map(ch => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => onChangeChatChannel(ch.id)}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                          chatChannel === ch.id
                            ? 'bg-sky-500 text-slate-950 font-semibold'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        #{ch.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
                  {chatMessages
                    .filter(m => m.channel === chatChannel)
                    .map(m => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded bg-slate-950/70 border border-slate-800/80 text-xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="font-semibold text-sky-400">
                            {m.authorName} · {m.authorTeam}
                          </span>
                          <span className="text-[10px] font-mono-tabular">#{m.channel}</span>
                        </div>
                        <p className="text-slate-200 break-words">{m.text}</p>
                      </div>
                    ))}
                </div>

                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (!chatInput.trim()) return;
                    onSendChatMessage(chatInput.trim());
                    setChatInput('');
                  }}
                  className="pt-2 border-t border-slate-800 flex gap-2"
                >
                  <input
                    type="text"
                    aria-label="Chat message"
                    placeholder={`Message #${chatChannel}...`}
                    maxLength={400}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded transition-colors shrink-0"
                  >
                    Send
                  </button>
                </form>
              </div>

              {/* Column 3: Social Hockey Clubs & Squads */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-4 space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold font-display uppercase tracking-wide text-white">
                    03. Social Hockey Clubs
                  </h3>
                  <p className="text-xs text-slate-400">
                    Form a club or join an existing federation squad to share strategies and climb club leaderboards.
                  </p>
                </div>

                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (clubName.trim().length < 2 || clubTag.trim().length < 2 || !clubDesc.trim()) {
                      setClubError('Enter a club name (2+ chars), tag (2-8 chars), and description.');
                      return;
                    }
                    setClubError('');
                    onCreateSocialClub({
                      name: clubName.trim(),
                      tag: clubTag.trim().toUpperCase(),
                      region: clubRegion,
                      description: clubDesc.trim(),
                    });
                    setClubName('');
                    setClubTag('');
                    setClubDesc('');
                  }}
                  className="space-y-2 p-3 rounded bg-slate-950 border border-slate-800"
                >
                  <div className="text-xs font-semibold text-slate-200">Create New Hockey Club</div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      aria-label="Club Name"
                      placeholder="Club Name"
                      maxLength={60}
                      value={clubName}
                      onChange={e => setClubName(e.target.value)}
                      className="col-span-2 px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-white"
                    />
                    <input
                      type="text"
                      aria-label="Club Tag"
                      placeholder="TAG"
                      maxLength={8}
                      value={clubTag}
                      onChange={e => setClubTag(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-white uppercase"
                    />
                  </div>
                  <select
                    aria-label="Club Region"
                    value={clubRegion}
                    onChange={e =>
                      setClubRegion(
                        e.target.value as 'Global' | 'North America' | 'Europe' | 'Asia-Pacific'
                      )
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-white"
                  >
                    <option value="Asia-Pacific">Asia-Pacific</option>
                    <option value="North America">North America</option>
                    <option value="Europe">Europe</option>
                    <option value="Global">Global</option>
                  </select>
                  <input
                    type="text"
                    aria-label="Club Description"
                    placeholder="Club motto & scrim schedule..."
                    maxLength={240}
                    value={clubDesc}
                    onChange={e => setClubDesc(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-white"
                  />
                  {clubError && <div className="text-xs text-rose-400">{clubError}</div>}
                  <button
                    type="submit"
                    className="w-full py-1.5 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded transition-colors"
                  >
                    Register Club
                  </button>
                </form>

                <div className="space-y-2.5 max-h-60 overflow-y-auto">
                  {socialClubs.map(club => {
                    const joined = joinedClubIds.includes(club.id);
                    return (
                      <div
                        key={club.id}
                        className="p-3 rounded bg-slate-950/70 border border-slate-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white truncate">
                            [{club.tag}] {club.name}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono-tabular whitespace-nowrap shrink-0">
                            {club.memberCount} · {club.region}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{club.description}</p>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-sky-400 font-mono-tabular">
                            Invite: {club.inviteCode} · Club MMR: {club.totalMmr.toLocaleString()}
                          </span>
                          <button
                            type="button"
                            disabled={joined}
                            onClick={() => {
                              setJoinedClubIds(prev => [...prev, club.id]);
                              onJoinSocialClub(club.id);
                            }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                              joined
                                ? 'bg-emerald-950 text-emerald-400'
                                : 'bg-slate-800 hover:bg-slate-700 text-white'
                            }`}
                          >
                            {joined ? 'Joined Squad' : 'Join Squad'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
