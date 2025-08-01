const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Inicializa Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey.json'))
});

// Guarda los tokens en memoria o en un archivo (puedes usar una base de datos real)
const TOKENS_FILE = './admin_tokens.json';
let adminTokens = [];
if (fs.existsSync(TOKENS_FILE)) {
  adminTokens = JSON.parse(fs.readFileSync(TOKENS_FILE));
}

// Endpoint para guardar el token FCM del admin
app.post('/api/admin-fcm-token', (req, res) => {
  const { token } = req.body;
  if (token && !adminTokens.includes(token)) {
    adminTokens.push(token);
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(adminTokens));
    return res.json({ success: true, message: 'Token guardado' });
  }
  res.json({ success: false, message: 'Token inválido o ya guardado' });
});

// Endpoint para enviar notificación de prueba a todos los admins o a un token específico
app.post('/api/send-notification', async (req, res) => {
  const { title, body, token } = req.body;
  const message = {
    notification: { title, body }
  };
  const responses = [];

  // Si se envía un token específico, solo a ese
  if (token) {
    try {
      const response = await admin.messaging().send({ ...message, token });
      responses.push({ token, response });
    } catch (error) {
      responses.push({ token, error: error.message });
    }
    return res.json({ sent: responses.length, responses });
  }

  // Si no, envía a todos los tokens guardados
  for (const t of adminTokens) {
    try {
      const response = await admin.messaging().send({ ...message, token: t });
      responses.push({ token: t, response });
    } catch (error) {
      responses.push({ token: t, error: error.message });
    }
  }
  res.json({ sent: responses.length, responses });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend escuchando en puerto ${PORT}`)); 