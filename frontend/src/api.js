import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
});

// Sessions
export const createSession = (data) => api.post('/sessions/', data).then((r) => r.data);
export const getSessions = (sport) => api.get('/sessions/', { params: { sport } }).then((r) => r.data);
export const getSession = (id) => api.get(`/sessions/${id}`).then((r) => r.data);
export const getSessionTrends = (sport) => api.get('/sessions/trends', { params: { sport } }).then((r) => r.data);
export const deleteSession = (id) => api.delete(`/sessions/${id}`).then((r) => r.data);

// Clips
export const uploadClip = (formData) =>
  api.post('/clips/', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const getClips = () => api.get('/clips/').then((r) => r.data);
export const getClip = (id) => api.get(`/clips/${id}`).then((r) => r.data);
export const addPlayTag = (clipId, data) => api.post(`/clips/${clipId}/tags`, data).then((r) => r.data);
export const deletePlayTag = (clipId, tagId) => api.delete(`/clips/${clipId}/tags/${tagId}`).then((r) => r.data);
export const deleteClip = (id) => api.delete(`/clips/${id}`).then((r) => r.data);

// Analysis
export const analyzeBasketballClip = (clipId) => api.post(`/clips/${clipId}/analyze`).then((r) => r.data);
export const getAnalysis = (clipId) => api.get(`/clips/${clipId}/analysis`).then((r) => r.data);

// Supervised Review
export const startSupervisedReview = (clipId) => api.post(`/api/supervised/start/${clipId}`).then((r) => r.data);
export const getStatSheet = (sheetId) => api.get(`/api/supervised/sheet/${sheetId}`).then((r) => r.data);
export const reviewEvent = (eventId, data) => api.put(`/api/supervised/events/${eventId}`, data).then((r) => r.data);
export const addManualEvent = (sheetId, data) => api.post(`/api/supervised/events/${sheetId}`, data).then((r) => r.data);
export const deleteEvent = (eventId) => api.delete(`/api/supervised/events/${eventId}`).then((r) => r.data);
export const compileStatSheet = (sheetId) => api.post(`/api/supervised/compile/${sheetId}`).then((r) => r.data);
export const getStatSheets = (sport) => api.get('/api/supervised/sheets', { params: { sport } }).then((r) => r.data);
export const getLatestSheet = (clipId) => api.get(`/api/supervised/sheets/${clipId}/latest`).then((r) => r.data);

// Training Focus
export const generateTrainingFocus = (sport) => api.post('/training/generate', { sport }).then((r) => r.data);
export const getCurrentTraining = (sport) => api.get('/training/current', { params: { sport } }).then((r) => r.data);
export const getTrainingHistory = (sport) => api.get('/training/history', { params: { sport } }).then((r) => r.data);

export default api;
