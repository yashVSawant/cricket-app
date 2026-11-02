import { Module } from '@nestjs/common';
import { ScoringController } from './scoring.controller';
import { ScoringService } from './scoring.service';
import { LiveModule } from '../live/live.module';
import { MatchesModule } from '../matches/matches.module';

@Module({
  imports: [LiveModule, MatchesModule],
  controllers: [ScoringController],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
