import mongoose, { Schema } from "mongoose";

import type { IChat } from "../types/chat.types.js";

const chatSchema = new Schema<IChat>(
    {
        participants: {
            type: [
                {
                    type: Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
            ],

            required: true,

            validate: {
                validator: (participants: mongoose.Types.ObjectId[]) => {
                    return participants.length === 2;
                },
                message: "A chat must have exactly two participants",
            },
        },

        lastMessage: {
            type: Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },
        participantKey: {
            type: String,
            required: true,
        },
        deletedFor: {
            type: [
                {
                    type: Schema.Types.ObjectId,
                    ref: "User",
                },
            ],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

chatSchema.index(
    {
        participantKey: 1,
    },
    {
        unique: true,
    }
);

chatSchema.index({
    participants: 1,
});


export const Chat = mongoose.model<IChat>("Chat", chatSchema);