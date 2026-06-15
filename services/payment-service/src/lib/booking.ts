const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";

export async function fetchBooking(bookingId: string) {
  const res = await fetch(`${BOOKING_SERVICE_URL}/bookings/${bookingId}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch booking. HTTP Status: ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

export async function confirmBooking(bookingId: string, paymentId: string, paymentProvider: string) {
  const res = await fetch(`${BOOKING_SERVICE_URL}/bookings/${bookingId}/confirm`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId, paymentProvider }),
  });

  if (!res.ok) {
    throw new Error(`Failed to confirm booking. HTTP Status: ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

export async function failBooking(bookingId: string) {
  const res = await fetch(`${BOOKING_SERVICE_URL}/bookings/${bookingId}/fail`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to mark booking as failed. HTTP Status: ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}
