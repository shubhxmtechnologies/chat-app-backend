interface EnvConfig {
    PORT: string,
    MONGO_URI: string,
    JWT_ACCESS_SECRET: string,
    JWT_REFRESH_SECRET: string,
    ACCESS_TOKEN_EXPIRY: string,
    REFRESH_TOKEN_EXPIRY: string,
    CLIENT_ORIGIN: string
    NODE_ENV: string
}

export { EnvConfig }