"use client";

import { api } from "@/lib/api";
import type { ApiResponse, AuthResponse } from "@zika/types";

/**
 * Pure helper that talks to the backend and returns a normalized result.
 *
 * Returns an object:
 *   { success: true, data: AuthResponse }  – on a successful login
 *   { success: false, code?: string, message: string } – on any error
 *
 * The calling component decides how to route / display errors.
 */
function showCreateAccountModal(idToken: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]";
    overlay.style.animation = "fadeIn 0.25s ease-out forwards";

    // Add fadeIn style to document if not present
    if (!document.getElementById("google-modal-styles")) {
      const style = document.createElement("style");
      style.id = "google-modal-styles";
      style.innerHTML = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `;
      document.head.appendChild(style);
    }

    // Create card
    const card = document.createElement("div");
    card.className = "bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-gray-100 flex flex-col gap-4";
    card.style.animation = "scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards";

    // Header with Icon
    const header = document.createElement("div");
    header.className = "flex items-center gap-3";

    const iconBg = document.createElement("div");
    iconBg.className = "w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0";
    iconBg.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
      </svg>
    `;

    const titleText = document.createElement("h3");
    titleText.className = "text-lg font-bold text-gray-900";
    titleText.innerText = "Account Not Found";

    header.appendChild(iconBg);
    header.appendChild(titleText);

    // Message
    const body = document.createElement("p");
    body.className = "text-sm text-gray-500 leading-relaxed";
    body.innerText = "You don't have an account registered with this email yet. Would you like to create a new one?";

    // Buttons
    const footer = document.createElement("div");
    footer.className = "flex gap-2 justify-end mt-2";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition duration-150 active:scale-95";
    cancelBtn.innerText = "No, Go Back";
    cancelBtn.onclick = () => {
      cleanup();
      resolve(false);
    };

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "px-4 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-xl transition duration-150 shadow-sm shadow-primary/10 active:scale-95";
    confirmBtn.innerText = "Yes, Create Account";
    confirmBtn.onclick = () => {
      cleanup();
      resolve(true);
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);

    overlay.appendChild(card);

    // Close on backdrop click
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    };

    // Prevent click events inside the card from bubbling to the overlay
    card.onclick = (e) => {
      e.stopPropagation();
    };

    document.body.appendChild(overlay);

    function cleanup() {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    }
  });
}



export async function processGoogleLogin(
  idToken: string
): Promise<
  | { success: true; data: AuthResponse }
  | { success: false; code?: string; message: string; idToken: string }
> {

  let email = "";
  try {
    const parts = idToken.split(".");
    if (parts[1]) {
      const payload = JSON.parse(atob(parts[1]));
      email = payload.email ?? "";
    }
  } catch (e) {
    // ignore
  }



  try {
    const res = await api.post<ApiResponse<AuthResponse>>(
      "/auth/oauth/google",
      { idToken, userType: "provider" }
    );

    if (res.data.success) {
      return { success: true, data: res.data.data };
    }
    // If not successful, fall through to error handling below
    const code = !res.data.success ? res.data.error.code : undefined;
    const message = (!res.data.success ? res.data.error.message : undefined) ?? "";
    return { success: false, code, message, idToken };
  } catch (err: any) {
    const backendError = err.response?.data?.error;
    const message = backendError?.message ?? "Sign in with Google failed. Please try again.";
    const code = backendError?.code;

    // Detect if account doesn't exist (new user)
    // The backend returns REGISTRATION_DENIED when a new user tries to sign in
    // and userType is set to "provider", preventing auto-creation.
    if (code === "REGISTRATION_DENIED") {
      const shouldCreate = await showCreateAccountModal(idToken);
      if (shouldCreate) {
        return {
          success: false,
          code: "EMAIL_NOT_FOUND",
          message: "no account",
          idToken,
        };
      } else {
        return {
          success: false,
          code: "USER_CANCELLED",
          message: "",
          idToken,
        };
      }
    }

    // Existing Traveller with no Google OAuth linked returns ACCOUNT_EXISTS
    // Existing Provider with no Google OAuth linked gets auto-linked by backend
    // If we want to prevent the modal for existing accounts, the above check
    // strictly ensures it only appears for REGISTRATION_DENIED.

    // Detect if email is not verified
    if (code === "EMAIL_NOT_VERIFIED") {
      let email = "";
      try {
        const parts = idToken.split(".");
        if (parts[1]) {
          const payload = JSON.parse(atob(parts[1]));
          email = payload.email ?? "";
        }
      } catch (e) {
        // ignore
      }
      if (email) {
        window.location.href = `/auth/verify-pending?email=${encodeURIComponent(email)}`;
        return {
          success: false,
          code: "USER_CANCELLED",
          message: "",
          idToken,
        };
      }
    }

    // Preserve the idToken so the component can forward it when needed
    return { success: false, code, message, idToken };
  }
}

