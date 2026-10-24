import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const NUMERIC_STRING = /^\d+$/;

/**
 * Converts a route param (e.g. `:id`, `:questionId`, `:examId`) backed by a
 * Prisma `BigInt` column into a `bigint`. Rejects anything that isn't a plain
 * non-negative integer string — including empty strings, decimals, and
 * negative numbers — before the value ever reaches a Prisma query.
 */
@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, bigint> {
  transform(value: string): bigint {
    if (typeof value !== 'string' || !NUMERIC_STRING.test(value)) {
      throw new BadRequestException('Validation failed (numeric BigInt string is expected)');
    }

    return BigInt(value);
  }
}
