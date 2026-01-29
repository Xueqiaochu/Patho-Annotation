
export enum TextLabel {
  PATIENT_DATA = '病人资料',
  GROSS_EXAM = '大体检查',
  IHC_TEXT = '免疫组化',
  DIAGNOSIS = '病理诊断',
  DIAGNOSTIC_BASIS = '诊断依据',
  DIFFERENTIAL = '鉴别诊断',
  KNOWLEDGE = '知识拓展'
}

export enum UserRole {
  ADMIN = '管理员',
  USER = '标注员'
}

export interface User {
  id: string;
  username: string;
  password?: string; // Optional: stored for verification
  role: UserRole;
}

export const REQUIRED_TEXT_LABELS = [
  TextLabel.PATIENT_DATA,
  TextLabel.GROSS_EXAM,
  TextLabel.DIAGNOSIS,
  TextLabel.DIAGNOSTIC_BASIS
];

export enum ImageType {
  HE = 'HE染色',
  IHC = '免疫组化'
}

export enum Magnification {
  X10 = 'x10',
  X20 = 'x20',
  X40 = 'x40',
  X100 = 'x100',
  X200 = 'x200',
  X400 = 'x400',
  OTHER = '其他'
}

export interface ImageRecord {
  id: string;
  url: string; // Base64 or Blob URL
  fileName: string;
  type: ImageType;
  magnification: Magnification;
  description: string;
}

export interface TextRecord {
  id: string;
  label: TextLabel;
  content: string; 
}

export interface CaseRecord {
  caseId: string;
  userId: string; // The user who created/owns this record
  username?: string; // Cache for display in admin view
  organCategory: string;
  textSections: TextRecord[];
  images: ImageRecord[];
  submittedAt?: string;
  updatedAt?: string;
}
