import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddOrderNoteDto {
  @IsString() @IsNotEmpty() @MaxLength(4000) body!: string;
  @IsOptional() @IsBoolean() isCustomerVisible?: boolean;
}
