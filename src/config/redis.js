import { createClient } from "redis";
import dotenv from "dotenv";
import logger from "./logger.js";

dotenv.config();

let client = null;
let isConnecting = false;

export async function getRedisClient() {
    if (client && client.isOpen) {
        return client;
    }
    if (isConnecting) {
        await new Promise(r => setTimeout(r, 200));
        if (client && client.isOpen) return client;
    }
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        logger.warn('⚠️ No REDIS_URL in environment; Redis caching disabled');
        return null;
    }

    try {
        isConnecting = true;
        const newClient = createClient({ 
            url: redisUrl,
            socket: {
                connectTimeout: 5000,
                reconnectStrategy: (retries) => {
                    if (retries > 3) return false; // Stop trying after 3 retries
                    return 500;
                }
            }
        });
        newClient.on('error', (err) => logger.warn('Redis Cache Client Warning: ' + err.message));
        await newClient.connect();
        client = newClient;
        logger.info('✅ Upstash Redis Cache Client Connected');
        return client;
    } catch (err) {
        logger.warn('⚠️ Redis Cache Connection Failed, falling back to DB: ' + err.message);
        client = null;
        return null;
    } finally {
        isConnecting = false;
    }
}

export async function getCache(key) {
    try {
        const c = await getRedisClient();
        if (!c || !c.isOpen) return null;
        const val = await c.get(key);
        return val ? JSON.parse(val) : null;
    } catch (e) {
        return null;
    }
}

export async function setCache(key, value, ttlSeconds = 300) {
    try {
        const c = await getRedisClient();
        if (!c || !c.isOpen) return;
        await c.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch (e) {}
}

export async function delCache(pattern) {
    try {
        const c = await getRedisClient();
        if (!c || !c.isOpen) return;
        if (pattern.includes('*')) {
            const keys = await c.keys(pattern);
            if (keys && keys.length > 0) {
                await c.del(keys);
            }
        } else {
            await c.del(pattern);
        }
    } catch (e) {}
}

export default { getRedisClient, getCache, setCache, delCache };
