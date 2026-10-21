import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import AppError from "../utils/AppError.js";

const REQUIRED_ENV = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_ENDPOINT"];

let client;

export function requireR2Config() {
    const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        throw new AppError(`File storage is not configured. Set ${missing.join(", ")}.`, 500);
    }
    return {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        bucket: process.env.R2_BUCKET,
        endpoint: process.env.R2_ENDPOINT
    };
}

function getClient() {
    const config = requireR2Config();
    if (!client) {
        client = new S3Client({
            region: "auto",
            endpoint: config.endpoint,
            forcePathStyle: true,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey
            }
        });
    }
    return { client, bucket: config.bucket };
}

export async function putObject(key, body, contentType) {
    const { client: s3, bucket } = getClient();
    await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType || "application/octet-stream"
    }));
}

export async function deleteObject(key) {
    const { client: s3, bucket } = getClient();
    await s3.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
    }));
}

function readStream(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
}

export function createR2Storage({ filename, key }) {
    return {
        _handleFile(req, file, cb) {
            try {
                requireR2Config();
            } catch (err) {
                file.stream.resume();
                return cb(err);
            }

            filename(req, file, (nameErr, name) => {
                if (nameErr) {
                    file.stream.resume();
                    return cb(nameErr);
                }

                const objectKey = key(req, file, name);
                readStream(file.stream)
                    .then(async (body) => {
                        await putObject(objectKey, body, file.mimetype);
                        cb(null, {
                            filename: name,
                            key: objectKey,
                            size: body.length
                        });
                    })
                    .catch((err) => cb(err));
            });
        },
        _removeFile(req, file, cb) {
            if (!file.key) return cb(null);
            deleteObject(file.key).then(() => cb(null)).catch(cb);
        }
    };
}
