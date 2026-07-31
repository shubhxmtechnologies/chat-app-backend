import mongoose, { Schema } from "mongoose";

import type { IMessage } from "../types/message.types.js";

const messageSchema = new Schema<IMessage>(
    {
        chat: {
            type: Schema.Types.ObjectId,
            ref: "Chat",
            required: true,
        },

        sender: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        text: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 5000,
        },

        status: {
            type: String,
            enum: ["sent", "delivered", "seen"],
            default: "sent",
        },

        deliveredAt: {
            type: Date,
            default: null,
        },

        seenAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

messageSchema.index({
    chat: 1,
    createdAt: -1,
    _id: -1,
});

export const Message = mongoose.model<IMessage>(
    "Message",
    messageSchema
);