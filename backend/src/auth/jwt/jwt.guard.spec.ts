import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtGuard } from './jwt.guard';

describe('JwtGuard', () => {
  it('should be defined', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtGuard, Reflector],
    }).compile();

    expect(module.get(JwtGuard)).toBeDefined();
  });
});
