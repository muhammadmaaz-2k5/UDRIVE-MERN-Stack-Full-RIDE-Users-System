import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: async (url, options = {}) => {
      let clerkToken = null;
      try {
        if (typeof window !== "undefined" && (window as any).Clerk?.session) {
          clerkToken = await (window as any).Clerk.session.getToken({ template: 'supabase' });
        }
      } catch (e) {
        console.warn("Failed to get Clerk token", e);
      }
      
      const headers = new Headers(options.headers);
      if (clerkToken) {
        headers.set('Authorization', `Bearer ${clerkToken}`);
      }
      
      return fetch(url, {
        ...options,
        headers,
      });
    }
  },
  realtime: {
    params: { eventsPerSecond: 20 },
  },
});
