import { Readable } from "stream";

import { cloudinary } from "../config/cloudinary.js";
import { AppError } from "../utils/appError.util.js";

export type CloudinaryResourceType =
    | "image"
    | "video"
    | "raw"
    | "auto";

export interface UploadResult {
    secureUrl: string;
    publicId: string;
}

export const uploadBuffer = (
    buffer: Buffer,
    folder: string,
    resourceType: CloudinaryResourceType = "auto"
): Promise<UploadResult> => {
    return new Promise((resolve, reject) => {
        const uploadStream =
            cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: resourceType,
                },
                (error, result) => {
                    if (error || !result) {
                        reject(
                            new AppError(
                                "Failed to upload file",
                                500
                            )
                        );

                        return;
                    }

                    resolve({
                        secureUrl: result.secure_url,
                        publicId: result.public_id,
                    });
                }
            );

        Readable.from(buffer).pipe(uploadStream);
    });
};

export const deleteAsset = async (
    publicId: string,
    resourceType: CloudinaryResourceType = "auto"
): Promise<void> => {
    await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
    });
};