// Siempre apunta a Render (anda en web native y TV sin server local)
const API_BASE = 'https://dashtv.onrender.com';

const TEAM_CACHE = {};
const STADIUM_CACHE = {};
let CACHES_LOADED = false;

async function loadCaches() {
  if (CACHES_LOADED) return;
  try {
    const [teamsRes, stadiumsRes] = await Promise.all([
      fetch(`${API_BASE}/get/teams`),
      fetch(`${API_BASE}/get/stadiums`),
    ]);
    if (teamsRes.ok) {
      const data = await teamsRes.json();
      for (const t of data.teams || []) {
        TEAM_CACHE[t.id] = t;
        if (t.fifa_code) TEAM_CACHE[t.fifa_code] = t;
      }
    }
    if (stadiumsRes.ok) {
      const data = await stadiumsRes.json();
      for (const s of data.stadiums || []) {
        STADIUM_CACHE[s.id] = s;
      }
    }
    CACHES_LOADED = true;
  } catch (e) {
    console.warn('Failed to load caches:', e.message);
  }
}

function getTeamName(id) {
  const t = TEAM_CACHE[id];
  return t ? t.name_en : `Team ${id}`;
}

function getStadiumName(id) {
  const s = STADIUM_CACHE[id];
  return s ? s.name_en : null;
}

function getStadiumCity(id) {
  const s = STADIUM_CACHE[id];
  return s ? (s.city_en || s.city || null) : null;
}

export async function fetchLiveMatches() {
  try {
    await loadCaches();
    const res = await fetch(`${API_BASE}/get/games`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const matches = data.games || [];

    return matches.map((m) => ({
      id: m.id,
      home_team: m.home_team_name_en || getTeamName(m.home_team_id),
      away_team: m.away_team_name_en || getTeamName(m.away_team_id),
      home_team_id: m.home_team_id,
      away_team_id: m.away_team_id,
      home_flag: TEAM_CACHE[m.home_team_id]?.flag || null,
      away_flag: TEAM_CACHE[m.away_team_id]?.flag || null,
      home_iso2: TEAM_CACHE[m.home_team_id]?.iso2 || null,
      away_iso2: TEAM_CACHE[m.away_team_id]?.iso2 || null,
      home_score: parseInt(m.home_score) || 0,
      away_score: parseInt(m.away_score) || 0,
      status:
        m.finished === 'TRUE'
          ? 'finished'
          : m.time_elapsed && m.time_elapsed !== 'notstarted'
            ? 'live'
            : 'upcoming',
      group: m.group,
      date: parseDate(m.local_date),
      matchday: parseInt(m.matchday) || 0,
      stadium: getStadiumName(m.stadium_id),
      stadium_city: getStadiumCity(m.stadium_id),
      time_elapsed: m.time_elapsed,
      type: m.type,
    }));
  } catch (e) {
    console.warn('Games API error, using mock data:', e.message);
    return MOCK_LIVE_MATCHES;
  }
}

export async function fetchStandings() {
  try {
    await loadCaches();
    const res = await fetch(`${API_BASE}/get/groups`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const groups = data.groups || [];

    return groups.map((g) => ({
      group: g.name,
      teams: (g.teams || [])
        .map((t) => {
          const team = TEAM_CACHE[t.team_id];
          return {
            rank: 0,
            name: team ? team.name_en : getTeamName(t.team_id),
            flag: team ? team.flag : null,
            iso2: team ? team.iso2 : null,
            points: parseInt(t.pts) || 0,
            played: parseInt(t.mp) || 0,
            wins: parseInt(t.w) || 0,
            draws: parseInt(t.d) || 0,
            losses: parseInt(t.l) || 0,
            gf: parseInt(t.gf) || 0,
            ga: parseInt(t.ga) || 0,
          };
        })
        .sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga))
        .map((t, i) => ({ ...t, rank: i + 1 })),
    }));
  } catch (e) {
    console.warn('Standings API error, using mock data:', e.message);
    return MOCK_STANDINGS;
  }
}

export async function fetchTeams() {
  try {
    const res = await fetch(`${API_BASE}/get/teams`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.teams || [];
  } catch {
    return MOCK_TEAMS;
  }
}

export async function fetchStadiums() {
  try {
    const res = await fetch(`${API_BASE}/get/stadiums`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.stadiums || [];
  } catch {
    return [];
  }
}

export function getAllTeams() {
  return Object.values(TEAM_CACHE).filter((t) => t.name_en);
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!parts) return dateStr;
  const [, m, d, y, h, min] = parts;
  return `${y}-${m}-${d}T${h}:${min}:00`;
}

const allGroups = ['A','B','C','D','E','F','G','H','I','J','K','L'];

export { allGroups };

export const MOCK_TEAMS = [
  { id: '37', name_en: 'Argentina', fifa_code: 'ARG', groups: 'J' },
  { id: '33', name_en: 'Francia', fifa_code: 'FRA', groups: 'I' },
  { id: '9', name_en: 'Brasil', fifa_code: 'BRA', groups: 'C' },
];

export const MOCK_LIVE_MATCHES = [
  { id: '1', home_team: 'Argentina', away_team: 'Francia', home_score: 3, away_score: 3, status: 'live', group: 'J' },
  { id: '2', home_team: 'Brasil', away_team: 'Alemania', home_score: 2, away_score: 0, status: 'finished', group: 'C' },
  { id: '3', home_team: 'España', away_team: 'Japón', home_score: 1, away_score: 1, status: 'live', group: 'H' },
];

export const MOCK_STANDINGS = [
  { group: 'J', teams: [
    { rank: 1, name: 'Argentina', points: 9, played: 3, wins: 3 },
    { rank: 2, name: 'Polonia', points: 4, played: 3, wins: 1 },
    { rank: 3, name: 'México', points: 4, played: 3, wins: 1 },
  ]},
];

export const MOCK_STATS = { possession: [55, 45], shotsOnGoal: [8, 6] };
