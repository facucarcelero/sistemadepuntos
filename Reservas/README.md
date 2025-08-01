# Sistema de Reservas - Parrilla Los Nogales

Sistema completo de reservas con pago online, notificaciones y panel de administración.

## 🚀 Características Implementadas

### ✅ Mejoras Recientes
- **IDs cortos y aleatorios**: IDs de 5 caracteres (letras y números) para reservas
- **Modal visual de eliminación**: Confirmación visual y consistente para eliminar reservas
- **Validación de 24h**: Solo se pueden cancelar reservas con más de 24h de anticipación
- **Estado real de pago**: Muestra "Pagada", "Pendiente", "Rechazada" o "Desconocido"
- **Redirección automática a WhatsApp**: Tras pago exitoso, redirige con mensaje preestablecido
- **Actualización automática de estado**: El estado de pago se actualiza en Firestore automáticamente
- **Modales visuales**: Interfaz consistente para edición y eliminación de reservas

### 🔧 Funcionalidades Principales
- **Reservas online** con validación de capacidad
- **Pago con Mercado Pago** (seña de $100)
- **Panel de administración** completo
- **Búsqueda de reservas** por nombre o teléfono
- **Notificaciones push** para el administrador
- **Exportación a Excel**
- **Comprobantes PDF** automáticos
- **Integración con WhatsApp** para confirmaciones

## 🛠️ Configuración

### Variables de Entorno (Netlify)

Configura estas variables en tu proyecto de Netlify:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=tu_api_key_de_firebase
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_proyecto_id
VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Mercado Pago Configuration
VITE_MP_PUBLIC_KEY=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_MP_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# WhatsApp Configuration
VITE_WHATSAPP_NUMBER=5492644593336

# App Configuration
VITE_MAX_CAPACITY=160
VITE_DEPOSIT_AMOUNT=100
```

## 📦 Instalación y Deploy

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
```bash
cp env.example .env.local
# Editar .env.local con tus valores reales
```

### 3. Desarrollo local
```bash
npm run dev
```

### 4. Build para producción
```bash
npm run build
```

### 5. Deploy en Netlify

#### Opción A: Deploy automático desde GitHub
1. Conecta tu repositorio a Netlify
2. Configura las variables de entorno en Netlify
3. Configura el directorio de build: `losnogales-reservas`
4. Comando de build: `npm run build`
5. Directorio de publicación: `losnogales-reservas/dist`

#### Opción B: Deploy manual
```bash
# Subir cambios al repositorio
git add .
git commit -m "Actualización del sistema de reservas"
git push origin main

# Build local
npm run build

# Subir dist/ a Netlify
```

## 🔄 Flujo de Trabajo Profesional

### Para cada actualización:

1. **Desarrollo local**:
   ```bash
   npm run dev
   ```

2. **Subir al repositorio**:
   ```bash
   git add .
   git commit -m "Descripción de los cambios"
   git push origin main
   ```

3. **Build y deploy**:
   ```bash
   npm run build
   # Netlify detectará automáticamente los cambios
   ```

## 📱 URLs de Acceso

- **Cliente**: `https://tu-sitio.netlify.app/`
- **Administrador**: `https://tu-sitio.netlify.app/admin.html`

## 🔐 Seguridad

- ✅ Credenciales en variables de entorno
- ✅ Validación de datos en frontend y backend
- ✅ Autenticación anónima de Firebase
- ✅ Validación de 24h para cancelaciones
- ✅ IDs únicos y aleatorios para reservas

## 📊 Estructura del Proyecto

```
losnogales-reservas/
├── src/
│   ├── cliente.js      # Lógica del cliente
│   ├── admin.js        # Panel de administración
│   ├── config.js       # Configuración de notificaciones
│   └── style.css       # Estilos
├── public/
│   ├── Logo/           # Logos y favicons
│   └── firebase-messaging-sw.js
├── index.html          # Página principal
├── admin.html          # Panel de admin
└── package.json
```

## 🎯 Funcionalidades Específicas

### Sistema de IDs
- IDs aleatorios de 5 caracteres (A-Z, 0-9)
- Se usan en comprobantes, WhatsApp y lista de reservas
- Fáciles de recordar y comunicar

### Validación de Cancelación
- Solo permite cancelar con 24h de anticipación
- Modal visual con validación del ID exacto
- Mensajes informativos para el usuario

### Flujo de Pago
1. Cliente crea reserva → Se genera ID corto
2. Se guarda en Firestore con estado "pendiente"
3. Redirección a Mercado Pago
4. Pago exitoso → Actualización automática en Firestore
5. Redirección a WhatsApp con mensaje preestablecido

### Panel de Administración
- Vista de todas las reservas con filtros
- Búsqueda avanzada por nombre/teléfono
- Edición y eliminación con modales visuales
- Exportación a Excel
- Notificaciones push en tiempo real

## 🆘 Soporte

Para problemas o consultas:
- Revisar la consola del navegador para errores
- Verificar variables de entorno en Netlify
- Comprobar configuración de Firebase
- Validar credenciales de Mercado Pago

## 📈 Próximas Mejoras

- [ ] Dashboard con estadísticas
- [ ] Sistema de recordatorios automáticos
- [ ] Integración con WhatsApp Business API
- [ ] Múltiples métodos de pago
- [ ] Sistema de fidelización 
