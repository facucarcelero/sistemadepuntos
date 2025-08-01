# 📋 Historial de Cancelaciones - Sistema de Asistencias

## 🔄 Flujo de Cancelaciones

### **Cancelaciones Manuales (Admin)**
1. **Admin marca "Ausente"** → Se guarda en historial
2. **Admin elimina reserva** → Se guarda en historial
3. **Motivo**: "Admin - Ausente" o "Admin - Eliminada"

### **Cancelaciones Automáticas (Sistema)**
1. **Sistema detecta ausencia** → Se guarda en historial
2. **Motivo**: "Ausente - Sistema de Asistencias"

## 📊 Datos Guardados en Historial

### **Información Básica:**
- ✅ Nombre del cliente
- ✅ Teléfono
- ✅ Fecha y hora de la reserva
- ✅ Número de comensales
- ✅ Área y notas
- ✅ Fecha de cancelación
- ✅ Quién canceló (Admin/Sistema)

### **Información de Asistencia:**
- ✅ Estado de asistencia (`absent`)
- ✅ Motivo de cancelación
- ✅ Todos los datos originales de la reserva

## 🎯 Cómo Ver el Historial

### **En el Admin Panel:**
1. Click en **"Historial de cancelaciones"**
2. Se abre el modal con todas las cancelaciones
3. **Filtros disponibles**:
   - Por fecha
   - Por motivo
   - Por tipo (Manual/Automática)

### **Tipos de Cancelaciones:**
- **🟢 Manual**: Admin marcó como ausente
- **🔴 Automática**: Sistema detectó ausencia
- **⚫ Eliminación**: Admin eliminó manualmente

## ⚙️ Configuración Técnica

### **Colección en Firestore:**
```
cancellations/
├── {reservationId}_{timestamp}/
│   ├── reservationId: string
│   ├── name: string
│   ├── phone: string
│   ├── date: string
│   ├── time: string
│   ├── diners: number
│   ├── area: string
│   ├── notes: string
│   ├── cancelledAt: timestamp
│   ├── cancelledBy: string
│   ├── motivo: string
│   ├── attendanceStatus: string
│   └── ... (todos los campos originales)
```

### **Funciones Principales:**
- `markAttendanceStatus()` - Guarda en historial al marcar ausente
- `deleteReservation()` - Guarda en historial al eliminar manualmente
- `fetchCancellations()` - Obtiene historial para mostrar

## 🔍 Búsqueda en Historial

### **Filtros Disponibles:**
- **Por fecha**: Ver cancelaciones de un día específico
- **Por cliente**: Buscar por nombre o teléfono
- **Por motivo**: Ver solo ausencias automáticas o manuales
- **Por turno**: Solo almuerzos o cenas canceladas

### **Exportación:**
- **Excel**: Exportar historial completo
- **PDF**: Generar reporte de cancelaciones
- **Filtrado**: Exportar según filtros aplicados

## 📈 Estadísticas

### **Métricas Disponibles:**
- **Total cancelaciones** por período
- **Cancelaciones automáticas** vs manuales
- **Horarios más problemáticos** (más ausencias)
- **Clientes frecuentes** en ausencias

### **Reportes:**
- **Diario**: Cancelaciones del día
- **Semanal**: Resumen semanal
- **Mensual**: Análisis mensual

## 🚀 Próximas Mejoras

- [ ] **Notificaciones** cuando se cancela por ausencia
- [ ] **Análisis predictivo** de ausencias
- [ ] **Recordatorios automáticos** antes de la hora
- [ ] **Estadísticas avanzadas** de asistencia
- [ ] **Integración** con sistema de recordatorios

---

**Sistema implementado para Los Nogales Reservas** 🍽️ 