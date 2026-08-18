import type { Types } from "mongoose";
import type { PushSubscription } from "web-push";

export interface IUserName {
    firstName: string;
    lastName: string | null;
}

export interface IFieldChange {
    field: string;
    changedAt: Date;
}

export interface IUser {
    pushSubscription: PushSubscription | null;
    username: string;
    email: string;
    password: string;

    refreshToken: string | null;

    name: IUserName;
    
    avatarUrl: string | null;
    avatarPublicId: string | null;

    bio: string | null;

    lastSeenAt: Date | null;

    blockedUsers: Types.ObjectId[];
    
    globalMute: boolean;
    
    mutedChats: Types.ObjectId[];
    
    fieldChangeLog: IFieldChange[];

    failedLoginAttempts: number;

    lockUntil: Date | null;
}