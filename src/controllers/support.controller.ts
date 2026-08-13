import { Request, Response } from "express";
import SupportTicket from "../models/support.model.js";
import { forwardToDeveloper } from "../services/telegram.service.js";

export const getSupportTicket = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        let ticket = await SupportTicket.findOne({ user: userId });
        
        if (!ticket) {
            ticket = await SupportTicket.create({ user: userId });
        }
        
        res.json({ ticket });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

export const sendSupportMessage = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { text } = req.body; 
        
        if (!text) {
            res.status(400).json({ message: "Message cannot be empty" });
            return;
        }

        const ticket = await SupportTicket.findOne({ user: userId });
        
        if (!ticket) {
            res.status(404).json({ message: "Support ticket not found" });
            return;
        }

        if (ticket.isBlocked) {
            res.status(403).json({ message: "You are blocked from sending support messages" });
            return;
        }

        if (!ticket.canSend) {
            res.status(403).json({ message: "You can only send one message at a time. Wait for a reply." });
            return;
        }

        const newMessage = {
            sender: "user",
            text: text,
            createdAt: new Date()
        };

        const updatedTicket = await SupportTicket.findOneAndUpdate(
            { user: userId },
            { 
                $push: { messages: newMessage },
                $set: { canSend: false } 
            },
            { returnDocument: 'after' }
        );

        // Forward to dev
        await forwardToDeveloper(userId, text);

        res.json({ ticket: updatedTicket });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

export const markSupportRead = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const ticket = await SupportTicket.findOneAndUpdate(
            { user: userId },
            { $set: { unreadCount: 0 } },
            { returnDocument: 'after' }
        );
        res.json({ success: true, ticket });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};
