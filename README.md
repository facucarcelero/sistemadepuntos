# Sistema de Fidelización - Parrilla Los Nogales

## 🎯 Descripción
Sistema completo de fidelización de clientes para "Parrilla Los Nogales" con Firebase, puntos, premios y encuestas.

## 🚀 Características

### ✅ Funcionalidades Principales
- **Autenticación de usuarios** (email/password)
- **Sistema de puntos** con múltiples formas de ganar
- **Premios canjeables** con diferentes niveles
- **Encuesta de satisfacción** integrada
- **Panel de administración** para gestión
- **Historial de transacciones**
- **Diseño responsive** para móviles y desktop

### 🎁 Formas de Ganar Puntos
1. **Visita diaria**: +10 puntos (una vez por día)
2. **Reserva online**: +5 puntos
3. **Referido**: +20 puntos
4. **Encuesta de satisfacción**: +20 puntos (una vez por día)
5. **Reseña en Google**: +20 puntos
6. **Post en Instagram**: +15 puntos

### 🏆 Premios Disponibles
- **Gaseosa o postre gratis**: 50 puntos
- **Entrada o empanada gratis**: 100 puntos
- **10% descuento en mesa**: 200 puntos
- **Vino regional o parrillada para 1**: 300 puntos
- **Parrillada libre completa para 2**: 500 puntos

## 🛠️ Configuración

### 1. Firebase Setup
1. Crear proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Habilitar **Authentication** (Email/Password)
3. Crear base de datos **Firestore**
4. Configurar reglas de Firestore:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 2. Configurar Firebase
1. Obtener configuración de Firebase
2. Reemplazar `firebaseConfig` en `loyalty-api.js`
3. Agregar `localhost` y `127.0.0.1` a dominios autorizados

### 3. Ejecutar Localmente
```bash
# Opción 1: Python
python -m http.server 8000

# Opción 2: Node.js
npx http-server -p 8000
```

4. Abrir: `http://localhost:8000/loyalty-system.html`

## 📁 Estructura de Archivos

```
├── loyalty-system.html      # Interfaz principal del sistema
├── loyalty-api.js          # API y lógica de Firebase
├── loyalty-styles.css      # Estilos del sistema
├── test-survey.html        # Página de pruebas
├── index.html             # Página principal del restaurante
├── carta.html             # Menú del restaurante
└── README.md              # Este archivo
```

## 🔧 Uso del Sistema

### Para Clientes
1. **Registrarse** con email y contraseña
2. **Verificar email** (revisar spam)
3. **Iniciar sesión** en el sistema
4. **Ganar puntos** con diferentes acciones
5. **Canjear premios** cuando alcancen los puntos necesarios

### Para Administradores
1. **Crear usuario admin** en Firestore:
   ```javascript
   // En Firebase Console > Firestore
   // Crear documento en colección 'admins'
   // ID del documento = UID del usuario
   // Contenido: { role: 'admin' }
   ```
2. **Acceder al panel** de administración
3. **Gestionar usuarios** y puntos
4. **Validar canjes** de premios

## 🎨 Características de Diseño

### Responsive Design
- **Mobile-first** approach
- **Breakpoints**: 768px, 480px, 360px
- **Modales optimizados** para pantallas pequeñas

### UI/UX
- **Tema oscuro** con acentos verdes
- **Animaciones suaves** y transiciones
- **Iconografía** con Phosphor Icons
- **Feedback visual** para todas las acciones

## 🔒 Seguridad

### Autenticación
- **Email verification** requerida
- **Sesiones persistentes** con Firebase Auth
- **Protección de rutas** para administradores

### Datos
- **Validación** en frontend y backend
- **Sanitización** de inputs
- **Transacciones** atómicas en Firestore

## 🐛 Solución de Problemas

### Error de Índice de Firestore
Si aparece error de índice:
1. **Hacer clic** en el enlace del error
2. **Crear el índice** en Firebase Console
3. **Esperar** 2-3 minutos a que se construya

### Problemas de Autenticación
1. **Verificar** que Email/Password esté habilitado
2. **Confirmar** que `localhost` esté en dominios autorizados
3. **Revisar** que el email esté verificado

### Puntos No Se Suman
1. **Verificar** que esté logueado
2. **Comprobar** que no haya reclamado hoy
3. **Revisar** la consola del navegador

## 📞 Soporte

Para problemas técnicos:
1. **Revisar** la consola del navegador (F12)
2. **Verificar** la configuración de Firebase
3. **Comprobar** la conexión a internet

## 🚀 Próximas Mejoras

- [ ] **Notificaciones push** para nuevos premios
- [ ] **Gamificación** con badges y niveles
- [ ] **Integración** con redes sociales
- [ ] **Analytics** avanzados
- [ ] **App móvil** nativa

---

**Desarrollado para Parrilla Los Nogales** 🍖
*Sistema de fidelización completo y funcional* 