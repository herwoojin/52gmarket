// 매물 (구글시트 매핑)
export interface Product {
  id: string;
  createdAt: string;
  status: '판매중' | '거래완료' | '삭제' | '입금대기';
  deal: '나눔' | '판매';
  category: '전산소모품' | '사무용품' | '가구·비품' | '기타';
  title: string;
  price: number;
  desc: string;
  loc: string;
  nick: string;
  uid: string;
  photoURL: string;
  jjim: number;
  chats: number;
}

export type NewProduct = Omit<Product, 'id' | 'createdAt' | 'status' | 'jjim' | 'chats'>;

export interface UserProfile {
  nick: string;
  loc: string;
  createdAt?: string;
  fcmToken?: string;
}

export interface WishlistItem {
  productId: string;
  createdAt: string;
}

export interface Keyword {
  id: string;
  word: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  keyword: string;
  productId: string;
  title: string;
  loc: string;
  unread: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  senderUid: string;
  senderNick: string;
  text: string;
  createdAt: string;
}

export interface ChatRoom {
  productId: string;
  buyerUid: string;
  sellerUid: string;
  lastMessage: string;
  updatedAt: string;
}

export const CATEGORIES = ['전산소모품', '사무용품', '가구·비품', '기타'] as const;
export const DEALS = ['전체', '나눔', '판매'] as const;
export const LOCATIONS = [
  '역삼타워', '강서타워', '강서N타워',
  '편)강동사무실', '편)수원사무실', '편)대전사무실', '편)부산사무실',
  '편)광주사무실', '편)원주사무실', '편)창원사무실', '편)청주사무실', '편)제주사무실',
  '기타',
] as const;
