# S3 File Downloader

Programa automático para descargar archivos de AWS S3 cuando se suben nuevos archivos.

## Configuración

1. Instalar Node.js
2. Clonar el repositorio
3. Crear archivo `.env` con las siguientes variables:

Para configurar todo:
Crea una carpeta en C:\ (por ejemplo, C:\S3Downloader)
Copia todos los archivos ahí:
.env
index.js
package.json
start-s3-downloader.bat
setup.bat
Ejecuta setup.bat como administrador una sola vez
Después de esto:
El programa se iniciará automáticamente cada vez que inicies Windows
Se reiniciará automáticamente si ocurre algún error
Los archivos se descargarán en la carpeta configurada en el .env
Para detener el programa:
Abre el Administrador de tareas
Busca "node.js" en la lista de procesos
Click derecho -> Finalizar tarea
¿Necesitas ayuda con alguno de estos pasos?
