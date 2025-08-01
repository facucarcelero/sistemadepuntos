// Script para agregar el campo firestoreId (y opcionalmente id) a reservas que no lo tengan
// Guarda este archivo como agregar_firestoreId_reservas.cjs y ejecútalo con: node agregar_firestoreId_reservas.cjs

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function agregarFirestoreId() {
  const reservasRef = db.collection('reservations');
  const snapshot = await reservasRef.get();
  let actualizadas = 0;
  let yaOk = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const docId = doc.id;
    // Si ya tiene firestoreId, saltar
    if (data.firestoreId && data.firestoreId.length === 20) {
      yaOk++;
      continue;
    }
    // Agregar firestoreId y opcionalmente id
    const updateData = { firestoreId: docId };
    if (!data.id || data.id.length !== 20) {
      updateData.id = docId;
    }
    await doc.ref.update(updateData);
    actualizadas++;
    console.log(`Actualizada reserva ${docId}`);
  }
  console.log(`\nActualización completada. Reservas actualizadas: ${actualizadas}, ya correctas: ${yaOk}`);
  process.exit(0);
}

agregarFirestoreId().catch(err => {
  console.error('Error en la actualización:', err);
  process.exit(1);
}); 