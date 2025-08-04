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

// Inicializar Firebase (optimizado como en el repositorio original)
try {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase inicializado correctamente');
} catch (error) {
    if (error.code !== 'app/duplicate-app') {
        console.error('Error inicializando Firebase:', error);
    }
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Configuración de Firestore simplificada (como en el repositorio original)
db.settings({
    timestampsInSnapshots: true,
    merge: true // Agregar merge: true para evitar la advertencia
});

// Firebase Storage inicializado
console.log('✅ Firebase Storage disponible');

console.log('✅ Firebase Auth y Firestore configurados');

// Variables globales
let currentUser = null;
let userPoints = 0;
let userData = null;

// ===== FUNCIONES DE AUTENTICACIÓN =====

// Registrar nuevo usuario
async function registerUser(email, password, name, phone, referralCode = null) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Enviar email de verificación
        await user.sendEmailVerification();
        
        // Buscar referidor si se proporcionó un código de referido
        let referrerId = null;
        if (referralCode && referralCode.trim()) {
            const referrerQuery = await db.collection('users')
                .where('referralCode', '==', referralCode.trim())
                .limit(1)
                .get();
            
            if (!referrerQuery.empty) {
                const referrerDoc = referrerQuery.docs[0];
                referrerId = referrerDoc.id;
                
                // Verificar que no sea el mismo usuario (aunque esto no debería pasar en registro)
                if (referrerId === user.uid) {
                    referrerId = null;
                }
            }
        }
        
        // Crear documento de usuario en Firestore
        const userData = {
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
            referredBy: referrerId,
            dailyVisitClaimed: false,
            lastDailyVisit: null
        };
        
        await db.collection('users').doc(user.uid).set(userData);
        
        // Si hay un referidor válido, agregar puntos a ambos usuarios
        if (referrerId) {
            try {
                // Agregar puntos al nuevo usuario
                await db.collection('users').doc(user.uid).update({
                    points: 20,
                    totalPointsEarned: 20
                });
                
                // Agregar puntos al referidor
                const referrerDoc = await db.collection('users').doc(referrerId).get();
                if (referrerDoc.exists) {
                    const referrerData = referrerDoc.data();
                    await db.collection('users').doc(referrerId).update({
                        points: (referrerData.points || 0) + 20,
                        totalPointsEarned: (referrerData.totalPointsEarned || 0) + 20
                    });
                    
                    // Registrar transacciones
                    await addPointTransaction('Referido - Nuevo usuario registrado', 20, 'earned', referrerId);
                }
                
                // Registrar transacción para el nuevo usuario
                await addPointTransaction('Registro con código de referido', 20, 'earned', user.uid);
                
                return { 
                    success: true, 
                    message: 'Usuario registrado exitosamente. ¡+20 puntos por usar código de referido! Por favor verifica tu email (revisa también la carpeta de spam).' 
                };
            } catch (error) {
                console.error('Error al procesar referido:', error);
                // Continuar con el registro aunque falle el procesamiento del referido
            }
        }
        
        return { success: true, message: 'Usuario registrado exitosamente. Por favor verifica tu email (revisa también la carpeta de spam).' };
    } catch (error) {
        console.error('Error en registerUser:', error);
        return { success: false, message: getErrorMessage(error.code) };
    }
}

// Iniciar sesión (ULTRA INSTANTÁNEO para localhost)
async function loginUser(email, password) {
    try {
        console.log('🚀 Iniciando login ULTRA INSTANTÁNEO para localhost...');
        console.log('📧 Email:', email);
        console.log('🔑 Password:', '***');
        
        // Verificar que Firebase esté listo (crítico para localhost)
        if (!auth) {
            console.error('❌ Firebase Auth no está disponible');
            return { success: false, message: 'Error: Firebase no está listo. Recarga la página.' };
        }
        
        console.log('✅ Firebase Auth disponible, iniciando autenticación...');
        
        // Diagnóstico de conectividad antes del login
        const startTime = Date.now();
        console.log('🌐 Verificando conectividad a Firebase...');
        
        // SOLUCIÓN AGRESIVA: Usar signInWithCredential en lugar de signInWithEmailAndPassword
        console.log('🔧 Usando método de autenticación optimizado para localhost...');
        
        // Crear credenciales directamente
        const credential = firebase.auth.EmailAuthProvider.credential(email, password);
        
        // Timeout de 3 segundos (más agresivo)
        const loginPromise = auth.signInWithCredential(credential);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => {
                const elapsed = Date.now() - startTime;
                console.error(`⏰ Timeout después de ${elapsed}ms`);
                reject(new Error(`Timeout: Login tardó más de 3 segundos en localhost (${elapsed}ms)`));
            }, 3000)
        );
        
        console.log('⏱️ Ejecutando autenticación con credenciales (timeout 3s)...');
        const userCredential = await Promise.race([loginPromise, timeoutPromise]);
        const user = userCredential.user;
        
        const authTime = Date.now() - startTime;
        console.log(`✅ Usuario autenticado en ${authTime}ms:`, user.email);
        
        if (!user.emailVerified) {
            console.log('❌ Email no verificado, cerrando sesión...');
            await auth.signOut();
            return { success: false, message: 'Por favor verifica tu email antes de iniciar sesión.' };
        }
        
        console.log('✅ Email verificado correctamente');
        
        // SIN cargar datos aquí - el listener se encargará
        console.log('✅ Login exitoso ULTRA INSTANTÁNEO para localhost');
        return { success: true, message: 'Inicio de sesión exitoso.' };
    } catch (error) {
        console.error('❌ Error en loginUser:', error);
        if (error.message.includes('Timeout')) {
            return { success: false, message: `Error: Login tardó demasiado en localhost. ${error.message}` };
        }
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

// Validar código de referido
async function validateReferralCode(code) {
    if (!code || !code.trim()) {
        return { valid: false, message: 'Código de referido requerido.' };
    }
    
    try {
        const query = await db.collection('users')
            .where('referralCode', '==', code.trim())
            .limit(1)
            .get();
        
        if (query.empty) {
            return { valid: false, message: 'Código de referido inválido.' };
        }
        
        return { valid: true, message: 'Código de referido válido.' };
    } catch (error) {
        console.error('Error validando código de referido:', error);
        return { valid: false, message: 'Error al validar código de referido.' };
    }
}

// Cargar datos del usuario (optimizado como en el repositorio original)
async function loadUserData(userId) {
    try {
        console.log('⚡ Cargando datos del usuario de forma optimizada...');
        const doc = await db.collection('users').doc(userId).get();
        if (doc.exists) {
            userData = doc.data();
            userPoints = userData.points || 0;
            currentUser = userId;
            
            // Asegurar que los campos existan (optimizado)
            userData.totalPointsEarned = userData.totalPointsEarned || 0;
            userData.totalPointsRedeemed = userData.totalPointsRedeemed || 0;
            userData.dailyVisitClaimed = userData.dailyVisitClaimed || false;
            
            console.log('✅ Datos del usuario cargados rápidamente');
            return userData;
        } else {
            console.log('⚠️ Usuario no encontrado en Firestore');
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

// Enviar verificación de post en Instagram (SIMPLIFICADO)
async function submitInstagramVerification(verificationData) {
    if (!currentUser) return { success: false, message: 'Debes iniciar sesión.' };
    
    try {
        // Verificar si ya tiene una solicitud pendiente
        const existingVerification = await db.collection('instagramVerifications')
            .where('userId', '==', currentUser)
            .where('status', '==', 'pending')
            .get();
        
        if (!existingVerification.empty) {
            return { success: false, message: 'Ya tienes una solicitud pendiente. Espera a que la revisemos.' };
        }
        
        // Crear la solicitud de verificación (simplificada)
        await db.collection('instagramVerifications').add({
            userId: currentUser,
            username: verificationData.username,
            screenshotUrl: verificationData.screenshotUrl,
            status: 'pending',
            points: 15,
            createdAt: new Date()
        });
        
        return { success: true, message: '¡Perfecto! Tu solicitud fue enviada. Los puntos se acreditarán en 24 horas.' };
    } catch (error) {
        console.error('Error submitting Instagram verification:', error);
        return { success: false, message: 'Error al enviar. Intenta nuevamente.' };
    }
}

// Obtener verificaciones de Instagram del usuario
async function getInstagramVerifications() {
    if (!currentUser) return [];
    
    try {
        const snapshot = await db.collection('instagramVerifications')
            .where('userId', '==', currentUser)
            .orderBy('createdAt', 'desc')
            .get();
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting Instagram verifications:', error);
        return [];
    }
}

// Función para administradores: obtener todas las verificaciones pendientes
async function getPendingInstagramVerifications() {
    if (!currentUser || !(await isAdmin())) return [];
    
    try {
        const snapshot = await db.collection('instagramVerifications')
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .get();
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting pending Instagram verifications:', error);
        return [];
    }
}

// Función para administradores: aprobar verificación de Instagram (SIMPLIFICADO)
async function approveInstagramVerification(verificationId) {
    if (!currentUser || !(await isAdmin())) {
        return { success: false, message: 'No tienes permisos de administrador.' };
    }
    
    try {
        const verificationRef = db.collection('instagramVerifications').doc(verificationId);
        const verificationDoc = await verificationRef.get();
        
        if (!verificationDoc.exists) {
            return { success: false, message: 'Verificación no encontrada.' };
        }
        
        const verificationData = verificationDoc.data();
        
        // Actualizar estado de la verificación
        await verificationRef.update({
            status: 'approved',
            approvedAt: new Date(),
            approvedBy: currentUser
        });
        
        // Agregar puntos al usuario
        const userRef = db.collection('users').doc(verificationData.userId);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            const newPoints = (userData.points || 0) + verificationData.points;
            
            await userRef.update({
                points: newPoints
            });
            
            // Registrar la transacción
            await addPointTransaction(
                `Post en Instagram aprobado (@${verificationData.username})`,
                verificationData.points,
                'instagram',
                verificationData.userId
            );
        }
        
        return { success: true, message: '¡Verificación aprobada! Se otorgaron 15 puntos al usuario.' };
    } catch (error) {
        console.error('Error approving Instagram verification:', error);
        return { success: false, message: 'Error al aprobar. Intenta nuevamente.' };
    }
}

// Función para administradores: rechazar verificación de Instagram (SIMPLIFICADO)
async function rejectInstagramVerification(verificationId, reason = '') {
    if (!currentUser || !(await isAdmin())) {
        return { success: false, message: 'No tienes permisos de administrador.' };
    }
    
    try {
        const verificationRef = db.collection('instagramVerifications').doc(verificationId);
        const verificationDoc = await verificationRef.get();
        
        if (!verificationDoc.exists) {
            return { success: false, message: 'Verificación no encontrada.' };
        }
        
        // Actualizar estado de la verificación
        await verificationRef.update({
            status: 'rejected',
            rejectedAt: new Date(),
            rejectedBy: currentUser,
            rejectionReason: reason || 'No cumple con los requisitos'
        });
        
        return { success: true, message: 'Verificación rechazada.' };
    } catch (error) {
        console.error('Error rejecting Instagram verification:', error);
        return { success: false, message: 'Error al rechazar. Intenta nuevamente.' };
    }
}

// ===== FUNCIONES DE CÓDIGOS INSTAGRAM =====

// Generar código temporal de Instagram (solo admin)
async function generateInstagramCode(duration, points) {
    if (!currentUser || !(await isAdmin())) {
        return { success: false, message: 'No tienes permisos de administrador.' };
    }
    
    try {
        const code = generateRandomCode();
        const expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
        
        await db.collection('instagramCodes').add({
            code: code,
            points: points,
            expiresAt: expiresAt,
            isActive: true,
            createdAt: new Date(),
            createdBy: currentUser,
            usedBy: []
        });
        
        return { success: true, code: code, message: 'Código generado exitosamente.' };
    } catch (error) {
        console.error('Error generating Instagram code:', error);
        return { success: false, message: 'Error al generar código.' };
    }
}

// Obtener códigos de Instagram (solo admin)
async function getInstagramCodes() {
    if (!currentUser || !(await isAdmin())) {
        return [];
    }
    
    try {
        const snapshot = await db.collection('instagramCodes')
            .orderBy('createdAt', 'desc')
            .get();
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting Instagram codes:', error);
        return [];
    }
}

// Eliminar código de Instagram (solo admin)
async function deleteInstagramCode(codeId) {
    if (!currentUser || !(await isAdmin())) {
        return { success: false, message: 'No tienes permisos de administrador.' };
    }
    
    try {
        await db.collection('instagramCodes').doc(codeId).delete();
        return { success: true, message: 'Código eliminado exitosamente.' };
    } catch (error) {
        console.error('Error deleting Instagram code:', error);
        return { success: false, message: 'Error al eliminar código.' };
    }
}

// Verificar código de Instagram (para usuarios)
async function verifyInstagramCode(code) {
    if (!currentUser) {
        return { success: false, message: 'Debes iniciar sesión.' };
    }
    
    try {
        // Buscar código válido
        const codeQuery = await db.collection('instagramCodes')
            .where('code', '==', code)
            .where('isActive', '==', true)
            .where('expiresAt', '>', new Date())
            .get();
        
        if (codeQuery.empty) {
            return { success: false, message: 'Código inválido o expirado.' };
        }
        
        const codeDoc = codeQuery.docs[0];
        const codeData = codeDoc.data();
        
        // Verificar si el usuario ya usó este código
        if (codeData.usedBy && codeData.usedBy.includes(currentUser)) {
            return { success: false, message: 'Ya has usado este código.' };
        }
        
        // Agregar puntos al usuario
        const userRef = db.collection('users').doc(currentUser);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            const newPoints = (userData.points || 0) + codeData.points;
            
            await userRef.update({
                points: newPoints,
                totalPointsEarned: (userData.totalPointsEarned || 0) + codeData.points
            });
            
            // Marcar código como usado por este usuario
            await db.collection('instagramCodes').doc(codeDoc.id).update({
                usedBy: firebase.firestore.FieldValue.arrayUnion(currentUser)
            });
            
            // Registrar transacción
            await addPointTransaction(
                `Código Instagram: ${code}`,
                codeData.points,
                'instagram'
            );
            
            // Actualizar variables locales
            userPoints = newPoints;
            if (userData) {
                userData.points = newPoints;
                userData.totalPointsEarned = (userData.totalPointsEarned || 0) + codeData.points;
            }
            
            return { 
                success: true, 
                points: codeData.points,
                message: `¡+${codeData.points} puntos por seguirnos en Instagram!` 
            };
        }
        
        return { success: false, message: 'Error al actualizar puntos.' };
    } catch (error) {
        console.error('Error verifying Instagram code:', error);
        return { success: false, message: 'Error al verificar código.' };
    }
}

// Generar código aleatorio
function generateRandomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
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

// Obtener premios disponibles - ULTRA INSTANTÁNEO
async function getAvailableRewards() {
    try {
        console.log('⚡ Obteniendo premios ULTRA INSTANTÁNEO...');
        
        // Timeout MUY corto de 2 segundos para máxima velocidad
        const queryPromise = db.collection('rewards').limit(10).get(); // Límite reducido para velocidad
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: Premios tardaron demasiado')), 2000)
        );
        
        const snapshot = await Promise.race([queryPromise, timeoutPromise]);
        const rewards = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log(`✅ ${rewards.length} premios obtenidos ULTRA INSTANTÁNEO`);
        return rewards;
    } catch (error) {
        console.error('Error obteniendo premios:', error);
        return [];
    }
}

// Inicializar premios en Firebase (solo se ejecuta una vez)
async function initializeRewards() {
    try {
        const snapshot = await db.collection('rewards').get();
        
        // Si ya hay premios, no inicializar
        if (!snapshot.empty) {
            console.log('Los premios ya están inicializados en Firebase');
            return;
        }
        
        const defaultRewards = [
            { name: 'Gaseosa o postre gratis', pointsRequired: 50, description: 'Disfruta de una gaseosa o postre de la casa', active: true, quantity: 1 },
            { name: 'Entrada o empanada gratis', pointsRequired: 100, description: 'Entrada o empanada de tu elección', active: true, quantity: 1 },
            { name: '10% descuento en mesa', pointsRequired: 200, description: '10% de descuento en tu cuenta total', active: true, quantity: 1 },
            { name: 'Vino regional o parrillada para 1', pointsRequired: 300, description: 'Vino regional o parrillada individual', active: true, quantity: 1 },
            { name: 'Parrillada libre completa para 2', pointsRequired: 500, description: 'Parrillada libre completa para 2 personas', active: true, quantity: 1 }
        ];
        
        const batch = db.batch();
        defaultRewards.forEach(reward => {
            const docRef = db.collection('rewards').doc();
            batch.set(docRef, {
                ...reward,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        });
        
        await batch.commit();
        console.log('Premios inicializados exitosamente en Firebase');
    } catch (error) {
        console.error('Error inicializando premios:', error);
    }
}

// Canjear premio
async function redeemReward(rewardId, rewardName, pointsRequired) {
    if (!currentUser) return { success: false, message: 'Debes iniciar sesión.' };
    
    if (userPoints < pointsRequired) {
        return { success: false, message: 'No tienes suficientes puntos para este premio.' };
    }
    
    try {
        const newPoints = userPoints - pointsRequired;
        
        await db.collection('users').doc(currentUser).update({
            points: newPoints,
            totalPointsRedeemed: userData.totalPointsRedeemed + pointsRequired
        });
        
        // Registrar canje
        await db.collection('redemptions').add({
            userId: currentUser,
            userEmail: userData.email,
            userName: userData.name,
            rewardId: rewardId,
            rewardName: rewardName,
            pointsCost: pointsRequired,
            redeemedAt: new Date(),
            status: 'pending',
            validatedBy: null,
            validatedAt: null
        });
        
        await addPointTransaction(rewardName, -pointsRequired, 'redeemed');
        
        userPoints = newPoints;
        userData.points = newPoints;
        userData.totalPointsRedeemed += pointsRequired;
        
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
            const targetUserId = userId || (currentUser && typeof currentUser === 'string' ? currentUser : null);
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

// Verificar si el usuario es administrador (ULTRA RÁPIDO)
async function isAdmin(userId) {
    try {
        console.log('🔐 Verificando admin para:', userId);
        
        // Timeout MUY corto de 2 segundos para máxima velocidad
        const adminPromise = db.collection('admins').doc(userId).get();
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: Verificación de admin tardó demasiado')), 2000)
        );
        
        const doc = await Promise.race([adminPromise, timeoutPromise]);
        const isAdmin = doc.exists;
        console.log('🔐 Resultado verificación admin:', isAdmin);
        return isAdmin;
    } catch (error) {
        console.error('❌ Error verificando admin:', error);
        return false;
    }
}

// Agregar permisos de administrador a un usuario
async function addAdminPermissions(userId) {
    try {
        await db.collection('admins').doc(userId).set({
            addedAt: new Date(),
            permissions: ['all']
        });
        return { success: true, message: 'Permisos de administrador agregados exitosamente.' };
    } catch (error) {
        console.error('Error agregando permisos de admin:', error);
        return { success: false, message: 'Error agregando permisos de administrador.' };
    }
}

// Obtener todos los usuarios (solo admin) - ULTRA INSTANTÁNEO
async function getAllUsers() {
    try {
        console.log('⚡ Obteniendo usuarios ULTRA INSTANTÁNEO...');
        
        // Timeout MUY corto de 2 segundos para máxima velocidad
        const queryPromise = db.collection('users')
            .limit(10) // Solo 10 usuarios para máxima velocidad
            .get();
            
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: Usuarios tardaron demasiado')), 2000)
        );
        
        const query = await Promise.race([queryPromise, timeoutPromise]);
            
        const users = query.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            memberSince: doc.data().memberSince ? doc.data().memberSince.toDate() : new Date()
        }));
        
        // Ordenar en JavaScript (optimizado)
        users.sort((a, b) => b.memberSince - a.memberSince);
        
        console.log(`✅ ${users.length} usuarios obtenidos ULTRA INSTANTÁNEO`);
        return users;
    } catch (error) {
        console.error('❌ Error obteniendo usuarios:', error);
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

// Obtener estadísticas del programa (solo admin) - ULTRA INSTANTÁNEO
async function getProgramStats() {
    try {
        console.log('⚡ Obteniendo estadísticas ULTRA INSTANTÁNEO...');
        
        // Timeout MUY corto de 3 segundos para máxima velocidad
        const statsPromise = Promise.all([
            db.collection('users').limit(20).get(), // Límite ULTRA reducido
            db.collection('redemptions').limit(20).get() // Límite ULTRA reducido
        ]);
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: Estadísticas tardaron demasiado')), 3000)
        );
        
        const [usersQuery, redemptionsQuery] = await Promise.race([statsPromise, timeoutPromise]);
        
        const totalUsers = usersQuery.size;
        const totalRedemptions = redemptionsQuery.size;
        let totalPointsEarned = 0;
        let totalPointsRedeemed = 0;
        let activePoints = 0;
        
        // Calcular puntos de forma ULTRA optimizada
        usersQuery.docs.forEach(doc => {
            const data = doc.data();
            totalPointsEarned += data.totalPointsEarned || 0;
            totalPointsRedeemed += data.totalPointsRedeemed || 0;
            activePoints += data.points || 0;
        });
        
        console.log('✅ Estadísticas calculadas ULTRA RÁPIDO');
        return {
            totalUsers,
            totalPointsEarned,
            totalPointsRedeemed,
            totalRedemptions,
            activePoints: totalPointsEarned - totalPointsRedeemed
        };
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        // Retornar valores por defecto inmediatamente
        return {
            totalUsers: 0,
            totalPointsEarned: 0,
            totalPointsRedeemed: 0,
            totalRedemptions: 0,
            activePoints: 0
        };
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

// Escuchar cambios en la autenticación (ULTRA RÁPIDO - como en codigoonline.md)
auth.onAuthStateChanged(async (user) => {
    console.log('=== Firebase Auth State Changed (ULTRA RÁPIDO) ===');
    console.log('Usuario de Firebase:', user ? user.uid : 'null');
    
    if (user) {
        if (user.emailVerified) {
            console.log('✅ Usuario verificado, notificando inmediatamente...');
            // SIN cargar datos aquí - solo notificar inmediatamente
            if (typeof LoyaltyAPI.onAuthStateChanged === 'function') {
                LoyaltyAPI.onAuthStateChanged(true, user);
            }
        } else {
            console.log('❌ Usuario no verificado, cerrando sesión...');
            await auth.signOut();
            if (typeof LoyaltyAPI.onAuthStateChanged === 'function') {
                LoyaltyAPI.onAuthStateChanged(false, null);
            }
        }
    } else {
        console.log('❌ No hay usuario, limpiando variables...');
        currentUser = null;
        userPoints = 0;
        userData = null;
        if (typeof LoyaltyAPI.onAuthStateChanged === 'function') {
            LoyaltyAPI.onAuthStateChanged(false, null);
        }
    }
});

// Exportar funciones para uso global
window.LoyaltyAPI = {
    registerUser,
    loginUser,
    logoutUser,
    resetPassword,
    validateReferralCode,
    loadUserData,
    claimDailyVisit,
    addReservationPoints,
    addReferralPoints,
    addGoogleReviewPoints,
    submitInstagramVerification,
    getInstagramVerifications,
    getPendingInstagramVerifications,
    approveInstagramVerification,
    rejectInstagramVerification,
    addSurveyPoints,
    getAvailableRewards,
    initializeRewards,
    redeemReward,
    getTransactionHistory,
    isAdmin,
    addAdminPermissions,
    getAllUsers,
    modifyUserPoints,
    getPendingRedemptions,
    validateRedemption,
    getProgramStats,
    canClaimDailyVisit,
    // Funciones de códigos Instagram
    generateInstagramCode,
    getInstagramCodes,
    deleteInstagramCode,
    verifyInstagramCode,
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