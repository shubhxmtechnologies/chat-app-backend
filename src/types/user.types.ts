export interface IUser {
    username: string;
    email: string;
    password: string;
    refreshToken: string | null;
    lastSeenAt: Date | null;
}