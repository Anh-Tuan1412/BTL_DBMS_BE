export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
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
  EXPIRED = 'EXPIRED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'SUCCESS',
  REFUND_PENDING = 'REFUND_PENDING',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

export enum MovieStatus {
  COMING_SOON = 'COMING_SOON',
  NOW_SHOWING = 'NOW_SHOWING',
  END_OF_SHOW = 'END_OF_SHOW',
}

export enum ShowtimeStatus {
  SCHEDULED = 'SCHEDULED',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
