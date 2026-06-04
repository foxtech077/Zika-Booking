export function checkListingCompletion(listing: any): { isComplete: boolean; missingFields: string[] } {
  const missingFields: string[] = [];
  if (!listing) return { isComplete: false, missingFields: ["Listing details not loaded"] };

  const category = listing.category;
  const photoCount = Array.isArray(listing.photos) ? listing.photos.length : 0;

  // Common fields
  if (!listing.name?.trim()) missingFields.push("Name/Title");
  if (!listing.description?.trim()) missingFields.push("Description");
  
  const price = listing.pricePerNight != null ? Number(listing.pricePerNight) : null;
  if (price === null || isNaN(price) || price <= 0) {
    missingFields.push(category === "car" ? "Daily rate" : "Price per night");
  }

  // Location fields
  if (!listing.address?.trim() || !listing.town?.trim() || !listing.country?.trim()) {
    missingFields.push("Address, Town & Country");
  }
  if (!listing.cancellationPolicy) missingFields.push("Cancellation Policy");

  if (category === "apartment") {
    if (listing.bedrooms === null || listing.bedrooms === undefined || listing.bedrooms === "") {
      missingFields.push("Bedrooms");
    }
    if (listing.bathrooms === null || listing.bathrooms === undefined || listing.bathrooms === "") {
      missingFields.push("Bathrooms");
    }
    if (listing.maxGuests === null || listing.maxGuests === undefined || Number(listing.maxGuests) < 1) {
      missingFields.push("Max Guest Capacity");
    }
    if (!listing.checkinTime) missingFields.push("Check-in Time");
    if (!listing.checkoutTime) missingFields.push("Check-out Time");
    if (listing.minStayNights === null || listing.minStayNights === undefined || Number(listing.minStayNights) < 1) {
      missingFields.push("Minimum Stay");
    }
    if (photoCount < 3) missingFields.push(`Photos (${photoCount}/3 uploaded)`);
  } else if (category === "car") {
    if (!listing.carMake?.trim()) missingFields.push("Make");
    if (!listing.carModel?.trim()) missingFields.push("Model");
    if (!listing.carYear || isNaN(Number(listing.carYear))) missingFields.push("Year of manufacture");
    if (!listing.transmission) missingFields.push("Transmission");
    if (!listing.fuelType) missingFields.push("Fuel Type");
    if (listing.seats === null || listing.seats === undefined || Number(listing.seats) < 1) {
      missingFields.push("Seats");
    }
    if (listing.minDriverAge === null || listing.minDriverAge === undefined || Number(listing.minDriverAge) < 16) {
      missingFields.push("Minimum Driver Age");
    }
    if (photoCount < 1) missingFields.push("Photos (At least 1 required)");
  } else if (category === "hotel") {
    if (!listing.roomType) missingFields.push("Room Type");
    if (listing.unitCount === null || listing.unitCount === undefined || Number(listing.unitCount) < 1) {
      missingFields.push("Number of Units");
    }
    if (!listing.checkinTime) missingFields.push("Check-in Time");
    if (!listing.checkoutTime) missingFields.push("Check-out Time");
    if (listing.minStayNights === null || listing.minStayNights === undefined || Number(listing.minStayNights) < 1) {
      missingFields.push("Minimum Stay");
    }
    if (photoCount < 1) missingFields.push("Photos (At least 1 required)");
    
    // Check documents
    const docTypes = Array.isArray(listing.documents) ? listing.documents.map((d: any) => d.documentType) : [];
    if (!docTypes.includes("business_licence")) missingFields.push("Business Licence Document");
    if (!docTypes.includes("operating_permit")) missingFields.push("Hotel Operating Permit Document");
    if (!docTypes.includes("tourism_certificate")) missingFields.push("Tourism Certificate Document");
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

export function getListingDisplayStatus(listing: any): { status: string; missingFields: string[] } {
  if (!listing) return { status: "draft", missingFields: [] };
  
  const category = listing.category;
  const { isComplete, missingFields } = checkListingCompletion(listing);

  if (category === "hotel") {
    // Hotels must be approved by admin to be active
    if (listing.status === "approved" || listing.status === "active") {
      return { status: "active", missingFields: [] };
    }
    if (listing.status === "pending_review") {
      return { status: "pending_review", missingFields: [] };
    }
    if (listing.status === "rejected") {
      return { status: "rejected", missingFields: [] };
    }
    return { status: "draft", missingFields };
  } else {
    // Apartments & Cars auto-approve on frontend if complete
    if (listing.status === "active" || listing.status === "approved") {
      return { status: "active", missingFields: [] };
    }
    if (listing.status === "deactivated") {
      return { status: "deactivated", missingFields: [] };
    }
    if (listing.status === "suspended") {
      return { status: "suspended", missingFields: [] };
    }
    // If it's a draft or rejected, check completion
    if (isComplete) {
      return { status: "active", missingFields: [] };
    }
    return { status: "draft", missingFields };
  }
}
