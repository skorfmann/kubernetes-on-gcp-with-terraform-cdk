import { Construct } from "constructs";
import { Resource } from "cdktf";
import { GoogleServiceAccount } from './google-service-account';
import { ContainerRegistry } from "@cdktf/provider-google";

export class GoogleContainerRegistry extends Resource {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new GoogleServiceAccount(this, "registry-push", {
      role: 'roles/storage.admin'
    });

    new ContainerRegistry(this, "registry", {});
  }
}


