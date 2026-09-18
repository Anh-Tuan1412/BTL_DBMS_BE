import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchMovieDto } from './dto/search-movie.dto';
import { Public } from '../../common/decorators';

@ApiTags('Search - Tìm kiếm và lọc phim nâng cao (UC5: Nguyễn Thị Cẩm Vân)')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get('movies')
  @ApiOperation({
    summary: 'Tìm kiếm và lọc phim đa tiêu chí',
    description:
      'Lọc theo tên phim, thể loại, cụm rạp, ngày chiếu và khoảng giá vé',
  })
  searchMovies(@Query() filter: SearchMovieDto) {
    return this.searchService.searchMovies(filter);
  }
}
