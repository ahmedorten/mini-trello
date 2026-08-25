/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */
import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter, ErrorResponseBody } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockHttpAdapterHost: Partial<HttpAdapterHost>;
  let mockArgumentsHost: Partial<ArgumentsHost>;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(() => {
    mockResponse = {};
    mockRequest = { url: '/test' };

    mockHttpAdapterHost = {
      httpAdapter: {
        reply: jest.fn(),
        getRequestUrl: jest.fn((req) => req.url),
      } as any,
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(() => mockRequest),
        getResponse: jest.fn(() => mockResponse),
      }),
    };

    filter = new AllExceptionsFilter(mockHttpAdapterHost as HttpAdapterHost);
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('handles BadRequestException with string[] message', () => {
    const exception = new BadRequestException({
      statusCode: 400,
      message: ['field1 is required', 'field2 must be a number'],
      error: 'Bad Request',
    });

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    const reply = (mockHttpAdapterHost.httpAdapter!.reply as jest.Mock).mock.calls[0];
    const body = reply[1] as ErrorResponseBody;

    expect(body.statusCode).toBe(400);
    expect(Array.isArray(body.message)).toBe(true);
    expect((body.message as string[])[0]).toContain('field1');
  });

  it('hides sensitive error details in 5xx responses', () => {
    const sensitiveError = new Error('sensitive connection string: postgres://user:pass@host');
    mockRequest.id = undefined;

    filter.catch(sensitiveError, mockArgumentsHost as ArgumentsHost);

    const reply = (mockHttpAdapterHost.httpAdapter!.reply as jest.Mock).mock.calls[0];
    const body = reply[1] as ErrorResponseBody;
    const responseString = JSON.stringify(body);

    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(responseString).not.toContain('connection string');
    expect(responseString).not.toContain('postgres://');
  });

  it('handles non-Error throws', () => {
    const exception = 'boom';

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    const reply = (mockHttpAdapterHost.httpAdapter!.reply as jest.Mock).mock.calls[0];
    const body = reply[1] as ErrorResponseBody;

    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error');
  });

  it('includes requestId when present on request', () => {
    mockRequest.id = 'req-12345';
    const exception = new BadRequestException('Bad request');

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    const reply = (mockHttpAdapterHost.httpAdapter!.reply as jest.Mock).mock.calls[0];
    const body = reply[1] as ErrorResponseBody;

    expect(body.requestId).toBe('req-12345');
  });

  it('omits requestId when not present on request', () => {
    mockRequest.id = undefined;
    const exception = new BadRequestException('Bad request');

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    const reply = (mockHttpAdapterHost.httpAdapter!.reply as jest.Mock).mock.calls[0];
    const body = reply[1] as ErrorResponseBody;

    expect(body.requestId).toBeUndefined();
  });
});
