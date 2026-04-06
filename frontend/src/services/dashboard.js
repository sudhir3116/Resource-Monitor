import api from '../api';

export const getStudentStats = async () => {
    const response = await api.get('/api/dashboard/student');
    return response.data;
};

export const getWardenStats = async () => {
    const response = await api.get('/api/dashboard/warden');
    return response.data;
};

export const getExecutiveStats = async () => {
    const response = await api.get('/api/dashboard/executive');
    return response.data;
};
