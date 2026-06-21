// =============================================================
//  UTILIDAD DE IMÁGENES
// -------------------------------------------------------------
//  Toma la foto que saca el usuario (un File), la achica y la
//  convierte a texto base64. Achicarla sirve para que viaje
//  rápido al servidor de IA y no gaste datos de más.
// =============================================================

/**
 * Redimensiona una imagen y la devuelve en base64 (JPEG).
 * @param {File} file        archivo de imagen (de la cámara).
 * @param {number} maxLado   lado máximo en píxeles (default 1024).
 * @param {number} calidad   0 a 1 (default 0.7).
 * @returns {Promise<{base64:string, mimeType:string, dataUrl:string}>}
 */
export function fileABase64Redimensionado(file, maxLado = 1024, calidad = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Escalamos manteniendo la proporción.
      if (width > height && width > maxLado) {
        height = Math.round((height * maxLado) / width);
        width = maxLado;
      } else if (height >= width && height > maxLado) {
        width = Math.round((width * maxLado) / height);
        height = maxLado;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", calidad);
      resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg", dataUrl });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };

    img.src = url;
  });
}
