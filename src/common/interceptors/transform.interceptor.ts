import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Symmetric success response envelope — shape mirrors ErrorResponseShape from
 * http-exception.filter.ts so API consumers can write isomorphic response handling.
 *
 * Success:  { success: true,  statusCode, timestamp, path, method, message, data }
 * Error:    { success: false, statusCode, timestamp, path, method, message, errors, data: null }
 */
export interface ApiSuccessResponse<T> {
  success: true;
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<T>> {
    const httpRequest = context.switchToHttp().getRequest<Request>();
    const httpResponse = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((res: unknown) => {
        const body = res as Record<string, unknown> | null | undefined;

        return {
          success: true as const,
          statusCode: httpResponse.statusCode,
          timestamp: new Date().toISOString(),
          path: httpRequest.url,
          method: httpRequest.method,
          message: typeof body?.message === 'string' ? body.message : 'Success',
          data: serializePrismaValue(body?.data !== undefined ? body.data : res) as T,
        };
      }),
    );
  }
}

/**
 * Recursively converts `bigint` (Prisma's representation for `BigInt` columns)
 * to `string` and `Prisma.Decimal` (its representation for `Decimal` columns)
 * to `number`, so Express's `res.json()` never throws
 * `TypeError: Do not know how to serialize a BigInt`. `Date` instances are
 * returned as-is — `JSON.stringify` already serializes them via `toJSON()`.
 */
function serializePrismaValue(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Prisma.Decimal) {
    return Number(value.toString());
  }

  if (value instanceof Date || value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(serializePrismaValue);
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      serializePrismaValue(entry),
    ]),
  );
}
