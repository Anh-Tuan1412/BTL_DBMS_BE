export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
}

export enum SeatType {
  REGULAR = 'REGULAR',
  VIP = 'VIP',
  COUPLE = 'COUPLE',
}

export enum SeatStatus {
  AVAILABLE = 'AVAILABLE',
  HOLDING = 'HOLDING',
  BOOKED = 'BOOKED',
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

export enum MovieStatus {
  COMING_SOON = 'COMING_SOON',
  NOW_SHOWING = 'NOW_SHOWING',
  END_OF_SHOW = 'END_OF_SHOW',
}
