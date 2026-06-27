async function run() {
  const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjbXFvemxsMXYwMDA3djR6MGl4YjY2OTM5IiwidHlwZSI6Imd1ZXN0Iiwic3RhdHVzIjoiYWN0aXZlIiwianRpIjoienVneXRuamEiLCJpYXQiOjE3ODIzMDMwMjgsImV4cCI6MTc4MjMwNjYyOH0.vO-v9JTho2a56nx745Wy78bM0kaQI4AGZMpYdxnbw0k";
  const body = {
    bookingId: "5f19c1a1-c75c-4e87-89b9-67f167bc9ce5",
    paymentProvider: "tara",
    mobileNumber: "221771234567"
  };

  try {
    const res = await fetch("http://localhost:3004/payments/initiate", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    console.log("Status:", res.status, res.statusText);
    const json = await res.json();
    console.log("Body:", JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

run();
