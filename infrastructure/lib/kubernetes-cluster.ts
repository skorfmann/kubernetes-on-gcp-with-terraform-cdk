import { Construct } from "constructs";
import { ITerraformDependable } from "cdktf";
import { KubernetesProvider } from "../.gen/providers/kubernetes/kubernetes-provider";

import { Namespace } from "../.gen/providers/kubernetes/namespace";
import { TerraformGoogleModulesKubernetesEngineGoogleModulesAuth as GKEAuth } from "../.gen/modules/terraform-google-modules/kubernetes-engine/google/modules/auth";
import { HelmProvider } from "../.gen/providers/helm/helm-provider";
import { Release, ReleaseConfig } from "../.gen/providers/helm/release";
import { Resource } from "../.gen/providers/null/resource";
import {
  ContainerCluster,
  ContainerNodePool,
  DataGoogleContainerCluster
} from "@cdktf/provider-google";
import { KubernetesService } from './kubernetes-service'
import { GoogleServiceAccount } from './google-service-account';

// https://developers.google.com/identity/protocols/oauth2/scopes
const oauthScopes = [
  "https://www.googleapis.com/auth/devstorage.read_only",
  "https://www.googleapis.com/auth/logging.write",
  "https://www.googleapis.com/auth/monitoring",
  "https://www.googleapis.com/auth/servicecontrol",
  "https://www.googleapis.com/auth/service.management.readonly",
  "https://www.googleapis.com/auth/trace.append",
  "https://www.googleapis.com/auth/cloud-platform",
];


export class KubernetesCluster extends Resource {
  private sa: GoogleServiceAccount;
  private cluster: ContainerCluster;

  constructor(scope: Construct, name: string) {
    super(scope, name);

    this.sa = new GoogleServiceAccount(this, "cluster-admin", {
      role: 'roles/storage.admin'
    });

    this.cluster = new ContainerCluster(this, "cluster", {
      name,
      removeDefaultNodePool: true,
      initialNodeCount: 1,
      nodeConfig: [
        {
          preemptible: true,
          serviceAccount: this.sa.email,
          oauthScopes,
        },
      ],
    });
  }

  addNodePool(name: string, nodeCount = 3, machineType = "e2-medium") {
    new ContainerNodePool(this, name, {
      name,
      cluster: this.cluster.name,
      nodeCount,
      nodeConfig: [
        {
          preemptible: true,
          machineType,
          serviceAccount: this.sa.email,
          oauthScopes,
        },
      ],
    });
  }

  addAutoscalingNodePool(
    name: string,
    minNodeCount = 3,
    maxNodeCount = 10,
    machineType = "e2-medium"
  ) {
    new ContainerNodePool(this, name, {
      name,
      cluster: this.cluster.name,
      autoscaling: [
        {
          minNodeCount,
          maxNodeCount,
        },
      ],
      nodeConfig: [
        {
          preemptible: true,
          machineType,
          serviceAccount: this.sa.email,
          oauthScopes,
        },
      ],
    });
  }

  static onCluster(scope: Construct, name: string) {
    const cluster = new DataGoogleContainerCluster(scope, "cluster", {
      name,
    });

    const auth = new GKEAuth(scope, "auth", {
      clusterName: cluster.name,
      location: cluster.location,
      projectId: cluster.project,
    });

    new KubernetesProvider(scope, "kubernetes", {
      clusterCaCertificate: auth.clusterCaCertificateOutput,
      host: auth.hostOutput,
      token: auth.tokenOutput,
    });

    new HelmProvider(scope, "helm", {
      kubernetes: [
        {
          clusterCaCertificate: auth.clusterCaCertificateOutput,
          host: auth.hostOutput,
          token: auth.tokenOutput,
        },
      ],
    });

    return {
      installHelmChart(config: ReleaseConfig) {
        new Release(scope, config.name, config);
      },

      exposeDeployment(
        namespace: Namespace,
        name: string,
        image: string,
        labels: Record<string, string>,
        dependencies: ITerraformDependable[]
      ) {
        return new KubernetesService(
          scope,
          name,
          {
            image,
            labels,
            dependencies,
            namespaceId: namespace.id,
          }
        );
      },
    };
  }
}
