// DIAGNÓSTICO TEMPORAL - prueba el clasificador local. Se elimina después.
import { clasificarLocal } from "../js/utils/clasificador-local.js";

const PRODUCTOS = [
  "Coca Cola 2.25L", "Leche La Serenisima", "Yogur Ser frutilla", "Pan lactal Bimbo",
  "Fideos Matarazzo", "Arroz Gallo Oro", "Aceite Cocinero", "Azucar Ledesma",
  "Yerba Playadito", "Cafe La Virginia", "Galletitas Oreo", "Alfajor Jorgito",
  "Jabon en polvo Ala", "Lavandina Ayudin", "Shampoo Sedal", "Pañales Pampers",
  "Cigarrillos Marlboro", "Vino Toro tinto", "Cerveza Quilmes", "Fernet Branca",
  "Queso cremoso", "Jamon cocido", "Salame milan", "Milanesa de pollo",
  "Manzana roja", "Tomate perita", "Helado Frigor", "Papas congeladas McCain",
  "Manteca Sancor", "Dulce de leche", "Mayonesa Hellmanns", "Atun La Campagnola",
  "Gaseosa Manaos", "Agua Villavicencio", "Jugo Cepita", "Papas fritas Lays",
  "Chocolate Milka", "Caramelos Sugus", "Detergente Magistral", "Papel higienico Elite",
  "Desodorante Rexona", "Pila Duracell", "Sal fina Celusal", "Harina Blancaflor",
  "Polenta Presto Pronta", "Mermelada Arcor", "Te Green Hills", "Vinagre Menoyo",
  "Brocoli", "Pechuga de pollo", "Red Bull", "Beldent menta", "Knorr caldo",
  "Crema dental Colgate", "Cerveza Heineken", "Queso cheddar", "Avena Quaker",
  "Producto rarisimo xyz", "Tornillos", "Cuaderno Rivadavia",
];

export default function handler(req, res) {
  const filas = PRODUCTOS.map((p) => {
    const r = clasificarLocal(p);
    return { producto: p, reconocido: !!r, rubro: r?.rubro || null, vence: r?.tipo_vencimiento || null };
  });
  const reconocidos = filas.filter((f) => f.reconocido).length;
  return res.status(200).json({
    total: PRODUCTOS.length,
    reconocidos,
    porcentaje: Math.round((reconocidos / PRODUCTOS.length) * 100),
    noReconocidos: filas.filter((f) => !f.reconocido).map((f) => f.producto),
    detalle: filas,
  });
}
