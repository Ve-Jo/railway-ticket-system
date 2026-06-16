import { query } from "../db/connection.js";

const ALLOWED_SORT_COLUMNS = {
  id: "ol.id",
  created_at: "ol.created_at",
  action: "ol.action",
  result_status: "ol.result_status"
};

function normalizePositiveInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function normalizeDateTime(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}

export async function writeOperationLog({
  actorUserId = null,
  entityType,
  entityId = null,
  action,
  resultStatus,
  details = null,
  ipAddress = null
}) {
  try {
    await query(
      `
        INSERT INTO operation_logs (
          actor_user_id,
          entity_type,
          entity_id,
          action,
          result_status,
          ip_address,
          details
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        actorUserId,
        entityType,
        entityId,
        action,
        resultStatus,
        ipAddress,
        details ? JSON.stringify(details) : null
      ]
    );
  } catch (error) {
    console.error("Failed to write operation log", error);
  }
}

export async function getOperationLogs(filters = {}) {
  const {
    actorUserId = null,
    actorLoginSearch = null,
    entityType = null,
    entityId = null,
    action = null,
    resultStatus = null,
    dateFrom = null,
    dateTo = null,
    sortBy = "created_at",
    sortOrder = "desc",
    page = 1,
    pageSize = 20
  } = filters;

  const where = ["1 = 1"];
  const whereParams = [];
  const normalizedActorUserId = normalizePositiveInteger(actorUserId);
  const normalizedEntityId = normalizePositiveInteger(entityId);
  const normalizedPage = normalizePositiveInteger(page) ?? 1;
  const normalizedPageSize = Math.min(100, normalizePositiveInteger(pageSize) ?? 20);

  if (normalizedActorUserId !== null) {
    where.push("ol.actor_user_id = ?");
    whereParams.push(normalizedActorUserId);
  }

  if (actorLoginSearch) {
    where.push("(u.username LIKE ? OR u.full_name LIKE ?)");
    const pattern = `%${actorLoginSearch}%`;
    whereParams.push(pattern, pattern);
  }

  if (entityType) {
    where.push("ol.entity_type = ?");
    whereParams.push(entityType);
  }

  if (normalizedEntityId !== null) {
    where.push("ol.entity_id = ?");
    whereParams.push(normalizedEntityId);
  }

  if (action) {
    where.push("ol.action LIKE ?");
    whereParams.push(`%${action}%`);
  }

  if (resultStatus) {
    where.push("ol.result_status = ?");
    whereParams.push(resultStatus);
  }

  const from = normalizeDateTime(dateFrom);
  if (from) {
    where.push("ol.created_at >= ?");
    whereParams.push(from);
  }

  const to = normalizeDateTime(dateTo);
  if (to) {
    where.push("ol.created_at <= ?");
    whereParams.push(to);
  }

  const orderColumn = ALLOWED_SORT_COLUMNS[sortBy] ?? ALLOWED_SORT_COLUMNS.created_at;
  const orderDirection = sortOrder.toLowerCase() === "asc" ? "ASC" : "DESC";

  const countSql = `
    SELECT COUNT(*) AS total
    FROM operation_logs ol
    LEFT JOIN users u ON u.id = ol.actor_user_id
    WHERE ${where.join(" AND ")}
  `;
  const [{ total }] = await query(countSql, whereParams);

  const offset = (normalizedPage - 1) * normalizedPageSize;
  const dataSql = `
    SELECT
      ol.id,
      ol.actor_user_id AS actorUserId,
      u.username AS actorLogin,
      u.full_name AS actorFullName,
      ol.entity_type AS entityType,
      ol.entity_id AS entityId,
      ol.action,
      ol.result_status AS resultStatus,
      ol.ip_address AS ipAddress,
      ol.details,
      ol.created_at AS createdAt
    FROM operation_logs ol
    LEFT JOIN users u ON u.id = ol.actor_user_id
    WHERE ${where.join(" AND ")}
    ORDER BY ${orderColumn} ${orderDirection}
    LIMIT ${normalizedPageSize} OFFSET ${offset}
  `;
  const items = await query(dataSql, whereParams);

  return { items, total: Number(total) };
}
