
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ExtractService } from './extract.service';

@Controller()
export class ExtractController {
  constructor(private readonly extract: ExtractService) {}

  @Post('extract')
  create(@Body() body: { items: { name: string; url: string }[]; force?: boolean }) {
    const items = (body.items ?? []).filter((it) => it?.name && it?.url);
    if (items.length === 0) return { ok: false, error: '未识别到有效的模组名和网址对' };
    const id = this.extract.createTask(items, Boolean(body.force));
    return { ok: true, id };
  }

  @Get('tasks')
  list() {
    return this.extract.listTasks();
  }

  @Get('tasks/:id')
  get(@Param('id') id: string) {
    return this.extract.getTask(id);
  }
}
