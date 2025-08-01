// Configuración centralizada para iconos y notificaciones
export const NOTIFICATION_CONFIG = {
  // Iconos principales - siempre usar PNG para mejor compatibilidad
  ICON_MAIN: '/Logo/Logo-Los-Nogales.png', // Logo principal del restaurante
  ICON_APPLE: '/Logo/apple-touch-icon.png', // Para dispositivos Apple
  
  // Configuración de notificaciones
  DEFAULT_TITLE: 'Parrilla Los Nogales',
  DEFAULT_BODY: 'Tienes una nueva notificación',
  
  // Configuración de Service Worker
  SW_TAG: 'reservation-notification',
  SW_REQUIRE_INTERACTION: true,
  
  // Acciones de notificaciones
  ACTIONS: [
    {
      action: 'view',
      title: 'Ver Reservas',
      icon: '/Logo/favicon-32x32.png'
    },
    {
      action: 'close',
      title: 'Cerrar',
      icon: '/Logo/favicon-32x32.png'
    }
  ]
};

// Función helper para crear opciones de notificación consistentes
export function createNotificationOptions(title, body, data = {}) {
  return {
    title: title || NOTIFICATION_CONFIG.DEFAULT_TITLE,
    body: body || NOTIFICATION_CONFIG.DEFAULT_BODY,
    icon: NOTIFICATION_CONFIG.ICON_MAIN,
    badge: NOTIFICATION_CONFIG.ICON_BADGE,
    tag: NOTIFICATION_CONFIG.SW_TAG,
    requireInteraction: NOTIFICATION_CONFIG.SW_REQUIRE_INTERACTION,
    data: {
      timestamp: Date.now().toString(),
      ...data
    },
    actions: NOTIFICATION_CONFIG.ACTIONS
  };
}

// Función helper para crear opciones de notificación web push
export function createWebPushOptions(title, body, data = {}) {
  return {
    notification: {
      title: title || NOTIFICATION_CONFIG.DEFAULT_TITLE,
      body: body || NOTIFICATION_CONFIG.DEFAULT_BODY,
      icon: NOTIFICATION_CONFIG.ICON_MAIN,
      badge: NOTIFICATION_CONFIG.ICON_BADGE,
      tag: NOTIFICATION_CONFIG.SW_TAG,
      requireInteraction: NOTIFICATION_CONFIG.SW_REQUIRE_INTERACTION,
      actions: NOTIFICATION_CONFIG.ACTIONS
    },
    data: {
      timestamp: Date.now().toString(),
      ...data
    }
  };
}

// Función helper para crear opciones de notificación Android
export function createAndroidOptions() {
  return {
    priority: 'high',
    notification: {
      sound: 'default',
      channel_id: 'reservations',
      priority: 'high',
      default_sound: true,
      default_vibrate_timings: true,
      default_light_settings: true,
      icon: NOTIFICATION_CONFIG.ICON_MAIN
    }
  };
}

 