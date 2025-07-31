# Sistema de Fidelización - Parrilla Los Nogales

## 📋 Descripción

Sistema completo de fidelización de clientes para "Parrilla Los Nogales" con autenticación Firebase, gestión de puntos, premios y panel de administración.

## 🚀 Características

### Para Clientes:
- ✅ Registro y login con verificación por email
- ✅ Sistema de puntos por diferentes acciones
- ✅ Dashboard personalizado con progreso
- ✅ Catálogo de premios disponibles
- ✅ Historial de transacciones
- ✅ Perfil editable
- ✅ Códigos de referido

### Para Administradores:
- ✅ Panel de administración completo
- ✅ Gestión de usuarios y puntos
- ✅ Validación de canjes
- ✅ Estadísticas del programa
- ✅ Exportación de datos
- ✅ Análisis de engagement

## 📁 Estructura de Archivos

```
├── loyalty-system.html      # Sistema principal de fidelización
├── loyalty-admin.html       # Panel de administración
├── loyalty-api.js          # Funciones de Firebase y API
├── loyalty-styles.css      # Estilos del sistema
├── index.html              # Página principal (modificada)
├── carta.html              # Carta del restaurante (modificada)
└── README-LOYALTY.md       # Este archivo
```

## 🔧 Configuración

### 1. Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto o usa uno existente
3. Habilita Authentication con Email/Password
4. Habilita Firestore Database
5. Configura las reglas de seguridad de Firestore

### 2. Actualizar Configuración

Edita el archivo `loyalty-api.js` y reemplaza la configuración de Firebase:

```javascript
const firebaseConfig = {
    apiKey: "tu-api-key-aqui",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto-id",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "tu-sender-id",
    appId: "tu-app-id"
};
```

### 3. Configurar Reglas de Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuarios pueden leer/escribir solo sus propios datos
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Transacciones de puntos
    match /pointTransactions/{transactionId} {
      allow read, write: if request.auth != null && 
        (resource.data.userId == request.auth.uid || 
         exists(/databases/$(database)/documents/admins/$(request.auth.uid)));
    }
    
    // Canjes
    match /redemptions/{redemptionId} {
      allow read, write: if request.auth != null && 
        (resource.data.userId == request.auth.uid || 
         exists(/databases/$(database)/documents/admins/$(request.auth.uid)));
    }
    
    // Administradores
    match /admins/{adminId} {
      allow read: if request.auth != null && request.auth.uid == adminId;
    }
  }
}
```

### 4. Configurar Administradores

Para agregar un administrador, crea un documento en la colección `admins`:

```javascript
// En Firebase Console > Firestore
// Colección: admins
// Documento ID: [user-uid]
// Contenido: { role: "admin", email: "admin@losnogales.com" }
```

## 🎯 Sistema de Puntos

### Puntos por Acción:
- **Visita diaria**: +10 puntos (una vez por día)
- **Reserva online**: +5 puntos
- **Referido**: +20 puntos (para ambos usuarios)
- **Reseña en Google**: +20 puntos
- **Post en Instagram**: +15 puntos

### Premios Disponibles:
- **50 puntos**: Gaseosa o postre gratis
- **100 puntos**: Entrada o empanada gratis
- **200 puntos**: 10% descuento en mesa
- **300 puntos**: Vino regional o parrillada para 1
- **500 puntos**: Parrillada libre completa para 2

## 🔐 Seguridad

- Verificación de email obligatoria
- Protección de rutas de administrador
- Validación de acciones para evitar fraude
- Límites de puntos por acción
- Registro de todas las transacciones

## 📱 Integración

### En index.html:
- Botón "Programa de Fidelización" agregado
- Enlace directo al sistema

### En carta.html:
- Sección de puntos para usuarios logueados
- Botón para reclamar visita diaria
- Enlaces al sistema principal

## 🎨 Diseño

- Colores de Los Nogales (verde #28a745)
- Diseño responsive y moderno
- Iconos de Phosphor Icons
- Animaciones suaves
- Consistente con el diseño existente

## 📊 Base de Datos

### Colecciones:
- **users**: Datos de usuarios, puntos, etc.
- **pointTransactions**: Historial de transacciones
- **redemptions**: Canjes realizados
- **admins**: Lista de administradores

### Estructura de Usuario:
```javascript
{
  email: "usuario@email.com",
  name: "Nombre Completo",
  phone: "264-459-3336",
  points: 150,
  totalPointsEarned: 200,
  totalPointsRedeemed: 50,
  memberSince: timestamp,
  referralCode: "ABC123",
  dailyVisitClaimed: false,
  lastDailyVisit: timestamp
}
```

## 🚀 Despliegue

1. Sube todos los archivos a tu servidor web
2. Asegúrate de que Firebase esté configurado correctamente
3. Prueba el registro y login de usuarios
4. Configura al menos un administrador
5. Prueba el panel de administración

## 🔧 Personalización

### Cambiar Premios:
Edita la función `getAvailableRewards()` en `loyalty-api.js`

### Cambiar Puntos:
Modifica los valores en las funciones de puntos en `loyalty-api.js`

### Cambiar Colores:
Edita las variables CSS en `loyalty-styles.css`

## 📞 Soporte

Para soporte técnico o personalizaciones adicionales, contacta al desarrollador.

## 📝 Notas Importantes

- El sistema requiere conexión a internet para funcionar
- Los usuarios deben verificar su email antes de usar el sistema
- Los administradores deben ser configurados manualmente en Firebase
- Se recomienda hacer respaldos regulares de la base de datos
- El sistema está optimizado para móviles y desktop

## 🔄 Actualizaciones Futuras

- Gráficos de análisis con Chart.js
- Notificaciones push
- Integración con WhatsApp Business API
- Sistema de cupones digitales
- Gamificación avanzada 