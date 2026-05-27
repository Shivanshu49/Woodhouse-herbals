import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

const ID_RE = /^[a-z0-9_-]{8,40}$/i;

export class AddToCartDto {
  @IsString()
  @Matches(ID_RE, { message: 'Invalid product id' })
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;
}

export class UpdateCartLineDto {
  @IsInt()
  @Min(0)
  @Max(20)
  quantity!: number;
}
