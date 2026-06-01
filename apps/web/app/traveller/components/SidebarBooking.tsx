// Example: components/Header.tsx
"use client";

import { useState, useEffect } from "react";
// … rest of the component

import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface SidebarBookingProps {
  listing: any; // replace with Listing type if defined
  searchCategory: string;
  searchGuests: number;
  searchCheckIn: string;
  searchCheckOut: string;
  searchPickupDate: string;
  searchReturnDate: string;
  driverFirstName: string;
  driverLastName: string;
  driverAge: number;
  deliveryRequested: boolean;
  deliveryAddress: string;
  lockingListing: boolean;
  onInitiateLock: () => void;
}

const SidebarBooking: React.FC<SidebarBookingProps> = ({
  listing,
  searchCategory,
  searchGuests,
  searchCheckIn,
  searchCheckOut,
  searchPickupDate,
  searchReturnDate,
  driverFirstName,
  driverLastName,
  driverAge,
  deliveryRequested,
  deliveryAddress,
  lockingListing,
  onInitiateLock,
}) => {
  return (
    <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-6 text-left shadow-slate-200/50">
      <div className="flex justify-between items-baseline mb-6">
        <div className="text-2xl font-bold text-slate-900">
          {listing.pricePerNight} <span className="text-base font-normal text-slate-500">/ {listing.category === 'car' ? 'day' : 'night'}</span>
        </div>
        <div className="text-sm font-semibold flex items-center gap-1 text-slate-800">
          ⭐ {listing.starRating || '4.8'} <span className="text-slate-500 underline ml-1 cursor-pointer">{listing.reviewsCount || 124} reviews</span>
        </div>
      </div>

      {/* Date pickers */}
      {listing.category !== 'car' ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 border-r border-b border-slate-400">
            <div className="text-[10px] font-bold text-slate-900 uppercase">Check‑in</div>
            <input
              type="date"
              value={searchCheckIn}
              onChange={(e) => (searchCheckIn = e.target.value)}
              className="w-full mt-1 text-sm bg-transparent outline-none cursor-pointer"
            />
          </div>
          <div className="p-3 border-b border-slate-400">
            <div className="text-[10px] font-bold text-slate-900 uppercase">Checkout</div>
            <input
              type="date"
              value={searchCheckOut}
              onChange={(e) => (searchCheckOut = e.target.value)}
              className="w-full mt-1 text-sm bg-transparent outline-none cursor-pointer"
            />
          </div>
          <div className="col-span-2 p-3">
            <div className="text-[10px] font-bold text-slate-900 uppercase">Guests</div>
            <select className="w-full mt-1 text-sm bg-transparent outline-none cursor-pointer appearance-none">
              <option>{searchGuests} guests</option>
              <option>1 guest</option>
              <option>2 guests</option>
              <option>3 guests</option>
              <option>4 guests</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 border-r border-slate-400">
            <div className="text-[10px] font-bold text-slate-900 uppercase">Pickup</div>
            <input
              type="date"
              value={searchPickupDate}
              onChange={(e) => (searchPickupDate = e.target.value)}
              className="w-full mt-1 text-sm bg-transparent outline-none cursor-pointer"
            />
          </div>
          <div className="p-3">
            <div className="text-[10px] font-bold text-slate-900 uppercase">Return</div>
            <input
              type="date"
              value={searchReturnDate}
              onChange={(e) => (searchReturnDate = e.target.value)}
              className="w-full mt-1 text-sm bg-transparent outline-none cursor-pointer"
            />
          </div>
          <div className="col-span-2 p-3">
            <div className="text-[10px] font-bold text-slate-900 uppercase">Driver Age</div>
            <input
              type="number"
              min={18}
              value={driverAge}
              onChange={(e) => (driverAge = Number(e.target.value))}
              className="w-full mt-1 text-sm bg-transparent outline-none cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Book Now button */}
      <button
        onClick={onInitiateLock}
        disabled={lockingListing}
        className="w-full py-3.5 bg-[#0B1E3F] hover:bg-[#07152B] text-white font-bold rounded-lg transition text-base"
      >
        {lockingListing ? 'Securing...' : 'Book Now'}
      </button>
      <p className="text-center text-sm text-slate-500 mt-2">You won't be charged yet</p>
    </div>
  );
};

export default SidebarBooking;
