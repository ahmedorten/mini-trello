import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import ar from './locales/ar.json';
import { LOCALE_DIRECTION, SUPPORTED_LOCALES } from './index';
import { CUSTOMER_STATUSES, CUSTOMER_TYPES, INTERACTION_CHANNELS } from '@/api/customers';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '@/api/tickets';

type MessageTree = { [key: string]: string | MessageTree };

function flatten(tree: MessageTree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();

  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      out.set(path, value);
    } else {
      for (const [nestedKey, nestedValue] of flatten(value, path)) {
        out.set(nestedKey, nestedValue);
      }
    }
  }

  return out;
}

const enFlat = flatten(en);
const arFlat = flatten(ar);

const INTERACTION_DIRECTIONS = ['INBOUND', 'OUTBOUND'] as const;

describe('i18n catalogues', () => {
  it('en and ar declare exactly the same set of keys', () => {
    const enKeys = new Set(enFlat.keys());
    const arKeys = new Set(arFlat.keys());

    const missingFromAr = [...enKeys].filter((key) => !arKeys.has(key));
    const missingFromEn = [...arKeys].filter((key) => !enKeys.has(key));

    expect({ missingFromAr, missingFromEn }).toEqual({ missingFromAr: [], missingFromEn: [] });
  });

  it('no message value is an empty string', () => {
    const emptyInEn = [...enFlat.entries()].filter(([, value]) => value.trim() === '').map(([key]) => key);
    const emptyInAr = [...arFlat.entries()].filter(([, value]) => value.trim() === '').map(([key]) => key);

    expect({ emptyInEn, emptyInAr }).toEqual({ emptyInEn: [], emptyInAr: [] });
  });

  it('has a ticket.status key for every TicketStatus member', () => {
    for (const status of TICKET_STATUSES) {
      expect(enFlat.has(`ticket.status.${status}`)).toBe(true);
      expect(arFlat.has(`ticket.status.${status}`)).toBe(true);
    }
  });

  it('has a ticket.priority key for every TicketPriority member', () => {
    for (const priority of TICKET_PRIORITIES) {
      expect(enFlat.has(`ticket.priority.${priority}`)).toBe(true);
      expect(arFlat.has(`ticket.priority.${priority}`)).toBe(true);
    }
  });

  it('has a ticket.category key for every TicketCategory member', () => {
    for (const category of TICKET_CATEGORIES) {
      expect(enFlat.has(`ticket.category.${category}`)).toBe(true);
      expect(arFlat.has(`ticket.category.${category}`)).toBe(true);
    }
  });

  it('has a customer.status key for every CustomerStatus member', () => {
    for (const status of CUSTOMER_STATUSES) {
      expect(enFlat.has(`customer.status.${status}`)).toBe(true);
      expect(arFlat.has(`customer.status.${status}`)).toBe(true);
    }
  });

  it('has a customer.type key for every CustomerType member', () => {
    for (const type of CUSTOMER_TYPES) {
      expect(enFlat.has(`customer.type.${type}`)).toBe(true);
      expect(arFlat.has(`customer.type.${type}`)).toBe(true);
    }
  });

  it('has an interaction.channel key for every InteractionChannel member', () => {
    for (const channel of INTERACTION_CHANNELS) {
      expect(enFlat.has(`interaction.channel.${channel}`)).toBe(true);
      expect(arFlat.has(`interaction.channel.${channel}`)).toBe(true);
    }
  });

  it('has an interaction.direction key for every InteractionDirection member', () => {
    for (const direction of INTERACTION_DIRECTIONS) {
      expect(enFlat.has(`interaction.direction.${direction}`)).toBe(true);
      expect(arFlat.has(`interaction.direction.${direction}`)).toBe(true);
    }
  });

  it('presents CHAT as Live Chat in en (Story 17 product rule 1)', () => {
    expect(enFlat.get('interaction.channel.CHAT')).toBe('Live Chat');
  });

  it('LOCALE_DIRECTION covers every SUPPORTED_LOCALES entry and maps ar to rtl', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_DIRECTION[locale]).toBeDefined();
    }

    expect(LOCALE_DIRECTION.ar).toBe('rtl');
    expect(LOCALE_DIRECTION.en).toBe('ltr');
  });
});
