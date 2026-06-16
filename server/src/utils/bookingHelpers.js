export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function formatDateTimeForMySql(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function generateReference(prefix) {
  const timestamp = Date.now();
  const randomPart = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");

  return `${prefix}-${timestamp}-${randomPart}`;
}

export function toIsoOrNull(value) {
  const parsed = parseStoredDateTime(value);
  return parsed ? parsed.toISOString() : null;
}

export function parseStoredDateTime(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
