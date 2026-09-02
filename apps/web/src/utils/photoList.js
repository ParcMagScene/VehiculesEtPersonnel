/**
 * Récupère la liste des photos de véhicules disponibles
 */

import api from './api';

export async function getAvailablePhotos() {
  // Source de vérité runtime : API backend qui liste /public/Photos.
  try {
    const data = await api.getVehiclePhotos();
    if (data && Array.isArray(data.photos)) return data.photos;
  } catch {
    /* fallback JSON statique */
  }
  try {
    const response = await fetch('/photos-list.json');
    if (!response.ok) throw new Error('Impossible de charger la liste des photos');
    return await response.json();
  } catch (error) {
    console.error('Erreur lors du chargement de la liste des photos:', error);
    return getPhotosSync();
  }
}

/**
 * Récupère la liste des photos de manière synchrone
 * (utilisé au chargement initial du composant)
 */
export function getPhotosSync() {
  // Liste initiale (sera mise à jour par getAvailablePhotos)
  return [
    'BM-038-NY.jpg',
    'DL-622-TF.jpg',
    'DQ-055-LG.jpg',
    'DS-377-RL.jpg',
    'DT-406-TJ.jpg',
    'DT-692-RE.jpg',
    'EB-855-VR.jpg',
    'EE-446-NG.jpg',
    'EL-720-CX.jpg',
    'GG-043-YZ.jpg',
    'MOV160.jpg',
    'MOV60.jpg',
    'MOV80.jpg',
  ];
}
