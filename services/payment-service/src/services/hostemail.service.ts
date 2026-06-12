import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);


export async function sendHostEmail(booking: any) {
    return sgMail.send({
      to: booking.listing.hostEmail,
      from: "bookings@zika.com",
      subject: `New booking received — ${booking.code}`,
      html: `
        <h2>New Booking</h2>
        <p>Guest: ${booking.user.name}</p>
        <p>Dates: ${booking.checkIn} - ${booking.checkOut}</p>
        <p>Net payout: ${booking.payoutAmount}</p>
        <p>Payout: T+24h after check-in</p>
      `
    });
  }