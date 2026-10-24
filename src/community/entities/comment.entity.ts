import { ApiProperty } from '@nestjs/swagger';
import type { CommentAuthor, CommentDetail } from '../interfaces/community.interface';

export class CommentAuthorEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ nullable: true })
  avatarUrl: string | null;

  constructor(author: CommentAuthor) {
    this.id = author.id;
    this.name = author.name;
    this.avatarUrl = author.avatarUrl;
  }
}

export class CommentEntity {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty({ example: '501' })
  questionId: string;

  @ApiProperty({ example: null, nullable: true })
  parentCommentId: string | null;

  @ApiProperty({ example: 'I think the answer should be B, not A.' })
  commentText: string;

  @ApiProperty({ nullable: true })
  imageUrl: string | null;

  @ApiProperty({ example: 5 })
  upvotes: number;

  @ApiProperty({ example: false })
  isPinned: boolean;

  @ApiProperty({ example: false })
  isVerifiedByTeacher: boolean;

  @ApiProperty({ example: false })
  isEdited: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: CommentAuthorEntity })
  author: CommentAuthorEntity;

  @ApiProperty({ type: [CommentEntity] })
  replies: CommentEntity[];

  constructor(comment: CommentDetail) {
    this.id = comment.id;
    this.questionId = comment.questionId;
    this.parentCommentId = comment.parentCommentId;
    this.commentText = comment.commentText;
    this.imageUrl = comment.imageUrl;
    this.upvotes = comment.upvotes;
    this.isPinned = comment.isPinned;
    this.isVerifiedByTeacher = comment.isVerifiedByTeacher;
    this.isEdited = comment.isEdited;
    this.createdAt = comment.createdAt;
    this.author = new CommentAuthorEntity(comment.author);
    this.replies = comment.replies.map((reply) => new CommentEntity(reply));
  }
}
