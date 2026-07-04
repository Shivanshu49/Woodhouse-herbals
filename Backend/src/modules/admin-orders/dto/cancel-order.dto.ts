import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelOrderDto {
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
