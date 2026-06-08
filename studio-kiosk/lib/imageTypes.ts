export type ProcessingStatus =
  | "none"
  | "pending"
  | "processing"
  | "ready"
  | "failed";

export type ImageVariants = {
  original?: string;
  subject?: string;
};

export type GalleryImageData = {
  filename: string;
  url: string;
  imageId?: string;
  processingStatus?: ProcessingStatus;
  variants?: ImageVariants;
};

export type FetchImagesResponse = {
  images: GalleryImageData[];
};

export type ImageStatusResponse = {
  imageId: string;
  status: ProcessingStatus;
  variants: ImageVariants;
  error: string | null;
};
