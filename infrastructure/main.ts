import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { DockerProvider } from "./.gen/providers/docker/docker-provider";
import * as fs from "fs";
import * as path from "path";
import { Namespace } from "./.gen/providers/kubernetes/namespace";
import { CLUSTER_NAME } from "./config";
import { buildAndPushImage } from "./docker";
import { GoogleProvider } from "@cdktf/provider-google";
import { KubernetesCluster, GoogleContainerRegistry } from './lib';
class InfrastructureLayer extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new GoogleProvider(this, "google", {
      zone: "us-central1-c",
      project: "dschmidt-cdk-test",
    });

    new GoogleContainerRegistry(this, 'gcr');

    const cluster = new KubernetesCluster(this, CLUSTER_NAME);
    cluster.addNodePool("main");
    cluster.addAutoscalingNodePool("workloads");
  }
}

class BaselineLayer extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);
    new GoogleProvider(this, "google", {
      zone: "us-central1-c",
      project: "dschmidt-cdk-test",
    });

    const cluster = KubernetesCluster.onCluster(this, CLUSTER_NAME);

    // perhaps have a curated list of charts which can
    // be installed in the cluster? certManager, grafana, ...
    cluster.installHelmChart({
      name: "cert-manager",
      repository: "https://charts.jetstack.io",
      chart: "cert-manager",
      createNamespace: true,
      namespace: "cert-manager",
      version: "v1.3.1",
    });
  }
}

class ApplicationLayer extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);
    new GoogleProvider(this, "google", {
      zone: "us-central1-c",
      project: "dschmidt-cdk-test",
    });
    new DockerProvider(this, "docker", {});
    const cluster = KubernetesCluster.onCluster(this, CLUSTER_NAME);

    const ns = new Namespace(this, "ns", {
      metadata: [
        {
          name,
        },
      ],
    });

    const servicePath = path.resolve(__dirname, "../services");

    // this part in particular is still hard to grasp
    // for one part, I think interfaces rather than positional
    // args would make it easier to read.
    // However, there's probably an abstraction for Service missing,
    // to encapsulate a bunch of these informations
    // e.g. something along the lines of this:
    //
    // fs.readdirSync(servicePath).forEach((p) => {
    //   new Service(this, p, {
    //     cluster,
    //     namespace: ns
    //   })
    // }
    fs.readdirSync(servicePath).forEach((p) => {
      const [tag, image] = buildAndPushImage(
        this,
        p,
        path.resolve(servicePath, p)
      );
      cluster.exposeDeployment(
        ns,
        p,
        tag,
        {
          application: p,
        },
        [image]
      );
    });
  }
}

const app = new App();
new InfrastructureLayer(app, "infrastructure");
new BaselineLayer(app, "baseline");
new ApplicationLayer(app, "development");
new ApplicationLayer(app, "staging");
new ApplicationLayer(app, "production");
app.synth();
