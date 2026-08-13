import mongoose, { Schema, Document } from "mongoose";

export interface ISupportMessage {
    _id: mongoose.Types.ObjectId;
    sender: "user" | "developer";
    text: string | null;
    createdAt: Date;
}

export interface ISupportTicket extends Document {
    user: mongoose.Types.ObjectId;
    messages: ISupportMessage[];
    canSend: boolean;
    isBlocked: boolean;
    unreadCount: number; // Unread count for the user
    createdAt: Date;
    updatedAt: Date;
}

const SupportMessageSchema = new Schema(
    {
        sender: {
            type: String,
            enum: ["user", "developer"],
            required: true,
        },
        text: {
            type: String,
            default: null,
        },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

const SupportTicketSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true, // One support ticket per user
        },
        messages: [SupportMessageSchema],
        canSend: {
            type: Boolean,
            default: true,
        },
        isBlocked: {
            type: Boolean,
            default: false,
        },
        unreadCount: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

export default mongoose.model<ISupportTicket>("SupportTicket", SupportTicketSchema);
