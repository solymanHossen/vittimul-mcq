import { Body, Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CompassService } from './compass.service';
import { UpdateSyllabusSchema, type UpdateSyllabusDto } from './dto/update-syllabus.dto';
import { CompassDashboardEntity } from './entities/compass-dashboard.entity';
import { SyllabusTrackerEntity } from './entities/syllabus-tracker.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Compass')
@ApiBearerAuth()
@Controller('compass')
export class CompassController {
  constructor(private readonly compassService: CompassService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Streak, 365-day study heatmap, and category/subject completion percentages',
  })
  @ApiResponse({ status: 200, type: CompassDashboardEntity })
  async getDashboard(
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: CompassDashboardEntity }> {
    const dashboard = await this.compassService.getDashboard(user.id);
    return {
      message: 'Dashboard retrieved successfully',
      data: new CompassDashboardEntity(dashboard),
    };
  }

  @Patch('syllabus/:topicId')
  @ApiOperation({ summary: 'Update syllabus progress for a topic' })
  @ApiBody({ schema: z.toJSONSchema(UpdateSyllabusSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: 200, type: SyllabusTrackerEntity })
  async updateSyllabus(
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body(new ZodValidationPipe(UpdateSyllabusSchema)) dto: UpdateSyllabusDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: SyllabusTrackerEntity }> {
    const tracker = await this.compassService.upsertSyllabusTracker(user.id, topicId, dto);
    return {
      message: 'Syllabus progress updated successfully',
      data: new SyllabusTrackerEntity(tracker),
    };
  }
}
