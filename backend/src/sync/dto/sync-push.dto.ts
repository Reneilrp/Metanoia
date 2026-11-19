import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class HabitSyncItem {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  frequencyType?: string;

  @IsInt()
  @IsOptional()
  targetCount?: number;

  @IsOptional()
  archivedAt?: string | null;

  @IsInt()
  @IsOptional()
  version?: number;

  @IsOptional()
  deletedAt?: string | null;

  @IsOptional()
  createdAt?: string;

  @IsOptional()
  updatedAt?: string;
}

export class HabitCompletionSyncItem {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  habitId!: string;

  @IsString()
  @IsNotEmpty()
  completedDate!: string; // YYYY-MM-DD

  @IsInt()
  @IsOptional()
  value?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  deletedAt?: string | null;

  @IsOptional()
  createdAt?: string;

  @IsOptional()
  updatedAt?: string;
}

export class ReflectionSyncItem {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsInt()
  @IsOptional()
  moodRating?: number;

  @IsString()
  @IsOptional()
  audioFileUrl?: string;

  @IsOptional()
  deletedAt?: string | null;

  @IsOptional()
  createdAt?: string;

  @IsOptional()
  updatedAt?: string;
}

export class TombstoneSyncItem {
  @IsString()
  @IsNotEmpty()
  tableName!: string;

  @IsString()
  @IsNotEmpty()
  recordId!: string;

  @IsString()
  @IsOptional()
  deletedAt?: string;
}

export class SyncPushDto {
  @IsArray()
  @IsOptional()
  habits?: HabitSyncItem[];

  @IsArray()
  @IsOptional()
  habitCompletions?: HabitCompletionSyncItem[];

  @IsArray()
  @IsOptional()
  reflections?: ReflectionSyncItem[];

  @IsArray()
  @IsOptional()
  tombstones?: TombstoneSyncItem[];
}
