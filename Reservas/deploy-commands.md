# Comandos de Deploy y Mantenimiento

## 🚀 Comandos para Deploy

### 1. Subir cambios al repositorio
```bash
# Agregar todos los cambios
git add .

# Crear commit con descripción
git commit -m "Mejoras: IDs cortos, modales visuales, validación 24h, estado de pago real"

# Subir al repositorio
git push origin main
```

### 2. Build para producción
```bash
# Navegar al directorio del proyecto
cd losnogales-reservas

# Instalar dependencias (si no están instaladas)
npm install

# Build para producción
npm run build
```

### 3. Verificar build
```bash
# Verificar que se creó la carpeta dist
ls -la dist/

# Verificar archivos generados
ls -la dist/
```

## 🔧 Comandos de Desarrollo

### Desarrollo local
```bash
# Iniciar servidor de desarrollo
npm run dev

# El servidor se ejecutará en http://localhost:5173
```

### Verificar dependencias
```bash
# Verificar dependencias instaladas
npm list

# Actualizar dependencias si es necesario
npm update
```

## 📊 Comandos de Mantenimiento

### Limpiar cache
```bash
# Limpiar cache de npm
npm cache clean --force

# Eliminar node_modules y reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Verificar configuración
```bash
# Verificar variables de entorno
echo $VITE_FIREBASE_API_KEY
echo $VITE_MP_ACCESS_TOKEN

# Verificar configuración de Vite
cat vite.config.js
```

## 🌐 Comandos de Netlify

### Deploy manual (si es necesario)
```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Login a Netlify
netlify login

# Deploy manual
netlify deploy --prod --dir=dist
```

### Verificar variables de entorno en Netlify
```bash
# Listar variables de entorno
netlify env:list

# Agregar variable de entorno
netlify env:set VITE_FIREBASE_API_KEY "tu_api_key"
```

## 🔍 Comandos de Debugging

### Verificar logs
```bash
# Ver logs de build en Netlify
netlify logs

# Ver logs en tiempo real
netlify logs --tail
```

### Verificar estado del sitio
```bash
# Ver información del sitio
netlify status

# Ver funciones desplegadas
netlify functions:list
```

## 📱 URLs Importantes

### Desarrollo
- Local: `http://localhost:5173`
- Cliente: `http://localhost:5173/`
- Admin: `http://localhost:5173/admin.html`

### Producción
- Cliente: `https://tu-sitio.netlify.app/`
- Admin: `https://tu-sitio.netlify.app/admin.html`

## 🔄 Flujo Completo de Deploy

```bash
# 1. Desarrollo y pruebas
npm run dev

# 2. Subir al repositorio
git add .
git commit -m "Descripción de cambios"
git push origin main

# 3. Build para producción
npm run build

# 4. Verificar build
ls -la dist/

# 5. Netlify detectará automáticamente los cambios
# Si necesitas deploy manual:
netlify deploy --prod --dir=dist
```

## ⚠️ Comandos de Emergencia

### Rollback a versión anterior
```bash
# Ver commits recientes
git log --oneline -5

# Revertir al commit anterior
git revert HEAD

# Forzar push (solo en emergencias)
git push origin main --force
```

### Limpiar completamente
```bash
# Limpiar todo y empezar de nuevo
rm -rf node_modules dist .netlify
npm install
npm run build
```

## 📋 Checklist de Deploy

- [ ] Variables de entorno configuradas en Netlify
- [ ] Firebase configurado correctamente
- [ ] Mercado Pago configurado
- [ ] Build exitoso sin errores
- [ ] Pruebas en desarrollo local
- [ ] Commit y push al repositorio
- [ ] Verificación en producción
- [ ] Pruebas de funcionalidad principal
- [ ] Pruebas de pago (modo test)
- [ ] Verificación de notificaciones 