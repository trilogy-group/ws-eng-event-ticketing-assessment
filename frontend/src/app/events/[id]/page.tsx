"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Event } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { eventsAPI } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";

export default function EventPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token } = useAuth();

  const eventId = params?.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // WAITLIST STATES
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
  const [isLeavingWaitlist, setIsLeavingWaitlist] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");
  const [waitlistSuccess, setWaitlistSuccess] = useState("");

  const fetchWaitlistPosition = useCallback(async () => {
    if (!token || !eventId) return;

    try {
      const res = await fetch(`/api/waitlist/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const text = await res.text();
      let data: unknown = null;

      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      const payload =
        typeof data === "object" && data !== null
          ? (data as { success?: boolean; data?: { position?: number } })
          : null;

      if (!res.ok) {
        // Not on the waitlist (or auth error); treat as no position.
        setWaitlistPosition(null);
        return;
      }

      if (payload?.success) {
        setWaitlistPosition(payload.data?.position ?? null);
      } else {
        setWaitlistPosition(null);
      }
    } catch {
      // Ignore network errors; keep last known position.
    }
  }, [token, eventId]);

  // Fetch event
  useEffect(() => {
    if (!eventId) return;

    eventsAPI
      .get(eventId)
      .then((res) => setEvent(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [eventId]);

  // Fetch waitlist position
  useEffect(() => {
    fetchWaitlistPosition();
  }, [token, eventId]);

  const isCancelled = event?.status === "CANCELLED";
  const isPastEvent = event ? new Date(event.date) < new Date() : false;

  const isSoldOut = useMemo(() => {
    if (!event) return false;
    return event.soldCount >= event.capacity;
  }, [event]);

  const isDisabled = isCancelled || isPastEvent;

  const handlePurchase = () => {
    if (!user) {
      router.push(`/login?callbackUrl=/events/${eventId}`);
      return;
    }
    alert("Purchase flow not implemented here");
  };

  // JOIN WAITLIST
  const handleJoinWaitlist = async () => {
    if (!token || !eventId) return;

    setIsJoiningWaitlist(true);
    setWaitlistError("");
    setWaitlistSuccess("");

    try {
      const res = await fetch(`/api/waitlist/${eventId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const text = await res.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid server response");
      }

      if (!res.ok) throw new Error(data.message);

      await fetchWaitlistPosition();
      setWaitlistSuccess(`Joined! Position: ${data.data.position}`);
    } catch (err) {
      setWaitlistError(err instanceof Error ? err.message : "Failed to join waitlist");
    } finally {
      setIsJoiningWaitlist(false);
    }
  };

  // LEAVE WAITLIST
  const handleLeaveWaitlist = async () => {
    if (!token || !eventId) return;

    setIsLeavingWaitlist(true);
    setWaitlistError("");
    setWaitlistSuccess("");

    try {
      const res = await fetch(`/api/waitlist/${eventId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to leave waitlist");

      await fetchWaitlistPosition();
      setWaitlistSuccess("Left waitlist");
    } catch (err) {
      setWaitlistError(err instanceof Error ? err.message : "Failed to leave waitlist");
    } finally {
      setIsLeavingWaitlist(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center mt-10">
        <Spinner />
      </div>
    );
  }

  if (!event) {
    return <div className="text-center text-red-500">{error || "Event not found"}</div>;
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-2">{event.name}</h1>
      <p>
        {formatDate(event.date)} • {formatTime(event.date)}
      </p>

      <Card>
        <CardContent className="space-y-4">
          {isSoldOut && !isCancelled && !isPastEvent ? (
            <div className="space-y-3">
              {waitlistPosition ? (
                <>
                  <p>
                    Your position: <b>#{waitlistPosition}</b>
                  </p>
                  <Button onClick={handleLeaveWaitlist} isLoading={isLeavingWaitlist}>
                    Leave Waitlist
                  </Button>
                </>
              ) : (
                <Button onClick={handleJoinWaitlist} isLoading={isJoiningWaitlist}>
                  Join Waitlist
                </Button>
              )}

              {waitlistSuccess && <Alert variant="success">{waitlistSuccess}</Alert>}
              {waitlistError && <Alert variant="error">{waitlistError}</Alert>}
            </div>
          ) : (
            <Button onClick={handlePurchase} disabled={isDisabled || isSoldOut}>
              Buy Ticket
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
