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

        messageType: {
            type: String,
            enum: [
                "text",
                "image",
                "sticker",
                "voice",
            ],
            default: "text",
        },

        text: {
            type: String,
            trim: true,
            minlength: 1,
            maxlength: 5000,

            default: null,

            validate: {
                validator: function (value: string | null) {
                    const doc = this as IMessage;

                    if (doc.messageType === "text") {
                        return (
                            typeof value === "string" &&
                            value.trim().length > 0
                        );
                    }

                    return value === null;
                },

                message:
                    "Text messages require text. Media messages must not contain text.",
            },
        },

        mediaUrl: {
            type: String,
            default: null,
            validate: {
                validator: function (value: string | null) {
                    const doc = this as IMessage;

                    if (doc.messageType === "text") {
                        return value === null;
                    }

                    return (
                        typeof value === "string" &&
                        value.trim().length > 0
                    );
                },
                message:
                    "Media messages require a media URL. Text messages must not contain one.",
            },
        },

        mediaPublicId: {
            type: String,
            default: null,
            validate: {
                validator: function (value: string | null) {
                    const doc = this as IMessage;

                    if (doc.messageType === "text") {
                        return value === null;
                    }

                    return (
                        typeof value === "string" &&
                        value.trim().length > 0
                    );
                },
                message:
                    "Media messages require a Cloudinary public ID. Text messages must not contain one.",
            },
        },
        status: {
            type: String,
            enum: [
                "sent",
                "delivered",
                "seen",
            ],
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