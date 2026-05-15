// Script pour vérifier le hash bcrypt d'un mot de passe
import bcrypt from 'bcrypt';

const hash = '$2b$10$CISB/S9DJZEV/JhECcJ5ne/9Hb7h5CmKRCwBL.94695g2ZMfOM5Em';
const password = 'admin2026';

bcrypt.compare(password, hash).then(match => {
  console.log('Match:', match);
});
