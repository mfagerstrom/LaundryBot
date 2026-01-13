import { buildLaundryComponents, buildLaundryEmbedPayload } from "./laundryUi.js";
const LAUNDRY_COMPONENT_IDS = new Set([
    "laundry_flip",
    "laundry_help",
    "laundry_help_done",
    "laundry_complete",
]);
export async function deleteRecentLaundryMessage(channel, botUserId) {
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
export async function sendLaundryStatusMessage(channel, statusRow, helpRequests, contentPrefix) {
    if (!("send" in channel)) {
        return;
    }
    const { embed, files } = buildLaundryEmbedPayload(statusRow, helpRequests);
    const components = buildLaundryComponents(statusRow, helpRequests);
    const content = contentPrefix ? `${contentPrefix}` : undefined;
    await channel.send({
        content,
        embeds: [embed],
        components,
        files,
    });
}
function messageHasLaundryComponents(message) {
    if (!message.components?.length) {
        return false;
    }
    return message.components.some((row) => {
        const rowComponents = row.components ?? [];
        return rowComponents.some((component) => {
            const customId = component.customId;
            return typeof customId === "string" && LAUNDRY_COMPONENT_IDS.has(customId);
        });
    });
}
