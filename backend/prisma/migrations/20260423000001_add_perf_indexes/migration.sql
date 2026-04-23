-- CreateIndex: Reservation(deskId, date, status) — speeds up availability queries
CREATE INDEX "Reservation_deskId_date_status_idx" ON "Reservation"("deskId", "date", "status");

-- CreateIndex: Checkin(deskId, checkedOutAt) — speeds up active checkin lookups per desk
CREATE INDEX "Checkin_deskId_checkedOutAt_idx" ON "Checkin"("deskId", "checkedOutAt");
