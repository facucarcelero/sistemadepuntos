// Optimizaciones específicas para localhost
console.log('🚀 Aplicando optimizaciones para localhost...');

// 1. Preload crítico de Firebase
document.addEventListener('DOMContentLoaded', function() {
    console.log('📦 Precargando Firebase para localhost...');
    
    // Preload Firebase scripts
    const firebaseScripts = [
        'https://www.gstatic.com/firebasejs/9.6.7/firebase-app-compat.js',
        'https://www.gstatic.com/firebasejs/9.6.7/firebase-auth-compat.js',
        'https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore-compat.js'
    ];
    
    firebaseScripts.forEach(script => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = script;
        link.as = 'script';
        document.head.appendChild(link);
    });
});

// 2. Optimización de DNS para localhost
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('🏠 Detectado localhost, aplicando optimizaciones...');
    
    // Preconnect a dominios críticos
    const preconnectDomains = [
        'https://www.gstatic.com',
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com',
        'https://unpkg.com'
    ];
    
    preconnectDomains.forEach(domain => {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = domain;
        document.head.appendChild(link);
    });
}

// 3. Optimización de caché para localhost
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Forzar recarga de scripts en desarrollo
    const scripts = document.querySelectorAll('script[src*="firebase"]');
    scripts.forEach(script => {
        script.setAttribute('data-timestamp', Date.now());
    });
}

// 4. Detectar problemas de conectividad en localhost
function checkLocalhostConnectivity() {
    const startTime = Date.now();
    
    // Probar conectividad a Firebase
    fetch('https://www.gstatic.com/firebasejs/9.6.7/firebase-app-compat.js', {
        method: 'HEAD',
        mode: 'no-cors'
    }).then(() => {
        const loadTime = Date.now() - startTime;
        console.log(`✅ Conectividad a Firebase: ${loadTime}ms`);
        
        if (loadTime > 1000) {
            console.warn('⚠️ Conexión lenta detectada en localhost');
        }
    }).catch(error => {
        console.error('❌ Problema de conectividad en localhost:', error);
    });
}

// Ejecutar verificación de conectividad
setTimeout(checkLocalhostConnectivity, 1000);

console.log('✅ Optimizaciones para localhost aplicadas'); 