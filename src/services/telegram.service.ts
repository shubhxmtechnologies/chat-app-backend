import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import SupportTicket from '../models/support.model.js';
import { User } from '../models/user.model.js';
import { getIo } from '../socket/index.js';
import mongoose from 'mongoose';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const devChatId = process.env.TELEGRAM_CHAT_ID;

let bot: TelegramBot | null = null;

if (token) {
    bot = new TelegramBot(token, { polling: true });
    
    bot.setMyCommands([
        { command: '/allow', description: 'Allow user to send another message (e.g. /allow <userId>)' },
        { command: '/block', description: 'Block a user from sending messages (e.g. /block <userId>)' },
        { command: '/unblock', description: 'Unblock a user (e.g. /unblock <userId>)' }
    ]);
    
    bot.on('message', async (msg) => {
        if (!devChatId || msg.chat.id.toString() !== devChatId.toString()) return;
        
        // Handle commands
        if (msg.text?.startsWith('/allow ')) {
            const userId = msg.text.split(' ')[1];
            if (!mongoose.isValidObjectId(userId)) {
                bot?.sendMessage(devChatId, `❌ Invalid user ID.`);
                return;
            }
            try {
                const ticket = await SupportTicket.findOneAndUpdate(
                    { user: new mongoose.Types.ObjectId(userId) },
                    { canSend: true },
                    { returnDocument: 'after' }
                );
                if (ticket) {
                    bot?.sendMessage(devChatId, `✅ User ${userId} allowed to send another message.`);
                    const io = getIo();
                    if (io) io.to(`user:${userId}`).emit("support_ticket_updated", ticket);
                } else {
                    bot?.sendMessage(devChatId, `❌ Ticket for user ${userId} not found.`);
                }
            } catch (e) {
                bot?.sendMessage(devChatId, `❌ Error allowing user: ${e}`);
            }
            return;
        }
        
        if (msg.text?.startsWith('/block ')) {
            const userId = msg.text.split(' ')[1];
            if (!mongoose.isValidObjectId(userId)) return;
            try {
                const ticket = await SupportTicket.findOneAndUpdate(
                    { user: new mongoose.Types.ObjectId(userId) },
                    { isBlocked: true },
                    { returnDocument: 'after' }
                );
                if (ticket) {
                    bot?.sendMessage(devChatId, `🚫 User ${userId} blocked.`);
                    const io = getIo();
                    if (io) io.to(`user:${userId}`).emit("support_ticket_updated", ticket);
                }
            } catch (e) {}
            return;
        }

        if (msg.text?.startsWith('/unblock ')) {
            const userId = msg.text.split(' ')[1];
            if (!mongoose.isValidObjectId(userId)) return;
            try {
                const ticket = await SupportTicket.findOneAndUpdate(
                    { user: new mongoose.Types.ObjectId(userId) },
                    { isBlocked: false },
                    { returnDocument: 'after' }
                );
                if (ticket) {
                    bot?.sendMessage(devChatId, `✅ User ${userId} unblocked.`);
                    const io = getIo();
                    if (io) io.to(`user:${userId}`).emit("support_ticket_updated", ticket);
                }
            } catch (e) {}
            return;
        }

        // Handle replies
        if (msg.reply_to_message) {
            const originalText = msg.reply_to_message.text || msg.reply_to_message.caption || "";
            const match = originalText.match(/User ID:\s*([a-f0-9]{24})/i);
            if (match && match[1]) {
                const userId = match[1];
                if (!mongoose.isValidObjectId(userId)) return;
                
                const replyText = msg.text || msg.caption || "";
                if (!replyText) return; // Only accept text or captions
                
                try {
                    const ticket = await SupportTicket.findOneAndUpdate(
                        { user: new mongoose.Types.ObjectId(userId) },
                        { 
                            $push: { messages: { sender: 'developer', text: replyText, createdAt: new Date() } },
                            $inc: { unreadCount: 1 }
                        },
                        { returnDocument: 'after', upsert: true }
                    );
                    
                    if (ticket) {
                        const newMessage = ticket.messages[ticket.messages.length - 1];
                        const io = getIo();
                        if (io) {
                            io.to(`user:${userId}`).emit("support_message", newMessage);
                        }
                    }
                } catch (e) {
                    bot?.sendMessage(devChatId, `❌ Error sending reply: ${e}`);
                }
            }
        }
    });
}

export const forwardToDeveloper = async (userId: string, text: string) => {
    if (!bot || !devChatId) return;
    
    try {
        const user = await User.findById(userId).select('username name email avatarUrl');
        
        let userInfo = `User ID: \`${userId}\`\n`;
        if (user) {
            userInfo += `Username: \`@${user.username || 'N/A'}\`\n`;
            userInfo += `Name: \`${user.name?.firstName || ''} ${user.name?.lastName || ''}\`\n`;
            userInfo += `Email: \`${user.email}\`\n`;
        }
        
        const message = `🚨 *New Support Message*\n\n${userInfo}\n*Message:*\n\`\`\`text\n${text}\n\`\`\``;

        bot.sendMessage(devChatId, message, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error("Failed to forward to Telegram", e);
    }
};
