// API Client — Module Vidéo Surveillance
import { toCamelCase, toSnakeCase, API_URL } from './base.js';

export function registerVideoMethods(ApiClient) {
  // ── Caméras CRUD ──

  ApiClient.prototype.getVideoCameras = async function () {
    const data = await this.request('/video/cameras');
    return toCamelCase(data);
  };

  ApiClient.prototype.getVideoCamera = async function (id) {
    const data = await this.request(`/video/cameras/${id}`);
    return toCamelCase(data);
  };

  ApiClient.prototype.createVideoCamera = async function (cameraData) {
    const data = await this.request('/video/cameras', {
      method: 'POST',
      body: JSON.stringify(toSnakeCase(cameraData)),
    });
    return toCamelCase(data);
  };

  ApiClient.prototype.updateVideoCamera = async function (id, cameraData) {
    const data = await this.request(`/video/cameras/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toSnakeCase(cameraData)),
    });
    return toCamelCase(data);
  };

  ApiClient.prototype.deleteVideoCamera = async function (id) {
    return this.request(`/video/cameras/${id}`, { method: 'DELETE' });
  };

  // ── WebRTC ──

  ApiClient.prototype.whepNegotiate = async function (cameraId, offerSdp) {
    return this.request(`/video/cameras/${cameraId}/whep`, {
      method: 'POST',
      body: JSON.stringify({ sdp: offerSdp }),
    });
  };

  ApiClient.prototype.closeVideoSession = async function (token) {
    return this.request(`/video/sessions/${token}/close`, { method: 'POST' });
  };

  // ── PTZ ──

  ApiClient.prototype.sendPTZCommand = async function (cameraId, command, speed = 1) {
    return this.request(`/video/cameras/${cameraId}/ptz`, {
      method: 'POST',
      body: JSON.stringify({ command, speed }),
    });
  };

  // ── Snapshot ──

  ApiClient.prototype.getSnapshotUrl = function (cameraId) {
    return `${API_URL}/video/cameras/${cameraId}/snapshot`;
  };

  ApiClient.prototype.getSnapshot = async function (cameraId) {
    const blob = await this.requestBlob(`/video/cameras/${cameraId}/snapshot`);
    return URL.createObjectURL(blob);
  };

  // ── Admin ──

  ApiClient.prototype.getVideoLogs = async function (params = {}) {
    const qs = new URLSearchParams(params).toString();
    const data = await this.request(`/video/logs${qs ? '?' + qs : ''}`);
    return toCamelCase(data);
  };

  ApiClient.prototype.getVideoSessions = async function () {
    const data = await this.request('/video/sessions');
    return toCamelCase(data);
  };

  ApiClient.prototype.getVideoProxyStatus = async function () {
    return this.request('/video/proxy-status');
  };

  ApiClient.prototype.testVideoCamera = async function (id) {
    return this.request(`/video/cameras/${id}/test`, { method: 'POST' });
  };

  ApiClient.prototype.testAllVideoCameras = async function () {
    return this.request('/video/cameras/test-all', { method: 'POST' });
  };

  // ── Enregistrements / Playback ──

  ApiClient.prototype.getRecordings = async function (cameraId, date) {
    const data = await this.request(`/video/cameras/${cameraId}/recordings?date=${date}`);
    return toCamelCase(data);
  };

  ApiClient.prototype.startPlayback = async function (cameraId, offerSdp, startTime, endTime) {
    return this.request(`/video/cameras/${cameraId}/playback`, {
      method: 'POST',
      body: JSON.stringify({ sdp: offerSdp, startTime, endTime }),
    });
  };

  // ── Presets (vues multi-caméras) ──

  ApiClient.prototype.getVideoPresets = async function () {
    const data = await this.request('/video/presets');
    return toCamelCase(data);
  };

  ApiClient.prototype.createVideoPreset = async function (presetData) {
    const data = await this.request('/video/presets', {
      method: 'POST',
      body: JSON.stringify(toSnakeCase(presetData)),
    });
    return toCamelCase(data);
  };

  ApiClient.prototype.updateVideoPreset = async function (id, presetData) {
    const data = await this.request(`/video/presets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toSnakeCase(presetData)),
    });
    return toCamelCase(data);
  };

  ApiClient.prototype.deleteVideoPreset = async function (id) {
    return this.request(`/video/presets/${id}`, { method: 'DELETE' });
  };
}
