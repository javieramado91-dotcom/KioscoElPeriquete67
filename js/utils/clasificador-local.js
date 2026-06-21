// =============================================================
//  CLASIFICADOR LOCAL (sin IA, gratis e instantáneo)
// -------------------------------------------------------------
//  Adivina el rubro de un producto por palabras clave comunes
//  de almacén/despensa en Argentina. Si reconoce una palabra,
//  devuelve { rubro, perecedero } al toque (sin gastar cupo de
//  IA). Si NO reconoce nada, devuelve null y el sistema recurre
//  a la IA (que se reserva para los casos raros).
//
//  La perecibilidad se deduce del rubro: los rubros frescos
//  vencen pronto; los demás duran.
// =============================================================

const RUBROS_PERECEDEROS = new Set([
  "Lácteos",
  "Fiambres y quesos",
  "Carnes",
  "Frutas y verduras",
  "Panadería",
  "Congelados",
]);

// Reglas ORDENADAS: la primera que coincide gana. Por eso las
// excepciones/casos específicos van ARRIBA de las generales.
const REGLAS = [
  // --- Excepciones que pisan reglas generales ---
  { rubro: "Almacén", palabras: ["pan rallado", "rebozador", "pan dulce"] },
  { rubro: "Perfumería e higiene", palabras: ["jabon de tocador", "jabon blanco", "papel higienico"] },
  { rubro: "Limpieza", palabras: ["jabon en polvo", "jabon liquido", "jabon para la ropa"] },

  // --- Lácteos ---
  { rubro: "Lácteos", palabras: ["leche", "yogur", "yoghurt", "manteca", "margarina", "crema de leche", "dulce de leche", "ricota", "postre", "flan listo", "chocolatada", "danonino", "casancrem", "finlandia", "queso untable"] },

  // --- Fiambres y quesos ---
  { rubro: "Fiambres y quesos", palabras: ["queso", "jamon", "salame", "salamin", "mortadela", "bondiola", "panceta", "fiambre", "paleta", "lomito", "mozzarella", "muzzarella", "roquefort", "provolone"] },

  // --- Carnes ---
  { rubro: "Carnes", palabras: ["carne", "pollo", "milanesa", "bife", "asado", "chorizo", "hamburguesa", "pescado", "merluza", "costilla", "molida", "vacio", "matambre", "pata muslo", "suprema", "cerdo", "morcilla", "salchicha"] },

  // --- Frutas y verduras ---
  { rubro: "Frutas y verduras", palabras: ["manzana", "banana", "naranja", "mandarina", "papa", "cebolla", "tomate", "lechuga", "zanahoria", "fruta", "verdura", "palta", "limon", "frutilla", "zapallo", "morron", "ajo", "pera", "uva", "durazno", "ciruela", "choclo fresco", "acelga", "espinaca", "batata", "pepino", "apio"] },

  // --- Panadería ---
  { rubro: "Panadería", palabras: ["pan ", "pan lactal", "pebete", "factura", "medialuna", "criollo", "bizcocho de grasa", "baguette", "felipe", "figazza"] },

  // --- Congelados ---
  { rubro: "Congelados", palabras: ["congelad", "helado", "nuggets", "bastones", "rabas", "papas noisette", "verdura congelada", "pizza congelada"] },

  // --- Bebidas alcohólicas ---
  { rubro: "Bebidas alcohólicas", palabras: ["vino", "cerveza", "fernet", "vodka", "whisky", "whiskey", "gin", "ron", "aperitivo", "champagne", "champan", "sidra", "licor", "vermut", "espumante", "malbec", "quilmes", "brahma", "andes", "stella", "campari", "gancia"] },

  // --- Bebidas ---
  { rubro: "Bebidas", palabras: ["gaseosa", "coca", "sprite", "fanta", "pepsi", "agua", "jugo", "exprimido", "energizante", "speed", "gatorade", "powerade", "soda", "tonica", "isotonica", "amargo", "terma", "manaos", "cunnington", "cepita", "baggio"] },

  // --- Galletitas ---
  { rubro: "Galletitas", palabras: ["galletit", "galleta", "oreo", "criollitas", "sonrisas", "melitas", "vainillas", "obleas", "rumba", "merengadas", "express", "9 de oro", "traviata", "chocolinas"] },

  // --- Golosinas y snacks ---
  { rubro: "Golosinas y snacks", palabras: ["chocolate", "alfajor", "caramelo", "chupetin", "chicle", "papas fritas", "palitos", "chizito", "mani", "turron", "gomita", "bombon", "snack", "nachos", "doritos", "pringles", "rocklets", "tita", "rhodesia", "cofler", "block", "marroc"] },

  // --- Limpieza ---
  { rubro: "Limpieza", palabras: ["lavandina", "detergente", "suavizante", "limpiador", "lustramuebles", "insecticida", "cif", "ayudin", "magistral", "esponja", "virulana", "cloro", "desinfectante", "trapo", "escoba", "secador", "bolsa de residuo", "rollo de cocina", "servilleta", "desodorante de ambiente", "poett", "mr musculo"] },

  // --- Perfumería e higiene ---
  { rubro: "Perfumería e higiene", palabras: ["shampoo", "champu", "acondicionador", "pasta dental", "dentifrico", "cepillo de dientes", "desodorante", "toallita", "toallas femeninas", "pañal", "panal", "algodon", "alcohol en gel", "afeitar", "enjuague bucal", "jabon de glicerina", "crema corporal", "hisopo"] },

  // --- Kiosco ---
  { rubro: "Kiosco", palabras: ["cigarrillo", "marlboro", "philip", "tabaco", "encendedor", "fosforo", "pila ", "pilas", "preservativo", "chicles"] },

  // --- Almacén (seco, larga duración) ---
  { rubro: "Almacén", palabras: ["fideo", "arroz", "harina", "azucar", "aceite", "sal ", "yerba", "mate cocido", "polenta", "pure de tomate", "salsa", "lenteja", "poroto", "garbanzo", "conserva", "atun", "arveja", "choclo en lata", "mayonesa", "ketchup", "mostaza", "caldo", "sopa", "cafe", "cacao", "mermelada", "miel", "vinagre", "gelatina", "levadura", "premezcla", "leche en polvo", " te ", "yerba mate", "snacks"] },
];

function normalizar(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[áàä]/g, "a")
    .replace(/[éèë]/g, "e")
    .replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o")
    .replace(/[úùü]/g, "u")
    .replace(/ñ/g, "n"); // saca acentos y ñ
}

/**
 * Intenta clasificar un producto por palabras clave (sin IA).
 * @param {string} texto  nombre + marca + detalle.
 * @returns {{rubro:string, perecedero:boolean}|null}  null si no reconoce nada.
 */
export function clasificarLocal(texto) {
  // Agregamos espacios al borde para que coincidan claves como "pan "
  const t = " " + normalizar(texto) + " ";
  for (const regla of REGLAS) {
    if (regla.palabras.some((p) => t.includes(p))) {
      return { rubro: regla.rubro, perecedero: RUBROS_PERECEDEROS.has(regla.rubro) };
    }
  }
  return null;
}
