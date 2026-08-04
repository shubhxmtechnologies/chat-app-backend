import multer from "multer";

const storage = multer.memoryStorage();

export const upload = multer({
    storage,

    limits: {
        fileSize: 15 * 1024 * 1024, // 15 MB
        fieldSize: 2 * 1024 * 1024, // 2 MB max for text fields
        fields: 10, // Max 10 text fields
    },
});