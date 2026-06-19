# Estructura inicial de Firestore · El Periquete

Este documento describe cómo deben quedar organizados los datos en
Firestore. Sirve como referencia para crear los primeros registros a
mano desde la consola de Firebase.

---

## Colección: `usuarios`

Cada documento representa el **perfil de negocio** de una persona.
El **ID del documento es el `uid`** que Firebase Authentication genera
para esa cuenta (así se vinculan login y perfil).

```
usuarios (colección)
└── {uid}  (documento — ID = uid de Authentication)
      ├── nombre  : string   → "Javier Amado"
      ├── email   : string   → "javier@elperiquete.com"
      └── rol     : string   → "admin" | "usuario"
```

### Ejemplo

| Campo  | Valor                         |
|--------|-------------------------------|
| nombre | `Javier Amado`                |
| email  | `javier@elperiquete.com`      |
| rol    | `admin`                       |

---

## Colección: `ganancias`

Cada documento es **el ingreso de un día**.
El **ID del documento es la fecha** en formato `YYYY-MM-DD`.
Usar la fecha como ID garantiza que **no haya dos registros para el
mismo día** (la base de datos lo impide por diseño).

```
ganancias (colección)
└── {YYYY-MM-DD}  (documento — ID = fecha)
      ├── fecha          : string     → "2026-06-19"
      ├── monto          : number     → 48500.50
      ├── observacion    : string     → "Día normal"
      ├── creado_por     : string     → uid del usuario que cargó
      └── fecha_creacion : timestamp  → (automático, serverTimestamp)
```

### Ejemplo (documento con ID `2026-06-19`)

| Campo          | Valor                         |
|----------------|-------------------------------|
| fecha          | `2026-06-19`                  |
| monto          | `48500.50`                    |
| observacion    | `Día normal`                  |
| creado_por     | `Xy12...uid...`               |
| fecha_creacion | `19 de junio de 2026, 14:05`  |

---

## Pasos para inicializar (primera vez)

1. **Crear el usuario en Authentication**
   Firebase Console → Authentication → Users → *Add user*
   (email + contraseña). Copiá el **UID** generado.

2. **Crear su perfil en Firestore**
   Firestore → *Start collection* → `usuarios` →
   *Document ID* = el UID copiado → agregar `nombre`, `email`, `rol: admin`.

3. **(Opcional) Crear la colección `ganancias`**
   Se crea sola al guardar la primera ganancia desde la app.

> Con esto ya podés iniciar sesión y usar el sistema.
