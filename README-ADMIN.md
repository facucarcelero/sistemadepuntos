# Panel de Administración - Parrilla Los Nogales

## 📋 Descripción

El Panel de Administración es un sistema unificado que permite gestionar tanto el sistema de fidelización como el sistema de reservas y menú desde una sola interfaz. Está diseñado para administradores y proporciona control total sobre todos los aspectos del negocio.

## 🚀 Características Principales

### 📊 Dashboard
- **Estadísticas en tiempo real**: Usuarios registrados, puntos totales, premios canjeados, reservas activas
- **Actividad reciente**: Últimas transacciones y acciones del sistema
- **Vista general del negocio**: Métricas clave para toma de decisiones

### ⭐ Sistema de Fidelización
- **Gestión de usuarios**: Ver, editar y eliminar usuarios del programa de fidelización
- **Gestión de premios**: Crear, editar y eliminar premios disponibles
- **Canjes pendientes**: Validar o rechazar solicitudes de canje de premios
- **Control de puntos**: Modificar puntos de usuarios y ver historial de transacciones

### 🍽️ Gestión de Menú
- **Gestión de platos**: Agregar, editar y eliminar platos del menú
- **Categorías**: Organizar platos por categorías (entradas, principales, postres, etc.)
- **Precios**: Actualizar precios y descripciones
- **Disponibilidad**: Controlar qué platos están disponibles

### 📅 Gestión de Reservas
- **Ver reservas**: Lista completa de todas las reservas
- **Estados**: Confirmar, cancelar o modificar reservas
- **Filtros**: Buscar por fecha, estado o cliente
- **Gestión de capacidad**: Control de disponibilidad de mesas

### 👥 Gestión de Usuarios
- **Todos los usuarios**: Vista completa de usuarios registrados
- **Roles**: Asignar roles de administrador o usuario
- **Estados**: Activar/desactivar cuentas
- **Información detallada**: Datos completos de cada usuario

### 📈 Reportes y Estadísticas
- **Reportes personalizados**: Generar reportes por período y tipo
- **Exportación**: Descargar reportes en diferentes formatos
- **Métricas avanzadas**: Análisis detallado del rendimiento del negocio

## 🔐 Acceso y Seguridad

### Requisitos de Acceso
- **Solo administradores**: El panel solo es accesible para usuarios con rol de administrador
- **Autenticación**: Requiere iniciar sesión con credenciales válidas
- **Verificación de permisos**: Verificación automática de permisos de administrador

### Seguridad
- **Verificación de email**: Los usuarios deben verificar su email antes de acceder
- **Sesiones seguras**: Manejo seguro de sesiones de usuario
- **Logs de actividad**: Registro de todas las acciones administrativas

## 🛠️ Uso del Panel

### Acceso al Panel
1. **Iniciar sesión** en el sistema de fidelización (`loyalty-system.html`)
2. **Verificar que tienes permisos de administrador**
3. **Hacer clic en el botón "Admin"** en la barra de navegación
4. **El panel se abrirá en una nueva pestaña**

### Navegación
- **Pestañas**: Usar las pestañas superiores para cambiar entre secciones
- **Filtros**: Utilizar los filtros para buscar información específica
- **Acciones**: Botones de acción para realizar operaciones

### Funciones Principales

#### Dashboard
- Ver estadísticas generales del sistema
- Revisar actividad reciente
- Monitorear el estado del negocio

#### Sistema de Fidelización
- **Usuarios**: Gestionar usuarios del programa de puntos
- **Premios**: Administrar premios disponibles para canje
- **Canjes**: Validar solicitudes de canje de premios

#### Gestión de Menú
- **Platos**: Agregar, editar o eliminar platos
- **Categorías**: Organizar el menú por categorías
- **Precios**: Actualizar precios y descripciones

#### Reservas
- **Ver reservas**: Lista completa de reservas
- **Gestionar estados**: Confirmar o cancelar reservas
- **Filtros**: Buscar reservas específicas

#### Usuarios
- **Todos los usuarios**: Vista completa de usuarios
- **Roles**: Asignar permisos de administrador
- **Gestión**: Activar/desactivar cuentas

#### Reportes
- **Generar reportes**: Por período y tipo
- **Exportar datos**: Descargar información
- **Análisis**: Métricas detalladas del negocio

## 🔧 Configuración Técnica

### Archivos Principales
- `admin-panel.html`: Panel principal de administración
- `loyalty-api.js`: API para funciones de fidelización
- `loyalty-system.html`: Sistema de fidelización (con botón de acceso al admin)

### Dependencias
- **Firebase**: Autenticación y base de datos
- **Phosphor Icons**: Iconografía
- **Inter Font**: Tipografía

### Estructura de Datos
- **Usuarios**: Información de usuarios del programa de fidelización
- **Premios**: Premios disponibles para canje
- **Transacciones**: Historial de puntos y canjes
- **Reservas**: Sistema de reservas (integración futura)
- **Menú**: Platos y categorías (integración futura)

## 🚀 Funcionalidades Futuras

### Integración Completa
- **Sistema de reservas**: Integración completa con el sistema de reservas
- **Gestión de menú**: Integración con el sistema de menú de carta.html
- **Notificaciones**: Sistema de notificaciones en tiempo real

### Reportes Avanzados
- **Gráficos interactivos**: Visualización de datos con gráficos
- **Exportación avanzada**: PDF, Excel, CSV
- **Reportes automáticos**: Envío automático de reportes por email

### Automatización
- **Backups automáticos**: Respaldo automático de datos
- **Alertas**: Notificaciones de eventos importantes
- **Mantenimiento**: Tareas automáticas de mantenimiento

## 📞 Soporte

### Problemas Comunes
1. **No puedo acceder al panel**: Verificar que tienes permisos de administrador
2. **Error de autenticación**: Verificar que tu email esté verificado
3. **Datos no se cargan**: Verificar conexión a internet y Firebase

### Contacto
Para soporte técnico o preguntas sobre el panel de administración, contactar al desarrollador del sistema.

## 🔄 Actualizaciones

### Versión Actual
- **v1.0**: Panel básico de administración
- **Funcionalidades**: Dashboard, gestión de fidelización, usuarios básicos

### Próximas Versiones
- **v1.1**: Integración con sistema de reservas
- **v1.2**: Gestión completa de menú
- **v2.0**: Reportes avanzados y automatización

---

**Panel de Administración - Parrilla Los Nogales**
*Sistema unificado para la gestión integral del negocio* 