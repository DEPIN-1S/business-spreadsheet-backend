import AuditLog from "./auditlog.model.js";
import User from "../user/user.model.js";
import { getPagination, getMeta } from "../../utils/pagination.js";
import { Op } from "sequelize";

export const getLogs = async (req, res, next) => {
    try {
        const { page, limit, offset } = getPagination(req);
        const where = {};
        if (req.query.entity) where.entity = req.query.entity;
        if (req.query.userId) where.userId = req.query.userId;
        if (req.query.action) where.action = req.query.action;
        if (req.query.from || req.query.to) {
            where.createdAt = {};
            if (req.query.from) where.createdAt[Op.gte] = new Date(req.query.from);
            if (req.query.to) where.createdAt[Op.lte] = new Date(req.query.to);
        }
        const { rows, count } = await AuditLog.findAndCountAll({
            where,
            limit, offset,
            order: [["createdAt", "DESC"]],
            include: [{ model: User, as: "user", attributes: ["id", "name", "email", "role"], required: false }]
        });
        res.json({ data: rows, meta: getMeta(page, limit, count) });
    } catch (e) { next(e); }
};

export const exportLogs = async (req, res, next) => {
    try {
        const where = {};
        if (req.query.entity) where.entity = req.query.entity;
        const logs = await AuditLog.findAll({ where, order: [["createdAt", "DESC"]], raw: true });

        // CSV output
        const header = "id,userId,entity,entityId,action,ip,createdAt\n";
        const rows = logs.map(l =>
            [l.id, l.userId, l.entity, l.entityId, l.action, l.ip, l.createdAt].join(",")
        ).join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=audit-export.csv");
        res.send(header + rows);
    } catch (e) { next(e); }
};
