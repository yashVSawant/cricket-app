import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LiveGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:match')
  handleJoinMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    if (data?.matchId) {
      const room = `match:${data.matchId}`;
      client.join(room);
      this.logger.log(`Socket ${client.id} joined room ${room}`);
      return { event: 'joined', room };
    }
  }

  @SubscribeMessage('leave:match')
  handleLeaveMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    if (data?.matchId) {
      const room = `match:${data.matchId}`;
      client.leave(room);
      this.logger.log(`Socket ${client.id} left room ${room}`);
      return { event: 'left', room };
    }
  }

  /**
   * Broadcast real-time delivery event to room match:{matchId}
   */
  broadcastDeliveryPosted(matchId: string, payload: { match: any; delivery: any }) {
    const room = `match:${matchId}`;
    this.server.to(room).emit('delivery:posted', payload);
    this.logger.log(`Broadcasted delivery:posted to room ${room}`);
  }

  /**
   * Broadcast real-time delivery undo to room match:{matchId}
   */
  broadcastDeliveryUndone(matchId: string, payload: { match: any }) {
    const room = `match:${matchId}`;
    this.server.to(room).emit('delivery:undone', payload);
    this.logger.log(`Broadcasted delivery:undone to room ${room}`);
  }

  /**
   * Broadcast match status update (e.g. LIVE, Innings change, COMPLETED)
   */
  broadcastMatchUpdated(matchId: string, match: any) {
    const room = `match:${matchId}`;
    this.server.to(room).emit('match:updated', match);
    this.logger.log(`Broadcasted match:updated to room ${room}`);
  }
}

