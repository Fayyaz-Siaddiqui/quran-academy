import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { IsEnum, IsInt, IsString, MaxLength, Min } from 'class-validator';
import { CurrentAuth } from '../../common/decorators';
import type { AuthContext } from '../../common/types/auth-context';
import { DocumentsService } from './documents.service';

class RequestUploadDto {
  @IsEnum(DocumentType) type: DocumentType;
  @IsString() @MaxLength(200) fileName: string;
  @IsString() @MaxLength(100) mimeType: string;
  @IsInt() @Min(1) sizeBytes: number;
}

class ConfirmUploadDto {
  @IsString() @MaxLength(300) key: string;
}

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  listMine(@CurrentAuth() auth: AuthContext) {
    return this.documents.listOwn(auth.userId);
  }

  @Post('upload-url')
  requestUpload(@CurrentAuth() auth: AuthContext, @Body() dto: RequestUploadDto) {
    return this.documents.requestUpload(auth.userId, dto.type, dto.fileName, dto.mimeType, dto.sizeBytes);
  }

  @Post('confirm')
  confirm(@CurrentAuth() auth: AuthContext, @Body() dto: ConfirmUploadDto) {
    return this.documents.confirmUpload(auth.userId, dto.key);
  }

  @Get(':id/url')
  url(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.documents.downloadUrl(auth, id);
  }

  @Delete(':id')
  remove(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.documents.remove(auth, id);
  }
}
