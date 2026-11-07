import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAttributeBudget,
  computeRankTier,
  createInitialMatchState,
  stepHockeyPhysics,
  firePuckShot,
  createTournamentBracket,
  recordTournamentUserMatchResult,
  generateMatchHighlightSummary,
  RINK_HEIGHT,
  GOAL_LINE_X_RIGHT,
} from './physics';
import { getTeamById } from '../data/teamsAndJerseys';

const DEFAULT_ATTRS = {
  statSpeed: 84,
  statPower: 82,
  statHandling: 85,
  statChecking: 80,
  statStamina: 82,
};

const IDLE_INPUT = {
  moveX: 0,
  moveY: 0,
  sprintHeld: false,
  shootHeld: false,
  shootJustReleased: false,
  passJustPressed: false,
  checkJustPressed: false,
  switchJustPressed: false,
  dekeJustPressed: false,
};

test('validateAttributeBudget enforces 50-99 bounds and 415 total point cap', () => {
  const validRes = validateAttributeBudget(DEFAULT_ATTRS);
  assert.equal(validRes.valid, true);
  assert.equal(validRes.total, 413);
  assert.equal(validRes.remaining, 2);

  const overBudget = validateAttributeBudget({
    statSpeed: 99,
    statPower: 99,
    statHandling: 99,
    statChecking: 99,
    statStamina: 99,
  });
  assert.equal(overBudget.valid, false);
});

test('computeRankTier maps MMR accurately from Bronze to Apex Legend', () => {
  assert.equal(computeRankTier(950), 'Bronze');
  assert.equal(computeRankTier(1200), 'Silver');
  assert.equal(computeRankTier(1450), 'Gold');
  assert.equal(computeRankTier(1750), 'Diamond');
  assert.equal(computeRankTier(2100), 'Apex Legend');
});

test('createInitialMatchState spawns 8 skaters at open rink positions and survives idle frames', () => {
  const state = createInitialMatchState(
    getTeamById('CAN'),
    getTeamById('JPN'),
    DEFAULT_ATTRS
  );
  assert.equal(state.skaters.length, 8);
  assert.equal(state.homeScore, 0);
  assert.equal(state.awayScore, 0);
  assert.equal(state.controlledHomeId, 'home_c');
  assert.equal(state.controlledAwayId, null);

  for (let i = 0; i < 60; i++) {
    stepHockeyPhysics(state, 1 / 60, IDLE_INPUT);
  }
  assert.equal(state.isFinished, false);
  assert.ok(state.periodTimeRemaining < 60);
});

test('Player vs Player (pvp_local) mode assigns controlledAwayId and lets P2 skate and switch skaters', () => {
  const state = createInitialMatchState(
    getTeamById('CAN'),
    getTeamById('USA'),
    DEFAULT_ATTRS,
    60,
    'pvp_local',
    'pro'
  );
  assert.equal(state.controlledHomeId, 'home_c');
  assert.equal(state.controlledAwayId, 'away_c');

  const awayCenterBeforeX = state.skaters.find(s => s.id === 'away_c')!.x;
  stepHockeyPhysics(
    state,
    0.04,
    { ...IDLE_INPUT, moveX: 1 },
    { ...IDLE_INPUT, moveX: -1, switchJustPressed: true }
  );
  const awaySkaterAfter = state.skaters.find(s => s.id === state.controlledAwayId)!;
  assert.ok(awaySkaterAfter);
  assert.notEqual(state.skaters.find(s => s.id === 'away_c')!.x, awayCenterBeforeX);
});

test('AI Difficulty Level scales opponent attributes between rookie and legend', () => {
  const rookieState = createInitialMatchState(
    getTeamById('CAN'),
    getTeamById('JPN'),
    DEFAULT_ATTRS,
    60,
    'pve',
    'rookie'
  );
  const legendState = createInitialMatchState(
    getTeamById('CAN'),
    getTeamById('JPN'),
    DEFAULT_ATTRS,
    60,
    'pve',
    'legend'
  );
  const rookieAwaySpeed = rookieState.skaters.find(s => s.id === 'away_c')!.attrs.statSpeed;
  const legendAwaySpeed = legendState.skaters.find(s => s.id === 'away_c')!.attrs.statSpeed;
  assert.ok(legendAwaySpeed > rookieAwaySpeed);
});

test('firePuckShot launches puck with velocity scaled by statPower and increments shots', () => {
  const state = createInitialMatchState(
    getTeamById('CAN'),
    getTeamById('SWE'),
    DEFAULT_ATTRS
  );
  const captain = state.skaters.find(s => s.id === 'home_c')!;
  state.puck.ownerId = captain.id;

  firePuckShot(captain, state, 1.0);
  assert.equal(state.puck.ownerId, null);
  assert.equal(state.homeShots, 1);
  assert.ok(Math.hypot(state.puck.vx, state.puck.vy) > 600);
});

test('goal detection increments homeScore when puck crosses right goal line inside crease', () => {
  const state = createInitialMatchState(
    getTeamById('CAN'),
    getTeamById('USA'),
    DEFAULT_ATTRS
  );
  state.puck.ownerId = null;
  state.puck.x = GOAL_LINE_X_RIGHT - 4;
  state.puck.y = RINK_HEIGHT / 2;
  state.puck.vx = 600;
  state.puck.vy = 0;

  stepHockeyPhysics(state, 1 / 60, IDLE_INPUT);
  assert.equal(state.homeScore, 1);
  assert.equal(state.lastScoringTeam, 'HOME');
  assert.ok(state.goalCelebrationTimer > 0);
});

test('Asia Cup and World Cup tournament brackets include India (IND) and Pakistan (PAK) and advance through Final', () => {
  const indTeam = getTeamById('IND');
  const pakTeam = getTeamById('PAK');
  assert.equal(indTeam.name, 'India');
  assert.equal(indTeam.isAsiaCup, true);
  assert.equal(pakTeam.name, 'Pakistan');
  assert.equal(pakTeam.isAsiaCup, true);

  let bracket = createTournamentBracket('asia_cup', 'IND');
  assert.equal(bracket.mode, 'asia_cup');
  assert.equal(bracket.currentRound, 0);
  assert.equal(bracket.matches.length, 4);
  assert.equal(bracket.matches[0].homeTeamId, 'IND');
  assert.equal(bracket.matches[0].awayTeamId, 'PAK');

  bracket = recordTournamentUserMatchResult(bracket, 4, 1);
  assert.equal(bracket.currentRound, 1);
  assert.equal(bracket.wins, 1);
  assert.equal(bracket.status, 'active');
  assert.equal(bracket.matches.filter(m => m.round === 1).length, 2);

  bracket = recordTournamentUserMatchResult(bracket, 3, 2);
  assert.equal(bracket.currentRound, 2);
  assert.equal(bracket.wins, 2);
  assert.equal(bracket.status, 'active');

  bracket = recordTournamentUserMatchResult(bracket, 5, 2);
  assert.equal(bracket.wins, 3);
  assert.equal(bracket.status, 'champion');
  assert.equal(bracket.goalsFor, 12);
});

test('generateMatchHighlightSummary records live GOAL highlights and produces Three Stars and replay frames', () => {
  const indTeam = getTeamById('IND');
  const pakTeam = getTeamById('PAK');
  const state = createInitialMatchState(indTeam, pakTeam, DEFAULT_ATTRS);

  // Step a few frames to populate recentFrameRing
  for (let i = 0; i < 6; i++) {
    stepHockeyPhysics(state, 0.05, IDLE_INPUT);
  }
  assert.ok(state.recentFrameRing.length > 0);

  // Trigger a goal for Home (IND)
  state.puck.ownerId = null;
  state.puck.lastTouchedByHomeId = 'home_c';
  state.puck.x = GOAL_LINE_X_RIGHT - 4;
  state.puck.y = RINK_HEIGHT / 2;
  state.puck.vx = 650;
  state.puck.vy = 0;
  stepHockeyPhysics(state, 1 / 60, IDLE_INPUT);

  assert.equal(state.homeScore, 1);
  assert.ok(state.highlightMoments.some(h => h.type === 'GOAL'));

  const summary = generateMatchHighlightSummary(state, indTeam, pakTeam);
  assert.ok(summary.headline.includes('IND 1'));
  assert.equal(summary.threeStars.length, 3);
  assert.ok(summary.highlights.length >= 1);
  assert.ok(summary.highlights[0].frames.length >= 1);
});
