"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Booking } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { bookingsAPI } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";

export default function BookingsPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [cancelId, setCancelId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState("");

  // TRANSFER STATES
  const [transferId, setTransferId] = useState<string | null>(null);
  const [transferEmail, setTransferEmail] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [transferSuccess, setTransferSuccess] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) {
      router.push("/login?callbackUrl=/bookings");
      return;
    }

    bookingsAPI
      .list(token)
      .then((res) => setBookings(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [user, token, authLoading, router]);

  const handleCancel = async () => {
    if (!token || !cancelId) return;
    setIsCancelling(true);

    try {
      const res = await bookingsAPI.cancel(token, cancelId);

      setBookings((prev) => prev.map((b) => (b.id === cancelId ? { ...b, status: "CANCELLED" } : b)));

      setCancelSuccess(
        res.data.refundAmount > 0
          ? `Booking cancelled. Refund of ${formatCurrency(res.data.refundAmount)} will be processed.`
          : "Booking cancelled successfully.",
      );

      setCancelId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleTransfer = async () => {
    if (!token || !transferId || !transferEmail) return;

    setIsTransferring(true);
    setTransferError("");

    try {
      await bookingsAPI.transfer(token, transferId, transferEmail);

      setBookings((prev) => prev.filter((b) => b.id !== transferId));

      setTransferSuccess("Ticket transferred successfully!");
      setTransferId(null);
      setTransferEmail("");
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setIsTransferring(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return <Badge variant="success">Confirmed</Badge>;
      case "CHECKED_IN":
        return <Badge variant="info">Checked In</Badge>;
      case "CANCELLED":
        return <Badge variant="danger">Cancelled</Badge>;
      case "WAITLISTED":
        return <Badge variant="warning">Waitlisted</Badge>; // ✅ NEW
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">My Bookings</h1>

      {error && <Alert variant="error">{error}</Alert>}
      {cancelSuccess && <Alert variant="success">{cancelSuccess}</Alert>}
      {transferSuccess && <Alert variant="success">{transferSuccess}</Alert>}

      {bookings.length === 0 ? (
        <div className="text-center py-12">
          <h3>No bookings yet</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <Card key={booking.id}>
              <CardContent className="flex items-center gap-4">
                <div className="flex-1">
                  <h3>{booking.event?.name}</h3>
                  {statusBadge(booking.status)}

                  {/* ✅ SHOW MESSAGE FOR WAITLIST */}
                  {booking.status === "WAITLISTED" && (
                    <p className="text-sm text-gray-500 mt-1">Waiting for ticket availability...</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {booking.status === "CONFIRMED" && (
                    <>
                      <Link href={`/tickets/${booking.id}`}>
                        <Button size="sm">View Ticket</Button>
                      </Link>

                      <Button
                        size="sm"
                        onClick={() => {
                          setTransferId(booking.id);
                          setTransferError("");
                        }}
                      >
                        Transfer
                      </Button>

                      <Button size="sm" variant="danger" onClick={() => setCancelId(booking.id)}>
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* CANCEL MODAL */}
      <Modal isOpen={!!cancelId} onClose={() => setCancelId(null)} title="Cancel Booking">
        <Button onClick={handleCancel} isLoading={isCancelling}>
          Confirm Cancel
        </Button>
      </Modal>

      {/* TRANSFER MODAL */}
      <Modal isOpen={!!transferId} onClose={() => setTransferId(null)} title="Transfer Ticket">
        <div className="space-y-4">
          <input
            type="email"
            placeholder="Enter recipient email"
            value={transferEmail}
            onChange={(e) => setTransferEmail(e.target.value)}
            className="w-full border p-2 rounded"
          />

          {transferError && <Alert variant="error">{transferError}</Alert>}

          <Button onClick={handleTransfer} isLoading={isTransferring}>
            Transfer Ticket
          </Button>
        </div>
      </Modal>
    </div>
  );
}
