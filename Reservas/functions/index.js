const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json"))
});

// Configuración global del logo para todas las notificaciones
const NOTIFICATION_ICON = '/Logo/Logo-Los-Nogales.png';

// Elimino el array manual de adminTokens y agrego función para obtenerlos de Firestore

async function getAdminTokens() {
  const snapshot = await admin.firestore().collection('adminTokens').where('activo', '==', true).get();
  return snapshot.docs.map(doc => doc.data().token);
}

// Función para enviar notificación con mejor manejo de errores
async function sendNotificationToAdmins(message, data = {}) {
  const results = [];
  
  const tokens = await getAdminTokens();

  for (const token of tokens) {
    try {
      const notificationMessage = {
        notification: message,
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          timestamp: Date.now().toString()
        },
        token: token,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channel_id: 'reservations',
            priority: 'high',
            default_sound: true,
            default_vibrate_timings: true,
            default_light_settings: true,
            icon: NOTIFICATION_ICON // Logo para Android
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              content_available: true
            }
          }
        },
        webpush: {
          notification: {
            requireInteraction: true,
            icon: NOTIFICATION_ICON, // Logo principal siempre PNG
            tag: 'reservation-notification',
            actions: [
              {
                action: 'view',
                title: 'Ver Reservas',
                icon: NOTIFICATION_ICON
              },
              {
                action: 'close',
                title: 'Cerrar',
                icon: NOTIFICATION_ICON
              }
            ]
          },
          fcm_options: {
            link: '/admin.html'
          }
        }
      };
      
      const response = await admin.messaging().send(notificationMessage);
      console.log(`✅ Notificación enviada exitosamente a token ${token.substring(0, 20)}...`);
      results.push({ token: token.substring(0, 20) + '...', success: true, messageId: response });
      
    } catch (error) {
      console.error(`❌ Error enviando notificación a token ${token.substring(0, 20)}...:`, error.message);
      
      // Si el token es inválido, lo removemos de la lista
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        console.warn(`⚠️ Token inválido detectado: ${token.substring(0, 20)}...`);
        // En producción, aquí deberías actualizar la base de datos para remover el token
      }
      
      results.push({ 
        token: token.substring(0, 20) + '...', 
        success: false, 
        error: error.message,
        code: error.code 
      });
    }
  }
  
  console.log('📊 Resumen de envío de notificaciones:', results);
  return results;
}

// Función para marcar un token como inactivo en Firestore
async function markTokenAsInactive(token) {
  try {
    await admin.firestore().collection('adminTokens').doc(token).update({ activo: false });
    console.log(`Token marcado como inactivo: ${token}`);
  } catch (e) {
    console.error(`Error marcando token como inactivo: ${token}`, e);
  }
}

// Función para obtener el token de un cliente por teléfono
async function getClientToken(phone) {
  try {
    const docSnap = await admin.firestore().collection('clientTokens').doc(phone).get();
    if (docSnap.exists && docSnap.data().activo) {
      return docSnap.data().token;
    }
  } catch (e) {
    console.error('Error obteniendo token de cliente:', e);
  }
  return null;
}

exports.notificarNuevaReserva = functions.firestore
  .document('reservations/{reservaId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const tokens = await getAdminTokens();
    const actor = data.createdByAdmin ? 'administrador' : 'cliente';
    // Notificación para el admin
    for (const token of tokens) {
      try {
        await admin.messaging().send({
          notification: {
            title: '¡Nueva reserva!',
            body: `Reserva de ${data.name || 'alguien'} (${data.phone || ''}) para ${data.diners || '?'} personas el ${data.date} a las ${data.time} creada por ${actor}.`
          },
          data: {
            type: 'new_reservation',
            reservationId: context.params.reservaId,
            timestamp: Date.now().toString()
          },
          token: token,
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channel_id: 'reservations',
              priority: 'high',
              default_sound: true,
              default_vibrate_timings: true,
              default_light_settings: true,
              icon: NOTIFICATION_ICON
            }
          },
          webpush: {
            notification: {
              requireInteraction: true,
              icon: NOTIFICATION_ICON,
              tag: 'reservation-notification',
              actions: [
                {
                  action: 'view',
                  title: 'Ver Reservas',
                  icon: NOTIFICATION_ICON
                },
                {
                  action: 'close',
                  title: 'Cerrar',
                  icon: NOTIFICATION_ICON
                }
              ]
            },
            fcm_options: {
              link: '/admin.html'
            }
          }
        });
      } catch (e) {
        if (
          e.code === 'messaging/invalid-registration-token' ||
          e.code === 'messaging/registration-token-not-registered' ||
          (e.message && e.message.includes('Requested entity was not found'))
        ) {
          await markTokenAsInactive(token);
        }
      }
    }
    // Notificación para el cliente
    if (data.phone) {
      const clientToken = await getClientToken(data.phone);
      if (clientToken) {
        try {
          await admin.messaging().send({
            notification: {
              title: '¡Reserva confirmada!',
              body: `Hola ${data.name}, tu reserva para ${data.date} a las ${data.time} fue creada exitosamente.`
            },
            data: {
              type: 'reservation_confirmed',
              reservationId: context.params.reservaId,
              timestamp: Date.now().toString()
            },
            token: clientToken,
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channel_id: 'reservations',
                priority: 'high',
                default_sound: true,
                default_vibrate_timings: true,
                default_light_settings: true,
                icon: NOTIFICATION_ICON
              }
            },
            webpush: {
              notification: {
                requireInteraction: true,
                icon: NOTIFICATION_ICON,
                tag: 'reservation-notification'
              },
              fcm_options: {
                link: '/'
              }
            }
          });
        } catch (e) {}
      }
    }
    return null;
  });

exports.notificarReservaModificada = functions.firestore
  .document('reservations/{reservaId}')
  .onUpdate(async (change, context) => {
    const afterData = change.after.data();
    const tokens = await getAdminTokens();
    const actor = afterData.updatedByAdmin ? 'administrador' : 'cliente';
    // Notificación para el admin
    for (const token of tokens) {
      try {
        await admin.messaging().send({
          notification: {
            title: '¡Reserva actualizada!',
            body: `Reserva de ${afterData.name || 'alguien'} (${afterData.phone || ''}) fue modificada por ${actor}.`
          },
          data: {
            type: 'reservation_updated',
            reservationId: context.params.reservaId,
            timestamp: Date.now().toString()
          },
          token: token,
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channel_id: 'reservations',
              priority: 'high',
              default_sound: true,
              default_vibrate_timings: true,
              default_light_settings: true,
              icon: NOTIFICATION_ICON
            }
          },
          webpush: {
            notification: {
              requireInteraction: true,
              icon: NOTIFICATION_ICON,
              tag: 'reservation-notification',
              actions: [
                {
                  action: 'view',
                  title: 'Ver Reservas',
                  icon: NOTIFICATION_ICON
                },
                {
                  action: 'close',
                  title: 'Cerrar',
                  icon: NOTIFICATION_ICON
                }
              ]
            },
            fcm_options: {
              link: '/admin.html'
            }
          }
        });
      } catch (e) {
        if (
          e.code === 'messaging/invalid-registration-token' ||
          e.code === 'messaging/registration-token-not-registered' ||
          (e.message && e.message.includes('Requested entity was not found'))
        ) {
          await markTokenAsInactive(token);
        }
      }
    }
    // Notificación para el cliente
    if (afterData.phone) {
      const clientToken = await getClientToken(afterData.phone);
      if (clientToken) {
        try {
          await admin.messaging().send({
            notification: {
              title: '¡Tu reserva fue actualizada!',
              body: `Hola ${afterData.name}, tu reserva para ${afterData.date} a las ${afterData.time} fue modificada.`
            },
            data: {
              type: 'reservation_updated',
              reservationId: context.params.reservaId,
              timestamp: Date.now().toString()
            },
            token: clientToken,
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channel_id: 'reservations',
                priority: 'high',
                default_sound: true,
                default_vibrate_timings: true,
                default_light_settings: true,
                icon: NOTIFICATION_ICON
              }
            },
            webpush: {
              notification: {
                requireInteraction: true,
                icon: NOTIFICATION_ICON,
                tag: 'reservation-notification'
              },
              fcm_options: {
                link: '/'
              }
            }
          });
        } catch (e) {}
      }
    }
    return null;
  });

exports.notificarReservaCancelada = functions.firestore
  .document('reservations/{reservaId}')
  .onDelete(async (snap, context) => {
    const data = snap.data();
    const tokens = await getAdminTokens();
    const actor = data.cancelledByAdmin ? 'administrador' : 'cliente';
    // Notificación para el admin
    for (const token of tokens) {
      try {
        await admin.messaging().send({
          notification: {
            title: '¡Reserva cancelada!',
            body: `Reserva de ${data.name || 'alguien'} (${data.phone || ''}) fue cancelada por ${actor}.`
          },
          data: {
            type: 'reservation_cancelled',
            reservationId: context.params.reservaId,
            timestamp: Date.now().toString()
          },
          token: token,
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channel_id: 'reservations',
              priority: 'high',
              default_sound: true,
              default_vibrate_timings: true,
              default_light_settings: true,
              icon: NOTIFICATION_ICON
            }
          },
          webpush: {
            notification: {
              requireInteraction: true,
              icon: NOTIFICATION_ICON,
              tag: 'reservation-notification',
              actions: [
                {
                  action: 'view',
                  title: 'Ver Reservas',
                  icon: NOTIFICATION_ICON
                },
                {
                  action: 'close',
                  title: 'Cerrar',
                  icon: NOTIFICATION_ICON
                }
              ]
            },
            fcm_options: {
              link: '/admin.html'
            }
          }
        });
      } catch (e) {
        if (
          e.code === 'messaging/invalid-registration-token' ||
          e.code === 'messaging/registration-token-not-registered' ||
          (e.message && e.message.includes('Requested entity was not found'))
        ) {
          await markTokenAsInactive(token);
        }
      }
    }
    // Notificación para el cliente
    if (data.phone) {
      const clientToken = await getClientToken(data.phone);
      if (clientToken) {
        try {
          await admin.messaging().send({
            notification: {
              title: '¡Tu reserva fue cancelada!',
              body: `Hola ${data.name}, tu reserva para ${data.date} a las ${data.time} fue cancelada.`
            },
            data: {
              type: 'reservation_cancelled',
              reservationId: context.params.reservaId,
              timestamp: Date.now().toString()
            },
            token: clientToken,
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channel_id: 'reservations',
                priority: 'high',
                default_sound: true,
                default_vibrate_timings: true,
                default_light_settings: true,
                icon: NOTIFICATION_ICON
              }
            },
            webpush: {
              notification: {
                requireInteraction: true,
                icon: NOTIFICATION_ICON,
                tag: 'reservation-notification'
              },
              fcm_options: {
                link: '/'
              }
            }
          });
        } catch (e) {}
      }
    }
    return null;
  });



// Función HTTP para enviar notificación de prueba
exports.sendTestNotification = functions.https.onRequest(async (req, res) => {
  const tokens = await getAdminTokens();
  const results = [];
  for (const token of tokens) {
    try {
      await admin.messaging().send({
        notification: {
          title: "Notificación de prueba - Parrilla Los Nogales",
          body: "¡Esto es una prueba de notificación push con logo!"
        },
        data: {
          type: 'test_notification',
          timestamp: Date.now().toString()
        },
        token: token,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channel_id: 'reservations',
            priority: 'high',
            default_sound: true,
            default_vibrate_timings: true,
            default_light_settings: true,
            icon: NOTIFICATION_ICON
          }
        },
        webpush: {
          notification: {
            requireInteraction: true,
            icon: NOTIFICATION_ICON,
            tag: 'test-notification',
            actions: [
              {
                action: 'view',
                title: 'Ver Reservas',
                icon: NOTIFICATION_ICON
              },
              {
                action: 'close',
                title: 'Cerrar',
                icon: NOTIFICATION_ICON
              }
            ]
          },
          fcm_options: {
            link: '/admin.html'
          }
        }
      });
      results.push({ token, success: true });
    } catch (error) {
      results.push({ token, success: false, error: error.message });
      // Si el error es de token inválido, márcalo como inactivo
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered' ||
        (error.message && error.message.includes('Requested entity was not found'))
      ) {
        await markTokenAsInactive(token);
      }
    }
  }
  res.json({ success: true, results });
});

// ================= MERCADO PAGO: Crear preferencia de pago =================
// (Eliminada la función createPreference porque ya no se usa en Netlify)