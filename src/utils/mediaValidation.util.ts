import { fileTypeFromBuffer } from "file-type";

import { AppError } from "./appError.util.js";

export const MEDIA_LIMITS = {
    avatar: {
        maxSize: 5 * 1024 * 1024, // 5 MB

        allowedMimeTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
        ],
    },

    image: {
        maxSize: 5 * 1024 * 1024, // 5 MB

        allowedMimeTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
        ],
    },

    sticker: {
        maxSize: 1 * 1024 * 1024, // 1 MB

        allowedMimeTypes: [
            "image/png",
            "image/webp",
        ],
    },

    voiceNote: {
        maxSize: 10 * 1024 * 1024, // 10 MB
        maxDurationSeconds:120,
        allowedMimeTypes: [
            "audio/mpeg",
            "audio/mp4",
            "audio/ogg",
            "audio/webm",
            "audio/wav",
        ],
    },
} as const;

export const validateMedia = async (
    buffer: Buffer,
    allowedMimeTypes: readonly string[],
    maxSizeBytes: number
): Promise<void> => {
    if (buffer.length > maxSizeBytes) {
        throw new AppError(
            "File exceeds maximum allowed size.",
            400
        );
    }

    const detectedType =
        await fileTypeFromBuffer(buffer);

    if (!detectedType) {
        throw new AppError(
            "Unable to determine file type.",
            400
        );
    }

    if (
        !allowedMimeTypes.includes(
            detectedType.mime
        )
    ) {
        throw new AppError(
            "Unsupported file type.",
            400
        );
    }
};

export const MESSAGE_MEDIA = {
    image: {
        folder: "messages/images",
        resourceType: "image",
        validation: MEDIA_LIMITS.image,
    },

    sticker: {
        folder: "messages/stickers",
        resourceType: "image",
        validation: MEDIA_LIMITS.sticker,
    },

    voice: {
        folder: "messages/voice",
        resourceType: "video",
        validation: MEDIA_LIMITS.voiceNote,
    },
} as const;