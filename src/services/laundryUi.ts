import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import path from "node:path";
import { DateTime } from "luxon";
import type { LaundryHelpRequestRow } from "../db/laundryHelp.js";
import {
  formatHelpRequests,
  getHelpRequestLabel,
  HELP_REQUEST_OPTIONS,
} from "../db/laundryHelp.js";
import type { LaundryStatusRow } from "../db/laundryStatus.js";
import { buildLaundrySummary } from "../db/laundryStatus.js";

const LAUNDRY_BUTTON_ID = "laundry_flip";
const HELP_BUTTON_ID = "laundry_help";
const HELP_SELECT_ID = "laundry_help_select";
const HELP_DONE_BUTTON_ID = "laundry_help_done";
const HELP_DONE_SELECT_ID = "laundry_help_done_select";
const COMPLETE_BUTTON_ID = "laundry_complete";
const IN_PROGRESS_BANNER = "laundry_in_progress_banner.png";
const AVAILABLE_BANNER = "laundry_is_available_banner.png";

export function buildLaundryComponents(
  row: LaundryStatusRow | null,
  helpRequests: LaundryHelpRequestRow[],
): ActionRowBuilder<ButtonBuilder>[] {
  const summary = buildLaundrySummary(row);
  const buttons: ButtonBuilder[] = [];

  if (summary.statusKey !== "busy") {
    buttons.push(new ButtonBuilder()
    .setCustomId(LAUNDRY_BUTTON_ID)
    .setLabel("I Flipped It")
    .setStyle(ButtonStyle.Primary));
  }

  if (summary.statusKey === "busy") {
    buttons.push(new ButtonBuilder()
      .setCustomId(COMPLETE_BUTTON_ID)
      .setLabel("Mark Laundry Completed")
      .setStyle(ButtonStyle.Secondary));
  }

  buttons.push(new ButtonBuilder()
    .setCustomId(HELP_BUTTON_ID)
    .setLabel("Request Help")
    .setStyle(ButtonStyle.Secondary));

  if (helpRequests.length) {
    buttons.push(new ButtonBuilder()
      .setCustomId(HELP_DONE_BUTTON_ID)
      .setLabel("I Helped")
      .setStyle(ButtonStyle.Secondary));
  }

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)];
}

export function buildLaundryEmbedPayload(
  row: LaundryStatusRow | null,
  helpRequests: LaundryHelpRequestRow[],
): { embed: EmbedBuilder; files: AttachmentBuilder[] } {
  const summary = buildLaundrySummary(row);
  const helpRequestText = formatHelpRequests(helpRequests);
  const footerTime = buildFooterTime(summary.lastUpdatedDate, summary.lastUpdated);
  const isUnknownUpdater = summary.updatedByName === "Unknown";
  const footerText = summary.lastUpdated === "Not available"
    ? "Last updated"
    : isUnknownUpdater
      ? `Last updated at ${footerTime}`
      : `Last updated at ${footerTime} by ${summary.updatedByName}.`;
  const bannerFilename = summary.statusKey === "busy"
    ? IN_PROGRESS_BANNER
    : summary.statusKey === "available"
      ? AVAILABLE_BANNER
      : null;
  const files = bannerFilename
    ? [new AttachmentBuilder(path.resolve("src/assets/images", bannerFilename), {
      name: bannerFilename,
    })]
    : [];
  const embed = new EmbedBuilder()
    .setFooter({
      text: footerText,
    });

  if (summary.statusKey === "available") {
    embed.setDescription(
      "Is there laundry to do? Get it started and click the \"I Flipped It\" button or ask for help using the \"Request Help\" button.\n\n",
    );
  }

  if (summary.statusLine) {
    const existing = embed.data.description ?? "";
    const joined = existing ? `${existing}${summary.statusLine}` : summary.statusLine;
    embed.setDescription(joined);
  }

  if (helpRequests.length) {
    embed.addFields({ name: "Help Requests", value: helpRequestText, inline: false });
  }

  return { embed, files };
}

function buildFooterTime(lastUpdatedDate: Date | null, lastUpdatedTime: string): string {
  if (!lastUpdatedDate || lastUpdatedTime === "Not available") {
    return lastUpdatedTime;
  }

  const localDate = DateTime.fromJSDate(lastUpdatedDate).toLocal();
  const isToday = localDate.hasSame(DateTime.local(), "day");
  if (isToday) {
    return lastUpdatedTime;
  }

  const dateLabel = localDate.toLocaleString(DateTime.DATE_MED);
  return `${dateLabel} ${lastUpdatedTime}`;
}

export function getLaundryButtonId(): string {
  return LAUNDRY_BUTTON_ID;
}

export function getHelpButtonId(): string {
  return HELP_BUTTON_ID;
}

export function getHelpDoneButtonId(): string {
  return HELP_DONE_BUTTON_ID;
}

export function getCompleteButtonId(): string {
  return COMPLETE_BUTTON_ID;
}

export function getHelpSelectId(messageId: string): string {
  return `${HELP_SELECT_ID}:${messageId}`;
}

export function parseHelpSelectId(customId: string): string | null {
  const [prefix, messageId] = customId.split(":");
  if (prefix !== HELP_SELECT_ID || !messageId) {
    return null;
  }

  return messageId;
}

export function getHelpDoneSelectId(messageId: string): string {
  return `${HELP_DONE_SELECT_ID}:${messageId}`;
}

export function parseHelpDoneSelectId(customId: string): string | null {
  const [prefix, messageId] = customId.split(":");
  if (prefix !== HELP_DONE_SELECT_ID || !messageId) {
    return null;
  }

  return messageId;
}

export function buildHelpSelectMenu(
  messageId: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(getHelpSelectId(messageId))
    .setPlaceholder("Choose one or more tasks")
    .setMinValues(1)
    .setMaxValues(HELP_REQUEST_OPTIONS.length)
    .addOptions(Array.from(HELP_REQUEST_OPTIONS));

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

export function buildHelpDoneSelectMenu(
  messageId: string,
  helpRequests: LaundryHelpRequestRow[],
): ActionRowBuilder<StringSelectMenuBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(getHelpDoneSelectId(messageId))
    .setPlaceholder("Select help requests you completed")
    .setMinValues(1)
    .setMaxValues(helpRequests.length)
    .addOptions(
      helpRequests.map((request) => ({
        label: `${request.USER_NAME}: ${getHelpRequestLabel(request.REQUEST_TYPE)}`,
        value: String(request.ID),
      })),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}
