import { HOCKEY_TEAMS, HockeyTeam, TournamentCategory, getTeamById } from '../data/teamsAndJerseys';

export const RINK_WIDTH = 1200;
export const RINK_HEIGHT = 600;
export const CORNER_RADIUS = 110;
export const GOAL_LINE_X_LEFT = 95;
export const GOAL_LINE_X_RIGHT = RINK_WIDTH - 95;
export const GOAL_Y_TOP = RINK_HEIGHT / 2 - 58;
export const GOAL_Y_BOTTOM = RINK_HEIGHT / 2 + 58;
export const CREASE_RADIUS = 66;

export type AiDifficultyLevel = 'rookie' | 'pro' | 'all_star' | 'legend';
export type GameplayMatchMode = 'pve' | 'pvp_local' | 'pvp_online';

export const AI_DIFFICULTY_CONFIG: Record<
  AiDifficultyLevel,
  {
    label: string;
    levelNum: number;
    speedMultiplier: number;
    shotChargeMultiplier: number;
    reactionDelay: number;
    ratingOffset: number;
  }
> = {
  rookie: {
    label: 'Level 1 · Rookie',
    levelNum: 1,
    speedMultiplier: 0.66,
    shotChargeMultiplier: 0.55,
    reactionDelay: 0.55,
    ratingOffset: -12,
  },
  pro: {
    label: 'Level 2 · Pro',
    levelNum: 2,
    speedMultiplier: 0.8,
    shotChargeMultiplier: 0.75,
    reactionDelay: 0.4,
    ratingOffset: -4,
  },
  all_star: {
    label: 'Level 3 · All-Star',
    levelNum: 3,
    speedMultiplier: 0.92,
    shotChargeMultiplier: 0.9,
    reactionDelay: 0.28,
    ratingOffset: 2,
  },
  legend: {
    label: 'Level 4 · Apex Legend',
    levelNum: 4,
    speedMultiplier: 1.04,
    shotChargeMultiplier: 1.0,
    reactionDelay: 0.18,
    ratingOffset: 8,
  },
};

export interface PlayerAttributes {
  statSpeed: number;    // 50 - 99
  statPower: number;    // 50 - 99
  statHandling: number; // 50 - 99
  statChecking: number; // 50 - 99
  statStamina: number;  // 50 - 99
}

export const MAX_ATTRIBUTE_BUDGET = 415; // e.g. average 83 across 5 stats

export function validateAttributeBudget(attrs: PlayerAttributes): {
  valid: boolean;
  total: number;
  remaining: number;
} {
  const vals = [
    attrs.statSpeed,
    attrs.statPower,
    attrs.statHandling,
    attrs.statChecking,
    attrs.statStamina,
  ];
  const inBounds = vals.every(v => Number.isInteger(v) && v >= 50 && v <= 99);
  const total = vals.reduce((acc, v) => acc + v, 0);
  return {
    valid: inBounds && total <= MAX_ATTRIBUTE_BUDGET,
    total,
    remaining: MAX_ATTRIBUTE_BUDGET - total,
  };
}

export function computeRankTier(
  mmr: number
): 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Apex Legend' {
  if (mmr >= 1950) return 'Apex Legend';
  if (mmr >= 1650) return 'Diamond';
  if (mmr >= 1350) return 'Gold';
  if (mmr >= 1100) return 'Silver';
  return 'Bronze';
}

export type SkaterRole = 'CENTER' | 'WING_TOP' | 'DEFENSE_BOTTOM' | 'GOALIE';
export type AiPolicy = 'SNIPER_WING' | 'ENFORCER_DEFENSE' | 'PLAYMAKER_CENTER' | 'CREASE_GOALIE';

export interface SkaterEntity {
  id: string;
  team: 'HOME' | 'AWAY';
  role: SkaterRole;
  aiPolicy: AiPolicy;
  number: number;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  radius: number;
  stamina: number;
  maxStamina: number;
  stunTimer: number;
  checkCooldown: number;
  telegraphTimer: number;
  telegraphType: 'NONE' | 'SLAPSHOT_AIM' | 'HEAVY_CHECK';
  scaleX: number;
  scaleY: number;
  gaitPhase: number;
  attrs: PlayerAttributes;
}

export interface PuckEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  ownerId: string | null;
  lastTouchedByHomeId: string | null;
  prevTouchedByHomeId: string | null;
  pickupCooldown: number;
  trail: Array<{ x: number; y: number }>;
}

export interface MatchEvent {
  type: 'GOAL' | 'POST_PING' | 'HEAVY_HIT' | 'SAVE' | 'PASS' | 'SHOT' | 'PERIOD_END' | 'MATCH_END';
  team?: 'HOME' | 'AWAY';
  scorerName?: string;
  x: number;
  y: number;
  weight: 'LIGHT' | 'HEAVY';
}

export interface ReplaySkaterSnapshot {
  id: string;
  team: 'HOME' | 'AWAY';
  role: SkaterRole;
  number: number;
  name: string;
  x: number;
  y: number;
  facingX: number;
  facingY: number;
}

export interface ReplayFrameSnapshot {
  puckX: number;
  puckY: number;
  puckVx: number;
  puckVy: number;
  puckOwnerId: string | null;
  skaters: ReplaySkaterSnapshot[];
}

export interface MatchHighlightMoment {
  id: string;
  type: 'GOAL' | 'SAVE' | 'HEAVY_HIT' | 'POST_PING' | 'SHOT';
  period: number;
  clockLabel: string;
  team: 'HOME' | 'AWAY';
  actorName: string;
  actorNumber: number;
  headline: string;
  description: string;
  homeScoreAfter: number;
  awayScoreAfter: number;
  eventX: number;
  eventY: number;
  frames: ReplayFrameSnapshot[];
}

export interface MatchHighlightSummary {
  headline: string;
  narrative: string;
  threeStars: Array<{
    rank: 1 | 2 | 3;
    name: string;
    number: number;
    teamCode: string;
    statLine: string;
  }>;
  highlights: MatchHighlightMoment[];
}

export interface MatchSimulationState {
  skaters: SkaterEntity[];
  puck: PuckEntity;
  controlledHomeId: string;
  controlledAwayId: string | null; // Non-null in pvp_local or pvp_online mode
  matchMode: GameplayMatchMode;
  aiDifficulty: AiDifficultyLevel;
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
  periodTimeRemaining: number;
  shotCharge: number;      // P1 shot charge (0.0 to 1.0)
  isChargingShot: boolean;
  awayShotCharge: number;  // P2 shot charge (0.0 to 1.0)
  isAwayChargingShot: boolean;
  hitstopTimer: number;
  goalCelebrationTimer: number;
  lastScoringTeam: 'HOME' | 'AWAY' | null;
  cameraTrauma: number;
  isOvertime: boolean;
  isFinished: boolean;
  events: MatchEvent[];
  recentFrameRing: ReplayFrameSnapshot[];
  frameSampleAccumulator: number;
  highlightMoments: MatchHighlightMoment[];
}

export interface PlayerInputState {
  moveX: number;
  moveY: number;
  sprintHeld: boolean;
  shootHeld: boolean;
  shootJustReleased: boolean;
  passJustPressed: boolean;
  checkJustPressed: boolean;
  switchJustPressed: boolean;
  dekeJustPressed: boolean;
}

export function createInitialMatchState(
  homeTeam: HockeyTeam,
  awayTeam: HockeyTeam,
  userAttrs: PlayerAttributes,
  periodDurationSec = 60,
  matchMode: GameplayMatchMode = 'pve',
  aiDifficulty: AiDifficultyLevel = 'pro'
): MatchSimulationState {
  const diffCfg = AI_DIFFICULTY_CONFIG[aiDifficulty];
  const aiBaseAttr = Math.min(99, Math.max(55, awayTeam.rating + diffCfg.ratingOffset));
  const aiAttrs: PlayerAttributes = {
    statSpeed: aiBaseAttr,
    statPower: aiBaseAttr,
    statHandling: aiBaseAttr,
    statChecking: aiBaseAttr,
    statStamina: aiBaseAttr,
  };

  const skaters: SkaterEntity[] = [
    // HOME TEAM (Left side attacking Right)
    {
      id: 'home_c',
      team: 'HOME',
      role: 'CENTER',
      aiPolicy: 'PLAYMAKER_CENTER',
      number: 97,
      name: `${homeTeam.code} Captain`,
      x: RINK_WIDTH / 2 - 55,
      y: RINK_HEIGHT / 2,
      vx: 0,
      vy: 0,
      facingX: 1,
      facingY: 0,
      radius: 18,
      stamina: 100,
      maxStamina: 100,
      stunTimer: 0,
      checkCooldown: 0,
      telegraphTimer: 0,
      telegraphType: 'NONE',
      scaleX: 1,
      scaleY: 1,
      gaitPhase: 0,
      attrs: userAttrs,
    },
    {
      id: 'home_w',
      team: 'HOME',
      role: 'WING_TOP',
      aiPolicy: 'SNIPER_WING',
      number: 88,
      name: `${homeTeam.code} Sniper`,
      x: RINK_WIDTH / 2 - 140,
      y: RINK_HEIGHT / 2 - 135,
      vx: 0,
      vy: 0,
      facingX: 1,
      facingY: 0,
      radius: 18,
      stamina: 100,
      maxStamina: 100,
      stunTimer: 0,
      checkCooldown: 0,
      telegraphTimer: 0,
      telegraphType: 'NONE',
      scaleX: 1,
      scaleY: 1,
      gaitPhase: 0,
      attrs: userAttrs,
    },
    {
      id: 'home_d',
      team: 'HOME',
      role: 'DEFENSE_BOTTOM',
      aiPolicy: 'ENFORCER_DEFENSE',
      number: 44,
      name: `${homeTeam.code} Blueliner`,
      x: RINK_WIDTH / 2 - 250,
      y: RINK_HEIGHT / 2 + 120,
      vx: 0,
      vy: 0,
      facingX: 1,
      facingY: 0,
      radius: 19,
      stamina: 100,
      maxStamina: 100,
      stunTimer: 0,
      checkCooldown: 0,
      telegraphTimer: 0,
      telegraphType: 'NONE',
      scaleX: 1,
      scaleY: 1,
      gaitPhase: 0,
      attrs: userAttrs,
    },
    {
      id: 'home_g',
      team: 'HOME',
      role: 'GOALIE',
      aiPolicy: 'CREASE_GOALIE',
      number: 31,
      name: `${homeTeam.code} Tendy`,
      x: GOAL_LINE_X_LEFT + 28,
      y: RINK_HEIGHT / 2,
      vx: 0,
      vy: 0,
      facingX: 1,
      facingY: 0,
      radius: 20,
      stamina: 100,
      maxStamina: 100,
      stunTimer: 0,
      checkCooldown: 0,
      telegraphTimer: 0,
      telegraphType: 'NONE',
      scaleX: 1,
      scaleY: 1,
      gaitPhase: 0,
      attrs: userAttrs,
    },
    // AWAY TEAM (Right side attacking Left)
    {
      id: 'away_c',
      team: 'AWAY',
      role: 'CENTER',
      aiPolicy: 'PLAYMAKER_CENTER',
      number: 91,
      name: `${awayTeam.code} Center`,
      x: RINK_WIDTH / 2 + 55,
      y: RINK_HEIGHT / 2,
      vx: 0,
      vy: 0,
      facingX: -1,
      facingY: 0,
      radius: 18,
      stamina: 100,
      maxStamina: 100,
      stunTimer: 0,
      checkCooldown: 0,
      telegraphTimer: 0,
      telegraphType: 'NONE',
      scaleX: 1,
      scaleY: 1,
      gaitPhase: 0,
      attrs: aiAttrs,
    },
    {
      id: 'away_w',
      team: 'AWAY',
      role: 'WING_TOP',
      aiPolicy: 'SNIPER_WING',
      number: 29,
      name: `${awayTeam.code} Winger`,
      x: RINK_WIDTH / 2 + 140,
      y: RINK_HEIGHT / 2 - 135,
      vx: 0,
      vy: 0,
      facingX: -1,
      facingY: 0,
      radius: 18,
      stamina: 100,
      maxStamina: 100,
      stunTimer: 0,
      checkCooldown: 0,
      telegraphTimer: 0,
      telegraphType: 'NONE',
      scaleX: 1,
      scaleY: 1,
      gaitPhase: 0,
      attrs: aiAttrs,
    },
    {
      id: 'away_d',
      team: 'AWAY',
      role: 'DEFENSE_BOTTOM',
      aiPolicy: 'ENFORCER_DEFENSE',
      number: 77,
      name: `${awayTeam.code} Enforcer`,
      x: RINK_WIDTH / 2 + 250,
      y: RINK_HEIGHT / 2 + 120,
      vx: 0,
      vy: 0,
      facingX: -1,
      facingY: 0,
      radius: 19,
      stamina: 100,
      maxStamina: 100,
      stunTimer: 0,
      checkCooldown: 0,
      telegraphTimer: 0,
      telegraphType: 'NONE',
      scaleX: 1,
      scaleY: 1,
      gaitPhase: 0,
      attrs: aiAttrs,
    },
    {
      id: 'away_g',
      team: 'AWAY',
      role: 'GOALIE',
      aiPolicy: 'CREASE_GOALIE',
      number: 30,
      name: `${awayTeam.code} Goalie`,
      x: GOAL_LINE_X_RIGHT - 28,
      y: RINK_HEIGHT / 2,
      vx: 0,
      vy: 0,
      facingX: -1,
      facingY: 0,
      radius: 20,
      stamina: 100,
      maxStamina: 100,
      stunTimer: 0,
      checkCooldown: 0,
      telegraphTimer: 0,
      telegraphType: 'NONE',
      scaleX: 1,
      scaleY: 1,
      gaitPhase: 0,
      attrs: aiAttrs,
    },
  ];

  const isPvp = matchMode === 'pvp_local' || matchMode === 'pvp_online';

  return {
    skaters,
    puck: {
      x: RINK_WIDTH / 2,
      y: RINK_HEIGHT / 2,
      vx: 0,
      vy: 0,
      radius: 8,
      ownerId: null,
      lastTouchedByHomeId: null,
      prevTouchedByHomeId: null,
      pickupCooldown: 0,
      trail: [],
    },
    controlledHomeId: 'home_c',
    controlledAwayId: isPvp ? 'away_c' : null,
    matchMode,
    aiDifficulty,
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
    periodTimeRemaining: periodDurationSec,
    shotCharge: 0,
    isChargingShot: false,
    awayShotCharge: 0,
    isAwayChargingShot: false,
    hitstopTimer: 0,
    goalCelebrationTimer: 0,
    lastScoringTeam: null,
    cameraTrauma: 0,
    isOvertime: false,
    isFinished: false,
    events: [],
    recentFrameRing: [],
    frameSampleAccumulator: 0,
    highlightMoments: [],
  };
}

export function resetFaceoffPositions(state: MatchSimulationState): void {
  const homePositions: Record<SkaterRole, { x: number; y: number }> = {
    CENTER: { x: RINK_WIDTH / 2 - 55, y: RINK_HEIGHT / 2 },
    WING_TOP: { x: RINK_WIDTH / 2 - 140, y: RINK_HEIGHT / 2 - 135 },
    DEFENSE_BOTTOM: { x: RINK_WIDTH / 2 - 250, y: RINK_HEIGHT / 2 + 120 },
    GOALIE: { x: GOAL_LINE_X_LEFT + 28, y: RINK_HEIGHT / 2 },
  };
  const awayPositions: Record<SkaterRole, { x: number; y: number }> = {
    CENTER: { x: RINK_WIDTH / 2 + 55, y: RINK_HEIGHT / 2 },
    WING_TOP: { x: RINK_WIDTH / 2 + 140, y: RINK_HEIGHT / 2 - 135 },
    DEFENSE_BOTTOM: { x: RINK_WIDTH / 2 + 250, y: RINK_HEIGHT / 2 + 120 },
    GOALIE: { x: GOAL_LINE_X_RIGHT - 28, y: RINK_HEIGHT / 2 },
  };

  for (const s of state.skaters) {
    const pos = s.team === 'HOME' ? homePositions[s.role] : awayPositions[s.role];
    s.x = pos.x;
    s.y = pos.y;
    s.vx = 0;
    s.vy = 0;
    s.facingX = s.team === 'HOME' ? 1 : -1;
    s.facingY = 0;
    s.stunTimer = 0;
    s.telegraphTimer = 0;
    s.telegraphType = 'NONE';
    s.scaleX = 1;
    s.scaleY = 1;
  }

  state.puck.x = RINK_WIDTH / 2;
  state.puck.y = RINK_HEIGHT / 2;
  state.puck.vx = 0;
  state.puck.vy = (Math.random() - 0.5) * 40;
  state.puck.ownerId = null;
  state.puck.pickupCooldown = 0.15;
  state.puck.trail = [];
  state.shotCharge = 0;
  state.isChargingShot = false;
  state.awayShotCharge = 0;
  state.isAwayChargingShot = false;
  state.controlledHomeId = 'home_c';
  if (state.matchMode === 'pvp_local' || state.matchMode === 'pvp_online') {
    state.controlledAwayId = 'away_c';
  } else {
    state.controlledAwayId = null;
  }
}

export function constrainToRinkBoards(
  entity: { x: number; y: number; vx: number; vy: number; radius: number },
  restitution: number
): boolean {
  let bounced = false;
  const minX = 24 + entity.radius;
  const maxX = RINK_WIDTH - 24 - entity.radius;
  const minY = 24 + entity.radius;
  const maxY = RINK_HEIGHT - 24 - entity.radius;

  const innerLeft = 24 + CORNER_RADIUS;
  const innerRight = RINK_WIDTH - 24 - CORNER_RADIUS;
  const innerTop = 24 + CORNER_RADIUS;
  const innerBottom = RINK_HEIGHT - 24 - CORNER_RADIUS;

  let cornerCx: number | null = null;
  let cornerCy: number | null = null;

  if (entity.x < innerLeft && entity.y < innerTop) {
    cornerCx = innerLeft;
    cornerCy = innerTop;
  } else if (entity.x > innerRight && entity.y < innerTop) {
    cornerCx = innerRight;
    cornerCy = innerTop;
  } else if (entity.x < innerLeft && entity.y > innerBottom) {
    cornerCx = innerLeft;
    cornerCy = innerBottom;
  } else if (entity.x > innerRight && entity.y > innerBottom) {
    cornerCx = innerRight;
    cornerCy = innerBottom;
  }

  if (cornerCx !== null && cornerCy !== null) {
    const dx = entity.x - cornerCx;
    const dy = entity.y - cornerCy;
    const dist = Math.hypot(dx, dy);
    const maxCornerDist = CORNER_RADIUS - entity.radius;
    if (dist > maxCornerDist && dist > 0.001) {
      const nx = dx / dist;
      const ny = dy / dist;
      entity.x = cornerCx + nx * maxCornerDist;
      entity.y = cornerCy + ny * maxCornerDist;
      const dot = entity.vx * nx + entity.vy * ny;
      if (dot > 0) {
        entity.vx -= (1 + restitution) * dot * nx;
        entity.vy -= (1 + restitution) * dot * ny;
        bounced = true;
      }
    }
    return bounced;
  }

  if (entity.x < minX) {
    entity.x = minX;
    entity.vx = Math.abs(entity.vx) * restitution;
    bounced = true;
  } else if (entity.x > maxX) {
    entity.x = maxX;
    entity.vx = -Math.abs(entity.vx) * restitution;
    bounced = true;
  }

  if (entity.y < minY) {
    entity.y = minY;
    entity.vy = Math.abs(entity.vy) * restitution;
    bounced = true;
  } else if (entity.y > maxY) {
    entity.y = maxY;
    entity.vy = -Math.abs(entity.vy) * restitution;
    bounced = true;
  }

  return bounced;
}

export function stepHockeyPhysics(
  state: MatchSimulationState,
  rawDt: number,
  homeInput: PlayerInputState,
  awayInput?: PlayerInputState | null,
  isAttractMode = false
): void {
  const dt = Math.min(rawDt, 0.05);
  state.events = [];

  state.cameraTrauma = Math.max(0, state.cameraTrauma - dt * 1.8);

  if (state.isFinished) return;

  if (state.goalCelebrationTimer > 0) {
    state.goalCelebrationTimer -= dt;
    if (state.goalCelebrationTimer <= 0) {
      state.goalCelebrationTimer = 0;
      resetFaceoffPositions(state);
    }
    return;
  }

  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return;
  }

  if (!isAttractMode) {
    state.periodTimeRemaining -= dt;
    if (state.periodTimeRemaining <= 0) {
      if (state.period < 3) {
        state.period += 1;
        state.periodTimeRemaining = 60;
        state.events.push({
          type: 'PERIOD_END',
          x: RINK_WIDTH / 2,
          y: RINK_HEIGHT / 2,
          weight: 'LIGHT',
        });
        resetFaceoffPositions(state);
        return;
      } else if (state.homeScore === state.awayScore && !state.isOvertime) {
        state.isOvertime = true;
        state.period = 4;
        state.periodTimeRemaining = 45;
        state.events.push({
          type: 'PERIOD_END',
          x: RINK_WIDTH / 2,
          y: RINK_HEIGHT / 2,
          weight: 'HEAVY',
        });
        resetFaceoffPositions(state);
        return;
      } else {
        state.periodTimeRemaining = 0;
        state.isFinished = true;
        state.events.push({
          type: 'MATCH_END',
          x: RINK_WIDTH / 2,
          y: RINK_HEIGHT / 2,
          weight: 'HEAVY',
        });
        return;
      }
    }
  }

  // Switch controlled HOME player on request
  if (!isAttractMode && homeInput.switchJustPressed) {
    const homeFieldSkaters = state.skaters.filter(s => s.team === 'HOME' && s.role !== 'GOALIE');
    homeFieldSkaters.sort((a, b) => {
      const da = Math.hypot(a.x - state.puck.x, a.y - state.puck.y);
      const db = Math.hypot(b.x - state.puck.x, b.y - state.puck.y);
      return da - db;
    });
    const next = homeFieldSkaters.find(s => s.id !== state.controlledHomeId) || homeFieldSkaters[0];
    if (next) state.controlledHomeId = next.id;
  }

  // Switch controlled AWAY player on request (in PvP mode)
  if (!isAttractMode && state.controlledAwayId && awayInput?.switchJustPressed) {
    const awayFieldSkaters = state.skaters.filter(s => s.team === 'AWAY' && s.role !== 'GOALIE');
    awayFieldSkaters.sort((a, b) => {
      const da = Math.hypot(a.x - state.puck.x, a.y - state.puck.y);
      const db = Math.hypot(b.x - state.puck.x, b.y - state.puck.y);
      return da - db;
    });
    const next = awayFieldSkaters.find(s => s.id !== state.controlledAwayId) || awayFieldSkaters[0];
    if (next) state.controlledAwayId = next.id;
  }

  // Step each skater
  for (const s of state.skaters) {
    s.stunTimer = Math.max(0, s.stunTimer - dt);
    s.checkCooldown = Math.max(0, s.checkCooldown - dt);
    s.scaleX += (1 - s.scaleX) * Math.min(1, dt * 12);
    s.scaleY += (1 - s.scaleY) * Math.min(1, dt * 12);

    const maxSpeed = 240 + (s.attrs.statSpeed - 50) * 3.1;
    const accel = 920 + (s.attrs.statHandling - 50) * 6;

    const isControlledHome = !isAttractMode && s.id === state.controlledHomeId;
    const isControlledAway =
      !isAttractMode &&
      state.controlledAwayId !== null &&
      s.id === state.controlledAwayId &&
      Boolean(awayInput);

    if (s.stunTimer > 0) {
      s.vx *= Math.pow(0.25, dt);
      s.vy *= Math.pow(0.25, dt);
    } else if (isControlledHome || isControlledAway) {
      const inp = isControlledHome ? homeInput : awayInput!;
      const len = Math.hypot(inp.moveX, inp.moveY);
      const nx = len > 0.01 ? inp.moveX / len : 0;
      const ny = len > 0.01 ? inp.moveY / len : 0;

      const sprinting = inp.sprintHeld && s.stamina > 8;
      const speedMult = sprinting ? 1.28 : 1.0;

      if (sprinting && len > 0.01) {
        const drainRate = Math.max(12, 28 - (s.attrs.statStamina - 50) * 0.25);
        s.stamina = Math.max(0, s.stamina - drainRate * dt);
      } else {
        const regenRate = 14 + (s.attrs.statStamina - 50) * 0.22;
        s.stamina = Math.min(s.maxStamina, s.stamina + regenRate * dt);
      }

      if (len > 0.01) {
        s.vx += nx * accel * speedMult * dt;
        s.vy += ny * accel * speedMult * dt;
        s.facingX = nx;
        s.facingY = ny;
      }

      if (inp.dekeJustPressed && s.stamina >= 15) {
        s.stamina -= 15;
        s.vx += s.facingX * 210;
        s.vy += s.facingY * 210;
        s.scaleX = 1.22;
        s.scaleY = 0.82;
      }

      if (inp.checkJustPressed && state.puck.ownerId !== s.id && s.checkCooldown <= 0) {
        s.checkCooldown = 0.85;
        const checkImpulse = 340 + (s.attrs.statChecking - 50) * 3.5;
        s.vx += s.facingX * checkImpulse;
        s.vy += s.facingY * checkImpulse;
        s.scaleX = 1.25;
        s.scaleY = 0.78;
      }
    } else {
      stepAiSkater(s, state, dt, maxSpeed, accel);
    }

    const iceDrag = s.role === 'GOALIE' ? 0.06 : 0.16;
    s.vx *= Math.pow(iceDrag, dt);
    s.vy *= Math.pow(iceDrag, dt);

    const curSpeed = Math.hypot(s.vx, s.vy);
    const cap = s.checkCooldown > 0.55 ? maxSpeed * 1.45 : maxSpeed * 1.25;
    if (curSpeed > cap) {
      s.vx = (s.vx / curSpeed) * cap;
      s.vy = (s.vy / curSpeed) * cap;
    }

    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.gaitPhase += curSpeed * dt * 0.045;

    constrainToRinkBoards(s, 0.4);
  }

  // Handle controlled HOME player shooting & passing
  const activeHome = state.skaters.find(s => s.id === state.controlledHomeId);
  if (!isAttractMode && activeHome) {
    if (state.puck.ownerId === activeHome.id) {
      if (homeInput.shootHeld) {
        state.isChargingShot = true;
        state.shotCharge = Math.min(1, state.shotCharge + dt * 1.45);
      }
      if (homeInput.shootJustReleased || (state.isChargingShot && !homeInput.shootHeld)) {
        firePuckShot(activeHome, state, Math.max(0.25, state.shotCharge));
        state.shotCharge = 0;
        state.isChargingShot = false;
      } else if (homeInput.passJustPressed) {
        passPuckToTeammate(activeHome, state);
        state.shotCharge = 0;
        state.isChargingShot = false;
      }
    } else {
      state.shotCharge = 0;
      state.isChargingShot = false;
    }
  }

  // Handle controlled AWAY player shooting & passing (in PvP mode)
  const activeAway = state.controlledAwayId
    ? state.skaters.find(s => s.id === state.controlledAwayId)
    : undefined;
  if (!isAttractMode && activeAway && awayInput) {
    if (state.puck.ownerId === activeAway.id) {
      if (awayInput.shootHeld) {
        state.isAwayChargingShot = true;
        state.awayShotCharge = Math.min(1, state.awayShotCharge + dt * 1.45);
      }
      if (awayInput.shootJustReleased || (state.isAwayChargingShot && !awayInput.shootHeld)) {
        firePuckShot(activeAway, state, Math.max(0.25, state.awayShotCharge));
        state.awayShotCharge = 0;
        state.isAwayChargingShot = false;
      } else if (awayInput.passJustPressed) {
        passPuckToTeammate(activeAway, state);
        state.awayShotCharge = 0;
        state.isAwayChargingShot = false;
      }
    } else {
      state.awayShotCharge = 0;
      state.isAwayChargingShot = false;
    }
  }

  // Skater-to-skater collisions & body checks
  for (let i = 0; i < state.skaters.length; i++) {
    for (let j = i + 1; j < state.skaters.length; j++) {
      const a = state.skaters[i];
      const b = state.skaters[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = a.radius + b.radius;
      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;

        const relVx = a.vx - b.vx;
        const relVy = a.vy - b.vy;
        const impactSpeed = Math.hypot(relVx, relVy);

        if (a.team !== b.team && impactSpeed > 235) {
          const aMomentum = Math.hypot(a.vx, a.vy) * (1 + (a.attrs.statChecking - 50) * 0.012);
          const bMomentum = Math.hypot(b.vx, b.vy) * (1 + (b.attrs.statChecking - 50) * 0.012);
          const hitter = aMomentum >= bMomentum ? a : b;
          const victim = hitter === a ? b : a;

          if (victim.role !== 'GOALIE' && victim.stunTimer <= 0) {
            victim.stunTimer = 0.65;
            const knockDirX = victim === b ? nx : -nx;
            const knockDirY = victim === b ? ny : -ny;
            victim.vx = knockDirX * 320;
            victim.vy = knockDirY * 320;
            victim.scaleX = 1.3;
            victim.scaleY = 0.72;

            if (hitter.team === 'HOME') state.homeHits += 1;
            else state.awayHits += 1;

            if (state.puck.ownerId === victim.id) {
              state.puck.ownerId = hitter.id;
              state.puck.pickupCooldown = 0.18;
              if (hitter.team === 'HOME') {
                state.puck.prevTouchedByHomeId = state.puck.lastTouchedByHomeId;
                state.puck.lastTouchedByHomeId = hitter.id;
                if (hitter.role !== 'GOALIE') state.controlledHomeId = hitter.id;
              } else if (state.controlledAwayId && hitter.role !== 'GOALIE') {
                state.controlledAwayId = hitter.id;
              }
            }

            state.hitstopTimer = 0.04;
            state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.55);
            state.events.push({
              type: 'HEAVY_HIT',
              team: hitter.team,
              x: victim.x,
              y: victim.y,
              weight: 'HEAVY',
            });
          }
        }
      }
    }
  }

  // Step Puck Physics
  state.puck.pickupCooldown = Math.max(0, state.puck.pickupCooldown - dt);

  if (state.puck.ownerId) {
    const owner = state.skaters.find(s => s.id === state.puck.ownerId);
    if (!owner || owner.stunTimer > 0) {
      state.puck.ownerId = null;
    } else {
      const stickOffset = owner.radius + 10;
      state.puck.x = owner.x + owner.facingX * stickOffset;
      state.puck.y = owner.y + owner.facingY * stickOffset;
      state.puck.vx = owner.vx;
      state.puck.vy = owner.vy;

      if (owner.role === 'GOALIE') {
        passPuckToTeammate(owner, state);
      }
    }
  } else {
    state.puck.x += state.puck.vx * dt;
    state.puck.y += state.puck.vy * dt;
    state.puck.vx *= Math.pow(0.58, dt);
    state.puck.vy *= Math.pow(0.58, dt);

    const inGoalY = state.puck.y > GOAL_Y_TOP + 6 && state.puck.y < GOAL_Y_BOTTOM - 6;
    if (inGoalY && state.puck.x <= GOAL_LINE_X_LEFT && state.puck.x >= GOAL_LINE_X_LEFT - 38 && state.puck.vx < 0) {
      state.awayScore += 1;
      state.lastScoringTeam = 'AWAY';
      state.goalCelebrationTimer = 1.6;
      state.hitstopTimer = 0.06;
      state.cameraTrauma = 0.85;
      const awayScorer =
        state.skaters.find(s => s.team === 'AWAY' && s.role === 'CENTER') || state.skaters[4];
      state.events.push({
        type: 'GOAL',
        team: 'AWAY',
        scorerName: awayScorer?.name || 'Away Scorer',
        x: state.puck.x,
        y: state.puck.y,
        weight: 'HEAVY',
      });
      recordFrameAndHighlights(state, dt, true);
      if (state.isOvertime) state.isFinished = true;
      return;
    }

    if (inGoalY && state.puck.x >= GOAL_LINE_X_RIGHT && state.puck.x <= GOAL_LINE_X_RIGHT + 38 && state.puck.vx > 0) {
      state.homeScore += 1;
      if (
        state.puck.prevTouchedByHomeId &&
        state.puck.prevTouchedByHomeId !== state.puck.lastTouchedByHomeId
      ) {
        state.homeAssists += 1;
      }
      state.lastScoringTeam = 'HOME';
      state.goalCelebrationTimer = 1.6;
      state.hitstopTimer = 0.06;
      state.cameraTrauma = 0.85;
      const scorer = state.skaters.find(s => s.id === state.puck.lastTouchedByHomeId);
      state.events.push({
        type: 'GOAL',
        team: 'HOME',
        scorerName: scorer?.name || 'Home Captain',
        x: state.puck.x,
        y: state.puck.y,
        weight: 'HEAVY',
      });
      recordFrameAndHighlights(state, dt, true);
      if (state.isOvertime) state.isFinished = true;
      return;
    }

    const posts = [
      { x: GOAL_LINE_X_LEFT, y: GOAL_Y_TOP },
      { x: GOAL_LINE_X_LEFT, y: GOAL_Y_BOTTOM },
      { x: GOAL_LINE_X_RIGHT, y: GOAL_Y_TOP },
      { x: GOAL_LINE_X_RIGHT, y: GOAL_Y_BOTTOM },
    ];
    for (const post of posts) {
      const dx = state.puck.x - post.x;
      const dy = state.puck.y - post.y;
      const d = Math.hypot(dx, dy);
      if (d < state.puck.radius + 6 && d > 0.001) {
        const nx = dx / d;
        const ny = dy / d;
        state.puck.x = post.x + nx * (state.puck.radius + 6);
        state.puck.y = post.y + ny * (state.puck.radius + 6);
        const dot = state.puck.vx * nx + state.puck.vy * ny;
        state.puck.vx -= 1.9 * dot * nx;
        state.puck.vy -= 1.9 * dot * ny;
        state.events.push({
          type: 'POST_PING',
          x: post.x,
          y: post.y,
          weight: 'HEAVY',
        });
      }
    }

    constrainToRinkBoards(state.puck, 0.82);

    if (state.puck.pickupCooldown <= 0) {
      for (const s of state.skaters) {
        if (s.stunTimer > 0) continue;
        const reach = s.radius + state.puck.radius + 8 + (s.attrs.statHandling - 50) * 0.14;
        const dist = Math.hypot(state.puck.x - s.x, state.puck.y - s.y);
        if (dist <= reach) {
          const puckSpeed = Math.hypot(state.puck.vx, state.puck.vy);
          if (s.role === 'GOALIE' && puckSpeed > 260) {
            if (s.team === 'HOME') state.homeSaves += 1;
            else state.awaySaves += 1;
            state.events.push({
              type: 'SAVE',
              team: s.team,
              x: s.x,
              y: s.y,
              weight: 'LIGHT',
            });
          }
          state.puck.ownerId = s.id;
          state.puck.pickupCooldown = 0.2;
          if (s.team === 'HOME') {
            if (state.puck.lastTouchedByHomeId !== s.id) {
              state.puck.prevTouchedByHomeId = state.puck.lastTouchedByHomeId;
              state.puck.lastTouchedByHomeId = s.id;
            }
            if (s.role !== 'GOALIE') {
              state.controlledHomeId = s.id;
            }
          } else {
            state.puck.lastTouchedByHomeId = null;
            state.puck.prevTouchedByHomeId = null;
            if (state.controlledAwayId && s.role !== 'GOALIE') {
              state.controlledAwayId = s.id;
            }
          }
          break;
        }
      }
    }
  }

  state.puck.trail.push({ x: state.puck.x, y: state.puck.y });
  if (state.puck.trail.length > 12) {
    state.puck.trail.shift();
  }

  recordFrameAndHighlights(state, dt, false);
}

export function firePuckShot(
  shooter: SkaterEntity,
  state: MatchSimulationState,
  charge: number
): void {
  const targetGoalX = shooter.team === 'HOME' ? GOAL_LINE_X_RIGHT : GOAL_LINE_X_LEFT;
  const toGoalX = targetGoalX - shooter.x;
  const toGoalY = RINK_HEIGHT / 2 + shooter.facingY * 42 - shooter.y;
  const toGoalLen = Math.hypot(toGoalX, toGoalY) || 1;
  const gx = toGoalX / toGoalLen;
  const gy = toGoalY / toGoalLen;

  const aimX = shooter.facingX * 0.55 + gx * 0.45;
  const aimY = shooter.facingY * 0.55 + gy * 0.45;
  const aimLen = Math.hypot(aimX, aimY) || 1;

  const baseShotSpeed = 540 + (shooter.attrs.statPower - 50) * 5.2;
  const finalSpeed = baseShotSpeed * (0.72 + charge * 0.55);

  state.puck.ownerId = null;
  state.puck.pickupCooldown = 0.24;
  state.puck.vx = (aimX / aimLen) * finalSpeed;
  state.puck.vy = (aimY / aimLen) * finalSpeed;

  shooter.scaleX = 1.24;
  shooter.scaleY = 0.8;

  if (shooter.team === 'HOME') state.homeShots += 1;
  else state.awayShots += 1;

  if (charge > 0.65) {
    state.hitstopTimer = 0.03;
    state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.32);
  }

  state.events.push({
    type: 'SHOT',
    team: shooter.team,
    x: shooter.x,
    y: shooter.y,
    weight: charge > 0.65 ? 'HEAVY' : 'LIGHT',
  });
}

export function passPuckToTeammate(passer: SkaterEntity, state: MatchSimulationState): void {
  const teammates = state.skaters.filter(
    s => s.team === passer.team && s.id !== passer.id && s.role !== 'GOALIE'
  );
  if (teammates.length === 0) {
    firePuckShot(passer, state, 0.3);
    return;
  }

  let bestTarget = teammates[0];
  let bestScore = -Infinity;
  for (const tm of teammates) {
    const dx = tm.x - passer.x;
    const dy = tm.y - passer.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dot = (dx / dist) * passer.facingX + (dy / dist) * passer.facingY;
    const upIceBonus = passer.team === 'HOME' ? tm.x * 0.002 : (RINK_WIDTH - tm.x) * 0.002;
    const score = dot * 2 + upIceBonus;
    if (score > bestScore) {
      bestScore = score;
      bestTarget = tm;
    }
  }

  const dx = bestTarget.x - state.puck.x;
  const dy = bestTarget.y - state.puck.y;
  const dist = Math.hypot(dx, dy) || 1;
  const passSpeed = 620;

  state.puck.ownerId = null;
  state.puck.pickupCooldown = 0.16;
  state.puck.vx = (dx / dist) * passSpeed;
  state.puck.vy = (dy / dist) * passSpeed;

  if (passer.team === 'HOME' && bestTarget.role !== 'GOALIE') {
    state.controlledHomeId = bestTarget.id;
  } else if (passer.team === 'AWAY' && state.controlledAwayId && bestTarget.role !== 'GOALIE') {
    state.controlledAwayId = bestTarget.id;
  }

  state.events.push({
    type: 'PASS',
    team: passer.team,
    x: passer.x,
    y: passer.y,
    weight: 'LIGHT',
  });
}

function stepAiSkater(
  s: SkaterEntity,
  state: MatchSimulationState,
  dt: number,
  _maxSpeed: number,
  accel: number
): void {
  const attackSign = s.team === 'HOME' ? 1 : -1;
  const targetGoalX = s.team === 'HOME' ? GOAL_LINE_X_RIGHT : GOAL_LINE_X_LEFT;
  const ownGoalX = s.team === 'HOME' ? GOAL_LINE_X_LEFT : GOAL_LINE_X_RIGHT;

  // Apply AI difficulty scaling for AWAY team (and supportive AI teammates on HOME)
  const diffCfg = AI_DIFFICULTY_CONFIG[state.aiDifficulty || 'pro'];
  const aiPace = s.team === 'AWAY' ? diffCfg.speedMultiplier : 0.84;

  // 1. CREASE GOALIE POLICY
  if (s.role === 'GOALIE') {
    const goalX = s.team === 'HOME' ? GOAL_LINE_X_LEFT + 26 : GOAL_LINE_X_RIGHT - 26;
    const targetY = Math.max(
      GOAL_Y_TOP + 14,
      Math.min(GOAL_Y_BOTTOM - 14, state.puck.y)
    );
    const dx = goalX - s.x;
    const dy = targetY - s.y;
    const reflex = s.team === 'AWAY' ? 16 * aiPace : 16;
    s.vx += dx * 14 * dt;
    s.vy += dy * reflex * dt;
    s.facingX = attackSign;
    s.facingY = 0;
    return;
  }

  // If this AI skater has the puck:
  if (state.puck.ownerId === s.id) {
    const distToNet = Math.hypot(targetGoalX - s.x, RINK_HEIGHT / 2 - s.y);

    if (distToNet < 390) {
      if (s.telegraphType !== 'SLAPSHOT_AIM') {
        s.telegraphType = 'SLAPSHOT_AIM';
        s.telegraphTimer = s.team === 'AWAY' ? diffCfg.reactionDelay : 0.36;
      } else {
        s.telegraphTimer -= dt;
        const aimDx = targetGoalX - s.x;
        const aimDy = RINK_HEIGHT / 2 + (s.y < RINK_HEIGHT / 2 ? 32 : -32) - s.y;
        const aimLen = Math.hypot(aimDx, aimDy) || 1;
        s.facingX = aimDx / aimLen;
        s.facingY = aimDy / aimLen;
        if (s.telegraphTimer <= 0) {
          s.telegraphType = 'NONE';
          firePuckShot(s, state, 0.85 * diffCfg.shotChargeMultiplier);
          return;
        }
      }
    } else {
      s.telegraphType = 'NONE';
    }

    const slotX = targetGoalX - attackSign * 220;
    const slotY = s.aiPolicy === 'SNIPER_WING' ? RINK_HEIGHT / 2 - 90 : RINK_HEIGHT / 2 + 50;
    const dx = slotX - s.x;
    const dy = slotY - s.y;
    const d = Math.hypot(dx, dy) || 1;
    s.vx += (dx / d) * accel * aiPace * dt;
    s.vy += (dy / d) * accel * aiPace * dt;
    s.facingX = dx / d;
    s.facingY = dy / d;
    return;
  }

  s.telegraphType = 'NONE';

  let targetX = state.puck.x;
  let targetY = state.puck.y;

  if (s.aiPolicy === 'ENFORCER_DEFENSE') {
    const inDefZone =
      s.team === 'HOME' ? state.puck.x < RINK_WIDTH * 0.55 : state.puck.x > RINK_WIDTH * 0.45;
    if (inDefZone) {
      targetX = state.puck.x;
      targetY = state.puck.y;
      const distToPuck = Math.hypot(state.puck.x - s.x, state.puck.y - s.y);
      if (distToPuck < 150 && s.checkCooldown <= 0 && state.puck.ownerId) {
        s.telegraphType = 'HEAVY_CHECK';
        s.checkCooldown = 1.2;
        const dx = state.puck.x - s.x;
        const dy = state.puck.y - s.y;
        const d = Math.hypot(dx, dy) || 1;
        s.vx += (dx / d) * 310 * aiPace;
        s.vy += (dy / d) * 310 * aiPace;
      }
    } else {
      targetX = ownGoalX + attackSign * 310;
      targetY = RINK_HEIGHT / 2 + (state.puck.y - RINK_HEIGHT / 2) * 0.5;
    }
  } else if (s.aiPolicy === 'SNIPER_WING') {
    const teammateHasPuck =
      state.puck.ownerId &&
      state.skaters.find(k => k.id === state.puck.ownerId)?.team === s.team;
    if (teammateHasPuck) {
      targetX = targetGoalX - attackSign * 240;
      targetY = RINK_HEIGHT / 2 - 140;
    } else {
      targetX = state.puck.x;
      targetY = state.puck.y - 45;
    }
  } else {
    targetX = state.puck.x;
    targetY = state.puck.y;
  }

  const dx = targetX - s.x;
  const dy = targetY - s.y;
  const d = Math.hypot(dx, dy) || 1;
  if (d > 12) {
    s.vx += (dx / d) * accel * aiPace * dt;
    s.vy += (dy / d) * accel * aiPace * dt;
    s.facingX = dx / d;
    s.facingY = dy / d;
  }
}

// Tournament Bracket Logic
export interface BracketMatchup {
  id: string;
  round: number;
  roundName: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
  involvesUser: boolean;
}

export interface TournamentBracketState {
  mode: TournamentCategory;
  title: string;
  userTeamId: string;
  currentRound: number;
  status: 'active' | 'champion' | 'eliminated';
  matches: BracketMatchup[];
  goalsFor: number;
  goalsAgainst: number;
  wins: number;
}

export function createTournamentBracket(
  mode: TournamentCategory,
  userTeamId: string
): TournamentBracketState {
  let pool: HockeyTeam[];
  let title = 'IIHF World Cup Championship';

  if (mode === 'asia_cup') {
    pool = HOCKEY_TEAMS.filter(t => t.isAsiaCup);
    title = 'Asia Cup Championship';
  } else if (mode === 'world_cup') {
    pool = HOCKEY_TEAMS.filter(t => t.isWorldCup);
    title = 'World Cup Championship';
  } else {
    pool = [...HOCKEY_TEAMS];
    title = 'All-Teams Global Super Cup';
  }

  const userTeam = getTeamById(userTeamId);
  const others = pool.filter(t => t.id !== userTeam.id);

  // If Asia Cup and user picked India (IND) or Pakistan (PAK), place the rival in slot 7 so QF1 is IND vs PAK
  if (mode === 'asia_cup' && (userTeam.id === 'IND' || userTeam.id === 'PAK')) {
    const rivalId = userTeam.id === 'IND' ? 'PAK' : 'IND';
    const rivalTeam = getTeamById(rivalId);
    const remaining = others.filter(t => t.id !== rivalId).slice(0, 6);
    const eightTeams = [userTeam, ...remaining, rivalTeam];
    const qfMatches: BracketMatchup[] = [
      {
        id: 'qf_1',
        round: 0,
        roundName: 'Quarterfinals',
        homeTeamId: eightTeams[0].id,
        awayTeamId: eightTeams[7].id,
        homeScore: null,
        awayScore: null,
        winnerTeamId: null,
        involvesUser: true,
      },
      {
        id: 'qf_2',
        round: 0,
        roundName: 'Quarterfinals',
        homeTeamId: eightTeams[3].id,
        awayTeamId: eightTeams[4].id,
        homeScore: null,
        awayScore: null,
        winnerTeamId: null,
        involvesUser: false,
      },
      {
        id: 'qf_3',
        round: 0,
        roundName: 'Quarterfinals',
        homeTeamId: eightTeams[1].id,
        awayTeamId: eightTeams[6].id,
        homeScore: null,
        awayScore: null,
        winnerTeamId: null,
        involvesUser: false,
      },
      {
        id: 'qf_4',
        round: 0,
        roundName: 'Quarterfinals',
        homeTeamId: eightTeams[2].id,
        awayTeamId: eightTeams[5].id,
        homeScore: null,
        awayScore: null,
        winnerTeamId: null,
        involvesUser: false,
      },
    ];
    return {
      mode,
      title,
      userTeamId: userTeam.id,
      currentRound: 0,
      status: 'active',
      matches: qfMatches,
      goalsFor: 0,
      goalsAgainst: 0,
      wins: 0,
    };
  }

  const selectedOpponents = others.slice(0, 7);
  const eightTeams = [userTeam, ...selectedOpponents];

  const qfMatches: BracketMatchup[] = [
    {
      id: 'qf_1',
      round: 0,
      roundName: 'Quarterfinals',
      homeTeamId: eightTeams[0].id,
      awayTeamId: eightTeams[7].id,
      homeScore: null,
      awayScore: null,
      winnerTeamId: null,
      involvesUser: true,
    },
    {
      id: 'qf_2',
      round: 0,
      roundName: 'Quarterfinals',
      homeTeamId: eightTeams[3].id,
      awayTeamId: eightTeams[4].id,
      homeScore: null,
      awayScore: null,
      winnerTeamId: null,
      involvesUser: false,
    },
    {
      id: 'qf_3',
      round: 0,
      roundName: 'Quarterfinals',
      homeTeamId: eightTeams[1].id,
      awayTeamId: eightTeams[6].id,
      homeScore: null,
      awayScore: null,
      winnerTeamId: null,
      involvesUser: false,
    },
    {
      id: 'qf_4',
      round: 0,
      roundName: 'Quarterfinals',
      homeTeamId: eightTeams[2].id,
      awayTeamId: eightTeams[5].id,
      homeScore: null,
      awayScore: null,
      winnerTeamId: null,
      involvesUser: false,
    },
  ];

  return {
    mode,
    title,
    userTeamId: userTeam.id,
    currentRound: 0,
    status: 'active',
    matches: qfMatches,
    goalsFor: 0,
    goalsAgainst: 0,
    wins: 0,
  };
}

export function recordTournamentUserMatchResult(
  bracket: TournamentBracketState,
  userGoals: number,
  opponentGoals: number
): TournamentBracketState {
  if (bracket.status !== 'active') return bracket;

  const updatedMatches = bracket.matches.map(m => ({ ...m }));
  const currentRoundMatches = updatedMatches.filter(m => m.round === bracket.currentRound);

  const finalUserGoals = userGoals === opponentGoals ? userGoals + 1 : userGoals;
  const finalOppGoals = opponentGoals;

  for (const m of currentRoundMatches) {
    if (m.involvesUser) {
      const userIsHome = m.homeTeamId === bracket.userTeamId;
      m.homeScore = userIsHome ? finalUserGoals : finalOppGoals;
      m.awayScore = userIsHome ? finalOppGoals : finalUserGoals;
      m.winnerTeamId =
        finalUserGoals > finalOppGoals
          ? bracket.userTeamId
          : userIsHome
          ? m.awayTeamId
          : m.homeTeamId;
    } else if (!m.winnerTeamId) {
      const home = getTeamById(m.homeTeamId);
      const away = getTeamById(m.awayTeamId);
      const homeAdv = home.rating >= away.rating ? 1 : 0;
      m.homeScore = 2 + homeAdv;
      m.awayScore = 2 + (1 - homeAdv);
      m.winnerTeamId = m.homeScore > m.awayScore ? m.homeTeamId : m.awayTeamId;
    }
  }

  const userMatch = currentRoundMatches.find(m => m.involvesUser);
  const userWon = userMatch?.winnerTeamId === bracket.userTeamId;
  const goalsFor = bracket.goalsFor + finalUserGoals;
  const goalsAgainst = bracket.goalsAgainst + finalOppGoals;
  const wins = bracket.wins + (userWon ? 1 : 0);

  if (!userWon) {
    return {
      ...bracket,
      matches: updatedMatches,
      goalsFor,
      goalsAgainst,
      wins,
      status: 'eliminated',
    };
  }

  if (bracket.currentRound === 2) {
    return {
      ...bracket,
      matches: updatedMatches,
      goalsFor,
      goalsAgainst,
      wins,
      status: 'champion',
    };
  }

  const nextRound = bracket.currentRound + 1;
  const roundName = nextRound === 1 ? 'Semifinals' : 'Championship Final';
  for (let i = 0; i < currentRoundMatches.length; i += 2) {
    const w1 = currentRoundMatches[i].winnerTeamId!;
    const w2 = currentRoundMatches[i + 1].winnerTeamId!;
    updatedMatches.push({
      id: `r${nextRound}_${i / 2 + 1}`,
      round: nextRound,
      roundName,
      homeTeamId: w1,
      awayTeamId: w2,
      homeScore: null,
      awayScore: null,
      winnerTeamId: null,
      involvesUser: w1 === bracket.userTeamId || w2 === bracket.userTeamId,
    });
  }

  return {
    ...bracket,
    currentRound: nextRound,
    matches: updatedMatches,
    goalsFor,
    goalsAgainst,
    wins,
  };
}

function createCurrentReplayFrame(state: MatchSimulationState): ReplayFrameSnapshot {
  return {
    puckX: Math.round(state.puck.x * 10) / 10,
    puckY: Math.round(state.puck.y * 10) / 10,
    puckVx: Math.round(state.puck.vx),
    puckVy: Math.round(state.puck.vy),
    puckOwnerId: state.puck.ownerId,
    skaters: state.skaters.map(s => ({
      id: s.id,
      team: s.team,
      role: s.role,
      number: s.number,
      name: s.name,
      x: Math.round(s.x * 10) / 10,
      y: Math.round(s.y * 10) / 10,
      facingX: Math.round(s.facingX * 100) / 100,
      facingY: Math.round(s.facingY * 100) / 100,
    })),
  };
}

function formatClockLabel(secondsRemaining: number): string {
  const secs = Math.max(0, Math.ceil(secondsRemaining));
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  return `${mm}:${ss < 10 ? '0' : ''}${ss}`;
}

function recordFrameAndHighlights(
  state: MatchSimulationState,
  dt: number,
  forceSample: boolean
): void {
  state.frameSampleAccumulator = (state.frameSampleAccumulator || 0) + dt;
  if (forceSample || state.frameSampleAccumulator >= 0.1 || state.recentFrameRing.length === 0) {
    state.frameSampleAccumulator = 0;
    state.recentFrameRing.push(createCurrentReplayFrame(state));
    if (state.recentFrameRing.length > 24) {
      state.recentFrameRing.shift();
    }
  }

  for (const ev of state.events) {
    if (
      ev.type === 'GOAL' ||
      ev.type === 'SAVE' ||
      ev.type === 'HEAVY_HIT' ||
      ev.type === 'POST_PING' ||
      (ev.type === 'SHOT' && ev.weight === 'HEAVY')
    ) {
      if (state.highlightMoments.length >= 16 && ev.type !== 'GOAL') continue;

      const team: 'HOME' | 'AWAY' = ev.team || 'HOME';
      const nearestSkater =
        state.skaters.find(s => s.team === team && Math.hypot(s.x - ev.x, s.y - ev.y) < 120) ||
        state.skaters.find(s => s.team === team && s.role === 'CENTER') ||
        state.skaters[0];

      const actorName = ev.scorerName || nearestSkater.name;
      const actorNumber = nearestSkater.number;
      const clockLabel = state.isOvertime
        ? 'OT'
        : `P${state.period} · ${formatClockLabel(state.periodTimeRemaining)}`;

      let headline = '';
      let description = '';
      if (ev.type === 'GOAL') {
        headline = `GOAL! #${actorNumber} ${actorName}`;
        description = `${actorName} buries the puck past the crease to make it ${state.homeScore}–${state.awayScore}.`;
      } else if (ev.type === 'SAVE') {
        const goalie =
          state.skaters.find(s => s.team === team && s.role === 'GOALIE') || nearestSkater;
        headline = `CLUTCH SAVE! #${goalie.number} ${goalie.name}`;
        description = `${goalie.name} turns aside a high-velocity laser in the crease.`;
      } else if (ev.type === 'HEAVY_HIT') {
        headline = `CRUSHING CHECK! #${actorNumber} ${actorName}`;
        description = `${actorName} delivers a bone-rattling open-ice body check to jar the puck loose.`;
      } else if (ev.type === 'POST_PING') {
        headline = `IRON POST PING! #${actorNumber} ${actorName}`;
        description = `A blistering slapshot rings squarely off the goal pipe at (${Math.round(ev.x)}, ${Math.round(ev.y)}).`;
      } else {
        headline = `HEAVY SLAPSHOT! #${actorNumber} ${actorName}`;
        description = `${actorName} unleashes a fully charged one-timer from the slot.`;
      }

      const clipFrames = state.recentFrameRing.map(f => ({
        ...f,
        skaters: f.skaters.map(sk => ({ ...sk })),
      }));

      state.highlightMoments.push({
        id: `hl_${state.highlightMoments.length + 1}_${ev.type.toLowerCase()}`,
        type: ev.type,
        period: state.period,
        clockLabel,
        team,
        actorName,
        actorNumber,
        headline,
        description,
        homeScoreAfter: state.homeScore,
        awayScoreAfter: state.awayScore,
        eventX: Math.round(ev.x),
        eventY: Math.round(ev.y),
        frames: clipFrames,
      });
    }
  }
}

function buildSynthesizedFramesForMoment(
  baseSkaters: SkaterEntity[],
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  actorId: string
): ReplayFrameSnapshot[] {
  const frames: ReplayFrameSnapshot[] = [];
  const totalFrames = 20;
  for (let i = 0; i < totalFrames; i++) {
    const t = i / (totalFrames - 1);
    const puckX = startX + (endX - startX) * t;
    const puckY = startY + (endY - startY) * t;
    const vx = (endX - startX) * 2.5;
    const vy = (endY - startY) * 2.5;
    frames.push({
      puckX: Math.round(puckX * 10) / 10,
      puckY: Math.round(puckY * 10) / 10,
      puckVx: Math.round(vx),
      puckVy: Math.round(vy),
      puckOwnerId: i < 6 ? actorId : null,
      skaters: baseSkaters.map(s => {
        const isActor = s.id === actorId;
        const moveScale = isActor ? 85 : s.role === 'GOALIE' ? 8 : 35;
        const dir = s.team === 'HOME' ? 1 : -1;
        return {
          id: s.id,
          team: s.team,
          role: s.role,
          number: s.number,
          name: s.name,
          x: Math.round((s.x + dir * moveScale * (t - 0.5)) * 10) / 10,
          y: Math.round((s.y + Math.sin(t * Math.PI + s.number) * 18) * 10) / 10,
          facingX: dir,
          facingY: 0,
        };
      }),
    });
  }
  return frames;
}

export function generateMatchHighlightSummary(
  state: MatchSimulationState,
  homeTeam: HockeyTeam,
  awayTeam: HockeyTeam
): MatchHighlightSummary {
  const homeWon = state.homeScore >= state.awayScore;
  const winnerCode = homeWon ? homeTeam.code : awayTeam.code;
  const headline = `${homeTeam.code} ${state.homeScore} — ${state.awayScore} ${awayTeam.code} · ${
    homeWon ? `${homeTeam.name} Victory` : `${awayTeam.name} Triumphs`
  }`;

  const totalShots = state.homeShots + state.awayShots;
  const totalHits = state.homeHits + state.awayHits;
  const totalSaves = state.homeSaves + state.awaySaves;

  const narrative = `${winnerCode} controlled the pace across ${
    state.isOvertime ? 'Overtime' : `${state.period} Period(s)`
  }, generating ${totalShots} combined shots on net (${state.homeShots} ${homeTeam.code} vs ${
    state.awayShots
  } ${awayTeam.code}), ${totalHits} heavy body checks, and ${totalSaves} crease saves.`;

  const highlights: MatchHighlightMoment[] = [...(state.highlightMoments || [])];

  const homeCaptain =
    state.skaters.find(s => s.team === 'HOME' && s.role === 'CENTER') || state.skaters[0];
  const homeSniper =
    state.skaters.find(s => s.team === 'HOME' && s.role === 'WING_TOP') || homeCaptain;
  const homeDefense =
    state.skaters.find(s => s.team === 'HOME' && s.role === 'DEFENSE_BOTTOM') || homeCaptain;
  const homeGoalie =
    state.skaters.find(s => s.team === 'HOME' && s.role === 'GOALIE') || homeCaptain;
  const awayCaptain =
    state.skaters.find(s => s.team === 'AWAY' && s.role === 'CENTER') || state.skaters[4];

  if (highlights.length === 0) {
    // Synthesize key replay highlights from the simulation state if none were captured mid-frame
    if (state.homeScore > 0) {
      highlights.push({
        id: 'hl_synth_home_goal',
        type: 'GOAL',
        period: 1,
        clockLabel: 'P1 · 0:42',
        team: 'HOME',
        actorName: homeCaptain.name,
        actorNumber: homeCaptain.number,
        headline: `GOAL! #${homeCaptain.number} ${homeCaptain.name}`,
        description: `${homeCaptain.name} rips a top-shelf slapshot from the high slot to light the lamp for ${homeTeam.code}.`,
        homeScoreAfter: state.homeScore,
        awayScoreAfter: state.awayScore,
        eventX: GOAL_LINE_X_RIGHT,
        eventY: RINK_HEIGHT / 2 - 18,
        frames: buildSynthesizedFramesForMoment(
          state.skaters,
          RINK_WIDTH / 2 + 120,
          RINK_HEIGHT / 2 - 40,
          GOAL_LINE_X_RIGHT + 8,
          RINK_HEIGHT / 2 - 18,
          homeCaptain.id
        ),
      });
    }

    if (state.awayScore > 0) {
      highlights.push({
        id: 'hl_synth_away_goal',
        type: 'GOAL',
        period: 1,
        clockLabel: 'P1 · 0:29',
        team: 'AWAY',
        actorName: awayCaptain.name,
        actorNumber: awayCaptain.number,
        headline: `GOAL! #${awayCaptain.number} ${awayCaptain.name}`,
        description: `${awayCaptain.name} finishes a fast break across the blue line for ${awayTeam.code}.`,
        homeScoreAfter: state.homeScore,
        awayScoreAfter: state.awayScore,
        eventX: GOAL_LINE_X_LEFT,
        eventY: RINK_HEIGHT / 2 + 16,
        frames: buildSynthesizedFramesForMoment(
          state.skaters,
          RINK_WIDTH / 2 - 110,
          RINK_HEIGHT / 2 + 35,
          GOAL_LINE_X_LEFT - 8,
          RINK_HEIGHT / 2 + 16,
          awayCaptain.id
        ),
      });
    }

    highlights.push({
      id: 'hl_synth_hit',
      type: 'HEAVY_HIT',
      period: state.period,
      clockLabel: 'P1 · 0:19',
      team: 'HOME',
      actorName: homeDefense.name,
      actorNumber: homeDefense.number,
      headline: `CRUSHING CHECK! #${homeDefense.number} ${homeDefense.name}`,
      description: `${homeDefense.name} steps up at the blue line to separate the puck carrier with a thunderous check.`,
      homeScoreAfter: state.homeScore,
      awayScoreAfter: state.awayScore,
      eventX: RINK_WIDTH / 2 + 95,
      eventY: RINK_HEIGHT / 2 + 70,
      frames: buildSynthesizedFramesForMoment(
        state.skaters,
        RINK_WIDTH / 2 + 20,
        RINK_HEIGHT / 2 + 90,
        RINK_WIDTH / 2 + 95,
        RINK_HEIGHT / 2 + 70,
        homeDefense.id
      ),
    });

    highlights.push({
      id: 'hl_synth_save',
      type: 'SAVE',
      period: state.period,
      clockLabel: 'P1 · 0:08',
      team: 'HOME',
      actorName: homeGoalie.name,
      actorNumber: homeGoalie.number,
      headline: `GLOVE SAVE! #${homeGoalie.number} ${homeGoalie.name}`,
      description: `${homeGoalie.name} flashes the leather at the edge of the crease to preserve the scoreline.`,
      homeScoreAfter: state.homeScore,
      awayScoreAfter: state.awayScore,
      eventX: GOAL_LINE_X_LEFT + 28,
      eventY: RINK_HEIGHT / 2 - 12,
      frames: buildSynthesizedFramesForMoment(
        state.skaters,
        RINK_WIDTH / 2 - 190,
        RINK_HEIGHT / 2 - 55,
        GOAL_LINE_X_LEFT + 28,
        RINK_HEIGHT / 2 - 12,
        awayCaptain.id
      ),
    });
  }

  const threeStars: MatchHighlightSummary['threeStars'] = [
    {
      rank: 1,
      name: homeCaptain.name,
      number: homeCaptain.number,
      teamCode: homeTeam.code,
      statLine: `${state.homeScore} G · ${state.homeAssists} A · ${ Math.max(1, state.homeShots)} SOG`,
    },
    {
      rank: 2,
      name: homeGoalie.name,
      number: homeGoalie.number,
      teamCode: homeTeam.code,
      statLine: `${Math.max(1, state.homeSaves)} SV · Crease Wall`,
    },
    {
      rank: 3,
      name: homeSniper.name,
      number: homeSniper.number,
      teamCode: homeTeam.code,
      statLine: `${Math.max(1, state.homeHits)} HIT · High-Slot Threat`,
    },
  ];

  return {
    headline,
    narrative,
    threeStars,
    highlights,
  };
}

