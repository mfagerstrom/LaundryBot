import {
  ButtonInteraction,
  CommandInteraction,
  MessageFlags,
  StringSelectMenuInteraction,
} from "discord.js";
import { ButtonComponent, Discord, SelectMenuComponent, Slash } from "discordx";
import {
  createHelpRequests,
  getActiveHelpRequests,
  getHelpRequestLabel,
  resolveHelpRequests,
} from "../db/laundryHelp.js";
import {
  cancelPendingLaundryNotifications,
  formatLaundryTimestamp,
  getLaundryStatus,
  markLaundryCompleted,
  markLaundryStarted,
} from "../db/laundryStatus.js";
import { deleteRecentLaundryMessage, sendLaundryStatusMessage } from "../services/laundryMessages.js";
import { updateLaundryPresence } from "../services/laundryPresence.js";
import {
  buildHelpSelectMenu,
  buildHelpDoneSelectMenu,
  buildLaundryComponents,
  buildLaundryEmbedPayload,
  getHelpButtonId,
  getHelpDoneButtonId,
  getCompleteButtonId,
  getLaundryButtonId,
  parseHelpDoneSelectId,
  parseHelpSelectId,
} from "../services/laundryUi.js";

const LAUNDRY_CHANNEL_ID = "1311001731936550952";
const LAUNDRY_BUTTON_ID = getLaundryButtonId();
const HELP_BUTTON_ID = getHelpButtonId();
const HELP_DONE_BUTTON_ID = getHelpDoneButtonId();
const COMPLETE_BUTTON_ID = getCompleteButtonId();

@Discord()
export class LaundryCommand {
  @Slash({
    name: "laundry",
    description: "Show the LaundryBot menu and current Fagerteam laundry status.",
  })
  async laundry(interaction: CommandInteraction): Promise<void> {
    try {
      await interaction.deferReply();
    } catch (error) {
      const errorCode = error instanceof Error ? (error as { code?: number }).code : undefined;
      if (errorCode === 10062) {
        return;
      }

      throw error;
    }

    const statusRow = await getLaundryStatus();
    const helpRequests = await getActiveHelpRequests();
    const { embed, files } = buildLaundryEmbedPayload(statusRow, helpRequests);
    const components = buildLaundryComponents(statusRow, helpRequests);

    await interaction.editReply({ embeds: [embed], components, files });
    await updateLaundryPresence(interaction.client);
  }

  @ButtonComponent({ id: LAUNDRY_BUTTON_ID })
  async flipLaundry(interaction: ButtonInteraction): Promise<void> {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (error) {
      const errorCode = error instanceof Error ? (error as { code?: number }).code : undefined;
      if (errorCode === 10062) {
        return;
      }

      throw error;
    }

    const userId = interaction.user.id;
    const userName = interaction.user.username;
    const { expectedDoneAt } = await markLaundryStarted(
      userId,
      userName,
      LAUNDRY_CHANNEL_ID,
    );
    const updatedStatus = await getLaundryStatus();
    const helpRequests = await getActiveHelpRequests();
    const channel = interaction.channel ?? interaction.message.channel;
    await deleteRecentLaundryMessage(channel, interaction.client.user?.id);
    await sendLaundryStatusMessage(
      channel,
      updatedStatus,
      helpRequests,
      `${userName} flipped the laundry!`,
    );
    await updateLaundryPresence(interaction.client);
    await interaction.editReply({
      content: `Laundry started. Estimated done: ${formatLaundryTimestamp(expectedDoneAt)}.`,
    });
  }

  @ButtonComponent({ id: HELP_BUTTON_ID })
  async requestHelp(interaction: ButtonInteraction): Promise<void> {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (error) {
      const errorCode = error instanceof Error ? (error as { code?: number }).code : undefined;
      if (errorCode === 10062) {
        return;
      }

      throw error;
    }

    const messageId = interaction.message.id;
    const menuRow = buildHelpSelectMenu(messageId);

    await interaction.editReply({
      content: "What do you need help with?",
      components: [menuRow],
    });
  }

  @ButtonComponent({ id: HELP_DONE_BUTTON_ID })
  async markHelped(interaction: ButtonInteraction): Promise<void> {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (error) {
      const errorCode = error instanceof Error ? (error as { code?: number }).code : undefined;
      if (errorCode === 10062) {
        return;
      }

      throw error;
    }

    const helpRequests = await getActiveHelpRequests();
    if (!helpRequests.length) {
      await interaction.editReply({ content: "No active help requests right now." });
      return;
    }

    const messageId = interaction.message.id;
    const menuRow = buildHelpDoneSelectMenu(messageId, helpRequests);

    await interaction.editReply({
      content: "Select the help requests you completed.",
      components: [menuRow],
    });
  }

  @ButtonComponent({ id: COMPLETE_BUTTON_ID })
  async markLaundryDone(interaction: ButtonInteraction): Promise<void> {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (error) {
      const errorCode = error instanceof Error ? (error as { code?: number }).code : undefined;
      if (errorCode === 10062) {
        return;
      }

      throw error;
    }

    await markLaundryCompleted(interaction.user.username);
    await cancelPendingLaundryNotifications();
    const statusRow = await getLaundryStatus();
    const helpRequests = await getActiveHelpRequests();
    const channel = interaction.channel ?? interaction.message.channel;
    await deleteRecentLaundryMessage(channel, interaction.client.user?.id);
    await sendLaundryStatusMessage(
      channel,
      statusRow,
      helpRequests,
      "Laundry cycle has been completed!",
    );
    await updateLaundryPresence(interaction.client);
    await interaction.editReply({ content: "Laundry marked as completed." });
  }

  @SelectMenuComponent({ id: /laundry_help_select:.+/ })
  async submitHelpRequest(interaction: StringSelectMenuInteraction): Promise<void> {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (error) {
      const errorCode = error instanceof Error ? (error as { code?: number }).code : undefined;
      if (errorCode === 10062) {
        return;
      }

      throw error;
    }

    const messageId = parseHelpSelectId(interaction.customId);
    const userId = interaction.user.id;
    const userName = interaction.user.username;

    await createHelpRequests(userId, userName, interaction.values);

    if (messageId && interaction.channel) {
      const statusRow = await getLaundryStatus();
      const helpRequests = await getActiveHelpRequests();
      await deleteRecentLaundryMessage(interaction.channel, interaction.client.user?.id);
      await sendLaundryStatusMessage(
        interaction.channel,
        statusRow,
        helpRequests,
        `${userName} requested help! See details below.`,
      );
      await updateLaundryPresence(interaction.client);
    }

    await interaction.editReply({
      content: "Thanks! Your help request has been posted.",
      components: [],
    });
  }

  @SelectMenuComponent({ id: /laundry_help_done_select:.+/ })
  async submitHelpCompletion(interaction: StringSelectMenuInteraction): Promise<void> {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (error) {
      const errorCode = error instanceof Error ? (error as { code?: number }).code : undefined;
      if (errorCode === 10062) {
        return;
      }

      throw error;
    }

    const messageId = parseHelpDoneSelectId(interaction.customId);
    const requestIds = interaction.values.map((value) => Number(value))
      .filter((value) => !Number.isNaN(value));

    const existingRequests = await getActiveHelpRequests();
    const completedLabels = existingRequests
      .filter((request) => requestIds.includes(request.ID))
      .map((request) => getHelpRequestLabel(request.REQUEST_TYPE));
    await resolveHelpRequests(requestIds);

    if (messageId && interaction.channel) {
      const statusRow = await getLaundryStatus();
      const helpRequests = await getActiveHelpRequests();
      if (completedLabels.length) {
        await deleteRecentLaundryMessage(interaction.channel, interaction.client.user?.id);
        await sendLaundryStatusMessage(
          interaction.channel,
          statusRow,
          helpRequests,
          `${interaction.user.username} helped by completing: ${completedLabels.join(", ")}`,
        );
      }
      await updateLaundryPresence(interaction.client);
    }

    await interaction.editReply({
      content: "Thanks! Marked those requests as completed.",
      components: [],
    });
  }
}
