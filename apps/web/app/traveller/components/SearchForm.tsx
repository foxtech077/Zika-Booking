// Example: components/Header.tsx
"use client";

import { useState, useEffect } from "react";
// … rest of the component

import React from 'react';

interface SearchFormProps {
  activeTab: 'home' | 'search' | 'bookings';
  setActiveTab: (tab: 'home' | 'search' | 'bookings') => void;
  searchCategory: 'hotel' | 'apartment' | 'car';
  setSearchCategory: (cat: 'hotel' | 'apartment' | 'car') => void;
  searchDestination: string;
  setSearchDestination: (dest: string) => void;
  searchCheckIn: string;
  setSearchCheckIn: (date: string) => void;
  searchCheckOut: string;
  setSearchCheckOut: (date: string) => void;
  searchPickupDate: string;
  setSearchPickupDate: (date: string) => void;
  searchReturnDate: string;
  setSearchReturnDate: (date: string) => void;
  searchGuests: number;
  setSearchGuests: (n: number) => void;
  priceMin: number;
  setPriceMin: (n: number) => void;
  priceMax: number;
  setPriceMax: (n: number) => void;
  selectedRating: number | null;
  setSelectedRating: (n: number | null) => void;
  selectedCancellation: string;
  setSelectedCancellation: (s: string) => void;
  handleSearch: (e?: React.FormEvent) => void;
  searching: boolean;
}

export const SearchForm: React.FC<SearchFormProps> = ({
  activeTab,
  setActiveTab,
  searchCategory,
  setSearchCategory,
  searchDestination,
  setSearchDestination,
  searchCheckIn,
  setSearchCheckIn,
  searchCheckOut,
  setSearchCheckOut,
  searchPickupDate,
  setSearchPickupDate,
  searchReturnDate,
  setSearchReturnDate,
  searchGuests,
  setSearchGuests,
  priceMin,
  setPriceMin,
  priceMax,
  setPriceMax,
  selectedRating,
  setSelectedRating,
  selectedCancellation,
  setSelectedCancellation,
  handleSearch,
  searching,
}) => {
  return (
    <section className="bg-gray-100 min-h-screen py-8">
      {/* Navigation Tabs */}
      <div className="flex justify-center mb-4 space-x-4">
        <button
          className={`px-6 py-2 rounded-full ${
            activeTab === 'home' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'
          }`}
          onClick={() => {
            setActiveTab('home');
          }}
        >
          Home
        </button>
        <button
          className={`px-6 py-2 rounded-full ${
            activeTab === 'search' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'
          }`}
          onClick={() => {
            setActiveTab('search');
          }}
        >
          Search Results
        </button>
        <button
          className={`px-6 py-2 rounded-full ${
            activeTab === 'bookings' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'
          }`}
          onClick={() => {
            setActiveTab('bookings');
          }}
        >
          My Bookings
        </button>
      </div>

      {/* Search Form */}
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Destination */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
            <input
              type="text"
              className="w-full border rounded-md p-2"
              value={searchDestination}
              onChange={(e) => setSearchDestination(e.target.value)}
            />
          </div>

          {/* Dates */}
          {searchCategory !== 'car' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check‑in</label>
                <input
                  type="date"
                  className="w-full border rounded-md p-2"
                  value={searchCheckIn}
                  onChange={(e) => setSearchCheckIn(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check‑out</label>
                <input
                  type="date"
                  className="w-full border rounded-md p-2"
                  value={searchCheckOut}
                  onChange={(e) => setSearchCheckOut(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup</label>
                <input
                  type="datetime-local"
                  className="w-full border rounded-md p-2"
                  value={searchPickupDate}
                  onChange={(e) => setSearchPickupDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Return</label>
                <input
                  type="datetime-local"
                  className="w-full border rounded-md p-2"
                  value={searchReturnDate}
                  onChange={(e) => setSearchReturnDate(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Guests */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Guests</label>
            <input
              type="number"
              min={1}
              className="w-full border rounded-md p-2"
              value={searchGuests}
              onChange={(e) => setSearchGuests(Number(e.target.value))}
            />
          </div>

          {/* Price Range */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Price Range (USD)</label>
            <div className="flex space-x-2 items-center">
              <input
                type="number"
                className="w-1/2 border rounded-md p-2"
                placeholder="Min"
                value={priceMin}
                onChange={(e) => setPriceMin(Number(e.target.value))}
              />
              <span>-</span>
              <input
                type="number"
                className="w-1/2 border rounded-md p-2"
                placeholder="Max"
                value={priceMax}
                onChange={(e) => setPriceMax(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Rating Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
            <select
              className="w-full border rounded-md p-2"
              value={selectedRating ?? ''}
              onChange={(e) => setSelectedRating(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Any</option>
              <option value="5">5★</option>
              <option value="4">4★+</option>
              <option value="3">3★+</option>
            </select>
          </div>

          {/* Cancellation Policy */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cancellation</label>
            <select
              className="w-full border rounded-md p-2"
              value={selectedCancellation}
              onChange={(e) => setSelectedCancellation(e.target.value)}
            >
              <option value="">Any</option>
              <option value="flexible">Flexible</option>
              <option value="moderate">Moderate</option>
              <option value="strict">Strict</option>
            </select>
          </div>

          {/* Submit */}
          <div className="col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={searching}
              className="bg-blue-600 text-white px-6 py-2 rounded-md flex items-center"
            >
              {searching && (
                <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              )}
              Search
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
