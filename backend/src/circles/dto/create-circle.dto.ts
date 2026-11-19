import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCircleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;
}

export class JoinCircleDto {
  @IsString()
  @IsNotEmpty()
  inviteCode!: string;
}

export class SendReactionDto {
  @IsString()
  @IsNotEmpty()
  circleId!: string;

  @IsString()
  @IsNotEmpty()
  receiverId!: string;

  @IsString()
  @IsNotEmpty()
  emoji!: string;
}
