import { Module } from '@nestjs/common';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { ExamRuntimeController } from './exam-runtime.controller';
import { ExamRuntimeService } from './exam-runtime.service';

@Module({
  imports: [LeaderboardModule],
  controllers: [ExamRuntimeController],
  providers: [ExamRuntimeService],
  exports: [ExamRuntimeService],
})
export class ExamRuntimeModule {}
