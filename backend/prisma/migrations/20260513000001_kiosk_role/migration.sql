-- This migration requires no transaction.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'KIOSK';
