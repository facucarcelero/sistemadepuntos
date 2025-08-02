// Sistema de login ULTRA RÁPIDO para localhost
console.log('⚡ Cargando sistema de login ULTRA RÁPIDO para localhost...');

// Función de login alternativa para localhost
window.fastLocalhostLogin = async function(email, password) {
    console.log('🚀 === LOGIN ULTRA RÁPIDO PARA LOCALHOST ===');
    
    try {
        // Verificar que estamos en localhost
        if (!window.location.hostname.includes('localhost') && 
            !window.location.hostname.includes('127.0.0.1')) {
            console.log('⚠️ No estás en localhost, usando método normal');
            return null; // Usar método normal
        }
        
        console.log('🏠 Detectado localhost, usando login ULTRA RÁPIDO...');
        
        // Verificar Firebase
        if (!firebase || !firebase.auth) {
            console.error('❌ Firebase no disponible');
            return null;
        }
        
        const auth = firebase.auth();
        const startTime = Date.now();
        
        console.log('🔧 Método 1: Login directo SIN timeout (modo desarrollo)...');
        
        // Método 1: Login directo SIN timeout para desarrollo
        try {
            console.log('🔧 Método 1: Login directo SIN timeout para desarrollo...');
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            const time = Date.now() - startTime;
            console.log(`✅ Login exitoso en ${time}ms con método directo (sin timeout)`);
            
            // En localhost, permitir login sin verificación de email
            console.log('🏠 Localhost: Permitido login sin verificación de email');
            return { success: true, message: 'Inicio de sesión exitoso (modo desarrollo).' };
            
        } catch (error) {
            console.log('⚠️ Método 1 falló, intentando método alternativo...');
            
            // Método 2: Usar credenciales
            try {
                console.log('🔧 Método 2: Usando credenciales con timeout de 10 segundos...');
                const credential = firebase.auth.EmailAuthProvider.credential(email, password);
                
                const loginPromise = auth.signInWithCredential(credential);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout credenciales')), 10000)
                );
                
                const userCredential = await Promise.race([loginPromise, timeoutPromise]);
                const user = userCredential.user;
                
                const time = Date.now() - startTime;
                console.log(`✅ Login exitoso en ${time}ms con credenciales`);
                
                // En localhost, permitir login sin verificación de email
                console.log('🏠 Localhost: Permitido login sin verificación de email');
                return { success: true, message: 'Inicio de sesión exitoso (modo desarrollo).' };
                
            } catch (error2) {
                console.log('⚠️ Método 2 falló, intentando método de emergencia...');
                
                // Método 3: Login sin verificación de email (solo para desarrollo)
                try {
                    console.log('🔧 Método 3: Login de emergencia con timeout de 15 segundos...');
                    
                    // Forzar login sin verificación de email
                    const loginPromise = auth.signInWithEmailAndPassword(email, password);
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout emergencia')), 15000)
                    );
                    
                    const userCredential = await Promise.race([loginPromise, timeoutPromise]);
                    const user = userCredential.user;
                    
                    const time = Date.now() - startTime;
                    console.log(`✅ Login exitoso en ${time}ms con método de emergencia`);
                    
                    // En localhost, permitir login sin verificación de email
                    console.log('🏠 Localhost: Permitido login sin verificación de email');
                    return { success: true, message: 'Inicio de sesión exitoso (modo desarrollo).' };
                    
                } catch (error3) {
                    console.log('⚠️ Método 3 falló, intentando método final...');
                    
                    // Método 4: Estrategia de espera y reintento
                    try {
                        console.log('🔧 Método 4: Estrategia de espera y reintento...');
                        
                        // Esperar un poco y reintentar
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        const loginPromise = auth.signInWithEmailAndPassword(email, password);
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Timeout final')), 20000)
                        );
                        
                        const userCredential = await Promise.race([loginPromise, timeoutPromise]);
                        const user = userCredential.user;
                        
                        const time = Date.now() - startTime;
                        console.log(`✅ Login exitoso en ${time}ms con método final`);
                        
                        // En localhost, permitir login sin verificación de email
                        console.log('🏠 Localhost: Permitido login sin verificación de email');
                        return { success: true, message: 'Inicio de sesión exitoso (modo desarrollo).' };
                        
                    } catch (error4) {
                        console.error('❌ Todos los métodos fallaron:', error4);
                        return { success: false, message: 'Error: No se pudo iniciar sesión en localhost después de múltiples intentos.' };
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error en login ULTRA RÁPIDO:', error);
        return { success: false, message: 'Error interno en login rápido.' };
    }
};

// Función para diagnosticar problemas de conectividad específicos
window.diagnoseLocalhostConnectivity = async function() {
    console.log('🔍 === DIAGNÓSTICO ESPECÍFICO DE LOCALHOST ===');
    
    const tests = [
        {
            name: 'Firebase Auth',
            test: () => firebase && firebase.auth ? '✅' : '❌'
        },
        {
            name: 'Conectividad básica',
            test: async () => {
                try {
                    const start = Date.now();
                    await fetch('https://www.gstatic.com/firebasejs/9.6.7/firebase-app-compat.js', {
                        method: 'HEAD',
                        mode: 'no-cors'
                    });
                    const time = Date.now() - start;
                    return `✅ (${time}ms)`;
                } catch (error) {
                    return '❌';
                }
            }
        },
        {
            name: 'Firebase Auth API',
            test: async () => {
                try {
                    const start = Date.now();
                    await fetch('https://identitytoolkit.googleapis.com/v1/projects/losnogales-reservas/accounts:signInWithPassword', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: 'test@test.com', password: 'test' })
                    });
                    const time = Date.now() - start;
                    return `✅ (${time}ms)`;
                } catch (error) {
                    return '❌';
                }
            }
        }
    ];
    
    for (const test of tests) {
        const result = await test.test();
        console.log(`${test.name}: ${result}`);
    }
    
    console.log('🏁 === FIN DEL DIAGNÓSTICO ESPECÍFICO ===');
};

console.log('✅ Sistema de login ULTRA RÁPIDO para localhost cargado'); 