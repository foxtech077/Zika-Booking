import axios from "axios";

export const api = axios.create({
  baseURL: "/admin/api",
  withCredentials: true,
  timeout: 15_000,
});

const TOKEN_KEY = "zika:admin_session";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function storeAdminToken(token: string) {
  if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  if (typeof window !== "undefined") sessionStorage.removeItem(TOKEN_KEY);
}

// In-memory store for dev mock API
let mockOperators = [
  {
    id: "dev", name: "Dev Admin", email: "devadmin@zika.com",
    role: "super_admin", countryScope: [], totpEnabled: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  }
];

api.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  
  const isMockToken = token === "dev-session-token" || token?.startsWith("mock-session");
  const isLoginRequest = config.url?.includes("/admin/auth/login");
  const isMeRequest = config.url?.includes("/admin/auth/me");
  
  // Dev mode bypass: completely mock backend responses
  if (isMockToken || isLoginRequest) {
    config.adapter = async (config) => {
      const url = config.url || "";
      const method = config.method?.toLowerCase();
      
      console.log(`[MOCK API] ${method?.toUpperCase()} ${url}`);
      
      let data: any = { success: true };
      
      if (url.includes("/admin/auth/login") && method === "post") {
        const body = JSON.parse(config.data);
        const user = mockOperators.find(op => op.email === body.email);
        
        if (user) {
          // For simplicity, any password works for mock users except if we want to enforce it.
          // We'll just accept any password to make testing easy.
          data = { 
            sessionToken: `mock-session-${user.id}`,
            user,
            totpRequired: false
          };
        } else {
          const err = new Error("Request failed with status code 401") as any;
          err.response = { data: { error: { message: "Incorrect email or password." } }, status: 401 };
          throw err;
        }
      } else if (url.includes("/admin/auth/me") && method === "get") {
        // Return the user matching the token
        const id = token?.replace("mock-session-", "");
        const user = mockOperators.find(op => op.id === id) || mockOperators[0];
        data = { user };
      } else if (url.includes("/admin/operators")) {
        if (method === "get") {
          data = {
            operators: [...mockOperators],
            total: mockOperators.length
          };
        } else if (method === "post") {
          const body = JSON.parse(config.data);
          const newOperator = {
            id: "mock-" + Date.now(),
            ...body,
            totpEnabled: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          mockOperators.push(newOperator);
          data = { operator: newOperator };
        } else if (method === "delete") {
          const id = url.split("/").pop();
          mockOperators = mockOperators.filter(op => op.id !== id);
          data = { message: "Operator deleted" };
        } else if (method === "patch") {
          const id = url.split("/")[url.split("/").length - 2];
          const body = JSON.parse(config.data);
          const idx = mockOperators.findIndex(op => op.id === id);
          if (idx >= 0) {
            mockOperators[idx] = { ...mockOperators[idx], ...body, updatedAt: new Date().toISOString() };
            data = { operator: mockOperators[idx] };
          }
        }
      } else if (method === "get") {
        // Generic fallback for all lists
        data = { total: 0, items: [], logs: [], users: [], operators: [] };
      }

      return {
        data: { success: true, data },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {}
      };
    };
  }
  
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const code   = error?.response?.data?.error?.code ?? "";

    const isAuthFailure =
      status === 401 ||
      (status === 403 && ["ACCOUNT_BANNED", "ACCOUNT_SUSPENDED", "ACCOUNT_INACTIVE", "FORBIDDEN"].includes(code));

    const isLoginPage = typeof window !== "undefined" && window.location.pathname.includes("/login");

    if (isAuthFailure && !isLoginPage && typeof window !== "undefined") {
      // Clear all admin session data then hard-navigate to login
      sessionStorage.removeItem("zika:admin_session");
      sessionStorage.removeItem("zika:admin_auth");
      window.location.href = "/admin/login";
    }

    return Promise.reject(error);
  }
);
