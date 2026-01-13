import oracledb from "oracledb";
import { DateTime } from "luxon";
import { withOracleConnection } from "./oracle.js";
export const LOAD_DURATION_MINUTES = 85;
export async function getLaundryStatus() {
    return withOracleConnection(async (connection) => {
        const result = await connection.execute(`SELECT
        STATUS,
        CURRENT_USER_NAME,
        STARTED_AT,
        EXPECTED_DONE_AT,
        UPDATED_AT,
        UPDATED_BY_USER_ID,
        UPDATED_BY_NAME,
        NOTES
      FROM LAUNDRY_STATUS
      ORDER BY UPDATED_AT DESC`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows?.[0] ?? null;
    });
}
export async function markLaundryStarted(userId, userName, channelId) {
    return withOracleConnection(async (connection) => {
        const startedAt = new Date();
        const expectedDoneAt = DateTime.fromJSDate(startedAt)
            .plus({ minutes: LOAD_DURATION_MINUTES })
            .toJSDate();
        let notificationId = null;
        await connection.execute(`UPDATE LAUNDRY_STATUS
      SET STATUS = 'in_use',
        CURRENT_USER_ID = :userId,
        CURRENT_USER_NAME = :userName,
        STARTED_AT = :startedAt,
        EXPECTED_DONE_AT = :expectedDoneAt,
        UPDATED_AT = :updatedAt,
        UPDATED_BY_USER_ID = :userId,
        UPDATED_BY_NAME = :userName
      WHERE MACHINE_TYPE = 'laundry'`, {
            userId,
            userName,
            startedAt,
            expectedDoneAt,
            updatedAt: startedAt,
        });
        await connection.execute(`INSERT INTO LAUNDRY_STATUS_HISTORY (
        MACHINE_TYPE,
        STATUS,
        USER_ID,
        USER_NAME,
        STARTED_AT,
        UPDATED_AT,
        UPDATED_BY_USER_ID,
        UPDATED_BY_NAME,
        NOTES
      ) VALUES (
        'laundry',
        'in_use',
        :userId,
        :userName,
        :startedAt,
        :updatedAt,
        :userId,
        :userName,
        :notes
      )`, {
            userId,
            userName,
            startedAt,
            updatedAt: startedAt,
            notes: "Started via /laundry",
        });
        if (channelId) {
            const insertResult = await connection.execute(`INSERT INTO LAUNDRY_NOTIFICATIONS (
          CHANNEL_ID,
          MESSAGE,
          DUE_AT,
          STATUS,
          CREATED_AT,
          CREATED_BY_USER_ID,
          CREATED_BY_NAME
        ) VALUES (
          :channelId,
          :message,
          :dueAt,
          'pending',
          :createdAt,
          :userId,
          :userName
        ) RETURNING ID INTO :id`, {
                channelId,
                message: "Laundry should be done now.",
                dueAt: expectedDoneAt,
                createdAt: startedAt,
                userId,
                userName,
                id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
            });
            const rows = insertResult.outBinds?.ID;
            if (Array.isArray(rows) && rows.length > 0) {
                notificationId = Number(rows[0]);
            }
        }
        await connection.commit();
        return { expectedDoneAt, notificationId };
    });
}
export async function markLaundryCompleted(updatedByName = "LaundryBot") {
    return withOracleConnection(async (connection) => {
        const completedAt = new Date();
        await connection.execute(`UPDATE LAUNDRY_STATUS
      SET STATUS = 'available',
        CURRENT_USER_ID = NULL,
        CURRENT_USER_NAME = NULL,
        STARTED_AT = NULL,
        EXPECTED_DONE_AT = NULL,
        UPDATED_AT = :updatedAt,
        UPDATED_BY_USER_ID = NULL,
        UPDATED_BY_NAME = :updatedByName
      WHERE MACHINE_TYPE = 'laundry'`, {
            updatedAt: completedAt,
            updatedByName,
        });
        await connection.execute(`INSERT INTO LAUNDRY_STATUS_HISTORY (
        MACHINE_TYPE,
        STATUS,
        USER_ID,
        USER_NAME,
        STARTED_AT,
        ENDED_AT,
        UPDATED_AT,
        UPDATED_BY_USER_ID,
        UPDATED_BY_NAME,
        NOTES
      ) VALUES (
        'laundry',
        'available',
        NULL,
        NULL,
        NULL,
        :endedAt,
        :updatedAt,
        NULL,
        :updatedByName,
        :notes
      )`, {
            endedAt: completedAt,
            updatedAt: completedAt,
            updatedByName,
            notes: "Laundry cycle completed.",
        });
        await connection.commit();
    });
}
export async function getPendingLaundryNotifications(limit = 10) {
    return withOracleConnection(async (connection) => {
        const result = await connection.execute(`SELECT
        ID,
        CHANNEL_ID,
        MESSAGE,
        DUE_AT
      FROM LAUNDRY_NOTIFICATIONS
      WHERE STATUS = 'pending'
        AND DUE_AT <= CURRENT_TIMESTAMP
      ORDER BY DUE_AT
      FETCH FIRST :limit ROWS ONLY`, { limit }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows ?? [];
    });
}
export async function markLaundryNotificationSent(notificationId, sentAt = new Date()) {
    await withOracleConnection(async (connection) => {
        await connection.execute(`UPDATE LAUNDRY_NOTIFICATIONS
      SET STATUS = 'sent',
        SENT_AT = :sentAt
      WHERE ID = :id`, {
            sentAt,
            id: notificationId,
        });
        await connection.commit();
    });
}
export async function markLaundryNotificationFailed(notificationId, errorMessage, failedAt = new Date()) {
    await withOracleConnection(async (connection) => {
        await connection.execute(`UPDATE LAUNDRY_NOTIFICATIONS
      SET STATUS = 'failed',
        SENT_AT = :failedAt,
        NOTES = :notes
      WHERE ID = :id`, {
            failedAt,
            notes: errorMessage,
            id: notificationId,
        });
        await connection.commit();
    });
}
export async function cancelPendingLaundryNotifications(reason = "Cancelled by manual completion.", cancelledAt = new Date()) {
    await withOracleConnection(async (connection) => {
        await connection.execute(`UPDATE LAUNDRY_NOTIFICATIONS
      SET STATUS = 'failed',
        SENT_AT = :cancelledAt,
        NOTES = :notes
      WHERE STATUS = 'pending'`, {
            cancelledAt,
            notes: reason,
        });
        await connection.commit();
    });
}
export function formatLaundryTimestamp(value) {
    if (!value) {
        return "Not set";
    }
    return DateTime.fromJSDate(value).toLocal().toLocaleString(DateTime.DATETIME_MED);
}
export function formatLaundryTime(value) {
    if (!value) {
        return "Not set";
    }
    return DateTime.fromJSDate(value).toLocal().toLocaleString(DateTime.TIME_SIMPLE);
}
export function estimateDoneAt(startedAt) {
    if (!startedAt) {
        return null;
    }
    return DateTime.fromJSDate(startedAt)
        .plus({ minutes: LOAD_DURATION_MINUTES })
        .toJSDate();
}
export function buildLaundrySummary(row) {
    if (!row) {
        return {
            statusLine: "No laundry status recorded yet.",
            estimatedFreeBy: "Not available",
            lastUpdated: "Not available",
            updatedByName: "Unknown",
            updatedByUserId: null,
            lastUpdatedDate: null,
            estimatedFreeByDate: null,
            statusKey: "unknown",
        };
    }
    const latestUpdated = row.UPDATED_AT ?? null;
    const updatedByName = row.UPDATED_BY_NAME ?? "Unknown";
    const updatedByUserId = row.UPDATED_BY_USER_ID ?? null;
    if (row.STATUS === "maintenance") {
        return {
            statusLine: "Laundry is unavailable (maintenance).",
            estimatedFreeBy: "Not available",
            lastUpdated: formatLaundryTime(latestUpdated),
            updatedByName,
            updatedByUserId,
            lastUpdatedDate: latestUpdated,
            estimatedFreeByDate: null,
            statusKey: "maintenance",
        };
    }
    if (row.STATUS !== "in_use") {
        return {
            statusLine: "",
            estimatedFreeBy: "Now",
            lastUpdated: formatLaundryTime(latestUpdated),
            updatedByName,
            updatedByUserId,
            lastUpdatedDate: latestUpdated,
            estimatedFreeByDate: null,
            statusKey: "available",
        };
    }
    const estimatedFreeByDate = row.EXPECTED_DONE_AT ?? estimateDoneAt(row.STARTED_AT);
    const estimatedFreeBy = estimatedFreeByDate
        ? formatLaundryTime(estimatedFreeByDate)
        : "Not available";
    return {
        statusLine: estimatedFreeByDate
            ? `Current wash/dry cycle should be complete by ${estimatedFreeBy}.`
            : "Current wash/dry cycle is in progress.",
        estimatedFreeBy,
        lastUpdated: formatLaundryTime(latestUpdated),
        updatedByName,
        updatedByUserId,
        lastUpdatedDate: latestUpdated,
        estimatedFreeByDate,
        statusKey: "busy",
    };
}
