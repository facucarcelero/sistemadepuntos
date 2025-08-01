import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, doc, setDoc, getDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

// Configuración de Firebase usando variables de entorno Vite
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Configuración de MercadoPago
const MP_ACCESS_TOKEN = import.meta.env.VITE_MP_ACCESS_TOKEN;
const DEPOSIT_AMOUNT = 10000;
const WHATSAPP_NUMBER = "5492644593336";

// Recuperar datos de la reserva desde sessionStorage
let reserva = null;
let currentUserId = null;

// Inicializar Firebase Auth
async function initializeAuth() {
  try {
    await signInAnonymously(auth);
    currentUserId = auth.currentUser?.uid;
    console.log("Firebase conectado. Usuario anónimo:", currentUserId);
  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
  }
}

try {
  const reservaData = sessionStorage.getItem('reservaEnCurso');
  if (reservaData) {
    reserva = JSON.parse(reservaData);
  }
} catch (error) {
  console.error('Error al recuperar datos de la reserva:', error);
}

const msgEl = document.getElementById('success-message');

// Inicializar cuando se carga la página
window.addEventListener('DOMContentLoaded', async () => {
  await initializeAuth();
  processReservation();
});

async function processReservation() {
  if (!reserva) {
    showError("No se encontraron datos de la reserva en el sistema.");
    return;
  }

  try {
    // Guardar la reserva en Firebase
    const reservationData = {
      ...reserva,
      status: 'paid',
      paymentStatus: 'approved',
      createdAt: new Date().toISOString(),
      paymentDate: new Date().toISOString(),
      userId: currentUserId,
      turn: getTurn(reserva.date, reserva.time).turnName
    };

    // Generar ID corto y único
    const idCorto = await generarIdCortoUnico();
    await setDoc(doc(db, 'reservations', idCorto), reservationData);
    console.log('✅ Reserva guardada exitosamente:', idCorto);

    // Mostrar mensaje de éxito con opciones de WhatsApp
    showSuccessMessage(reservationData, idCorto);
    
    // Limpiar sessionStorage
    sessionStorage.removeItem('reservaEnCurso');

  } catch (error) {
    console.error('Error al guardar reserva:', error);
    showError("Ocurrió un error al registrar tu reserva. Por favor, contáctanos para confirmar.");
  }
}

function showSuccessMessage(reservationData, reservationId) {
  if (!msgEl) return;

  const dateFormatted = new Date(reservationData.date + 'T00:00:00').toLocaleDateString('es-AR');
  const turnText = reservationData.turn === 'almuerzo' ? 'Almuerzo' : 'Cena';

  // Obtener el ID de pago de Mercado Pago de la URL si está disponible
  const urlParams = new URLSearchParams(window.location.search);
  const paymentId = urlParams.get('payment_id') || 'No disponible';

  // Mensaje de WhatsApp mejorado con emojis y formato solicitado
  const whatsappMessage =
    `🍖 *CONFIRMACIÓN DE RESERVA - Parrilla Los Nogales* 🍖\n\n` +
    `👤 *Cliente:* ${reservationData.name}\n` +
    `📞 *Teléfono:* ${reservationData.phone}\n` +
    `📅 *Fecha:* ${dateFormatted}\n` +
    `⏰ *Hora:* ${reservationData.time} hs\n` +
    `🍽️ *Turno:* ${turnText}\n` +
    `👥 *Comensales:* ${reservationData.diners} personas\n` +
    `💵 *Monto de Seña:* El monto se debe abonar al pagar la seña\n\n` +
    `🆔 *ID de Reserva:* ${reservationId}\n` +
    `💳 *ID de Pago MP:* ${paymentId}\n\n` +
    `✅ *PAGO CONFIRMADO* - La reserva está garantizada.\n\n` +
    `📋 *Detalles importantes:*\n` +
    `• Presentarse 10 minutos antes del horario reservado\n` +
    `• En caso de cancelación, avisar con 24h de anticipación\n` +
    `• El resto del monto se abona al finalizar la comida\n\n` +
    `¡Gracias por elegirnos! 🎉`;

  const encodedWhatsappMessage = encodeURIComponent(whatsappMessage);

  msgEl.innerHTML = `
    <div class="bg-green-100 text-green-800 p-6 rounded-lg">
      <div class="flex items-center justify-center gap-3 mb-4">
        <i class="ph ph-check-circle text-3xl"></i>
        <div class="text-left">
          <h3 class="text-xl font-bold">¡Reserva Confirmada!</h3>
          <p class="text-lg">Tu pago se realizó con éxito.</p>
        </div>
      </div>
      <div class="space-y-3">
        <button onclick="generarComprobantePDF({nombre: '${reservationData.name}', fecha: '${dateFormatted}', monto: ${DEPOSIT_AMOUNT}, reservaId: '${reservationId}'})" class="block w-full bg-blue-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-800 transition flex items-center justify-center gap-2">
          <i class="ph ph-download-simple text-xl"></i>
          Descargar comprobante propio (PDF)
        </button>
        <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodedWhatsappMessage}" target="_blank" class="block w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2">
          <i class="ph ph-whatsapp-logo text-xl"></i>
          Enviar Confirmación por WhatsApp
        </a>
        <div class="text-center text-sm text-green-700 mt-4">
          <p>📱 <strong>Recomendado:</strong> Envía la confirmación por WhatsApp para coordinar mejor tu visita.</p>
          <p class="text-xs text-green-600 mt-2">🔄 <strong>Redirección automática en 3 segundos...</strong></p>
        </div>
      </div>
    </div>
  `;

  // Redirigir automáticamente a WhatsApp después de 3 segundos
  setTimeout(() => {
    console.log('🔄 Redirigiendo automáticamente a WhatsApp...');
    try {
      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedWhatsappMessage}`;
      window.location.href = whatsappUrl;
    } catch (error) {
      console.error('❌ Error al abrir WhatsApp:', error);
      showError(`
        <div class="bg-yellow-100 text-yellow-800 p-4 rounded-lg">
          <p><strong>¡Reserva Confirmada!</strong></p>
          <p>Si no se abrió WhatsApp automáticamente, haz clic aquí:</p>
          <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodedWhatsappMessage}" target="_blank" class="block w-full bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition text-center mt-2">
            <i class="ph ph-whatsapp-logo text-lg"></i> Abrir WhatsApp Manualmente
          </a>
        </div>
      `);
    }
  }, 3000);
}

function showError(message) {
  if (!msgEl) return;
  
  msgEl.innerHTML = `
    <div class="text-center">
      <i class="ph ph-warning text-6xl text-yellow-500 mb-4"></i>
      <h2 class="text-2xl font-bold text-yellow-700 mb-2">Pago Exitoso</h2>
      <p class="text-yellow-600 mb-4">Tu pago fue procesado correctamente</p>
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p class="text-yellow-700 font-semibold">${message}</p>
        <p class="text-yellow-700 mt-2">Por favor, contáctanos para confirmar tu reserva:</p>
        <a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" class="inline-block mt-3 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition">
          <i class="ph ph-whatsapp-logo mr-2"></i>Contactar por WhatsApp
        </a>
      </div>
    </div>
  `;
}

function getTurn(dateString, timeString) {
  if (!dateString || !timeString) return { isOpen: false, turnName: null };
  const date = new Date(`${dateString}T${timeString}:00`);
  const dayOfWeek = date.getDay(); 
  const timeInMinutes = date.getHours() * 60 + date.getMinutes();

  if ([0, 4, 5, 6].includes(dayOfWeek) && timeInMinutes >= 720 && timeInMinutes < 960) {
    return { isOpen: true, turnName: 'almuerzo' };
  }
  if ([1, 2, 3, 4, 5, 6].includes(dayOfWeek) && ((timeInMinutes >= 1200 && timeInMinutes < 1440) || (timeInMinutes >= 0 && timeInMinutes <= 60))) {
     return { isOpen: true, turnName: 'cena' };
  }
  
  return { isOpen: false, turnName: null };
}

// Función para generar un ID corto y único
async function generarIdCortoUnico() {
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numeros = '0123456789';
    let id;
    let existe = true;
    while (existe) {
        id = '';
        for (let i = 0; i < 3; i++) id += letras.charAt(Math.floor(Math.random() * letras.length));
        for (let i = 0; i < 2; i++) id += numeros.charAt(Math.floor(Math.random() * numeros.length));
        const docRef = doc(db, "reservations", id);
        const docSnap = await getDoc(docRef);
        existe = docSnap.exists();
    }
    return id;
}

function getLocalDateString() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
}

// Función para generar comprobante PDF (igual que en Reservas.html)
window.generarComprobantePDF = function({ nombre, fecha, monto, reservaId }) {
  try {
    console.log('📄 [PDF_GENERATE] Generando comprobante propio:', { nombre, fecha, monto, reservaId });
    
    // Verificar que jsPDF esté disponible
    if (!window.jspdf || !window.jspdf.jsPDF) {
      console.error('❌ [PDF_GENERATE] jsPDF no está disponible');
      alert('Error: La librería PDF no está cargada. Por favor, recarga la página.');
      return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Configurar fuente y colores
    doc.setFont('helvetica');
    
    // Función para generar el contenido del PDF
    function generatePDFContent() {
      // Título principal con logo al lado
      doc.setFontSize(20);
      doc.setTextColor(20, 83, 45); // Verde oscuro
      doc.text('Parrilla Los Nogales', 105, 25, { align: 'center' });
      
      doc.setFontSize(16);
      doc.setTextColor(34, 197, 94); // Verde
      doc.text('Comprobante de Reserva', 105, 35, { align: 'center' });
      
      // Línea separadora
      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(0.5);
      doc.line(20, 40, 190, 40);
      
      // Información del cliente
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Datos del Cliente:', 20, 55);
      doc.setFont('helvetica', 'normal');
      doc.text(`Nombre: ${nombre || 'No especificado'}`, 20, 65);
      doc.text(`Fecha de Reserva: ${fecha || 'No especificada'}`, 20, 75);
      
      // Información del pago
      doc.setFont('helvetica', 'bold');
      doc.text('Detalles del Pago:', 20, 90);
      doc.setFont('helvetica', 'normal');
      doc.text(`Monto de Seña: $${(monto || 1000).toLocaleString('es-AR')}`, 20, 100);
      doc.text(`Estado: PAGADO`, 20, 110);
      
      // Información técnica
      doc.setFont('helvetica', 'bold');
      doc.text('Información Técnica:', 20, 125);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`ID de Reserva: ${reservaId || 'No disponible'}`, 20, 135);
      doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-AR')}`, 20, 145);
      doc.text(`Hora de Emisión: ${new Date().toLocaleTimeString('es-AR')}`, 20, 155);
      
      // Notas importantes
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128); // Gris
      doc.text('Notas importantes:', 20, 170);
      doc.setFontSize(8);
      doc.text('• Este es un comprobante generado automáticamente', 20, 177);
      doc.text('• Presentarse 10 minutos antes del horario reservado', 20, 184);
      doc.text('• En caso de cancelación, avisar con 24h de anticipación', 20, 191);
      doc.text('• El resto del monto se abona al finalizar la comida', 20, 198);
      
      // Pie de página
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text('Parrilla Los Nogales - Sistema de Reservas Automatizado', 105, 280, { align: 'center' });
      
      // Generar nombre de archivo
      const fileName = `comprobante_reserva_${reservaId || 'nogales'}_${getLocalDateString()}.pdf`;
      
      // Guardar el PDF
      doc.save(fileName);
      
      console.log('✅ [PDF_GENERATE] Comprobante generado exitosamente:', fileName);
    }
    
    // Intentar cargar el logo desde favicon.ico
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      try {
        // Convertir imagen a canvas para obtener base64
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const logoDataUrl = canvas.toDataURL('image/png');
        doc.addImage(logoDataUrl, 'PNG', 20, 15, 25, 25);
        console.log('✅ [PDF_GENERATE] Logo cargado exitosamente');
      } catch (logoError) {
        console.warn('⚠️ [PDF_GENERATE] Error al procesar logo:', logoError);
      }
      generatePDFContent();
    };
    img.onerror = function() {
      console.warn('⚠️ [PDF_GENERATE] No se pudo cargar el logo, continuando sin él');
      generatePDFContent();
    };
    img.src = './Logo-Los-Nogales.png';
    
  } catch (error) {
    console.error('❌ [PDF_GENERATE] Error al generar PDF:', error);
    alert('Error al generar el comprobante PDF. Por favor, intenta de nuevo.');
  }
}; 