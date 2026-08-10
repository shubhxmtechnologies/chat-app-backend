import type { Types } from "mongoose";

export type MessageStatus =
    | "sent"
    | "seen";

export type MessageType =
    | "text"
    | "image"
    | "voice";

export interface IMessage {
    chat: Types.ObjectId;

    sender: Types.ObjectId;

    messageType: MessageType;

    text: string | null;

    mediaUrl: string | null;

    replyTo: Types.ObjectId | null;

    mediaPublicId: string | null;

    status: MessageStatus;

    seenAt: Date | null;

    createdAt: Date;

    updatedAt: Date;
    isEdited: boolean;
    editedAt: Date | null;

    isDeletedForEveryone: boolean;
    clientMessageId: string | null;
    deletedAt: Date | null;
    deletedFor: Types.ObjectId[];
}