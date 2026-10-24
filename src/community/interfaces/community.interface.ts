import { type ReportReason, type ReportStatus } from '@prisma/client';

export interface CommentAuthor {
  id: number;
  name: string | null;
  avatarUrl: string | null;
}

export interface CommentDetail {
  id: string;
  questionId: string;
  parentCommentId: string | null;
  commentText: string;
  imageUrl: string | null;
  upvotes: number;
  isPinned: boolean;
  isVerifiedByTeacher: boolean;
  isEdited: boolean;
  createdAt: Date;
  author: CommentAuthor;
  replies: CommentDetail[];
}

export interface ReportDetail {
  id: string;
  questionId: string;
  userId: number | null;
  resolvedById: number | null;
  reason: ReportReason;
  userNotes: string | null;
  screenshotUrl: string | null;
  resolutionNotes: string | null;
  status: ReportStatus;
  createdAt: Date;
  resolvedAt: Date | null;
}
