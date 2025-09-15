import { Command } from '@colyseus/command';
export class WhiteboardAddUserCommand extends Command {
    execute(data) {
        const { client, whiteboardId } = data;
        const whiteboard = this.room.state.whiteboards.get(whiteboardId);
        const clientId = client.sessionId;
        if (!whiteboard || whiteboard.connectedUser.has(clientId))
            return;
        whiteboard.connectedUser.add(clientId);
    }
}
export class WhiteboardRemoveUserCommand extends Command {
    execute(data) {
        const { client, whiteboardId } = data;
        const whiteboard = this.state.whiteboards.get(whiteboardId);
        if (whiteboard.connectedUser.has(client.sessionId)) {
            whiteboard.connectedUser.delete(client.sessionId);
        }
    }
}
