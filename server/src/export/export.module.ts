
import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { LibraryModule } from '../library/library.module';

@Module({
  imports: [LibraryModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
