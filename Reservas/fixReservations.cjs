const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixReservations() {
  const snapshot = await db.collection('reservations').get();
  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.paymentStatus === 'approved' && data.status !== 'approved') {
      await doc.ref.update({ status: 'approved' });
      console.log(`Actualizada reserva ${doc.id}: status -> approved`);
      count++;
    }
  }
  console.log(`Total de reservas corregidas: ${count}`);
}

fixReservations().then(() => process.exit()); 