import { getActiveHelpRequests } from "../db/laundryHelp.js";
import { getLaundryStatus, getPendingLaundryNotifications, markLaundryCompleted, markLaundryNotificationFailed, markLaundryNotificationSent, } from "../db/laundryStatus.js";
import { deleteRecentLaundryMessage, sendLaundryStatusMessage } from "./laundryMessages.js";
import { updateLaundryPresence } from "./laundryPresence.js";
const POLL_INTERVAL_MS = 15_000;
export function startLaundryNotificationPoller(client) {
    return setInterval(() => {
        void processLaundryNotifications(client);
    }, POLL_INTERVAL_MS);
}
export async function processLaundryNotifications(client) {
    const pending = await getPendingLaundryNotifications();
    for (const notification of pending) {
        try {
            const channel = await client.channels.fetch(notification.CHANNEL_ID);
            if (!channel || !channel.isTextBased() || !("send" in channel)) {
                await markLaundryNotificationFailed(notification.ID, "Channel not found or not text-based.");
                continue;
            }
            await markLaundryCompleted();
            const statusRow = await getLaundryStatus();
            const helpRequests = await getActiveHelpRequests();
            await deleteRecentLaundryMessage(channel, client.user?.id);
            await sendLaundryStatusMessage(channel, statusRow, helpRequests, "Laundry cycle has been completed!");
            await markLaundryNotificationSent(notification.ID);
            await updateLaundryPresence(client);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            await markLaundryNotificationFailed(notification.ID, message);
        }
    }
}
