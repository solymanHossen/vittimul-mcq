import { BadRequestException } from '@nestjs/common';
import { ParseBigIntPipe } from './parse-bigint.pipe';

describe('ParseBigIntPipe', () => {
  const pipe = new ParseBigIntPipe();

  it('converts a plain numeric string into a bigint', () => {
    expect(pipe.transform('42')).toBe(42n);
  });

  it('converts "0" into 0n', () => {
    expect(pipe.transform('0')).toBe(0n);
  });

  it('converts a very large numeric string beyond Number.MAX_SAFE_INTEGER without precision loss', () => {
    expect(pipe.transform('9007199254740993')).toBe(9007199254740993n);
  });

  it.each(['', 'abc', '1.5', '-1', '1e5', ' 1', '1 ', '0x1', '1,000'])(
    'rejects %p with BadRequestException',
    (input) => {
      expect(() => pipe.transform(input)).toThrow(BadRequestException);
    },
  );

  it('throws the documented message on invalid input', () => {
    try {
      pipe.transform('not-a-number');
      throw new Error('expected transform to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe(
        'Validation failed (numeric BigInt string is expected)',
      );
    }
  });
});
