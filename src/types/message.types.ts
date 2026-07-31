import type { Types } from "mongoose";

export type MessageStatus =
    | "sent"
    | "delivered"
    | "seen";

export interface IMessage {
    chat: Types.ObjectId;
    sender: Types.ObjectId;
    text: string;

    status: MessageStatus;
    deliveredAt: Date | null;
    seenAt: Date | null;

    createdAt: Date;
    updatedAt: Date;
}