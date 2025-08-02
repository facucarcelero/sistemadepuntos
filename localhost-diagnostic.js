// Diagnóstico específico para localhost
console.log('🔍 Iniciando diagnóstico de localhost...');

// Función para diagnosticar conectividad
async function diagnoseLocalhost() {
    console.log('🏠 === DIAGNÓSTICO DE LOCALHOST ===');
    
    // 1. Verificar si estamos en localhost
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '::1';
    
    console.log('📍 Hostname:', window.location.hostname);
    console.log('🏠 Es localhost:', isLocalhost);
    
    if (!isLocalhost) {
        console.log('⚠️ No estás en localhost, diagnóstico no aplica');
        return;
    }
    
    // 2. Verificar Firebase
    console.log('🔥 Verificando Firebase...');
    if (typeof firebase === 'undefined') {
        console.error('❌ Firebase no está cargado');
        return;
    }
    
    if (!firebase.auth) {
        console.error('❌ Firebase Auth no está disponible');
        return;
    }
    
    console.log('✅ Firebase Auth disponible');
    
    // 3. Probar conectividad a dominios críticos
    const domains = [
        'https://www.gstatic.com',
        'https://identitytoolkit.googleapis.com',
        'https://firestore.googleapis.com'
    ];
    
    console.log('🌐 Probando conectividad a dominios críticos...');
    
    for (const domain of domains) {
        try {
            const startTime = Date.now();
            const response = await fetch(`${domain}/v1/projects/test`, {
                method: 'HEAD',
                mode: 'no-cors'
            });
            const loadTime = Date.now() - startTime;
            console.log(`✅ ${domain}: ${loadTime}ms`);
        } catch (error) {
            console.log(`❌ ${domain}: Error de conectividad`);
        }
    }
    
    // 4. Verificar configuración de Firebase
    console.log('⚙️ Verificando configuración de Firebase...');
    try {
        const app = firebase.app();
        console.log('✅ Firebase App inicializado');
        console.log('📋 Configuración:', {
            projectId: app.options.projectId,
            authDomain: app.options.authDomain
        });
    } catch (error) {
        console.error('❌ Error en configuración de Firebase:', error);
    }
    
    // 5. Probar autenticación básica
    console.log('🔐 Probando autenticación básica...');
    try {
        const auth = firebase.auth();
        console.log('✅ Firebase Auth inicializado');
        
        // Verificar si hay un usuario actual
        const currentUser = auth.currentUser;
        console.log('👤 Usuario actual:', currentUser ? currentUser.email : 'null');
        
    } catch (error) {
        console.error('❌ Error en Firebase Auth:', error);
    }
    
    console.log('🏁 === FIN DEL DIAGNÓSTICO ===');
}

// Ejecutar diagnóstico después de que la página cargue
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', diagnoseLocalhost);
} else {
    diagnoseLocalhost();
}

// Función para monitorear el rendimiento del login
window.monitorLoginPerformance = function() {
    console.log('📊 Monitoreando rendimiento del login...');
    
    const startTime = Date.now();
    
    return {
        start: () => {
            console.log('⏱️ Iniciando monitoreo de login...');
            return startTime;
        },
        check: (step) => {
            const elapsed = Date.now() - startTime;
            console.log(`📊 ${step}: ${elapsed}ms`);
            return elapsed;
        },
        end: () => {
            const totalTime = Date.now() - startTime;
            console.log(`🏁 Login completado en ${totalTime}ms`);
            return totalTime;
        }
    };
};

console.log('✅ Diagnóstico de localhost cargado'); 