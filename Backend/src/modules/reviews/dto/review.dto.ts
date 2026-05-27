import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateReviewDto {
  @IsString()
  @Matches(/^[a-z0-9_-]{8,40}$/i, { message: 'Invalid product id' })
  productId!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  authorName!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  body!: string;
}
