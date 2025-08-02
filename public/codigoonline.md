# CÓDIGO COMPLETO DE INICIO DE SESIÓN - SISTEMA DE FIDELIZACIÓN

## 1. CONFIGURACIÓN DE FIREBASE (loyalty-api.js)

```javascript
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
```

## 2. FUNCIONES DE AUTENTICACIÓN

```javascript
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
                
                // Verificar que no sea el mismo usuario
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
            }
        }
        
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
```

## 3. HTML DEL FORMULARIO DE LOGIN (loyalty-system.html)

```html
<!-- Sección de Login/Registro -->
<div class="loyalty-section active" id="authSection">
    <div class="form-container">
        <div class="text-center mb-30">
            <h2>Bienvenido al Programa de Fidelización</h2>
            <p class="text-secondary">Accede a tu cuenta o regístrate para comenzar</p>
        </div>

        <!-- Formulario de Login -->
        <form id="loginForm" class="auth-form">
            <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-input" id="loginEmail" placeholder="tu@email.com" required>
            </div>
            <div class="form-group">
                <label class="form-label">Contraseña</label>
                <input type="password" class="form-input" id="loginPassword" placeholder="Tu contraseña" required>
            </div>
            <button type="submit" class="form-button">
                <span id="loginButtonText">Iniciar Sesión</span>
                <div class="loading hidden" id="loginLoading"></div>
            </button>
        </form>

        <div class="text-center mt-20">
            <button class="action-button secondary" onclick="toggleAuthForm()">
                ¿No tienes cuenta? Regístrate
            </button>
        </div>
        
        <div class="text-center mt-10">
            <p class="text-secondary" style="font-size: 0.9em;">
                <i class="ph-info"></i>
                <strong>Importante:</strong> Los emails de verificación pueden ir a tu carpeta de spam. 
                Por favor revisa también esa carpeta.
            </p>
        </div>

        <div class="text-center mt-10">
            <button class="action-button secondary" onclick="showResetPasswordModal()">
                ¿Olvidaste tu contraseña?
            </button>
        </div>
    </div>
</div>
```

## 4. JAVASCRIPT DE MANEJO DE FORMULARIOS

```javascript
// Funciones de autenticación
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showMessage('Por favor completa todos los campos.', 'error');
        return;
    }
    
    try {
        const result = await LoyaltyAPI.loginUser(email, password);
        
        if (result.success) {
            showMessage('Inicio de sesión exitoso.', 'success');
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        showMessage('Error al iniciar sesión.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('registerPhone').value;
    const password = document.getElementById('registerPassword').value;
    const referral = document.getElementById('registerReferral').value;
    
    const button = e.target.querySelector('button');
    const buttonText = document.getElementById('registerButtonText');
    const loading = document.getElementById('registerLoading');
    
    button.disabled = true;
    buttonText.style.display = 'none';
    loading.classList.remove('hidden');
    
    const result = await LoyaltyAPI.registerUser(email, password, name, phone, referral);
    
    if (result.success) {
        showMessage(result.message, 'success');
        closeModal('registerModal');
    } else {
        showMessage(result.message, 'error');
    }
    
    button.disabled = false;
    buttonText.style.display = 'inline';
    loading.classList.add('hidden');
}

async function handleResetPassword(e) {
    e.preventDefault();
    
    const email = document.getElementById('resetEmail').value;
    
    const button = e.target.querySelector('button');
    const buttonText = document.getElementById('resetButtonText');
    const loading = document.getElementById('resetLoading');
    
    button.disabled = true;
    buttonText.style.display = 'none';
    loading.classList.remove('hidden');
    
    const result = await LoyaltyAPI.resetPassword(email);
    
    if (result.success) {
        showMessage(result.message, 'success');
        closeModal('resetPasswordModal');
    } else {
        showMessage(result.message, 'error');
    }
    
    button.disabled = false;
    buttonText.style.display = 'inline';
    loading.classList.add('hidden');
}
```

## 5. LISTENER DE ESTADO DE AUTENTICACIÓN

```javascript
// Escuchar cambios en la autenticación
firebase.auth().onAuthStateChanged(async function(user) {
    console.log('=== Firebase Auth State Changed ===');
    console.log('Usuario de Firebase:', user ? user.uid : 'null');
    console.log('Email verificado:', user ? user.emailVerified : 'N/A');
    
    if (user) {
        if (user.emailVerified) {
            console.log('✅ Usuario verificado, cargando datos...');
            await loadUserData(user.uid);
            if (typeof onAuthStateChanged === 'function') {
                onAuthStateChanged(true, user);
            }
        } else {
            console.log('❌ Usuario no verificado, cerrando sesión...');
            await auth.signOut();
            if (typeof onAuthStateChanged === 'function') {
                onAuthStateChanged(false, null);
            }
        }
    } else {
        console.log('❌ No hay usuario, limpiando variables...');
        currentUser = null;
        userPoints = 0;
        userData = null;
        if (typeof onAuthStateChanged === 'function') {
            onAuthStateChanged(false, null);
        }
    }
});
```

## 6. FUNCIONES AUXILIARES

```javascript
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
        'auth/phone-number-already-exists': 'El número de teléfono ya existe.',
        'auth/project-not-found': 'Proyecto no encontrado.',
        'auth/reserved-claims': 'Claims reservados.',
        'auth/session-cookie-expired': 'Cookie de sesión expirada.',
        'auth/session-cookie-revoked': 'Cookie de sesión revocada.',
        'auth/uid-already-exists': 'UID ya existe.',
        'auth/user-token-expired': 'Token de usuario expirado.',
        'auth/web-storage-unsupported': 'Almacenamiento web no soportado.'
    };
    
    return errorMessages[errorCode] || `Error desconocido: ${errorCode}`;
}
```

## 7. EXPORTACIÓN DE FUNCIONES

```javascript
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
    addInstagramPostPoints,
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
```

## 8. CONFIGURACIÓN DE EVENT LISTENERS

```javascript
// Configurar event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Event listener para el formulario de login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Event listener para el formulario de registro
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Event listener para el formulario de reset password
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', handleResetPassword);
    }
    
    // Verificar estado de autenticación al cargar la página
    checkAuthState();
});
```

## PUNTOS CLAVE DEL SISTEMA:

1. **Verificación de Email**: El sistema requiere que el email esté verificado antes de permitir el login
2. **Manejo de Errores**: Incluye manejo completo de errores de Firebase con mensajes en español
3. **Códigos de Referido**: Sistema completo de referidos con puntos automáticos
4. **Persistencia de Datos**: Los datos del usuario se cargan automáticamente al iniciar sesión
5. **Listener de Estado**: Monitorea cambios en la autenticación en tiempo real
6. **Variables Globales**: Mantiene el estado del usuario actual en variables globales

## ESTRUCTURA DE DATOS EN FIRESTORE:

```javascript
// Colección: users
{
    email: "usuario@email.com",
    name: "Nombre del Usuario",
    phone: "123456789",
    points: 100,
    totalPointsEarned: 150,
    totalPointsRedeemed: 50,
    memberSince: Timestamp,
    lastVisit: Timestamp,
    isEmailVerified: true,
    referralCode: "ABC123",
    referredBy: "userId",
    dailyVisitClaimed: false,
    lastDailyVisit: Timestamp
}
``` 