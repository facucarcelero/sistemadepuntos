// Script para migrar reservas antiguas con ID corto a Firestore
// Guarda este archivo como migrar_reservas_antiguas.js y ejecútalo con: node migrar_reservas_antiguas.js

const admin = require('firebase-admin');
const fs = require('fs');

// Carga las credenciales de tu proyecto
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrarReservasAntiguas() {
  const reservasRef = db.collection('reservations');
  const snapshot = await reservasRef.get();
  let migradas = 0;
  let saltadas = 0;

  for (const doc of snapshot.docs) {
    const oldId = doc.id;
    if (oldId.length === 20) {
      // Ya es un ID válido, no migrar
      saltadas++;
      continue;
    }
    const data = doc.data();
    // Crear nuevo documento con ID generado por Firestore
    const newDocRef = reservasRef.doc();
    const newId = newDocRef.id;
    // Actualizar los campos id y firestoreId
    data.firestoreId = newId;
    data.id = newId;
    // Copiar el resto de los datos
    await newDocRef.set(data);
    // Eliminar el documento viejo
    await doc.ref.delete();
    migradas++;
    console.log(`Migrada reserva ${oldId} -> ${newId}`);
  }
  console.log(`\nMigración completada. Reservas migradas: ${migradas}, reservas ya válidas: ${saltadas}`);
  process.exit(0);
}

migrarReservasAntiguas().catch(err => {
  console.error('Error en la migración:', err);
  process.exit(1);
}); 