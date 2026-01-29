/**
 * Récupère la liste des photos de véhicules disponibles
 */

export async function getAvailablePhotos() {
  try {
    // Charger la liste depuis le fichier JSON généré
    const response = await fetch('/photos-list.json');
    if (!response.ok) {
      throw new Error('Impossible de charger la liste des photos');
    }
    
    const photos = await response.json();
    return photos;
  } catch (error) {
    console.error('Erreur lors du chargement de la liste des photos:', error);
    // Retourner une liste par défaut en cas d'erreur
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
    'MOV80.jpg'
  ];
}
