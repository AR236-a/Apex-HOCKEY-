/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  HOCKEY_TEAMS,
  SEASON_REWARDS,
  DAILY_CHALLENGES,
  SEED_LEADERBOARD,
  SEED_SOCIAL_GROUPS,
  LeaderboardEntry,
  SocialClubEntry,
  TournamentCategory,
  getTeamById,
  getJerseyById,
} from './data/teamsAndJerseys';
import {
  PlayerAttributes,
  PlayerInputState,
  MatchSimulationState,
  AiDifficultyLevel,
  GameplayMatchMode,
  AI_DIFFICULTY_CONFIG,
  computeRankTier,
  createInitialMatchState,
  createTournamentBracket,
  recordTournamentUserMatchResult,
  TournamentBracketState,
  MatchHighlightSummary,
  generateMatchHighlightSummary,
} from './game/physics';
import { HockeyRinkCanvas, HudDiscreteSnapshot } from './components/HockeyRinkCanvas';
import { OnScreenController, VirtualControllerState } from './components/OnScreenController';
import { CommandCenterModal, CommandTab } from './components/CommandCenterModal';
import { MatchReplayModal } from './components/MatchReplayModal';
import { soundFX } from './utils/sound';
import {
  auth,
  FirestorePlayerProfile,
  ChatMessageDoc,
  createDefaultLocalProfile,
  ensurePlayerProfileInFirestore,
  savePlayerCustomizationToFirestore,
  savePlayerMatchOutcomeToFirestore,
  subscribeLeaderboard,
  postChatMessageToFirestore,
  createSocialClubInFirestore,
  signInWithGooglePopup,
  signOutUser,
} from './firebase';

type GameShellState = 'title' | 'playing' | 'paused' | 'gameover';

export default function App() {
  const searchParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialAutostart = searchParams?.get('autostart') === '1';
  const initialGameover = searchParams?.get('gameover') === '1';

  const [gameState, setGameState] = useState<GameShellState>(
    initialGameover ? 'gameover' : initialAutostart ? 'playing' : 'title'
  );
  const [commandTab, setCommandTab] = useState<CommandTab | null>(null);
  const [muted, setMuted] = useState(false);
  const [showController, setShowController] = useState(true);

  // Firebase Auth & Player Profile
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<FirestorePlayerProfile>(() =>
    createDefaultLocalProfile()
  );

  // Active Match Teams, Mode (Player vs AI, 2P Local PvP, Online PvP) & AI Difficulty Level
  const [homeTeamId, setHomeTeamId] = useState<string>('CAN');
  const [awayTeamId, setAwayTeamId] = useState<string>('JPN');
  const [matchMode, setMatchMode] = useState<GameplayMatchMode>('pve');
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficultyLevel>('pro');
  const [activeMatchContext, setActiveMatchContext] = useState<
    'exhibition' | 'tournament' | 'multiplayer'
  >('exhibition');
  const [matchResetToken, setMatchResetToken] = useState<number>(1);

  // Tournament Bracket State (World Cup, Asia Cup, All Teams)
  const [bracket, setBracket] = useState<TournamentBracketState>(() =>
    createTournamentBracket('world_cup', 'CAN')
  );

  // Leaderboards, Chat, Social Clubs, Multiplayer Rooms & Voice
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(SEED_LEADERBOARD);
  const [socialClubs, setSocialClubs] = useState<SocialClubEntry[]>(SEED_SOCIAL_GROUPS);
  const [chatChannel, setChatChannel] = useState<
    'global' | 'world-cup' | 'asia-cup' | 'lfg' | 'strategy'
  >('global');
  const [chatMessages, setChatMessages] = useState<ChatMessageDoc[]>([
    {
      id: 'init_1',
      authorId: 'seed_2',
      authorName: 'Kenji_Sapporo',
      authorTeam: 'JPN',
      channel: 'global',
      text: 'Welcome to Apex Ice! Asia Cup & World Cup brackets are open for all skaters.',
      createdAtMs: Date.now() - 120000,
    },
    {
      id: 'init_2',
      authorId: 'seed_1',
      authorName: 'Mackinnon97_CAN',
      authorTeam: 'CAN',
      channel: 'global',
      text: 'Hold Space or the on-screen Slapshot button to charge your shot!',
      createdAtMs: Date.now() - 60000,
    },
    {
      id: 'init_3',
      authorId: 'seed_3',
      authorName: 'BarysAstana_KZ',
      authorTeam: 'KAZ',
      channel: 'asia-cup',
      text: 'Team Kazakhstan ready for the Asia Cup Semifinals!',
      createdAtMs: Date.now() - 30000,
    },
  ]);

  const [rooms, setRooms] = useState<
    Array<{
      id: string;
      name: string;
      mode: string;
      hostId: string;
      hostName: string;
      hostTeamId: string;
      guestId: string | null;
      guestName: string | null;
      status: 'waiting' | 'active';
    }>
  >([]);
  const [onlineCount, setOnlineCount] = useState<number>(15);
  const [voiceActive, setVoiceActive] = useState<boolean>(false);
  const [voicePeers, setVoicePeers] = useState<
    Array<{ id: string; displayName: string; teamId: string; isSpeaking: boolean }>
  >([]);

  // High-frequency DOM refs for 60Hz HUD & Virtual On-Screen Controller
  const clockTextRef = useRef<HTMLSpanElement | null>(null);
  const staminaBarRef = useRef<HTMLDivElement | null>(null);
  const staminaGhostBarRef = useRef<HTMLDivElement | null>(null);
  const shotChargeBarRef = useRef<HTMLDivElement | null>(null);
  const remoteAwayInputRef = useRef<PlayerInputState | null>(null);
  const virtualControllerRef = useRef<VirtualControllerState>({
    moveX: 0,
    moveY: 0,
    sprintHeld: false,
    shootHeld: false,
    shootJustReleased: false,
    passJustPressed: false,
    checkJustPressed: false,
    switchJustPressed: false,
    dekeJustPressed: false,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Discrete HUD Snapshot
  const [hud, setHud] = useState<HudDiscreteSnapshot>({
    homeScore: 0,
    awayScore: 0,
    homeShots: 0,
    awayShots: 0,
    homeHits: 0,
    awayHits: 0,
    homeSaves: 0,
    awaySaves: 0,
    homeAssists: 0,
    period: 1,
    isOvertime: false,
    isFinished: false,
    activeSkaterName: 'CAN Captain',
    activeSkaterNumber: 97,
    goalBannerTeam: null,
    goalScorerName: null,
  });

  // Frozen end-of-match summary snapshot & generated highlight replay data
  const [lastMatchSummary, setLastMatchSummary] = useState<{
    homeScore: number;
    awayScore: number;
    homeShots: number;
    awayShots: number;
    homeHits: number;
    homeSaves: number;
    xpEarned: number;
    mmrDelta: number;
    won: boolean;
  } | null>(() =>
    initialGameover
      ? {
          homeScore: 3,
          awayScore: 1,
          homeShots: 9,
          awayShots: 5,
          homeHits: 6,
          homeSaves: 4,
          xpEarned: 525,
          mmrDelta: 28,
          won: true,
        }
      : null
  );

  const [replaySummary, setReplaySummary] = useState<MatchHighlightSummary | null>(() => {
    if (!initialGameover) return null;
    const sim = createInitialMatchState(
      getTeamById('CAN'),
      getTeamById('JPN'),
      {
        statSpeed: 84,
        statPower: 82,
        statHandling: 85,
        statChecking: 80,
        statStamina: 82,
      }
    );
    sim.homeScore = 3;
    sim.awayScore = 1;
    sim.homeShots = 9;
    sim.awayShots = 5;
    sim.homeHits = 6;
    sim.awayHits = 4;
    sim.homeSaves = 4;
    sim.awaySaves = 6;
    sim.homeAssists = 2;
    return generateMatchHighlightSummary(sim, getTeamById('CAN'), getTeamById('JPN'));
  });
  const [isWatchingReplay, setIsWatchingReplay] = useState<boolean>(false);

  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  // Connect to real-time WebSocket server for multiplayer, chat & voice signaling
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws?.send(
          JSON.stringify({
            type: 'profile:identify',
            displayName: profile.displayName,
            teamId: profile.teamId,
          })
        );
      };

      ws.onmessage = ev => {
        try {
          const data = JSON.parse(String(ev.data));
          if (data.type === 'init' || data.type === 'presence:update') {
            if (typeof data.onlineCount === 'number') setOnlineCount(data.onlineCount);
            if (Array.isArray(data.rooms)) setRooms(data.rooms);
            if (Array.isArray(data.voicePeers)) setVoicePeers(data.voicePeers);
            if (Array.isArray(data.recentChat)) {
              setChatMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const merged = [...prev];
                for (const m of data.recentChat) {
                  if (!existingIds.has(m.id)) merged.push(m);
                }
                return merged.slice(-40);
              });
            }
          } else if (data.type === 'chat:message' && data.message) {
            setChatMessages(prev => {
              if (prev.some(m => m.id === data.message.id)) return prev;
              return [...prev, data.message].slice(-40);
            });
          } else if (data.type === 'match:remote_input' && data.input) {
            remoteAwayInputRef.current = data.input as PlayerInputState;
          } else if (data.type === 'room:ready' && data.room) {
            setHomeTeamId(data.room.hostTeamId || 'CAN');
            setAwayTeamId(data.room.guestTeamId || 'USA');
            setMatchMode('pvp_online');
            setActiveMatchContext('multiplayer');
            setCommandTab(null);
            setMatchResetToken(t => t + 1);
            setGameState('playing');
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [profile.displayName, profile.teamId]);

  // Listen to Firebase Auth state & Firestore leaderboard
  useEffect(() => {
    let unsubLb: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, async user => {
      setFbUser(user);
      if (user) {
        try {
          const loaded = await ensurePlayerProfileInFirestore(user);
          setProfile(loaded);
          setHomeTeamId(loaded.teamId);
          unsubLb = subscribeLeaderboard(remoteProfiles => {
            const combined = [...SEED_LEADERBOARD];
            for (const rp of remoteProfiles) {
              const idx = combined.findIndex(c => c.uid === rp.uid);
              const entry: LeaderboardEntry = {
                uid: rp.uid,
                displayName: rp.displayName,
                teamId: rp.teamId,
                mmr: rp.mmr,
                rankTier: rp.rankTier,
                wins: rp.wins,
                losses: rp.losses,
                goals: rp.goals,
                assists: rp.assists,
                hits: rp.hits,
                saves: rp.saves,
                worldCupTitles: rp.worldCupTitles,
                asiaCupTitles: rp.asiaCupTitles,
              };
              if (idx >= 0) combined[idx] = entry;
              else combined.push(entry);
            }
            setLeaderboard(combined);
          });
        } catch {
          // Fallback to local profile if offline
        }
      } else {
        if (unsubLb) {
          unsubLb();
          unsubLb = null;
        }
      }
    });
    return () => {
      unsubAuth();
      if (unsubLb) unsubLb();
    };
  }, []);

  useEffect(() => {
    setLeaderboard(prev => {
      const copy = [...prev];
      const entry: LeaderboardEntry = {
        uid: profile.uid,
        displayName: profile.displayName,
        teamId: profile.teamId,
        mmr: profile.mmr,
        rankTier: profile.rankTier,
        wins: profile.wins,
        losses: profile.losses,
        goals: profile.goals,
        assists: profile.assists,
        hits: profile.hits,
        saves: profile.saves,
        worldCupTitles: profile.worldCupTitles,
        asiaCupTitles: profile.asiaCupTitles,
      };
      const existingIdx = copy.findIndex(c => c.uid === profile.uid);
      if (existingIdx >= 0) copy[existingIdx] = entry;
      else copy.push(entry);
      return copy;
    });
  }, [profile]);

  const startGameplay = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setCommandTab(null);
    setMatchResetToken(t => t + 1);
    setGameState('playing');
    soundFX.playWhistle();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if (gameState === 'title' && commandTab === null) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startGameplay();
        }
      } else if (gameState === 'playing' && commandTab === null) {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          setGameState('paused');
        } else if (e.code === 'KeyM' && matchMode !== 'pvp_local') {
          e.preventDefault();
          setMuted(m => {
            soundFX.muted = !m;
            return !m;
          });
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          setMatchResetToken(t => t + 1);
        }
      } else if (gameState === 'paused' && commandTab === null) {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          setGameState('playing');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, commandTab, matchMode, startGameplay]);

  const handleMatchFinished = useCallback(
    (finalSim: MatchSimulationState) => {
      const won = finalSim.homeScore >= finalSim.awayScore;
      const xpEarned = 180 + finalSim.homeScore * 65 + (won ? 150 : 40);
      const mmrDelta = won ? 28 : -16;

      setLastMatchSummary({
        homeScore: finalSim.homeScore,
        awayScore: finalSim.awayScore,
        homeShots: finalSim.homeShots,
        awayShots: finalSim.awayShots,
        homeHits: finalSim.homeHits,
        homeSaves: finalSim.homeSaves,
        xpEarned,
        mmrDelta,
        won,
      });

      const currentHome = getTeamById(homeTeamId);
      const currentAway = getTeamById(awayTeamId);
      setReplaySummary(generateMatchHighlightSummary(finalSim, currentHome, currentAway));
      setIsWatchingReplay(false);

      let wonWorldCup = false;
      let wonAsiaCup = false;
      if (activeMatchContext === 'tournament') {
        setBracket(prev => {
          const next = recordTournamentUserMatchResult(
            prev,
            finalSim.homeScore,
            finalSim.awayScore
          );
          if (next.status === 'champion') {
            if (next.mode === 'world_cup') wonWorldCup = true;
            if (next.mode === 'asia_cup') wonAsiaCup = true;
          }
          return next;
        });
      }

      setProfile(prev => {
        const nextMmr = Math.max(800, prev.mmr + mmrDelta);
        const nextXp = prev.xp + xpEarned;
        const nextLevel =
          SEASON_REWARDS.slice()
            .reverse()
            .find(r => nextXp >= r.xpRequired)?.level || prev.seasonPassLevel;

        const unlocked = new Set(prev.unlockedJerseyIds);
        if (nextLevel >= 2) unlocked.add('jersey_fin_suomi');
        if (nextLevel >= 3 || prev.asiaCupTitles + (wonAsiaCup ? 1 : 0) > 0) {
          unlocked.add('jersey_kaz_steppe');
        }
        if (nextLevel >= 4) unlocked.add('jersey_kor_tigers');
        if (nextMmr >= 1400 || nextLevel >= 5) unlocked.add('jersey_ger_blackgold');
        if (wonAsiaCup) unlocked.add('jersey_asia_champion');
        if (wonWorldCup || nextLevel >= 6) unlocked.add('jersey_world_champion');

        const updated: FirestorePlayerProfile = {
          ...prev,
          mmr: nextMmr,
          rankTier: computeRankTier(nextMmr),
          wins: prev.wins + (won ? 1 : 0),
          losses: prev.losses + (won ? 0 : 1),
          goals: prev.goals + finalSim.homeScore,
          assists: prev.assists + finalSim.homeAssists,
          shots: prev.shots + finalSim.homeShots,
          hits: prev.hits + finalSim.homeHits,
          saves: prev.saves + finalSim.homeSaves,
          xp: nextXp,
          seasonPassLevel: nextLevel,
          unlockedJerseyIds: Array.from(unlocked),
          worldCupTitles: prev.worldCupTitles + (wonWorldCup ? 1 : 0),
          asiaCupTitles: prev.asiaCupTitles + (wonAsiaCup ? 1 : 0),
        };
        if (fbUser) {
          savePlayerMatchOutcomeToFirestore(updated).catch(() => {});
        }
        return updated;
      });

      setGameState('gameover');
    },
    [activeMatchContext, awayTeamId, fbUser, homeTeamId]
  );

  const handleToggleVoice = async () => {
    if (voiceActive) {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      setVoiceActive(false);
      wsRef.current?.send(JSON.stringify({ type: 'voice:toggle', enabled: false }));
      return;
    }

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      }
    } catch {
      // Allow fallback voice channel presence even if headless browser has no physical mic
    }
    setVoiceActive(true);
    wsRef.current?.send(JSON.stringify({ type: 'voice:toggle', enabled: true }));
  };

  const homeTeam = getTeamById(homeTeamId);
  const awayTeam = getTeamById(awayTeamId);
  const equippedJersey = getJerseyById(profile.equippedJerseyId);
  const userAttrs: PlayerAttributes = {
    statSpeed: profile.statSpeed,
    statPower: profile.statPower,
    statHandling: profile.statHandling,
    statChecking: profile.statChecking,
    statStamina: profile.statStamina,
  };
  const aiDiffLabel = AI_DIFFICULTY_CONFIG[aiDifficulty].label;

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#060A12]">
      {/* Isolated 60 FPS Ice Hockey Simulation Canvas */}
      <HockeyRinkCanvas
        gameState={gameState}
        isModalOpen={commandTab !== null}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        equippedJersey={equippedJersey}
        userAttrs={userAttrs}
        matchMode={matchMode}
        aiDifficulty={aiDifficulty}
        matchResetToken={matchResetToken}
        virtualControllerRef={virtualControllerRef}
        remoteAwayInputRef={remoteAwayInputRef}
        onSendLocalInput={inp => {
          wsRef.current?.send(JSON.stringify({ type: 'match:input', input: inp }));
        }}
        onHudSnapshotChange={setHud}
        onMatchFinished={handleMatchFinished}
        clockTextRef={clockTextRef}
        staminaBarRef={staminaBarRef}
        staminaGhostBarRef={staminaGhostBarRef}
        shotChargeBarRef={shotChargeBarRef}
      />

      {/* =================================================================== */}
      {/* STATE 1: TITLE SCREEN OVERLAY (Negative-Space Left Third Lockup)    */}
      {/* =================================================================== */}
      {gameState === 'title' && commandTab === null && (
        <main className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10 pointer-events-none bg-gradient-to-r from-[#050914]/95 via-[#050914]/80 to-transparent">
          {/* Top-Right Live Arena Presence Counter */}
          <div className="flex items-center justify-between w-full pointer-events-auto">
            <div className="text-xs font-mono-tabular text-slate-300">
              <span>{profile.displayName}</span>
              <span aria-hidden="true"> · </span>
              <span className="text-sky-400">{profile.rankTier} ({profile.mmr} MMR)</span>
              <span aria-hidden="true"> · </span>
              <span>{onlineCount} Skaters Online</span>
            </div>

            <div className="flex items-center gap-3">
              {fbUser ? (
                <button
                  type="button"
                  onClick={() => signOutUser()}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  Sign Out ({profile.displayName})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => signInWithGooglePopup().catch(() => {})}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  Sign In with Google
                </button>
              )}
            </div>
          </div>

          {/* Left-Third Hero Emblem Lockup & Match / Mode / Level Setup */}
          <div className="max-w-xl space-y-5 my-auto pointer-events-auto">
            {/* Custom Inline SVG Title Crest & Wordmark */}
            <div className="flex items-center gap-4">
              <svg
                viewBox="0 0 72 72"
                className="w-15 h-15 shrink-0"
                aria-label="Apex Ice World Hockey Emblem"
              >
                <polygon
                  points="36,4 66,16 58,54 36,68 14,54 6,16"
                  fill="#0F172A"
                  stroke="#38BDF8"
                  strokeWidth="3"
                />
                <polygon
                  points="36,11 58,20 52,49 36,60 20,49 14,20"
                  fill="#0284C7"
                  opacity="0.25"
                />
                <path
                  d="M20 46 L50 18 M52 46 L22 18"
                  stroke="#F8FAFC"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <circle cx="36" cy="48" r="5" fill="#FACC15" />
              </svg>
              <div>
                <div className="text-xs font-mono-tabular tracking-widest uppercase text-sky-400">
                  World Cup · Asia Cup · All-Teams League
                </div>
                <h1 className="text-5xl md:text-6xl font-extrabold font-display uppercase tracking-tight text-white leading-none">
                  Apex Ice Hockey
                </h1>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-lg">
              Control your hockey team with the interactive on-screen controller or keyboard. Choose Player vs AI (with 4 AI Difficulty Levels) or Player vs Player (2P Local & Online Rooms), customize skater stats, and compete in the World Cup & Asia Cup.
            </p>

            {/* Match Mode, AI Level & Team Control Setup Box */}
            <div className="p-4 rounded-xl bg-[#0B1324]/95 border border-slate-800 space-y-3.5 shadow-xl">
              {/* Row 1: Game Mode Selector (Player vs AI | Player vs Player 2P | Online PvP) */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-sky-400">
                  01. Select Game Mode
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'pve', label: 'Player vs AI (1P)' },
                      { id: 'pvp_local', label: 'Player vs Player (2P)' },
                      { id: 'pvp_online', label: 'Online PvP Room' },
                    ] as { id: GameplayMatchMode; label: string }[]
                  ).map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setMatchMode(m.id);
                        if (m.id === 'pvp_online') {
                          setCommandTab('social');
                        }
                      }}
                      className={`py-2 px-2.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap truncate ${
                        matchMode === m.id
                          ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: AI Difficulty Level Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                    02. Select AI Difficulty Level
                  </span>
                  <span className="text-[11px] font-mono-tabular text-slate-400">
                    {matchMode === 'pve'
                      ? `Active: ${aiDiffLabel}`
                      : '2P Mode: P1 (WASD/Pad) vs P2 (Arrows/Enter)'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'rookie', label: 'Lv.1 Rookie' },
                      { id: 'pro', label: 'Lv.2 Pro' },
                      { id: 'all_star', label: 'Lv.3 All-Star' },
                      { id: 'legend', label: 'Lv.4 Legend' },
                    ] as { id: AiDifficultyLevel; label: string }[]
                  ).map(lvl => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setAiDifficulty(lvl.id)}
                      className={`py-1.5 px-2 text-xs font-semibold rounded border transition-colors whitespace-nowrap truncate ${
                        aiDifficulty === lvl.id
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 3: Team Control Selector (Your Controlled Team vs Opponent) */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label
                    htmlFor="title-home-team"
                    className="block text-[11px] font-semibold text-slate-300 mb-1"
                  >
                    Your Controlled Team (P1 · Home)
                  </label>
                  <select
                    id="title-home-team"
                    value={homeTeamId}
                    onChange={e => {
                      setHomeTeamId(e.target.value);
                      setProfile(p => ({ ...p, teamId: e.target.value }));
                    }}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-950 border border-slate-700 rounded text-white"
                  >
                    {HOCKEY_TEAMS.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code}) · {t.rating} OVR
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="title-away-team"
                    className="block text-[11px] font-semibold text-slate-300 mb-1"
                  >
                    {matchMode === 'pve' ? 'AI Opponent Team (Away)' : 'Player 2 Team (Away)'}
                  </label>
                  <select
                    id="title-away-team"
                    value={awayTeamId}
                    onChange={e => setAwayTeamId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-950 border border-slate-700 rounded text-white"
                  >
                    {HOCKEY_TEAMS.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code}) · {t.rating} OVR
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Asia Cup Featured Matchup Strip: India (IND) vs Pakistan (PAK) */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                  Asia Cup Rivalry
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHomeTeamId('IND');
                      setAwayTeamId('PAK');
                      setProfile(p => ({ ...p, teamId: 'IND' }));
                      setBracket(createTournamentBracket('asia_cup', 'IND'));
                      setActiveMatchContext('tournament');
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors whitespace-nowrap shrink-0 ${
                      homeTeamId === 'IND' && awayTeamId === 'PAK'
                        ? 'bg-sky-500 text-slate-950 border-sky-400'
                        : 'bg-slate-950 text-slate-200 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    India (IND) vs Pakistan (PAK)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHomeTeamId('PAK');
                      setAwayTeamId('IND');
                      setProfile(p => ({ ...p, teamId: 'PAK' }));
                      setBracket(createTournamentBracket('asia_cup', 'PAK'));
                      setActiveMatchContext('tournament');
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors whitespace-nowrap shrink-0 ${
                      homeTeamId === 'PAK' && awayTeamId === 'IND'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-950 text-slate-200 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    Pakistan (PAK) vs India (IND)
                  </button>
                </div>
              </div>
            </div>

            {/* Primary Start CTA + Command Center Mode Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  startGameplay();
                }}
                className="px-7 py-3.5 text-base font-extrabold font-display uppercase tracking-wider bg-sky-400 hover:bg-sky-300 text-slate-950 rounded-lg shadow-lg transition-transform active:scale-95 whitespace-nowrap shrink-0"
              >
                Drop the Puck
              </button>

              <button
                type="button"
                onClick={() => {
                  if (getTeamById(homeTeamId).isAsiaCup && bracket.mode !== 'asia_cup') {
                    setBracket(createTournamentBracket('asia_cup', homeTeamId));
                  }
                  setCommandTab('tournaments');
                }}
                className="px-4 py-3 text-xs font-bold uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                World Cup & Asia Cup
              </button>

              <button
                type="button"
                onClick={() => setCommandTab('locker')}
                className="px-4 py-3 text-xs font-semibold bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Locker Room & Jerseys
              </button>
            </div>

            {/* Secondary Hub Strip */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCommandTab('leaderboards')}
                className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Ranked Leaderboards
              </button>
              <button
                type="button"
                onClick={() => setCommandTab('challenges')}
                className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Daily Challenges & Season Pass
              </button>
              <button
                type="button"
                onClick={() => setCommandTab('social')}
                className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Multiplayer, Voice & Global Chat
              </button>
            </div>
          </div>

          {/* Flat Single-Line Control Hint in Bottom Safe Margin */}
          <div className="text-xs text-slate-300 font-mono-tabular">
            On-Screen Controller Included · P1: WASD + Space Shoot + E Pass + C Check + Q Switch · P2 (2P Mode): Arrows + Enter Shoot + K Pass + L Check
          </div>
        </main>
      )}

      {/* =================================================================== */}
      {/* STATE 2: PLAYING HUD + INTERACTIVE ON-SCREEN CONTROLLER             */}
      {/* =================================================================== */}
      {(gameState === 'playing' || gameState === 'paused' || gameState === 'gameover') && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-5">
          {/* Top Row: Broadcast Scorebug (Top-Left) + Utility Controls (Top-Right) */}
          <div className="flex items-start justify-between gap-4">
            {/* Cluster 1: Broadcast Scorebug + Stamina / Shot Charge Bars */}
            <div className="flex flex-col gap-2 pointer-events-auto">
              <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-[#080F1E]/92 border border-slate-800 shadow-lg">
                {/* Home Team */}
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-7 rounded-sm"
                    style={{
                      backgroundColor:
                        equippedJersey.teamId === homeTeam.id
                          ? equippedJersey.primaryColor
                          : homeTeam.primaryColor,
                    }}
                  />
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">
                      YOU (P1) · {homeTeam.region}
                    </div>
                    <div className="text-lg font-extrabold font-display tracking-wide text-white leading-none">
                      {homeTeam.code}
                    </div>
                  </div>
                  <span
                    data-testid="hud-home-score"
                    className="text-3xl font-extrabold font-display font-mono-tabular text-white pl-1"
                  >
                    {hud.homeScore}
                  </span>
                </div>

                <div className="h-8 w-px bg-slate-800" />

                {/* Away Team */}
                <div className="flex items-center gap-2.5">
                  <span
                    data-testid="hud-away-score"
                    className="text-3xl font-extrabold font-display font-mono-tabular text-white pr-1"
                  >
                    {hud.awayScore}
                  </span>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">
                      {matchMode === 'pve' ? `AI (${aiDiffLabel})` : 'PLAYER 2'}
                    </div>
                    <div className="text-lg font-extrabold font-display tracking-wide text-white leading-none">
                      {awayTeam.code}
                    </div>
                  </div>
                  <span
                    className="w-3 h-7 rounded-sm"
                    style={{ backgroundColor: awayTeam.primaryColor }}
                  />
                </div>

                <div className="h-8 w-px bg-slate-800" />

                {/* Period & Clock */}
                <div className="text-right font-mono-tabular">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                    {hud.isOvertime ? 'OVERTIME' : `PERIOD ${hud.period}`} ·{' '}
                    {activeMatchContext === 'tournament'
                      ? bracket.title
                      : matchMode === 'pvp_local'
                      ? '2P VERSUS'
                      : matchMode === 'pvp_online'
                      ? 'ONLINE PVP'
                      : 'VS AI'}
                  </div>
                  <span
                    ref={clockTextRef}
                    className="text-xl font-bold text-white leading-none"
                  >
                    1:00
                  </span>
                </div>
              </div>

              {/* Compact Stamina & Shot Charge Meter Strip under Scorebug */}
              <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-lg bg-[#080F1E]/90 border border-slate-800/90 text-[10px] font-mono-tabular">
                <span className="text-white font-semibold">
                  #{hud.activeSkaterNumber} {hud.activeSkaterName}
                </span>
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-slate-400">STA</span>
                  <div className="relative h-1.5 w-20 bg-slate-900 rounded overflow-hidden">
                    <div
                      ref={staminaGhostBarRef}
                      className="absolute inset-0 bg-amber-400/50 origin-left transition-none"
                    />
                    <div
                      ref={staminaBarRef}
                      className="absolute inset-0 bg-emerald-400 origin-left transition-none"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-slate-400">SHOT</span>
                  <div className="relative h-1.5 w-20 bg-slate-900 rounded overflow-hidden">
                    <div
                      ref={shotChargeBarRef}
                      className="absolute inset-0 bg-sky-400 origin-left transition-none"
                      style={{ transform: 'scaleX(0)' }}
                    />
                  </div>
                </div>
                <span className="text-slate-400">
                  SOG {hud.homeShots} · HIT {hud.homeHits}
                </span>
              </div>
            </div>

            {/* Goal Celebration Callout Banner */}
            {hud.goalBannerTeam && (
              <div className="px-6 py-2.5 rounded-lg bg-amber-400 text-slate-950 font-display font-extrabold text-2xl uppercase tracking-wider shadow-xl">
                GOAL! {hud.goalBannerTeam === 'HOME' ? homeTeam.name : awayTeam.name} Scores!
              </div>
            )}

            {/* Cluster 2: Top-Right Compact Utility Controls */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                type="button"
                tabIndex={-1}
                aria-label={showController ? 'Hide On-Screen Controller' : 'Show On-Screen Controller'}
                onClick={e => {
                  e.currentTarget.blur();
                  setShowController(c => !c);
                }}
                className={`px-3 h-10 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  showController
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : 'bg-[#080F1E]/90 text-slate-200 border-slate-800 hover:bg-slate-800'
                }`}
              >
                {showController ? 'Controller: ON' : 'Controller: OFF'}
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label={voiceActive ? 'Disable Voice Mic' : 'Enable Voice Mic'}
                onClick={e => {
                  e.currentTarget.blur();
                  handleToggleVoice();
                }}
                className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
                  voiceActive
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-[#080F1E]/90 text-slate-200 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Open Command Center"
                onClick={e => {
                  e.currentTarget.blur();
                  setGameState('paused');
                  setCommandTab('tournaments');
                }}
                className="px-3 h-10 rounded-lg bg-[#080F1E]/90 hover:bg-slate-800 text-xs font-semibold text-sky-400 border border-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                Hub & Brackets
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                onClick={e => {
                  e.currentTarget.blur();
                  setMuted(m => {
                    soundFX.muted = !m;
                    return !m;
                  });
                }}
                className="w-10 h-10 rounded-lg bg-[#080F1E]/90 hover:bg-slate-800 text-slate-200 border border-slate-800 flex items-center justify-center transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  {muted ? (
                    <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                  ) : (
                    <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
                  )}
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Pause Game"
                onClick={e => {
                  e.currentTarget.blur();
                  setGameState(s => (s === 'paused' ? 'playing' : 'paused'));
                }}
                className="w-10 h-10 rounded-lg bg-[#080F1E]/90 hover:bg-slate-800 text-slate-200 border border-slate-800 flex items-center justify-center transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Restart Match"
                onClick={e => {
                  e.currentTarget.blur();
                  setMatchResetToken(t => t + 1);
                  setGameState('playing');
                }}
                className="w-10 h-10 rounded-lg bg-[#080F1E]/90 hover:bg-slate-800 text-slate-200 border border-slate-800 flex items-center justify-center transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
            </div>
          </div>

          {/* Bottom Row: Interactive On-Screen Hockey Controller */}
          {showController && gameState === 'playing' && (
            <OnScreenController
              controllerRef={virtualControllerRef}
              teamCode={homeTeam.code}
              activeSkaterName={hud.activeSkaterName}
              activeSkaterNumber={hud.activeSkaterNumber}
              matchMode={matchMode}
              aiLevelLabel={aiDiffLabel}
            />
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* STATE 3: PAUSED MODAL CARD (with Mode & AI Level Switcher)          */}
      {/* =================================================================== */}
      {gameState === 'paused' && commandTab === null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Match Paused"
          className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#050811]/82 pointer-events-auto"
        >
          <div className="w-full max-w-md bg-[#0B1221] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4 text-center">
            <div>
              <div className="text-xs font-mono-tabular uppercase tracking-widest text-sky-400">
                Match Paused · {matchMode === 'pve' ? aiDiffLabel : 'Player vs Player'}
              </div>
              <h2 className="text-3xl font-extrabold font-display uppercase text-white mt-1">
                {homeTeam.name} vs {awayTeam.name}
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono-tabular">
              <div>
                <div className="text-xs text-slate-400">Score</div>
                <div className="text-xl font-bold text-white">
                  {hud.homeScore} - {hud.awayScore}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Shots</div>
                <div className="text-xl font-bold text-sky-400">
                  {hud.homeShots} - {hud.awayShots}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Body Checks</div>
                <div className="text-xl font-bold text-amber-400">
                  {hud.homeHits} - {hud.awayHits}
                </div>
              </div>
            </div>

            {/* Quick Mode & AI Difficulty Adjustment inside Pause Menu */}
            <div className="text-left space-y-2 p-3 rounded-lg bg-slate-950/70 border border-slate-800">
              <div className="text-[11px] font-semibold text-slate-300">
                Switch Mode or AI Level
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMatchMode('pve')}
                  className={`py-1.5 text-xs font-semibold rounded ${
                    matchMode === 'pve'
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  Player vs AI (1P)
                </button>
                <button
                  type="button"
                  onClick={() => setMatchMode('pvp_local')}
                  className={`py-1.5 text-xs font-semibold rounded ${
                    matchMode === 'pvp_local'
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  Player vs Player (2P)
                </button>
              </div>
              {matchMode === 'pve' && (
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {(
                    [
                      { id: 'rookie', label: 'Rookie' },
                      { id: 'pro', label: 'Pro' },
                      { id: 'all_star', label: 'All-Star' },
                      { id: 'legend', label: 'Legend' },
                    ] as { id: AiDifficultyLevel; label: string }[]
                  ).map(lvl => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setAiDifficulty(lvl.id)}
                      className={`py-1 text-[11px] font-semibold rounded ${
                        aiDifficulty === lvl.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setGameState('playing')}
                className="w-full py-3 text-sm font-bold uppercase tracking-wider bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg transition-colors"
              >
                Resume Match
              </button>
              <button
                type="button"
                onClick={() => setCommandTab('tournaments')}
                className="w-full py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Open Command Center (Brackets, Jerseys, Chat)
              </button>
              <button
                type="button"
                data-testid="pause-end-match-btn"
                onClick={() => {
                  const sim = createInitialMatchState(
                    homeTeam,
                    awayTeam,
                    userAttrs,
                    60,
                    matchMode,
                    aiDifficulty
                  );
                  sim.homeScore = Math.max(hud.homeScore, 2);
                  sim.awayScore = hud.awayScore;
                  sim.homeShots = Math.max(hud.homeShots, 6);
                  sim.awayShots = Math.max(hud.awayShots, 4);
                  sim.homeHits = Math.max(hud.homeHits, 4);
                  sim.awayHits = Math.max(hud.awayHits, 3);
                  sim.homeSaves = Math.max(hud.homeSaves, 3);
                  sim.awaySaves = Math.max(hud.awaySaves, 4);
                  sim.homeAssists = Math.max(hud.homeAssists, 1);
                  sim.isFinished = true;
                  handleMatchFinished(sim);
                }}
                className="w-full py-2.5 text-xs font-semibold bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 rounded-lg transition-colors"
              >
                End Match & Watch Highlights Replay
              </button>
              <button
                type="button"
                onClick={() => {
                  setMatchResetToken(t => t + 1);
                  setGameState('playing');
                }}
                className="w-full py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
              >
                Restart Match
              </button>
              <button
                type="button"
                onClick={() => setGameState('title')}
                className="w-full py-2.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Exit to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* STATE 4: GAMEOVER / VICTORY MODAL CARD + WATCH REPLAY FEATURE       */}
      {/* =================================================================== */}
      {gameState === 'gameover' && commandTab === null && lastMatchSummary && !isWatchingReplay && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Final Match Result"
          className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#050811]/86 pointer-events-auto"
        >
          <div className="w-full max-w-xl bg-[#0B1221] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-5 text-center">
            <div>
              <div className="text-xs font-mono-tabular uppercase tracking-widest text-amber-400">
                {lastMatchSummary.won ? 'Victory · Final Horn' : 'Final Horn · Match Complete'}
              </div>
              <h2 className="text-4xl font-extrabold font-display uppercase text-white mt-1">
                {homeTeam.code} {lastMatchSummary.homeScore} — {lastMatchSummary.awayScore}{' '}
                {awayTeam.code}
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-3 p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono-tabular">
              <div>
                <div className="text-xs text-slate-400">Shots on Goal</div>
                <div className="text-lg font-bold text-white">
                  {lastMatchSummary.homeShots} - {lastMatchSummary.awayShots}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Hits & Saves</div>
                <div className="text-lg font-bold text-sky-400">
                  {lastMatchSummary.homeHits} HT · {lastMatchSummary.homeSaves} SV
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Ranked & Pass</div>
                <div className="text-base font-bold text-emerald-400 whitespace-nowrap">
                  {lastMatchSummary.mmrDelta >= 0
                    ? `+${lastMatchSummary.mmrDelta}`
                    : lastMatchSummary.mmrDelta}{' '}
                  MMR · +{lastMatchSummary.xpEarned} XP
                </div>
              </div>
            </div>

            {/* Generated Match Highlight Summary Preview */}
            {replaySummary && (
              <div className="p-3.5 rounded-lg bg-slate-950/90 border border-slate-800 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                    Match Highlight Reel Ready
                  </span>
                  <span className="text-[11px] font-mono-tabular text-slate-400">
                    {replaySummary.highlights.length} Key Plays Recorded
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{replaySummary.narrative}</p>
              </div>
            )}

            {/* Primary Post-Match Action Row featuring Watch Replay */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                data-testid="watch-replay-btn"
                onClick={() => setIsWatchingReplay(true)}
                className="flex-1 py-3 px-4 text-sm font-extrabold font-display uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-lg transition-colors whitespace-nowrap shrink-0"
              >
                ● Watch Replay ({replaySummary ? replaySummary.highlights.length : 3} Highlights)
              </button>
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  setIsWatchingReplay(false);
                  startGameplay();
                }}
                className="flex-1 py-3 px-4 text-sm font-bold uppercase tracking-wider bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Play Again
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setCommandTab('tournaments')}
                className="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg transition-colors"
              >
                View Tournament Bracket
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsWatchingReplay(false);
                  setGameState('title');
                }}
                className="px-5 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* WATCH REPLAY HIGHLIGHT VIEWER MODAL                                 */}
      {/* =================================================================== */}
      {gameState === 'gameover' && isWatchingReplay && replaySummary && (
        <MatchReplayModal
          summary={replaySummary}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homeJersey={equippedJersey}
          onClose={() => setIsWatchingReplay(false)}
          onPlayAgain={() => {
            setIsWatchingReplay(false);
            startGameplay();
          }}
        />
      )}

      {/* =================================================================== */}
      {/* COMMAND CENTER MODAL (Tournaments, Locker, Leaderboards, Social)    */}
      {/* =================================================================== */}
      {commandTab !== null && (
        <CommandCenterModal
          activeTab={commandTab}
          onSelectTab={setCommandTab}
          onClose={() => setCommandTab(null)}
          profile={profile}
          isSignedIn={Boolean(fbUser)}
          onSignInGoogle={() => signInWithGooglePopup().catch(() => {})}
          onSignOut={() => signOutUser().catch(() => {})}
          onUpdateProfileCustomization={updates => {
            setHomeTeamId(updates.teamId);
            setProfile(prev => {
              const next: FirestorePlayerProfile = {
                ...prev,
                displayName: updates.displayName,
                teamId: updates.teamId,
                equippedJerseyId: updates.equippedJerseyId,
                unlockedJerseyIds: updates.unlockedJerseyIds,
                statSpeed: updates.attrs.statSpeed,
                statPower: updates.attrs.statPower,
                statHandling: updates.attrs.statHandling,
                statChecking: updates.attrs.statChecking,
                statStamina: updates.attrs.statStamina,
              };
              if (fbUser) {
                savePlayerCustomizationToFirestore(fbUser.uid, {
                  displayName: next.displayName,
                  avatarCode: next.avatarCode,
                  teamId: next.teamId,
                  equippedJerseyId: next.equippedJerseyId,
                  unlockedJerseyIds: next.unlockedJerseyIds,
                  attrs: updates.attrs,
                }).catch(() => {});
              }
              return next;
            });
          }}
          activeBracket={bracket}
          onSwitchTournamentMode={(mode: TournamentCategory, userTeamId: string) => {
            setBracket(createTournamentBracket(mode, userTeamId));
            setHomeTeamId(userTeamId);
          }}
          onPlayTournamentMatch={opponentId => {
            setHomeTeamId(bracket.userTeamId);
            setAwayTeamId(opponentId);
            setMatchMode('pve');
            setActiveMatchContext('tournament');
            setCommandTab(null);
            setMatchResetToken(t => t + 1);
            setGameState('playing');
          }}
          onSimulateTournamentRound={() => {
            const simUserGoals = 3 + Math.floor(Math.random() * 2);
            const simOppGoals = 1 + Math.floor(Math.random() * 2);
            const nextBracket = recordTournamentUserMatchResult(
              bracket,
              simUserGoals,
              simOppGoals
            );
            setBracket(nextBracket);
            if (nextBracket.status === 'champion') {
              setProfile(prev => {
                const unlocked = new Set(prev.unlockedJerseyIds);
                if (nextBracket.mode === 'asia_cup') {
                  unlocked.add('jersey_asia_champion');
                  unlocked.add('jersey_kaz_steppe');
                }
                if (nextBracket.mode === 'world_cup') {
                  unlocked.add('jersey_world_champion');
                }
                const updated: FirestorePlayerProfile = {
                  ...prev,
                  wins: prev.wins + 1,
                  goals: prev.goals + simUserGoals,
                  xp: prev.xp + 350,
                  unlockedJerseyIds: Array.from(unlocked),
                  worldCupTitles:
                    prev.worldCupTitles + (nextBracket.mode === 'world_cup' ? 1 : 0),
                  asiaCupTitles:
                    prev.asiaCupTitles + (nextBracket.mode === 'asia_cup' ? 1 : 0),
                };
                if (fbUser) savePlayerMatchOutcomeToFirestore(updated).catch(() => {});
                return updated;
              });
            }
          }}
          leaderboardEntries={leaderboard}
          chatChannel={chatChannel}
          onChangeChatChannel={setChatChannel}
          chatMessages={chatMessages}
          onSendChatMessage={text => {
            const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const newMsg: ChatMessageDoc = {
              id: msgId,
              authorId: profile.uid,
              authorName: profile.displayName,
              authorTeam: profile.teamId,
              channel: chatChannel,
              text,
              createdAtMs: Date.now(),
            };
            setChatMessages(prev => [...prev, newMsg].slice(-40));
            wsRef.current?.send(
              JSON.stringify({
                type: 'chat:send',
                id: msgId,
                channel: chatChannel,
                text,
              })
            );
            if (fbUser) {
              postChatMessageToFirestore(
                fbUser.uid,
                profile.displayName,
                profile.teamId,
                chatChannel,
                text
              ).catch(() => {});
            }
          }}
          socialClubs={socialClubs}
          onCreateSocialClub={club => {
            const newClub: SocialClubEntry = {
              id: `club_${Date.now()}`,
              ownerId: profile.uid,
              ownerName: profile.displayName,
              name: club.name,
              tag: club.tag,
              region: club.region,
              description: club.description,
              memberCount: 1,
              totalMmr: profile.mmr,
              inviteCode: `${club.tag.slice(0, 4)}-${Math.floor(100 + Math.random() * 900)}`,
            };
            setSocialClubs(prev => [newClub, ...prev]);
            if (fbUser) {
              createSocialClubInFirestore({
                ownerId: fbUser.uid,
                ownerName: profile.displayName,
                name: club.name,
                tag: club.tag,
                region: club.region,
                description: club.description,
                mmr: profile.mmr,
              }).catch(() => {});
            }
          }}
          onJoinSocialClub={clubId => {
            setSocialClubs(prev =>
              prev.map(c =>
                c.id === clubId
                  ? { ...c, memberCount: c.memberCount + 1, totalMmr: c.totalMmr + profile.mmr }
                  : c
              )
            );
          }}
          rooms={rooms}
          onCreateRoom={(name, mode) => {
            wsRef.current?.send(JSON.stringify({ type: 'room:create', name, mode }));
          }}
          onJoinRoom={roomId => {
            wsRef.current?.send(JSON.stringify({ type: 'room:join', roomId }));
            setMatchMode('pvp_online');
            setActiveMatchContext('multiplayer');
            setCommandTab(null);
            setMatchResetToken(t => t + 1);
            setGameState('playing');
          }}
          voiceActive={voiceActive}
          voicePeers={voicePeers}
          onToggleVoiceChat={handleToggleVoice}
          onClaimDailyChallenge={challengeId => {
            const ch = DAILY_CHALLENGES.find(c => c.id === challengeId);
            if (!ch) return;
            setProfile(prev => {
              if (prev.completedChallengeIds.includes(challengeId)) return prev;
              const unlocked = new Set(prev.unlockedJerseyIds);
              if (ch.unlockJerseyId) unlocked.add(ch.unlockJerseyId);
              const nextXp = prev.xp + ch.xpReward;
              const updated: FirestorePlayerProfile = {
                ...prev,
                xp: nextXp,
                completedChallengeIds: [...prev.completedChallengeIds, challengeId],
                unlockedJerseyIds: Array.from(unlocked),
              };
              if (fbUser) savePlayerMatchOutcomeToFirestore(updated).catch(() => {});
              return updated;
            });
          }}
          onClaimSeasonReward={rewardId => {
            const sr = SEASON_REWARDS.find(r => r.id === rewardId);
            if (!sr) return;
            setProfile(prev => {
              if (prev.claimedRewardIds.includes(rewardId)) return prev;
              const unlocked = new Set(prev.unlockedJerseyIds);
              if (sr.jerseyId) unlocked.add(sr.jerseyId);
              const updated: FirestorePlayerProfile = {
                ...prev,
                claimedRewardIds: [...prev.claimedRewardIds, rewardId],
                unlockedJerseyIds: Array.from(unlocked),
              };
              if (fbUser) savePlayerMatchOutcomeToFirestore(updated).catch(() => {});
              return updated;
            });
          }}
        />
      )}
    </div>
  );
}
