import { InteractionChannel } from '@prisma/client';

/**
 * The communication abstraction this project actually has. There is NO outbound
 * provider anywhere in work items 1–5 (Product rule 1): "responding through a
 * channel" means logging a CustomerInteraction with direction OUTBOUND.
 *
 * `canRespond`        — the workspace offers a Respond composer for this channel.
 * `isRealtime`        — the channel is conversational rather than logged-after-the-fact.
 *                       Drives ordering hints in the UI, nothing else.
 * `providerConfigured`— an external sender is wired up. FALSE for every channel
 *                       today; this is the seam a future work item flips.
 */
export interface ChannelDescriptor {
  key: InteractionChannel;
  canRespond: boolean;
  isRealtime: boolean;
  providerConfigured: boolean;
}

export const CHANNEL_REGISTRY: Record<InteractionChannel, ChannelDescriptor> = {
  [InteractionChannel.EMAIL]: {
    key: InteractionChannel.EMAIL,
    canRespond: true,
    isRealtime: false,
    providerConfigured: false,
  },
  [InteractionChannel.WHATSAPP]: {
    key: InteractionChannel.WHATSAPP,
    canRespond: true,
    isRealtime: true,
    providerConfigured: false,
  },
  [InteractionChannel.CHAT]: {
    key: InteractionChannel.CHAT,
    canRespond: true,
    isRealtime: true,
    providerConfigured: false,
  },
  [InteractionChannel.SMS]: {
    key: InteractionChannel.SMS,
    canRespond: true,
    isRealtime: false,
    providerConfigured: false,
  },
  [InteractionChannel.WEB_FORM]: {
    key: InteractionChannel.WEB_FORM,
    canRespond: true,
    isRealtime: false,
    providerConfigured: false,
  },
  [InteractionChannel.PHONE]: {
    key: InteractionChannel.PHONE,
    canRespond: false,
    isRealtime: true,
    providerConfigured: false,
  },
  [InteractionChannel.MEETING]: {
    key: InteractionChannel.MEETING,
    canRespond: false,
    isRealtime: false,
    providerConfigured: false,
  },
  [InteractionChannel.OTHER]: {
    key: InteractionChannel.OTHER,
    canRespond: true,
    isRealtime: false,
    providerConfigured: false,
  },
};

/** Display order for the frontend's channel filter and picker. */
export const CHANNEL_ORDER: InteractionChannel[] = [
  InteractionChannel.EMAIL,
  InteractionChannel.WHATSAPP,
  InteractionChannel.CHAT,
  InteractionChannel.SMS,
  InteractionChannel.WEB_FORM,
  InteractionChannel.PHONE,
  InteractionChannel.MEETING,
  InteractionChannel.OTHER,
];
