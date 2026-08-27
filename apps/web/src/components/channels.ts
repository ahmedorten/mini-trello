import type { InteractionChannel, InteractionDeliveryStatus } from '@/api/customers';
import type { IconName } from './icons';

/** One icon per InteractionChannel. Typed as a full Record so a ninth channel
 *  is a compile error here — the same guarantee ICON_PATHS gives icon names. */
export const CHANNEL_ICONS: Record<InteractionChannel, IconName> = {
  EMAIL: 'mail',
  WHATSAPP: 'message-circle',
  CHAT: 'communication',
  SMS: 'smartphone',
  WEB_FORM: 'clipboard',
  PHONE: 'phone',
  MEETING: 'users',
  OTHER: 'info',
};

/** Badge tone per delivery status. FAILED is the only one that must stand out;
 *  LOGGED is shown too, because hiding the common value trains the eye to
 *  ignore the badge entirely. */
export const DELIVERY_TONES: Record<
  InteractionDeliveryStatus,
  'neutral' | 'info' | 'ok' | 'warn' | 'error'
> = {
  LOGGED: 'neutral',
  RECEIVED: 'info',
  QUEUED: 'warn',
  SENT: 'ok',
  FAILED: 'error',
};
