export interface Review {
  id: string;
  type: 'text' | 'image' | 'link';
  inputData: string;
  reviewText: string;
  createdAt: string;
}
