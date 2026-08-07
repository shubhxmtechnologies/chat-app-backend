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
            maxlength: 1000,

            default: null,

            validate: {
                validator: function (value: string | null) {
                    const doc = this as IMessage;

                    if (doc.messageType === "text") {
                        if (typeof value !== "string" || value.trim().length === 0) {
                            return false;
                        }
                        const words = value.trim().split(/\s+/).filter(Boolean);
                        return words.length <= 200 && value.trim().length <= 1000;
                    }

                    return value === null;
                },

                message:
                    "Text messages must be between 1 and 1000 characters and at most 200 words. Media messages must not contain text.",
            },
        },

        mediaUrl: {
            type: String,
            default: null,
            maxlength: 500,
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
            maxlength: 255,
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
        isEdited: {
            type: Boolean,
            default: false,
        },

        editedAt: {
            type: Date,
            default: null,
        },
        isDeletedForEveryone: {
            type: Boolean,
            default: false,
        },

        deletedAt: {
            type: Date,
            default: null,
        },
        clientMessageId: {
            type: String,
            default: null,
            maxlength: 100,
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

messageSchema.index(
    {
        sender: 1,
        chat: 1,
        clientMessageId: 1,
    },
    {
        unique: true,
        partialFilterExpression: {
            clientMessageId: {
                $type: "string",
            },
        },
    }
);

export const Message = mongoose.model<IMessage>(
    "Message",
    messageSchema
);