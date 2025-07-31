// Configuración de Firebase para el Sistema de Fidelización Los Nogales
const firebaseConfig = {
    apiKey: "AIzaSyBS_eGNLqUH8SshfrnBaUvRTcjJKy5tFiI",
    authDomain: "losnogales-reservas.firebaseapp.com",
    projectId: "losnogales-reservas",
    storageBucket: "losnogales-reservas.firebasestorage.app",
    messagingSenderId: "707614707617",
    appId: "1:707614707617:web:57ef12cf519d99ff8585e0",
    measurementId: "G-MBGF0QWF7K"
};

// Inicializar Firebase
try {
    firebase.initializeApp(firebaseConfig);
} catch (error) {
    if (error.code !== 'app/duplicate-app') {
        console.error('Error inicializando Firebase:', error);
    }
}

const auth = firebase.auth();
const db = firebase.firestore();

// Configuración de Firestore
const settings = {
    timestampsInSnapshots: true
};
db.settings(settings);

// Variables globales
let currentUser = null;
let userPoints = 0;
let userData = null;

// ===== FUNCIONES DE AUTENTICACIÓN =====

// Registrar nuevo usuario
async function registerUser(email, password, name, phone) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Enviar email de verificación
        await user.sendEmailVerification();
        
        // Crear documento de usuario en Firestore
        await db.collection('users').doc(user.uid).set({
            email: email,
            name: name,
            phone: phone,
            points: 0,
            totalPointsEarned: 0,
            totalPointsRedeemed: 0,
            memberSince: new Date(),
            lastVisit: null,
            isEmailVerified: false,
            referralCode: generateReferralCode(),
            referredBy: null,
            dailyVisitClaimed: false,
            lastDailyVisit: null
        });
        
        return { success: true, message: 'Usuario registrado exitosamente. Por favor verifica tu email (revisa también la carpeta de spam).' };
    } catch (error) {
        console.error('Error en registerUser:', error);
        return { success: false, message: getErrorMessage(error.code) };
    }
}

// Iniciar sesión
async function loginUser(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        if (!user.emailVerified) {
            await auth.signOut();
            return { success: false, message: 'Por favor verifica tu email antes de iniciar sesión.' };
        }
        
        const userData = await loadUserData(user.uid);
        
        return { success: true, message: 'Inicio de sesión exitoso.' };
    } catch (error) {
        console.error('❌ Error en loginUser:', error);
        return { success: false, message: getErrorMessage(error.code) };
    }
}

// Cerrar sesión
async function logoutUser() {
    try {
        await auth.signOut();
        currentUser = null;
        userPoints = 0;
        userData = null;
        return { success: true, message: 'Sesión cerrada exitosamente.' };
    } catch (error) {
        return { success: false, message: 'Error al cerrar sesión.' };
    }
}

// Recuperar contraseña
async function resetPassword(email) {
    try {
        await auth.sendPasswordResetEmail(email);
        return { success: true, message: 'Email de recuperación enviado.' };
    } catch (error) {
        return { success: false, message: getErrorMessage(error.code) };
    }
}

// ===== FUNCIONES DE PUNTOS =====

// Cargar datos del usuario
async function loadUserData(userId) {
    try {
        const doc = await db.collection('users').doc(userId).get();
        if (doc.exists) {
            userData = doc.data();
            userPoints = userData.points || 0;
            currentUser = userId;
            
            // Asegurar que los campos existan
            if (!userData.totalPointsEarned) userData.totalPointsEarned = 0;
            if (!userData.totalPointsRedeemed) userData.totalPointsRedeemed = 0;
            if (!userData.dailyVisitClaimed) userData.dailyVisitClaimed = false;
            
            return userData;
        } else {
            return null;
        }
    } catch (error) {
        console.error('❌ Error cargando datos del usuario:', error);
        return null;
    }
}

// Verificar si puede reclamar visita diaria
function canClaimDailyVisit() {
    if (!userData) return false;
    
    const today = new Date().toDateString();
    const lastVisit = userData.lastDailyVisit ? new Date(userData.lastDailyVisit.toDate()).toDateString() : null;
    
    // Si es un nuevo día, resetear el estado de dailyVisitClaimed
    if (lastVisit !== today) {
        userData.dailyVisitClaimed = false;
    }
    
    return !userData.dailyVisitClaimed;
}

// Reclamar puntos por visita diaria
async function claimDailyVisit() {
    if (!currentUser) {
        return { success: false, message: 'Debes iniciar sesión para reclamar puntos.' };
    }
    
    if (!canClaimDailyVisit()) {
        return { success: false, message: 'Ya reclamaste los puntos de hoy o no puedes reclamar.' };
    }
    
    try {
        const pointsToAdd = 10;
        const newPoints = userPoints + pointsToAdd;
        const today = new Date();
        
        await db.collection('users').doc(currentUser).update({
            points: newPoints,
            totalPointsEarned: (userData.totalPointsEarned || 0) + pointsToAdd,
            dailyVisitClaimed: true,
            lastDailyVisit: today
        });
        
        // Registrar transacción
        await addPointTransaction('Visita diaria', pointsToAdd, 'earned');
        
        userPoints = newPoints;
        userData.points = newPoints;
        userData.totalPointsEarned = (userData.totalPointsEarned || 0) + pointsToAdd;
        userData.dailyVisitClaimed = true;
        userData.lastDailyVisit = today;
        
        return { success: true, message: `¡+${pointsToAdd} puntos por tu visita!`, points: newPoints };
    } catch (error) {
        return { success: false, message: 'Error al reclamar puntos.' };
    }
}

// Agregar puntos por reserva online
async function addReservationPoints() {
    if (!currentUser) return { success: false, message: 'Debes iniciar sesión.' };
    
    try {
        const pointsToAdd = 5;
        const newPoints = userPoints + pointsToAdd;
        
        await db.collection('users').doc(currentUser).update({
            points: newPoints,
            totalPointsEarned: userData.totalPointsEarned + pointsToAdd
        });
        
        await addPointTransaction('Reserva online', pointsToAdd, 'earned');
        
        userPoints = newPoints;
        userData.points = newPoints;
        userData.totalPointsEarned += pointsToAdd;
        
        return { success: true, message: `¡+${pointsToAdd} puntos por tu reserva!`, points: newPoints };
    } catch (error) {
        return { success: false, message: 'Error al agregar puntos.' };
    }
}

// Agregar puntos por referido
async function addReferralPoints(referrerId) {
    if (!currentUser) return { success: false, message: 'Debes iniciar sesión.' };
    
    try {
        const pointsToAdd = 20;
        const newPoints = userPoints + pointsToAdd;
        
        await db.collection('users').doc(currentUser).update({
            points: newPoints,
            totalPointsEarned: userData.totalPointsEarned + pointsToAdd,
            referredBy: referrerId
        });
        
        // También dar puntos al referidor
        const referrerDoc = await db.collection('users').doc(referrerId).get();
        if (referrerDoc.exists) {
            const referrerData = referrerDoc.data();
            await db.collection('users').doc(referrerId).update({
                points: referrerData.points + pointsToAdd,
                totalPointsEarned: referrerData.totalPointsEarned + pointsToAdd
            });
            
            await addPointTransaction('Referido', pointsToAdd, 'earned', referrerId);
        }
        
        await addPointTransaction('Referido', pointsToAdd, 'earned');
        
        userPoints = newPoints;
        userData.points = newPoints;
        userData.totalPointsEarned += pointsToAdd;
        userData.referredBy = referrerId;
        
        return { success: true, message: `¡+${pointsToAdd} puntos por referido!`, points: newPoints };
    } catch (error) {
        return { success: false, message: 'Error al agregar puntos de referido.' };
    }
}

// Agregar puntos por reseña en Google
async function addGoogleReviewPoints() {
    if (!currentUser) return { success: false, message: 'Debes iniciar sesión.' };
    
    try {
        const pointsToAdd = 20;
        const newPoints = userPoints + pointsToAdd;
        
        await db.collection('users').doc(currentUser).update({
            points: newPoints,
            totalPointsEarned: userData.totalPointsEarned + pointsToAdd
        });
        
        await addPointTransaction('Reseña en Google', pointsToAdd, 'earned');
        
        userPoints = newPoints;
        userData.points = newPoints;
        userData.totalPointsEarned += pointsToAdd;
        
        return { success: true, message: `¡+${pointsToAdd} puntos por tu reseña!`, points: newPoints };
    } catch (error) {
        return { success: false, message: 'Error al agregar puntos.' };
    }
}

// Agregar puntos por post en Instagram
async function addInstagramPostPoints() {
    if (!currentUser) return { success: false, message: 'Debes iniciar sesión.' };
    
    try {
        const pointsToAdd = 15;
        const newPoints = userPoints + pointsToAdd;
        
        await db.collection('users').doc(currentUser).update({
            points: newPoints,
            totalPointsEarned: (userData.totalPointsEarned || 0) + pointsToAdd
        });
        
        await addPointTransaction('Post en Instagram', pointsToAdd, 'earned');
        
        userPoints = newPoints;
        userData.points = newPoints;
        userData.totalPointsEarned = (userData.totalPointsEarned || 0) + pointsToAdd;
        
        return { success: true, message: `¡+${pointsToAdd} puntos por tu post!`, points: newPoints };
    } catch (error) {
        return { success: false, message: 'Error al agregar puntos.' };
    }
}

// Agregar puntos por completar encuesta (equivalente a reseña)
async function addSurveyPoints() {
    if (!currentUser) {
        return { success: false, message: 'Debes iniciar sesión.' };
    }
    
    if (!userData) {
        return { success: false, message: 'Error al cargar datos del usuario.' };
    }
    
    // Verificar si ya reclamó puntos por encuesta hoy
    const today = new Date().toDateString();
    let lastSurvey = null;
    
    if (userData.lastSurvey) {
        // Verificar si es un Timestamp de Firestore o una fecha normal
        if (userData.lastSurvey.toDate && typeof userData.lastSurvey.toDate === 'function') {
            lastSurvey = new Date(userData.lastSurvey.toDate()).toDateString();
        } else if (userData.lastSurvey instanceof Date) {
            lastSurvey = userData.lastSurvey.toDateString();
        } else {
            // Si es un string o timestamp, convertirlo a Date
            lastSurvey = new Date(userData.lastSurvey).toDateString();
        }
    }
    
    if (lastSurvey === today) {
        return { success: false, message: 'Ya reclamaste puntos por encuesta hoy.' };
    }
    
    try {
        const pointsToAdd = 20;
        const newPoints = userPoints + pointsToAdd;
        
        await db.collection('users').doc(currentUser).update({
            points: newPoints,
            totalPointsEarned: (userData.totalPointsEarned || 0) + pointsToAdd,
            lastSurvey: new Date()
        });
        
        // Registrar transacción
        await addPointTransaction('Encuesta de satisfacción', pointsToAdd, 'earned');
        
        userPoints = newPoints;
        userData.points = newPoints;
        userData.totalPointsEarned = (userData.totalPointsEarned || 0) + pointsToAdd;
        userData.lastSurvey = new Date();
        
        return { success: true, message: `¡+${pointsToAdd} puntos por completar la encuesta!`, points: newPoints };
    } catch (error) {
        console.error('Error agregando puntos por encuesta:', error);
        return { success: false, message: 'Error al agregar puntos.' };
    }
}

// ===== FUNCIONES DE PREMIOS =====

// Obtener premios disponibles
async function getAvailableRewards() {
    try {
        const rewards = [
            { id: 'soda', name: 'Gaseosa o postre gratis', points: 50, description: 'Disfruta de una gaseosa o postre de la casa' },
            { id: 'entrada', name: 'Entrada o empanada gratis', points: 100, description: 'Entrada o empanada de tu elección' },
            { id: 'descuento', name: '10% descuento en mesa', points: 200, description: '10% de descuento en tu cuenta total' },
            { id: 'vino', name: 'Vino regional o parrillada para 1', points: 300, description: 'Vino regional o parrillada individual' },
            { id: 'parrillada', name: 'Parrillada libre completa para 2', points: 500, description: 'Parrillada libre completa para 2 personas' }
        ];
        return rewards;
    } catch (error) {
        console.error('Error obteniendo premios:', error);
        return [];
    }
}

// Canjear premio
async function redeemReward(rewardId, rewardName, pointsCost) {
    if (!currentUser) return { success: false, message: 'Debes iniciar sesión.' };
    
    if (userPoints < pointsCost) {
        return { success: false, message: 'No tienes suficientes puntos para este premio.' };
    }
    
    try {
        const newPoints = userPoints - pointsCost;
        
        await db.collection('users').doc(currentUser).update({
            points: newPoints,
            totalPointsRedeemed: userData.totalPointsRedeemed + pointsCost
        });
        
        // Registrar canje
        await db.collection('redemptions').add({
            userId: currentUser,
            userEmail: userData.email,
            userName: userData.name,
            rewardId: rewardId,
            rewardName: rewardName,
            pointsCost: pointsCost,
            redeemedAt: new Date(),
            status: 'pending',
            validatedBy: null,
            validatedAt: null
        });
        
        await addPointTransaction(rewardName, -pointsCost, 'redeemed');
        
        userPoints = newPoints;
        userData.points = newPoints;
        userData.totalPointsRedeemed += pointsCost;
        
        return { success: true, message: `¡Premio canjeado exitosamente!`, points: newPoints };
    } catch (error) {
        return { success: false, message: 'Error al canjear premio.' };
    }
}

// ===== FUNCIONES DE TRANSACCIONES =====

// Agregar transacción de puntos
async function addPointTransaction(description, points, type, userId = null) {
    try {
        const targetUserId = userId || currentUser;
        const userDoc = await db.collection('users').doc(targetUserId).get();
        const userData = userDoc.data();
        
        await db.collection('pointTransactions').add({
            userId: targetUserId,
            userEmail: userData.email,
            userName: userData.name,
            description: description,
            points: points,
            type: type, // 'earned' o 'redeemed'
            timestamp: new Date(),
            balanceAfter: userData.points + points
        });
    } catch (error) {
        console.error('Error agregando transacción:', error);
    }
}

// Obtener historial de transacciones
    async function getTransactionHistory(userId = null) {
        try {
            const targetUserId = userId || currentUser;
            if (!targetUserId) {
                return [];
            }
            
            // Consulta simplificada sin orderBy para evitar necesidad de índices
            const query = await db.collection('pointTransactions')
                .where('userId', '==', targetUserId)
                .limit(20)
                .get();
            
            const transactions = query.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
                };
            });
            
            // Ordenar en JavaScript en lugar de en Firestore
            transactions.sort((a, b) => b.timestamp - a.timestamp);
            
            return transactions;
        } catch (error) {
            console.error('Error obteniendo historial:', error);
            return [];
        }
    }

// ===== FUNCIONES DE ADMINISTRACIÓN =====

// Verificar si el usuario es administrador
async function isAdmin(userId) {
    try {
        const doc = await db.collection('admins').doc(userId).get();
        return doc.exists;
    } catch (error) {
        return false;
    }
}

// Obtener todos los usuarios (solo admin)
async function getAllUsers() {
    try {
        // Consulta simplificada sin orderBy para evitar necesidad de índices
        const query = await db.collection('users').get();
        const users = query.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            memberSince: doc.data().memberSince ? doc.data().memberSince.toDate() : new Date()
        }));
        
        // Ordenar en JavaScript en lugar de en Firestore
        users.sort((a, b) => b.memberSince - a.memberSince);
        
        return users;
    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        return [];
    }
}

// Modificar puntos de usuario (solo admin)
async function modifyUserPoints(userId, points, reason) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return { success: false, message: 'Usuario no encontrado.' };
        }
        
        const userData = userDoc.data();
        const newPoints = userData.points + points;
        
        await db.collection('users').doc(userId).update({
            points: newPoints,
            totalPointsEarned: userData.totalPointsEarned + (points > 0 ? points : 0)
        });
        
        await addPointTransaction(`Ajuste manual: ${reason}`, points, points > 0 ? 'earned' : 'redeemed', userId);
        
        return { success: true, message: `Puntos modificados exitosamente.`, newPoints: newPoints };
    } catch (error) {
        return { success: false, message: 'Error modificando puntos.' };
    }
}

// Obtener canjes pendientes (solo admin)
async function getPendingRedemptions() {
    try {
        // Consulta simplificada sin orderBy para evitar necesidad de índices
        const query = await db.collection('redemptions')
            .where('status', '==', 'pending')
            .get();
        
        const redemptions = query.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            redeemedAt: doc.data().redeemedAt ? doc.data().redeemedAt.toDate() : new Date()
        }));
        
        // Ordenar en JavaScript en lugar de en Firestore
        redemptions.sort((a, b) => b.redeemedAt - a.redeemedAt);
        
        return redemptions;
    } catch (error) {
        console.error('Error obteniendo canjes:', error);
        return [];
    }
}

// Validar canje (solo admin)
async function validateRedemption(redemptionId, adminId) {
    try {
        await db.collection('redemptions').doc(redemptionId).update({
            status: 'validated',
            validatedBy: adminId,
            validatedAt: new Date()
        });
        
        return { success: true, message: 'Canje validado exitosamente.' };
    } catch (error) {
        return { success: false, message: 'Error validando canje.' };
    }
}

// Obtener estadísticas del programa (solo admin)
async function getProgramStats() {
    try {
        const usersQuery = await db.collection('users').get();
        const redemptionsQuery = await db.collection('redemptions').get();
        
        const totalUsers = usersQuery.size;
        const totalRedemptions = redemptionsQuery.size;
        let totalPointsEarned = 0;
        let totalPointsRedeemed = 0;
        
        usersQuery.docs.forEach(doc => {
            const data = doc.data();
            totalPointsEarned += data.totalPointsEarned || 0;
            totalPointsRedeemed += data.totalPointsRedeemed || 0;
        });
        
        return {
            totalUsers,
            totalPointsEarned,
            totalPointsRedeemed,
            totalRedemptions,
            activePoints: totalPointsEarned - totalPointsRedeemed
        };
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        return null;
    }
}

// ===== FUNCIONES AUXILIARES =====

// Generar código de referido
function generateReferralCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Obtener mensaje de error de Firebase
function getErrorMessage(errorCode) {
    const errorMessages = {
        'auth/user-not-found': 'Usuario no encontrado.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/email-already-in-use': 'Este email ya está registrado.',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
        'auth/invalid-email': 'Email inválido.',
        'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
        'auth/network-request-failed': 'Error de conexión. Verifica tu internet.',
        'auth/operation-not-allowed': 'Operación no permitida. Contacta al administrador.',
        'auth/invalid-credential': 'Credenciales inválidas.',
        'auth/user-disabled': 'Usuario deshabilitado.',
        'auth/account-exists-with-different-credential': 'Ya existe una cuenta con este email.',
        'auth/requires-recent-login': 'Se requiere un login reciente para esta operación.',
        'auth/invalid-verification-code': 'Código de verificación inválido.',
        'auth/invalid-verification-id': 'ID de verificación inválido.',
        'auth/missing-verification-code': 'Código de verificación faltante.',
        'auth/missing-verification-id': 'ID de verificación faltante.',
        'auth/quota-exceeded': 'Se ha excedido la cuota de Firebase.',
        'auth/app-not-authorized': 'Aplicación no autorizada.',
        'auth/captcha-check-failed': 'Verificación CAPTCHA fallida.',
        'auth/invalid-phone-number': 'Número de teléfono inválido.',
        'auth/missing-phone-number': 'Número de teléfono faltante.',
        'auth/invalid-recaptcha-token': 'Token reCAPTCHA inválido.',
        'auth/missing-recaptcha-token': 'Token reCAPTCHA faltante.',
        'auth/invalid-tenant-id': 'ID de inquilino inválido.',
        'auth/tenant-id-mismatch': 'ID de inquilino no coincide.',
        'auth/unsupported-tenant-operation': 'Operación de inquilino no soportada.',
        'auth/invalid-login-credentials': 'Credenciales de login inválidas.',
        'auth/invalid-app-credential': 'Credencial de aplicación inválida.',
        'auth/invalid-app-id': 'ID de aplicación inválido.',
        'auth/invalid-user-token': 'Token de usuario inválido.',
        'auth/invalid-tenant-id': 'ID de inquilino inválido.',
        'auth/unauthorized-continue-uri': 'URI de continuación no autorizada.',
        'auth/invalid-dynamic-link-domain': 'Dominio de enlace dinámico inválido.',
        'auth/argument-error': 'Error de argumento.',
        'auth/invalid-persistence-type': 'Tipo de persistencia inválido.',
        'auth/unsupported-persistence-type': 'Tipo de persistencia no soportado.',
        'auth/invalid-password': 'Contraseña inválida.',
        'auth/invalid-provider-data': 'Datos de proveedor inválidos.',
        'auth/invalid-session-cookie-duration': 'Duración de cookie de sesión inválida.',
        'auth/invalid-uid': 'UID inválido.',
        'auth/missing-android-pkg-name': 'Nombre de paquete Android faltante.',
        'auth/missing-continue-uri': 'URI de continuación faltante.',
        'auth/missing-ios-bundle-id': 'ID de bundle iOS faltante.',
        'auth/missing-or-invalid-nonce': 'Nonce faltante o inválido.',
        'auth/missing-phone-number': 'Número de teléfono faltante.',
        'auth/missing-verification-code': 'Código de verificación faltante.',
        'auth/missing-verification-id': 'ID de verificación faltante.',
        'auth/phone-number-already-exists': 'El número de teléfono ya existe.',
        'auth/project-not-found': 'Proyecto no encontrado.',
        'auth/reserved-claims': 'Claims reservados.',
        'auth/session-cookie-expired': 'Cookie de sesión expirada.',
        'auth/session-cookie-revoked': 'Cookie de sesión revocada.',
        'auth/uid-already-exists': 'UID ya existe.',
        'auth/unauthorized-continue-uri': 'URI de continuación no autorizada.',
        'auth/user-token-expired': 'Token de usuario expirado.',
        'auth/web-storage-unsupported': 'Almacenamiento web no soportado.'
    };
    
    return errorMessages[errorCode] || `Error desconocido: ${errorCode}`;
}

// Escuchar cambios en la autenticación
// COMENTADO: Este listener está causando conflictos con loyalty-system.html
// auth.onAuthStateChanged(async (user) => {
//     console.log('=== Firebase Auth State Changed (loyalty-api.js) ===');
//     console.log('Usuario de Firebase:', user ? user.uid : 'null');
//     console.log('Email verificado:', user ? user.emailVerified : 'N/A');
//     
//     if (user) {
//         if (user.emailVerified) {
//             console.log('✅ Usuario verificado, cargando datos...');
//             await loadUserData(user.uid);
//             if (typeof onAuthStateChanged === 'function') {
//                 onAuthStateChanged(true, user);
//             }
//         } else {
//             console.log('❌ Usuario no verificado, cerrando sesión...');
//             await auth.signOut();
//             if (typeof onAuthStateChanged === 'function') {
//                 onAuthStateChanged(false, null);
//             }
//         }
//     } else {
//         console.log('❌ No hay usuario, limpiando variables...');
//         currentUser = null;
//         userPoints = 0;
//         userData = null;
//         if (typeof onAuthStateChanged === 'function') {
//             onAuthStateChanged(false, null);
//         }
//     }
// });

// Exportar funciones para uso global
window.LoyaltyAPI = {
    registerUser,
    loginUser,
    logoutUser,
    resetPassword,
    loadUserData,
    claimDailyVisit,
    addReservationPoints,
    addReferralPoints,
    addGoogleReviewPoints,
    addInstagramPostPoints,
    addSurveyPoints,
    getAvailableRewards,
    redeemReward,
    getTransactionHistory,
    isAdmin,
    getAllUsers,
    modifyUserPoints,
    getPendingRedemptions,
    validateRedemption,
    getProgramStats,
    canClaimDailyVisit,
    getCurrentUser: () => {
        return currentUser;
    },
    getUserPoints: () => {
        return userPoints;
    },
    getUserData: () => {
        return userData;
    }
}; 