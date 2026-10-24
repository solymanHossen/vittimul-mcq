import type { ExecutionContext, CallHandler } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

function buildContext(request: Partial<Request>, response: Partial<Response>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request as Request,
      getResponse: () => response as Response,
    }),
  } as unknown as ExecutionContext;
}

function buildCallHandler(returnValue: unknown): CallHandler {
  return { handle: () => of(returnValue) } as CallHandler;
}

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('wraps a plain handler return value as `data` with a default message', (done) => {
    const context = buildContext({ url: '/api/v1/health', method: 'GET' }, { statusCode: 200 });

    interceptor.intercept(context, buildCallHandler({ status: 'ok' })).subscribe((result) => {
      expect(result).toEqual({
        success: true,
        statusCode: 200,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        path: '/api/v1/health',
        method: 'GET',
        message: 'Success',
        data: { status: 'ok' },
      });
      done();
    });
  });

  it('unwraps an explicit `{ message, data }` shape instead of nesting it', (done) => {
    const context = buildContext(
      { url: '/api/v1/auth/register', method: 'POST' },
      { statusCode: 201 },
    );

    interceptor
      .intercept(context, buildCallHandler({ message: 'Registration successful', data: { id: 1 } }))
      .subscribe((result) => {
        expect(result.message).toBe('Registration successful');
        expect(result.data).toEqual({ id: 1 });
        done();
      });
  });

  it('preserves an explicit `data: null` instead of falling back to the raw body', (done) => {
    const context = buildContext(
      { url: '/api/v1/auth/logout', method: 'POST' },
      { statusCode: 200 },
    );

    interceptor
      .intercept(context, buildCallHandler({ message: 'Logged out successfully', data: null }))
      .subscribe((result) => {
        expect(result.data).toBeNull();
        done();
      });
  });

  it('falls back to a default message and echoes the raw body when it has no `message` field', (done) => {
    const context = buildContext({ url: '/api/v1/settings', method: 'GET' }, { statusCode: 200 });

    interceptor
      .intercept(context, buildCallHandler({ allowRegistration: true }))
      .subscribe((result) => {
        expect(result.message).toBe('Success');
        expect(result.data).toEqual({ allowRegistration: true });
        done();
      });
  });

  it('handles a null/undefined handler return value without throwing', (done) => {
    const context = buildContext(
      { url: '/api/v1/health/live', method: 'GET' },
      { statusCode: 204 },
    );

    interceptor.intercept(context, buildCallHandler(undefined)).subscribe((result) => {
      expect(result.message).toBe('Success');
      expect(result.data).toBeUndefined();
      done();
    });
  });

  it('serializes top-level bigint and Prisma.Decimal values', (done) => {
    const context = buildContext(
      { url: '/api/v1/questions/1', method: 'GET' },
      { statusCode: 200 },
    );

    interceptor
      .intercept(context, buildCallHandler({ id: 42n, defaultMarks: new Prisma.Decimal('1.50') }))
      .subscribe((result) => {
        expect(result.data).toEqual({ id: '42', defaultMarks: 1.5 });
        done();
      });
  });

  it('serializes bigint/Decimal nested inside arrays and objects, leaving Date instances intact', (done) => {
    const context = buildContext({ url: '/api/v1/exams/1', method: 'GET' }, { statusCode: 200 });
    const createdAt = new Date('2026-01-01T00:00:00.000Z');

    interceptor
      .intercept(
        context,
        buildCallHandler({
          data: {
            exam: {
              id: 7n,
              totalMarks: new Prisma.Decimal('100.00'),
              createdAt,
              options: [
                { id: 1n, isCorrect: true },
                { id: 2n, isCorrect: false },
              ],
            },
          },
        }),
      )
      .subscribe((result) => {
        expect(result.data).toEqual({
          exam: {
            id: '7',
            totalMarks: 100,
            createdAt,
            options: [
              { id: '1', isCorrect: true },
              { id: '2', isCorrect: false },
            ],
          },
        });
        done();
      });
  });
});
