import { Module } from '@nestjs/common';
import { ExamRuntimeModule } from '../exam-runtime/exam-runtime.module';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';

@Module({
  imports: [ExamRuntimeModule],
  controllers: [ExamsController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}
