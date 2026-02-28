import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api, { setToken } from '../api';

type Profile = {
  name: string;
  bmi: number;
  bmi_category: string;
  weight_kg: number;
  height_cm: number;
  lifestyle_level: string;
  water_l?: number;
  diet_type?: string;
  motive?: string;
  age?: number;
  gender?: string;
  food_allergies?: string;
  health_diseases?: string;
  breakfast?: string;
  lunch?: string;
  snacks?: string;
  dinner?: string;
  daily_calories?: number;
};

type Progress = {
  month: string;
  weight_kg: number;
  notes?: string;
};

type Recommendation = {
  water_l: number;
  daily_calories?: number;
};

type ProfileContextType = {
  profile: Profile | null;
  progress: Progress[];
  rec: Recommendation | null;
  loading: boolean;
  refetch: () => void;
  updateProfile: (newProfile: Profile) => void;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

type ProfileProviderProps = {
  children: ReactNode;
};

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token found');
      setLoading(false);
      return;
    }
    setToken(token);

    try {
      console.log('Fetching profile data...');
      const p = await api.get('/profile');
      setProfile(p.data);
      
      try {
        const pr = await api.get('/progress');
        setProgress(pr.data || []);
      } catch {
        setProgress([]);
      }
      
      try {
        const r = await api.get('/recommendations');
        setRec(r.data);
      } catch {
        setRec({ water_l: 2, daily_calories: 2000 });
      }
    } catch (err: any) {
      console.error('Data fetch error:', err.response?.status, err.response?.data || err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const refetch = () => {
    fetchData();
  };

  const updateProfile = (newProfile: Profile) => {
    setProfile(newProfile);
  };

  return (
    <ProfileContext.Provider value={{ profile, progress, rec, loading, refetch, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
};
