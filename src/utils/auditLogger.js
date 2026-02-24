import AuditLog from "../features/audit/auditlog.model.js";
import logger from "../config/logger.js";

/**
 * Log an action to the audit trail.
 * @param {string} userId
 * @param {string} entity  - cell | row | column | sheet | permission | user | inventory
 * @param {string} entityId
 * @param {string} action  - create | update | delete | login | export
 * @param {object|null} oldValue
 * @param {object|null} newValue
 * @param {object|null} req   - Express request (for IP extraction)
 * @param {object|null} meta  - extra metadata
 */
export async function logAction(userId, entity, entityId, action, oldValue = null, newValue = null, req = null, meta = null) {
    try {
        const ip = req
            ? (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null)
            : null;

        await AuditLog.create({
            userId: userId || null,
            entity,
            entityId: entityId ? String(entityId) : null,
            action,
            oldValue,
            newValue,
            ip,
            meta
        });
    } catch (err) {
        // Audit failures must not break the main flow
        logger.error(`Audit log failed: ${err.message}`);
    }
}

export default { logAction };
