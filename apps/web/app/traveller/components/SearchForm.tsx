import React from "react";
import DateRangePicker from "./DateRangePicker";

interface SearchFormProps {
  searchCategory: "hotel" | "apartment" | "car";
  setSearchCategory: (cat: "hotel" | "apartment" | "car") => void;
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
  handleSearch: (e?: React.FormEvent) => void;
  searching: boolean;
  getTodayString: () => string;
}

const CATEGORIES = [
  { value: "hotel", label: "Hotels" },
  { value: "apartment", label: "Home" },
  { value: "car", label: "Car Rentals" },
] as const;

const SearchForm: React.FC<SearchFormProps> = ({
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
  handleSearch,
  searching,
  getTodayString,
}) => {
  return (
    <form onSubmit={handleSearch} className="space-y-4">
      {/* Category tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => setSearchCategory(cat.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition border ${
              searchCategory === cat.value
                ? "bg-[#0B1E3F] text-white border-[#0B1E3F]"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Destination */}
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Destination
          </label>
          <input
            type="text"
            required
            placeholder="City or location"
            value={searchDestination}
            onChange={(e) => setSearchDestination(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:border-[#0B1E3F]"
          />
        </div>

        {/* Dates */}
        <div className="md:col-span-2">
          {searchCategory !== "car" ? (
            <DateRangePicker
              label="Select Dates"
              startDate={searchCheckIn}
              endDate={searchCheckOut}
              onChange={(start, end) => {
                setSearchCheckIn(start);
                setSearchCheckOut(end);
              }}
              minDate={getTodayString()}
            />
          ) : (
            <DateRangePicker
              label="Select Rental Period"
              isCar
              startDate={searchPickupDate}
              endDate={searchReturnDate}
              onChange={(start, end) => {
                setSearchPickupDate(start);
                setSearchReturnDate(end);
              }}
              minDate={getTodayString()}
            />
          )}
        </div>

        {/* Guests + submit */}
        <div className="flex flex-col justify-between">
          {searchCategory !== "car" && (
            <div className="mb-2">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Guests
              </label>
              <select
                value={searchGuests}
                onChange={(e) => setSearchGuests(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>{n} guest{n > 1 ? "s" : ""}</option>
                ))}
              </select>
            </div>
          )}
          <button
            type="submit"
            disabled={searching}
            className="w-full py-2.5 bg-[#0B1E3F] hover:bg-[#07152B] text-white font-bold rounded-xl transition text-sm disabled:opacity-50"
          >
            {searching ? "Searching…" : "🔍 Search"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default SearchForm;
