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
  resolveHelpRequests,
} from "../db/laundryHelp.js";
import {
  formatLaundryTimestamp,
  getLaundryStatus,
  markLaundryCompleted,
  markLaundryStarted,
} from "../db/laundryStatus.js";
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
    const { embeds, files } = buildLaundryEmbedPayload(statusRow, helpRequests);
    const components = buildLaundryComponents(statusRow, helpRequests);

    await interaction.editReply({ embeds, components, files });
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
    const { embeds, files } = buildLaundryEmbedPayload(updatedStatus, helpRequests);
    const components = buildLaundryComponents(updatedStatus, helpRequests);

    await interaction.message.edit({ embeds, components, files });
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
    const statusRow = await getLaundryStatus();
    const helpRequests = await getActiveHelpRequests();
    const { embeds, files } = buildLaundryEmbedPayload(statusRow, helpRequests);
    const components = buildLaundryComponents(statusRow, helpRequests);

    await interaction.message.edit({ embeds, components, files });
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
      const message = await interaction.channel.messages.fetch(messageId);
      const statusRow = await getLaundryStatus();
      const helpRequests = await getActiveHelpRequests();
      const { embeds, files } = buildLaundryEmbedPayload(statusRow, helpRequests);
      const components = buildLaundryComponents(statusRow, helpRequests);

      await message.edit({ embeds, components, files });
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

    await resolveHelpRequests(requestIds);

    if (messageId && interaction.channel) {
      const message = await interaction.channel.messages.fetch(messageId);
      const statusRow = await getLaundryStatus();
      const helpRequests = await getActiveHelpRequests();
      const { embeds, files } = buildLaundryEmbedPayload(statusRow, helpRequests);
      const components = buildLaundryComponents(statusRow, helpRequests);

      await message.edit({ embeds, components, files });
      await updateLaundryPresence(interaction.client);
    }

    await interaction.editReply({
      content: "Thanks! Marked those requests as completed.",
      components: [],
    });
  }
}
