# Configuración de Email Personalizado en Firebase

## Para que los emails NO vayan a spam

### 1. Configurar Dominio Personalizado en Firebase

1. Ve a **Firebase Console** → **Authentication** → **Settings**
2. Busca la sección **"Authorized domains"**
3. Agrega tu dominio real (ej: `tudominio.com`)
4. Ve a **"Templates"** → **"Email verification"**
5. Personaliza el email con tu marca

### 2. Configurar DNS Records

Si tienes un dominio, agrega estos registros DNS:

```
Tipo: TXT
Nombre: @
Valor: google-site-verification=tu-codigo-de-verificacion
```

### 3. Configurar SPF Record

```
Tipo: TXT
Nombre: @
Valor: v=spf1 include:_spf.google.com ~all
```

### 4. Configurar DKIM (Opcional)

Firebase te proporcionará las claves DKIM en la configuración.

## Alternativa Temporal: Instrucciones para Usuarios

Agregar a tu sitio web:

"**Importante:** Los emails de verificación pueden ir a tu carpeta de spam. 
Por favor revisa también esa carpeta y marca el email como 'No es spam' 
para que futuros emails lleguen a tu bandeja principal." 