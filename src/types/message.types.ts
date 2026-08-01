import type { Types } from "mongoose";

export type MessageStatus =
    | "sent"
    | "delivered"
    | "seen";

export type MessageType =
    | "text"
    | "image"
    | "sticker"
    | "voice";

export interface IMessage {
    chat: Types.ObjectId;

    sender: Types.ObjectId;

    messageType: MessageType;

    text: string | null;

    mediaUrl: string | null;

    mediaPublicId: string | null;

    status: MessageStatus;

    deliveredAt: Date | null;

    seenAt: Date | null;

    createdAt: Date;

    updatedAt: Date;
}