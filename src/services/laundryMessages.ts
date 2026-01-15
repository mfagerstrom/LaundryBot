import { MessageFlags, type TextBasedChannel } from "discord.js";
import type { LaundryHelpRequestRow } from "../db/laundryHelp.js";
import type { LaundryStatusRow } from "../db/laundryStatus.js";
import { buildLaundryComponents, buildLaundryDisplayPayload } from "./laundryUi.js";

const LAUNDRY_COMPONENT_IDS = new Set([
  "laundry_flip",
  "laundry_help",
  "laundry_help_done",
  "laundry_complete",
]);

export async function deleteRecentLaundryMessage(
  channel: TextBasedChannel,
  botUserId?: string,
): Promise<void> {
  const messages = await channel.messages.fetch({ limit: 15 });
  const target = messages.find((message) => {
    if (botUserId && message.author.id !== botUserId) {
      return false;
    }

    if (!botUserId && !message.author.bot) {
      return false;
    }

    return messageHasLaundryComponents(message);
  });

  if (target) {
    await target.delete();
  }
}

export async function sendLaundryStatusMessage(
  channel: TextBasedChannel,
  statusRow: LaundryStatusRow | null,
  helpRequests: LaundryHelpRequestRow[],
  contentPrefix?: string,
): Promise<void> {
  if (!("send" in channel)) {
    return;
  }

  const { components: displayComponents, files } = buildLaundryDisplayPayload(
    statusRow,
    helpRequests,
    contentPrefix,
  );
  const components = buildLaundryComponents(statusRow, helpRequests);

  await channel.send({
    components: [...displayComponents, ...components],
    files,
    flags: MessageFlags.IsComponentsV2,
  });
}

function messageHasLaundryComponents(message: { components?: unknown[] }): boolean {
  if (!message.components?.length) {
    return false;
  }

  return message.components.some((row) => {
    const rowComponents = (row as { components?: unknown[] }).components ?? [];
    return rowComponents.some((component) => {
      const customId = (component as { customId?: string }).customId;
      return typeof customId === "string" && LAUNDRY_COMPONENT_IDS.has(customId);
    });
  });
}
