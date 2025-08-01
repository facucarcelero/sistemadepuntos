# Sistema de Notificaciones - Parrilla Los Nogales

## 🎯 Objetivo
Garantizar que el logo del restaurante se muestre siempre en todas las notificaciones push, tanto en web como en dispositivos móviles.

## 📱 Configuración de Iconos

### Archivos de Iconos
- **Logo Principal**: `/Logo/Logo-Los-Nogales.png` (44KB, 212 líneas)
- **Badge**: `/Logo/favicon-32x32.png` (1.7KB, 9 líneas)
- **Apple Touch**: `/Logo/apple-touch-icon.png` (26KB, 106 líneas)

### Configuración Centralizada
Todas las rutas de iconos están centralizadas en `src/config.js` para garantizar consistencia:

```javascript
export const NOTIFICATION_CONFIG = {
  ICON_MAIN: '/Logo/Logo-Los-Nogales.png', // Logo principal
  ICON_BADGE: '/Logo/favicon-32x32.png',   // Badge pequeño
  ICON_APPLE: '/Logo/apple-touch-icon.png' // Para Apple
};
```

## 🔧 Componentes Actualizados

### 1. Service Worker de Firebase (`public/firebase-messaging-sw.js`)
- ✅ Usa siempre el logo PNG principal
- ✅ Configuración consistente de iconos
- ✅ Manejo de acciones de notificaciones
- ✅ Logs detallados para debugging

### 2. Service Worker Personalizado (`public/sw.js`)
- ✅ Cachea todos los archivos de iconos
- ✅ Configuración global de iconos
- ✅ Manejo mejorado de eventos

### 3. Funciones de Firebase (`functions/index.js`)
- ✅ Icono configurado para Android
- ✅ Icono configurado para Web Push
- ✅ Configuración consistente en todas las funciones
- ✅ Datos adicionales para mejor tracking

### 4. Frontend Admin (`src/admin.js`)
- ✅ Usa configuración centralizada
- ✅ Notificación de prueba con logo
- ✅ Funciones helper para consistencia

## 🚀 Mejoras Implementadas

### Compatibilidad Multiplataforma
- **Web**: Logo PNG siempre visible
- **Android**: Icono configurado en notificaciones
- **iOS**: Soporte para Apple Touch Icon
- **PWA**: Cache de iconos para offline

### Configuración de Notificaciones
- **Tag**: `reservation-notification` para agrupar
- **RequireInteraction**: `true` para que no se cierren automáticamente
- **Actions**: Botones "Ver Reservas" y "Cerrar"
- **Badge**: Icono pequeño para mejor UX

### Logging y Debugging
- Logs detallados en todos los Service Workers
- Tracking de eventos de notificaciones
- Manejo de errores mejorado

## 📋 Checklist de Verificación

### Antes de Desplegar
- [ ] Verificar que `/Logo/Logo-Los-Nogales.png` existe y es accesible
- [ ] Confirmar que `/Logo/favicon-32x32.png` existe
- [ ] Probar notificación de prueba en el panel admin
- [ ] Verificar que el logo se muestra en Chrome/Edge
- [ ] Probar en dispositivo móvil Android
- [ ] Verificar cache de Service Worker

### Después del Despliegue
- [ ] Limpiar cache del navegador
- [ ] Desinstalar PWA si existe
- [ ] Registrar nuevo Service Worker
- [ ] Probar notificación de prueba
- [ ] Verificar que solo se recibe una notificación por acción

## 🔍 Troubleshooting

### El logo no se muestra
1. Verificar que el archivo PNG existe en `/Logo/Logo-Los-Nogales.png`
2. Limpiar cache del navegador
3. Verificar que el Service Worker está registrado
4. Revisar logs en la consola del navegador

### Notificaciones duplicadas
1. Verificar que solo hay un Service Worker activo
2. Comprobar que no hay código duplicado en el frontend
3. Limpiar tokens duplicados en Firestore
4. Cerrar todas las pestañas y abrir solo una

### Problemas en móviles
1. El logo puede no mostrarse en algunos dispositivos Android
2. Verificar configuración de Android en Firebase Functions
3. Probar en diferentes navegadores móviles

## 📞 Soporte
Para problemas con notificaciones:
1. Revisar logs en Firebase Functions
2. Verificar configuración de FCM
3. Comprobar tokens en Firestore
4. Revisar permisos de notificaciones en el navegador 