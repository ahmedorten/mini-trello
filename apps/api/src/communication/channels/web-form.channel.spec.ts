import { BadRequestException } from '@nestjs/common';
import { InteractionChannel } from '@prisma/client';
import { WebFormChannel } from './web-form.channel';

describe('WebFormChannel', () => {
  let channel: WebFormChannel;

  beforeEach(() => {
    channel = new WebFormChannel();
  });

  it('is a one-way intake: canRespond false, acceptsInbound true (Product rule 4)', () => {
    expect(channel.channel).toBe(InteractionChannel.WEB_FORM);
    expect(channel.capabilities.canRespond).toBe(false);
    expect(channel.capabilities.acceptsInbound).toBe(true);
    expect(channel.capabilities.supportsSubject).toBe(true);
    expect(channel.capabilities.requiresAddress).toBe(false);
  });

  it('dispatch rejects rather than writing a row claiming a reply went out', async () => {
    await expect(channel.dispatch()).rejects.toBeInstanceOf(BadRequestException);
  });

  it('parseInbound succeeds and lower-cases the collected address', () => {
    const result = channel.parseInbound({
      address: 'Layla@CRM.local',
      subject: 'Quote request',
      body: '  Please call me.  ',
      externalId: 'form-1',
      occurredAt: new Date('2026-06-15T12:00:00.000Z'),
    });

    expect(result.address).toBe('layla@crm.local');
    expect(result.subject).toBe('Quote request');
    expect(result.body).toBe('Please call me.');
    expect(result.externalId).toBe('form-1');
    expect(result.metadata).toBeNull();
  });
});
