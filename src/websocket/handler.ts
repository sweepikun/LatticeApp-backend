import { WebSocket } from 'ws';
import { serverManager } from '../services/mc-server/ServerManager.js';
import { FastifyRequest } from 'fastify';

type WebSocketClient = WebSocket & {
  serverId?: string;
  isAuthenticated?: boolean;
};

class WebSocketHandler {
  private clients: Set<WebSocketClient> = new Set();

  handleConnection(ws: WebSocketClient, req: FastifyRequest) {
    ws.isAuthenticated = true;
    this.clients.add(ws);

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch {
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
    });

    ws.send(JSON.stringify({ type: 'connected' }));
  }

  private handleMessage(ws: WebSocketClient, message: { type: string; serverId?: string; command?: string }) {
    switch (message.type) {
      case 'subscribe':
        if (message.serverId) {
          ws.serverId = message.serverId;
          ws.send(JSON.stringify({ type: 'subscribed', serverId: message.serverId }));
        }
        break;

      case 'unsubscribe':
        ws.serverId = undefined;
        ws.send(JSON.stringify({ type: 'unsubscribed' }));
        break;

      case 'command':
        if (message.serverId && message.command) {
          serverManager.sendCommand(message.serverId, message.command)
            .then(() => {
              ws.send(JSON.stringify({ type: 'command_sent', command: message.command }));
            })
            .catch((err) => {
              ws.send(JSON.stringify({ type: 'error', message: err.message }));
            });
        }
        break;
    }
  }

  broadcastLog(serverId: string, log: string): void {
    const message = JSON.stringify({ type: 'log', serverId, data: log, timestamp: Date.now() });
    
    this.clients.forEach((client) => {
      if (client.serverId === serverId && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  broadcastStatus(serverId: string, status: string): void {
    const message = JSON.stringify({ type: 'status', serverId, status, timestamp: Date.now() });
    
    this.clients.forEach((client) => {
      if (client.serverId === serverId && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

export const wsHandler = new WebSocketHandler();

serverManager.on('log', (serverId: string, log: string) => {
  wsHandler.broadcastLog(serverId, log);
});

serverManager.on('status', (serverId: string, status: string) => {
  wsHandler.broadcastStatus(serverId, status);
});
