import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CustomerStatus,
  InteractionChannel,
  InteractionDeliveryStatus,
  InteractionDirection,
  Prisma,
} from '@prisma/client';
import { CommunicationService } from './communication.service';
import { ChannelRegistryService } from './channel-registry.service';
import { CustomersService } from '../customers/customers.service';
import { InteractionsService } from '../customers/interactions.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ChannelAdapter } from './channels/channel-adapter';

function containing(obj: Record<string, unknown>): unknown {
  return expect.objectContaining(obj);
}

function buildCaller(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'author-1',
    email: 'nour@crm.local',
    fullName: 'Nour Hassan',
    mustChangePassword: false,
    departmentId: null,
    branchId: null,
    roles: ['support-agent'],
    permissions: ['customers:read', 'interactions:write', 'communication:send'],
    ...overrides,
  };
}

/** A hand-rolled adapter whose every call is observable, so the order the
 *  service calls them in is testable. */
function buildAdapter(overrides: Partial<ChannelAdapter> = {}) {
  const calls: string[] = [];

  const adapter = {
    channel: InteractionChannel.EMAIL,
    capabilities: {
      canRespond: true,
      isRealtime: false,
      providerConfigured: false,
      acceptsInbound: true,
      addressKind: 'email' as const,
      requiresAddress: true,
      maxBodyLength: null,
      supportsSubject: true,
    },
    validate: jest.fn(() => {
      calls.push('validate');
    }),
    resolveAddress: jest.fn(() => {
      calls.push('resolveAddress');

      return 'layla@crm.local';
    }),
    resolveSubject: jest.fn(() => {
      calls.push('resolveSubject');

      return 'Following up';
    }),
    threadKey: jest.fn(() => {
      calls.push('threadKey');

      return 'EMAIL:layla@crm.local';
    }),
    dispatch: jest.fn(async () => {
      calls.push('dispatch');

      return {
        status: InteractionDeliveryStatus.LOGGED,
        externalId: null,
        failureReason: null,
        metadata: null,
      };
    }),
    parseInbound: jest.fn(() => ({
      subject: 'Quote request',
      body: 'Please call me.',
      address: 'layla@crm.local',
      externalId: 'provider-1',
      occurredAt: new Date('2026-06-15T11:00:00.000Z'),
      metadata: null,
    })),
    ...overrides,
  };

  return { adapter, calls };
}

describe('CommunicationService', () => {
  let service: CommunicationService;
  let prisma: {
    customer: { findUnique: jest.Mock; findFirst: jest.Mock };
    customerInteraction: { findUnique: jest.Mock };
  };
  let registry: { resolve: jest.Mock };
  let interactions: { create: jest.Mock; findOne: jest.Mock };
  let customersService: { assertExists: jest.Mock };

  beforeEach(() => {
    prisma = {
      customer: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'customer-1',
          email: 'layla@crm.local',
          phone: '+201001234567',
          status: CustomerStatus.ACTIVE,
        }),
        findFirst: jest.fn(),
      },
      customerInteraction: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    registry = { resolve: jest.fn() };
    interactions = {
      create: jest.fn().mockResolvedValue({ id: 'interaction-1' }),
      findOne: jest.fn().mockResolvedValue({ id: 'interaction-existing' }),
    };
    customersService = { assertExists: jest.fn().mockResolvedValue({ id: 'customer-1' }) };

    service = new CommunicationService(
      prisma as unknown as PrismaService,
      registry as unknown as ChannelRegistryService,
      interactions as unknown as InteractionsService,
      customersService as unknown as CustomersService,
    );
  });

  const sendDto = {
    customerId: 'customer-1',
    channel: InteractionChannel.EMAIL,
    body: 'We are on it.',
  };

  describe('send', () => {
    it('rejects a channel that cannot send', async () => {
      const { adapter } = buildAdapter();
      adapter.capabilities = { ...adapter.capabilities, canRespond: false };
      registry.resolve.mockReturnValue(adapter);

      await expect(service.send(sendDto, buildCaller())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(interactions.create).not.toHaveBeenCalled();
    });

    it('404s an unknown customer', async () => {
      registry.resolve.mockReturnValue(buildAdapter().adapter);
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.send(sendDto, buildCaller())).rejects.toBeInstanceOf(NotFoundException);
    });

    it('400s an archived customer (Product rule 7)', async () => {
      registry.resolve.mockReturnValue(buildAdapter().adapter);
      prisma.customer.findUnique.mockResolvedValue({
        id: 'customer-1',
        email: 'layla@crm.local',
        phone: null,
        status: CustomerStatus.ARCHIVED,
      });

      await expect(service.send(sendDto, buildCaller())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(interactions.create).not.toHaveBeenCalled();
    });

    it('calls the adapter in the order validate → resolveAddress → resolveSubject → threadKey → dispatch', async () => {
      const { adapter, calls } = buildAdapter();
      registry.resolve.mockReturnValue(adapter);

      await service.send(sendDto, buildCaller());

      expect(calls).toEqual([
        'validate',
        'resolveAddress',
        'resolveSubject',
        'threadKey',
        'dispatch',
      ]);
    });

    it('passes the adapter-resolved subject, address, threadKey, and status into create', async () => {
      registry.resolve.mockReturnValue(buildAdapter().adapter);

      await service.send(sendDto, buildCaller());

      expect(interactions.create).toHaveBeenCalledWith(
        'customer-1',
        containing({ subject: 'Following up', direction: InteractionDirection.OUTBOUND }),
        containing({ id: 'author-1' }),
        containing({
          deliveryStatus: InteractionDeliveryStatus.LOGGED,
          channelAddress: 'layla@crm.local',
          threadKey: 'EMAIL:layla@crm.local',
          externalId: null,
        }),
      );
    });

    it('always writes OUTBOUND — direction is never a client input', async () => {
      registry.resolve.mockReturnValue(buildAdapter().adapter);

      await service.send(
        { ...sendDto, direction: InteractionDirection.INBOUND } as never,
        buildCaller(),
      );

      expect(interactions.create).toHaveBeenCalledWith(
        'customer-1',
        containing({ direction: InteractionDirection.OUTBOUND }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('defaults occurredAt to now when absent', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
      registry.resolve.mockReturnValue(buildAdapter().adapter);

      await service.send(sendDto, buildCaller());

      expect(interactions.create).toHaveBeenCalledWith(
        'customer-1',
        containing({ occurredAt: '2026-06-15T12:00:00.000Z' }),
        expect.anything(),
        expect.anything(),
      );
      jest.useRealTimers();
    });

    it('persists through InteractionsService, never through prisma directly', async () => {
      registry.resolve.mockReturnValue(buildAdapter().adapter);

      await service.send(sendDto, buildCaller());

      expect(interactions.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('ingest', () => {
    const inboundDto = { body: 'Please call me.', address: 'layla@crm.local' };

    beforeEach(() => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'customer-1' });
    });

    it('rejects a channel that does not accept inbound messages', async () => {
      const { adapter } = buildAdapter();
      adapter.capabilities = { ...adapter.capabilities, acceptsInbound: false };
      registry.resolve.mockReturnValue(adapter);

      await expect(service.ingest(InteractionChannel.PHONE, inboundDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(interactions.create).not.toHaveBeenCalled();
    });

    it('writes INBOUND / RECEIVED with a null caller', async () => {
      registry.resolve.mockReturnValue(buildAdapter().adapter);

      const result = await service.ingest(InteractionChannel.EMAIL, inboundDto);

      expect(result.created).toBe(true);
      expect(interactions.create).toHaveBeenCalledWith(
        'customer-1',
        containing({ direction: InteractionDirection.INBOUND }),
        null,
        containing({ deliveryStatus: InteractionDeliveryStatus.RECEIVED }),
      );
    });

    it('returns created: false and writes nothing when (channel, externalId) already exists', async () => {
      registry.resolve.mockReturnValue(buildAdapter().adapter);
      prisma.customerInteraction.findUnique.mockResolvedValue({
        id: 'interaction-existing',
        customerId: 'customer-1',
      });

      const result = await service.ingest(InteractionChannel.EMAIL, {
        ...inboundDto,
        externalId: 'provider-1',
      });

      expect(result).toEqual({ interaction: { id: 'interaction-existing' }, created: false });
      expect(interactions.create).not.toHaveBeenCalled();
    });

    it('converts a concurrent P2002 into the idempotent path rather than a 500', async () => {
      registry.resolve.mockReturnValue(buildAdapter().adapter);
      // The pre-check misses (the racing writer has not committed yet), then the
      // create loses the race, then the second lookup finds the winner's row.
      prisma.customerInteraction.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'interaction-existing', customerId: 'customer-1' });
      interactions.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      const result = await service.ingest(InteractionChannel.EMAIL, {
        ...inboundDto,
        externalId: 'provider-1',
      });

      expect(result.created).toBe(false);
      expect(result.interaction).toEqual({ id: 'interaction-existing' });
    });

    it('prefers an explicit customerId over the address', async () => {
      registry.resolve.mockReturnValue(buildAdapter().adapter);
      customersService.assertExists.mockResolvedValue({ id: 'customer-explicit' });

      await service.ingest(InteractionChannel.EMAIL, {
        ...inboundDto,
        customerId: 'customer-explicit',
      });

      expect(customersService.assertExists).toHaveBeenCalledWith('customer-explicit');
      expect(prisma.customer.findFirst).not.toHaveBeenCalled();
      expect(interactions.create).toHaveBeenCalledWith(
        'customer-explicit',
        expect.anything(),
        null,
        expect.anything(),
      );
    });

    it('matches an email address against Customer.email', async () => {
      registry.resolve.mockReturnValue(buildAdapter().adapter);

      await service.ingest(InteractionChannel.EMAIL, inboundDto);

      expect(prisma.customer.findFirst).toHaveBeenCalledWith(
        containing({ where: { email: 'layla@crm.local' } }),
      );
    });

    it('matches a phone address against phone OR alternatePhone', async () => {
      const { adapter } = buildAdapter();
      adapter.channel = InteractionChannel.SMS;
      adapter.capabilities = { ...adapter.capabilities, addressKind: 'phone' };
      adapter.parseInbound = jest.fn(() => ({
        subject: 'Text',
        body: 'On my way',
        address: '+201001234567',
        externalId: null,
        occurredAt: new Date('2026-06-15T11:00:00.000Z'),
        metadata: null,
      }));
      registry.resolve.mockReturnValue(adapter);

      await service.ingest(InteractionChannel.SMS, { body: 'On my way' });

      expect(prisma.customer.findFirst).toHaveBeenCalledWith(
        containing({
          where: { OR: [{ phone: '+201001234567' }, { alternatePhone: '+201001234567' }] },
        }),
      );
    });

    it('404s an address that matches no customer', async () => {
      registry.resolve.mockReturnValue(buildAdapter().adapter);
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.ingest(InteractionChannel.EMAIL, inboundDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('400s when neither customerId nor an address is available', async () => {
      const { adapter } = buildAdapter();
      adapter.parseInbound = jest.fn(() => ({
        subject: 'Hi',
        body: 'Hi',
        address: null,
        externalId: null,
        occurredAt: new Date('2026-06-15T11:00:00.000Z'),
        metadata: null,
      }));
      registry.resolve.mockReturnValue(adapter);

      await expect(service.ingest(InteractionChannel.EMAIL, { body: 'Hi' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('400s a CHAT payload with no customerId — no customer record holds a session id', async () => {
      const { adapter } = buildAdapter();
      adapter.channel = InteractionChannel.CHAT;
      adapter.capabilities = { ...adapter.capabilities, addressKind: 'session' };
      adapter.parseInbound = jest.fn(() => ({
        subject: 'Chat',
        body: 'Hi',
        address: 'session-abc',
        externalId: null,
        occurredAt: new Date('2026-06-15T11:00:00.000Z'),
        metadata: null,
      }));
      registry.resolve.mockReturnValue(adapter);

      await expect(
        service.ingest(InteractionChannel.CHAT, { body: 'Hi', address: 'session-abc' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(interactions.create).not.toHaveBeenCalled();
    });

    it('never deduplicates a payload with no externalId', async () => {
      const { adapter } = buildAdapter();
      adapter.parseInbound = jest.fn(() => ({
        subject: 'Quote request',
        body: 'Please call me.',
        address: 'layla@crm.local',
        externalId: null,
        occurredAt: new Date('2026-06-15T11:00:00.000Z'),
        metadata: null,
      }));
      registry.resolve.mockReturnValue(adapter);

      await service.ingest(InteractionChannel.EMAIL, inboundDto);

      expect(prisma.customerInteraction.findUnique).not.toHaveBeenCalled();
      expect(interactions.create).toHaveBeenCalled();
    });
  });
});
