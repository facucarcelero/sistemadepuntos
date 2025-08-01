// client-logic.js
// Lógica completa del cliente (sin admin) para Reservas.html

// ========== IMPORTS Y CONFIGURACIÓN ==========
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, query, where, doc, deleteDoc, addDoc, getDocs, updateDoc, getDoc, setDoc, documentId } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// ========== CONFIGURACIÓN DE FIREBASE ==========
const firebaseConfig = {
    apiKey: "AIzaSyBS_eGNLqUH8SshfrnBaUvRTcjJKy5tFiI",
    authDomain: "losnogales-reservas.firebaseapp.com",
    projectId: "losnogales-reservas",
    storageBucket: "losnogales-reservas.appspot.com",
    messagingSenderId: "707614707617",
    appId: "1:707614707617:web:57ef12cf519d99ff8585e0",
    measurementId: "G-MBGF0QWF7K"
};

// ========== CONFIGURACIÓN DE MERCADO PAGO ==========
// const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY;
const DEPOSIT_AMOUNT = 10000; // Monto de la seña en pesos
const WHATSAPP_NUMBER = "5492644593336"; // Número para consultas
const MAX_CAPACITY = 160; // 160 personas por turno

// ========== VARIABLES GLOBALES ==========
let db;
let currentUserId;
let resIdToDelete;
let sourceForDelete;

// ========== MENSAJES PRESTABLECIDOS ==========
const PREDEFINED_MESSAGES = {
    // Mensajes de éxito
    RESERVATION_SUCCESS: {
        title: "¡Reserva Confirmada!",
        message: "Tu reserva ha sido procesada exitosamente.\nÁrea: {area}\nNotas: {notas}\nEl monto de la seña es {senia} pesos. Te hemos enviado un enlace de pago para confirmar tu lugar.",
        type: "success",
        whatsappTemplate: "¡Hola! Mi reserva para {fecha} a las {hora} para {comensales} personas está confirmada.\nÁrea: {area}\nNotas: {notas}\nEl monto de la seña es {senia} pesos. ¿Todo correcto?"
    },
    
    PAYMENT_SUCCESS: {
        title: "¡Pago Exitoso!",
        message: "Tu reserva está completamente confirmada.\nÁrea: {area}\nNotas: {notas}\nEl monto de la seña fue de {senia} pesos. Te hemos enviado el comprobante por email.",
        type: "success",
        whatsappTemplate: "¡Perfecto! Ya pagué mi reserva para {fecha} a las {hora}.\nÁrea: {area}\nNotas: {notas}\nEl monto de la seña fue de {senia} pesos. ¿Necesitan algo más de mi parte?"
    },
    
    // Mensajes de error
    CAPACITY_EXCEEDED: {
        title: "Capacidad Superada",
        message: "Lo sentimos, no hay suficientes lugares disponibles para la fecha y hora seleccionada.",
        type: "error",
        whatsappTemplate: "Hola Parrilla Los Nogales, quisiera consultar por una reserva para {comensales} personas el día {fecha} a las {hora}hs, ya que no encontré lugar en la web. ¿Habrá alguna posibilidad?"
    },
    
    INVALID_DATE: {
        title: "Fecha Inválida",
        message: "No puedes reservar para una fecha u hora que ya ha pasado.",
        type: "error",
        whatsappTemplate: "Hola, intenté hacer una reserva para {fecha} a las {hora} pero me dio error. ¿Pueden ayudarme?"
    },
    
    RESTAURANT_CLOSED: {
        title: "Restaurante Cerrado",
        message: "El restaurante no está abierto en el horario seleccionado. Revisa nuestros horarios.",
        type: "error",
        whatsappTemplate: "Hola, quería consultar si están abiertos el {fecha} a las {hora}hs. La web me dice que están cerrados."
    },
    
    // Mensajes informativos
    PAYMENT_PENDING: {
        title: "Pago Pendiente",
        message: "Tu reserva está pendiente de pago. El monto de la seña es ${senia} pesos. Completa el pago para confirmar tu lugar.",
        type: "info",
        whatsappTemplate: "Hola, tengo una reserva pendiente de pago para {fecha} a las {hora}. El monto de la seña es ${senia} pesos. ¿Pueden ayudarme con el proceso?"
    },
    
    RESERVATION_FOUND: {
        title: "Reserva Encontrada",
        message: "Hemos encontrado tu reserva. Aquí están los detalles:",
        type: "success",
        whatsappTemplate: "Hola, encontré mi reserva para {fecha} a las {hora}. ¿Todo está confirmado?"
    },
    
    // Mensajes de recordatorio (para el admin)
    REMINDER_24H: {
        title: "Recordatorio - 24h",
        message: "Recordatorio: Tienes una reserva mañana a las {hora} para {comensales} personas.",
        type: "info",
        whatsappTemplate: "Hola {nombre}, te recordamos que mañana tienes reserva a las {hora} para {comensales} personas. ¡Los esperamos!"
    },
    
    REMINDER_2H: {
        title: "Recordatorio - 2h",
        message: "Recordatorio: Tu reserva es en 2 horas a las {hora}.",
        type: "info",
        whatsappTemplate: "Hola {nombre}, tu reserva es en 2 horas a las {hora}. ¡Los esperamos!"
    }
};

/**
 * Genera un mensaje preestablecido con datos dinámicos
 */
function generatePredefinedMessage(messageKey, data = {}) {
    const message = PREDEFINED_MESSAGES[messageKey];
    if (!message) {
        console.warn(`Mensaje preestablecido no encontrado: ${messageKey}`);
        return null;
    }
    let finalMessage = { ...message };
    // Calcular la seña real o mostrar 'desconocido'
    if (typeof data.senia === 'undefined') {
        if (typeof data.monto !== 'undefined' && data.monto !== null) {
            data.senia = data.monto;
        } else if (typeof data.depositAmount !== 'undefined' && data.depositAmount !== null) {
            data.senia = data.depositAmount;
        } else if (typeof data.diners !== 'undefined') {
            data.senia = calcularMontoSenia(Number(data.diners));
        } else {
            data.senia = 'desconocido';
        }
    }
    if (!data.area) data.area = 'No especificada';
    if (!data.notas) data.notas = 'Sin notas';
    // Reemplazar placeholders en el mensaje
    Object.keys(data).forEach(key => {
        const placeholder = `{${key}}`;
        finalMessage.message = finalMessage.message.replace(new RegExp(placeholder, 'g'), data[key]);
        finalMessage.whatsappTemplate = finalMessage.whatsappTemplate.replace(new RegExp(placeholder, 'g'), data[key]);
    });
    return finalMessage;
}

/**
 * Genera enlace de WhatsApp con mensaje preestablecido
 */
function generateWhatsAppLink(messageKey, data = {}) {
    const predefinedMessage = generatePredefinedMessage(messageKey, data);
    if (!predefinedMessage) return null;
    
    const whatsappMessage = predefinedMessage.whatsappTemplate;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;
}

// ========== NOTIFICACIONES PUSH ==========
let swRegistration = null;

/**
 * Registra el Service Worker para notificaciones push
 */
async function registerServiceWorker() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            console.log('🔔 [PUSH] Registrando Service Worker...');
            swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            console.log('✅ [PUSH] Service Worker registrado:', swRegistration);
            
            // Solicitar permisos de notificación
            await requestNotificationPermission();
            
            return swRegistration;
        } catch (error) {
            console.error('❌ [PUSH] Error registrando Service Worker:', error);
        }
    } else {
        console.warn('⚠️ [PUSH] Service Worker o Push Manager no soportado');
    }
    return null;
}

/**
 * Solicita permisos para notificaciones
 */
async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        console.log('🔔 [PUSH] Permiso de notificación:', permission);
        return permission === 'granted';
    }
    return false;
}

/**
 * Envía una notificación push local
 */
// async function sendLocalNotification(title, options = {}) {
//     if ('Notification' in window && Notification.permission === 'granted') {
//         try {
//             const notification = new Notification(title, {
//                 icon: '/Logo/favicon.ico',
//                 badge: '/Logo/favicon.ico',
//                 data: { url: window.location.href },
//                 ...options
//             });
//             
//             // Manejar clic en la notificación
//             notification.onclick = function() {
//                 window.focus();
//                 notification.close();
//             };
//             
//             console.log('✅ [PUSH] Notificación local enviada:', title);
//             return notification;
//         } catch (error) {
//             console.error('❌ [PUSH] Error enviando notificación local:', error);
//         }
//     } else {
//         console.warn('⚠️ [PUSH] Notificaciones no permitidas o no soportadas');
//     }
// }

/**
 * Envía notificación push usando Service Worker
 */
async function sendPushNotification(title, options = {}) {
    if (swRegistration && swRegistration.active) {
        try {
            await swRegistration.active.postMessage({
                type: 'PUSH_NOTIFICATION',
                title,
                options
            });
            console.log('✅ [PUSH] Notificación push enviada:', title);
        } catch (error) {
            console.error('❌ [PUSH] Error enviando notificación push:', error);
            // Fallback a notificación local
            // await sendLocalNotification(title, options); // Eliminado el fallback local
        }
    } else {
        // Fallback a notificación local
        // await sendLocalNotification(title, options); // Eliminado el fallback local
    }
}

/**
 * Envía notificación de reserva confirmada
 */
async function sendReservationNotification(reservationData) {
    const message = generatePredefinedMessage('RESERVATION_SUCCESS', {
        fecha: new Date(reservationData.date + 'T00:00:00').toLocaleDateString('es-AR'),
        hora: reservationData.time,
        comensales: reservationData.diners,
        area: reservationData.area,
        notas: reservationData.notes
    });
    
    await sendPushNotification(message.title, {
        body: message.message,
        icon: '/Logo/favicon.ico',
        badge: '/Logo/favicon.ico',
        data: {
            url: window.location.href,
            reservationId: reservationData.tempId
        }
    });
}

/**
 * Envía notificación de recordatorio
 */
async function sendReminderNotification(reservationData, hoursBefore = 24) {
    const messageKey = hoursBefore === 24 ? 'REMINDER_24H' : 'REMINDER_2H';
    const message = generatePredefinedMessage(messageKey, {
        nombre: reservationData.name,
        hora: reservationData.time,
        comensales: reservationData.diners
    });
    
    await sendPushNotification(message.title, {
        body: message.message,
        icon: '/Logo/favicon.ico',
        badge: '/Logo/favicon.ico',
        data: {
            url: window.location.href,
            reservationId: reservationData.id
        }
    });
}

/**
 * Envía notificación al admin sobre nueva reserva (usando localStorage)
 * Ahora indica que está pendiente de pago
 */
function notifyAdminOfNewReservation(reservationData) {
    try {
        const adminNotification = {
            type: 'PENDING_PAYMENT',
            data: reservationData,
            timestamp: Date.now()
        };
        localStorage.setItem('adminNotification', JSON.stringify(adminNotification));
        window.dispatchEvent(new CustomEvent('pendingPayment', {
            detail: adminNotification
        }));
        console.log('📧 [ADMIN_NOTIFY] Notificación de reserva pendiente de pago enviada al admin:', adminNotification);
    } catch (error) {
        console.error('❌ [ADMIN_NOTIFY] Error enviando notificación al admin:', error);
    }
}

/**
 * Envía notificación al admin cuando el pago es confirmado
 */
function notifyAdminOfPaymentConfirmed(reservationData) {
    try {
        const adminNotification = {
            type: 'PAYMENT_CONFIRMED',
            data: reservationData,
            timestamp: Date.now()
        };
        localStorage.setItem('adminNotification', JSON.stringify(adminNotification));
        window.dispatchEvent(new CustomEvent('paymentConfirmed', {
            detail: adminNotification
        }));
        console.log('📧 [ADMIN_NOTIFY] Notificación de pago confirmado enviada al admin:', adminNotification);
    } catch (error) {
        console.error('❌ [ADMIN_NOTIFY] Error enviando notificación de pago confirmado al admin:', error);
    }
}

/**
 * Devuelve el elemento por ID o null si no existe.
 */
export const getEl = (id) => document.getElementById(id);

/**
 * Sanitiza un número de teléfono removiendo caracteres no numéricos.
 */
export function sanitizePhone(phoneString) {
    if (typeof phoneString !== 'string') return '';
    return phoneString.replace(/\D/g, ''); 
}

// Determina el turno (almuerzo/cena) solo por la hora, sin importar el día de la semana
function getTurnByHourOnly(timeString) {
  if (!timeString) return null;
  const [hour, minute] = timeString.split(':').map(Number);
  const timeInMinutes = hour * 60 + minute;
  // Almuerzo: 12:00 a 16:00 (720 a 960)
  if (timeInMinutes >= 720 && timeInMinutes < 960) return 'Almuerzo';
  // Cena: 20:00 a 01:00 (1200 a 1440 o 0 a 60)
  if ((timeInMinutes >= 1200 && timeInMinutes < 1440) || (timeInMinutes >= 0 && timeInMinutes <= 60)) return 'Cena';
  return null;
}

// Mejorar getTurn para fechas especiales
export async function getTurn(dateString, timeString) {
    console.log('[DEBUG] getTurn llamada con:', { dateString, timeString });
    if (!dateString || !timeString) {
        console.log('[DEBUG] getTurn - Fecha u hora vacía, retornando cerrado');
        return { isOpen: false, turnName: null };
    }
    // Consultar Firestore por la fecha especial
    const specialDoc = await getSpecialDayRules(dateString);
    const date = new Date(`${dateString}T${timeString}:00`);
    const hora = date.getHours();
    const minutos = date.getMinutes();
    const dayOfWeek = date.getDay();
    
    console.log('[DEBUG] getTurn - Detalles:', {
        date: date.toISOString(),
        hora,
        minutos,
        dayOfWeek,
        dayName: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayOfWeek],
        hasSpecialDoc: !!specialDoc
    });
    
    if (specialDoc) {
        console.log('[DEBUG] getTurn - Día especial encontrado:', specialDoc);
        // Si ambos turnos están cerrados o no marcados, el día está cerrado
        const almuerzoAbierto = specialDoc.almuerzo === 'abierto';
        const cenaAbierto = specialDoc.cena === 'abierto';
        console.log('[DEBUG] getTurn - Estado turnos especiales:', { almuerzoAbierto, cenaAbierto });
        
        // Almuerzo: 12:00 a 16:00
        if (almuerzoAbierto && hora >= 12 && hora < 16) {
            console.log('[DEBUG] getTurn - Almuerzo especial disponible');
            return { isOpen: true, turnName: 'Almuerzo', motivo: specialDoc.motivo || 'Abierto por fecha especial', cupo: specialDoc.cupo };
        }
        // Cena: 20:00 a 23:59 o 00:00 a 01:00
        if (cenaAbierto && ((hora >= 20 && hora <= 23) || (hora >= 0 && hora < 1))) {
            console.log('[DEBUG] getTurn - Cena especial disponible');
            return { isOpen: true, turnName: 'Cena', motivo: specialDoc.motivo || 'Abierto por fecha especial', cupo: specialDoc.cupo };
        }
        // Si no está abierto el turno correspondiente
        console.log('[DEBUG] getTurn - Día especial pero turno no disponible');
        return { isOpen: false, turnName: null, motivo: 'Turno no disponible en fecha especial' };
    }
    
    // Lógica normal
    const timeInMinutes = date.getHours() * 60 + date.getMinutes();
    console.log('[DEBUG] getTurn - Lógica normal:', {
        timeInMinutes,
        almuerzoDias: [0, 4, 5, 6],
        cenaDias: [1, 2, 3, 4, 5, 6],
        almuerzoHorario: '720-960 (12:00-16:00)',
        cenaHorario: '1200-1440 (20:00-24:00) o 0-60 (00:00-01:00)'
    });
    
    // Almuerzo: Jueves (4) a Domingo (0), 12:00-16:00
    if ([0, 4, 5, 6].includes(dayOfWeek) && timeInMinutes >= 720 && timeInMinutes < 960) {
        console.log('[DEBUG] getTurn - Almuerzo normal disponible');
        return { isOpen: true, turnName: 'Almuerzo' };
    }
    // Cena: Lunes (1) a Sábado (6), 20:00-01:00
    if ([1, 2, 3, 4, 5, 6].includes(dayOfWeek) && ((timeInMinutes >= 1200 && timeInMinutes < 1440) || (timeInMinutes >= 0 && timeInMinutes < 60))) {
        console.log('[DEBUG] getTurn - Cena normal disponible');
         return { isOpen: true, turnName: 'Cena' };
    }
    console.log('[DEBUG] getTurn - No coincide con ningún horario, retornando cerrado');
    return { isOpen: false, turnName: null };
}

// Nueva función para obtener reglas especiales de Firestore
async function getSpecialDayRules(date) {
    if (!db) return null;
    try {
        const docRef = doc(collection(db, 'turnosEspeciales'), date);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
    } catch (e) { console.error('Error consultando reglas de día especial:', e); }
    return null;
}

// Mejorar validateReservationTime para mostrar mensajes personalizados y claros
export async function validateReservationTime(date, time, context = 'client', messageEl = null) {
  console.log('[DEBUG] validateReservationTime llamada con:', { date, time, context, messageEl });
  const displayFn = context === 'modal' ? (msg, type, extra) => displayModalMessage(messageEl, msg, type, extra) : displayClientMessage;
  const safeDate = (typeof date === 'string' && date.length >= 10) ? date.slice(0, 10) : new Date(date).toISOString().split('T')[0];

  // Validaciones mínimas
  const now = new Date();
  const [year, month, day] = safeDate.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const reservationDateTime = new Date(year, month - 1, day, hour, minute, 0, 0);
  // 1. No se puede reservar para una fecha pasada
  if (reservationDateTime < now) {
    displayFn('No puedes reservar para una fecha pasada.', 'error');
    return false;
  }
  // 2. Si es para hoy, mínimo 30 minutos de anticipación
  if (reservationDateTime.toDateString() === now.toDateString()) {
    const diffMin = (reservationDateTime.getTime() - now.getTime()) / 60000;
    if (diffMin < 30) {
      displayFn('Las reservas para hoy deben hacerse con al menos 30 minutos de anticipación.', 'error');
      return false;
    }
  }
  // 3. No se puede reservar si faltan menos de 1 hora para el cierre del turno
  const turnoInfo = await getTurn(safeDate, time);
  if (turnoInfo.isOpen && turnoInfo.turnName) {
    let cierreTurno;
    if (turnoInfo.turnName === 'Almuerzo') {
      cierreTurno = new Date(year, month - 1, day, 16, 0, 0, 0); // 16:00
    } else if (turnoInfo.turnName === 'Cena') {
      // Cena cierra a la 01:00 del día siguiente
      cierreTurno = new Date(year, month - 1, day, 1, 0, 0, 0);
      if (hour < 12) {
        // Si la reserva es después de medianoche, sumar un día
        cierreTurno.setDate(cierreTurno.getDate() + 1);
      } else {
        cierreTurno = new Date(year, month - 1, day, 23, 59, 59, 999); // 23:59 si es antes de medianoche
      }
    }
    const diffCierre = (cierreTurno.getTime() - reservationDateTime.getTime()) / 60000;
    if (diffCierre < 60) {
      displayFn('No se pueden hacer reservas con menos de 1 hora de anticipación al cierre del turno.', 'error');
      return false;
    }
  }
  console.log('[DEBUG] validateReservationTime - Resultado de getTurn:', turnoInfo);
  if (!turnoInfo.isOpen || !turnoInfo.turnName) {
    // Obtener reglas especiales para ese día
    const specialDoc = await getSpecialDayRules(safeDate);
    let mensaje = '<strong>CERRADO:</strong> El restaurante no está abierto en el horario seleccionado.';
    let icon = 'info';
    let title = 'Fecha Especial';
    if (specialDoc) {
      // Mostrar motivo si existe
      if (specialDoc.motivo) {
        mensaje = specialDoc.motivo;
        icon = 'info';
        title = 'Fecha Especial';
      } else {
        // Mostrar qué turnos están disponibles
        let disponibles = [];
        if (specialDoc.almuerzo === 'abierto') disponibles.push('Almuerzo');
        if (specialDoc.cena === 'abierto') disponibles.push('Cena');
        if (disponibles.length > 0) {
          mensaje = `Solo disponible para: <b>${disponibles.join(' y ')}</b>.`;
          icon = 'info';
          title = 'Turnos Disponibles';
        }
      }
      showSpecialDateModal({ title, message: mensaje, icon });
      return false;
    }
    displayFn(mensaje, 'error');
    return false;
  }
  return true;
}

// ========== INICIALIZACIÓN DE FIREBASE ==========
/**
 * Inicializa Firebase y configura la autenticación anónima.
 * Debe llamarse al cargar la página.
 */
export async function initializeFirebase() {
    try {
        console.log(' [FIREBASE] Inicializando Firebase...');
        
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        const auth = getAuth(app);
        
        console.log('✅ [FIREBASE] Firebase inicializado correctamente');
        
        // Configurar autenticación anónima
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUserId = user.uid;
                console.log('✅ [AUTH] Usuario anónimo conectado:', currentUserId);
            } else {
                try {
                    const result = await signInAnonymously(auth);
                    currentUserId = result.user.uid;
                    console.log('✅ [AUTH] Nuevo usuario anónimo creado:', currentUserId);
                } catch (error) {
                    console.error('❌ [AUTH] Error en autenticación anónima:', error);
                }
            }
        });
        
        return db;
    } catch (error) {
        console.error('❌ [FIREBASE] Error al inicializar Firebase:', error);
        throw error;
    }
}

// ========== INICIALIZACIÓN DEL FORMULARIO DE RESERVAS ==========
/**
 * Inicializa el formulario de reservas del cliente.
 * Debe llamarse después de que Firebase esté inicializado.
 */
export function initializeReservationForm() {
    console.log('📝 [FORM] Inicializando formulario de reservas...');
    
    const container = getEl('reservation-form-container');
    if (!container) {
        console.error('❌ [FORM] Contenedor del formulario no encontrado');
        return;
    } else {
        console.log('✅ [FORM] Contenedor encontrado:', container);
    }
    
    // Verificar que el formulario ya esté en el HTML
    const form = getEl('reservationForm');
    if (!form) {
        console.error('❌ [FORM] Formulario no encontrado en el HTML');
        return;
    } else {
        console.log('✅ [FORM] Formulario encontrado en el HTML');
    }
    
    // Configurar fecha mínima (hoy)
    const dateInput = getEl('date');
    if (dateInput) {
        // Usar fecha local para evitar problemas de zona horaria
        const now = new Date();
        const today = now.getFullYear() + '-' + 
                     String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(now.getDate()).padStart(2, '0');
        
        dateInput.setAttribute('min', today);
        dateInput.value = today;
        console.log('✅ [FORM] Fecha mínima configurada:', today);
        console.log('✅ [FORM] Fecha actual del navegador:', now.toLocaleDateString());
    } else {
        console.warn('⚠️ [FORM] No se encontró el input de fecha');
    }
    
    // Configurar evento de envío del formulario
    if (form) {
        form.addEventListener('submit', handleReservationSubmit);
        console.log('✅ [FORM] Evento de envío configurado');
    } else {
        console.warn('⚠️ [FORM] No se encontró el formulario con id reservationForm');
    }
    
    console.log('✅ [FORM] Formulario inicializado correctamente');
    
    // Agregar campo de notas si no existe
    if (form && !getEl('notes')) {
        const notesDiv = document.createElement('div');
        notesDiv.className = 'mb-4';
        notesDiv.innerHTML = `
            <label for="notes" class="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea id="notes" name="notes" rows="2" class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 text-sm"></textarea>
        `;
        form.insertBefore(notesDiv, form.querySelector('button[type="submit"]'));
    }
    // Agregar campo de área si no existe
    if (form && !getEl('area')) {
        const areaDiv = document.createElement('div');
        areaDiv.className = 'mb-4';
        areaDiv.innerHTML = `
            <label for="area" class="block text-sm font-medium text-gray-700 mb-1">Área</label>
            <select id="area" name="area" class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 text-sm" required>
                <option value="">Seleccionar...</option>
                <option value="Salón">Salón</option>
                <option value="Patio">Patio</option>
            </select>
        `;
        form.insertBefore(areaDiv, form.querySelector('button[type="submit"]'));
    }
}

// ========== MANEJO DE BOTONES DE NAVEGACIÓN ==========
/**
 * Inicializa los botones de navegación del cliente.
 */
export function initializeNavigationButtons() {
    console.log('🧭 [NAV] Inicializando botones de navegación...');
    
    // Botón de volver
    const backButton = getEl('back-button');
    if (backButton) {
        backButton.addEventListener('click', () => {
            console.log('⬅️ [NAV] Botón volver clickeado');
            if (window.history.length > 1) {
                window.history.back();
            } else {
                // Si no hay historial, redirigir a la página principal
                window.location.href = '/';
            }
        });
        console.log('✅ [NAV] Botón volver configurado');
    } else {
        console.warn('⚠️ [NAV] No se encontró el botón volver');
    }
    
    // Eliminado el botón de acceso administrador
    
    console.log('✅ [NAV] Botones de navegación inicializados');
}

// ========== MANEJO DEL ENVÍO DE RESERVAS ==========
/**
 * Maneja el envío del formulario de reserva.
 * Valida datos, verifica capacidad y crea la preferencia de pago.
 */
export async function handleReservationSubmit(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    try {
        const formData = new FormData(event.target);
        const reservation = {
            name: formData.get('name') || getEl('name').value,
            phone: sanitizePhone(formData.get('phone') || getEl('phone').value),
            date: formData.get('date') || getEl('date').value,
            time: formData.get('time') || getEl('time').value,
            diners: parseInt(formData.get('diners') || getEl('diners').value, 10),
            notes: formData.get('notes') || (getEl('notes') ? getEl('notes').value : ''),
            area: formData.get('area') || (getEl('area') ? getEl('area').value : '')
        };
        console.log('[DEBUG] handleReservationSubmit datos recibidos:', reservation);
        if (!reservation.name || !reservation.phone || !reservation.date || !reservation.time) {
            displayClientMessage('Por favor, completa todos los campos requeridos.', 'error');
            submitButton.disabled = false;
            submitButton.innerHTML = originalText;
            return;
        }
        if (reservation.diners < 1) {
            displayClientMessage('El número de comensales debe ser al menos 1.', 'error');
            submitButton.disabled = false;
            submitButton.innerHTML = originalText;
            return;
        }
        // Validar fecha pasada
        const now = new Date();
        const reservationDateTime = new Date(`${reservation.date}T${reservation.time}`);
        if (reservationDateTime < now) {
            displayClientMessage(getPredefinedMessage('PAST_DATE'), 'error');
            submitButton.disabled = false;
            submitButton.innerHTML = originalText;
            return;
        }
        // Validar menos de 30 minutos
        if (reservationDateTime.toDateString() === now.toDateString() && (reservationDateTime.getTime() - now.getTime()) / 60000 < 30) {
            displayClientMessage(getPredefinedMessage('LESS_THAN_30_MIN'), 'error');
            submitButton.disabled = false;
            submitButton.innerHTML = originalText;
            return;
        }
        // Validar horario fuera de apertura (usando validateReservationTime)
        console.log('[DEBUG] Llamando a validateReservationTime con:', reservation.date, reservation.time, 'client');
        if (!await validateReservationTime(reservation.date, reservation.time, 'client')) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalText;
            return;
        }
        // Verificar capacidad disponible SOLO AL HACER SUBMIT
        console.log('[DEBUG] Llamando a getTurn con:', reservation.date, reservation.time);
        const turnData = await getTurn(reservation.date, reservation.time);
        console.log('[DEBUG] Resultado de getTurn:', turnData);
        if (!turnData || !turnData.turnName) {
            displayClientMessage('Error al determinar el turno. Intenta de nuevo.', 'error');
            submitButton.disabled = false;
            submitButton.innerHTML = originalText;
            return;
        }
        const reservationsCollection = collection(db, "reservations");
        const q = query(reservationsCollection, where("date", "==", reservation.date), where("turn", "==", turnData.turnName));
        const querySnapshot = await getDocs(q);
        const currentDiners = querySnapshot.docs.reduce((sum, doc) => sum + (doc.data().diners || 0), 0);
        const remainingCapacity = MAX_CAPACITY - currentDiners;
        if (reservation.diners > remainingCapacity) {
            const whatsappMsg = getCapacityWhatsAppMessage({ diners: reservation.diners, date: reservation.date, time: reservation.time });
            const whatsappBtn = `<a href="https://wa.me/5492644593336?text=${whatsappMsg}" target="_blank" class="mt-4 inline-block w-full text-center bg-yellow-500 text-black font-bold py-3 px-4 rounded-lg hover:bg-yellow-600 transition flex items-center justify-center gap-2"><i class="ph ph-whatsapp-logo text-xl"></i>Coordinar por WhatsApp</a>`;
            displayClientMessage(getPredefinedMessage('CAPACITY_EXCEEDED', { remainingCapacity }), 'error', whatsappBtn);
            submitButton.disabled = false;
            submitButton.innerHTML = originalText;
            return;
        }

        // ========== GUARDAR RESERVA Y PROCESAR PAGO ==========
        console.log('💾 [RESERVATION] Guardando reserva en Firestore...');
        
        // Generar ID corto para la reserva
        const shortId = generateShortId();
        
        // Calcular el monto de la seña según la cantidad de comensales
        const depositAmount = calcularMontoSenia(reservation.diners);

        // Crear objeto de reserva completo
        const reservationData = {
            ...reservation,
            id: shortId,
            tempId: shortId, // Para compatibilidad con el sistema de pago
            turn: turnData.turnName,
            status: 'pending',
            paymentStatus: 'pending',
            depositAmount: depositAmount,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Asegurar formato y presencia de campos clave
            name: reservation.name ? String(reservation.name).trim() : '',
            phone: reservation.phone ? String(reservation.phone).trim() : '',
            date: reservation.date ? String(reservation.date).slice(0, 10) : '',
            time: reservation.time ? String(reservation.time).slice(0, 5) : '',
            area: reservation.area ? String(reservation.area).trim() : '',
            notes: reservation.notes ? String(reservation.notes).trim() : ''
        };

        // Guardar reserva en Firestore
        const docRef = await addDoc(collection(db, "reservations"), reservationData);
        console.log('✅ [RESERVATION] Reserva guardada con ID:', docRef.id);

        // Actualizar la reserva con el ID del documento
        await updateDoc(docRef, { 
            firestoreId: docRef.id,
            external_reference: shortId // Para Mercado Pago
        });

        // Mostrar mensaje de éxito
        const successMessage = getPredefinedMessage('RESERVA_EXITOSA');
        displayClientMessage(successMessage, 'success');

        // Crear preferencia de pago y redirigir a Mercado Pago
        console.log('💳 [PAYMENT] Creando preferencia de pago...');
        await createDirectPaymentPreference({
            ...reservationData,
            firestoreId: docRef.id
        });
    } catch (error) {
        console.error("❌ [RESERVATION] Error al procesar la reserva:", error);
        displayClientMessage('Ocurrió un error al procesar tu solicitud.', 'error');
    } finally {
        // Restaurar botón
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
} 

// ========== MANEJO DE MODALES ========== 

/**
 * Alterna la visibilidad de un modal.
 */
export function toggleModal(modal, show) {
    if (!modal) return;
    
    if (show) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } else {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
}

/**
 * Inicializa el modal de búsqueda de reservas.
 */
export function initializeSearchModal(isAdmin = false) {
    const searchModal = getEl('search-modal');
    const showSearchButton = getEl('show-search-button');
    const closeSearchButton = getEl('close-search-modal-button');
    const searchForm = getEl('search-form');
    const resultsContainer = getEl('search-results-container');
    const messageEl = getEl('search-message');
    
    if (!searchModal || !showSearchButton) {
        console.error('❌ [SEARCH_MODAL] Elementos del modal de búsqueda no encontrados');
        return;
    }
    
    // Mostrar modal de búsqueda
    showSearchButton.addEventListener('click', () => {
        searchModal.innerHTML = getEl('search-modal-template').innerHTML;
        toggleModal(searchModal, true);
        
        // Reconfigurar elementos después de cargar el template
        const newSearchForm = getEl('search-form');
        const newCloseButton = getEl('close-search-modal-button');
        const newResultsContainer = getEl('search-results-container');
        const newMessageEl = getEl('search-message');
        
        if (newSearchForm) {
            newSearchForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await handleSearchSubmit(newResultsContainer, newMessageEl, isAdmin);
            });
        }
        
        if (newCloseButton) {
            newCloseButton.addEventListener('click', () => toggleModal(searchModal, false));
        }
    });
    
    console.log('✅ [SEARCH_MODAL] Modal de búsqueda inicializado');
}

/**
 * Maneja el envío del formulario de búsqueda.
 */
export async function handleSearchSubmit(resultsContainer, messageEl, isAdmin = false) {
    const searchInput = getEl('search-phone');
    if (!searchInput || !resultsContainer || !messageEl) {
        console.error('❌ [SEARCH] Elementos de búsqueda no encontrados');
        return;
    }
    
    const searchTerm = searchInput.value.trim();
    resultsContainer.innerHTML = '';
    messageEl.textContent = 'Buscando...';

    if (!searchTerm) {
        messageEl.textContent = isAdmin ? 
            'Por favor, ingresa un término de búsqueda (nombre, teléfono, fecha, área, etc.).' : 
            'Por favor, ingresa un nombre o número de teléfono.';
        return;
    }

    try {
        console.log('🔍 [SEARCH] Iniciando búsqueda:', searchTerm, 'isAdmin:', isAdmin);
        const matchedReservations = await searchClientReservations(searchTerm, isAdmin);
        
        if (matchedReservations.length === 0) {
            messageEl.textContent = isAdmin ? 
                'No se encontraron reservas con los datos ingresados.' : 
                'No se encontraron reservas activas con los datos ingresados.';
            return;
        }

        messageEl.textContent = `Se encontraron ${matchedReservations.length} reserva(s):`;
        
        // Ordenar por fecha y hora (más recientes primero para admin, cronológico para cliente)
        const sortedReservations = matchedReservations.sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
            const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
            return isAdmin ? dateB - dateA : dateA - dateB; // Admin: más recientes primero, Cliente: cronológico
        });
        
        // Renderiza cada reserva usando la función correcta
        sortedReservations.forEach(res => {
            try {
                renderReservationCard(res, resultsContainer, isAdmin);
            } catch (renderError) {
                console.error('❌ [SEARCH] Error renderizando reserva:', res.id, renderError);
                // Crear un elemento de error para esta reserva
                const errorDiv = document.createElement('div');
                errorDiv.className = 'p-3 border border-red-200 rounded-lg bg-red-50 text-red-700';
                errorDiv.innerHTML = `
                    <p class="font-bold">Error al mostrar reserva</p>
                    <p class="text-sm">ID: ${res.id || 'N/A'}</p>
                    <p class="text-sm">Nombre: ${res.name || 'N/A'}</p>
                `;
                resultsContainer.appendChild(errorDiv);
            }
        });
        
        console.log('✅ [SEARCH] Búsqueda completada exitosamente');
    } catch (error) {
        console.error("❌ [SEARCH] Error searching reservations:", error);
        if (messageEl) {
            messageEl.textContent = 'Ocurrió un error al buscar las reservas. Por favor, intenta de nuevo.';
        }
        // Mostrar detalles del error en consola para debugging
        console.error('🔍 [SEARCH] Detalles del error:', {
            searchTerm,
            isAdmin,
            error: error.message,
            stack: error.stack
        });
    }
}

/**
 * Verifica los parámetros de URL para procesar resultados de pago.
 */
export function checkPaymentParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    const tempId = urlParams.get('temp_id');
    const paymentId = urlParams.get('payment_id');

    console.log('🔍 [PAYMENT_VERIFICATION] Parámetros recibidos de Mercado Pago:', {
        paymentStatus,
        tempId,
        paymentId
    });
    console.log('[RESERVA] Buscando reserva con tempId:', tempId);

    // Si el pago fue exitoso y hay temp_id, buscar la reserva, actualizar estado y redirigir a WhatsApp
    if (paymentStatus === 'approved' && tempId) {
        // Buscar la reserva en Firestore por temp_id (más flexible)
        const reservationsRef = collection(db, "reservations");
        getDocs(reservationsRef).then(async snapshot => {
            const allReservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log('🔍 [PAYMENT_VERIFICATION] Todas las reservas:', allReservations.map(r => ({ id: r.id, tempId: r.tempId })));
            
            // Buscar la reserva con tempId (más flexible)
            let reserva = allReservations.find(r => r.tempId === tempId);
            
            // Si no encuentra por tempId exacto, buscar por ID del documento
            if (!reserva) {
                reserva = allReservations.find(r => r.id === tempId);
            }
            
            // Si aún no encuentra, buscar por external_reference
            if (!reserva) {
                reserva = allReservations.find(r => r.external_reference === tempId);
            }
            
            if (reserva) {
                // Actualizar el estado de pago en Firestore usando el ID correcto
                try {
                    const docId = reserva.firestoreId || reserva.id;
                    await updateDoc(doc(db, "reservations", docId), {
                        paymentStatus: 'approved',
                        status: 'approved',
                        paymentId: paymentId,
                        paymentDate: new Date().toISOString()
                    });
                    console.log('✅ [PAYMENT_VERIFICATION] Estado de pago actualizado en Firestore');
                    
                    // Enviar notificación de pago exitoso
                    await sendReservationNotification({
                        ...reserva,
                        paymentStatus: 'approved',
                        paymentId: paymentId
                    });
                } catch (error) {
                    console.error('❌ [PAYMENT_VERIFICATION] Error actualizando estado de pago:', error);
                }

                // Generar mensaje de WhatsApp con todos los datos
                const dateFormatted = new Date(reserva.date + 'T00:00:00').toLocaleDateString('es-AR');
                const turnText = reserva.turn === 'almuerzo' ? 'Almuerzo' : 'Cena';
                const montoSenia = reserva.depositAmount || 100;
                const whatsappMessage =
                  `🍖 *CONFIRMACIÓN DE RESERVA - Parrilla Los Nogales* 🍖\n\n` +
                  `👤 *Cliente:* ${reserva.name}\n` +
                  `📞 *Teléfono:* ${reserva.phone}\n` +
                  `📅 *Fecha:* ${dateFormatted}\n` +
                  `⏰ *Hora:* ${reserva.time} hs\n` +
                  `👥 *Comensales:* ${reserva.diners} personas\n` +
                  `💰 *Monto de Seña:* $${montoSenia}\n` +
                  `🆔 *ID de Reserva:* ${reserva.id}\n` +
                  (paymentId ? `💳 *ID de Pago:* ${paymentId}\n` : '') +
                  `\n✅ *PAGO CONFIRMADO* - La reserva está garantizada.\n\n` +
                  `• La reserva tiene una tolerancia de 15 minutos\n` +
                  `• En caso de cancelación, avisar con 24h de anticipación\n` +
                  `• El resto del monto se abona en el local\n` +
                  `\n¡Gracias por elegirnos!`;
                const whatsappNumber = '5492644593336';
                const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
                
                // Mostrar mensaje de éxito antes de redirigir
                displayClientMessage('¡Pago exitoso! Redirigiendo a WhatsApp para confirmar detalles...', 'success');
                
                // Redirigir automáticamente a WhatsApp después de 2 segundos
                setTimeout(() => {
                    window.location.href = whatsappUrl;
                }, 2000);
            } else {
                // Si no se encuentra, mostrar mensaje de error
                console.error('[RESERVA] No se encontró la reserva con tempId:', tempId, 'en Firestore.');
                displayClientMessage('No se encontró la reserva después del pago. Por favor, contacta por WhatsApp.', 'error');
            }
        }).catch(error => {
            console.error('❌ [PAYMENT_VERIFICATION] Error buscando la reserva:', error);
            displayClientMessage('Ocurrió un error al verificar el pago. Por favor, contacta por WhatsApp.', 'error');
        });
    } else if (paymentStatus === 'pending' && tempId) {
        // Pago pendiente
        displayClientMessage('Tu pago está pendiente de confirmación. Te notificaremos cuando se confirme.', 'info');
    } else if (paymentStatus === 'rejected' && tempId) {
        // Pago rechazado
        displayClientMessage('El pago fue rechazado. Puedes intentar nuevamente o contactar por WhatsApp.', 'error');
    }
}

/**
 * Busca reservas del cliente por nombre o teléfono.
 * Si es admin, muestra todas las reservas (pasadas, actuales y futuras).
 * MEJORADA: Búsqueda más flexible y robusta
 */
export async function searchClientReservations(searchTerm, isAdmin = false) {
    console.log('🔍 [CLIENT_SEARCH] Buscando reservas:', searchTerm, 'isAdmin:', isAdmin);
    try {
        // Obtener todas las reservas
        const reservationsRef = collection(db, "reservations");
        const snapshot = await getDocs(reservationsRef);
        const allReservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('🔍 [CLIENT_SEARCH] Todas las reservas traídas de Firebase:', allReservations.length);
        
        const today = new Date().toISOString().split('T')[0]; // Fecha de hoy en formato YYYY-MM-DD
        const search = searchTerm.trim().toLowerCase();
        
        // Búsqueda más flexible y robusta
        const matchedReservations = allReservations.filter(res => {
            // Si es admin, no filtrar por fecha (puede ver todas las reservas)
            if (!isAdmin) {
                // Solo permitir reservas de hoy o fechas futuras para clientes
                if (!res.date || res.date < today) return false;
            }
            
            // Búsqueda más flexible por múltiples campos
            const nameMatch = res.name && res.name.toLowerCase().includes(search);
            const phoneMatch = res.phone && res.phone.includes(search);
            const dateMatch = res.date && res.date.includes(search);
            const areaMatch = res.area && res.area.toLowerCase().includes(search);
            const notesMatch = res.notes && res.notes.toLowerCase().includes(search);
            const idMatch = res.id && res.id.toLowerCase().includes(search);
            const firestoreIdMatch = res.firestoreId && res.firestoreId.toLowerCase().includes(search);
            
            // Para admin, permitir búsqueda por más campos
            if (isAdmin) {
                return nameMatch || phoneMatch || dateMatch || areaMatch || notesMatch || idMatch || firestoreIdMatch;
            } else {
                // Para cliente, solo por nombre y teléfono
                return nameMatch || phoneMatch;
            }
        });
        
        console.log('🔍 [CLIENT_SEARCH] Reservas que coinciden tras filtrar:', matchedReservations.length);
        
        // Verificar en tiempo real que cada reserva siga existiendo en Firestore
        const validReservations = [];
        for (const res of matchedReservations) {
            try {
                const docId = res.firestoreId || res.id;
                if (docId) {
                    const docSnap = await getDoc(doc(db, 'reservations', docId));
                    if (docSnap.exists()) {
                        validReservations.push(res);
                    }
                } else {
                    // Si no tiene firestoreId, verificar por el ID del documento
                    const docSnap = await getDoc(doc(db, 'reservations', res.id));
                    if (docSnap.exists()) {
                        validReservations.push(res);
                    }
                }
            } catch (error) {
                console.warn('⚠️ [CLIENT_SEARCH] Error verificando reserva:', res.id, error);
                // Si hay error al verificar, incluir la reserva de todas formas
                validReservations.push(res);
            }
        }
        
        console.log('🔍 [CLIENT_SEARCH] Reservas válidas finales:', validReservations.length);
        return validReservations;
    } catch (error) {
        console.error("❌ [CLIENT_SEARCH] Error buscando reservas:", error);
        return [];
    }
}

// ===================================================================
// FUNCIÓN MEJORADA: Generar comprobante PDF propio
// Con logo y mejor formato
// ===================================================================
function generarComprobantePDF({ nombre, fecha, monto, reservaId, paymentStatus, estado, status, paymentId, diners, time, turn, area, notes, depositAmount, phone }) {
    try {
        // Calcular turno si no está definido o es 'No especificado'
        let turnoFinal = turn;
        if (!turnoFinal || turnoFinal === 'No especificado') {
            turnoFinal = getTurnByHourOnly(time) || 'No especificado';
        }
        console.log('📄 [PDF_GENERATE] Generando comprobante propio:', { nombre, fecha, monto, reservaId, paymentStatus, estado, status, paymentId, diners, time, turn, area, notes, depositAmount, phone });
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        function generatePDFContent(logoDataUrl = null) {
            if (logoDataUrl) {
                doc.addImage(logoDataUrl, 'PNG', 20, 15, 25, 25);
            }
            const logoX = 20;
            const logoY = 15;
            const logoW = 25;
            const textX = logoX + logoW + 10;
            const titleY = logoY + 10;
            const subtitleY = logoY + 20;
            doc.setFontSize(20);
            doc.setTextColor(20, 83, 45);
            doc.text('Parrilla Los Nogales', textX, titleY, { align: 'left' });
            doc.setFontSize(16);
            doc.setTextColor(34, 197, 94);
            doc.text('Comprobante de Reserva', textX, subtitleY, { align: 'left' });
            doc.setDrawColor(34, 197, 94);
            doc.setLineWidth(0.5);
            doc.line(20, 45, 190, 45);
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.text('Datos del Cliente:', 20, 60);
            doc.setFont('helvetica', 'normal');
            doc.text(`Nombre: ${nombre || 'No especificado'}`, 20, 70);
            doc.text(`Teléfono: ${phone || ''}`, 20, 76);
            doc.text(`Área: ${area || 'No especificada'}`, 20, 82);
            doc.text(`Fecha de Reserva: ${fecha || 'No especificada'}`, 20, 88);
            doc.text(`Hora: ${time || 'No especificada'}`, 20, 94);
            doc.text(`Turno: ${turnoFinal || 'No especificado'}`, 20, 100);
            doc.text(`Comensales: ${diners || 'No especificado'}`, 20, 106);
            doc.setFont('helvetica', 'bold');
            doc.text('Detalles del Pago:', 20, 120);
            doc.setFont('helvetica', 'normal');
            let montoSenia = monto;
            if (typeof montoSenia === 'undefined' || montoSenia === null) {
                if (typeof depositAmount !== 'undefined') montoSenia = depositAmount;
                else if (typeof diners !== 'undefined') montoSenia = calcularMontoSenia(diners);
                else montoSenia = 10;
            }
            doc.text(`Monto de Seña: $${(montoSenia).toLocaleString('es-AR')}`, 20, 126);
            let estadoPago = 'PENDIENTE';
            if (typeof paymentStatus !== 'undefined' && paymentStatus) {
                if (paymentStatus === 'approved' || paymentStatus === 'confirmed' || paymentStatus === 'PAGADO') {
                    estadoPago = 'PAGADO';
                } else if (paymentStatus === 'pending' || paymentStatus === 'PENDIENTE') {
                    estadoPago = 'PENDIENTE';
                } else if (paymentStatus === 'rejected' || paymentStatus === 'RECHAZADO') {
                    estadoPago = 'RECHAZADO';
                } else {
                    estadoPago = paymentStatus.toUpperCase();
                }
            } else if (typeof estado !== 'undefined' && estado) {
                estadoPago = estado.toUpperCase();
            } else if (typeof status !== 'undefined' && status) {
                estadoPago = status.toUpperCase();
            }
            doc.text(`Estado: ${estadoPago}`, 20, 132);
            if (paymentId && paymentId !== '') {
                doc.text(`ID de Pago: ${paymentId}`, 20, 138);
            }
            doc.setFont('helvetica', 'bold');
            doc.text('Información Técnica:', 20, 152);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`ID de Reserva: ${reservaId || 'No disponible'}`, 20, 160);
            doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-AR')}`, 20, 166);
            doc.text(`Hora de Emisión: ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}`, 20, 172);
            if (notes && notes !== '') {
                doc.setFont('helvetica', 'bold');
                doc.text('Notas:', 20, 182);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.text(notes, 20, 188);
            }
            doc.setFontSize(10);
            doc.setTextColor(107, 114, 128);
            doc.text('Notas importantes:', 20, 200);
            doc.setFontSize(8);
            doc.text('• Este es un comprobante generado automáticamente', 20, 207);
            doc.text('• La reserva tiene una tolerancia de 15 minutos', 20, 214);
            doc.text('• En caso de cancelación, avisar con 24h de anticipación', 20, 221);
            doc.text('• El resto del monto se abona al finalizar la comida', 20, 228);
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text('Parrilla Los Nogales - Sistema de Reservas Automatizado', 105, 280, { align: 'center' });
            const fileName = `comprobante_reserva_${reservaId || 'nogales'}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            console.log('✅ [PDF_GENERATE] Comprobante generado exitosamente:', fileName);
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const logoDataUrl = canvas.toDataURL('image/png');
                generatePDFContent(logoDataUrl);
                console.log('✅ [PDF_GENERATE] Logo cargado exitosamente');
            } catch (logoError) {
                console.warn('⚠️ [PDF_GENERATE] Error al procesar logo:', logoError);
                generatePDFContent();
            }
        };
        img.onerror = function() {
            console.warn('⚠️ [PDF_GENERATE] No se pudo cargar el logo, continuando sin él');
            generatePDFContent();
        };
        img.src = './Logo/Logo-Los-Nogales.png';
    } catch (error) {
        console.error('❌ [PDF_GENERATE] Error al generar PDF:', error);
        alert('Error al generar el comprobante PDF. Por favor, intenta de nuevo.');
    }
}

// ===================================================================
// FUNCIÓN MEJORADA: Descargar PDF de Mercado Pago
// Funciona tanto en localhost como en la nube con fallback
// ===================================================================
function descargarPDFviaProxy(urlDelPDFMercadoPago) {
    console.log('📄 [PDF_DOWNLOAD] Intentando descargar PDF:', urlDelPDFMercadoPago);
    
    // Detectar si estamos en localhost o en la nube
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const proxyUrl = isLocalhost 
        ? 'http://localhost:3001/proxy-pdf?url=' + encodeURIComponent(urlDelPDFMercadoPago)
        : 'https://tu-dominio-backend.com/proxy-pdf?url=' + encodeURIComponent(urlDelPDFMercadoPago); // Cambiar por tu dominio real
    
    // Intentar con proxy primero
    fetch(proxyUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Proxy no disponible (${response.status})`);
            }
            return response.blob();
        })
        .then(blob => {
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = 'comprobante_mercadopago.pdf';
            link.click();
            window.URL.revokeObjectURL(link.href);
            console.log('✅ [PDF_DOWNLOAD] PDF descargado exitosamente via proxy');
        })
        .catch(error => {
            console.warn('⚠️ [PDF_DOWNLOAD] Error con proxy, intentando descarga directa:', error.message);
            
            // Fallback: intentar descarga directa
            const link = document.createElement('a');
            link.href = urlDelPDFMercadoPago;
            link.target = '_blank';
            link.download = 'comprobante_mercadopago.pdf';
            
            // Mostrar mensaje al usuario
            const userMessage = isLocalhost 
                ? 'El servidor proxy no está disponible. Abriendo el PDF en una nueva pestaña...'
                : 'Descarga directa no disponible. Abriendo el PDF en Mercado Pago...';
            
            alert(userMessage);
            
            // Intentar abrir en nueva pestaña
            try {
                link.click();
            } catch (directError) {
                console.error('❌ [PDF_DOWNLOAD] Error en descarga directa:', directError);
                alert('No se pudo descargar el PDF. Por favor, accede a tu cuenta de Mercado Pago para ver el comprobante.');
            }
        });
}

/**
 * Genera comprobante PDF desde el botón en la UI.
 */
window.generarComprobantePDF = function(reservationData) {
    console.log('📄 [PDF] Solicitando comprobante para:', reservationData);
    
    if (!reservationData) {
        console.error('❌ [PDF] No se proporcionaron datos de reserva');
        alert('Error: No se pudo identificar la reserva.');
        return;
    }
    
    // Si solo se pasa el ID, buscar la reserva completa en Firebase
    if (typeof reservationData === 'string') {
        const reservationRef = doc(db, "reservations", reservationData);
        getDoc(reservationRef).then((docSnap) => {
            if (docSnap.exists()) {
                const fullReservationData = { id: docSnap.id, ...docSnap.data() };
                generarComprobantePDF(fullReservationData);
            } else {
                console.error('❌ [PDF] Reserva no encontrada:', reservationData);
                alert('Error: No se encontró la reserva especificada.');
            }
        }).catch((error) => {
            console.error('❌ [PDF] Error al obtener datos de reserva:', error);
            alert('Error al obtener los datos de la reserva.');
        });
    } else {
        // Si se pasan los datos completos, asegurar que area y notes estén presentes
        const pdfData = {
            ...reservationData,
            area: reservationData.area || '',
            notes: reservationData.notes || ''
        };
        generarComprobantePDF(pdfData);
    }
};

/**
 * Descarga PDF de Mercado Pago desde el botón en la UI.
 */
window.descargarPDFviaProxy = function(urlDelPDFMercadoPago) {
    descargarPDFviaProxy(urlDelPDFMercadoPago);
};

function displayClientMessage(message, type, extraHtml = '') {
    const messageArea = getEl('client-message-area');
    const c = {
        success: { bg: 'bg-green-100', text: 'text-green-800', icon: 'ph-check-circle' },
        error: { bg: 'bg-red-100', text: 'text-red-800', icon: 'ph-x-circle' },
        info: { bg: 'bg-blue-100', text: 'text-blue-800', icon: 'ph-info' }
    }[type];
    
    // Siempre aplicar el estilo de fondo, incluso si el mensaje contiene HTML
    messageArea.innerHTML = `<div class="${c.bg} ${c.text} p-4 rounded-lg"><div class="flex items-center justify-center gap-3"><i class="ph ${c.icon} text-2xl"></i><div class="text-left">${message}</div></div><div class="mt-2">${extraHtml}</div></div>`;
}

// ===================================================================
// FUNCIÓN: Crear preferencia de pago directa (sin reserva previa)
// ===================================================================
/**
 * Crea la preferencia de pago directamente desde el frontend usando el Access Token de Mercado Pago.
 * El Access Token se debe configurar como variable de entorno VITE_MP_ACCESS_TOKEN en Netlify o en un archivo .env.
 * Esto es compatible con Vite y Netlify.
 */
async function createDirectPaymentPreference(reservationData) {
    try {
        console.log('💳 [DIRECT_PAYMENT] Creando preferencia de pago directa desde el frontend');
            // const MP_ACCESS_TOKEN = import.meta.env.VITE_MP_ACCESS_TOKEN;
    // if (!MP_ACCESS_TOKEN) {
    //     displayClientMessage('Error: No se encontró el Access Token de Mercado Pago. Configura la variable VITE_MP_ACCESS_TOKEN.', 'error');
    //     return;
    // }
        const tempId = reservationData.tempId;
        const depositAmount = reservationData.depositAmount || calcularMontoSenia(reservationData.diners) || DEPOSIT_AMOUNT;
        let currentUrl = window.location.origin + window.location.pathname;
        if (currentUrl.endsWith('/')) {
            currentUrl = currentUrl.slice(0, -1);
        }
        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                items: [{
                    title: `Seña Reserva - ${reservationData.name}`,
                    description: `Reserva para ${reservationData.diners} personas el ${new Date(reservationData.date + 'T00:00:00').toLocaleDateString('es-AR')} a las ${reservationData.time}hs`,
                    quantity: 1,
                    unit_price: depositAmount,
                    currency_id: 'ARS'
                }],
                back_urls: {
                    success: `${currentUrl}?payment_status=approved&temp_id=${tempId}`,
                    failure: `${currentUrl}?payment_status=rejected&temp_id=${tempId}`,
                    pending: `${currentUrl}?payment_status=pending&temp_id=${tempId}`
                },
                auto_return: 'approved',
                external_reference: tempId
            })
        });
        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ [DIRECT_PAYMENT] Error de la API de Mercado Pago:', errorData);
            displayClientMessage(`Error al crear el pago: ${errorData.message}`, 'error');
            return;
        }
        const preference = await response.json();
        const paymentUrl = preference.init_point;
        console.log('✅ [DIRECT_PAYMENT] Preferencia creada, redirigiendo a Mercado Pago');
        window.location.href = paymentUrl;
    } catch (error) {
        console.error('❌ [DIRECT_PAYMENT] Error al crear la preferencia de pago:', error);
        displayClientMessage('Error al generar el link de pago. Por favor, contacta por WhatsApp.', 'error');
    }
}

// Inicialización automática al cargar la página

export async function initializeClientLogic() {
    try {
        console.log('🚀 [CLIENT] Inicializando lógica del cliente...');
        
        // Inicializar Firebase
        await initializeFirebase();
        console.log('✅ [CLIENT] Firebase inicializado');
        
        // Inicializar formulario de reservas solo si existe el contenedor
        if (document.getElementById('reservation-form-container')) {
          initializeReservationForm();
        }
        console.log('✅ [CLIENT] Formulario de reservas inicializado');
        
        // Inicializar modal de búsqueda
        initializeSearchModal();
        console.log('✅ [CLIENT] Modal de búsqueda inicializado');

        // Inicializar botones de navegación
        initializeNavigationButtons();
        console.log('✅ [CLIENT] Botones de navegación inicializados');
        
        // Registrar Service Worker para notificaciones
        await registerServiceWorker();
        console.log('✅ [CLIENT] Service Worker registrado para notificaciones');
        
        // Verificar parámetros de pago
        checkPaymentParameters();
        console.log('✅ [CLIENT] Parámetros de pago verificados');
        
        console.log('✅ [CLIENT] Lógica del cliente inicializada correctamente');
        
    } catch (error) {
        console.error('❌ [CLIENT] Error al inicializar lógica del cliente:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof initializeClientLogic === 'function') {
        initializeClientLogic();
    } else if (window.initializeClientLogic) {
        window.initializeClientLogic();
    }
}); 

// Función para guardar el token FCM del cliente en Firestore
async function saveClientToken(currentToken, phone) {
  if (!currentToken || !phone) return;
  try {
    await setDoc(doc(db, "clientTokens", phone), {
      token: currentToken,
      activo: true
    });
    console.log("Token de cliente guardado en Firestore");
  } catch (e) {
    console.error("Error guardando token de cliente en Firestore:", e);
  }
}

// Ejemplo de uso: después de obtener el token y el teléfono del cliente
// saveClientToken(currentToken, telefonoCliente); 

// Generador de ID corto aleatorio de 5 caracteres (letras y números)
function generateShortId(length = 5) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// MODAL DE ELIMINACIÓN VISUAL Y VALIDACIÓN DE 24H (diseño visual y moderno, doble paso)
function showDeleteReservationModal(reserva, onConfirm, onCancel) {
    // Eliminar cualquier modal anterior
    const oldModal = document.getElementById('custom-modal-overlay');
    if (oldModal) oldModal.remove();
    // Mostrar directamente el modal de confirmación con ID (sin doble paso)
    showDeleteReservationIdModal(reserva, onConfirm, onCancel);
}

function showDeleteReservationIdModal(reserva, onConfirm, onCancel) {
    // Eliminar cualquier modal anterior
    const oldModal = document.getElementById('custom-modal-overlay');
    if (oldModal) oldModal.remove();
    const overlay = document.createElement('div');
    overlay.id = 'custom-modal-overlay';
    overlay.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50';
    overlay.style.zIndex = 9999;
    const modal = document.createElement('div');
    modal.className = 'bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center relative border-2 border-red-200';
    // Icono de advertencia
    const icon = document.createElement('div');
    icon.innerHTML = '<div class="flex justify-center mb-2"><span class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-100"><svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/></svg></span></div>';
    modal.appendChild(icon);
    // Título
    const titleEl = document.createElement('h2');
    titleEl.className = 'text-2xl font-bold mb-2 text-red-700';
    titleEl.textContent = 'Confirma el ID de la Reserva';
    modal.appendChild(titleEl);
    // Mensaje
    const msgEl = document.createElement('p');
    msgEl.className = 'mb-4 text-gray-700';
    msgEl.innerHTML = 'Para eliminar la reserva, ingresa el <b>ID exacto</b> de la reserva.<br><span class="text-xs text-gray-500">(Lo ves en el comprobante o en la lista)</span>';
    modal.appendChild(msgEl);
    // Input para el ID
    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.className = 'w-full border border-gray-300 rounded px-3 py-2 mb-3 text-center';
    inputEl.placeholder = 'ID de la reserva';
    modal.appendChild(inputEl);
    // Mensaje de error
    const errorEl = document.createElement('div');
    errorEl.className = 'text-red-600 text-sm mb-2 hidden';
    modal.appendChild(errorEl);
    // Botones
    const btnGroup = document.createElement('div');
    btnGroup.className = 'flex flex-col gap-2 mt-2';
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'w-full bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition text-lg';
    confirmBtn.textContent = 'Eliminar';
    btnGroup.appendChild(confirmBtn);
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'w-full bg-gray-200 text-gray-800 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 transition text-lg';
    cancelBtn.textContent = 'Cancelar';
    btnGroup.appendChild(cancelBtn);
    modal.appendChild(btnGroup);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    // Validación de 24h antes de permitir eliminar
    if (!canCancelReservation(reserva.date, reserva.time)) {
        errorEl.textContent = 'Solo puedes cancelar tu reserva con al menos 24h de anticipación.';
        errorEl.classList.remove('hidden');
        confirmBtn.disabled = true;
        inputEl.disabled = true;
        setTimeout(() => {
            document.body.removeChild(overlay);
            if (onCancel) onCancel();
        }, 2500);
        return;
    }
    confirmBtn.onclick = () => {
        if (!inputEl.value.trim() || inputEl.value.trim() !== reserva.id) {
            errorEl.textContent = 'El ID ingresado no es correcto.';
            errorEl.classList.remove('hidden');
            return;
        }
        errorEl.classList.add('hidden');
        document.body.removeChild(overlay);
        onConfirm();
    };
    cancelBtn.onclick = () => {
        document.body.removeChild(overlay);
        if (onCancel) onCancel();
    };
}

// MODAL DE CONFIRMACIÓN DE ID PARA EDICIÓN
function showEditReservationIdModal(reserva, onConfirm, onCancel) {
    // Eliminar cualquier modal anterior
    const oldModal = document.getElementById('custom-modal-overlay');
    if (oldModal) oldModal.remove();
    const overlay = document.createElement('div');
    overlay.id = 'custom-modal-overlay';
    overlay.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50';
    overlay.style.zIndex = 9999;
    const modal = document.createElement('div');
    modal.className = 'bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center relative border-2 border-blue-200';
    // Icono de información
    const icon = document.createElement('div');
    icon.innerHTML = '<div class="flex justify-center mb-2"><span class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-100"><svg class="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 20c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8z"/></svg></span></div>';
    modal.appendChild(icon);
    // Título
    const titleEl = document.createElement('h2');
    titleEl.className = 'text-2xl font-bold mb-2 text-blue-700';
    titleEl.textContent = 'Confirma el ID de la Reserva';
    modal.appendChild(titleEl);
    // Mensaje
    const msgEl = document.createElement('p');
    msgEl.className = 'mb-4 text-gray-700';
    msgEl.innerHTML = 'Para editar la reserva, ingresa el <b>ID exacto</b> de la reserva.<br><span class="text-xs text-gray-500">(Lo ves en el comprobante o en la lista)</span>';
    modal.appendChild(msgEl);
    // Input para el ID
    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.className = 'w-full border border-gray-300 rounded px-3 py-2 mb-3 text-center';
    inputEl.placeholder = 'ID de la reserva';
    modal.appendChild(inputEl);
    // Mensaje de error
    const errorEl = document.createElement('div');
    errorEl.className = 'text-red-600 text-sm mb-2 hidden';
    modal.appendChild(errorEl);
    // Botones
    const btnGroup = document.createElement('div');
    btnGroup.className = 'flex flex-col gap-2 mt-2';
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition text-lg';
    confirmBtn.textContent = 'Editar';
    btnGroup.appendChild(confirmBtn);
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'w-full bg-gray-200 text-gray-800 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 transition text-lg';
    cancelBtn.textContent = 'Cancelar';
    btnGroup.appendChild(cancelBtn);
    modal.appendChild(btnGroup);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    confirmBtn.onclick = () => {
        if (!inputEl.value.trim() || inputEl.value.trim() !== reserva.id) {
            errorEl.textContent = 'El ID ingresado no es correcto.';
            errorEl.classList.remove('hidden');
            return;
        }
        errorEl.classList.add('hidden');
        document.body.removeChild(overlay);
        onConfirm();
    };
    cancelBtn.onclick = () => {
        document.body.removeChild(overlay);
        if (onCancel) onCancel();
    };
}

// MODAL DE EDICIÓN VISUAL Y MODERNO
function showEditReservationModal(reserva) {
    // Eliminar cualquier modal anterior
    const oldModal = document.getElementById('custom-modal-overlay');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'custom-modal-overlay';
    overlay.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4';
    overlay.style.zIndex = 9999;

    const modal = document.createElement('div');
    modal.className = 'bg-white rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto relative';
    
    // Botón de cerrar (X) en la esquina superior derecha
    const closeBtn = document.createElement('button');
    closeBtn.className = 'absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors z-10';
    closeBtn.innerHTML = '<i class="ph ph-x text-2xl"></i>';
    closeBtn.onclick = () => {
        document.body.removeChild(overlay);
    };
    modal.appendChild(closeBtn);
    
    // Header con título
    const header = document.createElement('div');
    header.className = 'text-center mb-6 sm:mb-8 pt-2';
    header.innerHTML = `
        <div class="flex justify-center mb-3 sm:mb-4">
            <span class="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-100">
                <i class="ph ph-pencil-simple text-2xl sm:text-3xl text-green-600"></i>
            </span>
        </div>
        <h2 class="text-xl sm:text-2xl font-bold text-green-700">Editar Reserva</h2>
        <p class="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">Modifica los datos de tu reserva</p>
    `;
    modal.appendChild(header);
    
    // Formulario de edición simplificado
    const form = document.createElement('form');
    form.className = 'space-y-4 sm:space-y-6';
    
    // Sección: Tus Datos
    const datosSection = document.createElement('div');
    datosSection.className = 'space-y-3 sm:space-y-4';
    datosSection.innerHTML = `
        <h3 class="text-base sm:text-lg font-semibold text-gray-800 border-b pb-2">Tus Datos</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
                <label for="edit-name" class="block text-sm font-medium text-gray-700 mb-1">Nombre y Apellido</label>
                <input type="text" id="edit-name" value="${reserva.name}" required class="w-full p-2 sm:p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 text-sm sm:text-base">
            </div>
            <div>
                <label for="edit-phone" class="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input type="tel" id="edit-phone" value="${reserva.phone}" required class="w-full p-2 sm:p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 text-sm sm:text-base">
            </div>
        </div>
    `;
    form.appendChild(datosSection);
    
    // Campos de reserva sin sección separada
    const reservaSection = document.createElement('div');
    reservaSection.className = 'space-y-3 sm:space-y-4';
    reservaSection.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div>
                <label for="edit-date" class="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input type="date" id="edit-date" value="${reserva.date}" required class="w-full p-2 sm:p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 text-sm sm:text-base">
            </div>
            <div>
                <label for="edit-time" class="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                <input type="time" id="edit-time" value="${reserva.time}" required class="w-full p-2 sm:p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 text-sm sm:text-base">
            </div>
            <div>
                <label for="edit-diners" class="block text-sm font-medium text-gray-700 mb-1">Comensales</label>
                <input type="number" id="edit-diners" value="${reserva.diners}" min="1" max="20" required class="w-full p-2 sm:p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 text-sm sm:text-base">
            </div>
        </div>
    `;
    form.appendChild(reservaSection);
    
    // Mensaje de error
    const errorEl = document.createElement('div');
    errorEl.id = 'edit-error';
    errorEl.className = 'text-red-600 text-sm hidden';
    form.appendChild(errorEl);
    
    modal.appendChild(form);
    
    // Solo botón de guardar (sin cancelar)
    const btnGroup = document.createElement('div');
    btnGroup.className = 'mt-6 sm:mt-8';
    
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'w-full bg-green-700 text-white font-bold py-2 sm:py-3 px-4 rounded-lg hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-500 transition-transform transform hover:scale-105 flex items-center justify-center gap-2 text-sm sm:text-base';
    saveBtn.innerHTML = '<i class="ph ph-check-circle text-lg sm:text-xl"></i>Guardar Cambios';
    btnGroup.appendChild(saveBtn);
    
    modal.appendChild(btnGroup);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Eventos
    saveBtn.onclick = async () => {
        const name = document.getElementById('edit-name').value.trim();
        const phone = document.getElementById('edit-phone').value.trim();
        const date = document.getElementById('edit-date').value;
        const time = document.getElementById('edit-time').value;
        const diners = parseInt(document.getElementById('edit-diners').value);
        const errorEl = document.getElementById('edit-error');
        errorEl.classList.add('hidden');
        // Validaciones estrictas y mensajes preestablecidos
        if (!name || !phone || !date || !time || diners < 1) {
            errorEl.innerHTML = getPredefinedMessage('ERROR');
            errorEl.classList.remove('hidden');
            return;
        }
        const now = new Date();
        const reservationDateTime = new Date(`${date}T${time}`);
        if (reservationDateTime < now) {
            errorEl.innerHTML = getPredefinedMessage('PAST_DATE');
            errorEl.classList.remove('hidden');
            return;
        }
        if (reservationDateTime.toDateString() === now.toDateString() && (reservationDateTime.getTime() - now.getTime()) / 60000 < 30) {
            errorEl.innerHTML = getPredefinedMessage('LESS_THAN_30_MIN');
            errorEl.classList.remove('hidden');
            return;
        }
        if (!await validateReservationTime(date, time, 'client', errorEl)) {
            errorEl.innerHTML = getPredefinedMessage('OUT_OF_HOURS');
            errorEl.classList.remove('hidden');
            return;
        }
        // Verificar capacidad disponible
        const turnData = await getTurn(date, time);
        if (!turnData || !turnData.turnName) {
            errorEl.innerHTML = 'Error al determinar el turno. Intenta de nuevo.';
            errorEl.classList.remove('hidden');
            return;
        }
        const reservationsCollection = collection(db, "reservations");
        const q = query(reservationsCollection, where("date", "==", date), where("turn", "==", turnData.turnName));
        const querySnapshot = await getDocs(q);
        const currentDiners = querySnapshot.docs.reduce((sum, doc) => sum + (doc.data().diners || 0), 0);
        const remainingCapacity = MAX_CAPACITY - currentDiners;
        if (diners > remainingCapacity) {
            const whatsappMsgEdit = getCapacityWhatsAppMessage({ diners, date, time });
            const whatsappBtnEdit = `<a href="https://wa.me/5492644593336?text=${whatsappMsgEdit}" target="_blank" class="mt-4 inline-block w-full text-center bg-yellow-500 text-black font-bold py-3 px-4 rounded-lg hover:bg-yellow-600 transition flex items-center justify-center gap-2"><i class="ph ph-whatsapp-logo text-xl"></i>Coordinar por WhatsApp</a>`;
            errorEl.innerHTML = getPredefinedMessage('CAPACITY_EXCEEDED', { remainingCapacity }) + whatsappBtnEdit;
            errorEl.classList.remove('hidden');
            return;
        }
        try {
            // Usar firestoreId si existe, sino usar el ID del documento
            const docId = reserva.firestoreId || reserva.id;
            await updateDoc(doc(db, 'reservations', docId), {
                name: name,
                phone: phone,
                date: date,
                time: time,
                diners: diners,
                updatedAt: new Date().toISOString(),
                // Sincronizar status con paymentStatus si existe
                ...(typeof reserva.paymentStatus !== 'undefined' ? { status: reserva.paymentStatus } : { status: 'pending' })
            });
            showSuccessModal("Reserva actualizada correctamente.");
            setTimeout(async () => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                // Refrescar la lista de búsqueda inmediatamente
                const searchInput = document.getElementById('search-phone');
                const resultsContainer = document.getElementById('search-results-container');
                const messageEl = document.getElementById('search-message');
                if (searchInput && resultsContainer && messageEl) {
                    await handleSearchSubmit(resultsContainer, messageEl);
                }
            }, 1000);
        } catch (error) {
            errorEl.innerHTML = getPredefinedMessage('ERROR');
            errorEl.classList.remove('hidden');
            console.error('❌ [EDIT_RESERVATION] Error al actualizar reserva:', error);
        }
    };
}

// ========== LÓGICA DE CANCELACIÓN: Solo permitir cancelar con más de 24h de anticipación ==========

export function canCancelReservation(reservationDate, reservationTime) {
    // reservationDate en formato YYYY-MM-DD, reservationTime en formato HH:mm
    const reservationDateTime = new Date(`${reservationDate}T${reservationTime}`);
    const now = new Date();
    const diffMs = reservationDateTime - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours > 24;
} 

// Renderizado de la lista de reservas con estado real del pago y eventos correctos
function renderReservationCard(res, container, isAdmin = false) {
    const dateFormatted = new Date(res.date + 'T00:00:00').toLocaleDateString('es-AR');
    const isToday = res.date === new Date().toISOString().split('T')[0];
    const isPast = isToday && new Date(res.date + 'T' + res.time) < new Date();

    // Estado de pago real
    let paymentStatusClass = '';
    let paymentStatusText = '';
    if (res.paymentStatus === 'approved' || res.paymentStatus === 'confirmed') {
        paymentStatusClass = 'bg-green-100 text-green-800';
        paymentStatusText = 'Pagada';
    } else if (res.paymentStatus === 'pending') {
        paymentStatusClass = 'bg-yellow-100 text-yellow-800';
        paymentStatusText = 'Pendiente';
    } else if (res.paymentStatus === 'rejected') {
        paymentStatusClass = 'bg-red-100 text-red-800';
        paymentStatusText = 'Rechazada';
    } else {
        paymentStatusClass = 'bg-gray-100 text-gray-700';
        paymentStatusText = 'Desconocido';
    }

    // Limpiar el contenedor si es necesario (opcional, depende de tu flujo)
    // container.innerHTML = '';

    const resultCard = document.createElement('div');
    resultCard.className = `p-3 border rounded-lg ${isPast ? 'bg-red-50 border-red-200' : isToday ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50'} flex justify-between items-center`;
    resultCard.setAttribute('data-id', res.id);
    resultCard.innerHTML = `
        <div>
            <p class="font-bold">${res.name}</p>
            <p class="text-sm text-gray-600">${dateFormatted} - ${res.time} hs - ${res.diners} personas</p>
            <p class="text-xs mt-1">
                <span class="px-2 py-1 font-semibold leading-tight rounded-full ${paymentStatusClass}">${paymentStatusText}</span>
                ${isPast ? '<span class="px-2 py-1 font-semibold leading-tight rounded-full bg-red-100 text-red-800 ml-1">Pasada</span>' : 
                  isToday ? '<span class="px-2 py-1 font-semibold leading-tight rounded-full bg-yellow-100 text-yellow-800 ml-1">Hoy</span>' : 
                  '<span class="px-2 py-1 font-semibold leading-tight rounded-full bg-blue-100 text-blue-800 ml-1">Futura</span>'}
            </p>
            <button class="download-pdf-btn mt-2 bg-blue-700 text-white font-bold py-2 px-3 rounded-lg hover:bg-blue-800 transition flex items-center gap-2 text-sm">
                <i class='ph ph-download-simple text-base'></i> Descargar comprobante (PDF)
            </button>
        </div>
        <div class="flex gap-2">
            <button class="action-button edit-res-btn p-2 text-blue-500 hover:text-blue-700 rounded-full hover:bg-blue-100" title="Editar" data-id="${res.id}"><i class="ph ph-pencil-simple text-lg"></i></button>
            <button class="action-button delete-res-btn p-2 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100" title="Eliminar" data-id="${res.id}"><i class="ph ph-trash text-lg"></i></button>
        </div>
    `;
    container.appendChild(resultCard);

    // Asignar eventos a los botones SIEMPRE después de renderizar
    const editBtn = resultCard.querySelector('.edit-res-btn');
    const deleteBtn = resultCard.querySelector('.delete-res-btn');
    const downloadBtn = resultCard.querySelector('.download-pdf-btn');

    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔧 [EDIT] Editando reserva:', res.id);
            if (isAdmin) {
                // Admin: editar directamente sin pedir ID
                showEditReservationModal(res);
            } else {
                // Cliente: pedir confirmación de ID antes de editar
                showEditReservationIdModal(res, () => showEditReservationModal(res));
            }
        });
    }
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🗑️ [DELETE] Intentando eliminar reserva:', res.id);
            showDeleteReservationModal(res, async () => {
                try {
                    // Guardar registro de cancelación en Firestore antes de eliminar
                    const cancellationData = {
                        reservationId: res.id,
                        name: res.name || '',
                        phone: res.phone || '',
                        date: res.date || '',
                        time: res.time || '',
                        diners: res.diners || '',
                        cancelledAt: new Date().toISOString(),
                        cancelledBy: 'cliente',
                        motivo: 'Cancelada por cliente'
                    };
                    // Usar firestoreId si existe, sino usar el ID del documento
                    const docId = res.firestoreId || res.id;
                    await setDoc(doc(db, "cancellations", docId + '_' + Date.now()), cancellationData);
                    await deleteDoc(doc(db, 'reservations', docId));
                    // Cerrar cualquier modal de confirmación de eliminación
                    const overlay = document.getElementById('custom-modal-overlay');
                    if (overlay && document.body.contains(overlay)) document.body.removeChild(overlay);
                    // Refrescar la lista de búsqueda inmediatamente
                    const searchInput = document.getElementById('search-phone');
                    const resultsContainer = document.getElementById('search-results-container');
                    const messageEl = document.getElementById('search-message');
                    if (searchInput && resultsContainer && messageEl) {
                        await handleSearchSubmit(resultsContainer, messageEl);
                    }
                    // Mostrar el modal de éxito encima, sin bloquear la lista
                    showSuccessDeleteModal();
                } catch (error) {
                    alert('Ocurrió un error al eliminar la reserva. Intenta de nuevo.');
                    console.error('❌ [DELETE_RESERVATION] Error al eliminar reserva:', error);
                }
            }, () => {
                console.log('❌ [DELETE] Cancelado por el usuario');
            });
        });
        if (!canCancelReservation(res.date, res.time)) {
            deleteBtn.disabled = true;
            deleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
            deleteBtn.title = 'Solo puedes cancelar con 24h de anticipación';
        }
    }
    if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('📄 [DOWNLOAD] Descargando comprobante para reserva:', res.id);
            generarComprobantePDF({
                nombre: res.name,
                fecha: res.date,
                monto: res.depositAmount || res.monto,
                reservaId: res.id,
                paymentStatus: res.paymentStatus,
                paymentId: res.paymentId,
                time: res.time,
                diners: res.diners,
                area: res.area || '',
                notes: res.notes || '',
                estado: res.estado,
                status: res.status,
                depositAmount: res.depositAmount,
                phone: res.phone // <-- Aseguramos que se pase el teléfono real
            });
        });
    }
} 

// MODAL DE ÉXITO TRAS ELIMINAR RESERVA (sin recargar la página)
function showSuccessDeleteModal() {
    // Eliminar cualquier modal anterior
    const oldModal = document.getElementById('custom-modal-overlay');
    if (oldModal) oldModal.remove();
    const overlay = document.createElement('div');
    overlay.id = 'custom-modal-overlay';
    overlay.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50';
    overlay.style.zIndex = 9999;
    const modal = document.createElement('div');
    modal.className = 'bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center relative animate__animated animate__fadeInDown';
    // Icono de éxito
    const icon = document.createElement('div');
    icon.innerHTML = '<div class="flex justify-center mb-2"><span class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100"><svg class="w-10 h-10 text-green-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2l4 -4"/><circle cx="12" cy="12" r="9"/></svg></span></div>';
    modal.appendChild(icon);
    // Título
    const titleEl = document.createElement('h2');
    titleEl.className = 'text-2xl font-bold mb-2 text-green-700';
    titleEl.textContent = '¡Reserva Cancelada!';
    modal.appendChild(titleEl);
    // Mensaje
    const msgEl = document.createElement('p');
    msgEl.className = 'mb-4 text-gray-700';
    msgEl.textContent = 'La reserva fue eliminada correctamente.';
    modal.appendChild(msgEl);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(() => {
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
        // No recargar la página, solo mostrar el modal
    }, 1000);
} 

/**
 * Muestra el modal animado de éxito con mensaje personalizado
 */
function showSuccessModal(message = "Reserva actualizada correctamente.") {
  // Eliminar cualquier modal anterior
  const oldModal = document.getElementById('custom-modal-overlay');
  if (oldModal) oldModal.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'custom-modal-overlay';
  overlay.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50';
  overlay.style.zIndex = 9999;
  
  const modal = document.createElement('div');
  modal.className = 'bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center relative animate__animated animate__fadeInDown';
  
  // Icono de éxito
  const icon = document.createElement('div');
  icon.innerHTML = '<div class="flex justify-center mb-2"><span class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100"><svg class="w-10 h-10 text-green-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2l4 -4"/><circle cx="12" cy="12" r="9"/></svg></span></div>';
  modal.appendChild(icon);
  
  // Título
  const titleEl = document.createElement('h2');
  titleEl.className = 'text-2xl font-bold mb-2 text-green-700';
  titleEl.textContent = '¡Éxito!';
  modal.appendChild(titleEl);
  
  // Mensaje
  const msgEl = document.createElement('p');
  msgEl.className = 'mb-4 text-gray-700';
  msgEl.textContent = message;
  modal.appendChild(msgEl);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Auto-cerrar después de 1 segundo
  setTimeout(() => {
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
  }, 1000);
}

/**
 * Consulta Firestore para saber si el turno está abierto/cerrado de forma especial
 */
async function getSpecialTurnStatus(date, turn) {
  if (!db) return null;
  try {
    console.log('[DEBUG] Consultando día especial:', { date, turn });
    const docRef = doc(collection(db, 'turnosEspeciales'), date);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('[DEBUG] Documento especial encontrado:', data);
      if (turn === 'Almuerzo' && data.almuerzo) return data.almuerzo;
      if (turn === 'Cena' && data.cena) return data.cena;
    } else {
      console.log('[DEBUG] No existe documento especial para esa fecha');
    }
  } catch (e) { console.error('Error consultando turnos especiales:', e); }
  return null;
}

// Microcambio: Centralizar mensajes preestablecidos en displayClientMessage para creación de reservas
function getPredefinedMessage(key, data = {}) {
    switch (key) {
        case 'PAST_DATE':
            return 'No puedes reservar para una fecha pasada.';
        case 'LESS_THAN_30_MIN':
            return 'Fuera de Tiempo: Las reservas para hoy deben hacerse con al menos 30 minutos de anticipación.';
        case 'OUT_OF_HOURS':
            return 'CERRADO: El restaurante no está abierto en el horario seleccionado.';
        case 'LESS_THAN_1H_BEFORE_CLOSE':
            return 'No se pueden hacer reservas con menos de 1 hora de anticipación al cierre del turno.';
        case 'CAPACITY_EXCEEDED':
            return `<strong>CAPACIDAD SUPERADA</strong><br>Solo quedan <strong>${data.remainingCapacity}</strong> lugares. Para grupos grandes, contáctanos.`;
        case 'RESERVA_EXITOSA':
            return `<strong>¡ÚLTIMO PASO!</strong><br>Tu reserva está pre-agendada. Para confirmarla definitivamente, envíanos un WhatsApp.`;
        case 'ERROR':
            return 'Error al procesar la solicitud. Intenta de nuevo o contacta por WhatsApp.';
        default:
            return '';
    }
}

function getCapacityWhatsAppMessage({ diners, date, time }) {
    const fecha = new Date(date + 'T00:00:00').toLocaleDateString('es-AR');
    return encodeURIComponent(`Hola Parrilla Los Nogales, quisiera consultar por una reserva para ${diners} personas el día ${fecha} a las ${time}, ya que no encontré lugar en la web. ¿Habrá alguna posibilidad?`);
}

// MODAL VISUAL PARA FECHAS ESPECIALES
function showSpecialDateModal({ title, message, icon = "info" }) {
  // Elimina cualquier modal anterior
  const oldModal = document.getElementById('special-date-modal-overlay');
  if (oldModal) oldModal.remove();

  // Crea el overlay y el modal
  const overlay = document.createElement('div');
  overlay.id = 'special-date-modal-overlay';
  overlay.className = 'fixed inset-0 bg-gray-700 bg-opacity-60 flex items-center justify-center z-50 p-1';

  const modal = document.createElement('div');
  modal.className = 'bg-white rounded-2xl shadow-2xl p-2 sm:p-4 md:p-6 w-[95vw] max-w-xs sm:max-w-sm max-h-[90vh] overflow-y-auto text-center relative border-2 border-blue-200 animate__animated animate__fadeInDown text-xs sm:text-base';

  // Icono dinámico según tipo
  let iconSvg = '';
  if (icon === "info") {
    iconSvg = `<svg class="w-8 h-8 sm:w-10 sm:h-10 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 20c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8z"/></svg>`;
  } else if (icon === "error") {
    iconSvg = `<svg class="w-8 h-8 sm:w-10 sm:h-10 text-red-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/></svg>`;
  } else if (icon === "success") {
    iconSvg = `<svg class="w-8 h-8 sm:w-10 sm:h-10 text-green-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2l4 -4"/><circle cx="12" cy="12" r="9"/></svg>`;
  }

  modal.innerHTML = `
    <div class="flex justify-center mb-2">
      <span class="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100">
        ${iconSvg}
      </span>
    </div>
    <h2 class="text-base sm:text-xl font-bold mb-2 text-blue-700">${title}</h2>
    <p class="mb-4 text-gray-700 text-xs sm:text-base">${message}</p>
    <button id="close-special-date-modal" class="w-full bg-blue-600 text-white font-bold py-2 sm:py-3 px-4 rounded-lg hover:bg-blue-700 transition text-xs sm:text-base mt-2">
      Cerrar
    </button>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('close-special-date-modal').onclick = () => {
    document.body.removeChild(overlay);
  };
}

// ========== FUNCIÓN CENTRALIZADA PARA CALCULAR SEÑA ==========
export function calcularMontoSenia(diners) {
  if (diners >= 60) return 100000;
  if (diners >= 30) return 50000;
  if (diners >= 10) return 25000;
  return 10000;
}

function getLocalDateString() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
}
function getTomorrowLocalDateString() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    now.setDate(now.getDate() + 1);
    return now.toISOString().slice(0, 10);
}