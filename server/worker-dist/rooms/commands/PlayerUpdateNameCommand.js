import { Command } from '@colyseus/command';
export default class PlayerUpdateNameCommand extends Command {
    execute(data) {
        const { client, name } = data;
        const player = this.room.state.players.get(client.sessionId);
        if (!player)
            return;
        player.name = name;
    }
}
