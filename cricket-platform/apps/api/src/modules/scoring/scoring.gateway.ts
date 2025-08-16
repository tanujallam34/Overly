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
import { Injectable } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/scoring',
})
export class ScoringGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-match')
  joinMatch(@MessageBody() matchId: string, @ConnectedSocket() client: Socket) {
    client.join(`match:${matchId}`);
    client.emit('joined-match', { matchId });
  }

  @SubscribeMessage('leave-match')
  leaveMatch(@MessageBody() matchId: string, @ConnectedSocket() client: Socket) {
    client.leave(`match:${matchId}`);
    client.emit('left-match', { matchId });
  }

  // Emit ball update to all clients watching the match
  emitBallUpdate(matchId: string, data: any) {
    this.server.to(`match:${matchId}`).emit('ball-update', data);
  }

  // Emit over completion
  emitOverComplete(matchId: string, data: any) {
    this.server.to(`match:${matchId}`).emit('over-complete', data);
  }

  // Emit innings completion
  emitInningsComplete(matchId: string, data: any) {
    this.server.to(`match:${matchId}`).emit('innings-complete', data);
  }

  // Emit match completion
  emitMatchComplete(matchId: string, data: any) {
    this.server.to(`match:${matchId}`).emit('match-complete', data);
  }

  // Emit scorecard update
  emitScorecardUpdate(matchId: string, scorecard: any) {
    this.server.to(`match:${matchId}`).emit('scorecard-update', scorecard);
  }
}
