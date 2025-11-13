require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} = require("@aws-sdk/client-sqs");

// Configuración de clientes AWS
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const sqs = new SQSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const queueUrl =
  "https://sqs.eu-west-2.amazonaws.com/975130647458/ris-input-notifications";

// Crear directorio de descargas si no existe
if (!fs.existsSync(process.env.DOWNLOAD_PATH)) {
  fs.mkdirSync(process.env.DOWNLOAD_PATH);
}

async function downloadFile(bucket, key) {
  const downloadPath = path.join(process.env.DOWNLOAD_PATH, key);

  // Crear directorios necesarios
  const dir = path.dirname(downloadPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3.send(command);
    const writeStream = fs.createWriteStream(downloadPath);

    response.Body.pipe(writeStream);

    return new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
  } catch (error) {
    // Si el archivo no existe en S3, solo advertir y continuar
    if (error.Code === 'NoSuchKey') {
      console.warn(`⚠️  El archivo ${key} no existe en S3, ignorando...`);
      return; // No romper el proceso
    }
    console.error(`Error al descargar el archivo ${key}:`, error);
    throw error;
  }
}

async function processMessages() {
  try {
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20,
    });

    const data = await sqs.send(command);

    if (!data.Messages || data.Messages.length === 0) {
      return;
    }

    for (const message of data.Messages) {
      if (!message.Body) {
        console.log("Mensaje recibido sin Body, ignorando...");
        continue;
      }

      try {
        // Imprimir el mensaje para debug
        console.log("Mensaje recibido:", message.Body);

        const body = JSON.parse(message.Body);

        // Si el mensaje viene directamente de S3
        if (body.Records) {
          const records = body.Records;
          for (const s3Record of records) {
            const bucket = s3Record.s3.bucket.name;
            const key = decodeURIComponent(
              s3Record.s3.object.key.replace(/\+/g, " ")
            );

            console.log(`Descargando archivo desde S3: ${bucket}/${key}`);
            await downloadFile(bucket, key);
          }
        }
        // Si el mensaje viene a través de SNS
        else if (body.Message) {
          const snsMessage = JSON.parse(body.Message);
          if (snsMessage.Records) {
            for (const s3Record of snsMessage.Records) {
              const bucket = s3Record.s3.bucket.name;
              const key = decodeURIComponent(
                s3Record.s3.object.key.replace(/\+/g, " ")
              );

              console.log(`Descargando archivo desde SNS: ${bucket}/${key}`);
              await downloadFile(bucket, key);
            }
          }
        }

        // Eliminar mensaje de la cola
        const deleteCommand = new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: message.ReceiptHandle,
        });

        await sqs.send(deleteCommand);
      } catch (parseError) {
        console.error("Error procesando el mensaje:", parseError);
        // Imprimir más detalles del error
        console.error("Detalles del error:", parseError.message);
        console.error("Mensaje que causó el error:", message.Body);
        continue;
      }
    }
  } catch (error) {
    console.error("Error procesando mensajes:", error);
  }
}

// Iniciar el proceso de escucha
async function startListening() {
  console.log("Iniciando escucha de nuevos archivos...");
  while (true) {
    try {
      await processMessages();
    } catch (error) {
      console.error("Error en el proceso principal:", error);
      // Esperar 5 segundos antes de reintentar
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

// Agregar manejo de errores no capturados
process.on("uncaughtException", (error) => {
  console.error("Error no capturado:", error);
  // Esperar 5 segundos y reiniciar el proceso
  setTimeout(() => {
    process.exit(1);
  }, 5000);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Promesa rechazada no manejada:", reason);
  // Esperar 5 segundos y reiniciar el proceso
  setTimeout(() => {
    process.exit(1);
  }, 5000);
});

startListening();
