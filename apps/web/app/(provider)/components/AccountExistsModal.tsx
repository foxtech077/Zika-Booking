"use client";

import { useRouter } from "next/navigation";

interface AccountExistsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function AccountExistsModal({ isOpen, onClose, onConfirm }: AccountExistsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
        <h2 className="text-lg font-semibold mb-4">Account Already Exists</h2>
        <p className="mb-4 text-sm text-gray-600">
          An account with this Google address already exists. Would you like to create a new account linked to this Google identity?
        </p>
        <div className="flex justify-end space-x-2">
          <button
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
            onClick={onConfirm}
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}
