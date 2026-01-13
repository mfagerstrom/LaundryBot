import { Client } from "discordx";
import { getActiveHelpRequests } from "../db/laundryHelp.js";
import {
  getLaundryStatus,
  getPendingLaundryNotifications,
  markLaundryCompleted,
  markLaundryNotificationFailed,
  markLaundryNotificationSent,
} from "../db/laundryStatus.js";
import { buildLaundryComponents, buildLaundryEmbedPayload } from "./laundryUi.js";
import { updateLaundryPresence } from "./laundryPresence.js";

const POLL_INTERVAL_MS = 15_000;

export function startLaundryNotificationPoller(client: Client): NodeJS.Timeout {
  return setInterval(() => {
    void processLaundryNotifications(client);
  }, POLL_INTERVAL_MS);
}

export async function processLaundryNotifications(client: Client): Promise<void> {
  const pending = await getPendingLaundryNotifications();

  for (const notification of pending) {
    try {
      const channel = await client.channels.fetch(notification.CHANNEL_ID);
      if (!channel || !channel.isTextBased() || !("send" in channel)) {
        await markLaundryNotificationFailed(
          notification.ID,
          "Channel not found or not text-based.",
        );
        continue;
      }

      await markLaundryCompleted();
      const statusRow = await getLaundryStatus();
      const helpRequests = await getActiveHelpRequests();
      const { embeds, files } = buildLaundryEmbedPayload(statusRow, helpRequests);
      const components = buildLaundryComponents(statusRow, helpRequests);

      await channel.send({
        content: "Laundry cycle has completed!",
        embeds,
        components,
        files,
      });
      await markLaundryNotificationSent(notification.ID);
      await updateLaundryPresence(client);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await markLaundryNotificationFailed(notification.ID, message);
    }
  }
}
