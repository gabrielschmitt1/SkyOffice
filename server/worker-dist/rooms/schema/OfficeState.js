var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Schema, ArraySchema, SetSchema, MapSchema, type } from '@colyseus/schema';
export class Player extends Schema {
    name = '';
    x = 705;
    y = 500;
    anim = 'adam_idle_down';
    readyToConnect = false;
    videoConnected = false;
}
__decorate([
    type('string'),
    __metadata("design:type", Object)
], Player.prototype, "name", void 0);
__decorate([
    type('number'),
    __metadata("design:type", Object)
], Player.prototype, "x", void 0);
__decorate([
    type('number'),
    __metadata("design:type", Object)
], Player.prototype, "y", void 0);
__decorate([
    type('string'),
    __metadata("design:type", Object)
], Player.prototype, "anim", void 0);
__decorate([
    type('boolean'),
    __metadata("design:type", Object)
], Player.prototype, "readyToConnect", void 0);
__decorate([
    type('boolean'),
    __metadata("design:type", Object)
], Player.prototype, "videoConnected", void 0);
export class Computer extends Schema {
    connectedUser = new SetSchema();
}
__decorate([
    type({ set: 'string' }),
    __metadata("design:type", Object)
], Computer.prototype, "connectedUser", void 0);
export class Whiteboard extends Schema {
    roomId = getRoomId();
    connectedUser = new SetSchema();
}
__decorate([
    type('string'),
    __metadata("design:type", Object)
], Whiteboard.prototype, "roomId", void 0);
__decorate([
    type({ set: 'string' }),
    __metadata("design:type", Object)
], Whiteboard.prototype, "connectedUser", void 0);
export class ChatMessage extends Schema {
    author = '';
    createdAt = new Date().getTime();
    content = '';
}
__decorate([
    type('string'),
    __metadata("design:type", Object)
], ChatMessage.prototype, "author", void 0);
__decorate([
    type('number'),
    __metadata("design:type", Object)
], ChatMessage.prototype, "createdAt", void 0);
__decorate([
    type('string'),
    __metadata("design:type", Object)
], ChatMessage.prototype, "content", void 0);
export class OfficeState extends Schema {
    players = new MapSchema();
    computers = new MapSchema();
    whiteboards = new MapSchema();
    chatMessages = new ArraySchema();
}
__decorate([
    type({ map: Player }),
    __metadata("design:type", Object)
], OfficeState.prototype, "players", void 0);
__decorate([
    type({ map: Computer }),
    __metadata("design:type", Object)
], OfficeState.prototype, "computers", void 0);
__decorate([
    type({ map: Whiteboard }),
    __metadata("design:type", Object)
], OfficeState.prototype, "whiteboards", void 0);
__decorate([
    type([ChatMessage]),
    __metadata("design:type", Object)
], OfficeState.prototype, "chatMessages", void 0);
export const whiteboardRoomIds = new Set();
const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const charactersLength = characters.length;
function getRoomId() {
    let result = '';
    for (let i = 0; i < 12; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    if (!whiteboardRoomIds.has(result)) {
        whiteboardRoomIds.add(result);
        return result;
    }
    else {
        console.log('roomId exists, remaking another one.');
        return getRoomId();
    }
}
