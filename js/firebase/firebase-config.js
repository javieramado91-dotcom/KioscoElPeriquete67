// =============================================================
//  CONFIGURACIÓN CENTRAL DE FIREBASE
// -------------------------------------------------------------
//  Este es el ÚNICO archivo donde se inicializa Firebase.
//  Todos los servicios (auth, firestore) se exportan desde aquí
//  para que el resto del proyecto los importe sin volver a
//  inicializar la app. Esto evita conexiones duplicadas y
//  mantiene un único punto de configuración.
//
//  >>> PASO OBLIGATORIO <<<
//  Reemplazá el objeto `firebaseConfig` con las credenciales
//  de TU proyecto (Firebase Console > Configuración del proyecto
//  > Tus apps > SDK de configuración).
// =============================================================

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Credenciales del proyecto "KioscoElPeriquete67".
export const firebaseConfig = {
  apiKey: "AIzaSyCZ2VaZVxWjOfB7fIsbJnIFek7EX2-stRA",
  authDomain: "kioscoelperiquete67.firebaseapp.com",
  projectId: "kioscoelperiquete67",
  storageBucket: "kioscoelperiquete67.firebasestorage.app",
  messagingSenderId: "70698276705",
  appId: "1:70698276705:web:336510d62b5aa2efc81720",
  measurementId: "G-4HWQTYCX9Y",
};

// Inicialización única de la aplicación.
const app = initializeApp(firebaseConfig);

// Servicios reutilizables en todo el sistema.
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
