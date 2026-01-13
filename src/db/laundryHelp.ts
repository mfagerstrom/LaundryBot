import oracledb from "oracledb";
import { withOracleConnection } from "./oracle.js";

export const HELP_REQUEST_OPTIONS = [
  { label: "Bringing Dirty Clothes Downstairs", value: "bringing_dirty_clothes" },
  { label: "Bringing Clean Clothes Upstairs", value: "bringing_clean_clothes" },
  { label: "Distributing Clean Clothes", value: "distributing_clean_clothes" },
  { label: "Folding", value: "folding" },
  { label: "Flipping Laundry", value: "flipping_laundry" },
  { label: "Prompting the kids to put away clothes", value: "prompting_kids" },
] as const;

const HELP_LABELS = new Map<string, string>(
  HELP_REQUEST_OPTIONS.map((option) => [option.value, option.label]),
);

export interface LaundryHelpRequestRow {
  ID: number;
  USER_NAME: string;
  REQUEST_TYPE: string;
  CREATED_AT: Date;
}

export async function createHelpRequests(
  userId: string,
  userName: string,
  requestTypes: string[],
): Promise<void> {
  if (!requestTypes.length) {
    return;
  }

  await withOracleConnection(async (connection) => {
    for (const requestType of requestTypes) {
      await connection.execute(
        `INSERT INTO LAUNDRY_HELP_REQUESTS (
          USER_ID,
          USER_NAME,
          REQUEST_TYPE,
          STATUS,
          CREATED_AT
        ) VALUES (
          :userId,
          :userName,
          :requestType,
          'active',
          :createdAt
        )`,
        {
          userId,
          userName,
          requestType,
          createdAt: new Date(),
        },
      );
    }

    await connection.commit();
  });
}

export async function getActiveHelpRequests(): Promise<LaundryHelpRequestRow[]> {
  return withOracleConnection(async (connection) => {
    const result = await connection.execute<LaundryHelpRequestRow>(
      `SELECT
        ID,
        USER_NAME,
        REQUEST_TYPE,
        CREATED_AT
      FROM LAUNDRY_HELP_REQUESTS
      WHERE STATUS = 'active'
      ORDER BY CREATED_AT`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    return result.rows ?? [];
  });
}

export function getHelpRequestLabel(requestType: string): string {
  return HELP_LABELS.get(requestType) ?? requestType;
}

export function formatHelpRequests(rows: LaundryHelpRequestRow[]): string {
  if (!rows.length) {
    return "None";
  }

  const grouped = new Map<string, string[]>();

  for (const row of rows) {
    const label = getHelpRequestLabel(row.REQUEST_TYPE);
    const existing = grouped.get(row.USER_NAME) ?? [];
    existing.push(label);
    grouped.set(row.USER_NAME, existing);
  }

  return Array.from(grouped.entries())
    .map(([userName, requests]) => `${userName} asked for help with: ${requests.join(", ")}`)
    .join("\n");
}

export async function resolveHelpRequests(
  requestIds: number[],
  resolvedAt = new Date(),
): Promise<void> {
  if (!requestIds.length) {
    return;
  }

  await withOracleConnection(async (connection) => {
    await connection.execute(
      `UPDATE LAUNDRY_HELP_REQUESTS
      SET STATUS = 'resolved',
        RESOLVED_AT = :resolvedAt
      WHERE STATUS = 'active'
        AND ID IN (${requestIds.map((_, index) => `:id${index}`).join(", ")})`,
      {
        resolvedAt,
        ...Object.fromEntries(requestIds.map((id, index) => [`id${index}`, id])),
      },
    );

    await connection.commit();
  });
}
