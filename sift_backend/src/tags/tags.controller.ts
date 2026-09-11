import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * CRUD for the global tag list. Tags are shared across all users (not
 * per-user scoped), so any authenticated user can rename or delete one.
 */
@UseGuards(JwtAuthGuard)
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  /** Lists all tags, alphabetically. */
  @Get()
  findAll() {
    return this.tagsService.findAll();
  }

  /** Creates a new tag. Name is normalized (trimmed/lowercased) by the service. */
  @Post()
  create(@Body() createTagDto: CreateTagDto) {
    return this.tagsService.create(createTagDto.name);
  }

  /** Renames an existing tag by id. */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTagDto: CreateTagDto,
  ) {
    return this.tagsService.update(id, updateTagDto.name);
  }

  /** Deletes a tag by id, removing it from any recipes that reference it. */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tagsService.remove(id);
  }
}
