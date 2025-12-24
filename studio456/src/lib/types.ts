/* eslint-disable no-unused-vars */
export interface ImageProps {
  id: number;
  public_id?: string;
  format?: string;
  height?: number;
  width?: number;
  blurDataUrl?: string;
  url: string;
}

export interface SharedModalProps {
  index: number;
  images?: ImageProps[];
  currentPhoto?: ImageProps;
  changePhotoId: (newVal: number) => void;
  closeModal: () => void;
  navigation: boolean;
  direction?: number;
}