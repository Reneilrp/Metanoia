import { IsInt, IsOptional, IsString } from 'class-validator';

export class TranscribeDto {
  @IsString()
  @IsOptional()
  audioBase64?: string;

  @IsString()
  @IsOptional()
  audioUrl?: string;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsInt()
  @IsOptional()
  durationSeconds?: number;

  @IsString()
  @IsOptional()
  title?: string;
}
