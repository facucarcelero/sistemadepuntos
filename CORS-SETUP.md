# Configuración CORS para Firebase Storage

## Problema
El error de CORS ocurre porque Firebase Storage no permite acceso desde dominios externos por defecto. Necesitas configurar las reglas CORS en Firebase Console.

## Solución

### Paso 1: Instalar Firebase CLI (si no lo tienes)
```bash
npm install -g firebase-tools
```

### Paso 2: Iniciar sesión en Firebase
```bash
firebase login
```

### Paso 3: Configurar CORS para tu bucket
```bash
# Navegar a tu proyecto
firebase use losnogales-reservas

# Aplicar configuración CORS
gsutil cors set cors-config.json gs://losnogales-reservas.firebasestorage.app
```

### Paso 4: Verificar configuración
```bash
gsutil cors get gs://losnogales-reservas.firebasestorage.app
```

## Configuración Manual (Alternativa)

Si no puedes usar Firebase CLI, puedes configurar CORS manualmente:

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto `losnogales-reservas`
3. Ve a Storage
4. Ve a la pestaña "Rules"
5. Agrega las siguientes reglas:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

6. Ve a [Google Cloud Console](https://console.cloud.google.com/)
7. Selecciona tu proyecto
8. Ve a Cloud Storage > Browser
9. Selecciona tu bucket
10. Ve a la pestaña "CORS"
11. Agrega la configuración del archivo `cors-config.json`

## Dominios Autorizados
- `https://sistemadepuntos.netlify.app` (producción)
- `http://localhost:8000` (desarrollo local)
- `http://localhost:3000` (desarrollo alternativo)

## Verificación
Después de aplicar la configuración, prueba subir una imagen desde tu aplicación. El error de CORS debería desaparecer.

## Notas
- Los cambios pueden tardar unos minutos en propagarse
- Si sigues teniendo problemas, verifica que el dominio esté exactamente en la lista
- Para desarrollo local, `localhost` debe estar incluido 