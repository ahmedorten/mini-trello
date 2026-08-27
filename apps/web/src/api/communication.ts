import { apiClient } from './client';
import type { InteractionChannel } from './customers';

/**
 * The communication abstraction this project actually has: there is no
 * outbound provider anywhere in this feature. `canRespond` drives whether the
 * workspace offers a Respond composer for the channel; `providerConfigured`
 * is false for every channel today — the seam a future work item flips.
 * Mirrors ChannelDescriptor in apps/api/src/customers/channel.registry.ts.
 */
export interface ChannelDescriptor {
  key: InteractionChannel;
  canRespond: boolean;
  isRealtime: boolean;
  providerConfigured: boolean;
}

export async function listChannels(): Promise<ChannelDescriptor[]> {
  const response = await apiClient.get<{ items: ChannelDescriptor[] }>('/communication/channels');

  return response.data.items;
}
