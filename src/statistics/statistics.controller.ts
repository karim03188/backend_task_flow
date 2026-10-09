import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { StatisticsService } from './statistics.service';

@ApiTags('Statistics')
@ApiBearerAuth('access-token')
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Dashboard overview for the authenticated user',
    description:
      'Returns totals, status/priority breakdowns, overdue and due-today counts and completion percentage.',
  })
  getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.statisticsService.getOverview(user.userId);
  }
}
