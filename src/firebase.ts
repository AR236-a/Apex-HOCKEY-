import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  enableNetwork,
  doc,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { computeRankTier, PlayerAttributes } from './game/physics';

// Suppress noisy internal WebChannel transport retry logs in sandboxed iframe environments
setLogLevel('silent');

const app = initializeApp(firebaseConfig);

// Configure HTTP long-polling so Cloud Firestore connects reliably in iframes and proxies
initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

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
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isOfflineOrTransientError(error: unknown): boolean {
  if (!error) return false;
  const code = (error as { code?: string }).code || '';
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'failed-precondition' ||
    msg.includes('client is offline') ||
    msg.includes('offline') ||
    msg.includes('could not reach cloud firestore') ||
    msg.includes('network-request-failed') ||
    msg.includes('failed to get document from server')
  );
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection on initial boot
async function testConnection() {
  try {
    await enableNetwork(db).catch(() => {});
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      // Attempt to re-enable network quietly when operating in offline fallback mode
      await enableNetwork(db).catch(() => {});
    }
  }
}
testConnection();

export interface FirestorePlayerProfile {
  uid: string;
  displayName: string;
  avatarCode: string;
  teamId: string;
  equippedJerseyId: string;
  unlockedJerseyIds: string[];
  mmr: number;
  rankTier: 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Apex Legend';
  wins: number;
  losses: number;
  goals: number;
  assists: number;
  shots: number;
  hits: number;
  saves: number;
  xp: number;
  seasonPassLevel: number;
  statSpeed: number;
  statPower: number;
  statHandling: number;
  statChecking: number;
  statStamina: number;
  completedChallengeIds: string[];
  claimedRewardIds: string[];
  worldCupTitles: number;
  asiaCupTitles: number;
}

const LOCAL_PROFILE_STORAGE_PREFIX = 'apex_ice_profile_v1_';

function readCachedLocalProfile(uid: string): FirestorePlayerProfile | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(`${LOCAL_PROFILE_STORAGE_PREFIX}${uid}`);
    if (!raw) return null;
    return JSON.parse(raw) as FirestorePlayerProfile;
  } catch {
    return null;
  }
}

function writeCachedLocalProfile(profile: FirestorePlayerProfile): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(
      `${LOCAL_PROFILE_STORAGE_PREFIX}${profile.uid}`,
      JSON.stringify(profile)
    );
  } catch {
    // ignore storage quota errors
  }
}

export function createDefaultLocalProfile(
  uid = 'guest_local',
  displayName = 'ApexSkater97'
): FirestorePlayerProfile {
  return {
    uid,
    displayName: displayName.slice(0, 60) || 'ApexSkater97',
    avatarCode: 'CREST_CAN',
    teamId: 'CAN',
    equippedJerseyId: 'jersey_can_home',
    unlockedJerseyIds: [
      'jersey_can_home',
      'jersey_usa_navy',
      'jersey_jpn_sakura',
      'jersey_swe_crowns',
    ],
    mmr: 1200,
    rankTier: 'Silver',
    wins: 0,
    losses: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    hits: 0,
    saves: 0,
    xp: 250,
    seasonPassLevel: 1,
    statSpeed: 84,
    statPower: 82,
    statHandling: 85,
    statChecking: 80,
    statStamina: 82,
    completedChallengeIds: [],
    claimedRewardIds: ['sr_1'],
    worldCupTitles: 0,
    asiaCupTitles: 0,
  };
}

export async function signInWithGooglePopup(): Promise<User | null> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function ensurePlayerProfileInFirestore(
  user: User
): Promise<FirestorePlayerProfile> {
  const path = `players/${user.uid}`;
  const ref = doc(db, 'players', user.uid);
  const cleanName =
    (user.displayName || 'ApexSkater').replace(/[^a-zA-Z0-9 _\-]/g, '').slice(0, 60) ||
    'ApexSkater';

  try {
    await enableNetwork(db).catch(() => {});
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as FirestorePlayerProfile;
      writeCachedLocalProfile(data);
      return data;
    }
  } catch (error) {
    if (isOfflineOrTransientError(error)) {
      // Try Firestore local cache first, then browser localStorage, then default profile
      try {
        const cachedSnap = await getDocFromCache(ref);
        if (cachedSnap.exists()) {
          return cachedSnap.data() as FirestorePlayerProfile;
        }
      } catch {
        // Not in Firestore local cache
      }
      const localSaved = readCachedLocalProfile(user.uid);
      if (localSaved) return localSaved;
      const fallback = createDefaultLocalProfile(user.uid, cleanName);
      writeCachedLocalProfile(fallback);
      return fallback;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }

  const initialProfile =
    readCachedLocalProfile(user.uid) || createDefaultLocalProfile(user.uid, cleanName);
  writeCachedLocalProfile(initialProfile);

  try {
    await setDoc(ref, {
      ...initialProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (!isOfflineOrTransientError(error)) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  return initialProfile;
}

export async function savePlayerCustomizationToFirestore(
  uid: string,
  updates: {
    displayName: string;
    avatarCode: string;
    teamId: string;
    equippedJerseyId: string;
    unlockedJerseyIds: string[];
    attrs: PlayerAttributes;
  }
): Promise<void> {
  const existingLocal = readCachedLocalProfile(uid);
  if (existingLocal) {
    writeCachedLocalProfile({
      ...existingLocal,
      displayName: updates.displayName.slice(0, 60) || 'ApexSkater',
      avatarCode: updates.avatarCode.slice(0, 32),
      teamId: updates.teamId.slice(0, 32),
      equippedJerseyId: updates.equippedJerseyId.slice(0, 64),
      unlockedJerseyIds: updates.unlockedJerseyIds.slice(0, 30),
      statSpeed: Math.min(99, Math.max(50, Math.round(updates.attrs.statSpeed))),
      statPower: Math.min(99, Math.max(50, Math.round(updates.attrs.statPower))),
      statHandling: Math.min(99, Math.max(50, Math.round(updates.attrs.statHandling))),
      statChecking: Math.min(99, Math.max(50, Math.round(updates.attrs.statChecking))),
      statStamina: Math.min(99, Math.max(50, Math.round(updates.attrs.statStamina))),
    });
  }

  if (!auth.currentUser || auth.currentUser.uid !== uid) return;
  const path = `players/${uid}`;
  const ref = doc(db, 'players', uid);
  try {
    await updateDoc(ref, {
      displayName: updates.displayName.slice(0, 60) || 'ApexSkater',
      avatarCode: updates.avatarCode.slice(0, 32),
      teamId: updates.teamId.slice(0, 32),
      equippedJerseyId: updates.equippedJerseyId.slice(0, 64),
      unlockedJerseyIds: updates.unlockedJerseyIds.slice(0, 30),
      statSpeed: Math.min(99, Math.max(50, Math.round(updates.attrs.statSpeed))),
      statPower: Math.min(99, Math.max(50, Math.round(updates.attrs.statPower))),
      statHandling: Math.min(99, Math.max(50, Math.round(updates.attrs.statHandling))),
      statChecking: Math.min(99, Math.max(50, Math.round(updates.attrs.statChecking))),
      statStamina: Math.min(99, Math.max(50, Math.round(updates.attrs.statStamina))),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (!isOfflineOrTransientError(error)) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function savePlayerMatchOutcomeToFirestore(
  profile: FirestorePlayerProfile
): Promise<void> {
  writeCachedLocalProfile(profile);
  if (!auth.currentUser || auth.currentUser.uid !== profile.uid) return;
  const path = `players/${profile.uid}`;
  const ref = doc(db, 'players', profile.uid);
  const clampedMmr = Math.min(10000, Math.max(0, Math.round(profile.mmr)));
  try {
    await updateDoc(ref, {
      mmr: clampedMmr,
      rankTier: computeRankTier(clampedMmr),
      wins: profile.wins,
      losses: profile.losses,
      goals: profile.goals,
      assists: profile.assists,
      shots: profile.shots,
      hits: profile.hits,
      saves: profile.saves,
      xp: profile.xp,
      seasonPassLevel: Math.min(100, Math.max(1, profile.seasonPassLevel)),
      unlockedJerseyIds: profile.unlockedJerseyIds.slice(0, 30),
      completedChallengeIds: profile.completedChallengeIds.slice(0, 20),
      claimedRewardIds: profile.claimedRewardIds.slice(0, 30),
      worldCupTitles: profile.worldCupTitles,
      asiaCupTitles: profile.asiaCupTitles,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (!isOfflineOrTransientError(error)) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export function subscribeLeaderboard(
  onData: (profiles: FirestorePlayerProfile[]) => void
): Unsubscribe {
  const path = 'players';
  const q = query(
    collection(db, 'players'),
    where('mmr', '>=', 0),
    orderBy('mmr', 'desc'),
    limit(25)
  );
  return onSnapshot(
    q,
    snapshot => {
      const items = snapshot.docs.map(d => d.data() as FirestorePlayerProfile);
      onData(items);
    },
    error => {
      if (!isOfflineOrTransientError(error)) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  );
}

export interface ChatMessageDoc {
  id: string;
  authorId: string;
  authorName: string;
  authorTeam: string;
  channel: 'global' | 'world-cup' | 'asia-cup' | 'lfg' | 'strategy';
  text: string;
  createdAtMs: number;
}

export async function postChatMessageToFirestore(
  authorId: string,
  authorName: string,
  authorTeam: string,
  channel: 'global' | 'world-cup' | 'asia-cup' | 'lfg' | 'strategy',
  text: string
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== authorId) return;
  const cleanText = text.trim().slice(0, 400);
  if (!cleanText) return;
  const path = 'chatMessages';
  try {
    await addDoc(collection(db, 'chatMessages'), {
      authorId,
      authorName: authorName.slice(0, 60),
      authorTeam: authorTeam.slice(0, 32),
      channel,
      text: cleanText,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    if (!isOfflineOrTransientError(error)) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

export function subscribeChannelMessages(
  channel: 'global' | 'world-cup' | 'asia-cup' | 'lfg' | 'strategy',
  onData: (msgs: ChatMessageDoc[]) => void
): Unsubscribe {
  const path = 'chatMessages';
  const q = query(
    collection(db, 'chatMessages'),
    where('channel', '==', channel),
    limit(30)
  );
  return onSnapshot(
    q,
    snapshot => {
      const list: ChatMessageDoc[] = snapshot.docs.map(d => {
        const data = d.data();
        const ts = data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now();
        return {
          id: d.id,
          authorId: data.authorId,
          authorName: data.authorName,
          authorTeam: data.authorTeam,
          channel: data.channel,
          text: data.text,
          createdAtMs: ts,
        };
      });
      list.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onData(list);
    },
    error => {
      if (!isOfflineOrTransientError(error)) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  );
}

export async function createSocialClubInFirestore(params: {
  ownerId: string;
  ownerName: string;
  name: string;
  tag: string;
  region: 'Global' | 'North America' | 'Europe' | 'Asia-Pacific';
  description: string;
  mmr: number;
}): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== params.ownerId) return;
  const path = 'socialGroups';
  const inviteCode = `${params.tag.toUpperCase().slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;
  try {
    await addDoc(collection(db, 'socialGroups'), {
      ownerId: params.ownerId,
      ownerName: params.ownerName.slice(0, 60),
      name: params.name.trim().slice(0, 60),
      tag: params.tag.trim().toUpperCase().slice(0, 8),
      region: params.region,
      description: params.description.trim().slice(0, 240),
      memberCount: 1,
      totalMmr: Math.min(5000000, Math.max(0, Math.round(params.mmr))),
      inviteCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (!isOfflineOrTransientError(error)) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}
