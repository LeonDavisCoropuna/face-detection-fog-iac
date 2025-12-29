import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as fs from "fs";   
import * as path from "path"; 
import "dotenv/config"; 

// --- CONFIGURACIÓN GLOBAL ---
const gcpConfig = new pulumi.Config("gcp");
const project = gcpConfig.require("project");
const location = "us-central1"; 

const config = new pulumi.Config();
const gmailPassword = process.env.GMAIL_PASSWORD || config.requireSecret("gmailPassword");

// SOLUCIÓN AL ERROR: Definimos dockerTag
// Se prioriza la variable de entorno, si no existe usa 'latest'
const dockerTag = process.env.IMAGE_TAG || "latest"; 

// --- 1. ALMACENAMIENTO (BUCKETS) ---

const bucketImagenes = new gcp.storage.Bucket("sentinel-incoming-images", {
  location: location,
  forceDestroy: true,
  uniformBucketLevelAccess: false, 
});

new gcp.storage.BucketIAMMember("public-images-viewer", {
  bucket: bucketImagenes.name,
  role: "roles/storage.objectViewer",
  member: "allUsers",
});

const bucketEmpleados = new gcp.storage.Bucket("sentinel-employees", {
  location: location,
  forceDestroy: true,
  uniformBucketLevelAccess: true,
});

const empleadosDir = path.join(__dirname, "../empleados");
try {
  const archivosEmpleados = fs.readdirSync(empleadosDir);
  archivosEmpleados.forEach(archivo => {
    if (archivo.match(/\.(jpg|jpeg|png)$/i)) {
      new gcp.storage.BucketObject(`empleado-${archivo}`, {
        bucket: bucketEmpleados.name,
        source: new pulumi.asset.FileAsset(path.join(empleadosDir, archivo)),
        name: archivo,
        contentType: "image/jpeg",
      });
    }
  });
} catch (e) {
  pulumi.log.warn("No se encontró la carpeta de empleados para subir.");
}

// --- 2. BASE DE DATOS Y MENSAJERÍA ---

const database = new gcp.firestore.Database("sentinel-db", {
  locationId: location,
  type: "FIRESTORE_NATIVE",
});

const pubsubTopic = new gcp.pubsub.Topic("sentinel-alerts-topic", {
  name: "sentinel-alerts-topic"
});

// --- 3. REPOSITORIOS DE CONTENEDORES ---

const repoAnalyst = new gcp.artifactregistry.Repository("sentinel-repo", {
  location: location,
  repositoryId: "sentinel-repo",
  format: "DOCKER",
});

const repoDashboard = new gcp.artifactregistry.Repository("sentinel-dashboard-repo", {
  location: location,
  repositoryId: "sentinel-dashboard-repo",
  format: "DOCKER",
});

// --- 4. IDENTIDADES Y PERMISOS ---

const triggerServiceAccount = new gcp.serviceaccount.Account("trigger-sa", {
  accountId: "sentinel-trigger-sa",
  displayName: "Sentinel Main Service Account",
});

const roles = ["roles/storage.objectAdmin", "roles/datastore.user", "roles/pubsub.publisher"];
roles.forEach(role => {
  new gcp.projects.IAMMember(`sa-role-${role.replace(/[^a-z0-9]/gi, '-')}`, {
    project: project,
    role: role,
    member: pulumi.interpolate`serviceAccount:${triggerServiceAccount.email}`,
  });
});

const storageServiceAccount = gcp.storage.getProjectServiceAccount({});
new gcp.projects.IAMMember("storage-pubsub-publisher", {
  project: project,
  role: "roles/pubsub.publisher",
  member: pulumi.interpolate`serviceAccount:${storageServiceAccount.then(sa => sa.emailAddress)}`,
});

// --- 5. SERVICIOS CLOUD RUN ---

// A. ANALISTA
const analystImage = pulumi.interpolate`${location}-docker.pkg.dev/${project}/${repoAnalyst.repositoryId}/sentinel-analyst:${dockerTag}`;
const cloudRunAnalyst = new gcp.cloudrunv2.Service("sentinel-analyst-service", {
  location: location,
  template: {
    containers: [{
      image: analystImage,
      resources: { limits: { cpu: "2000m", memory: "2Gi" } },
      envs: [
        { name: "DB_NAME", value: database.name },
        { name: "BUCKET_EMPLEADOS", value: bucketEmpleados.name },
        { name: "TOPIC_ID", value: pubsubTopic.name },
        { name: "PROJECT_ID", value: project },
      ],
    }],
    serviceAccount: triggerServiceAccount.email,
  },
}, { dependsOn: [repoAnalyst] });

// B. DASHBOARD
const dashboardImage = pulumi.interpolate`${location}-docker.pkg.dev/${project}/${repoDashboard.repositoryId}/sentinel-dashboard:${dockerTag}`;
const cloudRunDashboard = new gcp.cloudrunv2.Service("sentinel-dashboard-service", {
  location: location,
  template: {
    containers: [{
      image: dashboardImage,
      ports: { containerPort: 8080 }, // Corregido formato de puerto
      resources: { limits: { cpu: "1000m", memory: "512Mi" } },
    }],
  },
}, { dependsOn: [repoDashboard] });

new gcp.cloudrunv2.ServiceIamMember("public-dashboard-access", {
  location: location,
  name: cloudRunDashboard.name,
  role: "roles/run.invoker",
  member: "allUsers",
});

// --- 6. EVENTARC TRIGGER ---

new gcp.eventarc.Trigger("sentinel-trigger", {
  location: location,
  destination: {
    cloudRunService: {
      service: cloudRunAnalyst.name,
      region: location,
    },
  },
  matchingCriterias: [
    { attribute: "type", value: "google.cloud.storage.object.v1.finalized" },
    { attribute: "bucket", value: bucketImagenes.name },
  ],
  serviceAccount: triggerServiceAccount.email,
}, { dependsOn: [cloudRunAnalyst] });

// --- 7. NOTIFICADOR ---

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
    pubsubTopic: pubsubTopic.id,
    retryPolicy: "RETRY_POLICY_DO_NOT_RETRY",
  },
});

const subscriptionInvoker = new gcp.serviceaccount.Account("sub-invoker", {
  accountId: "sentinel-sub-invoker",
});

new gcp.cloudrun.IamMember("invoker-perm", {
  location: location,
  service: functionNotifier.name,
  role: "roles/run.invoker",
  member: pulumi.interpolate`serviceAccount:${subscriptionInvoker.email}`,
});

new gcp.pubsub.Subscription("sentinel-notifier-sub", {
  topic: pubsubTopic.name,
  pushConfig: {
    pushEndpoint: functionNotifier.url,
    oidcToken: { serviceAccountEmail: subscriptionInvoker.email },
  },
  ackDeadlineSeconds: 60,
});

// --- EXPORTS ---
export const dashboardUrl = cloudRunDashboard.uri;
export const analystUrl = cloudRunAnalyst.uri;
export const bucketAlerts = bucketImagenes.name;
export const bucketEmployees = bucketEmpleados.name;
export const topicName = pubsubTopic.name;