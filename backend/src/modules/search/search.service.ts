import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from '../../database/entities/movie.entity';
import { SearchMovieDto } from './dto/search-movie.dto';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {}

  // =========================================================================
  // TODO: Nguyễn Thị Cẩm Vân - Hiện thực UC5: Tìm kiếm và lọc phim đa tiêu chí
  // =========================================================================

  async searchMovies(filter: SearchMovieDto) {
    // TODO: Vân viết logic QueryBuilder hoặc SQL để tìm kiếm/lọc phim:
    // - Lọc theo tên phim (keyword)
    // - Lọc theo thể loại (genre)
    // - Lọc theo rạp chiếu (cinemaId)
    // - Lọc theo ngày chiếu (date)
    // - Lọc theo khoảng giá (minPrice, maxPrice)
    return {
      message: 'TODO: Nguyễn Thị Cẩm Vân viết logic lọc phim nâng cao',
      filterCriteria: filter,
      data: [],
    };
  }
}
