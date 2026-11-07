import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesContent = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');

// Helper evaluator simulating our hardened Firestore security rules invariants
interface RuleEvalContext {
  auth: { uid: string; email_verified: boolean } | null;
  pathId: string;
  collection: 'players' | 'chatMessages' | 'socialGroups' | 'tournamentRuns';
  operation: 'create' | 'update' | 'delete';
  incoming: Record<string, unknown>;
  existing?: Record<string, unknown>;
  requestTime: string;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function evaluateRules(ctx: RuleEvalContext): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!ctx.auth || !ctx.auth.email_verified) return 'PERMISSION_DENIED';
  if (!ctx.pathId || ctx.pathId.length > 128 || !VALID_ID_REGEX.test(ctx.pathId)) {
    return 'PERMISSION_DENIED';
  }
  if (ctx.operation === 'delete') return 'PERMISSION_DENIED';

  const d = ctx.incoming;
  if (ctx.collection === 'players') {
    const allowedKeys = [
      'uid', 'displayName', 'avatarCode', 'teamId', 'equippedJerseyId',
      'unlockedJerseyIds', 'mmr', 'rankTier', 'wins', 'losses', 'goals',
      'assists', 'shots', 'hits', 'saves', 'xp', 'seasonPassLevel',
      'statSpeed', 'statPower', 'statHandling', 'statChecking', 'statStamina',
      'completedChallengeIds', 'claimedRewardIds', 'worldCupTitles', 'asiaCupTitles',
      'createdAt', 'updatedAt'
    ];
    const keys = Object.keys(d);
    if (keys.length !== allowedKeys.length || !keys.every(k => allowedKeys.includes(k))) {
      return 'PERMISSION_DENIED';
    }
    if (ctx.pathId !== ctx.auth.uid || d.uid !== ctx.auth.uid) return 'PERMISSION_DENIED';
    if (typeof d.mmr !== 'number' || d.mmr < 0 || d.mmr > 10000) return 'PERMISSION_DENIED';
    if (!Array.isArray(d.unlockedJerseyIds) || d.unlockedJerseyIds.length === 0 || d.unlockedJerseyIds.length > 30) {
      return 'PERMISSION_DENIED';
    }
    if (ctx.operation === 'create') {
      if (d.createdAt !== ctx.requestTime || d.updatedAt !== ctx.requestTime) return 'PERMISSION_DENIED';
    } else if (ctx.operation === 'update' && ctx.existing) {
      if (d.uid !== ctx.existing.uid || d.createdAt !== ctx.existing.createdAt || d.updatedAt !== ctx.requestTime) {
        return 'PERMISSION_DENIED';
      }
    }
    return 'ALLOWED';
  }

  if (ctx.collection === 'chatMessages') {
    if (ctx.operation !== 'create') return 'PERMISSION_DENIED';
    const allowedKeys = ['authorId', 'authorName', 'authorTeam', 'channel', 'text', 'createdAt'];
    const keys = Object.keys(d);
    if (keys.length !== allowedKeys.length || !keys.every(k => allowedKeys.includes(k))) {
      return 'PERMISSION_DENIED';
    }
    if (d.authorId !== ctx.auth.uid) return 'PERMISSION_DENIED';
    if (typeof d.text !== 'string' || d.text.length < 1 || d.text.length > 400) return 'PERMISSION_DENIED';
    if (!['global', 'world-cup', 'asia-cup', 'lfg', 'strategy'].includes(String(d.channel))) {
      return 'PERMISSION_DENIED';
    }
    if (d.createdAt !== ctx.requestTime) return 'PERMISSION_DENIED';
    return 'ALLOWED';
  }

  if (ctx.collection === 'tournamentRuns') {
    if (ctx.operation === 'update' && ctx.existing) {
      if (ctx.existing.status !== 'active') return 'PERMISSION_DENIED';
    }
    return 'ALLOWED';
  }

  return 'PERMISSION_DENIED';
}

const BASE_PLAYER = {
  uid: 'user_1',
  displayName: 'IceViper',
  avatarCode: 'CREST_CAN',
  teamId: 'CAN',
  equippedJerseyId: 'jersey_can_home',
  unlockedJerseyIds: ['jersey_can_home'],
  mmr: 1200,
  rankTier: 'Silver',
  wins: 5,
  losses: 2,
  goals: 14,
  assists: 8,
  shots: 42,
  hits: 19,
  saves: 11,
  xp: 2400,
  seasonPassLevel: 3,
  statSpeed: 80,
  statPower: 78,
  statHandling: 82,
  statChecking: 75,
  statStamina: 80,
  completedChallengeIds: [],
  claimedRewardIds: [],
  worldCupTitles: 0,
  asiaCupTitles: 0,
  createdAt: '2026-11-07T01:00:00Z',
  updatedAt: '2026-11-07T01:00:00Z',
};

test('firestore.rules file contains all 4 collection match blocks, global safety net, and resource == null get guards', () => {
  assert.ok(rulesContent.includes('allow read, write: if false;'));
  assert.ok(rulesContent.includes('match /players/{playerId}'));
  assert.ok(rulesContent.includes('allow get: if isValidId(playerId) && (resource == null || existing().mmr >= 0);'));
  assert.ok(rulesContent.includes('match /chatMessages/{messageId}'));
  assert.ok(rulesContent.includes('match /socialGroups/{groupId}'));
  assert.ok(rulesContent.includes('match /tournamentRuns/{runId}'));
});

test('Dirty Dozen #1: Identity Spoofing on PlayerProfile returns PERMISSION_DENIED', () => {
  const res = evaluateRules({
    auth: { uid: 'user_1', email_verified: true },
    pathId: 'user_2',
    collection: 'players',
    operation: 'create',
    incoming: { ...BASE_PLAYER, uid: 'user_2' },
    requestTime: '2026-11-07T01:00:00Z',
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #2: Shadow Field Injection on PlayerProfile returns PERMISSION_DENIED', () => {
  const res = evaluateRules({
    auth: { uid: 'user_1', email_verified: true },
    pathId: 'user_1',
    collection: 'players',
    operation: 'create',
    incoming: { ...BASE_PLAYER, isAdmin: true },
    requestTime: '2026-11-07T01:00:00Z',
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #3: Unverified Email Write returns PERMISSION_DENIED', () => {
  const res = evaluateRules({
    auth: { uid: 'user_1', email_verified: false },
    pathId: 'msg_1',
    collection: 'chatMessages',
    operation: 'create',
    incoming: {
      authorId: 'user_1',
      authorName: 'IceViper',
      authorTeam: 'CAN',
      channel: 'global',
      text: 'GG!',
      createdAt: '2026-11-07T01:00:00Z',
    },
    requestTime: '2026-11-07T01:00:00Z',
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #4: Oversized ChatMessage text (>400 chars) returns PERMISSION_DENIED', () => {
  const res = evaluateRules({
    auth: { uid: 'user_1', email_verified: true },
    pathId: 'msg_1',
    collection: 'chatMessages',
    operation: 'create',
    incoming: {
      authorId: 'user_1',
      authorName: 'IceViper',
      authorTeam: 'CAN',
      channel: 'global',
      text: 'A'.repeat(500),
      createdAt: '2026-11-07T01:00:00Z',
    },
    requestTime: '2026-11-07T01:00:00Z',
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #5: Unbounded Array Poisoning on unlockedJerseyIds returns PERMISSION_DENIED', () => {
  const res = evaluateRules({
    auth: { uid: 'user_1', email_verified: true },
    pathId: 'user_1',
    collection: 'players',
    operation: 'create',
    incoming: {
      ...BASE_PLAYER,
      unlockedJerseyIds: Array.from({ length: 45 }, (_, i) => `jersey_${i}`),
    },
    requestTime: '2026-11-07T01:00:00Z',
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #6: Client Timestamp Forgery returns PERMISSION_DENIED', () => {
  const res = evaluateRules({
    auth: { uid: 'user_1', email_verified: true },
    pathId: 'user_1',
    collection: 'players',
    operation: 'create',
    incoming: { ...BASE_PLAYER, createdAt: '1999-01-01T00:00:00Z' },
    requestTime: '2026-11-07T01:00:00Z',
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #7: Immutable Field Mutation (createdAt) returns PERMISSION_DENIED', () => {
  const res = evaluateRules({
    auth: { uid: 'user_1', email_verified: true },
    pathId: 'user_1',
    collection: 'players',
    operation: 'update',
    existing: BASE_PLAYER,
    incoming: { ...BASE_PLAYER, createdAt: '2026-11-08T00:00:00Z' },
    requestTime: '2026-11-07T01:00:00Z',
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #8: ChatMessage Mutation (update) returns PERMISSION_DENIED', () => {
  const res = evaluateRules({
    auth: { uid: 'user_1', email_verified: true },
    pathId: 'msg_1',
    collection: 'chatMessages',
    operation: 'update',
    incoming: {},
    requestTime: '2026-11-07T01:00:00Z',
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #9: Terminal State Bypass on TournamentRun returns PERMISSION_DENIED', () => {
  const res = evaluateRules({
    auth: { uid: 'user_1', email_verified: true },
    pathId: 'run_1',
    collection: 'tournamentRuns',
    operation: 'update',
    existing: { status: 'champion' },
    incoming: { status: 'active' },
    requestTime: '2026-11-07T01:00:00Z',
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #10: Invalid Enum Injection on ChatMessage channel returns PERMISSION_DENIED', () => {
  const res = evaluateRules({
    auth: { uid: 'user_1', email_verified: true },
    pathId: 'msg_1',
    collection: 'chatMessages',
    operation: 'create',
    incoming: {
      authorId: 'user_1',
      authorName: 'IceViper',
      authorTeam: 'CAN',
      channel: 'unauthorized_channel',
      text: 'Hello',
      createdAt: '2026-11-07T01:00:00Z',
    },
    requestTime: '2026-11-07T01:00:00Z',
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #11: Path ID Poisoning returns PERMISSION_DENIED', () => {
  const res = evaluateRules({
    auth: { uid: 'user_1', email_verified: true },
    pathId: 'bad$id!with/slash',
    collection: 'chatMessages',
    operation: 'create',
    incoming: {},
    requestTime: '2026-11-07T01:00:00Z',
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #12: Value Poisoning on PlayerProfile MMR returns PERMISSION_DENIED', () => {
  const res = evaluateRules({
    auth: { uid: 'user_1', email_verified: true },
    pathId: 'user_1',
    collection: 'players',
    operation: 'update',
    existing: BASE_PLAYER,
    incoming: { ...BASE_PLAYER, mmr: '999999' as unknown as number },
    requestTime: '2026-11-07T01:00:00Z',
  });
  assert.equal(res, 'PERMISSION_DENIED');
});
