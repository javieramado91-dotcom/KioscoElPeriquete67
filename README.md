# 🛒 El Periquete — Sistema de gestión de despensa

Primera versión del sistema web para la despensa **El Periquete**.
Construido con **HTML + CSS + JavaScript puro (ES Modules)** y **Firebase**
(Authentication + Firestore). Arquitectura modular pensada para crecer.

---

## 📁 Estructura de carpetas

```
KIOSCO EL PERIQUETE/
│
├── index.html                  # Pantalla de LOGIN (punto de entrada)
├── README.md                   # Este archivo
│
├── css/                        # Estilos, divididos por responsabilidad
│   ├── variables.css           # Colores, tipografía, sombras (design tokens)
│   ├── base.css                # Reset + estilos del login
│   ├── layout.css              # Sidebar + estructura responsive
│   └── components.css          # Botones, formularios, tarjetas, tablas...
│
├── pages/                      # Páginas privadas (requieren sesión)
│   ├── inicio.html             # Pantalla principal / bienvenida
│   ├── ganancias.html          # Formulario de carga de ganancias
│   └── estadisticas.html       # Totales, tabla y gráficos
│
├── js/                         # Lógica JavaScript (modular)
│   ├── firebase/
│   │   └── firebase-config.js  # ⚙️ Inicializa Firebase (PONER TUS CLAVES)
│   ├── services/               # Acceso a datos (única vía a Firebase)
│   │   ├── auth.service.js      # Login / logout / sesión
│   │   ├── usuarios.service.js  # Perfil y roles (colección usuarios)
│   │   └── ganancias.service.js # CRUD de ganancias
│   ├── components/
│   │   └── navbar.js           # Sidebar/menú compartido
│   ├── utils/
│   │   ├── guards.js           # Protección de páginas (redirige si no hay sesión)
│   │   └── format.js           # Formato de fechas y moneda
│   ├── login.js                # Controlador del login
│   ├── inicio.js               # Controlador de inicio
│   ├── ganancias.js            # Controlador de ganancias
│   └── estadisticas.js         # Controlador de estadísticas + Chart.js
│
├── assets/                     # Imágenes, logos, íconos (futuro)
│
└── firebase/                   # Configuración de Firebase para la consola
    ├── firestore.rules         # 🔒 Reglas de seguridad (copiar y pegar)
    └── estructura-firestore.md # Cómo deben quedar los datos
```

### ¿Por qué esta separación?

- **services/** → si mañana cambia la base de datos, solo se tocan estos archivos.
- **components/** → el menú se define una vez y se reutiliza en todas las páginas.
- **utils/** → funciones puras reutilizables, fáciles de testear.
- **css/ dividido** → cambiar el aspecto global desde `variables.css`.
- **pages/ separadas** → cada módulo es independiente y escalable.

---

## 🚀 Instalación paso a paso

### 1. Crear el proyecto en Firebase
1. Entrá a <https://console.firebase.google.com> → **Agregar proyecto**.
2. Nombre: `el-periquete` (o el que prefieras).

### 2. Activar Authentication
1. Menú lateral → **Build → Authentication → Comenzar**.
2. Pestaña **Sign-in method** → activá **Correo electrónico/contraseña**.

### 3. Crear la base de datos Firestore
1. Menú lateral → **Build → Firestore Database → Crear base de datos**.
2. Elegí **modo producción** (las reglas las ponemos nosotros).

### 4. Cargar las Security Rules
1. Firestore → pestaña **Reglas**.
2. Borrá todo y pegá el contenido de [`firebase/firestore.rules`](firebase/firestore.rules).
3. **Publicar**.

### 5. Obtener las credenciales y configurarlas
1. ⚙️ **Configuración del proyecto → Tus apps → Web (`</>`)**.
2. Registrá la app y copiá el objeto `firebaseConfig`.
3. Pegalo en [`js/firebase/firebase-config.js`](js/firebase/firebase-config.js)
   reemplazando los valores `TU_API_KEY`, etc.

### 6. Crear el primer usuario (admin)
1. **Authentication → Users → Add user** (email + contraseña). Copiá el **UID**.
2. **Firestore → Iniciar colección** `usuarios`:
   - **Document ID** = el UID copiado.
   - Campos: `nombre` (string), `email` (string), `rol` = `admin`.

   > El detalle está en [`firebase/estructura-firestore.md`](firebase/estructura-firestore.md).

### 7. Ejecutar el sistema
Como usa **ES Modules**, debe servirse por HTTP (no abrir el `.html` con doble clic).
Opciones:

```bash
# Opción A: con Python (ya instalado en muchas PC)
python -m http.server 5500

# Opción B: con Node
npx serve

# Opción C: extensión "Live Server" de VS Code → botón "Go Live"
```

Luego abrí <http://localhost:5500> e iniciá sesión.

---

## 🔒 Resumen de seguridad

| Acción                         | usuario | admin |
|--------------------------------|:------:|:-----:|
| Iniciar sesión                 |  ✅    |  ✅   |
| Leer ganancias                 |  ✅    |  ✅   |
| Crear ganancia                 |  ✅    |  ✅   |
| Editar ganancia propia         |  ✅    |  ✅   |
| Editar ganancia de otro        |  ❌    |  ✅*  |
| Eliminar ganancia              |  ❌    |  ✅   |
| Acceso sin sesión              |  ❌    |  ❌   |

\* Por las reglas, admin puede borrar; la edición está restringida al creador.
Si querés que el admin edite cualquier registro, se ajusta en `firestore.rules`.

---

## 🧱 Pensado para crecer

La arquitectura ya está preparada para los próximos módulos:
**Gastos, Inventario, Proveedores, Clientes, Ventas, Caja diaria,
Deudas, Cuentas corrientes, Reportes PDF y multiusuario.**

Para agregar un módulo nuevo:
1. Crear `pages/<modulo>.html` (copiando una existente).
2. Crear `js/<modulo>.js` (controlador).
3. Crear `js/services/<modulo>.service.js` (datos).
4. Agregar una entrada al array `MENU` en `js/components/navbar.js`.
5. Agregar reglas para su colección en `firebase/firestore.rules`.

Ver más ideas en la sección **Recomendaciones** de la entrega.
