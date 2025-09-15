import { Command } from '@colyseus/command';
export default class PlayerUpdateCommand extends Command {
    execute(data) {
        const { client, x, y, anim } = data;
        const player = this.room.state.players.get(client.sessionId);
        if (!player)
            return;
        player.x = x;
        player.y = y;
        player.anim = anim;
    }
}
