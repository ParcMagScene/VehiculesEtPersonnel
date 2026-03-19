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
    const response = await fetch(`${API_URL}/video/cameras/${cameraId}/snapshot`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Snapshot indisponible');
    const blob = await response.blob();
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
}
