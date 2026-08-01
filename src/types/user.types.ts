export interface IUser {
    username: string;
    email: string;
    password: string;
    
    refreshToken: string | null;
    
    avatarUrl: string | null;
    avatarPublicId: string | null;

    bio: string | null;

    usernameLocked: boolean;
    
    lastSeenAt: Date | null;
}