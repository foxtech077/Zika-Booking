// Example: components/Header.tsx
"use client";

import { useState, useEffect } from "react";
// … rest of the component

import React from 'react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onSearch: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  searchTerm,
  setSearchTerm,
  onSearch,
}) => {
  return (
    <section className="bg-gray-100 py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
          Find Your Dream {activeTab === 'stay' ? 'Stay' : 'Car'}
        </h1>
        <div className="flex justify-center mb-6 space-x-4">
          <button
            className={`px-6 py-2 rounded-full ${
              activeTab === 'stay'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border'
            }`}
            onClick={() => {
              setActiveTab('stay');
              onSearch();
            }}
          >
            Stays
          </button>
          <button
            className={`px-6 py-2 rounded-full ${
              activeTab === 'car'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border'
            }`}
            onClick={() => {
              setActiveTab('car');
              onSearch();
            }}
          >
            Car Rentals
          </button>
        </div>
        <div className="flex justify-center">
          <input
            type="text"
            placeholder="Search by location"
            className="border rounded-l-md p-2 w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            className="bg-blue-600 text-white px-4 rounded-r-md"
            onClick={onSearch}
          >
            Search
          </button>
        </div>
      </div>
    </section>
  );
};
