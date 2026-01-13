import { ActivityType } from "discord.js";
import { DateTime } from "luxon";
import { buildLaundrySummary, getLaundryStatus } from "../db/laundryStatus.js";
const PRESENCE_INTERVAL_MS = 30_000;
let lastPresenceText = "";
export function startLaundryPresencePoller(client) {
    return setInterval(() => {
        void updateLaundryPresence(client);
    }, PRESENCE_INTERVAL_MS);
}
export async function updateLaundryPresence(client) {
    try {
        const statusRow = await getLaundryStatus();
        const summary = buildLaundrySummary(statusRow);
        const presenceText = buildPresenceText(summary.statusKey, summary.estimatedFreeByDate);
        if (!client.user || presenceText === lastPresenceText) {
            return;
        }
        client.user.setPresence({
            activities: [{ name: presenceText, type: ActivityType.Watching }],
            status: "online",
        });
        lastPresenceText = presenceText;
    }
    catch (error) {
        console.error("Failed to update LaundryBot presence.", error);
    }
}
function buildPresenceText(statusKey, estimatedFreeByDate) {
    switch (statusKey) {
        case "available":
            return "Laundry: available";
        case "maintenance":
            return "Laundry: maintenance";
        case "busy": {
            if (!estimatedFreeByDate) {
                return "Laundry: in progress";
            }
            const eta = DateTime.fromJSDate(estimatedFreeByDate)
                .toLocal()
                .toLocaleString(DateTime.TIME_SIMPLE);
            return `Laundry: in progress - ETA ${eta}`;
        }
        default:
            return "Laundry: unknown";
    }
}
