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

const RUBROS_SIN_CONTROL = new Set([
  "Limpieza",
  "Perfumería e higiene",
  "Kiosco",
]);

// Reglas ORDENADAS: la primera que coincide gana. Por eso las
// excepciones/casos específicos van ARRIBA de las generales.
const REGLAS = [
  // --- Excepciones que pisan reglas generales ---
  { rubro: "Almacén", palabras: ["pan rallado", "rebozador", "pan dulce"] },
  { rubro: "Perfumería e higiene", palabras: ["jabon de tocador", "jabon blanco", "papel higienico"] },
  { rubro: "Limpieza", palabras: ["jabon en polvo", "jabon liquido", "jabon para la ropa"] },
  // "papas fritas/congeladas" no son verdura: tienen que ganarle a "papa".
  { rubro: "Golosinas y snacks", palabras: ["papas fritas", "papa frita", "papas pay"] },
  { rubro: "Congelados", palabras: ["papas congeladas", "papa congelada", "papas bastones", "papas noisette"] },

  // --- Lácteos ---
  { rubro: "Lácteos", palabras: ["leche", "yogur", "yoghurt", "manteca", "margarina", "crema de leche", "dulce de leche", "ricota", "postre", "flan listo", "chocolatada", "danonino", "casancrem", "finlandia", "queso untable", "serenisima", "sancor", "ilolay", "milkaut", "actimel", "yogurisimo", "yogkrisimo", "cindor", "chocolada", "leche cultivada", "leche chocolatada"] },

  // --- Fiambres y quesos ---
  { rubro: "Fiambres y quesos", palabras: ["queso", "jamon", "salame", "salamin", "mortadela", "bondiola", "panceta", "fiambre", "paleta", "lomito", "mozzarella", "muzzarella", "roquefort", "provolone", "cheddar", "sardo", "reggianito", "danbo", "pategras", "cremoso", "port salut", "paladini", "cagnoli", "la piara", "leberwurst"] },

  // --- Carnes ---
  { rubro: "Carnes", palabras: ["carne", "pollo", "milanesa", "bife", "asado", "chorizo", "hamburguesa", "pescado", "merluza", "costilla", "molida", "vacio", "matambre", "pata muslo", "suprema", "cerdo", "morcilla", "salchicha", "pechuga", "nalga", "peceto", "roast beef", "cuadril", "osobuco", "carne picada", "tira de asado", "entraña", "lomo"] },

  // --- Frutas y verduras ---
  { rubro: "Frutas y verduras", palabras: ["manzana", "banana", "naranja", "mandarina", "papa", "cebolla", "tomate", "lechuga", "zanahoria", "fruta", "verdura", "palta", "limon", "frutilla", "zapallo", "morron", "ajo ", "pera", "uva", "durazno", "ciruela", "choclo fresco", "acelga", "espinaca", "batata", "pepino", "apio", "kiwi", "anana", "melon", "sandia", "brocoli", "coliflor", "remolacha", "calabaza", "mandioca", "puerro", "rucula", "champignon", "jengibre", "repollo"] },

  // --- Panadería ---
  { rubro: "Panadería", palabras: ["pan ", "pan lactal", "pebete", "factura", "medialuna", "criollo", "bizcocho de grasa", "baguette", "felipe", "figazza", "grisin", "tostada", "pan arabe", "prepizza", "tapa de empanada", "tapa de tarta", "pascualina", "pan de salvado", "facturas"] },

  // --- Congelados ---
  { rubro: "Congelados", palabras: ["congelad", "helado", "nuggets", "bastones", "rabas", "papas noisette", "verdura congelada", "pizza congelada", "patitas", "medallon", "hamburguesa congelada", "empanada congelada", "papa congelada"] },

  // --- Bebidas alcohólicas ---
  { rubro: "Bebidas alcohólicas", palabras: ["vino", "cerveza", "fernet", "vodka", "whisky", "whiskey", "gin ", "ginebra", "ron ", "aperitivo", "champagne", "champan", "sidra", "licor", "vermut", "espumante", "malbec", "quilmes", "brahma", "andes", "stella", "campari", "gancia", "smirnoff", "skyy", "branca", "cynar", "tequila", "heineken", "corona", "schneider", "imperial", "budweiser", "cabernet", "chardonnay", "torrontes"] },

  // --- Bebidas ---
  { rubro: "Bebidas", palabras: ["gaseosa", "coca", "sprite", "fanta", "pepsi", "agua", "jugo", "exprimido", "energizante", "speed", "gatorade", "powerade", "soda", "tonica", "isotonica", "amargo", "terma", "manaos", "cunnington", "cepita", "baggio", "red bull", "monster", "levite", "aquarius", "seven up", "mirinda", "villavicencio", "villa del sur", "h2oh", "clight", "tang"] },

  // --- Galletitas ---
  { rubro: "Galletitas", palabras: ["galletit", "galleta", "oreo", "criollitas", "sonrisas", "melitas", "vainillas", "obleas", "rumba", "merengadas", "express", "9 de oro", "traviata", "chocolinas", "club social", "cerealitas", "pepitos", "lincoln", "pitusas", "saladas", "manon", "duquesas", "merengueras"] },

  // --- Golosinas y snacks ---
  { rubro: "Golosinas y snacks", palabras: ["chocolate", "alfajor", "caramelo", "chupetin", "chicle", "papas fritas", "palitos", "chizito", "mani", "turron", "gomita", "bombon", "snack", "nachos", "doritos", "pringles", "rocklets", "tita", "rhodesia", "cofler", "block", "marroc", "milka", "sugus", "menthoplus", "beldent", "topline", "flynn paff", "mogul", "tic tac", "halls", "mantecol", "bananita", "tofi", "conitos", "saladix", "papa frita", "palitos salados"] },

  // --- Limpieza ---
  { rubro: "Limpieza", palabras: ["lavandina", "detergente", "suavizante", "limpiador", "lustramuebles", "insecticida", "cif", "ayudin", "magistral", "esponja", "virulana", "cloro", "desinfectante", "trapo", "escoba", "secador", "bolsa de residuo", "rollo de cocina", "servilleta", "desodorante de ambiente", "poett", "mr musculo", "vim", "pato", "raid", "repelente", "glade", "ariel", "drive", "comfort", "vivere", "zorro", "limpiavidrios", "lampazo", "rejilla", "guantes", "ablandador"] },

  // --- Perfumería e higiene ---
  { rubro: "Perfumería e higiene", palabras: ["shampoo", "champu", "acondicionador", "pasta dental", "dentifrico", "cepillo de dientes", "desodorante", "toallita", "toallas femeninas", "pañal", "panal", "algodon", "alcohol en gel", "afeitar", "enjuague bucal", "jabon de glicerina", "crema corporal", "hisopo", "gillette", "dove", "nivea", "colonia", "talco", "hilo dental", "cotonete", "protector diario", "tampones", "crema dental", "maquina de afeitar", "espuma de afeitar"] },

  // --- Kiosco ---
  { rubro: "Kiosco", palabras: ["cigarrillo", "marlboro", "philip", "tabaco", "encendedor", "fosforo", "pila ", "pilas", "preservativo", "chicles", "sube", "tarjeta sube", "fosforos", "papel de armar"] },

  // --- Almacén (seco, larga duración) ---
  { rubro: "Almacén", palabras: ["fideo", "arroz", "harina", "azucar", "aceite", "sal ", "yerba", "mate cocido", "polenta", "pure de tomate", "salsa", "lenteja", "poroto", "garbanzo", "conserva", "atun", "arveja", "choclo en lata", "mayonesa", "ketchup", "mostaza", "caldo", "sopa", "cafe", "cacao", "mermelada", "miel", "vinagre", "gelatina", "levadura", "premezcla", "leche en polvo", " te ", "yerba mate", "snacks", "knorr", "maggi", "savora", "bizcochuelo", "maicena", "fecula", "avena", "granola", "cereal", "copos", "oregano", "condimento", "pimienta", "comino", "edulcorante", "stevia", "chia", "nesquik", "toddy", "vascolet", "tomate triturado", "tomate perita", "arvejas", "lentejas", "porotos", "harina leudante", "azucar impalpable", "sopa instantanea", "pure de papa"] },
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
 * @returns {{rubro:string, tipo_vencimiento:string, confianza:number, razon:string, origen:string}|null}
 */
export function clasificarLocal(texto) {
  // Agregamos espacios al borde para que coincidan claves como "pan "
  const t = " " + normalizar(texto) + " ";
  for (const regla of REGLAS) {
    if (regla.palabras.some((p) => t.includes(p))) {
      const tipo_vencimiento = RUBROS_PERECEDEROS.has(regla.rubro)
        ? "perecedero"
        : RUBROS_SIN_CONTROL.has(regla.rubro)
          ? "sin_control"
          : "larga_duracion";
      const razon = tipo_vencimiento === "perecedero"
        ? "Es un alimento fresco o refrigerado."
        : tipo_vencimiento === "larga_duracion"
          ? "Es un producto envasado de larga duración."
          : "No necesita control habitual de vencimiento.";
      return {
        rubro: regla.rubro,
        tipo_vencimiento,
        confianza: 92,
        razon,
        origen: "clasificador_local",
      };
    }
  }
  return null;
}
