-- ── ZikaBooking seed data ─────────────────────────────────────────────────────
-- Provider: testprovider99@zika.com  (cmos7y8zp0009j9kc5o4ed3c0)
-- Guest:    guest1@test.com          (cmosebuyd000ej9kcyqnm3ha3)

-- Commission rate for Kenya
INSERT INTO listing.commission_rates (id, country, rate, set_by, created_at, updated_at)
VALUES (gen_random_uuid(), 'KE', 0.10, 'system', NOW(), NOW())
ON CONFLICT (country) DO UPDATE SET rate = 0.10, updated_at = NOW();

-- ── Hotels (status = 'approved' so they show in search) ──────────────────────

INSERT INTO listing.listings (
  id, provider_id, category, name, room_type, unit_count, description,
  price_per_night, currency, min_stay_nights, checkin_time, checkout_time,
  cancellation_policy, address, lat, lng, town, country,
  claimed_star_rating, star_rating, status, submission_count,
  submitted_at, approved_at, approved_by, activated_at, updated_at, created_at,
  pets_allowed, smoking_allowed
) VALUES
-- Hotel 1: Serena Nairobi
(
  'lst-hotel-001', 'cmos7y8zp0009j9kc5o4ed3c0', 'hotel', 'Serena Hotel Nairobi',
  'deluxe', 120, 'Experience unmatched luxury at Nairobi''s most prestigious address. Set in manicured gardens in the heart of the city, Serena offers world-class facilities including a full spa, outdoor pool, and six gourmet restaurants.',
  15000, 'KES', 1, '14:00', '11:00', 'moderate',
  'Processional Way, Central Business District, Nairobi, Kenya',
  -1.2881, 36.8167, 'Nairobi', 'KE',
  5, 5, 'approved', 1, NOW() - INTERVAL '60 days', NOW() - INTERVAL '50 days',
  'admin', NOW() - INTERVAL '50 days', NOW(), NOW() - INTERVAL '60 days', false, false
),
-- Hotel 2: Villa Rosa Kempinski
(
  'lst-hotel-002', 'cmos7y8zp0009j9kc5o4ed3c0', 'hotel', 'Villa Rosa Kempinski Nairobi',
  'superior', 200, 'Nairobi''s premier luxury hotel, Villa Rosa Kempinski combines timeless European elegance with authentic African warmth. Enjoy the rooftop infinity pool, award-winning La Terrasse restaurant, and seamless city views.',
  22000, 'KES', 1, '15:00', '12:00', 'strict',
  'Chiromo Road, Westlands, Nairobi, Kenya',
  -1.2714, 36.8025, 'Nairobi', 'KE',
  5, 5, 'approved', 1, NOW() - INTERVAL '55 days', NOW() - INTERVAL '45 days',
  'admin', NOW() - INTERVAL '45 days', NOW(), NOW() - INTERVAL '55 days', false, false
),
-- Hotel 3: Tribe Hotel
(
  'lst-hotel-003', 'cmos7y8zp0009j9kc5o4ed3c0', 'hotel', 'Tribe Hotel Nairobi',
  'standard', 80, 'A boutique lifestyle hotel with an eclectic design inspired by the rich cultural tapestry of Africa. Tribe sits in the leafy suburb of Gigiri, close to UN HQ and the Village Market. Features live music, a rooftop terrace, and artisan dining.',
  9500, 'KES', 1, '14:00', '12:00', 'flexible',
  'Limuru Road, Gigiri, Nairobi, Kenya',
  -1.2355, 36.8059, 'Nairobi', 'KE',
  4, 4, 'approved', 1, NOW() - INTERVAL '90 days', NOW() - INTERVAL '80 days',
  'admin', NOW() - INTERVAL '80 days', NOW(), NOW() - INTERVAL '90 days', false, false
),
-- Hotel 4: Ole Sereni
(
  'lst-hotel-004', 'cmos7y8zp0009j9kc5o4ed3c0', 'hotel', 'Ole Sereni Hotel',
  'standard', 65, 'Uniquely positioned on the edge of Nairobi National Park, Ole Sereni lets you watch lions and giraffes from your bedroom window. The rooftop pool, Africana restaurant, and personalised safari concierge make it unforgettable.',
  8000, 'KES', 1, '14:00', '11:00', 'moderate',
  'Langata Road, Nairobi, Kenya',
  -1.3220, 36.8200, 'Nairobi', 'KE',
  4, 4, 'approved', 1, NOW() - INTERVAL '70 days', NOW() - INTERVAL '60 days',
  'admin', NOW() - INTERVAL '60 days', NOW(), NOW() - INTERVAL '70 days', true, false
),
-- Hotel 5: Mombasa - PrideInn Paradise
(
  'lst-hotel-005', 'cmos7y8zp0009j9kc5o4ed3c0', 'hotel', 'PrideInn Paradise Beach Resort',
  'deluxe', 150, 'A stunning beach resort on the pristine shores of Shanzu Beach. Enjoy direct ocean access, three swimming pools, a water park, live entertainment and a wide selection of watersports. All-inclusive packages available.',
  12000, 'KES', 2, '15:00', '10:00', 'moderate',
  'Shanzu Beach, Mombasa, Kenya',
  -3.9120, 39.7240, 'Mombasa', 'KE',
  4, 4, 'approved', 1, NOW() - INTERVAL '100 days', NOW() - INTERVAL '90 days',
  'admin', NOW() - INTERVAL '90 days', NOW(), NOW() - INTERVAL '100 days', false, false
),
-- Hotel 6: Mombasa - Voyager Beach Resort
(
  'lst-hotel-006', 'cmos7y8zp0009j9kc5o4ed3c0', 'hotel', 'Voyager Beach Resort Mombasa',
  'standard', 90, 'A classic beach resort set in lush tropical gardens, steps from the white-sand beaches of Mombasa''s North Coast. Voyager features all-inclusive dining, a pool, beach volleyball, and evening shows for the whole family.',
  7500, 'KES', 2, '14:00', '10:00', 'flexible',
  'Bamburi Beach, Mombasa, Kenya',
  -3.9820, 39.7260, 'Mombasa', 'KE',
  3, 3, 'approved', 1, NOW() - INTERVAL '80 days', NOW() - INTERVAL '70 days',
  'admin', NOW() - INTERVAL '70 days', NOW(), NOW() - INTERVAL '80 days', false, false
);

-- ── Apartments (status = 'active') ───────────────────────────────────────────

INSERT INTO listing.listings (
  id, provider_id, category, name, bedrooms, bathrooms, max_guests, description,
  price_per_night, currency, min_stay_nights, checkin_time, checkout_time,
  cancellation_policy, address, lat, lng, town, country,
  status, submission_count, submitted_at, approved_at, approved_by, activated_at,
  updated_at, created_at, pets_allowed, smoking_allowed,
  long_stay_discount_enabled, long_stay_min_nights, long_stay_discount_type, long_stay_discount_value
) VALUES
-- Apartment 1: City Centre
(
  'lst-apt-001', 'cmos7y8zp0009j9kc5o4ed3c0', 'apartment', 'Modern 2BR Apartment – Nairobi CBD',
  2, 2, 5, 'Stylish 2-bedroom apartment in the heart of Nairobi CBD. Floor-to-ceiling windows with panoramic city views, fully equipped kitchen, high-speed Wi-Fi, and 24/7 security. Walking distance to top restaurants, UN Avenue, and Uhuru Park.',
  5500, 'KES', 2, '15:00', '11:00', 'flexible',
  'Upper Hill, Nairobi, Kenya',
  -1.2962, 36.8192, 'Nairobi', 'KE',
  'active', 1, NOW() - INTERVAL '40 days', NOW() - INTERVAL '35 days',
  'admin', NOW() - INTERVAL '35 days', NOW(), NOW() - INTERVAL '40 days', false, false,
  true, 7, 'percentage', 15
),
-- Apartment 2: Studio Westlands
(
  'lst-apt-002', 'cmos7y8zp0009j9kc5o4ed3c0', 'apartment', 'Cosy Studio – Westlands',
  1, 1, 2, 'A chic, self-contained studio in Westlands, Nairobi''s most vibrant neighbourhood. Minutes from Junction Mall, top restaurants, and the Sarit Centre. Includes a kitchenette, workspace, smart TV and secure parking.',
  3200, 'KES', 1, '14:00', '11:00', 'moderate',
  'Westlands Road, Westlands, Nairobi, Kenya',
  -1.2660, 36.8120, 'Nairobi', 'KE',
  'active', 1, NOW() - INTERVAL '50 days', NOW() - INTERVAL '45 days',
  'admin', NOW() - INTERVAL '45 days', NOW(), NOW() - INTERVAL '50 days', true, false,
  false, NULL, NULL, NULL
),
-- Apartment 3: Family Suite Lavington
(
  'lst-apt-003', 'cmos7y8zp0009j9kc5o4ed3c0', 'apartment', 'Spacious 3BR Family Apartment – Lavington',
  3, 2, 7, 'A beautifully furnished 3-bedroom family apartment in the quiet, leafy suburb of Lavington. Features a full kitchen, private garden, children''s play area, and a home office. Ideal for extended stays and family relocations.',
  8500, 'KES', 3, '15:00', '11:00', 'strict',
  'James Gichuru Road, Lavington, Nairobi, Kenya',
  -1.2840, 36.7730, 'Nairobi', 'KE',
  'active', 1, NOW() - INTERVAL '30 days', NOW() - INTERVAL '25 days',
  'admin', NOW() - INTERVAL '25 days', NOW(), NOW() - INTERVAL '30 days', true, false,
  true, 14, 'percentage', 20
);

-- ── Car Rentals (status = 'active') ──────────────────────────────────────────

INSERT INTO listing.listings (
  id, provider_id, category, name, car_make, car_model, car_year,
  transmission, fuel_type, seats, doors, mileage_policy, mileage_limit_km,
  description, price_per_night, currency, checkin_time, checkout_time,
  cancellation_policy, address, lat, lng, town, country,
  status, submission_count, submitted_at, approved_at, approved_by, activated_at,
  updated_at, created_at, min_stay_nights
) VALUES
-- Car 1: Toyota Prado
(
  'lst-car-001', 'cmos7y8zp0009j9kc5o4ed3c0', 'car', 'Toyota Land Cruiser Prado 2022',
  'Toyota', 'Land Cruiser Prado', 2022,
  'automatic', 'diesel', 7, 4, 'limited', 300,
  'Well-maintained 2022 Toyota Land Cruiser Prado in pristine condition. Ideal for both city driving and off-road safaris. Comes with GPS navigation, bull bar, snorkel, rooftop carrier, and full insurance. Perfect for upcountry trips.',
  9500, 'KES', '08:00', '08:00', 'moderate',
  'Westlands, Nairobi, Kenya',
  -1.2680, 36.8050, 'Nairobi', 'KE',
  'active', 1, NOW() - INTERVAL '45 days', NOW() - INTERVAL '40 days',
  'admin', NOW() - INTERVAL '40 days', NOW(), NOW() - INTERVAL '45 days', 1
),
-- Car 2: Toyota Fielder
(
  'lst-car-002', 'cmos7y8zp0009j9kc5o4ed3c0', 'car', 'Toyota Fielder 2021',
  'Toyota', 'Fielder', 2021,
  'automatic', 'petrol', 5, 4, 'unlimited', NULL,
  'Reliable and fuel-efficient 2021 Toyota Fielder, perfect for city errands and short upcountry trips. Clean interior, well-serviced, and comes with free delivery within Nairobi. Unlimited mileage with no hidden charges.',
  4500, 'KES', '08:00', '08:00', 'flexible',
  'CBD, Nairobi, Kenya',
  -1.2921, 36.8219, 'Nairobi', 'KE',
  'active', 1, NOW() - INTERVAL '35 days', NOW() - INTERVAL '30 days',
  'admin', NOW() - INTERVAL '30 days', NOW(), NOW() - INTERVAL '35 days', 1
),
-- Car 3: Hyundai Tucson
(
  'lst-car-003', 'cmos7y8zp0009j9kc5o4ed3c0', 'car', 'Hyundai Tucson 2023',
  'Hyundai', 'Tucson', 2023,
  'automatic', 'petrol', 5, 4, 'limited', 250,
  'Brand new 2023 Hyundai Tucson SUV with premium interior finishes. Bluetooth audio, lane assist, reversing camera, and leather seats. Ideal for business travel or weekend getaways. Fuel efficient and comfortable.',
  7000, 'KES', '08:00', '08:00', 'moderate',
  'Kilimani, Nairobi, Kenya',
  -1.2896, 36.7870, 'Nairobi', 'KE',
  'active', 1, NOW() - INTERVAL '20 days', NOW() - INTERVAL '15 days',
  'admin', NOW() - INTERVAL '15 days', NOW(), NOW() - INTERVAL '20 days', 1
);

-- ── Photos ────────────────────────────────────────────────────────────────────

INSERT INTO listing.listing_photos (id, listing_id, s3_key, cdn_url, position, uploaded_at) VALUES
-- Hotel 1 - Serena (warm luxury hotel photos)
(gen_random_uuid(), 'lst-hotel-001', 'photos/h001-1.jpg', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80', 1, NOW()),
(gen_random_uuid(), 'lst-hotel-001', 'photos/h001-2.jpg', 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80', 2, NOW()),
(gen_random_uuid(), 'lst-hotel-001', 'photos/h001-3.jpg', 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200&q=80', 3, NOW()),
(gen_random_uuid(), 'lst-hotel-001', 'photos/h001-4.jpg', 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200&q=80', 4, NOW()),

-- Hotel 2 - Kempinski (elegant modern hotel)
(gen_random_uuid(), 'lst-hotel-002', 'photos/h002-1.jpg', 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80', 1, NOW()),
(gen_random_uuid(), 'lst-hotel-002', 'photos/h002-2.jpg', 'https://images.unsplash.com/photo-1549294413-26f195200c16?w=1200&q=80', 2, NOW()),
(gen_random_uuid(), 'lst-hotel-002', 'photos/h002-3.jpg', 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=1200&q=80', 3, NOW()),
(gen_random_uuid(), 'lst-hotel-002', 'photos/h002-4.jpg', 'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=1200&q=80', 4, NOW()),

-- Hotel 3 - Tribe (boutique, artistic)
(gen_random_uuid(), 'lst-hotel-003', 'photos/h003-1.jpg', 'https://images.unsplash.com/photo-1605346434674-a440ca4dc4c0?w=1200&q=80', 1, NOW()),
(gen_random_uuid(), 'lst-hotel-003', 'photos/h003-2.jpg', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?w=1200&q=80', 2, NOW()),
(gen_random_uuid(), 'lst-hotel-003', 'photos/h003-3.jpg', 'https://images.unsplash.com/photo-1543968996-ee822b8176ba?w=1200&q=80', 3, NOW()),

-- Hotel 4 - Ole Sereni (nature view)
(gen_random_uuid(), 'lst-hotel-004', 'photos/h004-1.jpg', 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80', 1, NOW()),
(gen_random_uuid(), 'lst-hotel-004', 'photos/h004-2.jpg', 'https://images.unsplash.com/photo-1587213811864-46e59f79a2b2?w=1200&q=80', 2, NOW()),
(gen_random_uuid(), 'lst-hotel-004', 'photos/h004-3.jpg', 'https://images.unsplash.com/photo-1519449556851-5720b33024e7?w=1200&q=80', 3, NOW()),

-- Hotel 5 - PrideInn Mombasa (beach resort)
(gen_random_uuid(), 'lst-hotel-005', 'photos/h005-1.jpg', 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80', 1, NOW()),
(gen_random_uuid(), 'lst-hotel-005', 'photos/h005-2.jpg', 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80', 2, NOW()),
(gen_random_uuid(), 'lst-hotel-005', 'photos/h005-3.jpg', 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&q=80', 3, NOW()),
(gen_random_uuid(), 'lst-hotel-005', 'photos/h005-4.jpg', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80', 4, NOW()),

-- Hotel 6 - Voyager Mombasa (beach/pool)
(gen_random_uuid(), 'lst-hotel-006', 'photos/h006-1.jpg', 'https://images.unsplash.com/photo-1587922546307-776227941871?w=1200&q=80', 1, NOW()),
(gen_random_uuid(), 'lst-hotel-006', 'photos/h006-2.jpg', 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=1200&q=80', 2, NOW()),
(gen_random_uuid(), 'lst-hotel-006', 'photos/h006-3.jpg', 'https://images.unsplash.com/photo-1476673160081-cf065607f449?w=1200&q=80', 3, NOW()),

-- Apartment 1 - 2BR CBD (modern city apartment)
(gen_random_uuid(), 'lst-apt-001', 'photos/a001-1.jpg', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80', 1, NOW()),
(gen_random_uuid(), 'lst-apt-001', 'photos/a001-2.jpg', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80', 2, NOW()),
(gen_random_uuid(), 'lst-apt-001', 'photos/a001-3.jpg', 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80', 3, NOW()),

-- Apartment 2 - Studio Westlands
(gen_random_uuid(), 'lst-apt-002', 'photos/a002-1.jpg', 'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=1200&q=80', 1, NOW()),
(gen_random_uuid(), 'lst-apt-002', 'photos/a002-2.jpg', 'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200&q=80', 2, NOW()),
(gen_random_uuid(), 'lst-apt-002', 'photos/a002-3.jpg', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&q=80', 3, NOW()),

-- Apartment 3 - 3BR Lavington
(gen_random_uuid(), 'lst-apt-003', 'photos/a003-1.jpg', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80', 1, NOW()),
(gen_random_uuid(), 'lst-apt-003', 'photos/a003-2.jpg', 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1200&q=80', 2, NOW()),
(gen_random_uuid(), 'lst-apt-003', 'photos/a003-3.jpg', 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80', 3, NOW()),

-- Car 1 - Land Cruiser Prado
(gen_random_uuid(), 'lst-car-001', 'photos/c001-1.jpg', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=1200&q=80', 1, NOW()),
(gen_random_uuid(), 'lst-car-001', 'photos/c001-2.jpg', 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=1200&q=80', 2, NOW()),
(gen_random_uuid(), 'lst-car-001', 'photos/c001-3.jpg', 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1200&q=80', 3, NOW()),

-- Car 2 - Toyota Fielder
(gen_random_uuid(), 'lst-car-002', 'photos/c002-1.jpg', 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=1200&q=80', 1, NOW()),
(gen_random_uuid(), 'lst-car-002', 'photos/c002-2.jpg', 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=1200&q=80', 2, NOW()),

-- Car 3 - Hyundai Tucson
(gen_random_uuid(), 'lst-car-003', 'photos/c003-1.jpg', 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1200&q=80', 1, NOW()),
(gen_random_uuid(), 'lst-car-003', 'photos/c003-2.jpg', 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=1200&q=80', 2, NOW()),
(gen_random_uuid(), 'lst-car-003', 'photos/c003-3.jpg', 'https://images.unsplash.com/photo-1575090017691-c13f3b0c13e1?w=1200&q=80', 3, NOW());

-- ── Amenities ─────────────────────────────────────────────────────────────────

INSERT INTO listing.listing_amenities (listing_id, amenity_key) VALUES
-- Serena Hotel
('lst-hotel-001', 'wifi'), ('lst-hotel-001', 'pool'), ('lst-hotel-001', 'spa'),
('lst-hotel-001', 'gym'), ('lst-hotel-001', 'restaurant'), ('lst-hotel-001', 'bar'),
('lst-hotel-001', 'room_service'), ('lst-hotel-001', 'parking'), ('lst-hotel-001', 'air_conditioning'),
('lst-hotel-001', 'concierge'),
-- Kempinski
('lst-hotel-002', 'wifi'), ('lst-hotel-002', 'pool'), ('lst-hotel-002', 'spa'),
('lst-hotel-002', 'gym'), ('lst-hotel-002', 'restaurant'), ('lst-hotel-002', 'bar'),
('lst-hotel-002', 'room_service'), ('lst-hotel-002', 'parking'), ('lst-hotel-002', 'air_conditioning'),
('lst-hotel-002', 'concierge'), ('lst-hotel-002', 'business_center'),
-- Tribe Hotel
('lst-hotel-003', 'wifi'), ('lst-hotel-003', 'pool'), ('lst-hotel-003', 'gym'),
('lst-hotel-003', 'restaurant'), ('lst-hotel-003', 'bar'), ('lst-hotel-003', 'parking'),
('lst-hotel-003', 'air_conditioning'), ('lst-hotel-003', 'room_service'),
-- Ole Sereni
('lst-hotel-004', 'wifi'), ('lst-hotel-004', 'pool'), ('lst-hotel-004', 'restaurant'),
('lst-hotel-004', 'bar'), ('lst-hotel-004', 'parking'), ('lst-hotel-004', 'air_conditioning'),
-- PrideInn Mombasa
('lst-hotel-005', 'wifi'), ('lst-hotel-005', 'pool'), ('lst-hotel-005', 'beach_access'),
('lst-hotel-005', 'restaurant'), ('lst-hotel-005', 'bar'), ('lst-hotel-005', 'parking'),
('lst-hotel-005', 'air_conditioning'), ('lst-hotel-005', 'gym'),
-- Voyager Mombasa
('lst-hotel-006', 'wifi'), ('lst-hotel-006', 'pool'), ('lst-hotel-006', 'beach_access'),
('lst-hotel-006', 'restaurant'), ('lst-hotel-006', 'bar'), ('lst-hotel-006', 'air_conditioning'),
-- CBD Apartment
('lst-apt-001', 'wifi'), ('lst-apt-001', 'kitchen'), ('lst-apt-001', 'washing_machine'),
('lst-apt-001', 'parking'), ('lst-apt-001', 'air_conditioning'), ('lst-apt-001', 'workspace'),
('lst-apt-001', 'tv'), ('lst-apt-001', 'security'),
-- Studio Westlands
('lst-apt-002', 'wifi'), ('lst-apt-002', 'kitchen'), ('lst-apt-002', 'air_conditioning'),
('lst-apt-002', 'tv'), ('lst-apt-002', 'parking'), ('lst-apt-002', 'workspace'),
-- 3BR Lavington
('lst-apt-003', 'wifi'), ('lst-apt-003', 'kitchen'), ('lst-apt-003', 'washing_machine'),
('lst-apt-003', 'parking'), ('lst-apt-003', 'garden'), ('lst-apt-003', 'air_conditioning'),
('lst-apt-003', 'tv'), ('lst-apt-003', 'security'), ('lst-apt-003', 'workspace');

-- ── Bookings ──────────────────────────────────────────────────────────────────

INSERT INTO listing.bookings (
  id, reference, listing_id, guest_id, provider_id, listing_type,
  status, check_in, check_out, nights_or_days,
  guest_first_name, guest_last_name, guest_email, adults, children, special_requests,
  nightly_rate, subtotal, discount_amount, total_amount, currency, security_deposit,
  commission_rate, commission_amount, provider_payout,
  cancellation_policy, voucher_discount,
  confirmed_at, created_at, updated_at
) VALUES
-- Booking 1: Upcoming confirmed stay at Tribe Hotel (next month)
(
  'bkg-001', 'ZB-2026-TRB001', 'lst-hotel-003', 'cmosebuyd000ej9kcyqnm3ha3', 'cmos7y8zp0009j9kc5o4ed3c0', 'hotel',
  'confirmed', '2026-06-10', '2026-06-14', 4,
  'John', 'Doe', 'guest1@test.com', 2, 0, 'Late check-in please, arriving around 10 PM.',
  9500, 38000, 0, 38000, 'KES', NULL,
  0.10, 3800, 34200,
  'flexible', 0,
  NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'
),
-- Booking 2: Upcoming confirmed car rental (next week)
(
  'bkg-002', 'ZB-2026-CAR001', 'lst-car-001', 'cmosebuyd000ej9kcyqnm3ha3', 'cmos7y8zp0009j9kc5o4ed3c0', 'car',
  'confirmed', NULL, NULL, 3,
  'John', 'Doe', 'guest1@test.com', NULL, NULL, NULL,
  9500, 28500, 0, 28500, 'KES', 15000,
  0.10, 2850, 25650,
  'moderate', 0,
  NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'
),
-- Booking 3: Completed stay at Serena (last month — reviewable)
(
  'bkg-003', 'ZB-2026-SER001', 'lst-hotel-001', 'cmosebuyd000ej9kcyqnm3ha3', 'cmos7y8zp0009j9kc5o4ed3c0', 'hotel',
  'completed', '2026-04-01', '2026-04-04', 3,
  'John', 'Doe', 'guest1@test.com', 2, 0, NULL,
  15000, 45000, 0, 45000, 'KES', NULL,
  0.10, 4500, 40500,
  'moderate', 0,
  NOW() - INTERVAL '40 days', NOW() - INTERVAL '42 days', NOW() - INTERVAL '35 days'
),
-- Booking 4: Completed apartment stay (two months ago — with review)
(
  'bkg-004', 'ZB-2026-APT001', 'lst-apt-001', 'cmosebuyd000ej9kcyqnm3ha3', 'cmos7y8zp0009j9kc5o4ed3c0', 'apartment',
  'completed', '2026-03-05', '2026-03-12', 7,
  'John', 'Doe', 'guest1@test.com', 2, 1, 'We will need a cot for the baby.',
  5500, 38500, 5775, 32725, 'KES', NULL,
  0.10, 3273, 29452,
  'flexible', 0,
  NOW() - INTERVAL '65 days', NOW() - INTERVAL '70 days', NOW() - INTERVAL '57 days'
);

-- Booking status log entries
INSERT INTO listing.booking_status_log (id, booking_id, from_status, to_status, changed_by, actor_type, created_at) VALUES
(gen_random_uuid(), 'bkg-001', 'pending_payment', 'confirmed', 'system', 'system', NOW() - INTERVAL '5 days'),
(gen_random_uuid(), 'bkg-002', 'pending_payment', 'confirmed', 'system', 'system', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'bkg-003', 'pending_payment', 'confirmed', 'system', 'system', NOW() - INTERVAL '42 days'),
(gen_random_uuid(), 'bkg-003', 'confirmed',        'completed', 'system', 'system', NOW() - INTERVAL '35 days'),
(gen_random_uuid(), 'bkg-004', 'pending_payment', 'confirmed', 'system', 'system', NOW() - INTERVAL '70 days'),
(gen_random_uuid(), 'bkg-004', 'confirmed',        'completed', 'system', 'system', NOW() - INTERVAL '57 days');

-- ── Reviews (for completed bookings) ─────────────────────────────────────────

INSERT INTO listing.listing_reviews (
  id, booking_id, listing_id, guest_id, rating, title, body,
  provider_reply, provider_replied_at, created_at, updated_at
) VALUES
-- Review for the completed apartment booking (bkg-004)
(
  gen_random_uuid(), 'bkg-004', 'lst-apt-001', 'cmosebuyd000ej9kcyqnm3ha3',
  5, 'Absolutely loved it!',
  'The apartment was spotless and exactly as described. The views over Upper Hill were incredible, especially at night. Kitchen was fully stocked with everything we needed. The 24/7 security gave us great peace of mind. Will definitely be back!',
  'Thank you so much for the wonderful review! We hope to host you and your family again very soon.',
  NOW() - INTERVAL '54 days', NOW() - INTERVAL '57 days', NOW() - INTERVAL '54 days'
);

-- ── Loyalty points (simulate earned points from completed bookings) ────────────
-- bkg-003: 45000 KES × 2% = 900 points → bronze tier preserved
-- bkg-004: 32725 KES × 2% = 655 points
-- Total = 1555 points → Silver tier

UPDATE "User"
SET "loyaltyPoints" = 1555, "currentTier" = 'silver'
WHERE id = 'cmosebuyd000ej9kcyqnm3ha3';

-- Confirm row counts
SELECT 'listings' AS tbl, COUNT(*) FROM listing.listings
UNION ALL SELECT 'listing_photos', COUNT(*) FROM listing.listing_photos
UNION ALL SELECT 'listing_amenities', COUNT(*) FROM listing.listing_amenities
UNION ALL SELECT 'bookings', COUNT(*) FROM listing.bookings
UNION ALL SELECT 'listing_reviews', COUNT(*) FROM listing.listing_reviews;
