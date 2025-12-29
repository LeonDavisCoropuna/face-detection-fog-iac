import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as fs from "fs";   // <--- Para leer archivos
import * as path from "path"; // <--- Para manejar rutas de carpetas
import "dotenv/config"; // <--- Para leer variables de entorno desde .env

const gcpConfig = new pulumi.Config("gcp");
const project = gcpConfig.require("project");
const location = "us-central1"; // Unificamos la región

// Configuración de secretos
const config = new pulumi.Config();
const gmailPassword = process.env.GMAIL_PASSWORD || config.requireSecret("gmailPassword");

// 1. BUCKET DE IMÁGENES (Donde llegan las fotos del Fog Node)
const bucketImagenes = new gcp.storage.Bucket("sentinel-incoming-images", {
  location: location,
  forceDestroy: true,
  uniformBucketLevelAccess: true,
});

// 2. BUCKET DE EMPLEADOS (Base de datos de caras)
const bucketEmpleados = new gcp.storage.Bucket("sentinel-employees", {
  location: location,
  forceDestroy: true,
  uniformBucketLevelAccess: true,
});

// --- AUTOMATIZACIÓN DE CARGA DE EMPLEADOS ---

// 1. Definir la ruta de la carpeta (Sube un nivel desde 'infraestructura-cloud' hacia 'empleados')
const empleadosDir = path.join(__dirname, "../empleados");

// 2. Leer los archivos de la carpeta local
try {
  const archivosEmpleados = fs.readdirSync(empleadosDir);
  archivosEmpleados.forEach(archivo => {
    if (archivo.endsWith(".png") || archivo.endsWith(".jpg") || archivo.endsWith(".jpeg")) {
      new gcp.storage.BucketObject(`empleado-${archivo}`, {
        bucket: bucketEmpleados.name, // El nombre del bucket que definiste arriba
        source: new pulumi.asset.FileAsset(path.join(empleadosDir, archivo)), // Ruta local
        name: archivo, // Nombre que tendrá en la nube (ej: leon_davis.png)
        contentType: "image/png", // Opcional: ayuda al navegador a saber qué es
      });

      pulumi.log.info(`✅ Preparando subida para: ${archivo}`);
    }
  });
} catch (error) {
  pulumi.log.warn(`⚠️ No se pudo leer la carpeta de empleados en: ${empleadosDir}. Asegúrate de que exista.`);
}

// 3. BASE DE DATOS (Firestore)
const database = new gcp.firestore.Database("sentinel-db", {
  locationId: location,
  type: "FIRESTORE_NATIVE",
});

// 4. ARTIFACT REGISTRY (Donde guardaremos tu imagen Docker)
const repositorio = new gcp.artifactregistry.Repository("sentinel-repo", {
  location: location,
  repositoryId: "sentinel-repo",
  format: "DOCKER",
});

// 5. SERVICE ACCOUNT (Identidad para el Trigger de Eventarc)
const triggerServiceAccount = new gcp.serviceaccount.Account("trigger-sa", {
  accountId: "sentinel-trigger-sa",
  displayName: "Sentinel Eventarc Trigger SA",
});

const pubsubTopic = new gcp.pubsub.Topic("sentinel-alerts-topic", {
  name: "sentinel-alerts-topic"
});

// 2. Dar permiso al Cloud Run para "Publicar" (Gritar) en este topic
const publisherBinding = new gcp.pubsub.TopicIAMMember("sa-publisher-permission", {
  topic: pubsubTopic.name,
  role: "roles/pubsub.publisher",
  member: pulumi.interpolate`serviceAccount:${triggerServiceAccount.email}`,
});

// Permisos para que Eventarc pueda invocar a Cloud Run
const runInvokerBinding = new gcp.projects.IAMMember("run-invoker", {
  project: project,
  role: "roles/run.invoker",
  member: pulumi.interpolate`serviceAccount:${triggerServiceAccount.email}`,
});

// Permisos para recibir eventos
const eventReceiverBinding = new gcp.projects.IAMMember("event-receiver", {
  project: project,
  role: "roles/eventarc.eventReceiver",
  member: pulumi.interpolate`serviceAccount:${triggerServiceAccount.email}`,
});

const artifactRegistryReader = new gcp.projects.IAMMember("artifact-registry-reader", {
  project: project,
  role: "roles/artifactregistry.reader",
  member: pulumi.interpolate`serviceAccount:${triggerServiceAccount.email}`,
});

const storageAdminBinding = new gcp.projects.IAMMember("sa-storage-admin", {
  project: project,
  role: "roles/storage.objectAdmin", // Permite ver, listar y descargar archivos
  member: pulumi.interpolate`serviceAccount:${triggerServiceAccount.email}`,
});

// 2. Permiso para escribir en la Base de Datos (Firestore)
const firestoreUserBinding = new gcp.projects.IAMMember("sa-firestore-user", {
  project: project,
  role: "roles/datastore.user", // Permite leer y escribir en la BD
  member: pulumi.interpolate`serviceAccount:${triggerServiceAccount.email}`,
});

// Permiso especial: El Storage de Google necesita permiso para publicar eventos
const storageServiceAccount = gcp.storage.getProjectServiceAccount({});
const pubsubPublisher = new gcp.projects.IAMMember("storage-pubsub-publisher", {
  project: project,
  role: "roles/pubsub.publisher",
  member: pulumi.interpolate`serviceAccount:${storageServiceAccount.then(sa => sa.emailAddress)}`,
});

// 6. CLOUD RUN (El cerebro con Docker) 
const dockerTag = process.env.IMAGE_TAG || "latest"; 

// 2. Construimos la URL de la imagen usando ese TAG único
const imageName = pulumi.interpolate`${location}-docker.pkg.dev/${project}/${repositorio.repositoryId}/sentinel-analyst:${dockerTag}`;
const cloudRunService = new gcp.cloudrunv2.Service("sentinel-analyst-service", {
  location: location,
  template: {
    containers: [{
      image: imageName, // Aquí usará tu imagen Docker
      resources: {
        limits: {
          cpu: "2000m",
          memory: "2Gi", // Dlib necesita RAM para compilar modelos en memoria
        },
      },
      envs: [
        { name: "DB_NAME", value: database.name }, // <--- ESTA LÍNEA ES VITAL
        { name: "PYTHONUNBUFFERED", value: "1" },
        { name: "BUCKET_EMPLEADOS", value: bucketEmpleados.name },
        { name: "TOPIC_ID", value: pubsubTopic.name },
        { name: "PROJECT_ID", value: project }, // Necesario para PubSub 
        { name: "DEPLOY_VERSION_SHA", value: process.env.COMMIT_SHA || "manual-run" }
      ],
    }],
    serviceAccount: triggerServiceAccount.email, // Usamos la misma SA para simplificar
  },
}, { dependsOn: [repositorio, artifactRegistryReader, storageAdminBinding, firestoreUserBinding, publisherBinding] }); // Esperar a que exista el repo

// 7. EVENTARC TRIGGER (El pegamento entre Bucket y Cloud Run)
const trigger = new gcp.eventarc.Trigger("sentinel-trigger", {
  location: location,
  destination: {
    cloudRunService: {
      service: cloudRunService.name,
      region: location,
    },
  },
  transport: {
    pubsub: {
      topic: "", // Se crea automático
    }
  },
  matchingCriterias: [
    { attribute: "type", value: "google.cloud.storage.object.v1.finalized" },
    { attribute: "bucket", value: bucketImagenes.name },
  ],
  serviceAccount: triggerServiceAccount.email,
}, { dependsOn: [cloudRunService, runInvokerBinding, pubsubPublisher] });


const bucketCodigoNotifier = new gcp.storage.Bucket("sentinel-notifier-code", {
  location: location,
  forceDestroy: true,
  uniformBucketLevelAccess: true,
});

const archivoNotifier = new gcp.storage.BucketObject("notifier-zip", {
  bucket: bucketCodigoNotifier.name,
  source: new pulumi.asset.AssetArchive({
    ".": new pulumi.asset.FileArchive("./app_notifier"),
  }),
});

// 2. CLOUD FUNCTION V2 (El Notificador)
const functionNotifier = new gcp.cloudfunctionsv2.Function("sentinel-notifier", {
  location: location,
  buildConfig: {
    runtime: "python310",
    entryPoint: "enviar_alerta_email",
    source: {
      storageSource: {
        bucket: bucketCodigoNotifier.name,
        object: archivoNotifier.name,
      },
    },
  },
  serviceConfig: {
    maxInstanceCount: 1,
    availableMemory: "256Mi",
    serviceAccountEmail: triggerServiceAccount.email,
    environmentVariables: {
      "GMAIL_USER": "leonfelipe201611@gmail.com",
      "GMAIL_PASSWORD": gmailPassword, // <--- Pulumi maneja la desencriptación automáticamente
      "GMAIL_DESTINATARIO": "ldavis@unsa.edu.pe",
    }
  },
  eventTrigger: {
    triggerRegion: location,
    eventType: "google.cloud.pubsub.topic.v1.messagePublished",
    pubsubTopic: pubsubTopic.id, // Conectamos al Topic que ya creaste
    retryPolicy: "RETRY_POLICY_DO_NOT_RETRY", // Si falla el email, no reintentar infinitamente
  },
});

// --- CONEXIÓN MANUAL ROBUSTA (Pub/Sub -> Notifier) ---

// 1. Cuenta de Servicio específica para esta suscripción
const subscriptionInvoker = new gcp.serviceaccount.Account("sub-invoker", {
  accountId: "sentinel-sub-invoker",
  displayName: "Sentinel Subscription Invoker",
});

// 2. Permiso: CAMBIO CLAVE AQUÍ
// En lugar de FunctionIamMember, usamos CloudRun.IamMember.
// Cloud Functions V2 corre sobre Cloud Run, así que asignamos el rol 'run.invoker'
// directamente al servicio subyacente. Esto evita el Error 400.
const invokerPermission = new gcp.cloudrun.IamMember("invoker-perm", {
  location: location,
  service: functionNotifier.name, // El servicio Cloud Run tiene el mismo nombre que la función
  role: "roles/run.invoker",
  member: pulumi.interpolate`serviceAccount:${subscriptionInvoker.email}`,
});

// 3. LA SUSCRIPCIÓN EXPLÍCITA (El puente que faltaba)
const manualSubscription = new gcp.pubsub.Subscription("sentinel-notifier-sub", {
  topic: pubsubTopic.name,
  pushConfig: {
    pushEndpoint: functionNotifier.url, // V2 expone la URL correctamente
    oidcToken: {
      serviceAccountEmail: subscriptionInvoker.email,
    },
  },
  ackDeadlineSeconds: 60,
}, { dependsOn: [invokerPermission] }); // Importante: esperar a que el permiso se cree

// Exporta la URL (aunque es interna)
export const notifierName = functionNotifier.name;
export const subscriptionName = manualSubscription.name;

// EXPORTS
export const bucketInputName = bucketImagenes.name;
export const bucketDbName = bucketEmpleados.name;
export const repoUrl = imageName;
export const serviceUrl = cloudRunService.uri;
export const topicName = pubsubTopic.name;