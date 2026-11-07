import React, { useEffect, useRef } from 'react';
import {
  RINK_WIDTH,
  RINK_HEIGHT,
  CORNER_RADIUS,
  GOAL_LINE_X_LEFT,
  GOAL_LINE_X_RIGHT,
  GOAL_Y_TOP,
  GOAL_Y_BOTTOM,
  CREASE_RADIUS,
  MatchSimulationState,
  PlayerInputState,
  PlayerAttributes,
  AiDifficultyLevel,
  GameplayMatchMode,
  createInitialMatchState,
  stepHockeyPhysics,
} from '../game/physics';
import { HockeyTeam, JerseySkin } from '../data/teamsAndJerseys';
import { soundFX } from '../utils/sound';
import { VirtualControllerState } from './OnScreenController';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface IceMark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
}

export interface HudDiscreteSnapshot {
  homeScore: number;
  awayScore: number;
  homeShots: number;
  awayShots: number;
  homeHits: number;
  awayHits: number;
  homeSaves: number;
  awaySaves: number;
  homeAssists: number;
  period: number;
  isOvertime: boolean;
  isFinished: boolean;
  activeSkaterName: string;
  activeSkaterNumber: number;
  goalBannerTeam: 'HOME' | 'AWAY' | null;
  goalScorerName: string | null;
}

interface HockeyRinkCanvasProps {
  gameState: 'title' | 'playing' | 'paused' | 'gameover';
  isModalOpen: boolean;
  homeTeam: HockeyTeam;
  awayTeam: HockeyTeam;
  equippedJersey: JerseySkin;
  userAttrs: PlayerAttributes;
  matchMode: GameplayMatchMode;
  aiDifficulty: AiDifficultyLevel;
  matchResetToken: number;
  virtualControllerRef: React.MutableRefObject<VirtualControllerState>;
  remoteAwayInputRef: React.MutableRefObject<PlayerInputState | null>;
  onSendLocalInput?: (input: PlayerInputState) => void;
  onHudSnapshotChange: (snap: HudDiscreteSnapshot) => void;
  onMatchFinished: (finalState: MatchSimulationState) => void;
  clockTextRef: React.RefObject<HTMLSpanElement | null>;
  staminaBarRef: React.RefObject<HTMLDivElement | null>;
  staminaGhostBarRef: React.RefObject<HTMLDivElement | null>;
  shotChargeBarRef: React.RefObject<HTMLDivElement | null>;
}

const PARTICLE_POOL_SIZE = 120;
const ICE_MARK_POOL_SIZE = 90;

export const HockeyRinkCanvas: React.FC<HockeyRinkCanvasProps> = ({
  gameState,
  isModalOpen,
  homeTeam,
  awayTeam,
  equippedJersey,
  userAttrs,
  matchMode,
  aiDifficulty,
  matchResetToken,
  virtualControllerRef,
  remoteAwayInputRef,
  onSendLocalInput,
  onHudSnapshotChange,
  onMatchFinished,
  clockTextRef,
  staminaBarRef,
  staminaGhostBarRef,
  shotChargeBarRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const isModalOpenRef = useRef(isModalOpen);
  isModalOpenRef.current = isModalOpen;
  const homeTeamRef = useRef(homeTeam);
  homeTeamRef.current = homeTeam;
  const awayTeamRef = useRef(awayTeam);
  awayTeamRef.current = awayTeam;
  const equippedJerseyRef = useRef(equippedJersey);
  equippedJerseyRef.current = equippedJersey;
  const userAttrsRef = useRef(userAttrs);
  userAttrsRef.current = userAttrs;
  const matchModeRef = useRef(matchMode);
  matchModeRef.current = matchMode;
  const aiDifficultyRef = useRef(aiDifficulty);
  aiDifficultyRef.current = aiDifficulty;
  const onHudSnapshotRef = useRef(onHudSnapshotChange);
  onHudSnapshotRef.current = onHudSnapshotChange;
  const onMatchFinishedRef = useRef(onMatchFinished);
  onMatchFinishedRef.current = onMatchFinished;
  const onSendLocalInputRef = useRef(onSendLocalInput);
  onSendLocalInputRef.current = onSendLocalInput;

  const simRef = useRef<MatchSimulationState>(
    createInitialMatchState(homeTeam, awayTeam, userAttrs, 60, matchMode, aiDifficulty)
  );

  // Reset match state when matchResetToken, teams, matchMode, or aiDifficulty change
  useEffect(() => {
    simRef.current = createInitialMatchState(
      homeTeamRef.current,
      awayTeamRef.current,
      userAttrsRef.current,
      60,
      matchModeRef.current,
      aiDifficultyRef.current
    );
  }, [matchResetToken, homeTeam.id, awayTeam.id, matchMode, aiDifficulty]);

  useEffect(() => {
    for (const s of simRef.current.skaters) {
      if (s.team === 'HOME') {
        s.attrs = { ...userAttrs };
      }
    }
  }, [userAttrs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles: Particle[] = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 3,
      color: '#FFFFFF',
    }));
    let particleHead = 0;

    const spawnParticles = (
      x: number,
      y: number,
      count: number,
      color: string,
      speedMin: number,
      speedMax: number,
      size = 3.5
    ) => {
      for (let i = 0; i < count; i++) {
        const p = particles[particleHead];
        particleHead = (particleHead + 1) % PARTICLE_POOL_SIZE;
        const angle = Math.random() * Math.PI * 2;
        const spd = speedMin + Math.random() * (speedMax - speedMin);
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * spd;
        p.vy = Math.sin(angle) * spd;
        p.life = 0.25 + Math.random() * 0.35;
        p.maxLife = p.life;
        p.size = size;
        p.color = color;
      }
    };

    const iceMarks: IceMark[] = Array.from({ length: ICE_MARK_POOL_SIZE }, () => ({
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
      alpha: 0,
    }));
    let iceMarkHead = 0;

    const keysHeld = new Set<string>();
    const keysJustPressed = new Set<string>();
    const keysJustReleased = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      const code = e.code;
      if (!keysHeld.has(code)) {
        keysJustPressed.add(code);
      }
      keysHeld.add(code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (keysHeld.has(code)) {
        keysJustReleased.add(code);
      }
      keysHeld.delete(code);
    };

    const clearInputs = () => {
      keysHeld.clear();
      keysJustPressed.clear();
      keysJustReleased.clear();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearInputs);

    let viewWidth = window.innerWidth;
    let viewHeight = window.innerHeight;
    const updateCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      viewWidth = canvas.clientWidth || window.innerWidth;
      viewHeight = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(viewWidth * dpr);
      canvas.height = Math.round(viewHeight * dpr);
    };
    updateCanvasSize();
    const ro = new ResizeObserver(updateCanvasSize);
    ro.observe(canvas);

    let lastTime = performance.now();
    let animId = 0;
    let timerId = 0;
    let isUnmounted = false;
    let ghostStamina = 100;
    let prevSnapshotKey = '';
    let finishedDispatched = false;
    let wasStaticFrame = false;

    const scheduleNextFrame = () => {
      if (isUnmounted) return;
      const pausedOrModal =
        isModalOpenRef.current ||
        gameStateRef.current === 'paused' ||
        gameStateRef.current === 'gameover';
      timerId = window.setTimeout(
        () => {
          if (!isUnmounted) {
            animId = requestAnimationFrame(tick);
          }
        },
        pausedOrModal ? 120 : 35
      );
    };

    const tick = (now: number) => {
      if (isUnmounted) return;
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const mode = gameStateRef.current;
      const modalOpen = isModalOpenRef.current;
      const currentMatchMode = matchModeRef.current;
      const sim = simRef.current;

      if (!sim.isFinished) {
        finishedDispatched = false;
      }

      const vc = virtualControllerRef.current;
      const isLocalPvP = currentMatchMode === 'pvp_local';

      // Build P1 (Home Team) Input:
      // In PvE / Online PvP, P1 accepts both WASD and Arrow keys + On-Screen Controller.
      // In 2P Local PvP, P1 uses WASD + On-Screen Controller, while P2 uses Arrow keys!
      let p1MoveX = vc.moveX;
      let p1MoveY = vc.moveY;
      if (keysHeld.has('KeyA') || (!isLocalPvP && keysHeld.has('ArrowLeft'))) p1MoveX -= 1;
      if (keysHeld.has('KeyD') || (!isLocalPvP && keysHeld.has('ArrowRight'))) p1MoveX += 1;
      if (keysHeld.has('KeyW') || (!isLocalPvP && keysHeld.has('ArrowUp'))) p1MoveY -= 1;
      if (keysHeld.has('KeyS') || (!isLocalPvP && keysHeld.has('ArrowDown'))) p1MoveY += 1;

      const localHomeInput: PlayerInputState = {
        moveX: p1MoveX,
        moveY: p1MoveY,
        sprintHeld:
          vc.sprintHeld ||
          keysHeld.has('ShiftLeft') ||
          (!isLocalPvP && keysHeld.has('ShiftRight')),
        shootHeld:
          vc.shootHeld ||
          keysHeld.has('Space') ||
          (!isLocalPvP && keysHeld.has('KeyJ')),
        shootJustReleased:
          vc.shootJustReleased ||
          keysJustReleased.has('Space') ||
          (!isLocalPvP && keysJustReleased.has('KeyJ')),
        passJustPressed:
          vc.passJustPressed ||
          keysJustPressed.has('KeyE'),
        checkJustPressed:
          vc.checkJustPressed ||
          keysJustPressed.has('KeyC'),
        switchJustPressed:
          vc.switchJustPressed ||
          keysJustPressed.has('KeyQ'),
        dekeJustPressed:
          vc.dekeJustPressed ||
          keysJustPressed.has('KeyF'),
      };

      // Reset one-shot flags on virtual controller
      vc.shootJustReleased = false;
      vc.passJustPressed = false;
      vc.checkJustPressed = false;
      vc.switchJustPressed = false;
      vc.dekeJustPressed = false;

      // Build P2 (Away Team) Input for 2P Local PvP or Online PvP
      let effectiveAwayInput: PlayerInputState | null = null;
      if (isLocalPvP) {
        let p2MoveX = 0;
        let p2MoveY = 0;
        if (keysHeld.has('ArrowLeft')) p2MoveX -= 1;
        if (keysHeld.has('ArrowRight')) p2MoveX += 1;
        if (keysHeld.has('ArrowUp')) p2MoveY -= 1;
        if (keysHeld.has('ArrowDown')) p2MoveY += 1;

        effectiveAwayInput = {
          moveX: p2MoveX,
          moveY: p2MoveY,
          sprintHeld: keysHeld.has('ShiftRight'),
          shootHeld: keysHeld.has('Enter') || keysHeld.has('KeyJ'),
          shootJustReleased: keysJustReleased.has('Enter') || keysJustReleased.has('KeyJ'),
          passJustPressed: keysJustPressed.has('KeyK') || keysJustPressed.has('Slash'),
          checkJustPressed: keysJustPressed.has('KeyL') || keysJustPressed.has('Period'),
          switchJustPressed: keysJustPressed.has('KeyM'),
          dekeJustPressed: keysJustPressed.has('Comma'),
        };
      } else if (currentMatchMode === 'pvp_online') {
        effectiveAwayInput = remoteAwayInputRef.current;
      }

      keysJustPressed.clear();
      keysJustReleased.clear();

      if (!modalOpen) {
        if (mode === 'playing') {
          if (
            onSendLocalInputRef.current &&
            (p1MoveX !== 0 ||
              p1MoveY !== 0 ||
              localHomeInput.shootJustReleased ||
              localHomeInput.passJustPressed ||
              localHomeInput.checkJustPressed)
          ) {
            onSendLocalInputRef.current(localHomeInput);
          }
          stepHockeyPhysics(sim, dt, localHomeInput, effectiveAwayInput, false);
        } else if (mode === 'title') {
          stepHockeyPhysics(sim, dt, localHomeInput, null, true);
        }
      }

      for (const ev of sim.events) {
        if (ev.type === 'SHOT') {
          soundFX.playSlapshot(ev.weight === 'HEAVY');
          spawnParticles(ev.x, ev.y, ev.weight === 'HEAVY' ? 14 : 6, '#E0F2FE', 60, 210, 3);
        } else if (ev.type === 'PASS') {
          soundFX.playPass();
          spawnParticles(ev.x, ev.y, 4, '#BAE6FD', 40, 120, 2.5);
        } else if (ev.type === 'HEAVY_HIT') {
          soundFX.playBodyCheck();
          spawnParticles(ev.x, ev.y, 20, '#F43F5E', 90, 280, 4.2);
        } else if (ev.type === 'POST_PING') {
          soundFX.playPostPing();
          spawnParticles(ev.x, ev.y, 16, '#FACC15', 100, 300, 3.5);
        } else if (ev.type === 'GOAL') {
          soundFX.playGoalHorn();
          const teamColor =
            ev.team === 'HOME'
              ? equippedJerseyRef.current.primaryColor
              : awayTeamRef.current.primaryColor;
          spawnParticles(ev.x, ev.y, 32, teamColor, 120, 380, 5);
          spawnParticles(ev.x, ev.y, 20, '#FACC15', 80, 260, 4);
        } else if (ev.type === 'PERIOD_END' || ev.type === 'MATCH_END') {
          soundFX.playWhistle();
        }
      }

      if (!modalOpen) {
        for (const s of sim.skaters) {
          const spd = Math.hypot(s.vx, s.vy);
          if (spd > 210 && Math.random() < 0.35) {
            const m = iceMarks[iceMarkHead];
            iceMarkHead = (iceMarkHead + 1) % ICE_MARK_POOL_SIZE;
            m.x1 = s.x - s.facingX * 6;
            m.y1 = s.y - s.facingY * 6;
            m.x2 = s.x + s.facingX * 6;
            m.y2 = s.y + s.facingY * 6;
            m.alpha = 0.26;
          }
        }

        for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
          const p = particles[i];
          if (!p.active) continue;
          p.life -= dt;
          if (p.life <= 0) {
            p.active = false;
            continue;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= Math.pow(0.2, dt);
          p.vy *= Math.pow(0.2, dt);
        }
      }

      const activeSkater =
        sim.skaters.find(s => s.id === sim.controlledHomeId) || sim.skaters[0];
      if (staminaBarRef.current && activeSkater) {
        const pct = Math.max(0, Math.min(100, activeSkater.stamina));
        const nextStam = `scaleX(${(pct / 100).toFixed(2)})`;
        if (staminaBarRef.current.style.transform !== nextStam) {
          staminaBarRef.current.style.transform = nextStam;
        }
        ghostStamina += (pct - ghostStamina) * Math.min(1, dt * 3.5);
        if (staminaGhostBarRef.current) {
          const nextGhost = `scaleX(${(ghostStamina / 100).toFixed(2)})`;
          if (staminaGhostBarRef.current.style.transform !== nextGhost) {
            staminaGhostBarRef.current.style.transform = nextGhost;
          }
        }
      }
      if (shotChargeBarRef.current) {
        const nextCharge = `scaleX(${sim.shotCharge.toFixed(2)})`;
        if (shotChargeBarRef.current.style.transform !== nextCharge) {
          shotChargeBarRef.current.style.transform = nextCharge;
        }
      }
      if (clockTextRef.current) {
        const secs = Math.max(0, Math.ceil(sim.periodTimeRemaining));
        const mm = Math.floor(secs / 60);
        const ss = secs % 60;
        const nextClock = `${mm}:${ss < 10 ? '0' : ''}${ss}`;
        if (clockTextRef.current.textContent !== nextClock) {
          clockTextRef.current.textContent = nextClock;
        }
      }

      const goalBannerTeam = sim.goalCelebrationTimer > 0 ? sim.lastScoringTeam : null;
      const snapshotKey = [
        sim.homeScore,
        sim.awayScore,
        sim.homeShots,
        sim.awayShots,
        sim.homeHits,
        sim.awayHits,
        sim.homeSaves,
        sim.awaySaves,
        sim.period,
        sim.isOvertime,
        sim.isFinished,
        activeSkater?.id,
        goalBannerTeam,
      ].join('|');

      if (snapshotKey !== prevSnapshotKey) {
        prevSnapshotKey = snapshotKey;
        onHudSnapshotRef.current({
          homeScore: sim.homeScore,
          awayScore: sim.awayScore,
          homeShots: sim.homeShots,
          awayShots: sim.awayShots,
          homeHits: sim.homeHits,
          awayHits: sim.awayHits,
          homeSaves: sim.homeSaves,
          awaySaves: sim.awaySaves,
          homeAssists: sim.homeAssists,
          period: sim.period,
          isOvertime: sim.isOvertime,
          isFinished: sim.isFinished,
          activeSkaterName: activeSkater?.name || 'Captain',
          activeSkaterNumber: activeSkater?.number || 97,
          goalBannerTeam,
          goalScorerName: activeSkater?.name || null,
        });
      }

      if (sim.isFinished && mode === 'playing' && !finishedDispatched) {
        finishedDispatched = true;
        onMatchFinishedRef.current(sim);
      }

      const isStaticOverlay = modalOpen || mode === 'paused' || mode === 'gameover';
      if (!isStaticOverlay || !wasStaticFrame) {
        renderRinkScene(
          ctx,
          canvas.width,
          canvas.height,
          sim,
          homeTeamRef.current,
          awayTeamRef.current,
          equippedJerseyRef.current,
          particles,
          iceMarks
        );
      }
      wasStaticFrame = isStaticOverlay;

      scheduleNextFrame();
    };

    animId = requestAnimationFrame(tick);

    return () => {
      isUnmounted = true;
      clearTimeout(timerId);
      cancelAnimationFrame(animId);
      ro.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearInputs);
    };
  }, [
    clockTextRef,
    remoteAwayInputRef,
    shotChargeBarRef,
    staminaBarRef,
    staminaGhostBarRef,
    virtualControllerRef,
  ]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="hockey-rink-canvas"
      className="fixed inset-0 w-full h-full block bg-[#060A12]"
    />
  );
};

function renderRinkScene(
  ctx: CanvasRenderingContext2D,
  pixelW: number,
  pixelH: number,
  sim: MatchSimulationState,
  homeTeam: HockeyTeam,
  awayTeam: HockeyTeam,
  homeJersey: JerseySkin,
  particles: Particle[],
  iceMarks: IceMark[]
) {
  ctx.save();
  ctx.fillStyle = '#060A12';
  ctx.fillRect(0, 0, pixelW, pixelH);

  const padX = pixelW * 0.04;
  const padY = pixelH * 0.1;
  const scale = Math.min((pixelW - padX * 2) / RINK_WIDTH, (pixelH - padY * 2) / RINK_HEIGHT);
  const offsetX = (pixelW - RINK_WIDTH * scale) / 2;
  const offsetY = (pixelH - RINK_HEIGHT * scale) / 2 - pixelH * 0.02;

  const shakeMag = sim.cameraTrauma * sim.cameraTrauma * 14 * scale;
  const shakeX = (Math.random() - 0.5) * 2 * shakeMag;
  const shakeY = (Math.random() - 0.5) * 2 * shakeMag;

  ctx.translate(offsetX + shakeX, offsetY + shakeY);
  ctx.scale(scale, scale);

  ctx.fillStyle = '#0B1324';
  drawRoundedRinkPath(ctx, 12, 12, RINK_WIDTH - 24, RINK_HEIGHT - 24, CORNER_RADIUS + 8);
  ctx.fill();

  ctx.save();
  drawRoundedRinkPath(ctx, 24, 24, RINK_WIDTH - 48, RINK_HEIGHT - 48, CORNER_RADIUS);
  ctx.clip();

  const iceGrad = ctx.createRadialGradient(
    RINK_WIDTH / 2,
    RINK_HEIGHT / 2,
    60,
    RINK_WIDTH / 2,
    RINK_HEIGHT / 2,
    RINK_WIDTH * 0.65
  );
  iceGrad.addColorStop(0, '#F1F7FD');
  iceGrad.addColorStop(0.65, '#E2EEF8');
  iceGrad.addColorStop(1, '#CBDDEC');
  ctx.fillStyle = iceGrad;
  ctx.fillRect(24, 24, RINK_WIDTH - 48, RINK_HEIGHT - 48);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
  ctx.beginPath();
  ctx.arc(RINK_WIDTH * 0.3, RINK_HEIGHT * 0.5, 190, 0, Math.PI * 2);
  ctx.arc(RINK_WIDTH * 0.7, RINK_HEIGHT * 0.5, 190, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(220, 38, 38, 0.72)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(GOAL_LINE_X_LEFT, 24);
  ctx.lineTo(GOAL_LINE_X_LEFT, RINK_HEIGHT - 24);
  ctx.moveTo(GOAL_LINE_X_RIGHT, 24);
  ctx.lineTo(GOAL_LINE_X_RIGHT, RINK_HEIGHT - 24);
  ctx.stroke();

  const leftBlueX = RINK_WIDTH * 0.34;
  const rightBlueX = RINK_WIDTH * 0.66;
  ctx.fillStyle = 'rgba(29, 78, 216, 0.68)';
  ctx.fillRect(leftBlueX - 5, 24, 10, RINK_HEIGHT - 48);
  ctx.fillRect(rightBlueX - 5, 24, 10, RINK_HEIGHT - 48);

  ctx.fillStyle = 'rgba(220, 38, 38, 0.75)';
  ctx.fillRect(RINK_WIDTH / 2 - 5, 24, 10, RINK_HEIGHT - 48);

  ctx.strokeStyle = 'rgba(29, 78, 216, 0.65)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(RINK_WIDTH / 2, RINK_HEIGHT / 2, 82, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
  ctx.beginPath();
  ctx.arc(RINK_WIDTH / 2, RINK_HEIGHT / 2, 52, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.font = '800 22px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('APEX ICE', RINK_WIDTH / 2, RINK_HEIGHT / 2);

  const faceoffSpots = [
    { x: 255, y: 170 },
    { x: 255, y: RINK_HEIGHT - 170 },
    { x: RINK_WIDTH - 255, y: 170 },
    { x: RINK_WIDTH - 255, y: RINK_HEIGHT - 170 },
  ];
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.55)';
  ctx.lineWidth = 3;
  for (const spot of faceoffSpots) {
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, 64, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(220, 38, 38, 0.8)';
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(56, 189, 248, 0.38)';
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.8)';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.arc(GOAL_LINE_X_LEFT, RINK_HEIGHT / 2, CREASE_RADIUS, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(GOAL_LINE_X_RIGHT, RINK_HEIGHT / 2, CREASE_RADIUS, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < ICE_MARK_POOL_SIZE; i++) {
    const m = iceMarks[i];
    if (m.alpha <= 0.01) continue;
    m.alpha *= 0.992;
    ctx.globalAlpha = m.alpha;
    ctx.beginPath();
    ctx.moveTo(m.x1, m.y1);
    ctx.lineTo(m.x2, m.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  drawGoalCage(ctx, GOAL_LINE_X_LEFT, GOAL_Y_TOP, GOAL_Y_BOTTOM, true);
  drawGoalCage(ctx, GOAL_LINE_X_RIGHT, GOAL_Y_TOP, GOAL_Y_BOTTOM, false);

  for (const s of sim.skaters) {
    const isHome = s.team === 'HOME';
    const isControlledHome = s.id === sim.controlledHomeId;
    const isControlledAway = s.id === sim.controlledAwayId;
    const isControlled = isControlledHome || isControlledAway;
    const useCustomJersey = isHome && homeJersey.teamId === homeTeam.id;
    const primary = isHome
      ? useCustomJersey
        ? homeJersey.primaryColor
        : homeTeam.primaryColor
      : awayTeam.primaryColor;
    const secondary = isHome
      ? useCustomJersey
        ? homeJersey.secondaryColor
        : homeTeam.secondaryColor
      : awayTeam.secondaryColor;
    const trim = isHome
      ? useCustomJersey
        ? homeJersey.trimColor
        : homeTeam.trimColor
      : awayTeam.trimColor;

    // Controlled player ice halo ring + directional pointer arrow + "YOU (P1)" / "P2" callout
    if (isControlled) {
      const ringColor = isHome ? '#0284C7' : '#E11D48';
      ctx.save();
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius + 9, 0, Math.PI * 2);
      ctx.stroke();

      // Facing direction aim pointer triangle on the ice
      const tipX = s.x + s.facingX * (s.radius + 22);
      const tipY = s.y + s.facingY * (s.radius + 22);
      const perpX = -s.facingY * 6;
      const perpY = s.facingX * 6;
      const baseX = s.x + s.facingX * (s.radius + 12);
      const baseY = s.y + s.facingY * (s.radius + 12);
      ctx.fillStyle = ringColor;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(baseX + perpX, baseY + perpY);
      ctx.lineTo(baseX - perpX, baseY - perpY);
      ctx.closePath();
      ctx.fill();

      // Overhead "YOU (P1)" or "P2" tag
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(s.x - 24, s.y - s.radius - 24, 48, 14);
      ctx.fillStyle = isHome ? '#38BDF8' : '#FB7185';
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isHome ? 'YOU · P1' : 'P2 · OPP', s.x, s.y - s.radius - 17);

      const chargeVal = isHome ? sim.shotCharge : sim.awayShotCharge;
      if (chargeVal > 0.02) {
        ctx.strokeStyle = chargeVal > 0.7 ? '#F59E0B' : '#38BDF8';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(
          s.x,
          s.y,
          s.radius + 14,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * chargeVal
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    if (s.telegraphType === 'SLAPSHOT_AIM') {
      const targetGoalX = s.team === 'HOME' ? GOAL_LINE_X_RIGHT : GOAL_LINE_X_LEFT;
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.72)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(targetGoalX, RINK_HEIGHT / 2);
      ctx.stroke();
      ctx.restore();
    } else if (s.telegraphType === 'HEAVY_CHECK') {
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 5, s.radius * 0.95, s.radius * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    const angle = Math.atan2(s.facingY, s.facingX);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(angle);
    ctx.scale(s.scaleX, s.scaleY);

    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(4, 10);
    ctx.lineTo(s.radius + 13, 8);
    ctx.lineTo(s.radius + 17, -4);
    ctx.stroke();

    ctx.fillStyle = primary;
    ctx.strokeStyle = trim;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = secondary;
    if (isHome && homeJersey.pattern === 'chevron') {
      ctx.beginPath();
      ctx.moveTo(-s.radius * 0.7, -5);
      ctx.lineTo(0, 5);
      ctx.lineTo(s.radius * 0.7, -5);
      ctx.lineWidth = 4;
      ctx.strokeStyle = secondary;
      ctx.stroke();
    } else {
      ctx.fillRect(-s.radius * 0.75, -s.radius * 0.28, s.radius * 1.5, s.radius * 0.56);
    }

    ctx.restore();

    ctx.fillStyle = primary === '#FFFFFF' || secondary === '#FFFFFF' ? '#0F172A' : '#FFFFFF';
    ctx.font = '800 13px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(s.number), s.x, s.y);
  }

  for (let i = 0; i < sim.puck.trail.length; i++) {
    const pt = sim.puck.trail[i];
    const ratio = (i + 1) / sim.puck.trail.length;
    ctx.fillStyle = `rgba(14, 165, 233, ${ratio * 0.32})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, sim.puck.radius * ratio * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#090D16';
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(sim.puck.x, sim.puck.y, sim.puck.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    const p = particles[i];
    if (!p.active) continue;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 4;
  drawRoundedRinkPath(ctx, 24, 24, RINK_WIDTH - 48, RINK_HEIGHT - 48, CORNER_RADIUS);
  ctx.stroke();

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 7;
  drawRoundedRinkPath(ctx, 20, 20, RINK_WIDTH - 40, RINK_HEIGHT - 40, CORNER_RADIUS + 4);
  ctx.stroke();

  ctx.restore();
}

function drawRoundedRinkPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawGoalCage(
  ctx: CanvasRenderingContext2D,
  goalLineX: number,
  topY: number,
  bottomY: number,
  isLeft: boolean
) {
  const depth = isLeft ? -34 : 34;
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(goalLineX, topY);
  ctx.lineTo(goalLineX + depth, topY + 8);
  ctx.lineTo(goalLineX + depth, bottomY - 8);
  ctx.lineTo(goalLineX, bottomY);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(goalLineX, topY, 5.5, 0, Math.PI * 2);
  ctx.arc(goalLineX, bottomY, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
