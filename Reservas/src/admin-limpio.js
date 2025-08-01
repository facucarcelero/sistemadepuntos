import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, doc, deleteDoc, updateDoc, getDoc, setDoc, serverTimestamp, onSnapshot, addDoc, orderBy, limit, startAfter } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { NOTIFICATION_CONFIG, createNotificationOptions } from "./config.js";
import { initializeSearchModal } from './cliente.js'; // Ensure this path is correct

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

const messaging = getMessaging(app);

const VAPID_KEY = "BNajMopvmxkuBroh5TYWc4ZAQjnRhRfdDeTNYPn6guoHF6aOrS-yXetEeguxhq5J1ANsD1CvxlJm_teh33DR7N0";

// Espera a que el Service Worker de Firebase esté registrado antes de pedir el token
navigator.serviceWorker.ready.then((registration) => {
    getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
        .then((currentToken) => {
            if (currentToken) {
                console.log('Token FCM:', currentToken);
                // Guardar el token en Firestore
                saveAdminToken(currentToken);
            } else {
                console.log('No se pudo obtener el token de FCM.');
            }
        })
        .catch((err) => {
            console.log('Error obteniendo token de FCM:', err);
        });
});

async function saveAdminToken(currentToken) {
    if (!currentToken) return;
    try {
        // Verificar si el token ya existe
        const q = query(collection(db, "adminTokens"), where("token", "==", currentToken));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            await setDoc(doc(db, "adminTokens", currentToken), {
                token: currentToken,
                activo: true
            });
            console.log("Token guardado en Firestore");
        } else {
            console.log("Token ya existe en Firestore, no se guarda duplicado");
        }
    } catch (e) {
        console.error("Error guardando token en Firestore:", e);
    }
}

// Recibe mensajes cuando la app está en primer plano
onMessage(messaging, (payload) => {
    console.log('Mensaje recibido en primer plano:', payload);
    // Puedes mostrar una notificación aquí si quieres
});

// ========== HELPERS ==========
const getEl = (id) => document.getElementById(id);

/**
 * Calcula el monto de seña según la cantidad de comensales
 */
function calcularMontoSenia(diners) {
    if (diners >= 60) return 100000;
    if (diners >= 30) return 50000;
    if (diners >= 10) return 25000;
    return 10000;
}

/**
 * Detecta si el usuario está en un dispositivo móvil
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768;
}

/**
 * Detecta específicamente Samsung Galaxy
 */
function isSamsungGalaxy() {
    return /Samsung|SM-/i.test(navigator.userAgent);
}

// ========== INICIALIZACIÓN DEL PANEL ==========
function initializeAdminPanel() {
    // Configuración de fecha base y eventos de filtros
    const dateFilter = getEl('dateFilter');
    if (dateFilter) {
        // Usar fecha local en lugar de UTC para evitar problemas de zona horaria
        const now = new Date();
        const today = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0');
        // Solo asignar la fecha si el usuario no ha seleccionado una
        if (!dateFilter.value) {
            dateFilter.value = today;
            console.log(`📅 Fecha inicial configurada: ${today}`);
        } else {
            console.log(`📅 Fecha ya seleccionada por el usuario: ${dateFilter.value}`);
        }
        dateFilter.addEventListener('change', () => {
            currentFilter = 'all';
            updateFilterCardStyles('all');
            cleanupFirestoreListener();
            setupFirestoreListener(); // Re-setup listener to ensure it's active for the new date
            fetchAdminReservations(dateFilter.value, 'daily');
        });
        // Ejecutar consulta inicial
        fetchAdminReservations(dateFilter.value || today, 'daily');
    }

    // Botón refrescar
    const refreshButton = getEl('refresh-button');
    if (refreshButton) {
        refreshButton.onclick = () => {
            // Limpiar estado antes de refrescar
            reinitializeSystem();

            const dateFilter = getEl('dateFilter');
            const periodSelector = getEl('periodSelector');
            if (dateFilter && dateFilter.value) {
                fetchAdminReservations(dateFilter.value, periodSelector ? periodSelector.value : 'daily');
            }
            // Agregar animación de rotación
            refreshButton.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                refreshButton.style.transform = 'rotate(0deg)';
            }, 500);
        };
    }

    // Botón forzar actualización completa
    const forceRefreshButton = getEl('force-refresh-button');
    if (forceRefreshButton) {
        forceRefreshButton.onclick = async () => {
            // Agregar animación de escala
            forceRefreshButton.style.transform = 'scale(1.2)';
            setTimeout(() => {
                forceRefreshButton.style.transform = 'scale(1)';
            }, 200);

            await forceRefreshReservations();
        };
    }


    // Filtros por período
    const periodSelector = getEl('periodSelector');
    const customDateRangeInputs = getEl('customDateRangeInputs');
    const dateRangeStart = getEl('dateRangeStart');
    const dateRangeEnd = getEl('dateRangeEnd');
    const periodDisplay = getEl('periodDisplay');
    const selectedPeriodRangeDisplay = getEl('selectedPeriodRangeDisplay');

    if (periodSelector) {
        periodSelector.addEventListener('change', function() {
            const selectedPeriod = this.value;
            const dateFilter = getEl('dateFilter');
            if (selectedPeriod === 'custom') {
                if (customDateRangeInputs) customDateRangeInputs.classList.remove('hidden');
            } else {
                if (customDateRangeInputs) customDateRangeInputs.classList.add('hidden');
                if (periodDisplay) {
                    const periodTexts = {
                        'daily': 'Hoy',
                        'weekly': 'Esta semana',
                        'monthly': 'Este mes',
                        'yearly': 'Este año'
                    };
                    periodDisplay.textContent = periodTexts[selectedPeriod] || '';
                }
                if (dateFilter && dateFilter.value) {
                    fetchAdminReservations(dateFilter.value, selectedPeriod);
                }
            }
        });
        if (dateRangeStart && dateRangeEnd) {
            const handleCustomDateChange = () => {
                if (dateRangeStart.value && dateRangeEnd.value) {
                    if (selectedPeriodRangeDisplay) {
                        const startFormatted = new Date(dateRangeStart.value + 'T00:00:00').toLocaleDateString('es-AR');
                        const endFormatted = new Date(dateRangeEnd.value + 'T00:00:00').toLocaleDateString('es-AR');
                        selectedPeriodRangeDisplay.textContent = `Período: ${startFormatted} a ${endFormatted}`;
                    }
                    fetchAdminReservations(null, 'custom');
                }
            };
            dateRangeStart.addEventListener('change', handleCustomDateChange);
            dateRangeEnd.addEventListener('change', handleCustomDateChange);
        }
    }

    // Configurar búsqueda y exportar
    setupAdminSearchAndExport();

    // Configurar eventos de acciones
    setupAdminActionEvents();

    // Configurar búsqueda avanzada
    setupAdminAdvancedSearch();

    // Registrar Service Worker para notificaciones del admin
    registerAdminServiceWorker().catch(error => {
        console.error('❌ [ADMIN] Error registrando Service Worker:', error);
    });

    // Inicializar el listener de notificaciones del cliente
    setupAdminNotificationListener();

    // Inicializar sistema de recordatorios automáticos
    setupAdminReminderSystem();

    // Configurar notificaciones en segundo plano para Samsung
    setupBackgroundNotifications();

    // Detectar dispositivo y mostrar información
    if (isMobileDevice()) {
        console.log('📱 [ADMIN_MOBILE] Dispositivo móvil detectado');
        if (isSamsungGalaxy()) {
            console.log('📱 [ADMIN_MOBILE] Samsung Galaxy detectado - Notificaciones optimizadas activadas');
        }
    } else {
        console.log('🖥️ [ADMIN] Dispositivo desktop detectado');
    }

    // Inicializar componentes del admin
    setupAdminActionEvents();
    setupAdminSearchAndExport();
    setupAdminAdvancedSearch();
    setupAddReservationButton();
    setupSpecialDaysModal();
    setupEditModal();
    setupCancellationsHistoryModal();

    // Inicializar sistema de asistencias por tiempo
    initializeAttendanceSystem();

    // Inicializar sistema de filtros por turno
    setupTurnFilters();

    // Asegurar que el indicador de rol se muestre si hay sesión activa
    if (currentUserRole) {
        const color = currentUserRole === 'observer' ? 'blue' : 'green';
        const role = currentUserRole === 'observer' ? 'Observador' : 'Administrador';
        showRoleIndicator(role, color);
    }

    // Limpiar estado inicial - IMPORTANT: allReservations must be initialized before updateAdminUI is called
    // allReservations = []; // This line was problematic if it cleared allReservations too early
    console.log('🔄 Estado inicial limpiado (handled by updateAdminUI and specific clear functions)');
}

// ========== BÚSQUEDA Y EXPORTAR ==========
function setupAdminSearchAndExport() {
    const exportExcelBtn = document.getElementById('export-excel-btn');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', exportToExcel);
    }
}

// ========== EVENTOS DE ACCIONES SOBRE RESERVAS ==========
function setupAdminActionEvents() {
    document.addEventListener('click', (e) => {
        const button = e.target.closest('.action-button');
        if (!button) return;

        if (button.classList.contains('edit-res-btn')) {
            // Refuerzo: solo abrir modal si firestoreId es válido (20 caracteres)
            const firestoreId = button.dataset.firestoreId;
            if (firestoreId && firestoreId.length === 20) {
                openEditModal(firestoreId);
            } // else {
            // console.warn('[ADMIN] Intento de abrir modal con id inválido:', firestoreId || button.dataset.id);
            // }
        } else if (button.classList.contains('delete-res-btn')) {
            const reservationId = button.dataset.firestoreId || button.dataset.id; // Prefer firestoreId
            if (reservationId) {
                // Buscar los datos de la reserva para mostrar en el modal
                const reservationRow = button.closest('tr');
                let reservationData = {
                    id: reservationId // Siempre incluir el ID
                };

                if (reservationRow) {
                    // Intentar obtener datos de la fila de la tabla
                    const nameCell = reservationRow.querySelector('td:nth-child(1)');
                    const dateCell = reservationRow.querySelector('td:nth-child(3)');
                    const timeCell = reservationRow.querySelector('td:nth-child(4)');
                    const dinersCell = reservationRow.querySelector('td:nth-child(5)');

                    if (nameCell) reservationData.name = nameCell.textContent?.trim();
                    if (dateCell) reservationData.date = dateCell.textContent?.trim();
                    if (timeCell) reservationData.time = timeCell.textContent?.trim();
                    if (dinersCell) reservationData.diners = dinersCell.textContent?.trim();
                }

                showAdminDeleteModalVisual(reservationData, async (reservation) => {
                    try {
                        await deleteReservation(reservation.id, reservation);
                    } catch (error) {
                        alert('Error al eliminar la reserva.');
                    }
                });
            }
        } else if (button.classList.contains('refresh-payment-btn')) {
            const reservationId = button.dataset.id;
            const mpPaymentId = button.dataset.mpId;
            if (reservationId && mpPaymentId) {
                refreshPaymentStatus(reservationId, mpPaymentId);
            }
        }
        // Botón de forzar aprobación eliminado para evitar errores y dejar el código limpio
    });
}

// ========== OBTENER Y FILTRAR RESERVAS ==========
async function fetchAdminReservations(dateString, periodType = 'daily') {
    showReservationsLoader();
    if (!db) return;

    currentPeriodType = periodType; // Update global state
    currentDateString = dateString; // Update global state

    try {
        let queryConstraints = [];
        let periodInfo = '';
        let titleDate = '';

        if (periodType === 'daily' && dateString) {
            queryConstraints.push(where('date', '==', dateString));
            const [year, month, day] = dateString.split('-');
            titleDate = new Date(year, month - 1, day).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            periodInfo = `Día: ${titleDate}`;
        } else if (periodType === 'weekly' && dateString) {
            const baseDate = new Date(dateString + 'T00:00:00');
            const startOfWeek = new Date(baseDate);
            startOfWeek.setDate(baseDate.getDate() - baseDate.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            const startDate = startOfWeek.toISOString().split('T')[0];
            const endDate = endOfWeek.toISOString().split('T')[0];
            queryConstraints.push(where('date', '>=', startDate));
            queryConstraints.push(where('date', '<=', endDate));
            titleDate = `Semana del ${startDate} al ${endDate}`;
            periodInfo = `Semana: ${startDate} a ${endDate}`;
        } else if (periodType === 'monthly' && dateString) {
            const [year, month] = dateString.split('-');
            const startDate = `${year}-${month}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;
            queryConstraints.push(where('date', '>=', startDate));
            queryConstraints.push(where('date', '<=', endDate));
            const monthName = new Date(year, month - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            titleDate = monthName;
            periodInfo = `Mes: ${monthName}`;
        } else if (periodType === 'yearly' && dateString) {
            const year = dateString.substring(0, 4);
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            queryConstraints.push(where('date', '>=', startDate));
            queryConstraints.push(where('date', '<=', endDate));
            titleDate = `Año ${year}`;
            periodInfo = `Año: ${year}`;
        } else if (periodType === 'custom') {
            const dateRangeStart = getEl('dateRangeStart');
            const dateRangeEnd = getEl('dateRangeEnd');
            if (dateRangeStart && dateRangeEnd && dateRangeStart.value && dateRangeEnd.value) {
                queryConstraints.push(where('date', '>=', dateRangeStart.value));
                queryConstraints.push(where('date', '<=', dateRangeEnd.value));
                const startFormatted = new Date(dateRangeStart.value + 'T00:00:00').toLocaleDateString('es-AR');
                const endFormatted = new Date(dateRangeEnd.value + 'T00:00:00').toLocaleDateString('es-AR');
                titleDate = `${startFormatted} a ${endFormatted}`;
                periodInfo = `Período: ${startFormatted} a ${endFormatted}`;
            } else {
                return;
            }
        } else {
            return;
        }

        const q = query(collection(db, 'reservations'), ...queryConstraints);

        // Clear previous listener if it exists before setting a new one
        if (window._adminReservationsUnsub) {
            window._adminReservationsUnsub();
            window._adminReservationsUnsub = null;
        }

        window._adminReservationsUnsub = onSnapshot(q, (snapshot) => {
            const fetchedReservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const filteredReservations = fetchedReservations.filter(res => res.name && res.date && res.time);
            filteredReservations.sort((a, b) => {
                const dateA = new Date(`${a.date}T${a.time}`);
                const dateB = new Date(`${b.date}T${b.time}`);
                return dateA - dateB;
            });

            // Update global allReservations here when data is fetched from Firestore
            allReservations = [...filteredReservations];
            reservasPorFecha[currentDateString] = [...filteredReservations]; // Store for filters

            // Apply the current filter to the newly fetched data
            if (currentFilter && currentFilter !== 'all') {
                applyFilter(currentFilter); // This will call updateAdminUI and update totals
            } else {
                updateAdminUI(allReservations, titleDate, periodInfo); // Show all if no specific filter
            }

            // Setup timers for this new set of reservations
            setupReservationTimers(allReservations); // Pass the main list
            checkAttendanceByTime(); // Run attendance check immediately after update
        }, (error) => {
            updateAdminUI([], 'Error', 'Error al cargar datos');
            console.error('Error in onSnapshot for admin reservations:', error);
        });
        return;
    } catch (error) {
        updateAdminUI([], 'Error', 'Error al cargar datos');
        console.error('Error fetching admin reservations:', error);
    }
}


// ========== RENDERIZADO DE LA UI DEL PANEL DE ADMINISTRACIÓN ==========
function updateAdminUI(reservationsToDisplay, titleDate = '', periodInfo = '') {
    clearReservationsUI(); // Clear existing UI content

    let dinersDay = 0, dinersLunch = 0, dinersDinner = 0;
    const isMobile = window.innerWidth < 768;
    const body = getEl('reservationsTableBody');
    const mobileDiv = getEl('reservasCardsMobile');

    if (!body || !mobileDiv) {
        console.error('Elemento reservationsTableBody o reservasCardsMobile no encontrado');
        return;
    }

    // Filter duplicates by firestoreId or id real from the list to display
    const uniqueReservationsMap = new Map();
    reservationsToDisplay.forEach(res => {
        const uniqueId = res.firestoreId || res.id;
        if (!uniqueReservationsMap.has(uniqueId)) {
            uniqueReservationsMap.set(uniqueId, res);
        }
    });
    const uniqueReservations = Array.from(uniqueReservationsMap.values());

    if (isMobile) {
        // Renderizar tarjetas en el div móvil (diseño responsive mejorado)
        uniqueReservations.forEach(res => {
            const d = parseInt(res.diners) || 0;
            const turn = res.turn || calcularTurnoPorHora(res.time);
            const paymentStatus = res.paymentStatus || 'no especificado';
            // These totals should reflect ALL reservations, not just filtered ones for display
            // Total calculations are now handled by updateTotalsWithFiltered based on the filtered set
            // For general totals (dinersDay, dinersLunch, dinersDinner), you might want to sum from allReservations
            // For this UI update, it's about the currently displayed ones.
            // Consider if these specific `dinersDay` vars should be used for the overall dashboard totals,
            // or just for the currently rendered card/row summary.
            // For now, I'll remove direct accumulation here as updateTotalsWithFiltered handles it.

            let paymentStatusClass = '';
            let paymentStatusText = '';
            let createdByText = '';
            let createdByClass = '';

            // Determinar texto y clase del estado de pago
            if (paymentStatus === 'approved' || paymentStatus === 'confirmed') {
                paymentStatusClass = 'bg-green-100 text-green-800';
                paymentStatusText = 'Pagada';
            } else if (paymentStatus === 'pagado-manual') {
                paymentStatusClass = 'bg-blue-100 text-blue-800';
                paymentStatusText = 'Pagado Manual';
            } else if (paymentStatus === 'manual') {
                paymentStatusClass = 'bg-orange-100 text-orange-800';
                paymentStatusText = 'Manual';
            } else if (paymentStatus === 'pending') {
                paymentStatusClass = 'bg-yellow-100 text-yellow-800';
                paymentStatusText = 'Pendiente';
            } else if (paymentStatus === 'rejected') {
                paymentStatusClass = 'bg-red-100 text-red-800';
                paymentStatusText = 'Rechazada';
            } else {
                paymentStatusClass = 'bg-gray-100 text-gray-700';
                paymentStatusText = 'Desconocido';
            }

            // Determinar texto y clase del creador
            if (res.createdBy === 'admin') {
                createdByText = 'Admin';
                createdByClass = 'bg-purple-100 text-purple-800';
            } else if (res.createdBy === 'observador') {
                createdByText = 'Observador';
                createdByClass = 'bg-indigo-100 text-indigo-800';
            } else if (res.createdBy === 'cliente') {
                createdByText = 'Cliente';
                createdByClass = 'bg-green-100 text-green-800';
            } else {
                createdByText = 'Sistema';
                createdByClass = 'bg-gray-100 text-gray-700';
            }
            // Determinar el estado de asistencia y color de la tarjeta
            const attendanceStatus = res.attendanceStatus;
            const attendanceColor = getAttendanceStatusColor(attendanceStatus);
            const attendanceText = attendanceStatus ? getAttendanceStatusText(attendanceStatus) : '';

            // Aplicar color de fondo solo si hay estado de asistencia marcado
            let cardBorderClass = attendanceStatus ? ATTENDANCE_COLORS[attendanceStatus] : 'border-gray-200';

            const card = document.createElement('div');
            card.className = `mb-4 bg-white rounded-xl shadow-lg border-2 ${cardBorderClass} overflow-hidden`;
            card.innerHTML = `
                <div class="bg-gray-50 px-4 py-3 border-b">
                    <div class="flex justify-between items-center">
                        <h3 class="font-bold text-lg text-gray-900">${res.name || 'Sin nombre'}</h3>
                        <div class="flex flex-col items-end gap-1">
                            <span class="px-2 py-1 text-xs font-semibold rounded-full ${paymentStatusClass}">${paymentStatusText}</span>
                            <span class="px-2 py-1 text-xs font-semibold rounded-full ${createdByClass}">${createdByText}</span>
                            ${attendanceStatus ? `<div class="text-xs text-gray-500" title="${attendanceText}">Estado: ${attendanceText}</div>` : ''}
                        </div>
                    </div>
                </div>
                <div class="p-4 space-y-2">
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div><span class="font-medium text-gray-600">Teléfono:</span> ${res.phone || 'Sin teléfono'}</div>
                        <div><span class="font-medium text-gray-600">Fecha:</span> ${res.dateFormatted || res.date || 'Sin fecha'}</div>
                        <div><span class="font-medium text-gray-600">Hora:</span> ${res.time || '00:00'} hs</div>
                        <div><span class="font-medium text-gray-600">Comensales:</span> ${d}</div>
                        <div><span class="font-medium text-gray-600">Turno:</span> ${turn}</div>
                        ${res.area ? `<div><span class="font-medium text-gray-600">Área:</span> ${res.area}</div>` : ''}
                    </div>
                    ${res.notes ? `<div class="mt-2 p-2 bg-gray-50 rounded text-sm"><span class="font-medium text-gray-600">Notas:</span> ${res.notes}</div>` : ''}
                    ${res.depositAmount && res.paymentMethod ? `<div class="mt-2 p-2 bg-blue-50 rounded text-sm">
                        <span class="font-medium text-blue-600">Seña:</span> $${res.depositAmount.toLocaleString('es-AR')} - ${res.paymentMethod.charAt(0).toUpperCase() + res.paymentMethod.slice(1)}
                    </div>` : ''}
                </div>
                <div class="px-4 py-3 bg-gray-50 border-t">
                    <div class="flex flex-wrap gap-2 justify-center">
                        <button onclick="generarComprobantePDF({nombre: '${res.name || 'Cliente'}', fecha: '${res.date || new Date().toISOString().split('T')[0]}', monto: ${res.depositAmount || res.amount || calcularMontoSenia(res.diners) || 10000}, reservaId: '${res.id}', estado: '${paymentStatusText}', paymentId: '${res.paymentId || ''}', mpPaymentId: '${res.mpPaymentId || ''}', area: '${res.area || ''}', notes: '${res.notes || ''}', time: '${res.time || ''}', diners: '${res.diners || ''}', phone: '${res.phone || ''}', turn: '${res.turn || calcularTurnoPorHora(res.time)}', depositAmount: ${res.depositAmount || calcularMontoSenia(res.diners) || 10000}})" class="action-button p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors" title="Descargar PDF">
                            <i class='ph ph-download-simple text-lg'></i>
                        </button>
                        ${res.firestoreId && res.firestoreId.length === 20 ? `<button data-firestore-id="${res.firestoreId}" class="action-button edit-res-btn admin-only p-2 text-blue-500 hover:text-blue-700 rounded-full hover:bg-blue-100 transition-colors" title="Editar">
                            <i class="ph ph-pencil-simple text-lg"></i>
                        </button>` : ''}
                        ${res.firestoreId && res.firestoreId.length === 20 ? `<button data-firestore-id="${res.firestoreId}" class="action-button delete-res-btn admin-only p-2 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 transition-colors" title="Eliminar">
                            <i class="ph ph-trash text-lg"></i>
                        </button>` : ''}
                        ${res.mpPaymentId ? `<button data-id="${res.id}" data-mp-id="${res.mpPaymentId}" class="action-button refresh-payment-btn p-2 text-blue-500 hover:text-blue-700 rounded-full hover:bg-blue-100 transition-colors" title="Actualizar estado de pago">
                            <i class="ph ph-arrow-clockwise text-lg"></i>
                        </button>` : ''}
                        </div>
                    <div class="mt-3 pt-3 border-t border-gray-200">
                        <div class="text-xs text-gray-600 mb-2 text-center">Control de Asistencia</div>
                        <div class="flex flex-wrap gap-2 justify-center">
                            ${generateAttendanceButtons(res)}
                        </div>
                    </div>
                </div>
            `;
            mobileDiv.appendChild(card);
        });
    } else {
        // Vista de escritorio (tabla)
        uniqueReservations.forEach(res => {
            const d = parseInt(res.diners) || 0;
            const turn = res.turn || calcularTurnoPorHora(res.time);
            const paymentStatus = res.paymentStatus || 'no especificado';
            // Total calculations are now handled by updateTotalsWithFiltered based on the filtered set

            let paymentStatusClass = '';
            let paymentStatusText = '';
            let createdByText = '';
            let createdByClass = '';

            // Determinar texto y clase del estado de pago
            if (paymentStatus === 'approved' || paymentStatus === 'confirmed') {
                paymentStatusClass = 'bg-green-100 text-green-800';
                paymentStatusText = 'Pagada';
            } else if (paymentStatus === 'pagado-manual') {
                paymentStatusClass = 'bg-blue-100 text-blue-800';
                paymentStatusText = 'Pagado Manual';
            } else if (paymentStatus === 'manual') {
                paymentStatusClass = 'bg-orange-100 text-orange-800';
                paymentStatusText = 'Manual';
            } else if (paymentStatus === 'pending') {
                paymentStatusClass = 'bg-yellow-100 text-yellow-800';
                paymentStatusText = 'Pendiente';
            } else if (paymentStatus === 'rejected') {
                paymentStatusClass = 'bg-red-100 text-red-800';
                paymentStatusText = 'Rechazada';
            } else {
                paymentStatusClass = 'bg-gray-100 text-gray-700';
                paymentStatusText = 'Desconocido';
            }

            // Determinar texto y clase del creador
            if (res.createdBy === 'admin') {
                createdByText = 'Admin';
                createdByClass = 'bg-purple-100 text-purple-800';
            } else if (res.createdBy === 'observador') {
                createdByText = 'Observador';
                createdByClass = 'bg-indigo-100 text-indigo-800';
            } else if (res.createdBy === 'cliente') {
                createdByText = 'Cliente';
                createdByClass = 'bg-green-100 text-green-800';
            } else {
                createdByText = 'Sistema';
                createdByClass = 'bg-gray-100 text-gray-700';
            }

            const row = body.insertRow();
            row.className = 'border-b hover:bg-gray-50 transition-colors';
            row.innerHTML = `
                <td data-label="Nombre" class="px-4 py-3 font-medium">${res.name || 'Sin nombre'}</td>
                <td data-label="Teléfono" class="px-4 py-3">${res.phone || 'Sin teléfono'}</td>
                <td data-label="Fecha" class="px-4 py-3">${res.date || 'Sin fecha'}</td>
                <td data-label="Hora" class="px-4 py-3">${res.time || '00:00'} hs</td>
                <td data-label="Comensales" class="px-4 py-3 font-bold text-lg md:text-base md:text-center">${d}</td>
                <td data-label="Turno" class="px-4 py-3">
                    <div class="flex flex-col items-start gap-1">
                        <span class="px-2 py-1 font-semibold leading-tight text-xs rounded-full ${turn.toLowerCase() === 'almuerzo' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}">${turn}</span>
                        <span class="px-2 py-1 font-semibold leading-tight text-xs rounded-full ${paymentStatusClass}">${paymentStatusText}</span>
                        <span class="px-2 py-1 font-semibold leading-tight text-xs rounded-full ${createdByClass}">${createdByText}</span>
                        ${res.depositAmount && res.paymentMethod ? `<span class="px-2 py-1 font-semibold leading-tight text-xs rounded-full bg-blue-100 text-blue-800">$${res.depositAmount.toLocaleString('es-AR')} - ${res.paymentMethod.charAt(0).toUpperCase() + res.paymentMethod.slice(1)}</span>` : ''}
                        ${res.attendanceStatus ? `<div class="text-xs text-gray-500" title="${getAttendanceStatusText(res.attendanceStatus)}">Estado: ${getAttendanceStatusText(res.attendanceStatus)}</div>` : ''}
                    </div>
                </td>
                <td data-label="Área" class="px-4 py-3">${res.area || 'No especificada'}</td>
                <td data-label="Notas" class="px-4 py-3">${res.notes || ''}</td>
                <td class="actions-cell px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-1 flex-wrap">
                        <button onclick="generarComprobantePDF({nombre: '${res.name || 'Cliente'}', fecha: '${res.date || new Date().toISOString().split('T')[0]}', monto: ${res.depositAmount || res.amount || calcularMontoSenia(res.diners) || 10000}, reservaId: '${res.id}', estado: '${paymentStatusText}', paymentId: '${res.paymentId || ''}', mpPaymentId: '${res.mpPaymentId || ''}', area: '${res.area || ''}', notes: '${res.notes || ''}', time: '${res.time || ''}', diners: '${res.diners || ''}', phone: '${res.phone || ''}', turn: '${res.turn || calcularTurnoPorHora(res.time)}', depositAmount: ${res.depositAmount || calcularMontoSenia(res.diners) || 10000}})" class="action-button p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors" title="Descargar PDF">
                            <i class='ph ph-download-simple text-lg'></i>
                        </button>
                        ${res.firestoreId && res.firestoreId.length === 20 ? `<button data-firestore-id="${res.firestoreId}" class="action-button edit-res-btn admin-only p-2 text-blue-500 hover:text-blue-700 rounded-full hover:bg-blue-100 transition-colors" title="Editar">
                            <i class="ph ph-pencil-simple text-lg"></i>
                        </button>` : ''}
                        ${res.firestoreId && res.firestoreId.length === 20 ? `<button data-firestore-id="${res.firestoreId}" class="action-button delete-res-btn admin-only p-2 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 transition-colors" title="Eliminar">
                            <i class="ph ph-trash text-lg"></i>
                        </button>` : ''}
                        ${res.mpPaymentId ? `<button data-id="${res.id}" data-mp-id="${res.mpPaymentId}" class="action-button refresh-payment-btn p-2 text-blue-500 hover:text-blue-700 rounded-full hover:bg-blue-100 transition-colors" title="Actualizar estado de pago">
                            <i class="ph ph-arrow-clockwise text-lg"></i>
                        </button>` : ''}
                        </div>
                    <div class="mt-2 pt-2 border-t border-gray-200">
                        <div class="text-xs text-gray-600 mb-1 text-center">Asistencia</div>
                        <div class="flex items-center justify-center gap-1 flex-wrap">
                            ${generateAttendanceButtons(res)}
                        </div>
                    </div>
                </td>
            `;
            body.appendChild(row);
        });
    }

    // Update totals using the *all* reservations, not just the currently filtered/displayed ones
    updateTotalsWithFiltered(allReservations); // Use allReservations for overall totals

    // Update quick indicators
    const totalReservas = reservationsToDisplay.length; // This counts the *displayed* reservations
    const totalConfirmadas = reservationsToDisplay.filter(r => r.paymentStatus === 'approved' || r.paymentStatus === 'confirmed' || r.paymentStatus === 'pagado-manual').length;
    const totalPendientes = reservationsToDisplay.filter(r => r.paymentStatus === 'pending').length;
    const totalManuales = reservationsToDisplay.filter(r => r.paymentStatus === 'manual').length;
    // totalComensales is already handled by updateTotalsWithFiltered from allReservations

    getEl('totalReservas').textContent = totalReservas;
    getEl('totalConfirmadas').textContent = totalConfirmadas;
    getEl('totalPendientes').textContent = totalPendientes;
    getEl('totalManuales').textContent = totalManuales;
    getEl('totalComensales').textContent = getEl('totalDinersPeriod')?.querySelector('p')?.textContent || '0'; // Get from updated totals

    // Guardar para exportar
    // window._adminReservationsFiltered = reservationsToDisplay; // No longer needed as we use getFilteredReservationsForExport
}

// ========== EXPORTAR A EXCEL ==========
function exportToExcel(dataToExport = null) {
    // Asegurar que siempre sea un array
    let reservationsToExport = dataToExport;
    if (!Array.isArray(reservationsToExport)) {
        reservationsToExport = getFilteredReservationsForExport();
    }
    if (!Array.isArray(reservationsToExport) || reservationsToExport.length === 0) {
        alert('No hay reservas para exportar');
        return;
    }
    const data = reservationsToExport.map(res => ({
        'Nombre': res.name || 'Sin nombre',
        'Teléfono': res.phone || 'Sin teléfono',
        'Fecha': res.date || 'Sin fecha',
        'Hora': res.time || '00:00',
        'Comensales': res.diners || 0,
        'Turno': res.turn || 'no especificado',
        'Estado de Pago': traducirEstadoPago(res.paymentStatus),
        'Creado por': res.createdBy || 'Sistema',
        'Monto de Seña': res.depositAmount || 0,
        'Método de Pago': res.paymentMethod || 'No especificado',
        'Área': res.area || 'No especificada',
        'Notas': res.notes || 'Sin notas'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reservas");
    // Crear nombre de archivo con filtro
    let filterSuffix = '';
    switch (currentFilter) {
        case 'almuerzo':
            filterSuffix = '_almuerzos';
            break;
        case 'cena':
            filterSuffix = '_cenas';
            break;
        default:
            filterSuffix = '_todas';
    }
    const fileName = `reservas_${new Date().toISOString().split('T')[0]}${filterSuffix}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

function traducirEstadoPago(status) {
    switch ((status || '').toLowerCase()) {
        case 'paid':
        case 'pagado':
        case 'pagado-manual':
            return 'Pagado';
        case 'pending':
        case 'pendiente':
            return 'Pendiente';
        case 'manual':
            return 'Manual';
        case 'cancelled':
        case 'cancelada':
            return 'Cancelada';
        case 'rejected':
        case 'rechazada':
            return 'Rechazada';
        default:
            return status || 'No especificado';
    }
}

// ========== ACCIONES SOBRE RESERVAS ==========
async function deleteReservation(reservationId, reservationData = {}) {
    try {

        // Verificar que reservationId no sea null
        if (!reservationId) {
            console.error('Error: reservationId es null o undefined');
            alert('Error: No se pudo identificar la reserva a eliminar');
            return;
        }

        // Verificar que la reserva existe antes de eliminar
        const docRef = doc(db, "reservations", reservationId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            // Verificar si está en la lista de cancelaciones
            const cancellationsQuery = query(collection(db, "cancellations"), where("reservationId", "==", reservationId));
            const cancellationsSnap = await getDocs(cancellationsQuery);

            if (!cancellationsSnap.empty) {
                showSuccessModal('Esta reserva ya fue cancelada anteriormente. Actualizando la vista...');
            } else {
                showSuccessModal('Esta reserva no existe en la base de datos. Actualizando la vista...');
            }

            // Actualizar la interfaz para reflejar el estado real
            const dateFilter = getEl('dateFilter');
            const periodSelector = getEl('periodSelector');
            if (dateFilter && dateFilter.value) {
                fetchAdminReservations(dateFilter.value, periodSelector ? periodSelector.value : 'daily');
            }
            return;
        }

        const reservationDoc = docSnap.data();

        // Guardar registro de cancelación en Firestore antes de eliminar
        const cancellationData = {
            reservationId: reservationId,
            name: reservationData.name || reservationDoc.name || '',
            phone: reservationData.phone || reservationDoc.phone || '',
            date: reservationData.date || reservationDoc.date || '',
            time: reservationData.time || reservationDoc.time || '',
            diners: reservationData.diners || reservationDoc.diners || '',
            area: reservationData.area || reservationDoc.area || '',
            notes: reservationData.notes || reservationDoc.notes || '',
            cancelledAt: new Date().toISOString(),
            cancelledBy: 'admin',
            motivo: reservationData.motivo || '',
            // Guardar todos los campos extra de la reserva original
            ...reservationDoc
        };

        await setDoc(doc(db, "cancellations", reservationId + '_' + Date.now()), cancellationData);

        const docId = reservationData.firestoreId || reservationId;
        await deleteDoc(doc(db, 'reservations', docId));

        // Enviar notificación de cancelación
        const notificationData = {
            ...reservationData,
            createdBy: reservationData.createdBy || reservationDoc.createdBy || 'admin'
        };
        await sendCancellationNotification(notificationData);

        // Mostrar modal de éxito
        showSuccessModal('Reserva eliminada correctamente');

        // Actualizar la interfaz inmediatamente
        const dateFilter = getEl('dateFilter');
        const periodSelector = getEl('periodSelector');
        if (dateFilter && dateFilter.value) {
            fetchAdminReservations(dateFilter.value, periodSelector ? periodSelector.value : 'daily');
        }

    } catch (error) {
        console.error('Error al eliminar reserva:', error);
        alert('Error al eliminar la reserva: ' + error.message);
    }
}

// MODAL VISUAL DE ELIMINACIÓN (ADMIN, UNIFICADO) con campo de motivo
function showAdminDeleteModalVisual(reservation, onConfirm, onCancel) {
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
    titleEl.textContent = '¿Eliminar Reserva?';
    modal.appendChild(titleEl);
    // Mensaje
    const msgEl = document.createElement('p');
    msgEl.className = 'mb-4 text-gray-700';
    msgEl.textContent = '¿Estás seguro de que quieres eliminar esta reserva? Esta acción no se puede deshacer.';
    modal.appendChild(msgEl);
    // Campo de motivo
    const motivoLabel = document.createElement('label');
    motivoLabel.className = 'block text-sm font-medium text-gray-700 mb-1 text-left';
    motivoLabel.textContent = 'Motivo de la cancelación (opcional):';
    modal.appendChild(motivoLabel);
    const motivoInput = document.createElement('textarea');
    motivoInput.className = 'w-full p-2 border border-gray-300 rounded mb-4';
    motivoInput.placeholder = 'Ej: Cliente avisó, error en la reserva, etc.';
    modal.appendChild(motivoInput);
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
    confirmBtn.onclick = () => {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        // Pasar el motivo al callback
        if (typeof onConfirm === 'function') {
            if (reservation) {
                reservation.motivo = motivoInput.value;
                onConfirm(reservation);
            } else {
                // Si reservation es null, crear un objeto básico con el motivo
                const reservationWithMotivo = {
                    id: null,
                    motivo: motivoInput.value
                };
                onConfirm(reservationWithMotivo);
            }
        }
    };
    cancelBtn.onclick = () => {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        if (onCancel) onCancel();
    };
}

async function refreshPaymentStatus(reservationId, mpPaymentId) {
    try {
        const response = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
            headers: {
                // 'Authorization': `Bearer ${import.meta.env.VITE_MERCADOPAGO_ACCESS_TOKEN}`
            }
        });
        const paymentData = await response.json();

        if (paymentData.status) {
            await updateDoc(doc(db, "reservations", reservationId), {
                paymentStatus: paymentData.status,
                status: paymentData.status,
                lastPaymentCheck: new Date().toISOString()
            });
            alert('Estado de pago actualizado exitosamente');
            const dateFilter = getEl('dateFilter');
            const periodSelector = getEl('periodSelector');
            if (dateFilter && dateFilter.value) {
                fetchAdminReservations(dateFilter.value, periodSelector ? periodSelector.value : 'daily');
            }
        } else {
            alert('No se pudo obtener el estado del pago');
        }
    } catch (error) {
        console.error('Error al actualizar estado de pago:', error);
        alert('Error al actualizar el estado de pago');
    }
}

async function forcePaymentStatusUpdate(reservationId, paymentId = null) {
    try {
        // Verificar que el documento existe antes de actualizarlo
        const docRef = doc(db, "reservations", reservationId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            // Verificar si está en la lista de cancelaciones
            const cancellationsQuery = query(collection(db, "cancellations"), where("reservationId", "==", reservationId));
            const cancellationsSnap = await getDocs(cancellationsQuery);

            if (!cancellationsSnap.empty) {
                alert('Esta reserva ya fue cancelada anteriormente. No se puede actualizar su estado.');
            } else {
                alert('Esta reserva no existe en la base de datos. Actualizando la vista...');
            }

            // Actualizar la interfaz para reflejar el estado real
            const dateFilter = getEl('dateFilter');
            const periodSelector = getEl('periodSelector');
            if (dateFilter && dateFilter.value) {
                fetchAdminReservations(dateFilter.value, periodSelector ? periodSelector.value : 'daily');
            }
            return false;
        }

        // Si el documento existe, actualizarlo
        await updateDoc(docRef, {
            paymentStatus: 'approved',
            status: 'approved',
            lastPaymentCheck: new Date().toISOString()
        });
        return true;
    } catch (error) {
        console.error('Error al forzar actualización de estado:', error);
        return false;
    }
}

// ========== GENERAR COMPROBANTE PDF ==========
function generarComprobantePDF({ nombre, fecha, monto, reservaId, paymentStatus, estado, status, paymentId, mpPaymentId, diners, time, turn, area, notes, depositAmount, phone }) {
    try {
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
            doc.text(`Turno: ${turn || 'No especificado'}`, 20, 100);
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

            // Mejorar la lógica para mostrar el ID de pago
            let paymentIdToShow = '';
            if (paymentId && paymentId !== '' && paymentId !== 'undefined') {
                paymentIdToShow = paymentId;
            } else if (typeof mpPaymentId !== 'undefined' && mpPaymentId && mpPaymentId !== '' && mpPaymentId !== 'undefined') {
                paymentIdToShow = mpPaymentId;
            }

            if (paymentIdToShow) {
                doc.text(`ID de Pago: ${paymentIdToShow}`, 20, 138);
                console.log('📄 [PDF] ID de pago incluido en PDF:', paymentIdToShow);
            } else {
                console.log('⚠️ [PDF] No se encontró ID de pago para incluir en PDF');
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

// ========== BÚSQUEDA AVANZADA ==========
function setupAdminAdvancedSearch() {
    const showSearchButton = getEl('show-search-button');
    const searchModal = getEl('search-modal');
    if (showSearchButton && searchModal) {
        showSearchButton.onclick = () => {
            searchModal.innerHTML = `
                <div class="relative top-10 md:top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
                    <div class="mt-3">
                        <h3 class="text-lg text-center leading-6 font-medium text-gray-900">Buscar Reserva</h3>
                        <form id="search-form" class="mt-4 px-7 py-3 space-y-3">
                            <label for="search-phone" class="block text-sm font-medium text-gray-700">Búsqueda avanzada</label>
                            <div class="flex gap-2">
                                <input type="text" id="search-phone" placeholder="Nombre, teléfono, fecha, área, notas, ID..." required class="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500">
                                <button type="submit" class="bg-green-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-800">Buscar</button>
                            </div>
                            <p class="text-xs text-gray-500">Puedes buscar por: nombre, teléfono, fecha (YYYY-MM-DD), área, notas, ID de reserva</p>
                        </form>
                        <div id="search-results-container" class="mt-4 px-1 md:px-7 space-y-3 max-h-60 overflow-y-auto"></div>
                        <div id="search-message" class="text-center p-4"></div>
                        <div class="items-center px-4 py-3 mt-4 border-t">
                            <button id="close-search-modal-button" class="px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-300">Cerrar</button>
                        </div>
                    </div>
                </div>
            `;
            searchModal.classList.remove('hidden');
            const closeBtn = getEl('close-search-modal-button');
            if (closeBtn) closeBtn.onclick = () => searchModal.classList.add('hidden');
            const searchForm = getEl('search-form');
            if (searchForm) {
                searchForm.onsubmit = async (e) => {
                    e.preventDefault();
                    const searchTerm = getEl('search-phone').value.trim().toLowerCase();
                    const resultsContainer = getEl('search-results-container');
                    const messageEl = getEl('search-message');
                    resultsContainer.innerHTML = '';
                    messageEl.textContent = 'Buscando...';
                    if (!searchTerm) {
                        messageEl.textContent = 'Por favor, ingresa un nombre o número de teléfono.';
                        return;
                    }

                    try {
                        // Usar la función mejorada de búsqueda
                        const matchedReservations = await searchClientReservations(searchTerm, true); // true = isAdmin

                        if (matchedReservations.length === 0) {
                            messageEl.textContent = 'No se encontraron reservas con los datos ingresados.';
                            return;
                        }

                        // Ordenar por fecha (más recientes primero) y mostrar resultados
                        const sortedReservations = matchedReservations.sort((a, b) => {
                            const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
                            const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
                            return dateB - dateA; // Más recientes primero
                        });

                        messageEl.textContent = `Se encontraron ${sortedReservations.length} reserva(s):`;

                        sortedReservations.forEach(res => {
                            const dateFormatted = new Date(res.date + 'T00:00:00').toLocaleDateString('es-AR');
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

                            const resultCard = document.createElement('div');
                            resultCard.className = `p-3 border rounded-lg bg-gray-50 flex justify-between items-center`;
                            resultCard.setAttribute('data-id', res.firestoreId || res.id);
                            resultCard.innerHTML = `
                                <div>
                                    <p class="font-bold">${res.name || 'Sin nombre'}</p>
                                    <p class="text-sm text-gray-600">${dateFormatted} - ${res.time || '00:00'} hs - ${res.diners || 0} personas</p>
                                    <p class="text-xs mt-1">
                                        <span class="px-2 py-1 font-semibold leading-tight rounded-full ${paymentStatusClass}">${paymentStatusText}</span>
                                        ${res.area ? `<span class="ml-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">${res.area}</span>` : ''}
                                    </p>
                                </div>
                                <div class="flex gap-2">
                                    ${res.firestoreId && res.firestoreId.length === 20 ? `<button data-firestore-id="${res.firestoreId}" class="action-button edit-res-btn admin-only p-2 text-blue-500 hover:text-blue-700 rounded-full hover:bg-blue-100 transition-colors" title="Editar">
                                        <i class="ph ph-pencil-simple text-lg"></i>
                                    </button>` : ''}
                                    ${res.firestoreId && res.firestoreId.length === 20 ? `<button data-firestore-id="${res.firestoreId}" class="action-button delete-res-btn admin-only p-2 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 transition-colors" title="Eliminar">
                                        <i class="ph ph-trash text-lg"></i>
                                    </button>` : ''}
                                </div>
                            `;
                            resultsContainer.appendChild(resultCard);
                        });

                    } catch (error) {
                        console.error('Error en búsqueda:', error);
                        messageEl.textContent = 'Error al buscar reservas. Intenta de nuevo.';
                    }
                };
            }
            // Listener para acciones en resultados
            searchModal.addEventListener('click', async (e) => {
                const button = e.target.closest('.action-button');
                if (!button) return;
                const id = button.dataset.firestoreId || button.dataset.id; // Prefer firestoreId

                if (button.classList.contains('edit-res-btn')) {
                    // Solo abrir modal si el id es de 20 caracteres (firestoreId válido)
                    if (id && id.length === 20) {
                        await openEditModal(id);
                        // Actualizar resultados de búsqueda después de editar
                        setTimeout(() => {
                            const searchForm = getEl('search-form');
                            if (searchForm) {
                                searchForm.requestSubmit();
                            }
                        }, 1500); // Esperar a que se cierre el modal de edición
                    }
                    // Si no, no hacer nada
                } else if (button.classList.contains('delete-res-btn')) {
                    // Usar siempre firestoreId si existe
                    const firestoreId = button.dataset.firestoreId;
                    const reservationId = firestoreId && firestoreId.length === 20 ? firestoreId : button.dataset.id;
                    if (reservationId) {
                        // Buscar los datos de la reserva para mostrar en el modal de confirmación
                        const reservationCard = button.closest('[data-id]');
                        let reservationData = { id: reservationId };
                        if (reservationCard) {
                            // Attempt to get data from the card for display in modal
                            reservationData.name = reservationCard.querySelector('.font-bold')?.textContent.trim();
                            const detailsText = reservationCard.querySelector('.text-sm.text-gray-600')?.textContent.trim();
                            if (detailsText) {
                                const parts = detailsText.split(' - ');
                                reservationData.date = parts[0];
                                reservationData.time = parts[1]?.replace(' hs', '');
                                reservationData.diners = parts[2]?.replace(' personas', '');
                            }
                        }
                        showAdminDeleteModalVisual(reservationData, async (reservation) => {
                            try {
                                await deleteReservation(reservation.id, reservation);
                                // Actualizar resultados de búsqueda después de eliminar
                                setTimeout(() => {
                                    const searchForm = getEl('search-form');
                                    if (searchForm) {
                                        searchForm.requestSubmit();
                                    }
                                }, 1000); // Esperar a que se cierre el modal de eliminación
                            } catch (error) {
                                alert('Error al eliminar la reserva.');
                            }
                        });
                    }
                }
            });
        };
    }
}

/**
 * Busca reservas por nombre, teléfono, fecha, área, notas, ID, etc.
 * El admin puede ver todas las reservas (pasadas, actuales y futuras).
 */
async function searchClientReservations(searchTerm, isAdmin = true) {
    try {
        // Obtener todas las reservas
        const reservationsRef = collection(db, "reservations");
        const snapshot = await getDocs(reservationsRef);
        const allFetchedReservations = snapshot.docs.map(doc => ({ id: doc.id, firestoreId: doc.id, ...doc.data() })); // Ensure firestoreId is always present
        const search = searchTerm.trim().toLowerCase();

        const matchedReservations = allFetchedReservations.filter(res => {
            // Búsqueda por múltiples campos
            const nameMatch = res.name && res.name.toLowerCase().includes(search);
            const phoneMatch = res.phone && res.phone.includes(search);
            const dateMatch = res.date && res.date.includes(search);
            const areaMatch = res.area && res.area.toLowerCase().includes(search);
            const notesMatch = res.notes && res.notes.toLowerCase().includes(search);
            const idMatch = res.id && res.id.toLowerCase().includes(search);
            const firestoreIdMatch = res.firestoreId && res.firestoreId.toLowerCase().includes(search);
            return nameMatch || phoneMatch || dateMatch || areaMatch || notesMatch || idMatch || firestoreIdMatch;
        });

        // Verify in real-time that each reservation still exists in Firestore (redundant if using live listener, but safe for one-off search)
        const validReservations = [];
        for (const res of matchedReservations) {
            try {
                const docId = res.firestoreId || res.id;
                if (docId) {
                    const docSnap = await getDoc(doc(db, 'reservations', docId));
                    if (docSnap.exists()) {
                        validReservations.push(res);
                    }
                }
            } catch (error) {
                console.warn(`Error verifying reservation ${res.id} during search:`, error);
                // If there's an error getting the doc, we might still include it or exclude it based on policy.
                // For robustness, if getDoc fails, assume it's valid for display in the search results
                // but rely on subsequent actions (edit/delete) to re-verify.
                validReservations.push(res);
            }
        }
        return validReservations;
    } catch (error) {
        console.error("❌ [ADMIN_SEARCH] Error buscando reservas:", error);
        return [];
    }
}

// ========== NOTIFICACIONES PUSH PARA ADMIN ==========
let swRegistration = null;

/**
 * Registra el Service Worker para notificaciones push del admin
 */
async function registerAdminServiceWorker() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
            // Solicitar permisos de notificación automáticamente
            if ('Notification' in window) {
                await Notification.requestPermission();
            }
            return swRegistration;
        } catch (error) {
            console.error('❌ [ADMIN_PUSH] Error registrando Service Worker:', error);
        }
    }
    return null;
}

/**
 * Solicita permisos para notificaciones del admin
 */
async function requestAdminNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        console.log('🔔 [ADMIN_PUSH] Permiso de notificación admin:', permission);

        // Actualizar el botón según el estado del permiso
        updateNotificationButton(permission);

        return permission === 'granted';
    }
    return false;
}

/**
 * Actualiza el estado del botón de notificaciones
 */
function updateNotificationButton(permission) {
    const button = getEl('enable-notifications-btn');
    const statusSpan = getEl('notification-status');

    if (!button || !statusSpan) return;

    switch (permission) {
        case 'granted':
            button.className = 'bg-green-600 text-white px-4 py-2 rounded-lg transition flex items-center gap-2';
            statusSpan.innerHTML = '<i class="ph ph-check-circle text-lg"></i> Notificaciones Activas';
            button.disabled = true;
            break;
        case 'denied':
            button.className = 'bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center gap-2';
            statusSpan.innerHTML = '<i class="ph ph-x-circle text-lg"></i> Notificaciones Bloqueadas';
            break;
        case 'default':
            button.className = 'bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2';
            statusSpan.innerHTML = '<i class="ph ph-bell text-lg"></i> Activar Notificaciones';
            break;
    }
}

/**
 * Maneja el clic en el botón de notificaciones
 */
async function handleNotificationButtonClick() {
    const button = getEl('enable-notifications-btn');
    if (!button) return;

    button.disabled = true;
    button.innerHTML = '<i class="ph ph-circle-notch text-lg animate-spin"></i> Solicitando...';

    try {
        const permission = await requestAdminNotificationPermission();

        if (permission) {
            console.log('✅ [ADMIN_PUSH] Permisos de notificación concedidos');
            // Enviar notificación de prueba
            await sendTestNotification();
        } else {
            console.log('❌ [ADMIN_PUSH] Permisos de notificación denegados');
            alert('Para recibir notificaciones de nuevas reservas, por favor permite las notificaciones en tu navegador.');
        }
    } catch (error) {
        console.error('❌ [ADMIN_PUSH] Error solicitando permisos:', error);
        alert('Error al activar las notificaciones. Por favor, intenta de nuevo.');
    } finally {
        // The button is updated in updateNotificationButton
    }
}

/**
 * Envía una notificación de prueba optimizada para móvil (Samsung Galaxy S23)
 */
async function sendTestNotification() {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            const notification = new Notification('🧪 Prueba Móvil', {
                body: '✅ Notificaciones funcionando en tu Samsung Galaxy S23\n📱 Recibirás alertas de reservas, pagos y recordatorios',
                icon: '/Logo/Logo-Los-Nogales.png',
                badge: '/Logo/favicon-32x32.png',
                tag: 'admin-test-mobile',
                requireInteraction: true,
                vibrate: [200, 100, 200, 100, 200],
                silent: false, // Sonido activado para móvil
                data: {
                    type: 'admin_test_mobile',
                    timestamp: Date.now().toString(),
                    source: 'admin_mobile',
                    priority: 'high'
                }
            });

            notification.onclick = function() {
                window.focus();
                notification.close();
                console.log('📱 [ADMIN_MOBILE] Notificación de prueba clickeada en móvil');
            };

            console.log('✅ [ADMIN_MOBILE] Notificación de prueba móvil enviada');
            return notification;
        } catch (error) {
            console.error('❌ [ADMIN_MOBILE] Error enviando notificación de prueba:', error);
        }
    } else {
        console.warn('⚠️ [ADMIN_MOBILE] Permisos de notificación no concedidos');
    }
}

// ========== SISTEMA DE RECORDATORIOS AUTOMÁTICOS ==========

/**
 * Sistema automático de recordatorios para el administrador
 */
function setupAdminReminderSystem() {
    // Verificar recordatorios cada 30 minutos
    setInterval(async () => {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                const today = getLocalDateString();
                const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                // Buscar reservas para mañana (recordatorio 24h)
                const reservationsQuery = query(
                    collection(db, "reservations"),
                    where("date", "==", tomorrow),
                    where("paymentStatus", "in", ["approved", "confirmed"])
                );

                const snapshot = await getDocs(reservationsQuery);
                snapshot.forEach(doc => {
                    const reservation = { id: doc.id, ...doc.data() };
                    sendReminderNotification(reservation, 24);
                });

                // Buscar reservas para hoy en las próximas 2 horas
                const now = new Date();
                const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

                const todayReservationsQuery = query(
                    collection(db, "reservations"),
                    where("date", "==", today),
                    where("paymentStatus", "in", ["approved", "confirmed"])
                );

                const todaySnapshot = await getDocs(todayReservationsQuery);
                todaySnapshot.forEach(doc => {
                    const reservation = { id: doc.id, ...doc.data() };
                    const reservationTime = new Date(`${today}T${reservation.time}:00`);

                    if (reservationTime > now && reservationTime <= twoHoursFromNow) {
                        sendReminderNotification(reservation, 2);
                    }
                });

                console.log('✅ [ADMIN_MOBILE] Sistema de recordatorios ejecutado');
            } catch (error) {
                console.error('❌ [ADMIN_MOBILE] Error en sistema de recordatorios:', error);
            }
        }
    }, 30 * 60 * 1000); // 30 minutos

    console.log('✅ [ADMIN_MOBILE] Sistema de recordatorios automáticos configurado');
}

/**
 * Sistema de detección de notificaciones del cliente - MEJORADO
 */
function setupAdminNotificationListener() {
    // Escuchar eventos de reserva pendiente de pago
    window.addEventListener('pendingPayment', (event) => {
        console.log('📧 [ADMIN_LISTEN] Reserva pendiente de pago detectada:', event.detail);
        sendNewReservationNotification({
            ...event.detail.data,
            notificationType: 'pending'
        });
    });
    // Escuchar eventos de pago confirmado
    window.addEventListener('paymentConfirmed', (event) => {
        console.log('📧 [ADMIN_LISTEN] Pago confirmado detectado:', event.detail);
        sendPaymentConfirmedNotification({
            ...event.detail.data,
            notificationType: 'paid'
        });
    });
    // Compatibilidad: seguir escuchando el evento antiguo solo para reservas ya pagadas
    window.addEventListener('newReservation', (event) => {
        if (event.detail && event.detail.data && event.detail.data.paymentStatus === 'approved') {
            sendNewReservationNotification({
                ...event.detail.data,
                notificationType: 'paid'
            });
        }
    });
    // Verificar localStorage periódicamente para notificaciones
    setInterval(() => {
        try {
            const notificationData = localStorage.getItem('adminNotification');
            if (notificationData) {
                const notification = JSON.parse(notificationData);
                const timeDiff = Date.now() - notification.timestamp;
                // Solo procesar notificaciones recientes (últimos 5 segundos)
                if (timeDiff < 5000) {
                    if (notification.type === 'PENDING_PAYMENT') {
                        sendNewReservationNotification({
                            ...notification.data,
                            notificationType: 'pending'
                        });
                    } else if (notification.type === 'PAYMENT_CONFIRMED') {
                        sendPaymentConfirmedNotification({
                            ...notification.data,
                            notificationType: 'paid'
                        });
                    } else if (notification.type === 'NEW_RESERVATION' && notification.data && notification.data.paymentStatus === 'approved') {
                        sendNewReservationNotification({
                            ...notification.data,
                            notificationType: 'paid'
                        });
                    }
                    // Limpiar la notificación procesada
                    localStorage.removeItem('adminNotification');
                }
            }
        } catch (error) {
            console.error('❌ [ADMIN_LISTEN] Error procesando notificación:', error);
        }
    }, 2000); // Verificar cada 2 segundos
    console.log('✅ [ADMIN_LISTEN] Listener de notificaciones mejorado configurado');
}

/**
 * Configura el botón de notificaciones y verifica el estado inicial
 */
function setupNotificationButton() {
    const button = getEl('enable-notifications-btn');
    if (!button) return;

    // Verificar estado inicial de las notificaciones
    if ('Notification' in window) {
        updateNotificationButton(Notification.permission);
    }

    // Agregar evento de clic
    button.addEventListener('click', handleNotificationButtonClick);

    console.log('✅ [ADMIN] Botón de notificaciones configurado');
}

// Lógica de login de administrador
// Variables globales para el rol del usuario
let currentUserRole = null; // 'admin' | 'observer' | null
let isAuthenticated = false;
let sessionTimeout = null;

// Restaurar sesión desde localStorage si existe
if (localStorage.getItem('adminPanelRole')) {
    currentUserRole = localStorage.getItem('adminPanelRole');
    isAuthenticated = localStorage.getItem('adminPanelAuth') === 'true';
    if (isAuthenticated && currentUserRole) {
        if (currentUserRole === 'admin') enableAllFeatures();
        else enableObserverFeatures();
        showRoleIndicator(currentUserRole === 'admin' ? 'Administrador' : 'Observador', currentUserRole === 'admin' ? 'green' : 'blue');
        updateExitButtonState(true);
    }
}

function setupAdminLogin() {
    const loginModal = document.getElementById('admin-login-modal');
    const loginForm = document.getElementById('admin-login-form');
    const loginError = document.getElementById('admin-login-error');
    const adminPanel = document.getElementById('admin-panel-container');
    const exitAdminButton = document.getElementById('exit-admin-button');

    if (!loginForm) return;

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const inputPassword = document.getElementById('admin-password').value;
        const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;
        const OBSERVER_PASSWORD = import.meta.env.VITE_OBSERVER_PASSWORD; // Contraseña para observador

        if (inputPassword === ADMIN_PASSWORD) {
            // Acceso completo como administrador - SESIÓN PERSISTENTE
            currentUserRole = 'admin';
            isAuthenticated = true;
            // Guardar en localStorage
            localStorage.setItem('adminPanelRole', 'admin');
            localStorage.setItem('adminPanelAuth', 'true');
            loginModal.classList.add('hidden');
            loginModal.classList.remove('flex');
            if (adminPanel) adminPanel.style.display = 'block';
            loginError.textContent = '';

            // Mostrar indicador de rol
            showRoleIndicator('Administrador', 'green');

            // Habilitar todas las funcionalidades
            enableAllFeatures();

            // Cambiar el botón a "Salir del panel"
            updateExitButtonState(true);

            // Configurar sesión persistente (sin auto-cierre)
            setupPersistentSession();

            // Inicializar sistema de asistencias después de establecer rol
            setTimeout(() => {
                initializeAttendanceSystem();
            }, 100);

        } else if (inputPassword === OBSERVER_PASSWORD) {
            // Acceso limitado como observador - SESIÓN PERSISTENTE
            currentUserRole = 'observer';
            isAuthenticated = true;
            // Guardar en localStorage
            localStorage.setItem('adminPanelRole', 'observer');
            localStorage.setItem('adminPanelAuth', 'true');
            loginModal.classList.add('hidden');
            loginModal.classList.remove('flex');
            if (adminPanel) adminPanel.style.display = 'block';
            loginError.textContent = '';

            // Mostrar indicador de rol
            showRoleIndicator('Observador', 'blue');

            // Habilitar solo funcionalidades de observador
            enableObserverFeatures();

            // Cambiar el botón a "Salir del panel"
            updateExitButtonState(true);

            // Configurar sesión persistente (hasta cerrar manualmente)
            setupPersistentSession();

            // Inicializar sistema de asistencias después de establecer rol
            setTimeout(() => {
                initializeAttendanceSystem();
            }, 100);

        } else {
            loginError.textContent = 'Contraseña incorrecta.';
        }
    });

    if (exitAdminButton) {
        exitAdminButton.addEventListener('click', () => {
            if (isAuthenticated) {
                // Si está autenticado, salir del panel
                logoutUser();
            } else {
                // Si no está autenticado, mostrar el modal de login
                loginModal.classList.remove('hidden');
                loginModal.classList.add('flex');
            }
        });
    }

    // Verificar si hay una sesión válida al cargar la página
    window.addEventListener('DOMContentLoaded', () => {
        const savedRole = localStorage.getItem('adminPanelRole');
        const savedAuth = localStorage.getItem('adminPanelAuth');
        
        if (savedRole && savedAuth === 'true') {
            // Restaurar sesión existente
            currentUserRole = savedRole;
            isAuthenticated = true;
            
            if (currentUserRole === 'admin') {
                enableAllFeatures();
            } else if (currentUserRole === 'observer') {
                enableObserverFeatures();
            }
            
            // Mostrar panel y ocultar modal
            const adminPanel = document.getElementById('admin-panel-container');
            const loginModal = document.getElementById('admin-login-modal');
            if (adminPanel) adminPanel.style.display = 'block';
            if (loginModal) {
                loginModal.classList.add('hidden');
                loginModal.classList.remove('flex');
            }
            
            // Actualizar botón y mostrar indicador de rol
            updateExitButtonState(true);
            showRoleIndicator(currentUserRole === 'admin' ? 'Administrador' : 'Observador', 
                            currentUserRole === 'admin' ? 'green' : 'blue');
            
            console.log('✅ Sesión restaurada:', currentUserRole);
        } else {
            // No hay sesión válida, limpiar estado
            logoutUser('');
            updateExitButtonState(false);
        }
    });
}

// Función para mostrar indicador de rol
function showRoleIndicator(role, color) {
    let indicator = document.getElementById('role-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'role-indicator';
        indicator.className = `px-3 py-1 rounded-full text-white text-sm font-medium shadow-lg`;

        // Insertar en la barra superior junto al botón de salir
        const headerContainer = document.querySelector('.mb-8.flex.flex-col.sm\\:flex-row.items-center.justify-between.gap-4');
        if (headerContainer) {
            // Crear un contenedor para el botón y el indicador
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'flex items-center gap-3';

            // Mover el botón de salir al contenedor
            const exitButton = document.getElementById('exit-admin-button');
            if (exitButton) {
                exitButton.remove();
                buttonContainer.appendChild(exitButton);
            }

            // Agregar el indicador al contenedor
            buttonContainer.appendChild(indicator);

            // Reemplazar el botón original con el contenedor
            const originalButtonContainer = headerContainer.querySelector('.flex.items-center.gap-3');
            if (originalButtonContainer) {
                originalButtonContainer.remove();
            }
            headerContainer.appendChild(buttonContainer);
        }
    }

    const colorClasses = {
        'green': 'bg-green-600',
        'blue': 'bg-blue-600'
    };

    // Agregar información sobre el tipo de sesión
    const sessionType = 'Sesión Persistente';
    const sessionIcon = 'ph-infinity';

    indicator.className = `px-3 py-1 rounded-full text-white text-sm font-medium shadow-lg ${colorClasses[color]}`;
    indicator.innerHTML = `<i class="ph ph-user-circle mr-1"></i>${role} <i class="ph ${sessionIcon} ml-1" title="${sessionType}"></i>`;
}

// Función para ocultar indicador de rol
function hideRoleIndicator() {
    const indicator = document.getElementById('role-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Función para actualizar el estado del botón de entrada/salida
function updateExitButtonState(isAuthenticated) {
    const exitButton = document.getElementById('exit-admin-button');
    if (exitButton) {
        if (isAuthenticated) {
            // Usuario autenticado - mostrar "Salir del panel"
            exitButton.textContent = 'Salir del panel';
            exitButton.className = 'text-sm font-medium bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg';
        } else {
            // Usuario no autenticado - mostrar "Entrar al panel"
            exitButton.textContent = 'Entrar al panel';
            exitButton.className = 'text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg';
        }
    }
}

// Función para configurar sesión temporal (Administrador)
function setupTemporarySession() {
    // Limpiar timeout anterior si existe
    if (sessionTimeout) {
        clearTimeout(sessionTimeout);
    }

    // Configurar timeout de 30 minutos para administrador
    sessionTimeout = setTimeout(() => {
        logoutUser('Sesión de administrador expirada por seguridad.');
    }, 30 * 60 * 1000); // 30 minutos

    console.log('🔒 [ADMIN] Sesión temporal configurada (30 minutos)');
}

// Función para configurar sesión persistente (Observador)
function setupPersistentSession() {
    // Limpiar timeout anterior si existe
    if (sessionTimeout) {
        clearTimeout(sessionTimeout);
        sessionTimeout = null;
    }


}

// Función para cerrar sesión
function logoutUser(message = 'Sesión cerrada.') {
    // Limpiar todos los timers y listeners
    cleanupAllTimers();

    // Limpiar variables de sesión
    currentUserRole = null;
    isAuthenticated = false;
    window._forceAdminActive = false;

    // Limpiar timeout
    if (sessionTimeout) {
        clearTimeout(sessionTimeout);
        sessionTimeout = null;
    }

    // Ocultar panel
    const adminPanel = document.getElementById('admin-panel-container');
    if (adminPanel) adminPanel.style.display = 'none';

    // Mostrar modal de login
    const loginModal = document.getElementById('admin-login-modal');
    if (loginModal) {
        loginModal.classList.remove('hidden');
        loginModal.classList.add('flex');
    }

    // Limpiar indicador de rol
    hideRoleIndicator();

    // Limpiar contraseña
    const passwordInput = document.getElementById('admin-password');
    if (passwordInput) passwordInput.value = '';

    // Cambiar el botón a "Entrar al panel"
    updateExitButtonState(false);

    // Limpiar clases del body
    document.body.classList.remove('admin-mode', 'observer-mode');

    // Mostrar mensaje si se proporciona
    if (message) {
        const loginError = document.getElementById('admin-login-error');
        if (loginError) {
            loginError.textContent = message;
            setTimeout(() => {
                loginError.textContent = '';
            }, 5000);
        }
    }

    console.log('👋 Usuario deslogueado - Sistema limpiado');

    // Limpiar localStorage
    localStorage.removeItem('adminPanelRole');
    localStorage.removeItem('adminPanelAuth');
}

// Función para habilitar todas las funcionalidades (admin)
function enableAllFeatures() {
    // Asegurar que el rol esté establecido correctamente
    currentUserRole = 'admin';
    console.log('✅ Rol establecido como admin en enableAllFeatures');

    // Agregar clase al body para activar estilos CSS
    document.body.classList.add('admin-mode');
    document.body.classList.remove('observer-mode');

    // Mostrar todos los botones y funcionalidades
    const observerOnlyElements = document.querySelectorAll('.observer-only');
    observerOnlyElements.forEach(el => el.style.display = 'none');

    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => el.style.display = 'block');
}

// Función para habilitar solo funcionalidades de observador
function enableObserverFeatures() {
    // Agregar clase al body para activar estilos CSS
    document.body.classList.add('observer-mode');
    document.body.classList.remove('admin-mode');

    // Ocultar funcionalidades de admin
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => el.style.display = 'none');

    // Mostrar solo funcionalidades de observador
    const observerOnlyElements = document.querySelectorAll('.observer-only');
    observerOnlyElements.forEach(el => el.style.display = 'block');
}

// Llama a la función de setup de login al cargar el JS
setupAdminLogin();

// Función para verificar el estado del rol
function checkUserRole() {
    console.log('🔍 Verificando rol del usuario...');
    console.log('Rol actual:', currentUserRole);
    console.log('¿Está autenticado?:', isAuthenticated);
    console.log('¿Tiene clase admin-mode?:', document.body.classList.contains('admin-mode'));
    console.log('¿Tiene clase observer-mode?:', document.body.classList.contains('observer-mode'));
}

// ========== INICIALIZACIÓN PRINCIPAL ==========
window.addEventListener('DOMContentLoaded', async () => {
    try {
        await signInAnonymously(auth);
        initializeAdminPanel();

        // Verificar rol después de la inicialización
        setTimeout(checkUserRole, 1000);
    } catch (error) {
        console.error('Error de autenticación Firebase:', error);
    }
});

// Registro automático del Service Worker y solicitud de permisos de notificaciones
if ('serviceWorker' in navigator) {
    // Registrar el Service Worker personalizado (para cache, etc)
    // navigator.serviceWorker.register('/sw.js', { scope: '/' })
    //      .then(reg => console.log('Service Worker registrado (sw.js):', reg))
    //      .catch(err => console.error('Error registrando Service Worker (sw.js):', err));

    // Registrar el Service Worker de Firebase para notificaciones push
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .catch(err => console.error('Error registrando Service Worker de Firebase:', err));
}

if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Exportar funciones para uso global
window.getEl = getEl;
window.fetchAdminReservations = fetchAdminReservations;
window.updateAdminUI = updateAdminUI;
window.exportToExcel = exportToExcel;
window.deleteReservation = deleteReservation;
window.refreshPaymentStatus = refreshPaymentStatus;
window.forcePaymentStatusUpdate = forcePaymentStatusUpdate;
window.generarComprobantePDF = generarComprobantePDF;

// Función temporal para forzar rol de admin (solo para testing)
window.forceAdminRole = function() {
    // Limpiar sistema anterior
    cleanupAllTimers();

    // Establecer rol de admin
    currentUserRole = 'admin';
    isAuthenticated = true;
    window._forceAdminActive = true;
    enableAllFeatures();
    showRoleIndicator('Administrador', 'green');
    console.log('🔧 Rol forzado como admin');
    checkUserRole();

    // Reinicializar sistema de asistencias
    initializeAttendanceSystem();

    // Refrescar la UI para mostrar botones de asistencia
    const dateFilter = getEl('dateFilter');
    if (dateFilter && dateFilter.value) {
        fetchAdminReservations(dateFilter.value, 'daily');
    }
};

// Función para limpiar todo el sistema
window.cleanupSystem = function() {
    cleanupAllTimers();
    clearSystemState();
    console.log('🧹 Sistema completamente limpiado');
};

// Función para debuggear el estado de las reservas
window.debugReservations = function() {
    console.log('🔍 Debug de reservas:');
    console.log('allReservations:', allReservations.length);
    console.log('currentFilter:', currentFilter);
    console.log('¿Hay filtro activo?:', currentFilter !== 'all' && currentFilter !== '');
    console.log('Primeras 3 reservas:', allReservations.slice(0, 3));
    console.log('Flag de actualización:', window._isUpdatingFromListener);
};

// Función para forzar la restauración de reservas
window.forceRestoreReservations = function() {
    const dateFilter = getEl('dateFilter');
    if (dateFilter && dateFilter.value) {
        console.log('🔄 Forzando restauración de reservas...');
        // NO llamar a fetchAdminReservations porque crea un nuevo listener
        // En su lugar, usar el listener existente
        if (window._adminReservationsUnsub) {
            console.log('🔄 Usando listener existente para restaurar reservas');
            // El listener existente ya debería estar funcionando
            // Solo forzar una actualización de la UI con las reservas actuales
            if (allReservations.length > 0) {
                console.log(`🔄 Restaurando ${allReservations.length} reservas desde cache`);
                updateAdminUI(allReservations, 'FILTER_UPDATE', 'Restaurado desde cache');
            } else {
                console.log('⚠️ No hay reservas en cache para restaurar');
            }
        } else {
            console.log('🔄 Creando nuevo listener para restaurar reservas');
            fetchAdminReservations(dateFilter.value, 'daily');
        }
    }
};

// Función para verificar y corregir el estado de las reservas
window.checkAndFixReservations = function() {
    console.log('🔍 Verificando estado de reservas...');
    console.log('allReservations:', allReservations.length);
    console.log('currentFilter:', currentFilter);
    console.log('Listener activo:', !!window._firestoreUnsubscribe);
    console.log('Flag de actualización:', window._isUpdatingFromListener);

    // Si no hay reservas pero debería haberlas, forzar restauración
    if (allReservations.length === 0 && window._firestoreUnsubscribe) {
        console.log('⚠️ No hay reservas pero hay listener activo, forzando restauración...');
        window.forceRestoreReservations();
    }
};

// Función para verificar el estado del listener
window.debugListenerState = function() {
    console.log('🔍 Debug del estado del listener:');
    console.log('_firestoreUnsubscribe:', !!window._firestoreUnsubscribe);
    console.log('_adminReservationsUnsub:', !!window._adminReservationsUnsub);
    console.log('_isUpdatingFromListener:', window._isUpdatingFromListener);
    console.log('allReservations.length:', allReservations.length);
    console.log('currentFilter:', currentFilter);

    // Verificar si hay múltiples listeners activos
    if (window._firestoreUnsubscribe && window._adminReservationsUnsub) {
        console.log('⚠️ ADVERTENCIA: Hay múltiples listeners activos');
    }
};

// Función para restaurar filtros y reservas
window.restoreFiltersAndReservations = function() {
    console.log('🔄 Restaurando filtros y reservas...');

    // Verificar que los filtros estén visibles
    const filterCards = document.querySelectorAll('.filter-card');
    console.log(`🔍 Encontrados ${filterCards.length} filtros en el DOM`);

    if (filterCards.length === 0) {
        console.log('⚠️ No se encontraron filtros en el DOM');
        return;
    }

    // If no reservations, try to get them
    if (allReservations.length === 0) {
        console.log('⚠️ No hay reservas, intentando obtenerlas...');
        const dateFilter = getEl('dateFilter');
        if (dateFilter && dateFilter.value) {
            const currentDate = dateFilter.value;
            const reservationsRef = collection(db, "reservations");
            const q = query(reservationsRef, where('date', '==', currentDate));

            getDocs(q).then((snapshot) => {
                const reservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const filteredReservations = reservations.filter(res => res.name && res.date && res.time);
                filteredReservations.sort((a, b) => {
                    const dateA = new Date(`${a.date}T${a.time}`);
                    const dateB = new Date(`${b.date}T${b.time}`);
                    return dateA - dateB;
                });

                allReservations = [...filteredReservations];
                console.log(`✅ Restauradas ${allReservations.length} reservas`);

                // Apply current filter if it exists
                if (currentFilter && currentFilter !== 'all') {
                    applyFilter(currentFilter);
                } else {
                    updateAdminUI(allReservations, 'FILTER_UPDATE', 'Restaurado');
                }
            }).catch((error) => {
                console.error('Error restaurando reservas:', error);
            });
        }
    } else {
        console.log(`✅ Ya hay ${allReservations.length} reservas, aplicando filtro actual`);
        // Apply current filter if it exists
        if (currentFilter && currentFilter !== 'all') {
            applyFilter(currentFilter);
        } else {
            updateAdminUI(allReservations, 'FILTER_UPDATE', 'Restaurado');
        }
    }
};

// MODAL DE ÉXITO TRAS ELIMINAR RESERVA (ADMIN)
function showSuccessDeleteModal() {
    // Eliminar cualquier modal anterior
    const oldModal = document.getElementById('custom-modal-overlay');
    if (oldModal) oldModal.remove();
    const overlay = document.createElement('div');
    overlay.id = 'custom-modal-overlay';
    overlay.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50';
    overlay.style.zIndex = 9999;
    const modal = document.createElement('div');
    modal.className = 'bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center relative border-2 border-green-200 animate__animated animate__fadeInDown';
    // Icono de éxito
    const icon = document.createElement('div');
    icon.innerHTML = '<div class="flex justify-center mb-2"><span class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100"><svg class="w-10 h-10 text-green-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2l4 -4"/><circle cx="12" cy="12" r="9"/></svg></span></div>';
    modal.appendChild(icon);
    // Título
    const titleEl = document.createElement('h2');
    titleEl.className = 'text-2xl font-bold mb-2 text-green-700';
    titleEl.textContent = '¡Reserva Eliminada!';
    modal.appendChild(titleEl);
    // Mensaje
    const msgEl = document.createElement('p');
    msgEl.className = 'mb-4 text-gray-700';
    msgEl.textContent = 'La reserva fue eliminada correctamente.';
    modal.appendChild(msgEl);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(() => {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        // Refrescar la lista de reservas
        const dateFilter = document.getElementById('dateFilter');
        const periodSelector = document.getElementById('periodSelector');
        if (dateFilter && dateFilter.value) {
            fetchAdminReservations(dateFilter.value, periodSelector ? periodSelector.value : 'daily');
        }
    }, 1000);
}

// ========== GESTIÓN DE DÍAS Y TURNOS ESPECIALES ==========

function setupSpecialDaysModal() {
    const openBtn = document.getElementById('open-special-days-modal');
    const modal = document.getElementById('special-days-modal');
    const closeBtn = document.getElementById('close-special-days-modal');
    const form = document.getElementById('special-days-form');
    const dateInput = document.getElementById('special-day-date');
    const lunchOpen = document.getElementById('special-lunch-open');
    const dinnerOpen = document.getElementById('special-dinner-open');
    const lunchClose = document.getElementById('special-lunch-close');
    const dinnerClose = document.getElementById('special-dinner-close');
    const list = document.getElementById('special-days-list');

    // Abrir modal
    openBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        loadSpecialDaysList();
    });
    // Cerrar modal
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        form.reset();
    });
    // Validar que no se pueda abrir y cerrar el mismo turno a la vez
    lunchOpen.addEventListener('change', () => { if (lunchOpen.checked) lunchClose.checked = false; });
    lunchClose.addEventListener('change', () => { if (lunchClose.checked) lunchOpen.checked = false; });
    dinnerOpen.addEventListener('change', () => { if (dinnerOpen.checked) dinnerClose.checked = false; });
    dinnerClose.addEventListener('change', () => { if (dinnerClose.checked) dinnerOpen.checked = false; });

    // Guardar configuración
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fecha = dateInput.value;
        if (!fecha) return showSimpleMessage('Selecciona una fecha', 'error');
        const data = {
            fecha,
            almuerzo: lunchOpen.checked ? 'abierto' : (lunchClose.checked ? 'cerrado' : null),
            cena: dinnerOpen.checked ? 'abierto' : (dinnerClose.checked ? 'cerrado' : null)
        };
        if (!data.almuerzo && !data.cena) return showSimpleMessage('Selecciona al menos un turno para abrir o cerrar', 'error');
        await setDoc(doc(collection(db, 'turnosEspeciales'), fecha), data);
        form.reset();
        loadSpecialDaysList();
        showSimpleMessage('Día especial guardado', 'success');
    });

    // Función para mostrar mensajes simples en el modal
    function showSimpleMessage(message, type = 'info') {
        // Crear o actualizar el elemento de mensaje
        let messageEl = document.getElementById('special-days-message');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.id = 'special-days-message';
            messageEl.className = 'w-full text-center p-2 rounded-lg mb-2';
            form.parentNode.insertBefore(messageEl, form);
        }

        const colors = {
            success: 'bg-green-100 text-green-800',
            error: 'bg-red-100 text-red-800',
            info: 'bg-blue-100 text-blue-800'
        };

        messageEl.className = `w-full text-center p-2 rounded-lg mb-2 ${colors[type]}`;
        messageEl.textContent = message;

        // Auto-ocultar después de 3 segundos
        setTimeout(() => {
            if (messageEl && messageEl.parentNode) {
                messageEl.remove();
            }
        }, 3000);
    }

    // Cargar lista de días especiales
    async function loadSpecialDaysList() {
        list.innerHTML = '<li class="text-gray-400 text-sm sm:text-base">Cargando...</li>';
        const snap = await getDocs(collection(db, 'turnosEspeciales'));
        if (snap.empty) {
            list.innerHTML = '<li class="text-gray-400 text-sm sm:text-base">No hay días especiales configurados</li>';
            return;
        }
        list.innerHTML = '';
        snap.forEach(docSnap => {
            const d = docSnap.data();
            const fecha = d.fecha;
            // Siempre mostrar ambos turnos, aunque uno esté vacío
            const almuerzoEstado = d.almuerzo ? `<span class='${d.almuerzo === 'abierto' ? 'text-green-600' : 'text-red-600'}'>${d.almuerzo}</span>` : `<span class='text-gray-400'>-</span>`;
            const cenaEstado = d.cena ? `<span class='${d.cena === 'abierto' ? 'text-green-600' : 'text-red-600'}'>${d.cena}</span>` : `<span class='text-gray-400'>-</span>`;
            let desc = `<span class='font-semibold text-xs sm:text-sm'>${fecha}</span>: <span class='text-xs sm:text-sm'>Almuerzo ${almuerzoEstado} <span class='text-gray-400'>|</span> Cena ${cenaEstado}</span>`;
            list.innerHTML += `<li class='flex items-center justify-between gap-1 sm:gap-2 bg-gray-100 rounded px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm'>${desc}<button data-fecha='${fecha}' class='delete-special-day text-red-600 hover:text-red-800 ml-1 sm:ml-2 p-1'><i class='ph ph-trash text-sm sm:text-base'></i></button></li>`;
        });
        // Botones de eliminar
        list.querySelectorAll('.delete-special-day').forEach(btn => {
            btn.addEventListener('click', async () => {
                const fecha = btn.getAttribute('data-fecha');
                // Eliminar directamente y mostrar mensaje simple
                await deleteDoc(doc(collection(db, 'turnosEspeciales'), fecha));
                loadSpecialDaysList();
                showSimpleMessage('Día especial eliminado', 'success');
            });
        });
    }
}

// ========== MODAL DE EDICIÓN DE RESERVAS ==========

async function openEditModal(reservationId) {
    try {
        if (!reservationId) {
            alert('Error: No se pudo identificar la reserva a editar');
            return;
        }
        const docRef = doc(db, "reservations", reservationId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            alert('Reserva no encontrada');
            return;
        }
        const resData = docSnap.data();
        // Eliminar cualquier modal anterior
        const oldModal = document.getElementById('custom-modal-overlay');
        if (oldModal) oldModal.remove();
        // Crear overlay y modal
        const overlay = document.createElement('div');
        overlay.id = 'custom-modal-overlay';
        overlay.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4';
        overlay.style.zIndex = 9999;
        const modal = document.createElement('div');
        modal.className = 'bg-white rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto relative';
        // Botón de cerrar - siempre visible y bien posicionado
        const closeBtn = document.createElement('button');
        closeBtn.className = 'absolute top-2 right-2 text-gray-500 hover:text-gray-700 transition-colors z-50 bg-white rounded-full p-1 shadow-sm';
        closeBtn.innerHTML = '<i class="ph ph-x text-xl"></i>';
        closeBtn.onclick = () => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        };
        modal.appendChild(closeBtn);
        // Header
        const header = document.createElement('div');
        header.className = 'text-center mb-6 sm:mb-8 pt-2';
        header.innerHTML = `
            <div class="flex justify-center mb-3 sm:mb-4">
                <span class="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-100">
                    <i class="ph ph-pencil-simple text-2xl sm:text-3xl text-green-600"></i>
                </span>
            </div>
            <h2 class="text-xl sm:text-2xl font-bold text-green-700">Editar Reserva</h2>
            <p class="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">Modifica los datos de la reserva</p>
        `;
        modal.appendChild(header);
        // Formulario
        const form = document.createElement('form');
        form.className = 'space-y-4 sm:space-y-6';
        // Sección: Tus Datos
        const datosSection = document.createElement('div');
        datosSection.className = 'space-y-3 sm:space-y-4';
        datosSection.innerHTML = `
            <h3 class="text-base sm:text-lg font-semibold text-gray-800 border-b pb-2">Tus Datos</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Nombre y Apellido</label>
                    <input type="text" name="name" value="${resData.name || ''}" required class="w-full p-2 sm:p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 text-sm sm:text-base">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                    <input type="tel" name="phone" value="${resData.phone || ''}" required class="w-full p-2 sm:p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 text-sm sm:text-base">
                </div>
            </div>
        `;
        form.appendChild(datosSection);
        // Sección: Detalles de la Reserva
        const reservaSection = document.createElement('div');
        reservaSection.className = 'space-y-3 sm:space-y-4';
        reservaSection.innerHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                    <input type="date" name="date" value="${resData.date || ''}" required class="w-full p-2 sm:p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 text-sm sm:text-base">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                    <input type="time" name="time" value="${resData.time || ''}" required class="w-full p-2 sm:p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 text-sm sm:text-base">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Comensales</label>
                    <input type="number" name="diners" value="${resData.diners || 2}" min="1" required class="w-full p-2 sm:p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 text-sm sm:text-base">
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Área</label>
                    <select name="area" class="w-full p-2 sm:p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 text-sm sm:text-base">
                        <option value="" ${!resData.area ? 'selected' : ''}>Seleccionar...</option>
                        <option value="Salón" ${resData.area === 'Salón' ? 'selected' : ''}>Salón</option>
                        <option value="Patio" ${resData.area === 'Patio' ? 'selected' : ''}>Patio</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                    <textarea name="notes" rows="2" class="w-full p-2 sm:p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 text-sm sm:text-base">${resData.notes || ''}</textarea>
                </div>
            </div>
        `;
        form.appendChild(reservaSection);
        // Mensaje de error
        const errorEl = document.createElement('div');
        errorEl.className = 'text-red-600 text-sm hidden';
        form.appendChild(errorEl);
        // Botón guardar
        const btnGroup = document.createElement('div');
        btnGroup.className = 'mt-6 sm:mt-8';
        const saveBtn = document.createElement('button');
        saveBtn.type = 'submit';
        saveBtn.className = 'w-full bg-green-700 text-white font-bold py-2 sm:py-3 px-4 rounded-lg hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-500 transition-transform transform hover:scale-105 flex items-center justify-center gap-2 text-sm sm:text-base';
        saveBtn.innerHTML = '<i class="ph ph-check-circle text-lg sm:text-xl"></i>Guardar Cambios';
        btnGroup.appendChild(saveBtn);
        form.appendChild(btnGroup);
        modal.appendChild(form);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        // Validación y guardado
        form.onsubmit = async (e) => {
            e.preventDefault();
            errorEl.classList.add('hidden');
            const formData = new FormData(form);
            const name = formData.get('name').trim();
            const phone = formData.get('phone').trim();
            const date = formData.get('date');
            const time = formData.get('time');
            const diners = parseInt(formData.get('diners'), 10);
            const area = formData.get('area');
            const notes = formData.get('notes');
            // Validaciones
            if (!name || !phone || !date || !time || diners < 1) {
                errorEl.textContent = 'Por favor, completa todos los campos requeridos.';
                errorEl.classList.remove('hidden');
                return;
            }
            const now = new Date();
            const reservationDateTime = new Date(`${date}T${time}`);
            if (reservationDateTime < now) {
                errorEl.textContent = 'No puedes reservar para una fecha u hora que ya ha pasado.';
                errorEl.classList.remove('hidden');
                return;
            }
            if (reservationDateTime.toDateString() === now.toDateString() && (reservationDateTime.getTime() - now.getTime()) / 60000 < 30) {
                errorEl.textContent = 'Debes reservar con al menos 30 minutos de anticipación.';
                errorEl.classList.remove('hidden');
                return;
            }
            // Validar horario fuera de apertura (usando validateReservationTime)
            if (typeof validateReservationTime === 'function') {
                const valid = await validateReservationTime(date, time, 'client', errorEl);
                if (!valid) {
                    errorEl.textContent = 'El restaurante no está abierto en el horario seleccionado.';
                    errorEl.classList.remove('hidden');
                    return;
                }
            }
            // Guardar en Firestore
            try {
                await updateDoc(docRef, {
                    name,
                    phone,
                    date,
                    time,
                    diners,
                    area,
                    notes,
                    updatedAt: new Date().toISOString()
                });
                showSuccessModal('Reserva actualizada correctamente.');
                setTimeout(() => {
                    if (overlay && overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                    // Refrescar la lista de reservas
                    const dateFilter = document.getElementById('dateFilter');
                    const periodSelector = document.getElementById('periodSelector');
                    if (dateFilter && dateFilter.value) {
                        fetchAdminReservations(dateFilter.value, periodSelector ? periodSelector.value : 'daily');
                    }
                }, 1000);
            } catch (error) {
                errorEl.textContent = 'Error al actualizar la reserva. Intenta de nuevo.';
                errorEl.classList.remove('hidden');
                console.error('❌ [EDIT_RESERVATION] Error al actualizar reserva:', error);
            }
        };
    } catch (error) {
        console.error('Error al abrir modal de edición:', error);
        alert('Error al cargar los datos de la reserva: ' + error.message);
    }
}

// Función para mostrar mensajes en el modal de edición
function showEditMessage(message, type = 'info') {
    const messageArea = document.getElementById('edit-message-area');
    if (!messageArea) return;

    const colors = {
        success: 'bg-green-100 text-green-800',
        error: 'bg-red-100 text-red-800',
        info: 'bg-blue-100 text-blue-800'
    };

    messageArea.innerHTML = `<div class="${colors[type]} p-3 rounded-lg text-sm">${message}</div>`;

    // Auto-ocultar después de 3 segundos
    setTimeout(() => {
        messageArea.innerHTML = '';
    }, 3000);
}

// ========== HISTORIAL DE CANCELACIONES (ADMIN) ==========
function setupCancellationsHistoryModal() {
    const openBtn = document.getElementById('open-cancellations-history-modal');
    const modal = document.getElementById('cancellations-history-modal');
    const closeBtn = document.getElementById('close-cancellations-history-modal');
    const searchInput = document.getElementById('cancellations-search-input');
    
    if (openBtn && modal) {
        openBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            fetchCancellations();
        });
    }
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }
    
    // Agregar funcionalidad de búsqueda
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterCancellations(searchTerm);
        });
    }
}

// Variable global para almacenar todas las cancelaciones
let allCancellations = [];

async function fetchCancellations() {
    try {
        const querySnapshot = await getDocs(collection(db, "cancellations"));
        allCancellations = [];
        querySnapshot.forEach((doc) => {
            allCancellations.push({ id: doc.id, ...doc.data() });
        });
        
        // Aplicar filtro de búsqueda si hay un término activo
        const searchInput = document.getElementById('cancellations-search-input');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        filterCancellations(searchTerm);
    } catch (error) {
        console.error("Error al obtener cancelaciones:", error);
        allCancellations = [];
        renderCancellationsList([], document.getElementById('cancellations-history-list'));
    }
}

// Función para filtrar cancelaciones por término de búsqueda
function filterCancellations(searchTerm) {
    if (!searchTerm) {
        // Si no hay término de búsqueda, mostrar todas
        renderCancellationsList(allCancellations, document.getElementById('cancellations-history-list'));
        return;
    }
    
    const filteredCancellations = allCancellations.filter(cancellation => {
        // Buscar en múltiples campos sin importar mayúsculas/minúsculas
        const searchableFields = [
            cancellation.name || '',
            cancellation.nombre || '',
            cancellation.phone || '',
            cancellation.telefono || '',
            cancellation.motivo || '',
            cancellation.notes || '',
            cancellation.notas || '',
            cancellation.date || '',
            cancellation.fecha || '',
            cancellation.time || '',
            cancellation.hora || '',
            cancellation.area || '',
            cancellation.diners || '',
            cancellation.comensales || '',
            cancellation.cancelledBy || '',
            formatDateTime(cancellation.cancelledAt) || ''
        ].map(field => String(field).toLowerCase());
        
        // Verificar si el término de búsqueda está contenido en alguno de los campos
        return searchableFields.some(field => field.includes(searchTerm));
    });
    
    renderCancellationsList(filteredCancellations, document.getElementById('cancellations-history-list'));
}

function renderCancellationsList(cancellations, container) {
    if (!container) return;
    
    if (!cancellations.length) {
        const searchInput = document.getElementById('cancellations-search-input');
        const hasSearchTerm = searchInput && searchInput.value.trim();
        
        if (hasSearchTerm) {
            container.innerHTML = `
                <div class="text-gray-500 text-center py-8">
                    <i class="ph ph-magnifying-glass text-4xl mb-2 text-gray-300"></i>
                    <div class="text-lg font-medium">No se encontraron resultados</div>
                    <div class="text-sm">Intenta con otros términos de búsqueda</div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="text-gray-500 text-center py-8">
                    <i class="ph ph-clock-counter-clockwise text-4xl mb-2 text-gray-300"></i>
                    <div class="text-lg font-medium">No hay cancelaciones registradas</div>
                    <div class="text-sm">El historial aparecerá aquí cuando se cancelen reservas</div>
                </div>
            `;
        }
        return;
    }
    
    container.innerHTML = cancellations.map(c => `
        <div class="border-b py-3 px-2 flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-gray-50 transition-colors">
            <div class="flex-1">
                <div class="font-semibold text-gray-800">${c.name || c.nombre || 'Sin nombre'} <span class="text-xs text-gray-500">(${c.phone || c.telefono || '-'})</span></div>
                <div class="text-sm text-gray-600">
                    Reserva: ${c.date || c.fecha || '-'} ${c.time || c.hora || ''} | Comensales: ${c.diners || c.comensales || '-'}${c.area ? ' | Área: ' + c.area : ''}
                </div>
                ${(c.notes || c.notas) ? `<div class="text-xs text-gray-700 mt-1">Notas: ${c.notes || c.notas}</div>` : ''}
                <div class="text-xs text-gray-400">Cancelada: ${formatDateTime(c.cancelledAt)}</div>
                ${c.motivo ? `<div class="text-xs text-red-700 mt-1">Motivo: ${c.motivo}</div>` : ''}
            </div>
            <div>
                <button class="delete-cancellation-btn bg-red-100 text-red-700 px-2 py-1 rounded text-xs mt-1 hover:bg-red-200 transition" data-cancel-id="${c.id}">
                    <i class="ph ph-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `).join('');

    // Agregar eventos a los botones de eliminar
    container.querySelectorAll('.delete-cancellation-btn').forEach(btn => {
        btn.onclick = async () => {
            const cancelId = btn.getAttribute('data-cancel-id');
            if (cancelId && confirm('¿Eliminar este registro del historial de cancelaciones de forma permanente?')) {
                await deleteCancellationFromDB(cancelId);
                showSuccessModal('Cancelación eliminada del historial');
                // Refrescar la lista
                fetchCancellations();
            }
        };
    });
}

async function deleteCancellationFromDB(cancelId) {
    try {
        await deleteDoc(doc(db, 'cancellations', cancelId));
    } catch (error) {
        alert('Error al eliminar la cancelación: ' + error.message);
    }
}

function formatDateTime(dt) {
    if (!dt) return '-';
    const d = new Date(dt);
    return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

// Inicializar el historial de cancelaciones al cargar el admin
window.addEventListener('DOMContentLoaded', setupCancellationsHistoryModal);

// MODAL DE ÉXITO ANIMADO UNIVERSAL (versión fluida)
function showSuccessModal(message = "Acción realizada correctamente.") {
    const modal = getEl('success-modal'); // Assuming success-modal is an existing element
    const messageEl = getEl('success-modal-message'); // Assuming success-modal-message is an existing element

    if (!modal || !messageEl) {
        console.error('Modal de éxito o elemento de mensaje no encontrado');
        alert(message);
        return;
    }

    messageEl.textContent = message;
    modal.classList.remove('hidden');

    // Auto-cerrar después de 1 segundo
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 1000);
}

// Función para configurar el modal de edición
function setupEditModal() {
    const editModal = getEl('editModal');
    const closeEditBtn = getEl('closeEditModal');
    const editForm = getEl('editForm');

    if (!editModal || !closeEditBtn || !editForm) {
        console.warn('Elementos del modal de edición no encontrados');
        return;
    }

    // Cerrar modal
    closeEditBtn.onclick = () => {
        editModal.classList.add('hidden');
    };

    // Cerrar al hacer clic fuera del modal
    editModal.onclick = (e) => {
        if (e.target === editModal) {
            editModal.classList.add('hidden');
        }
    };

    // Manejar envío del formulario
    editForm.onsubmit = async (e) => {
        e.preventDefault();
        await handleEditFormSubmit();
    };

    console.log('✅ Modal de edición configurado correctamente');
}

// Función para manejar el envío del formulario de edición
async function handleEditFormSubmit() {
    try {
        const formData = new FormData(getEl('editForm'));
        const reservationId = formData.get('reservationId');

        if (!reservationId) {
            showEditMessage('Error: ID de reserva no encontrado', 'error');
            return;
        }

        // Obtener datos del formulario
        const time = formData.get('editTime');
        const updatedData = {
            name: formData.get('editName'),
            phone: formData.get('editPhone'),
            date: formData.get('editDate'),
            time: time,
            turn: calcularTurnoPorHora(time), // Calcular turno automáticamente
            diners: parseInt(formData.get('editDiners')),
            area: formData.get('editArea'),
            notes: formData.get('editNotes')
        };

        // Validar datos
        if (!updatedData.name || !updatedData.phone || !updatedData.date || !updatedData.time || !updatedData.diners) {
            showEditMessage('Por favor complete todos los campos obligatorios', 'error');
            return;
        }

        // Verificar que la reserva existe
        const reservationRef = doc(db, 'reservations', reservationId);
        const reservationDoc = await getDoc(reservationRef);

        if (!reservationDoc.exists()) {
            showEditMessage('La reserva no existe o ya fue cancelada', 'error');
            return;
        }

        // Obtener datos originales para la notificación
        const originalData = reservationDoc.data();

        // Actualizar la reserva
        await updateDoc(reservationRef, {
            ...updatedData,
            updatedAt: serverTimestamp()
        });

        // Enviar notificación de modificación
        const notificationData = {
            ...updatedData,
            id: reservationId,
            createdBy: originalData.createdBy || 'admin',
            notificationType: 'modified'
        };
        await sendNewReservationNotification(notificationData);

        showEditMessage('Reserva actualizada correctamente', 'success');

        // Cerrar modal después de 1 segundo
        setTimeout(() => {
            getEl('editModal').classList.add('hidden');
            // Recargar la lista de reservas
            const dateFilter = getEl('dateFilter');
            const periodSelector = getEl('periodSelector');
            if (dateFilter && dateFilter.value) {
                fetchAdminReservations(dateFilter.value, periodSelector ? periodSelector.value : 'daily');
            }
        }, 1000);

    } catch (error) {
        console.error('Error al actualizar reserva:', error);
        showEditMessage('Error al actualizar la reserva: ' + error.message, 'error');
    }
}

// Inicializar la gestión de días especiales al cargar el admin
window.addEventListener('DOMContentLoaded', () => {
    setupSpecialDaysModal();
    setupEditModal();
    setupCancellationsHistoryModal();
});

// Llamar a la función cuando se actualice la lista de reservas
// This override of updateAdminUI is problematic and unnecessary.
// Instead, directly call setupReservationTimers and ensure other relevant calls
// are made directly inside the main updateAdminUI after the data is processed.
// Removed: const originalUpdateAdminUI = updateAdminUI;
// Removed: updateAdminUI = function(reservations, titleDate = '', periodInfo = '') {
// Removed: originalUpdateAdminUI(reservations, titleDate, periodInfo);
// Removed: setupReservationActionButtons(); // This is already handled by setupAdminActionEvents
// Removed: };


// ========== LIMPIAR CACHÉ Y FORZAR ACTUALIZACIÓN ==========
async function forceRefreshReservations() {
    try {
        console.log('🔄 Forzando actualización completa de reservas...');

        // Limpiar caché local completamente
        // This is no longer window._adminReservationsFiltered, but rather allReservations
        allReservations = []; // Clear the primary data source
        reservasPorFecha = {}; // Clear the date-specific cache as well

        // Limpiar cualquier caché de Firebase
        if (db) { // Check if db is initialized
            try {
                // Forzar desconexión y reconexión de Firestore
                console.log('🔄 Limpiando persistencia de Firestore...');
                await db.clearPersistence();
            } catch (e) {
                console.log('No se pudo limpiar persistencia de Firestore (puede que no esté habilitada o haya otros tabs abiertos):', e);
            }
        }

        // Limpiar la interfaz completamente
        const body = getEl('reservationsTableBody');
        const mobileDiv = getEl('reservasCardsMobile');
        if (body) body.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-gray-500">Actualizando...</td></tr>';
        if (mobileDiv) mobileDiv.innerHTML = '<div class="p-8 text-center text-gray-500">Actualizando...</div>';

        // Forzar recarga desde Firestore
        const dateFilter = getEl('dateFilter');
        const periodSelector = getEl('periodSelector');

        if (dateFilter && dateFilter.value) {
            console.log('🔄 Recargando reservas desde Firestore para fecha:', dateFilter.value);
            await fetchAdminReservations(dateFilter.value, periodSelector ? periodSelector.value : 'daily');
            showSuccessModal('Lista de reservas actualizada correctamente');
        } else {
            // If no date selected, use today
            const today = getLocalDateString();
            console.log('🔄 Recargando reservas desde Firestore para hoy:', today);
            await fetchAdminReservations(today, 'daily');
            showSuccessModal('Lista de reservas actualizada correctamente');
        }

    } catch (error) {
        console.error('Error al forzar actualización:', error);
        showSuccessModal('Error al actualizar la lista de reservas: ' + error.message);
    }
}

// Función para limpiar caché del navegador y recargar página
async function forceClearCacheAndReload() {
    try {
        console.log('🔄 Limpiando caché del navegador y recargando...');

        // Limpiar caché local
        allReservations = [];
        reservasPorFecha = {};

        // Limpiar caché de Firebase
        if (db) {
            try {
                await db.clearPersistence();
            } catch (e) {
                console.log('No se pudo limpiar persistencia de Firestore:', e);
            }
        }

        // Limpiar caché del navegador si es posible
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
                console.log('🔄 Caché del navegador limpiado');
            } catch (e) {
                console.log('No se pudo limpiar caché del navegador:', e);
            }
        }

        // Recargar la página
        window.location.reload(true);

    } catch (error) {
        console.error('Error al limpiar caché:', error);
        // If it fails, at least reload the page
        window.location.reload(true);
    }
}

async function handleAddReservationFormSubmit(form) {
    console.log('🔧 [FORM] Iniciando envío de formulario de agregar reserva...');
    console.log('🔧 [FORM] currentUserRole:', currentUserRole);
    console.log('🔧 [FORM] isAuthenticated:', isAuthenticated);
    console.log('🔧 [FORM] localStorage adminPanelRole:', localStorage.getItem('adminPanelRole'));
    console.log('🔧 [FORM] localStorage adminPanelAuth:', localStorage.getItem('adminPanelAuth'));
    
    const messageArea = getEl('add-message-area');
    // Validar sesión antes de continuar
    if (!currentUserRole) {
        console.error('❌ [FORM] Error: No hay rol de usuario establecido');
        console.error('❌ [FORM] Intentando restaurar desde localStorage...');
        
        // Intentar restaurar desde localStorage
        const savedRole = localStorage.getItem('adminPanelRole');
        const savedAuth = localStorage.getItem('adminPanelAuth');
        
        if (savedRole && savedAuth === 'true') {
            currentUserRole = savedRole;
            isAuthenticated = true;
            console.log('✅ [FORM] Rol restaurado desde localStorage:', currentUserRole);
        } else {
            messageArea.innerHTML = '<p class="text-red-600 text-sm">Error de sesión: vuelve a iniciar sesión como administrador u observador antes de agregar una reserva.</p>';
            return;
        }
    }
    
    console.log('✅ [FORM] Rol de usuario válido, continuando...');
    const formData = new FormData(form);

    const name = formData.get('addName').trim();
    const countryCode = formData.get('addCountryCode');
    const phoneLocal = formData.get('addPhone').trim();
    const phone = `${countryCode}${phoneLocal}`;
    const date = formData.get('addDate');
    const time = formData.get('addTime');
    const diners = parseInt(formData.get('addDiners'), 10);
    const area = formData.get('addArea');
    const notes = formData.get('addNotes').trim();
    const seniaPagada = formData.get('addSeniaPagada');
    const montoSenia = formData.get('addMontoSenia');
    const metodoPago = formData.get('addMetodoPago');

    // Calcular turno automáticamente según la hora
    const turn = calcularTurnoPorHora(time);

    // Validaciones
    if (!name || !phone || !date || !time || diners < 1) {
        messageArea.innerHTML = '<p class="text-red-600 text-sm">Por favor, completa todos los campos requeridos.</p>';
        return;
    }

    // Validaciones específicas para seña pagada
    if (seniaPagada === 'si') {
        if (!montoSenia || parseInt(montoSenia) <= 0) {
            messageArea.innerHTML = '<p class="text-red-600 text-sm">Si se pagó la seña, debes especificar un monto válido.</p>';
            return;
        }
        if (!metodoPago) {
            messageArea.innerHTML = '<p class="text-red-600 text-sm">Si se pagó la seña, debes especificar el método de pago.</p>';
            return;
        }
    }

    const now = new Date();
    const reservationDateTime = new Date(`${date}T${time}`);
    if (reservationDateTime < now) {
        messageArea.innerHTML = '<p class="text-red-600 text-sm">No puedes reservar para una fecha u hora que ya ha pasado.</p>';
        return;
    }
    if (reservationDateTime.toDateString() === now.toDateString() && (reservationDateTime.getTime() - now.getTime()) / 60000 < 30) {
        messageArea.innerHTML = '<p class="text-red-600 text-sm">Debes reservar con al menos 30 minutos de anticipación.</p>';
        return;
    }

    try {
        // Determinar el estado de pago según si se pagó la seña
        let paymentStatus = 'manual';
        let depositAmount = null;
        let paymentMethod = null;

        if (seniaPagada === 'si') {
            paymentStatus = 'pagado-manual';
            depositAmount = parseInt(montoSenia) || 0;
            paymentMethod = metodoPago || '';
        }

        // Determinar quién creó la reserva
        const createdBy = currentUserRole === 'observer' ? 'observador' : 'admin';

        const newReservationData = {
            name,
            phone,
            date,
            time,
            turn,
            diners,
            area: area || '',
            notes: notes || '',
            paymentStatus: paymentStatus,
            status: paymentStatus,
            depositAmount: depositAmount,
            paymentMethod: paymentMethod,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: createdBy
        };

        // Agregar a Firestore
        const docRef = await addDoc(collection(db, "reservations"), newReservationData);

        // Actualizar el documento con el firestoreId (solo para admin)
        await updateDoc(docRef, {
            firestoreId: docRef.id,
            id: docRef.id // Usar el mismo ID largo para admin
        });

        // Enviar notificación de nueva reserva manual
        const notificationData = {
            ...newReservationData,
            id: docRef.id,
            notificationType: paymentStatus === 'pagado-manual' ? 'paid' : 'pending'
        };
        await sendNewReservationNotification(notificationData);

        messageArea.innerHTML = '<p class="text-green-600 text-sm">¡Reserva creada correctamente!</p>';

        // Limpiar formulario
        form.reset();

        // Ocultar campos de seña después de limpiar
        const seniaDetailsDiv = getEl('addSeniaDetails');
        if (seniaDetailsDiv) {
            seniaDetailsDiv.classList.add('hidden');
        }

        // Cerrar modal después de 2 segundos
        setTimeout(() => {
            const modal = getEl('add-reservation-modal');
            if (modal) {
                modal.classList.add('hidden');
            }
            messageArea.innerHTML = '';

            // Refrescar la lista de reservas
            const dateFilter = getEl('dateFilter');
            const periodSelector = getEl('periodSelector');
            if (dateFilter && dateFilter.value) {
                fetchAdminReservations(dateFilter.value, periodSelector ? periodSelector.value : 'daily');
            }
        }, 2000);

    } catch (error) {
        messageArea.innerHTML = '<p class="text-red-600 text-sm">Error al crear la reserva. Intenta de nuevo.</p>';
        console.error('❌ [ADD_RESERVATION] Error al crear reserva:', error);
    }
}

async function openAddReservationModal() {
    try {
        console.log('🔍 [DEBUG] Abriendo modal de agregar reserva...');
        console.log('🔍 [DEBUG] currentUserRole:', currentUserRole);
        console.log('🔍 [DEBUG] isAuthenticated:', isAuthenticated);
        
        const modal = getEl('add-reservation-modal');
        console.log('🔍 [DEBUG] Modal encontrado:', !!modal);
        
        if (modal) {
            modal.classList.remove('hidden');
            console.log('✅ [ADMIN_MODAL] Modal abierto correctamente');

            // Establecer fecha mínima (hoy)
            const dateInput = modal.querySelector('#addDate');
            if (dateInput) {
                // Usar fecha local para evitar problemas de zona horaria
                const now = new Date();
                const today = now.getFullYear() + '-' +
                    String(now.getMonth() + 1).padStart(2, '0') + '-' +
                    String(now.getDate()).padStart(2, '0');
                dateInput.min = today;
                dateInput.value = today;
                console.log('✅ [ADMIN_MODAL] Fecha mínima configurada:', today);
            }

            // Limpiar mensajes anteriores
            const messageArea = getEl('add-message-area');
            if (messageArea) {
                messageArea.innerHTML = '';
            }
        } else {
            console.error('❌ [ADMIN_MODAL] Modal no encontrado');
        }
    } catch (error) {
        console.error('❌ [ADMIN_MODAL] Error al abrir modal de agregar reserva:', error);
        alert('Error al abrir el formulario: ' + error.message);
    }
}

// Loader para la tabla de reservas
function showReservationsLoader() {
    const body = getEl('reservationsTableBody');
    const mobileDiv = getEl('reservasCardsMobile');
    if (body) {
        body.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-gray-400 animate-pulse">Cargando reservas...</td></tr>';
    }
    if (mobileDiv) {
        mobileDiv.innerHTML = '<div class="p-8 text-center text-gray-400 animate-pulse" style="min-height:200px;">Cargando reservas...</div>';
    }
}

// Variables de paginación - NOTE: Pagination is not fully implemented in the provided snippet
// These variables and functions are present but not fully utilized for fetching paginated data.
let pageSize = 10;
let lastVisible = null;
let firstVisible = null;
let currentPage = 1;
let totalPages = 1;
let pageCursors = [];
let currentQuery = null; // This might be for a different pagination approach
let currentPeriodType = 'daily'; // Keep track of the current period type
let currentDateString = ''; // Keep track of the current date string for period filters

// Manejar cambio de cantidad por página
const pageSizeSelector = document.getElementById('pageSizeSelector');
if (pageSizeSelector) {
    pageSizeSelector.addEventListener('change', () => {
        pageSize = parseInt(pageSizeSelector.value, 10);
        currentPage = 1;
        lastVisible = null; // Reset pagination
        firstVisible = null; // Reset pagination
        pageCursors = []; // Reset pagination
        fetchAdminReservations(currentDateString, currentPeriodType, true); // Re-fetch from start
    });
}

// Botones de paginación
function renderPaginationControls() {
    const controls = document.getElementById('paginationControls');
    if (!controls) return;
    controls.innerHTML = '';
    // Botón anterior
    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Anterior';
    prevBtn.className = 'px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => goToPage(currentPage - 1);
    controls.appendChild(prevBtn);
    // Info de página
    const info = document.createElement('span');
    info.textContent = `Página ${currentPage} de ${totalPages}`;
    info.className = 'mx-2 text-sm text-gray-600';
    controls.appendChild(info);
    // Botón siguiente
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Siguiente';
    nextBtn.className = 'px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => goToPage(currentPage + 1);
    controls.appendChild(nextBtn);
}

function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    // You would typically re-fetch data for the new page using startAfter/endBefore
    // For now, it simply re-fetches.
    fetchAdminReservations(currentDateString, currentPeriodType);
}


// Lógica para menú flotante de exportar todas
const exportBtn = getEl('export-excel-btn'); // Use getEl for consistency
const exportAllMenu = getEl('export-all-menu');
const exportAllBtn = getEl('export-all-btn');
let exportMenuTimeout = null;

if (exportBtn && exportAllMenu && exportAllBtn) {
    // Mostrar menú al hacer clic derecho
    exportBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showExportAllMenu(e);
    });
    // Mostrar menú al mantener presionado (móvil)
    exportBtn.addEventListener('touchstart', (e) => {
        exportMenuTimeout = setTimeout(() => showExportAllMenu(e), 500);
    });
    exportBtn.addEventListener('touchend', () => {
        clearTimeout(exportMenuTimeout);
    });
    // Ocultar menú al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!exportAllMenu.contains(e.target) && e.target !== exportBtn) {
            exportAllMenu.classList.add('hidden');
        }
    });
    // Exportar todas
    exportAllBtn.addEventListener('click', async () => {
        exportAllMenu.classList.add('hidden');
        await exportAllReservations();
    });
    // Exportar página actual (clic normal)
    exportBtn.addEventListener('click', async (e) => {
        if (e.detail === 0) return; // Ignorar si fue touchstart
        // Now exportToExcel is called without arguments to use getFilteredReservationsForExport
        exportToExcel();
    });
}

function showExportAllMenu(e) {
    exportAllMenu.classList.remove('hidden');
    const rect = exportBtn.getBoundingClientRect();
    exportAllMenu.style.top = `${rect.bottom + window.scrollY + 4}px`;
    exportAllMenu.style.left = `${rect.left + window.scrollX}px`;
}

// Exportar todas las reservas del rango/fecha seleccionada (original function)
async function exportAllReservations() {
    let queryConstraints = [];

    if (currentPeriodType === 'daily' && currentDateString) {
        queryConstraints.push(where('date', '==', currentDateString));
    } else if (currentPeriodType === 'weekly' && currentDateString) {
        const baseDate = new Date(currentDateString + 'T00:00:00');
        const startOfWeek = new Date(baseDate);
        startOfWeek.setDate(baseDate.getDate() - baseDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        const startDate = startOfWeek.toISOString().split('T')[0];
        const endDate = endOfWeek.toISOString().split('T')[0];
        queryConstraints.push(where('date', '>=', startDate));
        queryConstraints.push(where('date', '<=', endDate));
    } else if (currentPeriodType === 'monthly' && currentDateString) {
        const [year, month] = currentDateString.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${month}-${lastDay}`;
        queryConstraints.push(where('date', '>=', startDate));
        queryConstraints.push(where('date', '<=', endDate));
    } else if (currentPeriodType === 'yearly' && currentDateString) {
        const year = currentDateString.substring(0, 4);
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        queryConstraints.push(where('date', '>=', startDate));
        queryConstraints.push(where('date', '<=', endDate));
    } else if (currentPeriodType === 'custom') {
        const dateRangeStart = getEl('dateRangeStart');
        const dateRangeEnd = getEl('dateRangeEnd');
        if (dateRangeStart && dateRangeEnd && dateRangeStart.value && dateRangeEnd.value) {
            queryConstraints.push(where('date', '>=', dateRangeStart.value));
            queryConstraints.push(where('date', '<=', dateRangeEnd.value));
        } else {
            return;
        }
    } else {
        return;
    }

    queryConstraints.push(orderBy('time'));

    const q = query(collection(db, 'reservations'), ...queryConstraints);
    const snapshot = await getDocs(q);
    const reservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    exportToExcel(reservations); // Pass the full fetched list to exportToExcel
}

// Delegación de eventos para botones de forzar aprobación
document.addEventListener('click', async (e) => {
    const forceApproveBtn = e.target.closest('.force-approve-btn');
    if (forceApproveBtn) {
        const reservationId = forceApproveBtn.dataset.id;
        if (reservationId) {
            const ok = await forcePaymentStatusUpdate(reservationId);
            if (ok) {
                showSuccessModal('Reserva forzada como pagada y confirmada correctamente.');
            } else {
                showSuccessModal('La reserva no existe o ya fue cancelada. Se actualizará la lista.');
            }
            // Refrescar la lista de reservas
            const dateFilter = getEl('dateFilter');
            const periodSelector = getEl('periodSelector');
            if (dateFilter && dateFilter.value) {
                fetchAdminReservations(dateFilter.value, periodSelector ? periodSelector.value : 'daily');
            }
        }
    }
});

// ========== NOTIFICACIONES OPTIMIZADAS PARA MÓVIL (SAMSUNG GALAXY S23) ==========

/**
 * Envía notificación optimizada para móvil de nueva reserva
 */
async function sendNewReservationNotification(reservationData) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            const fecha = new Date(reservationData.date + 'T00:00:00').toLocaleDateString('es-AR');
            const montoSenia = reservationData.depositAmount || calcularMontoSenia(reservationData.diners) || 10000;
            let origen = 'Cliente';
            if (reservationData.createdBy === 'admin') origen = 'Admin';
            else if (reservationData.createdBy === 'observador') origen = 'Observador';
            else if (reservationData.createdBy === 'cliente') origen = 'Cliente';
            else if (reservationData.createdBy) origen = reservationData.createdBy;
            let title = `🆕 Nueva Reserva (${origen})`;
            let body = `${reservationData.name || 'Cliente'} - ${reservationData.diners}p - ${fecha} ${reservationData.time} - $${montoSenia.toLocaleString('es-AR')}`;
            if (reservationData.notificationType === 'pending') {
                title = `⏳ Reserva pendiente de pago (${origen})`;
                body = `${reservationData.name || 'Cliente'} - ${reservationData.diners}p - ${fecha} ${reservationData.time} - PENDIENTE DE PAGO`;
            } else if (reservationData.notificationType === 'modified') {
                title = `✏️ Reserva Modificada (${origen})`;
                body = `${reservationData.name || 'Cliente'} - ${reservationData.diners}p - ${fecha} ${reservationData.time} - MODIFICADA`;
            }
            const notification = new Notification(title, {
                body: body,
                icon: '/Logo/Logo-Los-Nogales.png',
                badge: '/Logo/favicon-32x32.png',
                tag: 'new-reservation-mobile',
                requireInteraction: true,
                vibrate: [200, 100, 200, 100, 200],
                silent: false, // Sonido activado para móvil
                data: {
                    url: window.location.href,
                    reservationId: reservationData.id,
                    type: 'new_reservation',
                    source: 'admin_mobile',
                    timestamp: Date.now().toString(),
                    priority: 'high'
                }
            });

            notification.onclick = function() {
                window.focus();
                notification.close();
                console.log('📱 [ADMIN_MOBILE] Nueva reserva clickeada:', notification.data.reservationId);
            };

            console.log('✅ [ADMIN_MOBILE] Notificación de nueva reserva enviada al móvil');
            return notification;
        } catch (error) {
            console.error('❌ [ADMIN_MOBILE] Error enviando notificación:', error);
        }
    } else {
        console.warn('⚠️ [ADMIN_MOBILE] Permisos de notificación no concedidos');
    }
}

/**
 * Envía notificación optimizada para móvil de pago confirmado
 */
async function sendPaymentConfirmedNotification(reservationData) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            const fecha = new Date(reservationData.date + 'T00:00:00').toLocaleDateString('es-AR');
            const montoSenia = reservationData.depositAmount || calcularMontoSenia(reservationData.diners) || 10000;
            let origen = 'Cliente';
            if (reservationData.createdBy === 'admin') origen = 'Admin';
            else if (reservationData.createdBy === 'observador') origen = 'Observador';
            else if (reservationData.createdBy === 'cliente') origen = 'Cliente';
            else if (reservationData.createdBy) origen = reservationData.createdBy;

            const notification = new Notification(`💰 Pago Confirmado (${origen})`, {
                body: `${reservationData.name || 'Cliente'} - ${reservationData.diners}p - ${fecha} ${reservationData.time} - $${montoSenia.toLocaleString('es-AR')} pagado`,
                icon: '/Logo/Logo-Los-Nogales.png',
                badge: '/Logo/favicon-32x32.png',
                tag: 'payment-confirmed-mobile',
                requireInteraction: false,
                vibrate: [100, 50, 100],
                silent: false,
                data: {
                    url: window.location.href,
                    reservationId: reservationData.id,
                    type: 'payment_confirmed',
                    source: 'admin_mobile',
                    timestamp: Date.now().toString(),
                    priority: 'normal'
                }
            });

            notification.onclick = function() {
                window.focus();
                notification.close();
            };

            console.log('✅ [ADMIN_MOBILE] Notificación de pago confirmado enviada al móvil');
            return notification;
        } catch (error) {
            console.error('❌ [ADMIN_MOBILE] Error enviando notificación de pago:', error);
        }
    }
}

/**
 * Envía notificación optimizada para móvil de recordatorio
 */
async function sendReminderNotification(reservationData, hoursBefore = 24) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            const fecha = new Date(reservationData.date + 'T00:00:00').toLocaleDateString('es-AR');
            const timeText = hoursBefore === 24 ? 'mañana' : 'en 2h';
            const emoji = hoursBefore === 24 ? '⏰' : '🚨';
            let origen = 'Cliente';
            if (reservationData.createdBy === 'admin') origen = 'Admin';
            else if (reservationData.createdBy === 'observador') origen = 'Observador';
            else if (reservationData.createdBy === 'cliente') origen = 'Cliente';
            else if (reservationData.createdBy) origen = reservationData.createdBy;

            const notification = new Notification(`${emoji} Recordatorio (${origen})`, {
                body: `${reservationData.name || 'Cliente'} - ${reservationData.diners}p - ${fecha} ${reservationData.time} - ${timeText}`,
                icon: '/Logo/Logo-Los-Nogales.png',
                badge: '/Logo/favicon-32x32.png',
                tag: 'reminder-mobile',
                requireInteraction: true,
                vibrate: [300, 100, 300],
                silent: false,
                data: {
                    url: window.location.href,
                    reservationId: reservationData.id,
                    type: 'reminder',
                    source: 'admin_mobile',
                    timestamp: Date.now().toString(),
                    priority: 'high'
                }
            });

            notification.onclick = function() {
                window.focus();
                notification.close();
            };

            console.log('✅ [ADMIN_MOBILE] Notificación de recordatorio enviada al móvil');
            return notification;
        } catch (error) {
            console.error('❌ [ADMIN_MOBILE] Error enviando notificación de recordatorio:', error);
        }
    }
}

/**
 * Envía notificación optimizada para móvil de cancelación
 */
async function sendCancellationNotification(reservationData) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            const fecha = new Date(reservationData.date + 'T00:00:00').toLocaleDateString('es-AR');
            let origen = 'Cliente';
            if (reservationData.createdBy === 'admin') origen = 'Admin';
            else if (reservationData.createdBy === 'observador') origen = 'Observador';
            else if (reservationData.createdBy === 'cliente') origen = 'Cliente';
            else if (reservationData.createdBy) origen = reservationData.createdBy;

            const notification = new Notification(`❌ Reserva Cancelada (${origen})`, {
                body: `${reservationData.name || 'Cliente'} - ${reservationData.diners}p - ${fecha} ${reservationData.time} - CANCELADA`,
                icon: '/Logo/Logo-Los-Nogales.png',
                badge: '/Logo/favicon-32x32.png',
                tag: 'cancellation-mobile',
                requireInteraction: false,
                vibrate: [500],
                silent: false,
                data: {
                    url: window.location.href,
                    reservationId: reservationData.id,
                    type: 'cancellation',
                    source: 'admin_mobile',
                    timestamp: Date.now().toString(),
                    priority: 'normal'
                }
            });

            notification.onclick = function() {
                window.focus();
                notification.close();
            };

            console.log('✅ [ADMIN_MOBILE] Notificación de cancelación enviada al móvil');
            return notification;
        } catch (error) {
            console.error('❌ [ADMIN_MOBILE] Error enviando notificación de cancelación:', error);
        }
    }
}

/**
 * Configuración específica para notificaciones en segundo plano en Samsung Galaxy
 */
function setupBackgroundNotifications() {
    // Verificar si es Samsung Galaxy
    if (isSamsungGalaxy()) {
        console.log('📱 [SAMSUNG] Configurando notificaciones en segundo plano');

        // Solicitar permisos de notificación persistente
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('✅ [SAMSUNG] Permisos de notificación concedidos para segundo plano');

                    // Configurar service worker para notificaciones en segundo plano
                    if ('serviceWorker' in navigator) {
                        navigator.serviceWorker.register('/sw.js').then(registration => {
                            console.log('✅ [SAMSUNG] Service Worker registrado para notificaciones en segundo plano');
                        }).catch(error => {
                            console.error('❌ [SAMSUNG] Error registrando Service Worker:', error);
                        });
                    }
                }
            });
        }

        // Configurar intervalos más frecuentes para Samsung
        setInterval(() => {
            if ('Notification' in window && Notification.permission === 'granted') {
                console.log('📱 [SAMSUNG] Verificando notificaciones en segundo plano...');
                // Aquí se ejecutarán las verificaciones de recordatorios
            }
        }, 15 * 60 * 1000); // Cada 15 minutos en Samsung
    }
}

// ========== SISTEMA DE FILTROS ==========

// Variable global para el filtro actual
let currentFilter = 'all';
let allReservations = []; // Reservas sin filtrar (global source of truth)


/**
 * Actualiza el título para mostrar el filtro activo
 */
function updateFilterTitle(filterType) {
    const titleElement = getEl('reservationsListTitle'); // Use getEl for consistency
    if (titleElement) {
        let filterText = '';
        switch (filterType) {
            case 'almuerzo':
                filterText = ' - Solo Almuerzos';
                break;
            case 'cena':
                filterText = ' - Solo Cenas';
                break;
            default:
                filterText = '';
        }

        titleElement.textContent = `Listado de Reservas${filterText}`;
    }
}

// ========== SISTEMA DE ASISTENCIAS POR TIEMPO ==========

/**
 * Estados de asistencia
 */
const ATTENDANCE_STATUS = {
    PENDING: 'pending',     // Pendiente (antes de la hora)
    PRESENT: 'present',     // Presente
    ABSENT: 'absent',       // Ausente
    CANCELLED: 'cancelled', // Cancelado
    LATE: 'late'            // Tardía (15+ minutos después de la hora)
};

/**
 * Colores para los estados de asistencia (para tarjetas completas)
 */
const ATTENDANCE_COLORS = {
    [ATTENDANCE_STATUS.PENDING]: 'border-green-200 bg-green-50',
    [ATTENDANCE_STATUS.PRESENT]: 'border-blue-200 bg-blue-50',
    [ATTENDANCE_STATUS.ABSENT]: 'border-red-200 bg-red-50',
    [ATTENDANCE_STATUS.CANCELLED]: 'border-gray-200 bg-gray-50',
    [ATTENDANCE_STATUS.LATE]: 'border-orange-200 bg-orange-50'
};

/**
 * Configuración del timer automático
 */
const TIMER_CONFIG = {
    LATE_MINUTES: 15, // Minutos después de la hora de reserva para marcar como tardía
    TURN_END_TIMES: {
        'almuerzo': '16:00', // El almuerzo termina a las 16:00
        'cena': '23:59'      // La cena termina a las 23:59
    }
};

/**
 * Inicializa el sistema de asistencias
 */
function initializeAttendanceSystem() {
    console.log('Inicializando sistema de asistencias...');

    // Configurar listeners para botones de asistencia
    setupAttendanceButtons(); // This needs to be called after UI render to attach events

    // Configurar listener de Firestore para cambios en tiempo real
    // Cleanup is now handled within setupFirestoreListener itself for better control
    setupFirestoreListener();

    // Solo iniciar timer automático si es admin
    const isAdmin = currentUserRole === 'admin' ||
        document.body.classList.contains('admin-mode') ||
        (typeof window.forceAdminRole === 'function' && window._forceAdminActive);

    if (isAdmin) {
        console.log('👑 Iniciando timer automático como admin...');
        startAutomaticTimer();
    } else {
        console.log('👁️ Timer automático desactivado para observador');
    }
}

/**
 * Verifica las asistencias basándose en la hora actual
 */
async function checkAttendanceByTime() {
    try {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM
        const currentDateFormatted = now.toISOString().split('T')[0]; // YYYY-MM-DD

        console.log(`Verificando asistencias para ${currentDateFormatted} a las ${currentTime}`);

        // Get reservations for the current day from the global cache if available
        const reservationsForToday = allReservations.filter(res => res.date === currentDateFormatted);

        if (!reservationsForToday || reservationsForToday.length === 0) {
            return;
        }

        // Filter reservations that should be present
        const reservationsToCheck = reservationsForToday.filter(res => {
            const reservationTime = res.time;
            const reservationDate = res.date;

            // Only check reservations for the current day
            if (reservationDate !== currentDateFormatted) {
                return false;
            }

            // Check if reservation time has passed (with 15 minutes tolerance)
            const reservationDateTime = new Date(`${reservationDate}T${reservationTime}:00`);
            const toleranceTime = new Date(reservationDateTime.getTime() + 15 * 60000); // +15 minutes

            return now >= toleranceTime && (!res.attendanceStatus || res.attendanceStatus === ATTENDANCE_STATUS.PENDING);
        });

        // Mark as absent reservations that are not present
        for (const reservation of reservationsToCheck) {
            await markAttendanceStatus(reservation.firestoreId || reservation.id, ATTENDANCE_STATUS.ABSENT, 'Sistema automático');
        }

        if (reservationsToCheck.length > 0) {
            console.log(`Marcadas ${reservationsToCheck.length} reservas como ausentes automáticamente`);
            // The Firestore listener will handle UI updates
        }

    } catch (error) {
        console.error('Error verificando asistencias:', error);
    }
}

/**
 * Obtiene el texto del estado de asistencia
 */
function getAttendanceStatusText(status) {
    // If no status, return empty string
    if (!status || status === '') {
        return '';
    }

    switch (status) {
        case ATTENDANCE_STATUS.PENDING:
            return 'Pendiente';
        case ATTENDANCE_STATUS.PRESENT:
            return 'Presente';
        case ATTENDANCE_STATUS.ABSENT:
            return 'Ausente';
        case ATTENDANCE_STATUS.CANCELLED:
            return 'Cancelado';
        case ATTENDANCE_STATUS.LATE:
            return 'Tardía';
        default:
            return 'Desconocido';
    }
}

/**
 * Obtiene el color del estado de asistencia
 */
function getAttendanceStatusColor(status) {
    // If no status or is null/undefined, do not apply color
    if (!status || status === '') {
        return '';
    }
    return ATTENDANCE_COLORS[status] || '';
}

/**
 * Muestra notificaciones de asistencia
 */
function showAttendanceNotification(message, type = 'info') {
    const notificationDiv = document.createElement('div');
    notificationDiv.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 transform translate-x-full`;

    let bgColor, textColor, icon;

    switch (type) {
        case 'success':
            bgColor = 'bg-green-500';
            textColor = 'text-white';
            icon = 'ph-check-circle';
            break;
        case 'warning':
            bgColor = 'bg-yellow-500';
            textColor = 'text-white';
            icon = 'ph-warning';
            break;
        case 'error':
            bgColor = 'bg-red-500';
            textColor = 'text-white';
            icon = 'ph-x-circle';
            break;
        default:
            bgColor = 'bg-blue-500';
            textColor = 'text-white';
            icon = 'ph-info';
    }

    notificationDiv.innerHTML = `
        <div class="flex items-center space-x-3">
            <i class="${icon} text-xl"></i>
            <span class="font-medium">${message}</span>
        </div>
    `;

    notificationDiv.classList.add(bgColor, textColor);

    document.body.appendChild(notificationDiv);

    // Animate entry
    setTimeout(() => {
        notificationDiv.classList.remove('translate-x-full');
    }, 100);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        notificationDiv.classList.add('translate-x-full');
        setTimeout(() => {
            if (notificationDiv.parentNode) {
                notificationDiv.parentNode.removeChild(notificationDiv);
            }
        }, 300);
    }, 3000);
}

/**
 * Genera los botones de asistencia para una reserva
 */
function generateAttendanceButtons(reservation) {
    const currentStatus = reservation.attendanceStatus || '';
    const reservationId = reservation.firestoreId || reservation.id;
    const isAdmin = currentUserRole === 'admin' || document.body.classList.contains('admin-mode') || (typeof window.forceAdminRole === 'function' && window._forceAdminActive);
    if (!isAdmin) {
        return `<div class="text-xs text-gray-500 mt-2 italic"><i class="ph ph-eye mr-1"></i>Solo visualización (Rol: ${currentUserRole || 'null'})</div>`;
    }
    const buttons = [];
    const createButton = (action, label, iconClass, activeStatus) => {
        const isActive = currentStatus === activeStatus ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200';
        let bgColorClass = 'bg-blue-100 text-blue-700';
        let hoverColorClass = 'hover:bg-blue-200';
        if (action === 'absent') { bgColorClass = 'bg-red-100 text-red-700'; hoverColorClass = 'hover:bg-red-200'; }
        else if (action === 'pending') { bgColorClass = 'bg-green-100 text-green-700'; hoverColorClass = 'hover:bg-green-200'; }
        else if (action === 'late') { bgColorClass = 'bg-orange-100 text-orange-700'; hoverColorClass = 'hover:bg-orange-200'; }
        return `
            <button data-reservation-id="${reservationId}" data-action="${action}"
                    class="attendance-btn px-3 py-1 rounded-full text-xs font-medium transition-colors ${currentStatus === activeStatus ? `${bgColorClass.replace('100','500').replace('700','white')} ${hoverColorClass}` : `${bgColorClass} ${hoverColorClass}`}">
                <i class="ph ${iconClass} mr-1"></i>${label}
            </button>
        `;
    };
    buttons.push(createButton('present', 'Presente', 'ph-check', 'present'));
    buttons.push(createButton('absent', 'Ausente', 'ph-x', 'absent'));
    buttons.push(createButton('pending', 'Pendiente', 'ph-clock', 'pending'));
    buttons.push(createButton('late', 'Tardía', 'ph-clock-countdown', 'late'));
    return buttons.join('');
}

// ========== FUNCIONES DE FILTROS ==========

// Variable global for current filter is already defined: let currentFilter = 'all';

/**
 * Actualiza los estilos de las tarjetas de filtro
 */
function updateFilterCardStyles(activeFilter) {
    // Remove active styles from all cards
    document.querySelectorAll('.filter-card').forEach(card => {
        card.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50');

        // Restore original colors
        if (card.dataset.filter === 'all') {
            card.classList.remove('bg-gray-200'); // Assuming this was active state
            card.classList.add('bg-gray-100');
        } else {
            card.classList.remove('bg-green-100'); // Assuming this was active state
            card.classList.add('bg-green-50');
        }
    });

    // Apply active style to the selected card
    const activeCard = document.querySelector(`[data-filter="${activeFilter}"]`);
    if (activeCard) {
        activeCard.classList.add('ring-2', 'ring-blue-500');

        if (activeFilter === 'all') {
            activeCard.classList.remove('bg-gray-100');
            activeCard.classList.add('bg-blue-50');
        } else {
            activeCard.classList.remove('bg-green-50');
            activeCard.classList.add('bg-blue-50');
        }
    }
    ensureFilterTitles(); // Ensure titles are always correct
}


/**
 * Filtra las reservas para exportar a Excel según el filtro actual
 */
function getFilteredReservationsForExport() {
    if (currentFilter === 'all') {
        return allReservations;
    } else {
        return allReservations.filter(reservation => {
            const turn = reservation.turn || calcularTurnoPorHora(reservation.time);
            return turn.toLowerCase() === currentFilter.toLowerCase();
        });
    }
}

// ========== FUNCIONES DE LIMPIEZA Y ESTADO ==========

/**
 * Limpia el estado del sistema
 */
function clearSystemState() {
    currentFilter = 'all';
    allReservations = []; // Reset global reservations
    reservasPorFecha = {}; // Clear date-based cache
    console.log('🧹 Estado del sistema limpiado');
}

/**
 * Limpia el listener de Firestore
 */
function cleanupFirestoreListener() {
    if (window._firestoreUnsubscribe) {
        window._firestoreUnsubscribe();
        window._firestoreUnsubscribe = null;
        console.log('🔇 Listener de Firestore limpiado');
    }
    if (window._adminReservationsUnsub) { // Also clean up _adminReservationsUnsub
        window._adminReservationsUnsub();
        window._adminReservationsUnsub = null;
        console.log('🔇 Listener de adminReservations limpiado');
    }
}

/**
 * Limpia todos los timers y listeners
 */
function cleanupAllTimers() {
    // Limpiar timer automático
    if (window._automaticTimer) {
        clearInterval(window._automaticTimer);
        window._automaticTimer = null;
        console.log('⏰ Timer automático limpiado');
    }

    // Limpiar listener de Firestore
    cleanupFirestoreListener();

    // Limpiar flags de actualización
    window._isUpdatingFromListener = false;

    // Clear individual reservation timers
    for (const id in window.reservationTimers) {
        clearTimeout(window.reservationTimers[id]);
    }
    window.reservationTimers = {};
    console.log('⏰ Timers individuales de reservas limpiados');


    console.log('🧹 Todos los timers y listeners limpiados');
}

/**
 * Reinicializa el sistema después de cambios
 */
function reinitializeSystem() {
    clearSystemState();

    // Limpiar todos los timers y listeners
    cleanupAllTimers();

    // Resetear estilos de filtros
    updateFilterCardStyles('all');

    // Limpiar título
    const titleElement = getEl('reservationsListTitle');
    if (titleElement) {
        titleElement.textContent = 'Listado de Reservas';
    }

    // Reconfigurar listener
    setupFirestoreListener(); // Re-establish the main listener

    console.log('🔄 Sistema reinicializado');
}

/**
 * Actualiza solo los totales sin refrescar toda la UI
 */
function updateTotalsOnly() {
    // This function will now be called by updateTotalsWithFiltered, so it's adjusted to just update the elements.
    // It should operate on the 'allReservations' global to show the complete daily totals
    // regardless of the current turn filter (lunch/dinner).
    let totalDinersDay = 0, totalDinersLunch = 0, totalDinersDinner = 0;

    allReservations.forEach(res => {
        const d = parseInt(res.diners) || 0;
        const turn = res.turn || calcularTurnoPorHora(res.time);
        totalDinersDay += d;
        if (turn.toLowerCase() === 'almuerzo') totalDinersLunch += d;
        else if (turn.toLowerCase() === 'cena') totalDinersDinner += d;
    });

    // Update only the numbers, keeping the titles
    updateDinerElement('totalDinersPeriod', totalDinersDay);
    updateDinerElement('totalDinersLunch', totalDinersLunch);
    updateDinerElement('totalDinersDinner', totalDinersDinner);

    // Update quick indicators that reflect all reservations for the day
    const totalReservas = allReservations.length;
    const totalConfirmadas = allReservations.filter(r => r.paymentStatus === 'approved' || r.paymentStatus === 'confirmed' || r.paymentStatus === 'pagado-manual').length;
    const totalPendientes = allReservations.filter(r => r.paymentStatus === 'pending').length;
    const totalManuales = allReservations.filter(r => r.paymentStatus === 'manual').length;

    getEl('totalReservas').textContent = totalReservas;
    getEl('totalConfirmadas').textContent = totalConfirmadas;
    getEl('totalPendientes').textContent = totalPendientes;
    getEl('totalManuales').textContent = totalManuales;
    getEl('totalComensales').textContent = totalDinersDay; // This should match totalDinersPeriod

    console.log(`📊 Totales actualizados: ${totalDinersDay} total, ${totalDinersLunch} almuerzos, ${totalDinersDinner} cenas`);
}


/**
 * Configura el listener de Firestore para cambios en tiempo real
 */
function setupFirestoreListener() {
    console.log('🔔 Configurando listener de Firestore para cambios en tiempo real...');

    // Use a simple listener by default to avoid index problems and manage overall data
    setupSimpleFirestoreListener();
}

/**
 * Configura un listener de Firestore más simple sin índices
 */
function setupSimpleFirestoreListener() {
    console.log('🔔 Configurando listener simple de Firestore...');

    // Check if there's already an active listener and clean it up
    cleanupFirestoreListener(); // Use the shared cleanup function

    try {
        // Simple listener for the entire collection (or focused by date if periodType is daily)
        const reservationsRef = collection(db, "reservations");
        let q;

        // Apply date constraint if a specific date is active
        if (currentPeriodType === 'daily' && currentDateString) {
             q = query(reservationsRef, where('date', '==', currentDateString));
        } else {
             // If not daily, get all or a broader range (you might need more complex querying here
             // based on your periodType, but for real-time updates across the board,
             // a less restrictive query might be desired, or multiple listeners for different date ranges)
             // For now, if not daily, it will default to a less filtered query.
             // For simplicity, we'll keep it focused on the current date for automatic updates,
             // and rely on fetchAdminReservations for broader manual selection.
             q = query(reservationsRef, where('date', '>=', getLocalDateString())); // Listen for today onwards by default
        }


        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log('🔄 Cambios detectados en Firestore (listener simple)');

            const fetchedReservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const filteredReservations = fetchedReservations.filter(res => res.name && res.date && res.time);
            filteredReservations.sort((a, b) => {
                const dateA = new Date(`${a.date}T${a.time}`);
                const dateB = new Date(`${b.date}T${b.time}`);
                return dateA - dateB;
            });

            // Update the global source of truth for all reservations for the current view.
            allReservations = [...filteredReservations];
            reservasPorFecha[currentDateString] = [...filteredReservations]; // Update cache for current date

            let hasRelevantChanges = false;
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' || change.type === 'modified' || change.type === 'removed') {
                    console.log(`📝 Cambio detectado: ${change.type} - ${change.doc.id}`);
                    hasRelevantChanges = true;
                }
            });

            if (hasRelevantChanges) {
                console.log('🔄 Actualizando UI por cambios en tiempo real...');

                // Check attendance if necessary
                checkAttendanceByTime();

                // Apply the current filter to the updated `allReservations`
                applyFilter(currentFilter); // This will re-render and update totals correctly

                // Reset the updating flag after a short delay
                setTimeout(() => {
                    window._isUpdatingFromListener = false;
                }, 100);
            }
        }, (error) => {
            console.error('❌ Error en listener simple de Firestore:', error);
            // If there's an error, unsubscribe to prevent continuous errors
            cleanupFirestoreListener();
        });

        // Store the unsubscribe function
        window._firestoreUnsubscribe = unsubscribe;
        console.log('✅ Listener simple de Firestore configurado');
    } catch (error) {
        console.error('❌ Error configurando listener de Firestore:', error);
    }
}

/**
 * Timer automático para gestionar reservas tardías y eliminación al final del turno
 */
async function startAutomaticTimer() {
    console.log('⏰ Iniciando timer automático para reservas...');

    // Verify admin role before starting
    const isAdmin = currentUserRole === 'admin' ||
        document.body.classList.contains('admin-mode') ||
        (typeof window.forceAdminRole === 'function' && window._forceAdminActive);

    if (!isAdmin) {
        console.log('🚫 Timer automático solo disponible para admin');
        return;
    }

    // Clear previous timer if it exists
    if (window._automaticTimer) {
        clearInterval(window._automaticTimer);
    }

    // Check every minute
    window._automaticTimer = setInterval(async () => {
        try {
            await checkLateReservations();
            await checkTurnEndReservations();
        } catch (error) {
            console.error('❌ Error en timer automático:', error);
        }
    }, 60000); // 1 minute

    // Check immediately on start
    try {
        await checkLateReservations();
        await checkTurnEndReservations();
    } catch (error) {
        console.error('❌ Error en verificación inicial del timer:', error);
    }
}

/**
 * Verifica reservas tardías (15+ minutos después de la hora)
 */
async function checkLateReservations() {
    try {
        const now = new Date();
        const currentDateFormatted = now.toISOString().split('T')[0];

        // Get reservations for the current day from the global cache (allReservations)
        const reservationsForToday = allReservations.filter(res => res.date === currentDateFormatted);

        if (!reservationsForToday || reservationsForToday.length === 0) return;

        const lateReservations = reservationsForToday.filter(res => {
            // Only check pending or unmarked reservations
            if (res.attendanceStatus && res.attendanceStatus !== ATTENDANCE_STATUS.PENDING) {
                return false;
            }

            // Check if time + 15 minutes has passed
            const reservationTime = res.time;
            const reservationDateTime = new Date(`${currentDateFormatted}T${reservationTime}:00`);
            const lateTime = new Date(reservationDateTime.getTime() + TIMER_CONFIG.LATE_MINUTES * 60000);

            return now >= lateTime;
        });

        // Mark as late
        for (const reservation of lateReservations) {
            await markReservationAsLate(reservation);
        }

        if (lateReservations.length > 0) {
            console.log(`⏰ Marcadas ${lateReservations.length} reservas como tardías`);
        }

    } catch (error) {
        console.error('Error verificando reservas tardías:', error);
    }
}

/**
 * Verifica reservas para eliminar al final del turno
 */
async function checkTurnEndReservations() {
    try {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM
        const currentDateFormatted = now.toISOString().split('T')[0];

        // Get reservations for the current day from the global cache (allReservations)
        const reservationsForToday = allReservations.filter(res => res.date === currentDateFormatted);

        if (!reservationsForToday || reservationsForToday.length === 0) return;

        const reservationsToDelete = reservationsForToday.filter(res => {
            // Only check late or absent reservations
            if (res.attendanceStatus !== ATTENDANCE_STATUS.LATE && res.attendanceStatus !== ATTENDANCE_STATUS.ABSENT) {
                return false;
            }

            // Check if the turn has ended
            const turn = res.turn || calcularTurnoPorHora(res.time);
            const turnEndTime = TIMER_CONFIG.TURN_END_TIMES[turn.toLowerCase()];

            if (!turnEndTime) return false;

            return currentTime >= turnEndTime;
        });

        // Delete reservations at the end of the turn
        for (const reservation of reservationsToDelete) {
            await deleteReservationAtTurnEnd(reservation);
        }

        if (reservationsToDelete.length > 0) {
            console.log(`🗑️ Eliminadas ${reservationsToDelete.length} reservas al final del turno`);
        }

    } catch (error) {
        console.error('Error verificando fin de turno:', error);
    }
}

/**
 * Marca una reserva como tardía
 */
async function markReservationAsLate(reservation) {
    try {
        const reservationRef = doc(db, "reservations", reservation.firestoreId || reservation.id);

        await updateDoc(reservationRef, {
            attendanceStatus: ATTENDANCE_STATUS.LATE,
            attendanceUpdatedAt: serverTimestamp(),
            attendanceUpdatedBy: 'Sistema automático - Tardía',
            markedLateAt: serverTimestamp()
        });

        console.log(`⏰ Reserva ${reservation.firestoreId} marcada como tardía`);

        // Send notification
        showAttendanceNotification(`Reserva de ${reservation.name} marcada como tardía`, 'warning');

    } catch (error) {
        console.error('Error marcando reserva como tardía:', error);
    }
}

/**
 * Elimina una reserva al final del turno
 */
async function deleteReservationAtTurnEnd(reservation) {
    try {
        const reservationRef = doc(db, "reservations", reservation.firestoreId || reservation.id);

        // Save to history before deleting
        const cancellationData = {
            reservationId: reservation.firestoreId || reservation.id,
            name: reservation.name || '',
            phone: reservation.phone || '',
            date: reservation.date || '',
            time: reservation.time || '',
            diners: reservation.diners || '',
            area: reservation.area || '',
            notes: reservation.notes || '',
            cancelledAt: new Date().toISOString(),
            cancelledBy: 'sistema',
            motivo: 'Eliminación automática al final del turno',
            attendanceStatus: reservation.attendanceStatus,
            turn: reservation.turn || calcularTurnoPorHora(reservation.time),
            // Save all extra fields
            ...reservation
        };

        // Save to history
        await setDoc(doc(db, "cancellations", (reservation.firestoreId || reservation.id) + '_turnend_' + Date.now()), cancellationData);

        // Delete the reservation
        await deleteDoc(reservationRef);

        console.log(`🗑️ Reserva ${reservation.firestoreId} eliminada al final del turno`);

        // Send notification
        showAttendanceNotification(`Reserva de ${reservation.name} eliminada al final del turno`, 'info');

    } catch (error) {
        console.error('Error eliminando reserva al final del turno:', error);
    }
}

// Utility to get local date string in YYYY-MM-DD format (Argentina timezone)
function getLocalDateString() {
    const now = new Date();
    // Adjust to Argentina timezone if needed, otherwise this is sufficient for local date
    const offset = now.getTimezoneOffset() * 60000; // minutes to milliseconds
    const localDateTime = new Date(now.getTime() - offset);
    return localDateTime.toISOString().slice(0, 10);
}

function getTomorrowLocalDateString() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localDateTime = new Date(now.getTime() - offset);
    localDateTime.setDate(localDateTime.getDate() + 1);
    return localDateTime.toISOString().slice(0, 10);
}

// Helper to calculate turn based on time (if not already present in reservation)
function calcularTurnoPorHora(time) {
    if (!time) return 'Desconocido';
    const [hours] = time.split(':').map(Number);
    if (hours >= 11 && hours < 16) { // Example: Lunch from 11:00 to 15:59
        return 'Almuerzo';
    } else if (hours >= 19 || hours < 1) { // Example: Dinner from 19:00 to 00:59 (next day)
        return 'Cena';
    }
    return 'Mixto'; // Or another default
}

// ========== TIMERS INDIVIDUALES POR RESERVA ==========
window.reservationTimers = {};

function setupReservationTimers(reservas) {
    // Clear previous timers
    for (const id in window.reservationTimers) {
        clearTimeout(window.reservationTimers[id]);
    }
    window.reservationTimers = {}; // Reset the object

    reservas.forEach(res => {
        // Only set timers for pending or null attendance status
        if (res.attendanceStatus === 'pending' || !res.attendanceStatus) {
            const reservationDateTime = new Date(`${res.date}T${res.time}:00`);
            const now = new Date();

            // Timer to mark as LATE (15 minutes after reservation time)
            const lateTime = new Date(reservationDateTime.getTime() + TIMER_CONFIG.LATE_MINUTES * 60000);
            const msToLate = lateTime - now;

            if (msToLate > 0) {
                window.reservationTimers[`late_${res.id}`] = setTimeout(() => {
                    // Only mark as late if still pending
                    if (!res.attendanceStatus || res.attendanceStatus === 'pending') {
                        markAttendanceStatus(res.id, 'late', 'Automático - Tardía');
                    }
                }, msToLate);
            }

            // Timer to mark as ABSENT/DELETE (at turn end)
            const turn = res.turn || calcularTurnoPorHora(res.time);
            const turnEndTimeStr = TIMER_CONFIG.TURN_END_TIMES[turn.toLowerCase()];
            if (turnEndTimeStr) {
                const turnEndTime = new Date(`${res.date}T${turnEndTimeStr}`);
                // If turn end time is before reservation time, it's for the next day, or an error.
                // Assuming turnEndTime is always after reservationTime on the same day.
                if (turnEndTime < reservationDateTime) {
                    turnEndTime.setDate(turnEndTime.getDate() + 1); // If turn ends next day (e.g., after midnight)
                }

                const msToTurnEnd = turnEndTime - now;

                if (msToTurnEnd > 0) {
                    window.reservationTimers[`turn_end_${res.id}`] = setTimeout(() => {
                        // Only delete if still pending, late, or absent (not manually present/cancelled)
                        if (res.attendanceStatus === 'pending' || res.attendanceStatus === 'late' || res.attendanceStatus === 'absent' || !res.attendanceStatus) {
                            deleteReservationAtTurnEnd(res);
                        }
                    }, msToTurnEnd);
                }
            }
        }
    });
    console.log(`⏰ Configurados ${Object.keys(window.reservationTimers).length} timers individuales.`);
}


// When manually marking attendance, cancel the specific timers for that reservation
// This needs to be added inside the markAttendanceStatus function or its calling context
// I've added a note to `markAttendanceStatus` for this.


// Reinforcement: ensure Total, Lunch, and Dinner filter titles are never cleared or re-rendered
function ensureFilterTitles() {
    // If filter titles are not present, restore them
    const totalDinersPeriod = getEl('totalDinersPeriod');
    if (totalDinersPeriod && !totalDinersPeriod.querySelector('h3')) {
        totalDinersPeriod.innerHTML = '<h3 class="font-bold text-gray-600">Total Comensales <span id="periodDisplay"></span></h3><p class="text-4xl font-extrabold text-gray-800">0</p>';
    }
    const totalLunchElement = getEl('totalDinersLunch');
    if (totalLunchElement && !totalLunchElement.querySelector('h3')) {
        totalLunchElement.innerHTML = '<h3 class="font-bold text-gray-600" id="lunchTurnTitle">Total Almuerzos</h3><p class="text-4xl font-extrabold text-gray-800">0</p>';
    }
    const totalDinnerElement = getEl('totalDinersDinner');
    if (totalDinnerElement && !totalDinnerElement.querySelector('h3')) {
        totalDinnerElement.innerHTML = '<h3 class="font-bold text-gray-600" id="dinnerTurnTitle">Total Cenas</h3><p class="text-4xl font-extrabold text-gray-800">0</p>';
    }

    // Also update period display based on current selection
    const periodSelector = getEl('periodSelector');
    const periodDisplay = getEl('periodDisplay');
    if (periodSelector && periodDisplay) {
        const periodTexts = {
            'daily': 'Hoy',
            'weekly': 'Esta semana',
            'monthly': 'Este mes',
            'yearly': 'Este año',
            'custom': 'Personalizado'
        };
        periodDisplay.textContent = periodTexts[periodSelector.value] || '';
    }
}

// Call ensureFilterTitles on page load and after UI updates
window.addEventListener('DOMContentLoaded', ensureFilterTitles);
// And also when applying filters
const originalUpdateFilterCardStyles = updateFilterCardStyles;
updateFilterCardStyles = function (activeFilter) {
    originalUpdateFilterCardStyles(activeFilter);
    ensureFilterTitles(); // Ensure titles are updated
};


// Function to clear UI without removing entire structure
function clearReservationsUI() {
    const body = getEl('reservationsTableBody');
    if (body) {
        body.innerHTML = ''; // Clear all rows
    }

    const mobileDiv = getEl('reservasCardsMobile');
    if (mobileDiv) {
        mobileDiv.innerHTML = ''; // Clear all cards
    }
}

// Source of truth: reservations by date
let reservasPorFecha = {}; // Cache for reservations per date

// Function to handle date change: saves reservations and applies current filter
function onDateChange(newDate, fetchedReservationsForDate) {
    currentDateString = newDate; // Update global current date string
    reservasPorFecha[currentDateString] = fetchedReservationsForDate; // Store the fetched reservations

    // Now, apply the current filter to this new set of reservations
    applyFilter(currentFilter); // This will re-render the UI and update totals based on the new data
}

// Apply filters without modifying the date or reloading from scratch
function applyFilter(filterType) {
    const reservationsToFilter = reservasPorFecha[currentDateString] || []; // Use the cached reservations for the current date

    const filteredReservations = (filterType.toLowerCase() === 'all')
        ? reservationsToFilter
        : reservationsToFilter.filter(res => {
            const turn = (res.turn || calcularTurnoPorHora(res.time) || '').toLowerCase();
            return turn === filterType.toLowerCase();
        });

    // Update UI and totals (updateAdminUI will also call updateTotalsWithFiltered indirectly)
    updateAdminUI(filteredReservations); // Pass the filtered list to updateAdminUI
    // updateTotalsWithFiltered(allReservations); // This is now done inside updateAdminUI and in fetchAdminReservations
    updateFilterCardStyles(filterType);
    updateFilterTitle(filterType);
    ensureFilterTitles(); // Ensure titles are always correct after filter changes

    currentFilter = filterType; // Save the current filter
}

// Update totals with the filtered data (this operates on the *displayed* list if needed, but overall totals should use allReservations)
function updateTotalsWithFiltered(reservations) {
    let dinersDay = 0, dinersLunch = 0, dinersDinner = 0;
    reservations.forEach(res => {
        const diners = parseInt(res.diners) || 0;
        const turn = (res.turn || calcularTurnoPorHora(res.time) || '').toLowerCase();
        dinersDay += diners;
        if (turn === 'almuerzo') dinersLunch += diners;
        else if (turn === 'cena') dinersDinner += diners;
    });
    updateDinerElement('totalDinersPeriod', dinersDay);
    updateDinerElement('totalDinersLunch', dinersLunch);
    updateDinerElement('totalDinersDinner', dinersDinner);
}

// Reusable to update totals
function updateDinerElement(elementId, value) {
    const el = getEl(elementId);
    if (el) {
        const p = el.querySelector('p');
        if (p) p.textContent = value;
    }
}

// Define setupAddReservationButton if it doesn't exist
function setupAddReservationButton() {
    console.log('🔧 [SETUP] Configurando botón de agregar reserva...');
    
    const addReservationButton = document.getElementById('add-reservation-button');
    console.log('🔧 [SETUP] Botón encontrado:', !!addReservationButton);
    
    if (addReservationButton) {
        addReservationButton.addEventListener('click', () => {
            console.log('🔧 [SETUP] Botón de agregar reserva clickeado');
            openAddReservationModal();
        });
        console.log('✅ [SETUP] Event listener agregado al botón de agregar reserva');
    } else {
        console.error('❌ [SETUP] Botón de agregar reserva no encontrado');
    }
    
    // Modal close
    const closeAddReservationModalBtn = document.getElementById('closeAddReservationModal');
    if (closeAddReservationModalBtn) {
        closeAddReservationModalBtn.addEventListener('click', () => {
            document.getElementById('add-reservation-modal').classList.add('hidden');
        });
        console.log('✅ [SETUP] Botón de cerrar modal configurado');
    }
    
    // Form submit
    const addReservationForm = document.getElementById('add-reservation-form');
    if (addReservationForm) {
        addReservationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('🔧 [SETUP] Formulario de agregar reserva enviado');
            await handleAddReservationFormSubmit(addReservationForm);
        });
        console.log('✅ [SETUP] Event listener del formulario configurado');
    } else {
        console.error('❌ [SETUP] Formulario de agregar reserva no encontrado');
    }
}

// Function to validate reservation time (if this is defined elsewhere, ensure it's accessible)
// Placeholder for validateReservationTime (assuming it exists in cliente.js or another linked file)
// If it's not defined, you'll need to implement it or remove its usage.
async function validateReservationTime(date, time, source, errorElement) {
    // This is a placeholder. You'll need to implement the actual logic
    // based on your business rules for opening hours, capacity, etc.
    // For now, it will always return true.
    console.log(`Validating time: ${date} ${time}`);
    return true;
}

// Expose validateReservationTime globally if needed by other modules (e.g., modals)
window.validateReservationTime = validateReservationTime;


// setupAddReservationButton is already called in initializeAdminPanel()
// window.addEventListener('DOMContentLoaded', setupAddReservationButton);

// Re-evaluate if `setupReservationTimers` should be called here.
// It's already called within `fetchAdminReservations` after data is loaded.
// Calling it here again would clear timers and set new ones for potentially outdated data.
// So, the commented out call is correct.
// setupReservationTimers(allReservations); // NO, this will be handled by fetchAdminReservations

function setupTurnFilters() {
    document.addEventListener('click', (e) => {
        if (e.target.closest('.filter-card')) {
            const filterCard = e.target.closest('.filter-card');
            const filterType = filterCard.dataset.filter;
            if (filterType) {
                applyFilter(filterType);
            }
        }
    });
}

// Refuerzo: Listener global para los botones de asistencia SIEMPRE activo y con logs
function setupAttendanceButtons() {
    // Evita múltiples listeners duplicados
    if (window._attendanceListenerActive) return;
    window._attendanceListenerActive = true;
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.attendance-btn');
        if (!btn) return;
        const reservationId = btn.dataset.reservationId;
        const action = btn.dataset.action;
        console.log('[ASISTENCIA] Botón clickeado:', { reservationId, action });
        if (reservationId && action) {
            await markAttendanceStatus(reservationId, action, 'Admin');
        }
    });
}

// Refuerzo: markAttendanceStatus con logs
async function markAttendanceStatus(reservationId, status, reason = 'Admin') {
    console.log('[ASISTENCIA] markAttendanceStatus llamado:', { reservationId, status, reason });
    const isAdmin = currentUserRole === 'admin' || document.body.classList.contains('admin-mode') || (typeof window.forceAdminRole === 'function' && window._forceAdminActive);
    if (!isAdmin) {
        console.error('[ASISTENCIA] Intento de modificar asistencia por usuario no autorizado:', currentUserRole);
        showAttendanceNotification('Solo un administrador puede marcar asistencia.', 'error');
        return false;
    }
    try {
        const reservationRef = doc(db, "reservations", reservationId);
        const reservationDoc = await getDoc(reservationRef);
        if (!reservationDoc.exists()) {
             console.warn(`[ASISTENCIA] Reserva ${reservationId} no encontrada en la colección principal.`);
             showAttendanceNotification(`Reserva ${reservationId} no encontrada, ya pudo haber sido eliminada.`, 'warning');
             return false;
        }
        const currentReservationData = reservationDoc.data();
        const updateData = {
            attendanceStatus: status,
            attendanceUpdatedAt: serverTimestamp(),
            attendanceUpdatedBy: reason
        };
        if (status === 'absent') {
            const cancellationData = {
                reservationId: reservationId,
                name: currentReservationData.name || '', phone: currentReservationData.phone || '',
                date: currentReservationData.date || '', time: currentReservationData.time || '',
                diners: currentReservationData.diners || '', area: currentReservationData.area || '',
                notes: currentReservationData.notes || '', cancelledAt: new Date().toISOString(),
                cancelledBy: reason, motivo: 'Ausente - Sistema de Asistencias',
                attendanceStatus: 'absent', ...currentReservationData
            };
            await setDoc(doc(db, "cancellations", reservationId + '_absent_' + Date.now()), cancellationData);
            await deleteDoc(reservationRef);
            console.log(`[ASISTENCIA] Reserva ${reservationId} eliminada automáticamente por ausencia.`);
        } else {
            await updateDoc(reservationRef, updateData);
            console.log(`[ASISTENCIA] Reserva ${reservationId} marcada como ${status} por ${reason}`);
        }
        if (window.reservationTimers[`late_${reservationId}`]) {
            clearTimeout(window.reservationTimers[`late_${reservationId}`]);
            delete window.reservationTimers[`late_${reservationId}`];
        }
        if (window.reservationTimers[`turn_end_${reservationId}`]) {
            clearTimeout(window.reservationTimers[`turn_end_${reservationId}`]);
            delete window.reservationTimers[`turn_end_${reservationId}`];
        }
        showAttendanceNotification(`Asistencia marcada como ${status}`, 'success');
        return true;
    } catch (error) {
        console.error('[ASISTENCIA] Error marcando estado de asistencia:', error);
        showAttendanceNotification('Error al marcar asistencia. Consulta la consola.', 'error');
        return false;
    }
}

// Refuerzo: Asegura que initializeAttendanceSystem se llame en la inicialización principal (ya está en initializeAdminPanel)
// ... existing code ...