import React, { createContext, useState, useContext } from 'react';
import api from '../api/client';

const AdminContext = createContext();

export const useAdmin = () => {
    const context = useContext(AdminContext);
    if (!context) {
        throw new Error('useAdmin must be used within an AdminProvider');
    }
    return context;
};

export const AdminProvider = ({ children }) => {
    const [adminData, setAdminData] = useState({
        overview: null,
        users: [],
        transactions: [],
        loading: false
    });

    const fetchDashboardData = async () => {
        try {
            setAdminData(prev => ({ ...prev, loading: true }));
            const response = await api.get('/api/admin/dashboard');
            setAdminData(prev => ({
                ...prev,
                overview: response.data,
                loading: false
            }));
            return response.data;
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
            setAdminData(prev => ({ ...prev, loading: false }));
            throw error;
        }
    };

    const fetchUsers = async (params = {}) => {
        try {
            const response = await api.get('/api/admin/users', { params });
            return response.data;
        } catch (error) {
            console.error('Failed to fetch users:', error);
            throw error;
        }
    };

    const fetchUserDetails = async (userId) => {
        try {
            const response = await api.get(`/api/admin/users/${userId}`);
            return response.data;
        } catch (error) {
            console.error('Failed to fetch user details:', error);
            throw error;
        }
    };

    const updateUserStatus = async (userId, isActive) => {
        try {
            const response = await api.put(`/api/admin/users/${userId}/status`, { isActive });
            return response.data;
        } catch (error) {
            console.error('Failed to update user status:', error);
            throw error;
        }
    };

    const updateUserKYC = async (userId, kycStatus) => {
        try {
            const response = await api.put(`/api/admin/users/${userId}/kyc`, { kycStatus });
            return response.data;
        } catch (error) {
            console.error('Failed to update KYC status:', error);
            throw error;
        }
    };

    const fetchTransactions = async (params = {}) => {
        try {
            const response = await api.get('/api/admin/transactions', { params });
            return response.data;
        } catch (error) {
            console.error('Failed to fetch transactions:', error);
            throw error;
        }
    };

    const value = {
        adminData,
        fetchDashboardData,
        fetchUsers,
        fetchUserDetails,
        updateUserStatus,
        updateUserKYC,
        fetchTransactions
    };

    return (
        <AdminContext.Provider value={value}>
            {children}
        </AdminContext.Provider>
    );
};
