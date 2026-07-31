import type { Types } from "mongoose";

export interface IChat {
    participants: Types.ObjectId[];
    lastMessage: Types.ObjectId | null;
    participantKey: string;
}