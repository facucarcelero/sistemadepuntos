# ⏰ Sistema de Timer Automático para Reservas

## 🎯 **Objetivo**
Sistema automático que gestiona las reservas en tiempo real, marcando como tardías las que no llegan a tiempo y eliminándolas al final del turno.

## ⚙️ **Configuración**

### **Tiempos Configurados:**
- **15 minutos**: Tiempo de tolerancia para marcar como tardía
- **16:00**: Fin del turno de almuerzo
- **23:59**: Fin del turno de cena

### **Estados de Asistencia:**
- 🟢 **Pendiente**: Antes de la hora de reserva
- 🔵 **Presente**: Cliente llegó a tiempo
- 🟠 **Tardía**: 15+ minutos después de la hora (automático)
- 🔴 **Ausente**: Marcado manualmente por admin
- ⚫ **Cancelado**: Reserva cancelada

## 🔄 **Flujo Automático**

### **1. Verificación de Reservas Tardías (Cada minuto)**
```
Reserva pendiente → 15 min después de la hora → Marcar como TARDÍA
```

### **2. Eliminación al Final del Turno (Cada minuto)**
```
Reserva tardía/ausente → Fin del turno → Eliminar + Guardar en historial
```

## 📊 **Estados Visuales**

### **Colores por Estado:**
- 🟢 **Verde**: Pendiente
- 🔵 **Azul**: Presente  
- 🟠 **Naranja**: Tardía
- 🔴 **Rojo**: Ausente
- ⚫ **Gris**: Cancelado

### **Botones Disponibles (Solo Admin):**
- ✅ **Presente**: Cliente llegó
- ❌ **Ausente**: Cliente no llegó
- ⏰ **Pendiente**: Resetear estado
- 🕐 **Tardía**: Marcar manualmente

## 🔔 **Notificaciones Automáticas**

### **Cuando se marca como tardía:**
- ⏰ "Reserva de [Nombre] marcada como tardía"

### **Cuando se elimina al final del turno:**
- 🗑️ "Reserva de [Nombre] eliminada al final del turno"

## 📝 **Historial de Eliminaciones**

### **Datos guardados:**
- ✅ Información completa de la reserva
- ✅ Motivo: "Eliminación automática al final del turno"
- ✅ Estado de asistencia al momento de eliminar
- ✅ Turno (almuerzo/cena)
- ✅ Timestamp de eliminación

### **Acceso al historial:**
- 📋 Botón "Historial de Cancelaciones" en el panel admin
- 🔍 Búsqueda por nombre, fecha, motivo
- 📊 Filtros por tipo de eliminación

## 🎛️ **Control Manual**

### **Admin puede:**
- ✅ Marcar cualquier estado manualmente
- ✅ Sobrescribir estados automáticos
- ✅ Ver todas las reservas con sus estados
- ✅ Acceder al historial completo

### **Observador puede:**
- 👁️ Ver estados y colores
- 👁️ Ver notificaciones automáticas
- ❌ No puede modificar estados

## ⚡ **Ventajas del Sistema**

### **Para el Negocio:**
- 🎯 **Control en tiempo real** de asistencia
- 📊 **Visibilidad inmediata** de reservas tardías
- 🗑️ **Limpieza automática** al final del día
- 📝 **Historial completo** para análisis

### **Para la Comunicación:**
- 🔔 **Notificaciones automáticas** de cambios
- 📱 **Actualización en tiempo real** en todas las pantallas
- 🎨 **Códigos de color** claros y consistentes
- 📊 **Datos para reportes** y análisis

## 🔧 **Configuración Avanzada**

### **Modificar tiempos:**
```javascript
const TIMER_CONFIG = {
    LATE_MINUTES: 15, // Cambiar minutos de tolerancia
    TURN_END_TIMES: {
        'almuerzo': '16:00', // Cambiar fin de almuerzo
        'cena': '23:59'      // Cambiar fin de cena
    }
};
```

### **Agregar nuevos turnos:**
```javascript
TURN_END_TIMES: {
    'almuerzo': '16:00',
    'cena': '23:59',
    'desayuno': '11:00'  // Nuevo turno
}
```

## 🚀 **Implementación**

### **Archivos modificados:**
- `src/admin.js`: Lógica principal del timer
- `TIMER_AUTOMATICO.md`: Esta documentación

### **Funciones principales:**
- `startAutomaticTimer()`: Inicia el sistema
- `checkLateReservations()`: Verifica reservas tardías
- `checkTurnEndReservations()`: Verifica fin de turno
- `markReservationAsLate()`: Marca como tardía
- `deleteReservationAtTurnEnd()`: Elimina al final del turno

---

**¡Sistema listo para control total de asistencias en tiempo real!** ⏰✨ 