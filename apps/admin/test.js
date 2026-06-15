import axios from "axios";

(async () => {
  try {
    const res = await axios.post("http://localhost:3003/admin/vouchers", {
      title: "Test Voucher",
      code: "TEST1234",
      activityScope: "universal",
      discountType: "percentage",
      discountValue: 10,
      validFrom: "2026-06-01T00:00:00Z",
      validUntil: "2026-06-30T00:00:00Z"
    }, {
      headers: {
        Authorization: "Bearer test"
      }
    });
    console.log("SUCCESS:", res.data);
  } catch (err) {
    console.log("ERROR STATUS:", err.response?.status);
    console.log("ERROR DATA:", JSON.stringify(err.response?.data, null, 2));
  }
})();
