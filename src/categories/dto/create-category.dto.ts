import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Work', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example: '#3B82F6',
    description: 'Optional hex color or short label',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#?[0-9A-Fa-f]{3,8}$|^[a-zA-Z ]{1,20}$/, {
    message: 'color must be a hex color (e.g. #3B82F6) or a short label',
  })
  color?: string;
}
