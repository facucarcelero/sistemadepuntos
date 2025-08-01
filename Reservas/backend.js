const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Endpoint para hacer proxy del PDF de Mercado Pago
app.get('/proxy-pdf', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro url' });
  }
  try {
    const response = await axios.get(url, { responseType: 'stream' });
    res.setHeader('Content-Type', 'application/pdf');
    response.data.pipe(res);
  } catch (error) {
    res.status(500).json({ error: 'No se pudo obtener el PDF', details: error.message });
  }
});

// Endpoint para obtener la URL del comprobante PDF de Mercado Pago
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'APP_USR-4086574404132255-070717-861d73128d19bb0acc54bb80e4510138-2529041657';

app.get('/get-mp-receipt', async (req, res) => {
  const { paymentId } = req.query;
  if (!paymentId) {
    return res.status(400).json({ error: 'Falta el parámetro paymentId' });
  }
  try {
    // Llamar a la API de Mercado Pago para obtener el receipt
    const response = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}/receipt`, {
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
      }
    });
    if (response.data && response.data.receipt_url) {
      return res.json({ receiptUrl: response.data.receipt_url });
    } else {
      return res.status(404).json({ error: 'No se encontró el comprobante PDF para este pago.' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo obtener el comprobante de Mercado Pago', details: error.message });
  }
});

// (Opcional) Endpoint para generar un comprobante PDF propio si Mercado Pago no lo provee
// Puedes usar pdfkit o similar para esto. Ejemplo básico:
// const PDFDocument = require('pdfkit');
// app.get('/generate-ticket', (req, res) => {
//   const { nombre, fecha, monto, reservaId } = req.query;
//   const doc = new PDFDocument();
//   res.setHeader('Content-Type', 'application/pdf');
//   doc.text('Comprobante de Reserva - Parrilla Los Nogales');
//   doc.text(`Nombre: ${nombre}`);
//   doc.text(`Fecha: ${fecha}`);
//   doc.text(`Monto: $${monto}`);
//   doc.text(`ID Reserva: ${reservaId}`);
//   doc.end();
//   doc.pipe(res);
// });

app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en http://localhost:${PORT}`);
}); 