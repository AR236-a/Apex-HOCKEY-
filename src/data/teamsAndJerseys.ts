export type TournamentCategory = 'world_cup' | 'asia_cup' | 'all_teams';

export interface HockeyTeam {
  id: string;
  name: string;
  code: string;
  region: 'North America' | 'Europe' | 'Asia' | 'Club';
  primaryColor: string;
  secondaryColor: string;
  trimColor: string;
  rating: number;
  archetype: 'Speed & Transition' | 'Heavy Forecheck' | 'Tactical Trap' | 'Precision Passing';
  isWorldCup: boolean;
  isAsiaCup: boolean;
}

export interface JerseySkin {
  id: string;
  name: string;
  teamId: string;
  primaryColor: string;
  secondaryColor: string;
  trimColor: string;
  pattern: 'classic' | 'chevron' | 'diagonal' | 'heritage' | 'apex';
  rarity: 'Core' | 'Contender' | 'Championship' | 'Mythic';
  unlockRequirement: string;
  defaultUnlocked: boolean;
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  metric: 'goals' | 'hits' | 'shots' | 'wins' | 'assists';
  target: number;
  xpReward: number;
  unlockJerseyId?: string;
}

export interface SeasonReward {
  id: string;
  level: number;
  title: string;
  xpRequired: number;
  type: 'Jersey' | 'Title' | 'Crest' | 'MMR Boost';
  rewardLabel: string;
  jerseyId?: string;
}

export const HOCKEY_TEAMS: HockeyTeam[] = [
  // World Cup Powerhouses
  {
    id: 'CAN',
    name: 'Canada',
    code: 'CAN',
    region: 'North America',
    primaryColor: '#DC2626',
    secondaryColor: '#FFFFFF',
    trimColor: '#111827',
    rating: 95,
    archetype: 'Speed & Transition',
    isWorldCup: true,
    isAsiaCup: false,
  },
  {
    id: 'USA',
    name: 'United States',
    code: 'USA',
    region: 'North America',
    primaryColor: '#1D4ED8',
    secondaryColor: '#EF4444',
    trimColor: '#F8FAFC',
    rating: 93,
    archetype: 'Heavy Forecheck',
    isWorldCup: true,
    isAsiaCup: false,
  },
  {
    id: 'SWE',
    name: 'Sweden',
    code: 'SWE',
    region: 'Europe',
    primaryColor: '#FACC15',
    secondaryColor: '#1E3A8A',
    trimColor: '#FFFFFF',
    rating: 92,
    archetype: 'Precision Passing',
    isWorldCup: true,
    isAsiaCup: false,
  },
  {
    id: 'FIN',
    name: 'Finland',
    code: 'FIN',
    region: 'Europe',
    primaryColor: '#0284C7',
    secondaryColor: '#F8FAFC',
    trimColor: '#0F172A',
    rating: 91,
    archetype: 'Tactical Trap',
    isWorldCup: true,
    isAsiaCup: false,
  },
  {
    id: 'CZE',
    name: 'Czechia',
    code: 'CZE',
    region: 'Europe',
    primaryColor: '#B91C1C',
    secondaryColor: '#1E40AF',
    trimColor: '#FFFFFF',
    rating: 89,
    archetype: 'Precision Passing',
    isWorldCup: true,
    isAsiaCup: false,
  },
  {
    id: 'SUI',
    name: 'Switzerland',
    code: 'SUI',
    region: 'Europe',
    primaryColor: '#E11D48',
    secondaryColor: '#FFFFFF',
    trimColor: '#881337',
    rating: 88,
    archetype: 'Speed & Transition',
    isWorldCup: true,
    isAsiaCup: false,
  },
  {
    id: 'GER',
    name: 'Germany',
    code: 'GER',
    region: 'Europe',
    primaryColor: '#18181B',
    secondaryColor: '#F59E0B',
    trimColor: '#EF4444',
    rating: 87,
    archetype: 'Heavy Forecheck',
    isWorldCup: true,
    isAsiaCup: false,
  },
  {
    id: 'SVK',
    name: 'Slovakia',
    code: 'SVK',
    region: 'Europe',
    primaryColor: '#2563EB',
    secondaryColor: '#FFFFFF',
    trimColor: '#DC2626',
    rating: 85,
    archetype: 'Speed & Transition',
    isWorldCup: true,
    isAsiaCup: false,
  },
  // Asia Cup Federations (also eligible in World Cup / All Teams)
  {
    id: 'IND',
    name: 'India',
    code: 'IND',
    region: 'Asia',
    primaryColor: '#0284C7',
    secondaryColor: '#F97316',
    trimColor: '#F8FAFC',
    rating: 86,
    archetype: 'Speed & Transition',
    isWorldCup: true,
    isAsiaCup: true,
  },
  {
    id: 'PAK',
    name: 'Pakistan',
    code: 'PAK',
    region: 'Asia',
    primaryColor: '#047857',
    secondaryColor: '#FFFFFF',
    trimColor: '#FACC15',
    rating: 85,
    archetype: 'Precision Passing',
    isWorldCup: true,
    isAsiaCup: true,
  },
  {
    id: 'JPN',
    name: 'Japan',
    code: 'JPN',
    region: 'Asia',
    primaryColor: '#E11D48',
    secondaryColor: '#0F172A',
    trimColor: '#F8FAFC',
    rating: 84,
    archetype: 'Speed & Transition',
    isWorldCup: true,
    isAsiaCup: true,
  },
  {
    id: 'KAZ',
    name: 'Kazakhstan',
    code: 'KAZ',
    region: 'Asia',
    primaryColor: '#06B6D4',
    secondaryColor: '#FACC15',
    trimColor: '#0F172A',
    rating: 85,
    archetype: 'Heavy Forecheck',
    isWorldCup: true,
    isAsiaCup: true,
  },
  {
    id: 'KOR',
    name: 'South Korea',
    code: 'KOR',
    region: 'Asia',
    primaryColor: '#2563EB',
    secondaryColor: '#F43F5E',
    trimColor: '#FFFFFF',
    rating: 83,
    archetype: 'Speed & Transition',
    isWorldCup: true,
    isAsiaCup: true,
  },
  {
    id: 'CHN',
    name: 'China',
    code: 'CHN',
    region: 'Asia',
    primaryColor: '#DC2626',
    secondaryColor: '#FBBF24',
    trimColor: '#7F1D1D',
    rating: 81,
    archetype: 'Tactical Trap',
    isWorldCup: true,
    isAsiaCup: true,
  },
  {
    id: 'TPE',
    name: 'Chinese Taipei',
    code: 'TPE',
    region: 'Asia',
    primaryColor: '#1D4ED8',
    secondaryColor: '#FFFFFF',
    trimColor: '#EF4444',
    rating: 78,
    archetype: 'Precision Passing',
    isWorldCup: false,
    isAsiaCup: true,
  },
  {
    id: 'THA',
    name: 'Thailand',
    code: 'THA',
    region: 'Asia',
    primaryColor: '#1E3A8A',
    secondaryColor: '#DC2626',
    trimColor: '#F8FAFC',
    rating: 77,
    archetype: 'Speed & Transition',
    isWorldCup: false,
    isAsiaCup: true,
  },
  {
    id: 'UAE',
    name: 'United Arab Emirates',
    code: 'UAE',
    region: 'Asia',
    primaryColor: '#059669',
    secondaryColor: '#F8FAFC',
    trimColor: '#EF4444',
    rating: 76,
    archetype: 'Heavy Forecheck',
    isWorldCup: false,
    isAsiaCup: true,
  },
  {
    id: 'SGP',
    name: 'Singapore',
    code: 'SGP',
    region: 'Asia',
    primaryColor: '#E11D48',
    secondaryColor: '#FFFFFF',
    trimColor: '#F59E0B',
    rating: 75,
    archetype: 'Tactical Trap',
    isWorldCup: false,
    isAsiaCup: true,
  },
  // Elite All-Teams Club Franchises
  {
    id: 'APEX',
    name: 'Apex Frost Wolves',
    code: 'APX',
    region: 'Club',
    primaryColor: '#0EA5E9',
    secondaryColor: '#0F172A',
    trimColor: '#38BDF8',
    rating: 96,
    archetype: 'Speed & Transition',
    isWorldCup: false,
    isAsiaCup: false,
  },
  {
    id: 'VAL',
    name: 'Nordic Valkyries',
    code: 'VAL',
    region: 'Club',
    primaryColor: '#10B981',
    secondaryColor: '#064E3B',
    trimColor: '#A7F3D0',
    rating: 94,
    archetype: 'Precision Passing',
    isWorldCup: false,
    isAsiaCup: false,
  },
];

export const UNLOCKABLE_JERSEYS: JerseySkin[] = [
  {
    id: 'jersey_can_home',
    name: 'Maple Crimson Home',
    teamId: 'CAN',
    primaryColor: '#DC2626',
    secondaryColor: '#FFFFFF',
    trimColor: '#111827',
    pattern: 'classic',
    rarity: 'Core',
    unlockRequirement: 'Starter Locker Room Kit',
    defaultUnlocked: true,
  },
  {
    id: 'jersey_ind_tricolor',
    name: 'Himalayan Tricolor Blue',
    teamId: 'IND',
    primaryColor: '#0284C7',
    secondaryColor: '#F97316',
    trimColor: '#F8FAFC',
    pattern: 'chevron',
    rarity: 'Core',
    unlockRequirement: 'Asia Cup Federation Kit',
    defaultUnlocked: true,
  },
  {
    id: 'jersey_pak_crescent',
    name: 'Crescent Emerald Green',
    teamId: 'PAK',
    primaryColor: '#047857',
    secondaryColor: '#FFFFFF',
    trimColor: '#FACC15',
    pattern: 'diagonal',
    rarity: 'Core',
    unlockRequirement: 'Asia Cup Federation Kit',
    defaultUnlocked: true,
  },
  {
    id: 'jersey_usa_navy',
    name: 'Stars & Stripes Heritage',
    teamId: 'USA',
    primaryColor: '#1D4ED8',
    secondaryColor: '#EF4444',
    trimColor: '#FFFFFF',
    pattern: 'diagonal',
    rarity: 'Core',
    unlockRequirement: 'Starter Locker Room Kit',
    defaultUnlocked: true,
  },
  {
    id: 'jersey_jpn_sakura',
    name: 'Tokyo Sunburst Red',
    teamId: 'JPN',
    primaryColor: '#E11D48',
    secondaryColor: '#0F172A',
    trimColor: '#F8FAFC',
    pattern: 'chevron',
    rarity: 'Core',
    unlockRequirement: 'Starter Locker Room Kit',
    defaultUnlocked: true,
  },
  {
    id: 'jersey_swe_crowns',
    name: 'Tre Kronor Gold',
    teamId: 'SWE',
    primaryColor: '#FACC15',
    secondaryColor: '#1E3A8A',
    trimColor: '#FFFFFF',
    pattern: 'classic',
    rarity: 'Core',
    unlockRequirement: 'Starter Locker Room Kit',
    defaultUnlocked: true,
  },
  {
    id: 'jersey_fin_suomi',
    name: 'Suomi Ice Blue',
    teamId: 'FIN',
    primaryColor: '#0284C7',
    secondaryColor: '#FFFFFF',
    trimColor: '#0F172A',
    pattern: 'heritage',
    rarity: 'Contender',
    unlockRequirement: 'Season Pass Level 2 or 3 Career Goals',
    defaultUnlocked: false,
  },
  {
    id: 'jersey_kaz_steppe',
    name: 'Almaty Golden Eagle',
    teamId: 'KAZ',
    primaryColor: '#06B6D4',
    secondaryColor: '#FACC15',
    trimColor: '#0F172A',
    pattern: 'chevron',
    rarity: 'Contender',
    unlockRequirement: 'Play or Win an Asia Cup Match',
    defaultUnlocked: false,
  },
  {
    id: 'jersey_kor_tigers',
    name: 'Seoul White Tiger',
    teamId: 'KOR',
    primaryColor: '#2563EB',
    secondaryColor: '#F43F5E',
    trimColor: '#FFFFFF',
    pattern: 'diagonal',
    rarity: 'Contender',
    unlockRequirement: 'Season Pass Level 4',
    defaultUnlocked: false,
  },
  {
    id: 'jersey_ger_blackgold',
    name: 'Adler Obsidian Gold',
    teamId: 'GER',
    primaryColor: '#18181B',
    secondaryColor: '#F59E0B',
    trimColor: '#EF4444',
    pattern: 'classic',
    rarity: 'Championship',
    unlockRequirement: 'Reach Gold Rank (1,400+ MMR)',
    defaultUnlocked: false,
  },
  {
    id: 'jersey_asia_champion',
    name: 'Asia Cup Dynasty Silk',
    teamId: 'CHN',
    primaryColor: '#991B1B',
    secondaryColor: '#FBBF24',
    trimColor: '#FEF08A',
    pattern: 'apex',
    rarity: 'Championship',
    unlockRequirement: 'Win the Asia Cup Final',
    defaultUnlocked: false,
  },
  {
    id: 'jersey_world_champion',
    name: 'World Cup Centennial Frost',
    teamId: 'APEX',
    primaryColor: '#0EA5E9',
    secondaryColor: '#F8FAFC',
    trimColor: '#38BDF8',
    pattern: 'apex',
    rarity: 'Mythic',
    unlockRequirement: 'Win the World Cup Final or Reach Season Level 6',
    defaultUnlocked: false,
  },
];

export const DAILY_CHALLENGES: DailyChallenge[] = [
  {
    id: 'chal_sniper_3',
    title: 'Top-Shelf Sniper',
    description: 'Score 3 goals across Exhibition, Ranked, or Tournament matches today.',
    metric: 'goals',
    target: 3,
    xpReward: 450,
    unlockJerseyId: 'jersey_fin_suomi',
  },
  {
    id: 'chal_enforcer_5',
    title: 'Boards Rattler',
    description: 'Deliver 5 heavy body checks to strip the puck from opponents.',
    metric: 'hits',
    target: 5,
    xpReward: 350,
  },
  {
    id: 'chal_playmaker_2',
    title: 'Tape-to-Tape Architect',
    description: 'Record 2 assists or win 1 match in any competitive mode.',
    metric: 'wins',
    target: 1,
    xpReward: 500,
    unlockJerseyId: 'jersey_kaz_steppe',
  },
  {
    id: 'chal_barrage_10',
    title: 'Crease Barrage',
    description: 'Put 10 shots on goal with charged slapshots.',
    metric: 'shots',
    target: 10,
    xpReward: 400,
  },
];

export const SEASON_REWARDS: SeasonReward[] = [
  {
    id: 'sr_1',
    level: 1,
    title: 'Rookie Skater',
    xpRequired: 0,
    type: 'Crest',
    rewardLabel: 'Winter Crest & Starter Kit',
  },
  {
    id: 'sr_2',
    level: 2,
    title: 'Blue Line Regular',
    xpRequired: 500,
    type: 'Jersey',
    rewardLabel: 'Suomi Ice Blue Jersey',
    jerseyId: 'jersey_fin_suomi',
  },
  {
    id: 'sr_3',
    level: 3,
    title: 'Asia Cup Contender',
    xpRequired: 1200,
    type: 'Jersey',
    rewardLabel: 'Almaty Golden Eagle Jersey',
    jerseyId: 'jersey_kaz_steppe',
  },
  {
    id: 'sr_4',
    level: 4,
    title: 'International All-Star',
    xpRequired: 2000,
    type: 'Jersey',
    rewardLabel: 'Seoul White Tiger Jersey',
    jerseyId: 'jersey_kor_tigers',
  },
  {
    id: 'sr_5',
    level: 5,
    title: 'Iron Enforcer',
    xpRequired: 3000,
    type: 'Jersey',
    rewardLabel: 'Adler Obsidian Gold Jersey',
    jerseyId: 'jersey_ger_blackgold',
  },
  {
    id: 'sr_6',
    level: 6,
    title: 'Apex World Legend',
    xpRequired: 4200,
    type: 'Jersey',
    rewardLabel: 'World Cup Centennial Frost Jersey',
    jerseyId: 'jersey_world_champion',
  },
];

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  teamId: string;
  mmr: number;
  rankTier: 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Apex Legend';
  wins: number;
  losses: number;
  goals: number;
  assists: number;
  hits: number;
  saves: number;
  worldCupTitles: number;
  asiaCupTitles: number;
}

export const SEED_LEADERBOARD: LeaderboardEntry[] = [
  {
    uid: 'seed_1',
    displayName: 'Mackinnon97_CAN',
    teamId: 'CAN',
    mmr: 2140,
    rankTier: 'Apex Legend',
    wins: 64,
    losses: 9,
    goals: 182,
    assists: 114,
    hits: 210,
    saves: 95,
    worldCupTitles: 4,
    asiaCupTitles: 1,
  },
  {
    uid: 'seed_ind',
    displayName: 'Arnav_India99',
    teamId: 'IND',
    mmr: 2050,
    rankTier: 'Apex Legend',
    wins: 61,
    losses: 10,
    goals: 174,
    assists: 132,
    hits: 188,
    saves: 108,
    worldCupTitles: 3,
    asiaCupTitles: 6,
  },
  {
    uid: 'seed_pak',
    displayName: 'LahoreBlades_PK',
    teamId: 'PAK',
    mmr: 1920,
    rankTier: 'Diamond',
    wins: 53,
    losses: 13,
    goals: 148,
    assists: 119,
    hits: 162,
    saves: 99,
    worldCupTitles: 1,
    asiaCupTitles: 4,
  },
  {
    uid: 'seed_2',
    displayName: 'Kenji_Sapporo',
    teamId: 'JPN',
    mmr: 1985,
    rankTier: 'Apex Legend',
    wins: 58,
    losses: 12,
    goals: 159,
    assists: 128,
    hits: 145,
    saves: 112,
    worldCupTitles: 2,
    asiaCupTitles: 5,
  },
  {
    uid: 'seed_3',
    displayName: 'BarysAstana_KZ',
    teamId: 'KAZ',
    mmr: 1840,
    rankTier: 'Diamond',
    wins: 49,
    losses: 15,
    goals: 134,
    assists: 92,
    hits: 312,
    saves: 88,
    worldCupTitles: 1,
    asiaCupTitles: 3,
  },
  {
    uid: 'seed_4',
    displayName: 'StockholmSnipe',
    teamId: 'SWE',
    mmr: 1760,
    rankTier: 'Diamond',
    wins: 44,
    losses: 16,
    goals: 128,
    assists: 105,
    hits: 118,
    saves: 79,
    worldCupTitles: 2,
    asiaCupTitles: 0,
  },
  {
    uid: 'seed_5',
    displayName: 'SeoulBlueliner',
    teamId: 'KOR',
    mmr: 1620,
    rankTier: 'Gold',
    wins: 38,
    losses: 19,
    goals: 102,
    assists: 89,
    hits: 176,
    saves: 94,
    worldCupTitles: 0,
    asiaCupTitles: 2,
  },
  {
    uid: 'seed_6',
    displayName: 'HelsinkiWall_FI',
    teamId: 'FIN',
    mmr: 1545,
    rankTier: 'Gold',
    wins: 35,
    losses: 18,
    goals: 91,
    assists: 77,
    hits: 164,
    saves: 142,
    worldCupTitles: 1,
    asiaCupTitles: 0,
  },
];

export interface SocialClubEntry {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  tag: string;
  region: 'Global' | 'North America' | 'Europe' | 'Asia-Pacific';
  description: string;
  memberCount: number;
  totalMmr: number;
  inviteCode: string;
}

export const SEED_SOCIAL_GROUPS: SocialClubEntry[] = [
  {
    id: 'club_tokyo_blades',
    ownerId: 'seed_2',
    ownerName: 'Kenji_Sapporo',
    name: 'Tokyo Ice Blades HC',
    tag: 'TKY',
    region: 'Asia-Pacific',
    description: 'Competitive Asia Cup & World Cup training squad. Daily scrims and voice comms active.',
    memberCount: 28,
    totalMmr: 46200,
    inviteCode: 'TKY-2026',
  },
  {
    id: 'club_northern_wolves',
    ownerId: 'seed_1',
    ownerName: 'Mackinnon97_CAN',
    name: 'Northern Frost Division',
    tag: 'NFD',
    region: 'North America',
    description: 'High-tempo transition hockey & 2v2 / 1v1 ranked grinders. All skill tiers welcome.',
    memberCount: 42,
    totalMmr: 68900,
    inviteCode: 'FROST-99',
  },
  {
    id: 'club_steppe_titans',
    ownerId: 'seed_3',
    ownerName: 'BarysAstana_KZ',
    name: 'Eurasian Steppe Titans',
    tag: 'KAZ',
    region: 'Asia-Pacific',
    description: 'Heavy forecheck specialists competing for the Asia Cup & All-Teams Trophy.',
    memberCount: 19,
    totalMmr: 31400,
    inviteCode: 'STEPPE-7',
  },
];

export function getTeamById(id: string): HockeyTeam {
  return HOCKEY_TEAMS.find(t => t.id === id) || HOCKEY_TEAMS[0];
}

export function getJerseyById(id: string): JerseySkin {
  return UNLOCKABLE_JERSEYS.find(j => j.id === id) || UNLOCKABLE_JERSEYS[0];
}
