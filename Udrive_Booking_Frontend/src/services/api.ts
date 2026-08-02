const API_URL = 'http://localhost:3000';

export interface AuthResponse {
  success: boolean;
  user: {
    _id: string;
    phone: string;
    role: 'customer' | 'rider';
  };
  accessToken?: string;
  refreshToken?: string;
  message?: string;
}

export const api = {
  async register(phone: string, role: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, role }),
      });
      return await response.json();
    } catch (error) {
      throw new Error('Failed to register');
    }
  },

  async login(phone: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      return await response.json();
    } catch (error) {
      throw new Error('Failed to login');
    }
  }
};
