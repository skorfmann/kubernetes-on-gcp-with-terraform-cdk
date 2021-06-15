import { Construct } from "constructs";
import { ITerraformDependable } from "cdktf";
import { Resource } from "../.gen/providers/null/resource";
import { Deployment } from "../.gen/providers/kubernetes/deployment";
import { Service } from "../.gen/providers/kubernetes/service";

export interface KubernetesServiceConfig {
  readonly namespaceId: string;
  readonly image: string;
  readonly labels: Record<string, string>;
  readonly dependencies: ITerraformDependable[];
}

export class KubernetesService extends Resource {
  constructor(
    scope: Construct,
    name: string,
    config: KubernetesServiceConfig
  ) {
    super(scope, name);
    const { dependencies, labels, namespaceId, image } = config;

    const deployment = new Deployment(scope, `${image}-deployment`, {
      dependsOn: dependencies,
      metadata: [
        {
          name,
          labels,
          namespace: namespaceId,
        },
      ],
      spec: [
        {
          selector: [
            {
              matchLabels: labels,
            },
          ],
          template: [
            {
              metadata: [
                {
                  labels,
                },
              ],
              spec: [
                {
                  container: [
                    {
                      name: "application",
                      image: image,
                      port: [{ containerPort: 80 }],
                      livenessProbe: [
                        {
                          httpGet: [
                            {
                              path: "/health",
                              port: "80",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    new Service(scope, `${image}-service`, {
      dependsOn: [deployment],
      metadata: [{ name: image, namespace: namespaceId }],
      spec: [
        {
          selector: { application: image },
          port: [{ port: 80 }],
        },
      ],
    });
  }
}