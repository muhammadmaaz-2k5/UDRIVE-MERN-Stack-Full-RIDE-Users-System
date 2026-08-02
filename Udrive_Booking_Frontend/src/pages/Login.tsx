import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import styles from './Auth.module.css';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role') || 'customer';
  
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!phone) {
      setError('Phone number is required');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.login(phone);
      if (res.user && res.accessToken) {
        setAuth({ id: res.user._id, phone: res.user.phone, role: res.user.role }, res.accessToken);
        navigate(res.user.role === 'rider' ? '/rider-dashboard' : '/customer-dashboard');
      } else {
        setError(res.message || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred during login. Did you register?');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <button className={styles.backButton} onClick={() => navigate(-1)}>
        <ArrowLeft size={24} />
      </button>

      <div className={styles.content}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Enter your phone number to sign in as a {role}</p>

        <form className={styles.form} onSubmit={handleLogin}>
          <Input 
            label="Phone Number" 
            type="tel" 
            placeholder="+1 234 567 8900" 
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={error}
          />
          <Button type="submit" fullWidth isLoading={isLoading}>
            Continue
          </Button>
        </form>

        <p className={styles.footer}>
          Don't have an account?{' '}
          <span className={styles.link} onClick={() => navigate(`/register?role=${role}`)}>
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
};
