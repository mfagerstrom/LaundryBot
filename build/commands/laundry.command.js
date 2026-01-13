var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ButtonInteraction, CommandInteraction, MessageFlags, StringSelectMenuInteraction, } from "discord.js";
import { ButtonComponent, Discord, SelectMenuComponent, Slash } from "discordx";
import { createHelpRequests, getActiveHelpRequests, resolveHelpRequests, } from "../db/laundryHelp.js";
import { formatLaundryTimestamp, getLaundryStatus, markLaundryCompleted, markLaundryStarted, } from "../db/laundryStatus.js";
import { updateLaundryPresence } from "../services/laundryPresence.js";
import { buildHelpSelectMenu, buildHelpDoneSelectMenu, buildLaundryComponents, buildLaundryEmbedPayload, getHelpButtonId, getHelpDoneButtonId, getCompleteButtonId, getLaundryButtonId, parseHelpDoneSelectId, parseHelpSelectId, } from "../services/laundryUi.js";
const LAUNDRY_CHANNEL_ID = "1311001731936550952";
const LAUNDRY_BUTTON_ID = getLaundryButtonId();
const HELP_BUTTON_ID = getHelpButtonId();
const HELP_DONE_BUTTON_ID = getHelpDoneButtonId();
const COMPLETE_BUTTON_ID = getCompleteButtonId();
let LaundryCommand = class LaundryCommand {
    async laundry(interaction) {
        try {
            await interaction.deferReply();
        }
        catch (error) {
            const errorCode = error instanceof Error ? error.code : undefined;
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
    async flipLaundry(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        catch (error) {
            const errorCode = error instanceof Error ? error.code : undefined;
            if (errorCode === 10062) {
                return;
            }
            throw error;
        }
        const userId = interaction.user.id;
        const userName = interaction.user.username;
        const { expectedDoneAt } = await markLaundryStarted(userId, userName, LAUNDRY_CHANNEL_ID);
        const updatedStatus = await getLaundryStatus();
        const helpRequests = await getActiveHelpRequests();
        const { embed, files } = buildLaundryEmbedPayload(updatedStatus, helpRequests);
        const components = buildLaundryComponents(updatedStatus, helpRequests);
        await interaction.message.edit({ embeds: [embed], components, files });
        await updateLaundryPresence(interaction.client);
        await interaction.editReply({
            content: `Laundry started. Estimated done: ${formatLaundryTimestamp(expectedDoneAt)}.`,
        });
    }
    async requestHelp(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        catch (error) {
            const errorCode = error instanceof Error ? error.code : undefined;
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
    async markHelped(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        catch (error) {
            const errorCode = error instanceof Error ? error.code : undefined;
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
    async markLaundryDone(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        catch (error) {
            const errorCode = error instanceof Error ? error.code : undefined;
            if (errorCode === 10062) {
                return;
            }
            throw error;
        }
        await markLaundryCompleted(interaction.user.username);
        const statusRow = await getLaundryStatus();
        const helpRequests = await getActiveHelpRequests();
        const { embed, files } = buildLaundryEmbedPayload(statusRow, helpRequests);
        const components = buildLaundryComponents(statusRow, helpRequests);
        await interaction.message.edit({ embeds: [embed], components, files });
        await updateLaundryPresence(interaction.client);
        await interaction.editReply({ content: "Laundry marked as completed." });
    }
    async submitHelpRequest(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        catch (error) {
            const errorCode = error instanceof Error ? error.code : undefined;
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
            const { embed, files } = buildLaundryEmbedPayload(statusRow, helpRequests);
            const components = buildLaundryComponents(statusRow, helpRequests);
            await message.edit({ embeds: [embed], components, files });
            await updateLaundryPresence(interaction.client);
        }
        await interaction.editReply({
            content: "Thanks! Your help request has been posted.",
            components: [],
        });
    }
    async submitHelpCompletion(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        catch (error) {
            const errorCode = error instanceof Error ? error.code : undefined;
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
            const { embed, files } = buildLaundryEmbedPayload(statusRow, helpRequests);
            const components = buildLaundryComponents(statusRow, helpRequests);
            await message.edit({ embeds: [embed], components, files });
            await updateLaundryPresence(interaction.client);
        }
        await interaction.editReply({
            content: "Thanks! Marked those requests as completed.",
            components: [],
        });
    }
};
__decorate([
    Slash({
        name: "laundry",
        description: "Show the LaundryBot menu and current Fagerteam laundry status.",
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CommandInteraction]),
    __metadata("design:returntype", Promise)
], LaundryCommand.prototype, "laundry", null);
__decorate([
    ButtonComponent({ id: LAUNDRY_BUTTON_ID }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ButtonInteraction]),
    __metadata("design:returntype", Promise)
], LaundryCommand.prototype, "flipLaundry", null);
__decorate([
    ButtonComponent({ id: HELP_BUTTON_ID }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ButtonInteraction]),
    __metadata("design:returntype", Promise)
], LaundryCommand.prototype, "requestHelp", null);
__decorate([
    ButtonComponent({ id: HELP_DONE_BUTTON_ID }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ButtonInteraction]),
    __metadata("design:returntype", Promise)
], LaundryCommand.prototype, "markHelped", null);
__decorate([
    ButtonComponent({ id: COMPLETE_BUTTON_ID }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ButtonInteraction]),
    __metadata("design:returntype", Promise)
], LaundryCommand.prototype, "markLaundryDone", null);
__decorate([
    SelectMenuComponent({ id: /laundry_help_select:.+/ }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [StringSelectMenuInteraction]),
    __metadata("design:returntype", Promise)
], LaundryCommand.prototype, "submitHelpRequest", null);
__decorate([
    SelectMenuComponent({ id: /laundry_help_done_select:.+/ }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [StringSelectMenuInteraction]),
    __metadata("design:returntype", Promise)
], LaundryCommand.prototype, "submitHelpCompletion", null);
LaundryCommand = __decorate([
    Discord()
], LaundryCommand);
export { LaundryCommand };
