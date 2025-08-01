# 🕐 Sistema de Asistencias por Tiempo

## 📋 Descripción General

El sistema de asistencias por tiempo permite controlar automáticamente la presencia de los clientes en sus reservas, con control manual del administrador.

## 🎯 Funcionalidades Principales

### ✅ Control Automático
- **Verificación cada minuto**: El sistema verifica automáticamente las reservas del día
- **Tolerancia de 15 minutos**: Después de la hora de reserva + 15 minutos, se marca como ausente
- **Eliminación automática**: Las reservas ausentes se eliminan automáticamente

### 🎮 Control Manual del Admin
- **Botón Presente**: Marca al cliente como presente (azul)
- **Botón Ausente**: Marca al cliente como ausente (rojo) y elimina la reserva
- **Botón Pendiente**: Vuelve al estado pendiente (verde)

## 🎨 Estados Visuales

### 🟢 Pendiente (Verde)
- **Cuándo**: Antes de la hora de la reserva
- **Color**: Verde claro con borde verde
- **Acción**: Esperando al cliente

### 🔵 Presente (Azul)
- **Cuándo**: Cliente confirmado presente
- **Color**: Azul claro con borde azul
- **Acción**: Cliente atendido

### 🔴 Ausente (Rojo)
- **Cuándo**: Cliente no asistió después de la tolerancia
- **Color**: Rojo claro con borde rojo
- **Acción**: Reserva eliminada automáticamente

## ⚙️ Configuración Técnica

### Archivos Modificados
- `src/admin.js`: Sistema principal de asistencias
- `test-attendance.html`: Archivo de prueba visual

### Funciones Principales

#### `initializeAttendanceSystem()`
- Inicializa el sistema de asistencias
- Configura el timer de verificación (cada minuto)
- Configura los listeners de botones

#### `checkAttendanceByTime()`
- Verifica las reservas del día actual
- Marca como ausentes las que pasaron la tolerancia
- Actualiza la UI automáticamente

#### `markAttendanceStatus(reservationId, status, reason)`
- Marca el estado de asistencia de una reserva
- Actualiza Firestore con el nuevo estado
- Maneja la eliminación automática de ausentes

#### `generateAttendanceButtons(reservation)`
- Genera los botones de control de asistencia
- Aplica estilos según el estado actual
- Incluye iconos y colores apropiados

## 🔄 Flujo de Funcionamiento

1. **Reserva Creada** → Estado: Pendiente (verde)
2. **Hora de Reserva** → Sistema verifica cada minuto
3. **+15 minutos** → Si no está presente, se marca como ausente (rojo)
4. **Ausente** → Se elimina automáticamente de la lista
5. **Admin puede** → Marcar manualmente presente/ausente/pendiente

## 📱 Interfaz de Usuario

### Vista Móvil
- Tarjetas con colores según estado
- Botones de asistencia en la parte inferior
- Indicador visual del estado actual

### Vista Escritorio
- Tabla con columna de estado de asistencia
- Botones de asistencia en la columna de acciones
- Badges de estado en la columna de turno

## 🔔 Notificaciones

### Tipos de Notificación
- **✅ Éxito**: Asistencia marcada correctamente
- **⚠️ Advertencia**: Reserva marcada como ausente automáticamente
- **❌ Error**: Error al marcar asistencia

### Características
- Aparecen en la esquina superior derecha
- Desaparecen automáticamente después de 3 segundos
- Animaciones suaves de entrada y salida

## 🧪 Pruebas

### Archivo de Test
- `test-attendance.html`: Simulación visual del sistema
- Permite probar los cambios de estado
- Muestra las notificaciones

### Cómo Probar
1. Abrir `test-attendance.html` en el navegador
2. Hacer clic en los botones de asistencia
3. Verificar cambios de color y notificaciones
4. Probar en el admin real con reservas del día

## 🚀 Despliegue

### Comandos de Despliegue
```bash
# Construir el proyecto
npm run build

# Desplegar a Netlify
npx netlify deploy --prod
```

### URLs de Prueba
- **Admin**: https://reservasdivididas.netlify.app/admin.html
- **Test**: https://reservasdivididas.netlify.app/test-attendance.html

## 📊 Monitoreo

### Logs del Sistema
- Verificación de asistencias en consola
- Cambios de estado registrados
- Errores y advertencias

### Métricas
- Reservas marcadas como ausentes automáticamente
- Acciones manuales del admin
- Tiempo promedio de respuesta

## 🔧 Personalización

### Tolerancia de Tiempo
```javascript
// En checkAttendanceByTime()
const toleranceTime = new Date(reservationDateTime.getTime() + 15 * 60000); // 15 minutos
```

### Colores de Estado
```javascript
const ATTENDANCE_COLORS = {
    [ATTENDANCE_STATUS.PENDING]: 'bg-green-100 text-green-800 border-green-200',
    [ATTENDANCE_STATUS.PRESENT]: 'bg-blue-100 text-blue-800 border-blue-200',
    [ATTENDANCE_STATUS.ABSENT]: 'bg-red-100 text-red-800 border-red-200'
};
```

### Frecuencia de Verificación
```javascript
// En initializeAttendanceSystem()
setInterval(checkAttendanceByTime, 60000); // Cada minuto
```

## 🎯 Próximas Mejoras

- [ ] Notificaciones push para ausencias
- [ ] Reportes de asistencia diarios
- [ ] Configuración de tolerancia por admin
- [ ] Historial de cambios de asistencia
- [ ] Estadísticas de asistencia
- [ ] Integración con sistema de recordatorios

---

**Desarrollado para Los Nogales Reservas** 🍽️ 