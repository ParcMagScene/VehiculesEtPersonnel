// Hook — Liste des caméras avec état de chargement
import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

export function useCameraList() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getVideoCameras();
      setCameras(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createCamera = useCallback(async (cameraData) => {
    const created = await api.createVideoCamera(cameraData);
    setCameras(prev => [...prev, created]);
    return created;
  }, []);

  const updateCamera = useCallback(async (id, cameraData) => {
    const updated = await api.updateVideoCamera(id, cameraData);
    setCameras(prev => prev.map(c => c.id === id ? updated : c));
    return updated;
  }, []);

  const deleteCamera = useCallback(async (id) => {
    await api.deleteVideoCamera(id);
    setCameras(prev => prev.filter(c => c.id !== id));
  }, []);

  const testCamera = useCallback(async (id) => {
    const result = await api.testVideoCamera(id);
    setCameras(prev => prev.map(c => c.id === id ? { ...c, status: result.status } : c));
    return result;
  }, []);

  const testAll = useCallback(async () => {
    const results = await api.testAllVideoCameras();
    setCameras(prev => prev.map(c => {
      const r = results.find(x => x.id === c.id);
      return r ? { ...c, status: r.status } : c;
    }));
    return results;
  }, []);

  return { cameras, loading, error, refresh, createCamera, updateCamera, deleteCamera, testCamera, testAll };
}
