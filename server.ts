import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';

const PORT = 3000;

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  displayName: string;
  teamId: string;
  roomId: string | null;
  inVoiceChannel: boolean;
  isSpeaking: boolean;
}

interface MultiplayerRoom {
  id: string;
  name: string;
  mode: 'exhibition' | 'world_cup' | 'asia_cup' | 'ranked';
  hostId: string;
  hostName: string;
  hostTeamId: string;
  guestId: string | null;
  guestName: string | null;
  guestTeamId: string | null;
  status: 'waiting' | 'active';
  createdAt: number;
}

interface ServerChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorTeam: string;
  channel: 'global' | 'world-cup' | 'asia-cup' | 'lfg' | 'strategy';
  text: string;
  createdAtMs: number;
}

const clients = new Map<string, ConnectedClient>();
const rooms = new Map<string, MultiplayerRoom>();
const recentChat: ServerChatMessage[] = [
  {
    id: 'srv_msg_1',
    authorId: 'seed_2',
    authorName: 'Kenji_Sapporo',
    authorTeam: 'JPN',
    channel: 'global',
    text: 'Asia Cup bracket is live! Looking for a semifinal warm-up scrim in Room #ASIA-1.',
    createdAtMs: Date.now() - 180000,
  },
  {
    id: 'srv_msg_2',
    authorId: 'seed_1',
    authorName: 'Mackinnon97_CAN',
    authorTeam: 'CAN',
    channel: 'global',
    text: 'Tip: Hold Space to charge a full-power slapshot from the high slot when the goalie is screened.',
    createdAtMs: Date.now() - 95000,
  },
  {
    id: 'srv_msg_3',
    authorId: 'seed_3',
    authorName: 'BarysAstana_KZ',
    authorTeam: 'KAZ',
    channel: 'asia-cup',
    text: 'Team Kazakhstan ready for the Asia Cup Championship. Good luck on the ice!',
    createdAtMs: Date.now() - 45000,
  },
];

// Seed an open multiplayer room so players see active rooms immediately
rooms.set('ASIA-1', {
  id: 'ASIA-1',
  name: 'Tokyo Dome Scrim #1',
  mode: 'asia_cup',
  hostId: 'seed_host_jpn',
  hostName: 'Kenji_Sapporo',
  hostTeamId: 'JPN',
  guestId: null,
  guestName: null,
  guestTeamId: null,
  status: 'waiting',
  createdAt: Date.now() - 60000,
});

rooms.set('WCUP-99', {
  id: 'WCUP-99',
  name: 'Montreal Bell Arena Ranked',
  mode: 'world_cup',
  hostId: 'seed_host_can',
  hostName: 'Mackinnon97_CAN',
  hostTeamId: 'CAN',
  guestId: null,
  guestName: null,
  guestTeamId: null,
  status: 'waiting',
  createdAt: Date.now() - 30000,
});

function broadcastAll(payload: unknown): void {
  const raw = JSON.stringify(payload);
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(raw);
    }
  }
}

function broadcastRoom(roomId: string, payload: unknown, excludeId?: string): void {
  const raw = JSON.stringify(payload);
  for (const client of clients.values()) {
    if (
      client.roomId === roomId &&
      client.id !== excludeId &&
      client.ws.readyState === WebSocket.OPEN
    ) {
      client.ws.send(raw);
    }
  }
}

function getPublicState() {
  return {
    onlineCount: Math.max(1, clients.size + 14),
    rooms: Array.from(rooms.values()),
    voicePeers: Array.from(clients.values())
      .filter(c => c.inVoiceChannel)
      .map(c => ({
        id: c.id,
        displayName: c.displayName,
        teamId: c.teamId,
        isSpeaking: c.isSpeaking,
      })),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', online: clients.size, rooms: rooms.size });
  });

  app.get('/api/lobby', (_req, res) => {
    res.json({
      ...getPublicState(),
      recentChat,
    });
  });

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', ws => {
    const clientId = `skater_${Math.random().toString(36).slice(2, 9)}`;
    const client: ConnectedClient = {
      id: clientId,
      ws,
      displayName: 'ApexSkater',
      teamId: 'CAN',
      roomId: null,
      inVoiceChannel: false,
      isSpeaking: false,
    };
    clients.set(clientId, client);

    ws.send(
      JSON.stringify({
        type: 'init',
        clientId,
        ...getPublicState(),
        recentChat,
      })
    );
    broadcastAll({ type: 'presence:update', ...getPublicState() });

    ws.on('message', rawData => {
      try {
        const msg = JSON.parse(String(rawData));

        if (msg.type === 'profile:identify') {
          client.displayName = String(msg.displayName || 'ApexSkater').slice(0, 60);
          client.teamId = String(msg.teamId || 'CAN').slice(0, 32);
          broadcastAll({ type: 'presence:update', ...getPublicState() });
        } else if (msg.type === 'chat:send') {
          const text = String(msg.text || '').trim().slice(0, 400);
          if (!text) return;
          const channel = ['global', 'world-cup', 'asia-cup', 'lfg', 'strategy'].includes(msg.channel)
            ? msg.channel
            : 'global';
          const chatItem: ServerChatMessage = {
            id: String(msg.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
            authorId: client.id,
            authorName: client.displayName,
            authorTeam: client.teamId,
            channel,
            text,
            createdAtMs: Date.now(),
          };
          if (!recentChat.some(m => m.id === chatItem.id)) {
            recentChat.push(chatItem);
            if (recentChat.length > 50) recentChat.shift();
          }
          broadcastAll({ type: 'chat:message', message: chatItem });
        } else if (msg.type === 'room:create') {
          const roomId = String(
            msg.roomId || `ICE-${Math.floor(100 + Math.random() * 900)}`
          ).toUpperCase();
          const newRoom: MultiplayerRoom = {
            id: roomId,
            name: String(msg.name || `${client.displayName}'s Rink`).slice(0, 50),
            mode: msg.mode || 'exhibition',
            hostId: client.id,
            hostName: client.displayName,
            hostTeamId: client.teamId,
            guestId: null,
            guestName: null,
            guestTeamId: null,
            status: 'waiting',
            createdAt: Date.now(),
          };
          rooms.set(roomId, newRoom);
          client.roomId = roomId;
          broadcastAll({ type: 'presence:update', ...getPublicState() });
        } else if (msg.type === 'room:join') {
          const room = rooms.get(String(msg.roomId));
          if (room) {
            client.roomId = room.id;
            if (room.hostId !== client.id) {
              room.guestId = client.id;
              room.guestName = client.displayName;
              room.guestTeamId = client.teamId;
              room.status = 'active';
            }
            broadcastAll({ type: 'presence:update', ...getPublicState() });
            broadcastRoom(room.id, {
              type: 'room:ready',
              room,
            });
          }
        } else if (msg.type === 'match:input') {
          if (client.roomId) {
            broadcastRoom(
              client.roomId,
              {
                type: 'match:remote_input',
                fromId: client.id,
                input: msg.input,
              },
              client.id
            );
          }
        } else if (msg.type === 'voice:toggle') {
          client.inVoiceChannel = Boolean(msg.enabled);
          client.isSpeaking = false;
          broadcastAll({ type: 'presence:update', ...getPublicState() });
        } else if (msg.type === 'voice:speaking') {
          client.isSpeaking = Boolean(msg.isSpeaking);
          broadcastAll({ type: 'presence:update', ...getPublicState() });
        } else if (
          msg.type === 'webrtc:offer' ||
          msg.type === 'webrtc:answer' ||
          msg.type === 'webrtc:ice'
        ) {
          const target = clients.get(String(msg.targetId));
          if (target && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(
              JSON.stringify({
                ...msg,
                fromId: client.id,
                fromName: client.displayName,
              })
            );
          }
        }
      } catch {
        // Ignore malformed packets
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      for (const [rId, room] of rooms.entries()) {
        if (room.hostId === clientId) {
          rooms.delete(rId);
        } else if (room.guestId === clientId) {
          room.guestId = null;
          room.guestName = null;
          room.guestTeamId = null;
          room.status = 'waiting';
        }
      }
      broadcastAll({ type: 'presence:update', ...getPublicState() });
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Apex Ice Server + WebSocket running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
